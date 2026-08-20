use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::Mutex;

pub mod lifecycle;
pub(crate) mod precheck;
pub mod start;
pub mod status;

pub(crate) use super::SilentCommand;

pub(crate) static HOST_CHILD: Mutex<Option<Child>> = Mutex::new(Option::None);

#[cfg(windows)]
pub(crate) const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
pub(crate) const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

// #region debug-point B:service-helper
pub(crate) fn debug_report(hypothesis_id: &str, location: &str, msg: &str, data: serde_json::Value) {
    let payload = serde_json::json!({
        "sessionId": "comfyui-startup-state",
        "runId": "post-fix",
        "hypothesisId": hypothesis_id,
        "location": location,
        "msg": format!("[DEBUG] {}", msg),
        "data": data,
    })
    .to_string();
    if let Ok(mut stream) = std::net::TcpStream::connect("127.0.0.1:7777") {
        let req = format!(
            "POST /event HTTP/1.1\r\nHost: 127.0.0.1:7777\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            payload.len(),
            payload
        );
        let _ = stream.write_all(req.as_bytes());
    }
}
// #endregion

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServiceStatus {
    pub status: String,
    pub url: String,
    pub port: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

pub(crate) fn probe(port: u32) -> bool {
    match std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port as u16)),
        std::time::Duration::from_millis(500),
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

pub(crate) fn read_runtime(install_dir: &str) -> Option<(u32, u32, String, String)> {
    let launcher = PathBuf::from(install_dir).join("launcher");
    let runtime_json = launcher.join("runtime.json");
    let data = std::fs::read_to_string(runtime_json).ok()?;
    let v: serde_json::Value = serde_json::from_str(&data).ok()?;
    let pid = v.get("pid")?.as_u64()? as u32;
    let port = v.get("port")?.as_u64()? as u32;
    let started_at = v
        .get("started_at")
        .and_then(|x| x.as_str())
        .unwrap_or("-")
        .to_string();
    let mode = v
        .get("mode")
        .and_then(|x| x.as_str())
        .unwrap_or("host")
        .to_string();
    Some((pid, port, started_at, mode))
}

pub(crate) fn write_runtime(
    install_dir: &str,
    pid: u32,
    port: u32,
    mode: &str,
) -> std::io::Result<()> {
    let launcher = PathBuf::from(install_dir).join("launcher");
    let _ = std::fs::create_dir_all(&launcher);
    let map = serde_json::json!({
        "pid": pid,
        "port": port,
        "mode": mode,
        "started_at": chrono_now_local()
    });
    std::fs::write(
        launcher.join("runtime.json"),
        serde_json::to_string_pretty(&map).unwrap(),
    )
}

pub(crate) fn chrono_now_local() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let secs = d as i64;
    format!("utc_{}", secs)
}

pub(crate) fn config_port(install_dir: &str) -> u32 {
    let cfg_path = PathBuf::from(install_dir).join("launcher").join("config.json");
    if let Ok(data) = std::fs::read_to_string(&cfg_path) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
            if let Some(p) = v.get("port").and_then(|x| x.as_u64()) {
                return p as u32;
            }
        }
    }
    8188
}

pub(crate) fn appdata_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("LOCALAPPDATA").map(PathBuf::from))
        .map(|p| p.join("comfyui-installer"))
}

pub(crate) fn remove_marker_if_matches(path: &PathBuf, install_dir: &str) {
    let raw = match std::fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(_) => return,
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return;
    };
    let Some(dir) = v.get("install_dir").and_then(|x| x.as_str()) else {
        return;
    };
    if dir.eq_ignore_ascii_case(install_dir) {
        let _ = std::fs::remove_file(path);
    }
}

pub(crate) fn cleanup_install_markers(install_dir: &str) {
    if let Some(dir) = appdata_dir() {
        remove_marker_if_matches(&dir.join("installed.json"), install_dir);
    }
    let launcher = PathBuf::from(install_dir).join("launcher");
    remove_marker_if_matches(&launcher.join("installed.json"), install_dir);
    let _ = std::fs::remove_file(launcher.join("runtime.json"));
}

/// 递归删除目录，删除前先清除只读属性（Windows 下 .git/objects 等只读文件会导致 remove_dir_all 失败）。
pub(crate) fn force_remove_dir_all(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }
    let meta = std::fs::symlink_metadata(path)?;
    if meta.file_type().is_symlink() || !meta.is_dir() {
        return std::fs::remove_file(path);
    }
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let p = entry.path();
        let m = std::fs::symlink_metadata(&p)?;
        if m.file_type().is_symlink() || !m.is_dir() {
            let mut perms = m.permissions();
            perms.set_readonly(false);
            let _ = std::fs::set_permissions(&p, perms);
            std::fs::remove_file(&p)?;
        } else {
            force_remove_dir_all(&p)?;
        }
    }
    std::fs::remove_dir(path)
}
