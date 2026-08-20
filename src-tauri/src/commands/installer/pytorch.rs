use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};

use super::{command_file_ps1, stream_command_output, write_utf8_bom_script, SilentCommand};

pub(crate) async fn run_pytorch_step<F>(
    tag: &str,
    install_dir: &str,
    versions_config: &serde_json::Value,
    gpu_info: &serde_json::Value,
    emit: F,
) -> Result<(), String>
where
    F: Fn(&str, &str) + Send + Sync + Clone + 'static,
{
    let pt_version = versions_config
        .pointer("/pytorch/version")
        .and_then(|v| v.as_str())
        .unwrap_or("2.9.1");
    let venv_python = PathBuf::from(install_dir)
        .join("venv")
        .join("Scripts")
        .join("python.exe");
    if venv_python.exists() {
        let test = Command::new(&venv_python)
            .args([
                "-c",
                "import json, torch; print(json.dumps({'version': torch.__version__, 'has_custom_op': hasattr(torch.library, 'custom_op')}))",
            ])
            .silent()
            .output();
        if let Ok(o) = test {
            if o.status.success() {
                let owned = String::from_utf8_lossy(&o.stdout).to_string();
                let meta = owned
                    .lines()
                    .find_map(|line| serde_json::from_str::<serde_json::Value>(line).ok());
                if let Some(meta) = meta {
                    let ver = meta
                        .get("version")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    let has_custom_op = meta
                        .get("has_custom_op")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    if version_at_least(&ver, pt_version) && has_custom_op {
                        emit(tag, &format!("✅ PyTorch {} 已安装且兼容，跳过", ver));
                        return Ok(());
                    }
                    emit(
                        tag,
                        &format!(
                            "检测到旧版/不兼容 PyTorch {}（custom_op={}），将升级到 {}",
                            if ver.is_empty() { "unknown" } else { &ver },
                            has_custom_op,
                            pt_version
                        ),
                    );
                }
            }
        }
    }

    emit(tag, "正在安装 PyTorch（根据显卡匹配版本，耐心等待）...");
    emit(tag, "⏱ 预计耗时 5~30 分钟（torch/torchvision/torchaudio 合计约 2.3GB，下载慢属正常）");

    // 写 PyTorch ps1 脚本 + 强制 UTF-8 BOM（PS5.1 无 BOM=CP936，会炸中文引号）
    let script = include_str!("../../../../scripts/install-pytorch.ps1");
    let staging = PathBuf::from(install_dir).join("_installer");
    std::fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let script_path = staging.join("install-pytorch.ps1");
    write_utf8_bom_script(&script_path, script.as_bytes()).map_err(|e| e.to_string())?;

    let has_nvidia = gpu_info
        .pointer("/has_nvidia")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let _vram_gb = gpu_info
        .pointer("/vram_gb")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let cuda_ver = if has_nvidia {
        versions_config
            .pointer("/pytorch/cuda")
            .and_then(|v| v.as_str())
            .unwrap_or("cu130")
    } else {
        "cpu"
    };

    let index_url = versions_config
        .pointer(format!("/pytorch/mirrors/{}", cuda_ver).as_str())
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| {
            if cuda_ver == "cpu" {
                "https://download.pytorch.org/whl/cpu"
            } else {
                "https://download.pytorch.org/whl/cu130"
            }
        });

    let log = Arc::new(Mutex::new(Vec::<String>::new()));

    // 走原生 -File -Key Value，不把任何参数进 Command 字符串，杜绝转码/拆字节老坑
    let args = &[
        ("-InstallDir", install_dir),
        ("-CudaVersion", cuda_ver),
        ("-PyTorchVersion", pt_version),
        ("-IndexUrl", index_url),
        ("-VramGB", &_vram_gb.to_string()),
    ];
    let mut cmd = command_file_ps1(&script_path.to_string_lossy(), args);

    // 实时流式输出（不用 wait_with_output 等进程退出才 dump）
    let tag = tag.to_string();
    let tag_emit = tag.clone();
    let emit_owned = emit.clone();
    let emit_for_line: Arc<dyn Fn(&str, &str) + Send + Sync + 'static> =
        Arc::new(move |t, l| emit_owned(t, l));
    let emit_out = emit_for_line.clone();
    let last_line = Arc::new(Mutex::new(String::new()));
    let last_line_clone = last_line.clone();
    let log_arc = log.clone();
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
        log_arc.lock().unwrap().push(line.to_string());
        emit_out(&tag_stream, line);
    })
    .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err("PyTorch 安装失败，请展开上方日志查看详细错误".to_string());
    }

    emit(&tag_emit, "PyTorch 安装完成");
    Ok(())
}

fn parse_pkg_version_parts(raw: &str) -> Vec<u32> {
    raw.trim()
        .split('+')
        .next()
        .unwrap_or("")
        .split('.')
        .filter_map(|part| part.parse::<u32>().ok())
        .collect()
}

fn version_at_least(actual: &str, required: &str) -> bool {
    let actual_parts = parse_pkg_version_parts(actual);
    let required_parts = parse_pkg_version_parts(required);
    let max_len = actual_parts.len().max(required_parts.len());
    for i in 0..max_len {
        let a = *actual_parts.get(i).unwrap_or(&0);
        let b = *required_parts.get(i).unwrap_or(&0);
        if a > b {
            return true;
        }
        if a < b {
            return false;
        }
    }
    true
}
