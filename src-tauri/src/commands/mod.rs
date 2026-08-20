pub mod system;
pub mod gpu;
pub mod python;
pub mod comfyui;
pub mod installer;
pub mod docker;
pub mod service;
pub mod diagnostics;
pub mod repair;
pub mod resources;
pub mod models;

use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

/// Windows CREATE_NO_WINDOW 标志：禁止子进程弹出控制台黑框（CMD 闪屏）
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub trait SilentCommand {
    /// 给命令附加 CREATE_NO_WINDOW（仅 Windows 生效，其他平台空实现）
    fn silent(&mut self) -> &mut Self;
}

impl SilentCommand for Command {
    #[cfg(windows)]
    fn silent(&mut self) -> &mut Self {
        use std::os::windows::process::CommandExt;
        self.creation_flags(CREATE_NO_WINDOW)
    }
    #[cfg(not(windows))]
    fn silent(&mut self) -> &mut Self {
        self
    }
}

/// 合并 stdout + stderr 成一个 String（所有子进程都要走这个，避免乱码 / 丢错）
pub fn combined_output(out: &std::process::Output) -> String {
    let s = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    s.trim().to_string()
}

/// 写 ps1 脚本到磁盘，强制 UTF-8 BOM 前缀（EF BB BF）。
/// PowerShell 5.1 在 Windows 读 .ps1 文件时，如果没 BOM 会默认按 CP936（中文GBK）解码，
/// 导致转码错误吃 `"` 右引号、整个语法解析崩溃。这里加 BOM 就能强制 PS5.1 按 UTF-8 读。
pub fn write_utf8_bom_script(path: &std::path::PathBuf, script_bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let mut f = std::fs::File::create(path)?;
    f.write_all(&[0xEF, 0xBB, 0xBF])?; // UTF-8 BOM
    f.write_all(script_bytes)?;
    f.flush()?;
    Ok(())
}

/// 执行一个「UTF-8 BOM + -File」组合的 ps1 脚本，走原生 -File 参数不转码，
/// 每个参数单独 push 避免命令行字符串拼接 + dot-source 带来的引号/GBK 拆字节问题。
/// cmd: 已经是 powershell.exe，调用方可以自定义 stdout/stderr pipe。
pub fn command_file_ps1(
    script_path: &str,
    args: &[(&str, &str)],
) -> std::process::Command {
    let mut cmd = std::process::Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-OutputFormat",
        "Text",
        "-File",
        script_path,
    ]);
    for (k, v) in args {
        cmd.arg(k);
        cmd.arg(v);
    }
    cmd.silent();
    cmd
}

/// 实时流式读取子进程 stdout + stderr：子进程还在跑就一行一行回调 emit（不等到退出）。
/// 解决 PyTorch / ComfyUI deps 安装 10+ 分钟期间前端看不到任何日志的问题。
pub fn stream_command_output<F>(
    cmd: &mut std::process::Command,
    on_line: F,
) -> std::io::Result<std::process::ExitStatus>
where
    F: FnMut(&str) + Send + 'static,
{
    use std::io::{BufRead, BufReader};
    use std::thread;

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn()?;

    let stdout = child.stdout.take().expect("stdout piped");
    let stderr = child.stderr.take().expect("stderr piped");

    let on_line = Arc::new(Mutex::new(on_line));
    let on_line_out = on_line.clone();
    let on_line_err = on_line.clone();

    let t_out = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(mut cb) = on_line_out.lock() {
                    cb(&line);
                }
            }
        }
    });
    let t_err = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(mut cb) = on_line_err.lock() {
                    cb(&line);
                }
            }
        }
    });

    let status = child.wait()?;
    let _ = t_out.join();
    let _ = t_err.join();
    Ok(status)
}

