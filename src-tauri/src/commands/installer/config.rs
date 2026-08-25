use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

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

pub fn write_install_config(config: InstallConfig) -> Result<(), String> {
    let root = PathBuf::from(&config.install_dir).join("launcher");
    let _ = std::fs::create_dir_all(&root);
    let path = root.join("config.json");
    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    crate::events::log("config", &format!("配置文件已写入 {}", path.display()));

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

pub fn has_install_config(cfg_path: String) -> bool {
    Path::new(&cfg_path).exists()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProbeInstalledResult {
    pub installed: bool,
    pub install_dir: String,
    pub install_mode: String,
    /// 检测到的 ComfyUI 版本类型：managed / desktop / portable / docker / none
    pub install_kind: String,
    pub config: Option<InstallConfig>,
    pub has_venv_python: bool,
    pub has_comfyui_main: bool,
    pub torch_version: Option<String>,
}

pub async fn probe_any_installed(candidate_dir: String) -> ProbeInstalledResult {
    // 检测优先级：助手自己装过的 → 官方桌面版 → 官方宿主机版 → 官方容器版
    if let Some(r) = probe_managed(&candidate_dir) {
        return r;
    }
    if let Some(r) = probe_desktop() {
        return r;
    }
    if let Some(r) = probe_portable() {
        return r;
    }
    if let Some(r) = probe_docker_container() {
        return r;
    }

    ProbeInstalledResult {
        installed: false,
        install_dir: candidate_dir.clone(),
        install_mode: "host".to_string(),
        install_kind: "none".to_string(),
        config: None,
        has_venv_python: false,
        has_comfyui_main: false,
        torch_version: None,
    }
}

// 助手自己装过的：靠 launcher/config.json marker（host / docker）
fn probe_managed(candidate_dir: &str) -> Option<ProbeInstalledResult> {
    let mut dirs: Vec<String> = Vec::new();
    if !candidate_dir.trim().is_empty() {
        dirs.push(candidate_dir.to_string());
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

        return Some(ProbeInstalledResult {
            installed: true,
            install_dir: dir.clone(),
            install_mode: mode.to_string(),
            install_kind: "managed".to_string(),
            config,
            has_venv_python,
            has_comfyui_main,
            torch_version,
        });
    }
    None
}

// 官方桌面版：Comfy Desktop 的安装实例目录
fn probe_desktop() -> Option<ProbeInstalledResult> {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .map(|p| p.join("Comfy-Desktop").join("ComfyUI-Installs"))?;
    if !base.exists() {
        return None;
    }
    let first = std::fs::read_dir(&base)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| p.is_dir())?;

    Some(ProbeInstalledResult {
        installed: true,
        install_dir: first.to_string_lossy().to_string(),
        install_mode: "desktop".to_string(),
        install_kind: "desktop".to_string(),
        config: None,
        has_venv_python: false,
        has_comfyui_main: true,
        torch_version: None,
    })
}

// 官方宿主机版：portable 目录，或手动 clone（有 main.py 但无助手 marker）
fn probe_portable() -> Option<ProbeInstalledResult> {
    for drive in &["D:", "E:", "F:", "C:"] {
        if !Path::new(drive).exists() {
            continue;
        }

        let portable_root = PathBuf::from(drive).join("ComfyUI_windows_portable");
        let portable_main = portable_root.join("ComfyUI").join("main.py");
        if portable_main.exists() {
            return Some(ProbeInstalledResult {
                installed: true,
                install_dir: portable_root.to_string_lossy().to_string(),
                install_mode: "host".to_string(),
                install_kind: "portable".to_string(),
                config: None,
                has_venv_python: false,
                has_comfyui_main: true,
                torch_version: None,
            });
        }

        let manual_main = PathBuf::from(drive).join("ComfyUI").join("ComfyUI").join("main.py");
        let manual_marker = PathBuf::from(drive).join("ComfyUI").join("launcher").join("config.json");
        if manual_main.exists() && !manual_marker.exists() {
            return Some(ProbeInstalledResult {
                installed: true,
                install_dir: format!("{}\\ComfyUI", drive),
                install_mode: "host".to_string(),
                install_kind: "portable".to_string(),
                config: None,
                has_venv_python: false,
                has_comfyui_main: true,
                torch_version: None,
            });
        }
    }
    None
}

// 官方容器版：docker 运行中的 comfyui 容器
fn probe_docker_container() -> Option<ProbeInstalledResult> {
    let out = Command::new("docker")
        .args(["ps", "--format", "{{.Names}} {{.Image}}"])
        .silent()
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let raw = String::from_utf8_lossy(&out.stdout);
    for line in raw.lines() {
        let lower = line.to_lowercase();
        if lower.contains("comfyui") || lower.contains("comfy") {
            return Some(ProbeInstalledResult {
                installed: true,
                install_dir: String::new(),
                install_mode: "docker".to_string(),
                install_kind: "docker".to_string(),
                config: None,
                has_venv_python: false,
                has_comfyui_main: false,
                torch_version: None,
            });
        }
    }
    None
}

pub fn read_install_config(install_dir: String) -> Option<InstallConfig> {
    let cfg_path = PathBuf::from(&install_dir).join("launcher").join("config.json");
    std::fs::read_to_string(&cfg_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<InstallConfig>(&raw).ok())
}

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
