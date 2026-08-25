use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use super::SilentCommand;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DockerInfo {
    pub installed: bool,
    pub running: bool,
    pub version: String,
    pub compose_version: String,
    pub wsl2_enabled: bool,
    pub missing_requirements: Vec<String>,
}

pub async fn check_docker() -> DockerInfo {
    let emit = |m: &str| {
        crate::events::log("docker", m);
    };
    emit("检查 Docker 环境...");

    let mut info = DockerInfo {
        installed: false,
        running: false,
        version: "-".into(),
        compose_version: "-".into(),
        wsl2_enabled: false,
        missing_requirements: Vec::new(),
    };

    let ver = Command::new("docker").args(["--version"]).silent().output();
    match ver {
        Ok(o) if o.status.success() => {
            info.installed = true;
            info.version = String::from_utf8_lossy(&o.stdout)
                .trim()
                .trim_start_matches("Docker version ")
                .split(',')
                .next()
                .unwrap_or("-")
                .to_string();
            emit(&format!("Docker 已安装: {}", info.version));
        }
        _ => {
            info.missing_requirements
                .push("未安装 Docker Desktop".into());
            emit("未检测到 Docker，请先安装 Docker Desktop + WSL2");
        }
    }

    if info.installed {
        let comp = Command::new("docker")
            .args(["compose", "version"])
            .silent()
            .output();
        if let Ok(o) = comp {
            info.compose_version = String::from_utf8_lossy(&o.stdout).trim().to_string();
        }
        let info_out = Command::new("docker").args(["info"]).silent().output();
        match info_out {
            Ok(o) if o.status.success() => {
                info.running = true;
                let raw = String::from_utf8_lossy(&o.stdout);
                if raw.contains("wsl2") || raw.contains("WSL2") {
                    info.wsl2_enabled = true;
                }
                emit("Docker daemon 运行中");
            }
            _ => {
                info.running = false;
                info.missing_requirements
                    .push("Docker Desktop 未启动，请手动启动它".into());
                emit("Docker daemon 未启动，请先启动 Docker Desktop");
            }
        }
    }

    let wsl = Command::new("wsl.exe").args(["--status"]).silent().output();
    if let Ok(o) = wsl {
        let raw = String::from_utf8_lossy(&o.stdout);
        if raw.contains("2") || raw.contains("默认版本") {
            info.wsl2_enabled = true;
        }
    } else {
        info.missing_requirements
            .push("未启用 WSL2（请先启用虚拟机平台 + WSL）".into());
    }

    info
}

#[derive(Serialize, Deserialize)]
pub struct DockerInstallResult {
    pub compose_path: String,
    pub data_dir: String,
}

