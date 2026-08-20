use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

use super::SilentCommand;

fn sanitize_segment(s: &str) -> Result<String, String> {
    let t = s.trim();
    if t.is_empty() || t.chars().any(|c| !(c.is_alphanumeric() || c == '-' || c == '_')) {
        return Err("非法目录名".to_string());
    }
    Ok(t.to_string())
}

fn sanitize_file_name(s: &str) -> Result<String, String> {
    let t = s.trim();
    if t.is_empty()
        || t.chars()
            .any(|c| matches!(c, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err("非法文件名".to_string());
    }
    Ok(t.to_string())
}

fn models_dir(install_dir: &str, category: &str) -> PathBuf {
    PathBuf::from(install_dir)
        .join("ComfyUI")
        .join("models")
        .join(category)
}

fn get_content_length(url: &str) -> Option<u64> {
    let out = Command::new("curl.exe")
        .args(["-sIL", url])
        .silent()
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut result = None;
    for line in text.lines() {
        if line.to_lowercase().starts_with("content-length:") {
            if let Some(v) = line
                .split(':')
                .nth(1)
                .and_then(|s| s.trim().parse::<u64>().ok())
            {
                result = Some(v);
            }
        }
    }
    result
}

#[tauri::command]
pub fn download_model(
    app: AppHandle,
    install_dir: String,
    category: String,
    file_name: String,
    url: String,
) -> Result<(), String> {
    let category = sanitize_segment(&category)?;
    let file_name = sanitize_file_name(&file_name)?;
    let url = url.trim().to_string();
    if url.is_empty() {
        return Err("下载地址为空".to_string());
    }

    let dir = models_dir(&install_dir, &category);
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    let dest = dir.join(&file_name);
    // 先下载到临时 .part 文件，成功后替换正式文件；
    // 这样中断时只会留下 .part，正式文件永远不会是半成品，也不会被扫描误判为“已存在”。
    let part = dir.join(format!("{}.part", &file_name));

    let file_name = file_name.clone();
    std::thread::spawn(move || {
        let total = get_content_length(&url).unwrap_or(0);
        let part_str = part.to_string_lossy().to_string();

        let mut cmd = Command::new("curl.exe");
        // -C - 针对 .part 断点续传
        cmd.args(["-L", "-C", "-", "-sS", "-o", &part_str, &url]);
        cmd.silent();

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit(
                    "model_download_done",
                    serde_json::json!({
                        "file_name": file_name.clone(),
                        "ok": false,
                        "error": format!("启动下载失败: {}", e),
                    }),
                );
                return;
            }
        };

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    let mut ok = status.success();
                    let mut error = String::new();
                    if ok {
                        if let Err(e) = std::fs::remove_file(&dest) {
                            if e.kind() != std::io::ErrorKind::NotFound {
                                ok = false;
                                error = format!("清理旧文件失败: {}", e);
                            }
                        }
                        if ok {
                            if let Err(e) = std::fs::rename(&part, &dest) {
                                ok = false;
                                error = format!("保存文件失败: {}", e);
                            }
                        }
                    } else {
                        error = format!("curl 退出码: {}", status.code().unwrap_or(-1));
                    }
                    let _ = app.emit(
                        "model_download_done",
                        serde_json::json!({
                            "file_name": file_name.clone(),
                            "ok": ok,
                            "error": error,
                        }),
                    );
                    break;
                }
                Ok(None) => {
                    let downloaded = std::fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
                    let _ = app.emit(
                        "model_download_progress",
                        serde_json::json!({
                            "file_name": file_name.clone(),
                            "downloaded": downloaded,
                            "total": total,
                        }),
                    );
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
                Err(e) => {
                    let _ = app.emit(
                        "model_download_done",
                        serde_json::json!({
                            "file_name": file_name.clone(),
                            "ok": false,
                            "error": format!("下载进程异常: {}", e),
                        }),
                    );
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn delete_model(
    install_dir: String,
    category: String,
    file_name: String,
) -> Result<(), String> {
    let file_name = sanitize_file_name(&file_name)?;
    let dir = if category.trim().is_empty() {
        PathBuf::from(&install_dir).join("ComfyUI").join("models")
    } else {
        let category = sanitize_segment(&category)?;
        models_dir(&install_dir, &category)
    };
    let path = dir.join(&file_name);
    if !path.exists() {
        return Err("模型文件不存在".to_string());
    }
    std::fs::remove_file(&path).map_err(|e| format!("删除失败: {}", e))
}
