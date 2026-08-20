use serde::Serialize;
use std::path::PathBuf;
use tauri::Emitter;

use super::diagnostics::{detect_docker, detect_host, probe_torch, CheckItem};
use super::installer::config::InstallConfig;
use super::installer::steps::write_launcher;

#[derive(Serialize, Clone)]
pub struct RepairStep {
    pub index: usize,
    pub total: usize,
    pub key: String,
    pub label: String,
    pub status: String, // running | done | failed | skipped
    pub message: String,
}

#[derive(Serialize, Clone)]
pub struct RepairReport {
    pub steps: Vec<RepairStep>,
    pub fixed: usize,
    pub failed: usize,
}

fn emit_step(app: &tauri::AppHandle, step: &RepairStep) {
    let _ = app.emit("repair_progress", step);
}

fn now_marker() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("utc_{}", d as i64)
}

fn create_dirs(install_dir: &str) -> (String, bool) {
    let root = PathBuf::from(install_dir);
    let mut ok = true;
    for d in ["launcher", "results"] {
        if std::fs::create_dir_all(root.join(d)).is_err() {
            ok = false;
        }
    }
    let comfyui = root.join("ComfyUI");
    if comfyui.exists() {
        let models = comfyui.join("models");
        for sub in [
            "checkpoints",
            "loras",
            "vae",
            "controlnet",
            "upscale_models",
            "embeddings",
            "clip",
            "clip_vision",
            "unet",
            "diffusion_models",
            "text_encoders",
            "hypernetworks",
        ] {
            if std::fs::create_dir_all(models.join(sub)).is_err() {
                ok = false;
            }
        }
        if std::fs::create_dir_all(comfyui.join("custom_nodes")).is_err() {
            ok = false;
        }
        if std::fs::create_dir_all(comfyui.join("user").join("default").join("workflows")).is_err() {
            ok = false;
        }
        for d in ["input", "output", "temp"] {
            if std::fs::create_dir_all(comfyui.join(d)).is_err() {
                ok = false;
            }
        }
    }
    if ok {
        ("必要目录已就绪".to_string(), true)
    } else {
        ("部分目录创建失败".to_string(), false)
    }
}

fn repair_deps(install_dir: &str) -> (String, bool) {
    let comfyui_dir = PathBuf::from(install_dir).join("ComfyUI");
    let venv_python = PathBuf::from(install_dir)
        .join("venv")
        .join("Scripts")
        .join("python.exe");

    if !venv_python.exists() {
        return (
            "未找到虚拟环境 Python，无法验证依赖（需重新安装）".to_string(),
            false,
        );
    }

    match probe_torch(&venv_python, &comfyui_dir) {
        Some((version, cuda_ok)) => {
            let accel = if cuda_ok { "CUDA" } else { "CPU" };
            (format!("PyTorch {} 已就绪（{} 模式）", version, accel), true)
        }
        None => {
            let msg = if comfyui_dir.join("main.py").exists() {
                "PyTorch 未安装或无法导入，ComfyUI 将无法启动（需重新安装依赖）"
            } else {
                "ComfyUI 主程序缺失，跳过依赖检查"
            };
            (msg.to_string(), false)
        }
    }
}

fn repair_config(install_dir: &str) -> (String, bool) {
    let cfg = PathBuf::from(install_dir).join("launcher").join("config.json");
    if cfg.exists() {
        return ("启动配置已存在，无需修复".to_string(), true);
    }
    let comfyui_dir = PathBuf::from(install_dir).join("ComfyUI");
    let venv_python = PathBuf::from(install_dir)
        .join("venv")
        .join("Scripts")
        .join("python.exe");
    if !comfyui_dir.join("main.py").exists() {
        return (
            "ComfyUI 主程序缺失，无法自动生成配置（需重新安装）".to_string(),
            false,
        );
    }
    let config = InstallConfig {
        install_dir: install_dir.to_string(),
        python_exe: venv_python.to_string_lossy().to_string(),
        comfyui_dir: comfyui_dir.to_string_lossy().to_string(),
        venv_python: venv_python.to_string_lossy().to_string(),
        install_mode: "host".to_string(),
        gpu_name: "-".to_string(),
        vram_gb: 0,
        installed_at: now_marker(),
        port: 8188,
        launch_args: String::new(),
    };
    if let Some(parent) = cfg.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let write_result = serde_json::to_string_pretty(&config)
        .map_err(|e| e.to_string())
        .and_then(|d| std::fs::write(&cfg, d).map_err(|e| e.to_string()));
    match write_result {
        Ok(_) => ("启动配置已写入".to_string(), true),
        Err(e) => (format!("启动配置写入失败: {}", e), false),
    }
}

