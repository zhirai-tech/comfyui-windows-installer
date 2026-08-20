use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use tauri::Emitter;

use super::{
    chrono_now_local, config_port, debug_report, probe, write_runtime, ServiceStatus,
    SilentCommand, HOST_CHILD, CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW,
};
use super::precheck::run_torch_precheck;

fn spawn_log_reader<S, F>(
    stream: Option<S>,
    app: tauri::AppHandle,
    tag: &'static str,
    service_prefix: &'static str,
    emit: F,
    recent: Arc<Mutex<Vec<String>>>,
) where
    S: Read + Send + 'static,
    F: Fn(&str) + Send + 'static,
{
    std::thread::spawn(move || {
        let mut buf = [0u8; 2048];
        if let Some(mut s) = stream {
            loop {
                match s.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let t = String::from_utf8_lossy(&buf[..n]).to_string();
                        for l in t.lines() {
                            let line = l.to_string();
                            if line.trim().is_empty() {
                                continue;
                            }
                            let _ = app.emit("install_log", format!("[{}] {}", tag, line));
                            emit(&format!("{}: {}", service_prefix, line));
                            let mut g = recent.lock().unwrap();
                            g.push(line);
                            if g.len() > 60 {
                                let n = g.len() - 60;
                                g.drain(0..n);
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        }
    });
}

#[tauri::command]
pub async fn start_service(
    app: tauri::AppHandle,
    install_dir: String,
    install_mode: String,
) -> Result<ServiceStatus, String> {
    let app_emit = app.clone();
    let emit = move |m: &str| {
        let _ = app_emit.emit("install_log", format!("[service] {}", m));
    };
    let port = config_port(&install_dir);
    let url = format!("http://127.0.0.1:{}", port);
    // #region debug-point B:start-service-enter
    debug_report("B", "service.rs:start_service:enter", "start_service entered", serde_json::json!({
        "installDir": install_dir,
        "installMode": install_mode,
        "port": port,
    }));
    // #endregion

    if install_mode == "docker" {
        emit("docker compose up -d 启动中...");
        let compose = PathBuf::from(&install_dir).join("docker-compose.yml");
        if !compose.exists() {
            return Err("docker-compose.yml 不存在".into());
        }
        let out = Command::new("docker")
            .args(["compose", "-f", compose.to_string_lossy().as_ref(), "up", "-d"])
            .current_dir(&install_dir)
            .silent()
            .output()
            .map_err(|e| e.to_string())?;
        let raw = format!(
            "{}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        for l in raw.lines() {
            emit(l);
        }
        if !out.status.success() {
            return Err("启动失败，请查看日志".into());
        }
        return Ok(ServiceStatus {
            status: "starting".into(),
            url,
            port,
            pid: None,
            started_at: Some(chrono_now_local()),
            last_error: None,
        });
    }

    // host 模式
    let venv_python = PathBuf::from(&install_dir)
        .join("venv")
        .join("Scripts")
        .join("python.exe");
    let comfyui_dir = PathBuf::from(&install_dir).join("ComfyUI");
    if !venv_python.exists() {
        // #region debug-point B:missing-venv
        debug_report("B", "service.rs:start_service:missing-venv", "venv python missing", serde_json::json!({
            "venvPython": venv_python,
        }));
        // #endregion
        return Err("未找到 venv Python，请先完成安装".into());
    }
    if !comfyui_dir.join("main.py").exists() {
        // #region debug-point B:missing-main
        debug_report("B", "service.rs:start_service:missing-main", "main.py missing", serde_json::json!({
            "comfyuiDir": comfyui_dir,
        }));
        // #endregion
        return Err("未找到 ComfyUI/main.py，请先完成安装".into());
    }

    if probe(port) {
        return Ok(ServiceStatus {
            status: "running".into(),
            url,
            port,
            pid: None,
            started_at: None,
            last_error: Some("端口已占用，可能已经在运行".into()),
        });
    }

    emit(&format!(
        "启动: {} main.py --listen --port {}",
        venv_python.display(),
        port
    ));

    run_torch_precheck(&venv_python, &comfyui_dir, emit.clone())?;

    let mut child_cmd = Command::new(&venv_python);
    child_cmd
        .args([
            "-u",
            "main.py",
            "--listen",
            "127.0.0.1",
            "--port",
            &port.to_string(),
        ])
        .current_dir(&comfyui_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .silent();
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        child_cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    }
    let mut child = child_cmd
        .spawn()
        .map_err(|e| format!("启动失败: {}", e))?;
    let pid = child.id();
    // #region debug-point B:spawn-child
    debug_report("B", "service.rs:start_service:spawn", "python child spawned", serde_json::json!({
        "pid": pid,
        "port": port,
        "cwd": comfyui_dir,
    }));
    // #endregion

    // 存入全局 + runtime.json（先存再轮询，try_wait 能拿到子进程句柄）
    let recent_log: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::with_capacity(256)));
    let started_at = chrono_now_local();
    write_runtime(&install_dir, pid, port, "host").ok();

    // stdout/stderr 读取线程（tail 60 条缓存，崩溃时塞进 Err 让前端看到真实报错）
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    spawn_log_reader(stdout, app.clone(), "comfyui", "stdout", emit.clone(), recent_log.clone());
    spawn_log_reader(stderr, app.clone(), "comfyui:err", "stderr", emit.clone(), recent_log.clone());

    {
        let mut g = HOST_CHILD.lock().unwrap();
        *g = Some(child);
    }

    // 启动后 18 秒轮询：子进程崩了立刻返回 error；probe 通了说明加载完了，再切 running
    let mut waited = 0u64;
    let probe_ok = loop {
        if waited >= 36 {
            break false;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
        waited += 1;
        let mut maybe_exit: Option<std::process::ExitStatus> = None;
        if let Ok(mut guard) = HOST_CHILD.lock() {
            if let Some(c) = guard.as_mut() {
                match c.try_wait() {
                    Ok(Some(status)) => {
                        maybe_exit = Some(status);
                        let _ = guard.take();
                    }
                    Ok(None) => {}
                    Err(_) => {}
                }
            }
        }
        if let Some(status) = maybe_exit {
            let runtime = PathBuf::from(&install_dir).join("launcher").join("runtime.json");
            let _ = std::fs::remove_file(&runtime);
            let tail: Vec<String> = recent_log
                .lock()
                .unwrap()
                .iter()
                .rev()
                .take(30)
                .rev()
                .cloned()
                .collect();
            let tail_str = if tail.is_empty() {
                "（无可用日志，通常是 Python 进程启动就退出，比如 venv python.exe 被杀毒软件拦截）".to_string()
            } else {
                tail.join("\n")
            };
            // #region debug-point B:child-exit
            debug_report("B", "service.rs:start_service:child-exit", "python child exited during startup", serde_json::json!({
                "exitCode": status.code(),
                "tail": tail_str,
            }));
            // #endregion
            return Err(format!(
                "ComfyUI 启动后立刻崩溃（exit {:?}）。\nPython 端最近 30 条日志 → \n{}\n\n常见原因：PyTorch 版本与显卡 CUDA 不匹配、显卡驱动过旧、ComfyUI 依赖缺包、缺 VC++ 2022 运行库",
                status.code(),
                tail_str
            ));
        }
        if probe(port) {
            // #region debug-point B:probe-ok
            debug_report("B", "service.rs:start_service:probe-ok", "port probe succeeded", serde_json::json!({
                "port": port,
                "pid": pid,
                "waitedTicks": waited,
            }));
            // #endregion
            break true;
        }
    };

    Ok(ServiceStatus {
        status: if probe_ok { "running".into() } else { "starting".into() },
        url,
        port,
        pid: Some(pid),
        started_at: Some(started_at),
        last_error: None,
    })
}
