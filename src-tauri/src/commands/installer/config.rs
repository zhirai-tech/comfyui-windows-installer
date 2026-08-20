use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::Emitter;

use super::SilentCommand;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallConfig {
    pub install_dir: String,
    pub python_exe: String,
    pub comfyui_dir: String,
    pub venv_python: String,
    pub install_mode: String,
    pub gpu_name: String,
    pub vram_gb: u64,
    pub installed_at: String,
    #[serde(default = "default_port")]
    pub port: u32,
    #[serde(default)]
    pub launch_args: String,
}

fn default_port() -> u32 {
    8188
}

#[tauri::command]
pub fn write_install_config(app: tauri::AppHandle, config: InstallConfig) -> Result<(), String> {
    let root = PathBuf::from(&config.install_dir).join("launcher");
    let _ = std::fs::create_dir_all(&root);
    let path = root.join("config.json");
    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    let _ = app.emit("install_log", format!("[config] 配置文件已写入 {}", path.display()));

    // 双写 marker：launcher/installed.json（安装目录内）+ APPDATA\comfyui-installer\installed.json 全局
    let marker_local = root.join("installed.json");
    let marker_data = serde_json::json!({
        "install_dir": &config.install_dir,
        "install_mode": &config.install_mode,
        "installed_at": chrono_now_local_marker()
    });
    let marker_str = serde_json::to_string_pretty(&marker_data).map_err(|e| e.to_string())?;
    let _ = std::fs::write(&marker_local, &marker_str);
    let _ = write_install_marker(&config.install_dir, &config.install_mode);
    Ok(())
}

fn appdata_dir() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("LOCALAPPDATA").map(PathBuf::from))
        .map(|p| p.join("comfyui-installer"))
}