fn repair_launcher(install_dir: &str) -> (String, bool) {
    let bat = PathBuf::from(install_dir).join("启动 ComfyUI.bat");
    if bat.exists() {
        return ("启动脚本已存在，无需修复".to_string(), true);
    }
    let comfyui_dir = PathBuf::from(install_dir).join("ComfyUI");
    if !comfyui_dir.join("main.py").exists() {
        return (
            "ComfyUI 主程序缺失，无法自动生成启动脚本（需重新安装）".to_string(),
            false,
        );
    }
    write_launcher(install_dir, "", &comfyui_dir.to_string_lossy());
    (format!("启动脚本已写入 {}", bat.display()), true)
}

fn verify(install_dir: &str, install_mode: &str) -> String {
    let mut items: Vec<CheckItem> = Vec::new();
    let mut push = |it: CheckItem| items.push(it);
    if install_mode == "docker" {
        detect_docker(&mut push, install_dir);
    } else {
        detect_host(&mut push, install_dir);
    }
    let errors = items.iter().filter(|i| i.status == "error").count();
    let warnings = items.iter().filter(|i| i.status == "warning").count();
    if errors == 0 {
        format!("验证通过：错误 0，警告 {}", warnings)
    } else {
        format!(
            "仍有 {} 项错误无法自动修复（需手动处理或重新安装），警告 {}",
            errors, warnings
        )
    }
}

fn push_step(
    app: &tauri::AppHandle,
    steps: &mut Vec<RepairStep>,
    index: usize,
    total: usize,
    key: &str,
    label: &str,
    run: impl FnOnce() -> (String, bool),
) {
    let mut step = RepairStep {
        index,
        total,
        key: key.to_string(),
        label: label.to_string(),
        status: "running".to_string(),
        message: "正在处理...".to_string(),
    };
    emit_step(app, &step);
    let (msg, ok) = run();
    step.status = if ok { "done" } else { "failed" }.to_string();
    step.message = msg;
    emit_step(app, &step);
    steps.push(step);
}

#[tauri::command]
pub async fn repair_environment(
    app: tauri::AppHandle,
    install_dir: String,
    install_mode: String,
) -> Result<RepairReport, String> {
    let mut steps: Vec<RepairStep> = Vec::new();

    if install_mode == "docker" {
        let total = 3;
        push_step(&app, &mut steps, 1, total, "dirs", "创建数据目录", || {
            let root = PathBuf::from(&install_dir);
            let mut ok = true;
            for d in ["launcher", "data/models", "data/user/default/workflows"] {
                if std::fs::create_dir_all(root.join(d)).is_err() {
                    ok = false;
                }
            }
            if ok {
                ("数据目录已就绪".to_string(), true)
            } else {
                ("部分目录创建失败".to_string(), false)
            }
        });
        push_step(&app, &mut steps, 2, total, "config", "修复启动配置", || {
            repair_config(&install_dir)
        });
        push_step(&app, &mut steps, 3, total, "verify", "重新检测验证", || {
            (verify(&install_dir, "docker"), true)
        });
    } else {
        let total = 5;
        push_step(&app, &mut steps, 1, total, "dirs", "创建必要目录", || {
            create_dirs(&install_dir)
        });
        push_step(&app, &mut steps, 2, total, "config", "修复启动配置", || {
            repair_config(&install_dir)
        });
        push_step(&app, &mut steps, 3, total, "launcher", "修复启动脚本", || {
            repair_launcher(&install_dir)
        });
        push_step(&app, &mut steps, 4, total, "deps", "检查运行依赖", || {
            repair_deps(&install_dir)
        });
        push_step(&app, &mut steps, 5, total, "verify", "重新检测验证", || {
            (verify(&install_dir, "host"), true)
        });
    }

    let fixed = steps
        .iter()
        .filter(|s| s.key != "verify" && s.status == "done")
        .count();
    let failed = steps.iter().filter(|s| s.status == "failed").count();

    Ok(RepairReport {
        steps,
        fixed,
        failed,
    })
}
