use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::Emitter;

use super::gpu;
use super::service::{config_port, probe};
use super::SilentCommand;

#[derive(Serialize, Clone)]
pub struct CheckItem {
    pub key: String,
    pub label: String,
    pub status: String, // normal | warning | error
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ReportSummary {
    pub normal: usize,
    pub warning: usize,
    pub error: usize,
}

#[derive(Serialize, Clone)]
pub struct EnvironmentReport {
    pub install_dir: String,
    pub install_mode: String,
    pub items: Vec<CheckItem>,
    pub summary: ReportSummary,
}

fn item(key: &str, label: &str, status: &str, message: impl Into<String>, detail: Option<String>) -> CheckItem {
    CheckItem {
        key: key.to_string(),
        label: label.to_string(),
        status: status.to_string(),
        message: message.into(),
        detail,
    }
}

/// 通过 HTTP GET / 判断端口上跑的是不是 ComfyUI 前端。
/// 端口被 ComfyUI 占用是「已启动」的正常状态，不应告警。
fn probe_comfyui(port: u32) -> bool {
    use std::io::{Read, Write};
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port as u16));
    let Ok(mut stream) =
        std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(800))
    else {
        return false;
    };
    let req = format!(
        "GET / HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nAccept: text/html\r\nConnection: close\r\n\r\n",
        port
    );
    if stream.write_all(req.as_bytes()).is_err() {
        return false;
    }
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_millis(1500)));
    let mut buf = [0u8; 4096];
    let mut total: Vec<u8> = Vec::new();
    loop {
        match stream.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                total.extend_from_slice(&buf[..n]);
                if total.len() >= 64 * 1024 {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    let s = String::from_utf8_lossy(&total).to_lowercase();
    (s.starts_with("http/1.1 200") || s.starts_with("http/1.0 200")) && s.contains("comfyui")
}

fn run_python_script(python: &PathBuf, cwd: &PathBuf, code: &str) -> Option<String> {
    let out = Command::new(python)
        .args(["-c", code])
        .current_dir(cwd)
        .silent()
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    Some(s.trim().to_string())
}

/// 返回 (torch 版本, cuda 是否可用)。torch 没装返回 None。
pub(crate) fn probe_torch(python: &PathBuf, cwd: &PathBuf) -> Option<(String, bool)> {
    let code = "import torch\nprint(torch.__version__)\nprint(str(torch.cuda.is_available()))";
    let s = run_python_script(python, cwd, code)?;
    let mut lines = s.lines();
    let version = lines.next()?.trim().to_string();
    let cuda = lines.next().map(|l| l.trim() == "True").unwrap_or(false);
    Some((version, cuda))
}

fn probe_python_version(python: &PathBuf) -> Option<String> {
    let code = "import sys\nprint(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')";
    run_python_script(python, &PathBuf::from("."), code)
}

fn count_files(dir: &PathBuf) -> usize {
    let mut n = 0;
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                n += count_files(&p);
            } else {
                n += 1;
            }
        }
    }
    n
}

