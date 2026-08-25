use std::path::PathBuf;
use std::process::Command;

use super::{
    cleanup_install_markers, config_port, force_remove_dir_all, probe, read_runtime,
    ServiceStatus, SilentCommand, HOST_CHILD,
};
use super::start::start_service;

pub async fn stop_service(
    install_dir: String,
    install_mode: String,
) -> Result<ServiceStatus, String> {
    let emit = move |m: &str| {
        crate::events::log("service", m);
    };
    let port = config_port(&install_dir);

    if install_mode == "docker" {
        emit("docker compose down 停止中...");
        let compose = PathBuf::from(&install_dir).join("docker-compose.yml");
        if !compose.exists() {
            return Err("docker-compose.yml 不存在".into());
        }
        let _ = Command::new("docker")
            .args(["compose", "-f", compose.to_string_lossy().as_ref(), "down"])
            .current_dir(&install_dir)
            .silent()
            .output();
        return Ok(ServiceStatus {
            status: "stopped".into(),
            url: format!("http://127.0.0.1:{}", port),
            port,
            pid: None,
            started_at: None,
            last_error: None,
        });
    }

    // host 模式：先尝试全局 child；失败则根据 runtime.json 的 pid taskkill
    let mut killed_pid: Option<u32> = None;
    {
        let mut g = HOST_CHILD.lock().unwrap();
        if let Some(mut c) = g.take() {
            killed_pid = Some(c.id());
            let _ = c.kill();
            let _ = c.wait();
        }
    }
    if killed_pid.is_none() {
        if let Some((pid, _, _, _)) = read_runtime(&install_dir) {
            killed_pid = Some(pid);
            emit(&format!("taskkill /PID {} /T /F", pid));
            let _ = Command::new("taskkill.exe")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .silent()
                .output();
        }
    }

    // 等待端口真正释放，避免紧接着的 get_service_status 误报「端口被占用」
    for _ in 0..20 {
        if !probe(port) {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }

    // 删除 runtime.json
    let runtime = PathBuf::from(&install_dir).join("launcher").join("runtime.json");
    let _ = std::fs::remove_file(&runtime);

    emit("ComfyUI 已停止");
    Ok(ServiceStatus {
        status: "stopped".into(),
        url: format!("http://127.0.0.1:{}", port),
        port,
        pid: killed_pid,
        started_at: None,
        last_error: None,
    })
}

pub async fn restart_service(
    install_dir: String,
    install_mode: String,
) -> Result<ServiceStatus, String> {
    let _ = stop_service(install_dir.clone(), install_mode.clone()).await;
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    start_service(install_dir, install_mode).await
}

pub async fn uninstall_service(
    install_dir: String,
    install_mode: String,
    keep_models: bool,
) -> Result<String, String> {
    let emit = move |m: &str| {
        crate::events::log("service", m);
    };

    emit("开始卸载 ComfyUI...");
    let _ = stop_service(install_dir.clone(), install_mode.clone()).await;
    cleanup_install_markers(&install_dir);

    let target = PathBuf::from(&install_dir);

    // 保留模型：把 models 目录移到安装目录之外的备份目录，再删除其余内容
    if keep_models {
        let models_src = target.join("ComfyUI").join("models");
        let name = target
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let backup = target
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join(format!("{}_models", name));

        if models_src.exists() {
            if backup.exists() {
                emit(&format!("检测到旧的模型备份目录 {}，先清除", backup.display()));
                force_remove_dir_all(&backup).map_err(|e| format!("清除旧模型备份失败: {}", e))?;
            }
            std::fs::rename(&models_src, &backup)
                .map_err(|e| format!("移动模型目录失败: {}", e))?;
            emit(&format!("模型已保留到 {}", backup.display()));
        } else {
            emit("未找到 models 目录，跳过模型备份");
        }
    }

    if target.exists() {
        emit(&format!("删除安装目录 {}", target.display()));
        force_remove_dir_all(&target).map_err(|e| format!("删除安装目录失败: {}", e))?;
    } else {
        emit("安装目录不存在，跳过目录删除");
    }

    emit("卸载完成");
    Ok(format!("已卸载 {}", install_dir))
}
