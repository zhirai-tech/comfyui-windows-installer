use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadResult {
    pub comfyui_dir: String,
}

pub async fn download_comfyui(
    install_dir: String,
    versions_config: serde_json::Value,
) -> Result<DownloadResult, String> {
    let emit = |msg: &str| {
        crate::events::log("comfyui", msg);
    };

    let target = PathBuf::from(&install_dir).join("ComfyUI");
    let main_py = target.join("main.py");
    if main_py.exists() {
        emit("Detected ComfyUI (main.py exists), skipping download");
        return Ok(DownloadResult {
            comfyui_dir: target.to_string_lossy().to_string(),
        });
    }

    emit("Starting ComfyUI download...");

    let script = include_str!("../../../scripts/install-comfyui.ps1");
    let staging = PathBuf::from(&install_dir).join("_installer");
    std::fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let script_path = staging.join("install-comfyui.ps1");
    // 强制 UTF-8 BOM 写盘（PS5.1 中文环境默认 CP936 解无 BOM 文件，会炸引号）
    super::write_utf8_bom_script(&script_path, script.as_bytes()).map_err(|e| e.to_string())?;

    let primary = versions_config
        .pointer("/comfyui/repository")
        .and_then(|v| v.as_str())
        .unwrap_or("https://gitee.com/mirrors/ComfyUI.git")
        .to_string();
    let fallback = versions_config
        .pointer("/comfyui/repository_fallback")
        .and_then(|v| v.as_str())
        .unwrap_or("https://github.com/comfyanonymous/ComfyUI.git")
        .to_string();
    let zip_mirror = versions_config
        .pointer("/comfyui/download")
        .and_then(|v| v.as_str())
        .unwrap_or("https://gitee.com/mirrors/ComfyUI/repository/archive/master.zip")
        .to_string();
    let zip_fallback = versions_config
        .pointer("/comfyui/download_fallback")
        .and_then(|v| v.as_str())
        .unwrap_or("https://github.com/comfyanonymous/ComfyUI/archive/refs/heads/master.zip")
        .to_string();
    let target_ref = versions_config
        .pointer("/comfyui/selected_ref")
        .and_then(|v| v.as_str())
        .or_else(|| versions_config.pointer("/comfyui/target_branch").and_then(|v| v.as_str()))
        .unwrap_or("master")
        .to_string();

    emit(&format!("Primary repo: {}", primary));
    emit(&format!("Target ref: {}", target_ref));

    // 走原生 -File 参数链，不做任何字符串拼接，杜绝 GBK 拆字节吃引号的老问题
    let args = &[
        ("-InstallDir", install_dir.as_str()),
        ("-RepoPrimary", primary.as_str()),
        ("-RepoFallback", fallback.as_str()),
        ("-ZipMirror", zip_mirror.as_str()),
        ("-ZipFallback", zip_fallback.as_str()),
        ("-TargetRef", target_ref.as_str()),
    ];
    let mut cmd = super::command_file_ps1(&script_path.to_string_lossy(), args);
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let out = cmd.output().map_err(|e| e.to_string())?;
    let combined = super::combined_output(&out);
    for l in combined.lines() {
        emit(l);
    }
    if !out.status.success() {
        return Err(
            "ComfyUI download failed, check logs (network or retry)"
                .to_string(),
        );
    }

    let target = PathBuf::from(&install_dir).join("ComfyUI");
    Ok(DownloadResult {
        comfyui_dir: target.to_string_lossy().to_string(),
    })
}
