use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};

use super::pytorch::run_pytorch_step;
use super::{stream_command_output, SilentCommand};

pub async fn run_install_step(
    step: String,
    install_dir: String,
    python_exe: String,
    comfyui_dir: String,
    versions_config: serde_json::Value,
    gpu_info: serde_json::Value,
) -> Result<(), String> {
    let emit = move |tag: &str, msg: &str| {
        crate::events::log(tag, msg);
    };

    match step.as_str() {
        "venv" => run_venv_step(&step, &install_dir, &python_exe, emit.clone()).await,
        "pytorch" => {
            run_pytorch_step(&step, &install_dir, &versions_config, &gpu_info, emit.clone()).await
        }
        "deps" => run_deps_step(&step, &comfyui_dir, &install_dir, emit.clone()).await,
        "config" => {
            write_launcher(&install_dir, &python_exe, &comfyui_dir);
            write_preset_workflows(&comfyui_dir, &emit);
            emit(&step, "启动器和环境配置已写入");
            Ok(())
        }
        other => Err(format!("未知安装步骤：{}", other)),
    }
}

async fn run_venv_step<F>(
    tag: &str,
    install_dir: &str,
    python_exe: &str,
    emit: F,
) -> Result<(), String>
where
    F: Fn(&str, &str) + Send + Sync + Clone + 'static,
{
    emit(tag, "正在创建虚拟环境...");
    let venv_dir = PathBuf::from(install_dir).join("venv");
    if venv_dir.join("Scripts").join("python.exe").exists() {
        emit(tag, "✅ 虚拟环境已存在，跳过创建");
        return Ok(());
    }
    let out = Command::new(python_exe)
        .args(["-m", "venv", venv_dir.to_string_lossy().as_ref()])
        .silent()
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        emit(tag, &String::from_utf8_lossy(&out.stderr));
        return Err("虚拟环境创建失败".to_string());
    }
    emit(tag, &format!("pip 加速源写入 {}", venv_dir.display()));
    let pip_ini = venv_dir.join("pip.ini");
    std::fs::write(
        &pip_ini,
        "[global]\n\
index-url = https://pypi.tuna.tsinghua.edu.cn/simple\n\
trusted-host = pypi.tuna.tsinghua.edu.cn\n\
timeout = 120\n",
    )
    .map_err(|e| e.to_string())?;
    emit(tag, "虚拟环境创建完成");
    Ok(())
}

async fn run_deps_step<F>(
    tag: &str,
    comfyui_dir: &str,
    install_dir: &str,
    emit: F,
) -> Result<(), String>
where
    F: Fn(&str, &str) + Send + Sync + Clone + 'static,
{
    let venv_python = PathBuf::from(install_dir)
        .join("venv")
        .join("Scripts")
        .join("python.exe");
    if !venv_python.exists() {
        return Err("未找到虚拟环境 Python，请先完成 venv 步骤".to_string());
    }

    if !comfyui_dir.is_empty() {
        let probe = Command::new(&venv_python)
            .args([
                "-c",
                "import numpy, PIL, torch, aiohttp, transformers; print('deps-ok')",
            ])
            .current_dir(comfyui_dir)
            .silent()
            .output();
        if let Ok(o) = probe {
            if o.status.success() && String::from_utf8_lossy(&o.stdout).contains("deps-ok") {
                emit(tag, "✅ 核心依赖（numpy/Pillow/torch/aiohttp/transformers）已安装，跳过");
                return Ok(());
            }
        }
    }

    emit(tag, "正在安装 ComfyUI 依赖（使用配置加速源）...");
    emit(tag, "⏱ 预计耗时 2~10 分钟（约 200~500 个 Python 小包）");

    let mut cmd = Command::new(venv_python);
    cmd.args([
        "-m",
        "pip",
        "install",
        "-r",
        "requirements.txt",
        "--no-input",
        "--retries",
        "3",
        "--progress-bar",
        "off",
    ])
    .current_dir(comfyui_dir)
    .silent();

    let tag = tag.to_string();
    let tag_emit = tag.clone();
    let emit_owned = emit.clone();
    let emit_for_line: Arc<dyn Fn(&str, &str) + Send + Sync + 'static> =
        Arc::new(move |t, l| emit_owned(t, l));
    let emit_out = emit_for_line.clone();

    let last_line = Arc::new(Mutex::new(String::new()));
    let last_line_clone = last_line.clone();
    let tag_stream = tag.clone();
    let status = stream_command_output(&mut cmd, move |line| {
        if line.trim().is_empty() {
            return;
        }
        let mut guard = last_line_clone.lock().unwrap();
        if *guard == line {
            return;
        }
        *guard = line.to_string();
        drop(guard);
        emit_out(&tag_stream, line);
    })
    .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("ComfyUI 依赖安装失败，常见原因：网络中断 / 缺少 VC++ 运行库".to_string());
    }
    emit(&tag_emit, "ComfyUI 依赖安装完成");
    Ok(())
}

pub(crate) fn write_launcher(install_dir: &str, _python_exe: &str, comfyui_dir: &str) {
    let root = PathBuf::from(install_dir);
    let bat = root.join("启动 ComfyUI.bat");
    let venv_py = root.join("venv").join("Scripts").join("python.exe");
    let content = format!(
        "@echo off\r\n\
cd /d \"{}\"\r\n\
\"{}\" main.py --listen --port 8188\r\n\
pause\r\n",
        comfyui_dir,
        venv_py.display()
    );
    let _ = std::fs::write(&bat, content);

    let launcher_dir = root.join("launcher");
    let _ = std::fs::create_dir_all(&launcher_dir);
    let _ = std::fs::write(
        launcher_dir.join("启动 ComfyUI.bat"),
        format!(
            "@echo off\r\ncd /d \"{}\"\r\n\"{}\" main.py --listen --port 8188\r\npause\r\n",
            comfyui_dir,
            venv_py.display()
        ),
    );
}

fn write_preset_workflows<F>(comfyui_dir: &str, emit: &F)
where
    F: Fn(&str, &str),
{
    const IMG_WF: &str = include_str!("../../../../scripts/workflows/text-to-image.json");
    const VID_WF: &str = include_str!("../../../../scripts/workflows/text-to-video.json");

    let wf_dir = PathBuf::from(comfyui_dir)
        .join("user")
        .join("default")
        .join("workflows");
    if let Err(e) = std::fs::create_dir_all(&wf_dir) {
        emit("config", &format!("创建工作流目录失败: {}", e));
        return;
    }

    let img_name = "文生图-基础.json";
    let vid_name = "文生视频-Wan2.1-需16GB显存.json";
    if let Err(e) = std::fs::write(wf_dir.join(img_name), IMG_WF) {
        emit("config", &format!("写入文生图工作流失败: {}", e));
    } else {
        emit("config", "✅ 已预置工作流：文生图-基础");
    }
    if let Err(e) = std::fs::write(wf_dir.join(vid_name), VID_WF) {
        emit("config", &format!("写入文生视频工作流失败: {}", e));
    } else {
        emit("config", "✅ 已预置工作流：文生视频-Wan2.1（需 ≥16GB 显存）");
    }
}