pub(crate) fn detect_host<F>(push: &mut F, install_dir: &str)
where
    F: FnMut(CheckItem),
{
    let comfyui_dir = PathBuf::from(install_dir).join("ComfyUI");
    let venv_python = PathBuf::from(install_dir)
        .join("venv")
        .join("Scripts")
        .join("python.exe");
    let main_py = comfyui_dir.join("main.py");
    let folder_paths = comfyui_dir.join("folder_paths.py");
    let comfy_init = comfyui_dir.join("comfy").join("__init__.py");
    let models_dir = comfyui_dir.join("models");
    let workflows_dir = comfyui_dir.join("user").join("default").join("workflows");
    let config_json = PathBuf::from(install_dir).join("launcher").join("config.json");

    // 1. ComfyUI 主程序
    if main_py.exists() {
        push(item(
            "comfyui",
            "ComfyUI",
            "normal",
            "ComfyUI 主程序存在",
            Some(main_py.to_string_lossy().to_string()),
        ));
    } else {
        push(item(
            "comfyui",
            "ComfyUI",
            "error",
            "未找到 ComfyUI 主程序 main.py",
            Some(format!("期望位置：{}", main_py.to_string_lossy())),
        ));
    }

    // 2. 核心文件
    if !main_py.exists() {
        push(item(
            "comfyui_files",
            "核心文件",
            "error",
            "ComfyUI 核心文件缺失",
            None,
        ));
    } else if folder_paths.exists() || comfy_init.exists() {
        push(item(
            "comfyui_files",
            "核心文件",
            "normal",
            "核心文件完整",
            None,
        ));
    } else {
        push(item(
            "comfyui_files",
            "核心文件",
            "warning",
            "缺少 folder_paths.py / comfy 包，可能是不完整安装",
            None,
        ));
    }

    // 3. Python 环境
    if !venv_python.exists() {
        push(item(
            "python",
            "Python",
            "error",
            "未找到虚拟环境 Python",
            Some(format!("期望位置：{}", venv_python.to_string_lossy())),
        ));
    } else if let Some(ver) = probe_python_version(&venv_python) {
        let (major, minor, _) = {
            let parts: Vec<u32> = ver.split('.').map(|s| s.parse().unwrap_or(0)).collect();
            (
                *parts.first().unwrap_or(&0),
                *parts.get(1).unwrap_or(&0),
                *parts.get(2).unwrap_or(&0),
            )
        };
        let compatible = major == 3 && minor >= 10 && minor <= 12;
        push(item(
            "python",
            "Python",
            if compatible { "normal" } else { "error" },
            if compatible {
                format!("Python {} 版本兼容", ver)
            } else {
                format!("Python {} 版本不兼容（需 3.10~3.12）", ver)
            },
            Some(venv_python.to_string_lossy().to_string()),
        ));
    } else {
        push(item(
            "python",
            "Python",
            "error",
            "Python 无法正常运行",
            Some(venv_python.to_string_lossy().to_string()),
        ));
    }

    // 4/5. PyTorch + CUDA（一次探测）
    let torch = probe_torch(&venv_python, &comfyui_dir);
    match torch {
        Some((version, cuda_ok)) => {
            push(item(
                "deps",
                "PyTorch",
                "normal",
                format!("PyTorch {} 已安装", version),
                None,
            ));
            push(item(
                "cuda",
                "CUDA",
                if cuda_ok { "normal" } else { "warning" },
                if cuda_ok {
                    "PyTorch 已启用 CUDA 加速".to_string()
                } else {
                    "PyTorch 未启用 CUDA，将以 CPU 模式运行（速度较慢）".to_string()
                },
                None,
            ));
        }
        None => {
            push(item(
                "deps",
                "PyTorch",
                "error",
                "PyTorch 未安装或无法导入",
                None,
            ));
            push(item(
                "cuda",
                "CUDA",
                "error",
                "无法判断 CUDA（依赖 PyTorch）",
                None,
            ));
        }
    }

    // 6. GPU 硬件
    match gpu::run_nvidia_smi() {
        Ok(raw) => match gpu::parse_nvidia_smi(&raw) {
            Some((name, mb, _used, _drv, _cuda)) => push(item(
                "gpu",
                "显卡",
                "normal",
                format!("{} · {} GB", name, (mb as f64 / 1024.0).round() as u64),
                None,
            )),
            None => push(item(
                "gpu",
                "显卡",
                "warning",
                "未检测到 NVIDIA 显卡，将使用 CPU",
                None,
            )),
        },
        Err(_) => push(item(
            "gpu",
            "显卡",
            "warning",
            "无法读取显卡信息（nvidia-smi 不可用）",
            None,
        )),
    }

    // 7. 端口
    let port = config_port(install_dir);
    if probe(port) {
        if probe_comfyui(port) {
            push(item(
                "port",
                "端口",
                "normal",
                format!("端口 {} · ComfyUI 服务运行中", port),
                None,
            ));
        } else {
            push(item(
                "port",
                "端口",
                "warning",
                format!("端口 {} 被其他程序占用", port),
                None,
            ));
        }
    } else {
        push(item(
            "port",
            "端口",
            "normal",
            format!("端口 {} 空闲", port),
            None,
        ));
    }

    // 8. 模型目录
    if !models_dir.exists() {
        push(item(
            "models",
            "模型",
            "warning",
            "模型目录不存在",
            Some(models_dir.to_string_lossy().to_string()),
        ));
    } else if count_files(&models_dir) == 0 {
        push(item(
            "models",
            "模型",
            "warning",
            "模型目录为空，尚未放置模型",
            None,
        ));
    } else {
        push(item(
            "models",
            "模型",
            "normal",
            "模型目录已就绪",
            None,
        ));
    }

    // 9. 工作流目录
    if workflows_dir.exists() {
        push(item(
            "workflows",
            "工作流",
            "normal",
            "工作流目录已就绪",
            None,
        ));
    } else {
        push(item(
            "workflows",
            "工作流",
            "warning",
            "工作流目录不存在",
            Some(workflows_dir.to_string_lossy().to_string()),
        ));
    }

    // 10. 启动配置
    if config_json.exists() {
        push(item(
            "config",
            "启动配置",
            "normal",
            "启动配置已写入",
            None,
        ));
    } else {
        push(item(
            "config",
            "启动配置",
            "warning",
            "缺少启动配置（launcher/config.json）",
            None,
        ));
    }
}

