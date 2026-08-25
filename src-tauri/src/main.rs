#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod events;

use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};

const PORT: u16 = 16789;

#[tokio::main]
async fn main() {
    events::init();

    let app = Router::new()
        .merge(api::router())
        .layer(CorsLayer::permissive())
        .fallback_service(static_files());

    let addr = SocketAddr::from(([127, 0, 0, 1], PORT));

    // 单实例：端口被占用说明已有一个执行器在跑，直接打开浏览器并退出。
    match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => {
            open_browser_later();
            axum::serve(listener, app).await.expect("本地服务启动失败");
        }
        Err(_) => {
            open_browser();
        }
    }
}

/// 静态资源目录：优先 exe 同级 dist，其次 cwd/dist，再其次 ../dist（cargo run 场景）。
fn static_dir() -> PathBuf {
    let candidate = |d: PathBuf| {
        if d.join("index.html").exists() {
            Some(d)
        } else {
            None
        }
    };

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            if let Some(d) = candidate(parent.join("dist")) {
                return d;
            }
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        if let Some(d) = candidate(cwd.join("dist")) {
            return d;
        }
        if let Some(d) = candidate(cwd.join("..").join("dist")) {
            return d;
        }
    }
    PathBuf::from("dist")
}

fn static_files() -> Router {
    let dir = static_dir();
    let index = dir.join("index.html");
    let serve = ServeDir::new(dir).fallback(ServeFile::new(index));
    Router::new().fallback_service(serve)
}

fn open_browser() {
    let url = format!("http://127.0.0.1:{}", PORT);

    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn();

    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&url).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
}

fn open_browser_later() {
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(800));
        open_browser();
    });
}
