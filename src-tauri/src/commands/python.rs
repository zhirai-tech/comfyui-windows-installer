use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::Emitter;
use super::SilentCommand;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PythonInfo {
    pub found: bool,
    pub executable: String,
    pub version: String,
    pub is_compatible: bool,
}

fn version_to_tuple(v: &str) -> (u32, u32, u32) {
    let clean = v.trim().split(|c: char| !c.is_ascii_digit() && c != '.')
        .next()
        .unwrap_or("0.0.0");
    let parts: Vec<u32> = clean
        .split('.')
        .map(|s| s.parse::<u32>().unwrap_or(0))
        .collect();
    (
        *parts.get(0).unwrap_or(&0),
        *parts.get(1).unwrap_or(&0),
        *parts.get(2).unwrap_or(&0),
    )
}

fn is_compatible(version: &str) -> bool {
    let (major, minor, _) = version_to_tuple(version);
    major == 3 && minor >= 10 && minor <= 12
}

/// 最终终极校验：直接跑 python -c "import sys; v=sys.version_info[:2]; print(f'{v[0]}.{v[1]}.{v[2]}' if False else f'{v[0]}.{v[1]}', sys.executable, sep='\n'); sys.exit(0 if 310 <= v[0]*100+v[1] <= 312 else 2)"
/// Store stub/假的/损坏的 python，跑这个脚本一定 exit!=0 或 stdout 不匹配，绝对不会误判
fn probe_true_python(cmd: &str, extra_args: &[&str]) -> Option<PythonInfo> {
    let script = "import sys\n\
v = sys.version_info[:3]\n\
ok = (v[0], v[1]) >= (3, 10) and (v[0], v[1]) <= (3, 12)\n\
print(f'{v[0]}.{v[1]}.{v[2]}')\n\
print(sys.executable)\n\
print(sys.version)\n\
sys.exit(0 if ok else 2)";
    let mut c = Command::new(cmd);
    for a in extra_args {
        c.arg(a);
    }
    c.args(["-c", script])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .silent();
    let out = match c.output() {
        Ok(o) => o,
        Err(_) => return None,
    };
    // 必须 exit code = 0 才算真 Python（直接把兼容判定交给 exit code，不解析版本字符串猜）
    let code = out.status.code().unwrap_or(-1);
    if code != 0 {
        return None;
    }
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let mut lines = stdout.lines();
    let ver = lines.next().map(|s| s.trim().to_string()).unwrap_or_default();
    let exe = lines.next().map(|s| s.trim().to_string()).unwrap_or_default();
    if ver.is_empty() || exe.is_empty() {
        return None;
    }
    let p = PathBuf::from(&exe);
    // 终极过滤：绝对禁止命中微软 Store 重解析点/假 python
    if exe.to_ascii_lowercase().contains("windowsapps") {
        return None;
    }
    if !p.exists() {
        return None;
    }
    Some(PythonInfo {
        found: true,
        executable: exe,
        version: ver.clone(),
        is_compatible: is_compatible(&ver),
    })
}

fn probe_python_version(exe: &std::path::PathBuf) -> Option<String> {
    // 这里也走真脚本校验，不是 --version 了（--version Store stub 也能 exit 0 骗到我们）
    probe_true_python(exe.to_string_lossy().as_ref(), &[]).map(|p| p.version)
}

#[allow(dead_code)]
fn probe_python_executable(c: &str) -> Option<String> {
    probe_true_python(c, &[]).map(|p| p.executable)
}

fn probe_python() -> Option<PythonInfo> {
    // 优先级：py launcher 指定版本 → py 默认 → python → python3 → py（含 WindowsApps 过滤）
    let launcher_candidates: [(&str, &[&str]); 3] = [
        ("py", &["-3.12"]),
        ("py", &["-3.11"]),
        ("py", &["-3.10"]),
    ];
    for (cmd, extra) in launcher_candidates.iter() {
        if let Some(p) = probe_true_python(cmd, extra) {
            return Some(p);
        }
    }
    let plain_candidates: [(&str, &[&str]); 3] = [
        ("python", &[]),
        ("python3", &[]),
        ("py", &[]),
    ];
    for (cmd, extra) in plain_candidates.iter() {
        if let Some(p) = probe_true_python(cmd, extra) {
            return Some(p);
        }
    }
    None
}