pub(crate) fn detect_docker<F>(push: &mut F, install_dir: &str)
where
    F: FnMut(CheckItem),
{
    let compose = PathBuf::from(install_dir).join("docker-compose.yml");
    let config_json = PathBuf::from(install_dir).join("launcher").join("config.json");
    let models_dir = PathBuf::from(install_dir).join("data").join("models");
    let workflows_dir = PathBuf::from(install_dir)
        .join("data")
        .join("user")
        .join("default")
        .join("workflows");

    // 1. Docker 安装
    let docker_ok = Command::new("docker")
        .args(["--version"])
        .silent()
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    push(item(
        "docker",
        "Docker",
        if docker_ok { "normal" } else { "error" },
        if docker_ok {
            "Docker 已安装".to_string()
        } else {
            "未检测到 Docker".to_string()
        },
        None,
    ));

    // 2. Docker 运行
    let docker_running = Command::new("docker")
        .args(["info"])
        .silent()
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    push(item(
        "docker_running",
        "Docker 服务",
        if docker_running { "normal" } else { "error" },
        if docker_running {
            "Docker 正在运行".to_string()
        } else {
            "Docker 未运行（请启动 Docker Desktop）".to_string()
        },
        None,
    ));

    // 3. compose 文件
    push(item(
        "compose",
        "compose 配置",
        if compose.exists() { "normal" } else { "error" },
        if compose.exists() {
            "docker-compose.yml 已就绪".to_string()
        } else {
            "缺少 docker-compose.yml".to_string()
        },
        None,
    ));

    // 4. GPU
    match gpu::run_nvidia_smi() {
        Ok(raw) => match gpu::parse_nvidia_smi(&raw) {
            Some((name, mb, _used, _drv, _cuda)) => push(item(
                "gpu",
                "显卡",
                "normal",
                format!("{} · {} GB", name, (mb as f64 / 1024.0).round() as u64),
                None,
            )),
            None => push(item(
                "gpu",
                "显卡",
                "warning",
                "未检测到 NVIDIA 显卡",
                None,
            )),
        },
        Err(_) => push(item(
            "gpu",
            "显卡",
            "warning",
            "无法读取显卡信息",
            None,
        )),
    }

    // 5. 端口
    let port = config_port(install_dir);
    if probe(port) {
        if probe_comfyui(port) {
            push(item(
                "port",
                "端口",
                "normal",
                format!("端口 {} · ComfyUI 服务运行中", port),
                None,
            ));
        } else {
            push(item(
                "port",
                "端口",
                "warning",
                format!("端口 {} 被其他程序占用", port),
                None,
            ));
        }
    } else {
        push(item(
            "port",
            "端口",
            "normal",
            format!("端口 {} 空闲", port),
            None,
        ));
    }

    // 6. 模型目录
    push(item(
        "models",
        "模型",
        if models_dir.exists() { "normal" } else { "warning" },
        if models_dir.exists() {
            "模型目录已就绪".to_string()
        } else {
            "模型目录不存在".to_string()
        },
        None,
    ));

    // 7. 工作流目录
    push(item(
        "workflows",
        "工作流",
        if workflows_dir.exists() { "normal" } else { "warning" },
        if workflows_dir.exists() {
            "工作流目录已就绪".to_string()
        } else {
            "工作流目录不存在".to_string()
        },
        None,
    ));

    // 8. 配置
    push(item(
        "config",
        "启动配置",
        if config_json.exists() { "normal" } else { "warning" },
        if config_json.exists() {
            "启动配置已写入".to_string()
        } else {
            "缺少启动配置".to_string()
        },
        None,
    ));
}

