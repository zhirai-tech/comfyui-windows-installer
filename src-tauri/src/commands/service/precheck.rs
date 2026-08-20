use std::path::PathBuf;
use std::process::{Command, Stdio};

use super::{debug_report, SilentCommand};

pub(crate) fn run_torch_precheck<F>(
    venv_python: &PathBuf,
    comfyui_dir: &PathBuf,
    emit: F,
) -> Result<(), String>
where
    F: Fn(&str) + Clone,
{
    // 先跑一次 import torch 预校验（新版 ComfyUI 包结构改了，不硬卡 comfy/__init__.py，失败不拦用户，只写 WARN）
    let verify_code = r#"
import sys
try:
    import torch
    print(f"[OK] torch {torch.__version__} cuda={torch.cuda.is_available()}")
    if not hasattr(torch.library, "custom_op"):
        print(f"[FAIL] torch {torch.__version__} missing torch.library.custom_op; please upgrade to torch 2.9.1+cu130 or newer")
        sys.exit(3)
except Exception as e:
    print(f"[FAIL] import torch: {type(e).__name__}: {e}")
    sys.exit(2)
try:
    import os
    comfy_root = r"__COMFY_DIR__"
    sys.path.insert(0, comfy_root)
    init_py = os.path.join(comfy_root, "comfy", "__init__.py")
    if os.path.exists(init_py):
        import importlib.util
        spec = importlib.util.spec_from_file_location("comfy_precheck", init_py)
        if spec is not None and getattr(spec, "loader", None) is not None:
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            print("[OK] comfy package (old layout) importable")
        else:
            print("[WARN] cannot load comfy/__init__.py, will trust main.py to handle")
    else:
        folder_paths = os.path.join(comfy_root, "folder_paths.py")
        main_py = os.path.join(comfy_root, "main.py")
        if os.path.exists(folder_paths) and os.path.exists(main_py):
            print("[OK] comfy new layout detected: main.py + folder_paths.py exist, skipping old comfy precheck")
        else:
            print(f"[WARN] folder_paths.py exists={os.path.exists(folder_paths)} main.py exists={os.path.exists(main_py)}")
except Exception as e:
    print(f"[WARN] import comfy layout check: {type(e).__name__}: {e}")
"#
    .replace("__COMFY_DIR__", comfyui_dir.to_string_lossy().as_ref());

    match Command::new(venv_python)
        .args(["-c", &verify_code])
        .current_dir(comfyui_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .silent()
        .output()
    {
        Ok(o) => {
            let s = format!(
                "{}{}",
                String::from_utf8_lossy(&o.stdout),
                String::from_utf8_lossy(&o.stderr)
            );
            // #region debug-point B:precheck-result
            debug_report("B", "service.rs:start_service:precheck", "precheck finished", serde_json::json!({
                "success": o.status.success(),
                "exitCode": o.status.code(),
                "output": s,
            }));
            // #endregion
            for l in s.lines() {
                emit(&format!("预校验: {}", l));
            }
            // 只硬卡 torch 相关失败，comfy 新布局 WARN 不拦
            if !o.status.success() {
                let all_lines: Vec<&str> = s.lines().collect();
                let start = if all_lines.len() > 24 { all_lines.len() - 24 } else { 0 };
                let tail: Vec<&str> = all_lines[start..].to_vec();
                return Err(format!(
                    "启动前置校验失败（exit {:?}）。\n完整输出：\n{}",
                    o.status.code(),
                    tail.join("\n")
                ));
            }
        }
        Err(e) => {
            emit(&format!("预校验 spawn 失败: {}（继续尝试启动）", e));
        }
    }
    Ok(())
}