#[tauri::command]
pub async fn detect_python(app: tauri::AppHandle) -> Result<PythonInfo, String> {
    let emit = |msg: &str| {
        let _ = app.emit("install_log", format!("[python] {}", msg));
    };
    emit("正在检测系统 Python 环境...（优先 py launcher 3.12/3.11/3.10，后 python/python3）");

    let launcher_candidates: [(&str, &[&str]); 3] = [
        ("py -3.12", &[]),
        ("py -3.11", &[]),
        ("py -3.10", &[]),
    ];
    for (label, _) in launcher_candidates.iter() {
        let cmd = "py";
        let extra = match label as &str {
            "py -3.12" => &["-3.12"][..],
            "py -3.11" => &["-3.11"][..],
            _ => &["-3.10"][..],
        };
        match probe_true_python(cmd, extra) {
            Some(p) => {
                emit(&format!(
                    "命中 {:?} → Python {} ({}) 兼容={}",
                    label, p.version, p.executable, p.is_compatible
                ));
                return Ok(p);
            }
            None => {
                emit(&format!("未命中 {:?}（跳过）", label));
            }
        }
    }
    for c in ["python", "python3", "py"] {
        match probe_true_python(c, &[]) {
            Some(p) => {
                emit(&format!(
                    "命中 {:?} → Python {} ({}) 兼容={}",
                    c, p.version, p.executable, p.is_compatible
                ));
                return Ok(p);
            }
            None => {
                emit(&format!("未命中 {:?}（跳过，可能是 Store stub 或版本 <3.10/>3.12）", c));
            }
        }
    }
    emit("未检测到兼容 Python，下一步将自动下载便携版 Python 3.10");
    Ok(PythonInfo {
        found: false,
        executable: String::new(),
        version: String::new(),
        is_compatible: false,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PreparePythonResult {
    pub executable: String,
    pub version: String,
}

#[tauri::command]
pub async fn prepare_python(
    app: tauri::AppHandle,
    install_dir: String,
    versions_config: serde_json::Value,
) -> Result<PreparePythonResult, String> {
    let emit = |msg: &str| {
        let _ = app.emit("install_log", format!("[python] {}", msg));
    };

    if let Some(p) = probe_python() {
        if p.is_compatible {
            emit("✅ 已存在兼容 Python，跳过下载");
            return Ok(PreparePythonResult {
                executable: p.executable,
                version: p.version,
            });
        }
    }

    let embedded_exe = PathBuf::from(&install_dir).join("python_embedded").join("python.exe");
    if embedded_exe.exists() {
        let v = probe_python_version(&embedded_exe).unwrap_or_else(|| "3.10.x".to_string());
        emit(&format!("✅ 已存在便携版 Python {}，跳过下载", v));
        return Ok(PreparePythonResult {
            executable: embedded_exe.to_string_lossy().to_string(),
            version: v,
        });
    }

    emit(&format!("Will download portable Python into {}", install_dir));

    let script = include_str!("../../../scripts/install-python.ps1");
    let script_path = PathBuf::from(&install_dir).join("_installer").join("install-python.ps1");
    std::fs::create_dir_all(script_path.parent().unwrap()).map_err(|e| e.to_string())?;
    // 强制 UTF-8 BOM 写盘（PS5.1 读 .ps1 无 BOM = CP936，会炸中文/引号）
    super::write_utf8_bom_script(&script_path, script.as_bytes()).map_err(|e| e.to_string())?;

    let ver = versions_config
        .pointer("/python/version")
        .and_then(|v| v.as_str())
        .unwrap_or("3.10.11")
        .to_string();
    let mirror = versions_config
        .pointer("/python/mirror")
        .and_then(|v| v.as_str())
        .unwrap_or("https://mirrors.huaweicloud.com/python")
        .to_string();

    // 走原生 -File -Key Value 参数链，任何值不用进字符串拼接（杜绝 2 次编码 + 引号被 GBK 吃掉）
    let args = &[
        ("-InstallDir", install_dir.as_str()),
        ("-PythonVersion", ver.as_str()),
        ("-Mirror", mirror.as_str()),
    ];
    let mut cmd = super::command_file_ps1(&script_path.to_string_lossy(), args);
    cmd.stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    let out = cmd.output().map_err(|e| e.to_string())?;
    let combined = super::combined_output(&out);
    for l in combined.lines() {
        emit(l);
    }
    if !out.status.success() {
        return Err("Python portable install failed, check logs".to_string());
    }

    let exe_path = PathBuf::from(&install_dir)
        .join("python_embedded")
        .join("python.exe");
    Ok(PreparePythonResult {
        executable: exe_path.to_string_lossy().to_string(),
        version: ver,
    })
}
