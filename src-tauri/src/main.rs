#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod events;

use std::net::SocketAddr;

use axum::http::{header, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::Router;
use rust_embed::RustEmbed;
use tower_http::cors::CorsLayer;

const PORT: u16 = 16789;

/// 前端构建产物（release-repo/dist）随二进制一起编译，实现单文件 exe。
#[derive(RustEmbed)]
#[folder = "../dist"]
struct Assets;

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

fn embedded_file(path: &str) -> Response {
    if let Some(content) = Assets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return (
            [(header::CONTENT_TYPE, mime.as_ref().to_owned())],
            content.data.into_owned(),
        )
            .into_response();
    }
    // SPA 回退：未知路由交给前端路由处理
    if let Some(index) = Assets::get("index.html") {
        return (
            [
                (header::CONTENT_TYPE, "text/html; charset=utf-8".to_owned()),
            ],
            index.data.into_owned(),
        )
            .into_response();
    }
    (StatusCode::NOT_FOUND, "404 Not Found").into_response()
}

async fn static_handler(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    embedded_file(if path.is_empty() { "index.html" } else { path })
}

fn static_files() -> Router {
    Router::new().fallback(static_handler)
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