pub async fn install_docker_mode(
    install_dir: String,
    versions_config: serde_json::Value,
    step_phase: String,
) -> Result<DockerInstallResult, String> {
    let emit = |m: &str| {
        crate::events::log("docker", m);
    };

    let root = PathBuf::from(&install_dir);
    let data_dir = root.join("data");
    let models_dir = data_dir.join("models");
    let output_dir = data_dir.join("output");
    let _ = std::fs::create_dir_all(&models_dir);
    let _ = std::fs::create_dir_all(&output_dir);
    let compose_path = root.join("docker-compose.yml");

    match step_phase.as_str() {
        "prepare" => {
            emit(&format!(
                "准备目录: data/models @ {}",
                models_dir.display()
            ));
            Ok(DockerInstallResult {
                compose_path: compose_path.to_string_lossy().to_string(),
                data_dir: data_dir.to_string_lossy().to_string(),
            })
        }
        "write_compose" => {
            if compose_path.exists() {
                emit(&format!("✅ docker-compose.yml 已存在（{}），跳过重写", compose_path.display()));
                return Ok(DockerInstallResult {
                    compose_path: compose_path.to_string_lossy().to_string(),
                    data_dir: data_dir.to_string_lossy().to_string(),
                });
            }

            let image = versions_config
                .pointer("/docker/image")
                .and_then(|v| v.as_str())
                .unwrap_or("ai-dock/comfyui:latest-cuda12.1.0");
            let webui_ref = versions_config
                .pointer("/docker/webui_ref")
                .and_then(|v| v.as_str())
                .or_else(|| versions_config.pointer("/comfyui/selected_ref").and_then(|v| v.as_str()))
                .or_else(|| versions_config.pointer("/comfyui/target_branch").and_then(|v| v.as_str()))
                .unwrap_or("main");
            let port = versions_config
                .pointer("/docker/port")
                .and_then(|v| v.as_u64())
                .unwrap_or(8188);

            let yml = format!(
                "services:\n\
                 \x20\x20comfyui:\n\
                 \x20\x20\x20\x20image: {image}\n\
                 \x20\x20\x20\x20container_name: comfyui-hub\n\
                 \x20\x20\x20\x20restart: unless-stopped\n\
                 \x20\x20\x20\x20ports:\n\
                 \x20\x20\x20\x20\x20\x20- \"{port}:{port}\"\n\
                 \x20\x20\x20\x20environment:\n\
                 \x20\x20\x20\x20\x20\x20- NVIDIA_VISIBLE_DEVICES=all\n\
                 \x20\x20\x20\x20\x20\x20- WEBUI_REF={webui_ref}\n\
                 \x20\x20\x20\x20\x20\x20- PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple\n\
                 \x20\x20\x20\x20volumes:\n\
                 \x20\x20\x20\x20\x20\x20- ./data/models:/opt/ComfyUI/models\n\
                 \x20\x20\x20\x20\x20\x20- ./data/output:/opt/ComfyUI/output\n\
                 \x20\x20\x20\x20deploy:\n\
                 \x20\x20\x20\x20\x20\x20resources:\n\
                 \x20\x20\x20\x20\x20\x20\x20\x20reservations:\n\
                 \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20devices:\n\
                 \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20- driver: nvidia\n\
                 \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20count: all\n\
                 \x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20capabilities: [gpu]\n",
                image = image,
                webui_ref = webui_ref,
                port = port
            );
            std::fs::write(&compose_path, yml).map_err(|e| e.to_string())?;
            emit(&format!("已写入 {}", compose_path.display()));

            let run_bat = root.join("启动 ComfyUI.bat");
            let stop_bat = root.join("停止 ComfyUI.bat");
            std::fs::write(
                &run_bat,
                format!(
                    "@echo off\r\ncd /d \"{}\"\r\ndocker compose up -d\r\necho ComfyUI 已在后台启动，访问 http://127.0.0.1:{}\r\npause\r\n",
                    root.display(),
                    port
                ),
            )
            .ok();
            std::fs::write(
                &stop_bat,
                format!(
                    "@echo off\r\ncd /d \"{}\"\r\ndocker compose down\r\necho ComfyUI 已停止\r\npause\r\n",
                    root.display()
                ),
            )
            .ok();

            emit("已生成 docker-compose.yml + 启动/停止 bat");

            Ok(DockerInstallResult {
                compose_path: compose_path.to_string_lossy().to_string(),
                data_dir: data_dir.to_string_lossy().to_string(),
            })
        }
        "pull" => {
            let probe = Command::new("docker")
                .args([
                    "compose",
                    "-f",
                    compose_path.to_string_lossy().as_ref(),
                    "images",
                ])
                .current_dir(&root)
                .silent()
                .output();
            if let Ok(o) = probe {
                let raw = format!(
                    "{}{}",
                    String::from_utf8_lossy(&o.stdout),
                    String::from_utf8_lossy(&o.stderr)
                );
                let has_comfy = raw
                    .lines()
                    .filter(|l| l.contains("comfyui") || l.contains("ai-dock"))
                    .count();
                if has_comfy >= 1 {
                    emit("✅ ComfyUI 镜像已存在，跳过 pull");
                    return Ok(DockerInstallResult {
                        compose_path: compose_path.to_string_lossy().to_string(),
                        data_dir: data_dir.to_string_lossy().to_string(),
                    });
                }
            }
            emit("拉取镜像（首次会比较慢）...");
            let out = Command::new("docker")
                .args(["compose", "-f", compose_path.to_string_lossy().as_ref(), "pull"])
                .current_dir(&root)
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
                return Err("镜像拉取失败，请检查 Docker 启动状态或镜像名".into());
            }
            Ok(DockerInstallResult {
                compose_path: compose_path.to_string_lossy().to_string(),
                data_dir: data_dir.to_string_lossy().to_string(),
            })
        }
        "compose_up" => {
            let probe = Command::new("docker")
                .args([
                    "compose",
                    "-f",
                    compose_path.to_string_lossy().as_ref(),
                    "ps",
                    "--format",
                    "{{.Status}}",
                ])
                .current_dir(&root)
                .silent()
                .output();
            if let Ok(o) = probe {
                let raw = String::from_utf8_lossy(&o.stdout);
                let up = raw.lines().any(|l| l.starts_with("Up"));
                if up {
                    emit("✅ ComfyUI 容器已处于运行状态，跳过 compose up");
                    return Ok(DockerInstallResult {
                        compose_path: compose_path.to_string_lossy().to_string(),
                        data_dir: data_dir.to_string_lossy().to_string(),
                    });
                }
            }
            emit("启动容器（docker compose up -d）...");
            let out = Command::new("docker")
                .args(["compose", "-f", compose_path.to_string_lossy().as_ref(), "up", "-d"])
                .current_dir(&root)
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
                return Err("容器启动失败，请检查 Docker GPU 直通与 WSL2".into());
            }
            emit("✅ ComfyUI 容器已在后台启动，约 30 秒内服务会就绪");
            Ok(DockerInstallResult {
                compose_path: compose_path.to_string_lossy().to_string(),
                data_dir: data_dir.to_string_lossy().to_string(),
            })
        }
        _ => Err(format!("未知 step_phase: {}", step_phase)),
    }
}
