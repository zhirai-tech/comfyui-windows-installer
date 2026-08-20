use std::path::PathBuf;
use std::process::Command;

use super::{
    config_port, debug_report, probe, read_runtime, ServiceStatus, SilentCommand,
};

#[tauri::command]
pub async fn get_service_status(install_dir: String, install_mode: String) -> ServiceStatus {
    let port = config_port(&install_dir);
    let url = format!("http://127.0.0.1:{}", port);
    // #region debug-point D:get-status-enter
    debug_report("D", "service.rs:get_service_status:enter", "get_service_status entered", serde_json::json!({
        "installDir": install_dir,
        "installMode": install_mode,
        "port": port,
    }));
    // #endregion

    if install_mode == "docker" {
        let compose = PathBuf::from(&install_dir).join("docker-compose.yml");
        if !compose.exists() {
            return ServiceStatus {
                status: "unknown".into(),
                url,
                port,
                pid: None,
                started_at: None,
                last_error: Some("未找到 docker-compose.yml".into()),
            };
        }
        let ps = Command::new("docker")
            .args([
                "compose",
                "-f",
                compose.to_string_lossy().as_ref(),
                "ps",
                "--format",
                "{{.Status}}",
            ])
            .silent()
            .output();
        let up = match ps {
            Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout)
                .lines()
                .any(|l| l.starts_with("Up")),
            _ => false,
        };
        if up && probe(port) {
            return ServiceStatus {
                status: "running".into(),
                url,
                port,
                pid: None,
                started_at: None,
                last_error: None,
            };
        }
        if up {
            return ServiceStatus {
                status: "starting".into(),
                url,
                port,
                pid: None,
                started_at: None,
                last_error: None,
            };
        }
        return ServiceStatus {
            status: "stopped".into(),
            url,
            port,
            pid: None,
            started_at: None,
            last_error: None,
        };
    }

    // host 模式
    let alive = probe(port);
    if let Some((pid, _, started_at, _)) = read_runtime(&install_dir) {
        let running = if alive {
            Command::new("tasklist.exe")
                .args(["/FI", &format!("PID eq {}", pid), "/NH"])
                .silent()
                .output()
                .ok()
                .and_then(|o| {
                    String::from_utf8_lossy(&o.stdout)
                        .lines()
                        .next()
                        .map(|s| !s.contains("没有可用任务") && !s.contains("INFO"))
                })
                .unwrap_or(true)
        } else {
            false
        };
        // #region debug-point D:get-status-runtime
        debug_report("D", "service.rs:get_service_status:runtime", "runtime.json status resolved", serde_json::json!({
            "installDir": install_dir,
            "alive": alive,
            "pid": pid,
            "running": running,
            "startedAt": started_at,
        }));
        // #endregion
        return ServiceStatus {
            status: if running || alive {
                "running".into()
            } else {
                "stopped".into()
            },
            url,
            port,
            pid: Some(pid),
            started_at: Some(started_at),
            last_error: None,
        };
    }

    if alive {
        return ServiceStatus {
            status: "running".into(),
            url,
            port,
            pid: None,
            started_at: None,
            last_error: Some("端口被占用，但非本助手启动".into()),
        };
    }

    ServiceStatus {
        status: "stopped".into(),
        url,
        port,
        pid: None,
        started_at: None,
        last_error: None,
    }
}