#[tauri::command]
pub async fn detect_environment(
    app: tauri::AppHandle,
    install_dir: String,
    install_mode: String,
) -> Result<EnvironmentReport, String> {
    let mut items: Vec<CheckItem> = Vec::new();
    {
        let mut push = |it: CheckItem| {
            let _ = app.emit("detect_progress", &it);
            items.push(it);
        };
        if install_mode == "docker" {
            detect_docker(&mut push, &install_dir);
        } else {
            detect_host(&mut push, &install_dir);
        }
    }

    let summary = ReportSummary {
        normal: items.iter().filter(|i| i.status == "normal").count(),
        warning: items.iter().filter(|i| i.status == "warning").count(),
        error: items.iter().filter(|i| i.status == "error").count(),
    };

    Ok(EnvironmentReport {
        install_dir,
        install_mode,
        items,
        summary,
    })
}

#[derive(Serialize, Clone)]
pub struct ComfyVersionInfo {
    pub current: String,
    pub latest: String,
    pub latest_date: String,
    pub outdated: bool,
    pub checked: bool,
}

fn git_head_sha(comfyui_dir: &PathBuf) -> Option<String> {
    let out = Command::new("git")
        .args(["-C", comfyui_dir.to_str()?, "rev-parse", "HEAD"])
        .silent()
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

fn github_latest_commit() -> Option<(String, String)> {
    let out = Command::new("curl.exe")
        .args([
            "-sS",
            "-m",
            "12",
            "https://api.github.com/repos/comfyanonymous/ComfyUI/commits/master",
        ])
        .silent()
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).ok()?;
    let sha = v.get("sha")?.as_str()?.to_string();
    let date = v
        .pointer("/commit/committer/date")
        .and_then(|d| d.as_str())
        .unwrap_or("")
        .to_string();
    Some((sha, date))
}

#[tauri::command]
pub fn check_comfyui_version(install_dir: String) -> Result<ComfyVersionInfo, String> {
    let comfyui_dir = PathBuf::from(&install_dir).join("ComfyUI");
    let current = git_head_sha(&comfyui_dir).unwrap_or_default();

    if current.is_empty() {
        return Ok(ComfyVersionInfo {
            current: "未知".to_string(),
            latest: String::new(),
            latest_date: String::new(),
            outdated: false,
            checked: false,
        });
    }

    let Some((latest, date)) = github_latest_commit() else {
        return Ok(ComfyVersionInfo {
            current: current.chars().take(7).collect(),
            latest: String::new(),
            latest_date: String::new(),
            outdated: false,
            checked: false,
        });
    };

    let cur_short: String = current.chars().take(7).collect();
    let latest_short: String = latest.chars().take(7).collect();
    let latest_date = if date.len() >= 10 {
        date[..10].to_string()
    } else {
        date
    };
    let outdated = cur_short != latest_short;

    Ok(ComfyVersionInfo {
        current: cur_short,
        latest: latest_short,
        latest_date,
        outdated,
        checked: true,
    })
}

#[tauri::command]
pub fn update_comfyui(install_dir: String) -> Result<String, String> {
    let comfyui_dir = PathBuf::from(&install_dir).join("ComfyUI");
    let out = Command::new("git")
        .args([
            "-C",
            comfyui_dir.to_str().ok_or("非法安装路径")?,
            "pull",
            "--ff-only",
        ])
        .silent()
        .output()
        .map_err(|e| e.to_string())?;
    let msg = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    let msg = msg.trim().to_string();
    if out.status.success() {
        Ok(msg)
    } else {
        Err(msg)
    }
}