fn write_install_marker(install_dir: &str, install_mode: &str) -> Result<(), String> {
    let dir = appdata_dir().ok_or("无法获取 APPDATA 目录")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let data = serde_json::json!({
        "install_dir": install_dir,
        "install_mode": install_mode,
        "installed_at": chrono_now_local_marker()
    });
    let path = dir.join("installed.json");
    std::fs::write(&path, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn chrono_now_local_marker() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("utc_{}", d as i64)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallMarker {
    pub install_dir: String,
    pub install_mode: String,
    pub installed_at: Option<String>,
}

fn try_read_marker_at(path: &Path) -> Option<InstallMarker> {
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str::<InstallMarker>(&raw).ok()
}

#[tauri::command]
pub fn read_install_marker() -> Option<InstallMarker> {
    // 1) 优先 APPDATA 全局
    if let Some(dir) = appdata_dir() {
        if let Some(m) = try_read_marker_at(&dir.join("installed.json")) {
            return Some(m);
        }
    }
    // 2) 常见盘符扫 launcher/installed.json
    for drive in &["D:", "E:", "F:", "C:"] {
        let p = PathBuf::from(drive)
            .join("ComfyUI")
            .join("launcher")
            .join("installed.json");
        if let Some(m) = try_read_marker_at(&p) {
            return Some(m);
        }
    }
    // 3) 兼容旧版：找到 config.json + venv + main.py 就返回该目录当作 marker
    for drive in &["D:", "E:", "F:", "C:"] {
        let cfg = PathBuf::from(drive).join("ComfyUI").join("launcher").join("config.json");
        let venv = PathBuf::from(drive)
            .join("ComfyUI")
            .join("venv")
            .join("Scripts")
            .join("python.exe");
        let main = PathBuf::from(drive).join("ComfyUI").join("ComfyUI").join("main.py");
        if cfg.exists() && venv.exists() && main.exists() {
            return Some(InstallMarker {
                install_dir: format!("{}\\ComfyUI", drive),
                install_mode: "host".to_string(),
                installed_at: None,
            });
        }
    }
    None
}

#[tauri::command]
pub fn launch_comfyui(install_dir: String) -> Result<(), String> {
    let bat = PathBuf::from(&install_dir).join("启动 ComfyUI.bat");
    if !bat.exists() {
        return Err("未找到启动脚本，请先完成安装".to_string());
    }
    let _ = Command::new("cmd.exe")
        .args(["/c", bat.to_string_lossy().as_ref()])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn has_install_config(cfg_path: String) -> bool {
    Path::new(&cfg_path).exists()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProbeInstalledResult {
    pub installed: bool,
    pub install_dir: String,
    pub install_mode: String,
    pub config: Option<InstallConfig>,
    pub has_venv_python: bool,
    pub has_comfyui_main: bool,
    pub torch_version: Option<String>,
}

#[tauri::command]
pub async fn probe_any_installed(candidate_dir: String) -> ProbeInstalledResult {
    let mut dirs: Vec<String> = Vec::new();
    if !candidate_dir.trim().is_empty() {
        dirs.push(candidate_dir.clone());
    }
    for drive in &["D:", "E:", "F:", "C:"] {
        if Path::new(drive).exists() {
            dirs.push(format!("{}\\ComfyUI", drive));
        }
    }
    dirs.push("C:\\ComfyUI".to_string());
    dirs.dedup();

    for dir in &dirs {
        let launcher_dir = PathBuf::from(dir).join("launcher");
        let cfg_path = launcher_dir.join("config.json");
        let venv_py = PathBuf::from(dir).join("venv").join("Scripts").join("python.exe");
        let main_py = PathBuf::from(dir).join("ComfyUI").join("main.py");
        let compose_yml = PathBuf::from(dir).join("docker-compose.yml");

        let has_cfg = cfg_path.exists();
        let has_venv_python = venv_py.exists();
        let has_comfyui_main = main_py.exists();
        let has_compose = compose_yml.exists();

        let mode: &str = if has_compose && !has_venv_python {
            "docker"
        } else {
            "host"
        };

        let installed_host = has_cfg && has_venv_python && has_comfyui_main;
        let installed_docker = has_cfg && has_compose && mode == "docker";
        if !(installed_host || installed_docker) {
            continue;
        }

        let config: Option<InstallConfig> = if has_cfg {
            std::fs::read_to_string(&cfg_path)
                .ok()
                .and_then(|raw| serde_json::from_str::<InstallConfig>(&raw).ok())
        } else {
            None
        };

        let torch_version = if has_venv_python {
            match Command::new(&venv_py)
                .args(["-c", "import torch; print(torch.__version__)"])
                .silent()
                .output()
            {
                Ok(o) if o.status.success() => {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                }
                _ => None,
            }
        } else {
            None
        };

        return ProbeInstalledResult {
            installed: true,
            install_dir: dir.clone(),
            install_mode: mode.to_string(),
            config,
            has_venv_python,
            has_comfyui_main,
            torch_version,
        };
    }

    ProbeInstalledResult {
        installed: false,
        install_dir: candidate_dir.clone(),
        install_mode: "host".to_string(),
        config: None,
        has_venv_python: false,
        has_comfyui_main: false,
        torch_version: None,
    }
}

#[tauri::command]
pub fn read_install_config(install_dir: String) -> Option<InstallConfig> {
    let cfg_path = PathBuf::from(&install_dir).join("launcher").join("config.json");
    std::fs::read_to_string(&cfg_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<InstallConfig>(&raw).ok())
}

#[tauri::command]
pub fn update_install_config(
    install_dir: String,
    port: u32,
    launch_args: String,
) -> Result<(), String> {
    let cfg_path = PathBuf::from(&install_dir).join("launcher").join("config.json");
    let mut config: InstallConfig = std::fs::read_to_string(&cfg_path)
        .map_err(|e| format!("读取配置失败: {}", e))
        .and_then(|raw| {
            serde_json::from_str::<InstallConfig>(&raw).map_err(|e| format!("解析配置失败: {}", e))
        })?;
    config.port = port;
    config.launch_args = launch_args;
    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&cfg_path, data).map_err(|e| e.to_string())?;
    Ok(())
}
