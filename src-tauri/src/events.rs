use serde_json::Value;
use std::sync::OnceLock;
use tokio::sync::broadcast;

/// 事件总线：替代原 Tauri 的 app.emit，供 SSE 推送日志/进度给浏览器。
#[derive(Debug, Clone)]
pub struct Event {
    pub name: String,
    pub data: Value,
}

static TX: OnceLock<broadcast::Sender<Event>> = OnceLock::new();

pub fn init() {
    let (tx, _rx) = broadcast::channel::<Event>(1024);
    let _ = TX.set(tx);
}

fn send(name: &str, data: Value) {
    if let Some(tx) = TX.get() {
        let _ = tx.send(Event {
            name: name.to_string(),
            data,
        });
    }
}

/// 文本日志（对应原 install_log 事件，data 为 "[tag] msg" 字符串）
pub fn log(tag: &str, msg: &str) {
    send("install_log", Value::String(format!("[{tag}] {msg}")));
}

/// 结构化事件（repair_progress / detect_progress / model_download_* 等）
pub fn emit<T: serde::Serialize>(name: &str, data: T) {
    let v = serde_json::to_value(data).unwrap_or(Value::Null);
    send(name, v);
}

pub fn subscribe() -> broadcast::Receiver<Event> {
    TX.get().expect("events not initialized").subscribe()
}
