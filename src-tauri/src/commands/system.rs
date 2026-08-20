use serde::{Deserialize, Serialize};
use sysinfo::{Disks, System};
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub os_arch: String,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_usage_percent: u32,
    pub ram_total_gb: u64,
    pub ram_available_gb: u64,
    pub ram_total_mb: u64,
    pub ram_available_mb: u64,
    pub disk_name: String,
    pub disk_total_mb: u64,
    pub disk_available_mb: u64,
    pub hostname: String,
}

#[tauri::command]
pub async fn detect_system(
    app: tauri::AppHandle,
    install_dir: Option<String>,
) -> Result<SystemInfo, String> {
    let emit = |msg: &str| {
        let _ = app.emit("install_log", format!("[system] {}", msg));
    };

    emit("正在检测 Windows 系统...");

    let os = System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_ver = System::os_version().unwrap_or_else(|| "Unknown".to_string());
    let arch = std::env::consts::ARCH.to_string();
    let hostname = System::host_name().unwrap_or_else(|| "Unknown".to_string());

    // CPU 占用率需两次采样（首次仅建立基准）
    let mut cpu_sys = System::new();
    cpu_sys.refresh_cpu_usage();
    std::thread::sleep(std::time::Duration::from_millis(200));
    cpu_sys.refresh_cpu_usage();
    let cpu_usage_percent = cpu_sys.global_cpu_info().cpu_usage().round() as u32;

    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| sys.cpus().first().map(|c| c.name().to_string()).unwrap_or_default());

    let cpu_cores = sys.cpus().len();
    let ram_total_gb = (sys.total_memory() / 1024 / 1024 / 1024) as u64;
    let ram_available_gb = (sys.available_memory() / 1024 / 1024 / 1024) as u64;
    let ram_total_mb = (sys.total_memory() / 1024 / 1024) as u64;
    let ram_available_mb = (sys.available_memory() / 1024 / 1024) as u64;

    // 磁盘占用：优先安装目录所在盘，否则系统盘 C:，再否则第一个磁盘
    let target_drive = install_dir
        .as_deref()
        .and_then(|p| p.chars().next())
        .map(|c| format!("{}:", c.to_ascii_uppercase()))
        .unwrap_or_else(|| "C:".to_string());
    let disks = Disks::new_with_refreshed_list();
    let sys_disk = disks
        .list()
        .iter()
        .find(|d| d.mount_point().to_string_lossy().starts_with(&target_drive))
        .or_else(|| {
            disks
                .list()
                .iter()
                .find(|d| d.mount_point().to_string_lossy().starts_with("C:"))
        })
        .or_else(|| disks.list().first());
    let disk_total_mb = sys_disk.map(|d| d.total_space() / 1024 / 1024).unwrap_or(0);
    let disk_available_mb = sys_disk.map(|d| d.available_space() / 1024 / 1024).unwrap_or(0);
    let disk_name = target_drive.clone();

    let info = SystemInfo {
        os_name: os.clone(),
        os_version: os_ver.clone(),
        os_arch: arch.clone(),
        cpu_name: cpu_name.clone(),
        cpu_cores,
        cpu_usage_percent,
        ram_total_gb,
        ram_available_gb,
        ram_total_mb,
        ram_available_mb,
        disk_name: disk_name.clone(),
        disk_total_mb,
        disk_available_mb,
        hostname: hostname.clone(),
    };

    emit(&format!(
        "检测完成：{} {} | {} | CPU {} 核 | RAM {}GB",
        os, os_ver, arch, cpu_cores, ram_total_gb
    ));

    Ok(info)
}

#[tauri::command]
pub fn pick_default_install_dir() -> String {
    for drive in &["D:", "E:", "F:", "C:"] {
        let p = format!("{}\\ComfyUI", drive);
        if std::path::Path::new(drive).exists() {
            return p;
        }
    }
    "C:\\ComfyUI".to_string()
}

#[tauri::command]
pub fn validate_install_dir(path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("安装路径不能为空".to_string());
    }
    for ch in path.chars() {
        if (ch as u32) > 0x7F {
            return Err("安装路径不能包含中文或特殊字符，请使用纯英文路径".to_string());
        }
    }
    let p = std::path::Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err("父目录不存在，请选择有效的磁盘分区".to_string());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn prepare_results_dir(dir: String) -> Result<String, String> {
    let p = std::path::PathBuf::from(&dir);
    std::fs::create_dir_all(&p).map_err(|e| format!("创建结果目录失败: {}", e))?;
    Ok(p.to_string_lossy().to_string())
}
