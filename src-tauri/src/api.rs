use axum::{
    response::sse::{Event as SseEvent, KeepAlive, Sse},
    routing::{get, post},
    Json, Router,
};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

use crate::commands::{
    comfyui, diagnostics, docker, gpu, installer, models, python, repair, resources, service,
    system,
};

/// 统一入口：前端 invoke(cmd, args) → POST /api/command { command, args }
#[derive(Deserialize)]
pub struct InvokeRequest {
    command: String,
    #[serde(default)]
    args: Option<Value>,
}

// ---- 参数 DTO（对应 Tauri command 的 camelCase 入参）----

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DetectSystem {
    install_dir: Option<String>,
}

#[derive(Deserialize)]
struct ValidateInstallDir {
    path: String,
}

#[derive(Deserialize)]
struct PrepareResultsDir {
    dir: String,
}

#[derive(Deserialize)]
struct OpenPath {
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreparePython {
    install_dir: String,
    versions_config: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadComfyui {
    install_dir: String,
    versions_config: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunInstallStep {
    step: String,
    install_dir: String,
    python_exe: String,
    comfyui_dir: String,
    versions_config: Value,
    gpu_info: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LaunchComfyui {
    install_dir: String,
}

#[derive(Deserialize)]
struct WriteInstallConfig {
    config: installer::config::InstallConfig,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct HasInstallConfig {
    cfg_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProbeAnyInstalled {
    candidate_dir: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallDir {
    install_dir: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateInstallConfig {
    install_dir: String,
    port: u32,
    launch_args: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallDockerMode {
    install_dir: String,
    versions_config: Value,
    step_phase: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServiceArgs {
    install_dir: String,
    install_mode: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UninstallService {
    install_dir: String,
    install_mode: String,
    keep_models: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallPresetWorkflow {
    install_dir: String,
    file_name: String,
    content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileNameArgs {
    install_dir: String,
    file_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallCustomNode {
    install_dir: String,
    node_name: String,
    git_url: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NodeNameArgs {
    install_dir: String,
    node_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelArgs {
    install_dir: String,
    category: String,
    file_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DownloadModelArgs {
    install_dir: String,
    category: String,
    file_name: String,
    url: String,
}

// ---- 路由 ----

pub fn router() -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/command", post(dispatch))
        .route("/api/events", get(events_stream))
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true }))
}

async fn dispatch(Json(req): Json<InvokeRequest>) -> Json<Value> {
    let args = req.args.unwrap_or_else(|| json!({}));
    match run(&req.command, args).await {
        Ok(data) => Json(json!({ "ok": true, "data": data })),
        Err(error) => Json(json!({ "ok": false, "error": error })),
    }
}

fn arg<T: DeserializeOwned>(args: &Value) -> Result<T, String> {
    serde_json::from_value(args.clone()).map_err(|e| format!("参数解析失败: {}", e))
}

fn to_val<T: serde::Serialize>(v: T) -> Value {
    serde_json::to_value(v).unwrap_or(Value::Null)
}

async fn run(cmd: &str, args: Value) -> Result<Value, String> {
    match cmd {
        "detect_system" => {
            let a: DetectSystem = arg(&args)?;
            system::detect_system(a.install_dir).await.map(to_val)
        }
        "pick_default_install_dir" => Ok(to_val(system::pick_default_install_dir())),
        "validate_install_dir" => {
            let a: ValidateInstallDir = arg(&args)?;
            system::validate_install_dir(a.path).map(to_val)
        }
        "prepare_results_dir" => {
            let a: PrepareResultsDir = arg(&args)?;
            system::prepare_results_dir(a.dir).map(to_val)
        }
        "open_path" => {
            let a: OpenPath = arg(&args)?;
            system::open_path(a.path).map(to_val)
        }
        "detect_gpu" => gpu::detect_gpu().await.map(to_val),
        "detect_python" => python::detect_python().await.map(to_val),
        "prepare_python" => {
            let a: PreparePython = arg(&args)?;
            python::prepare_python(a.install_dir, a.versions_config)
                .await
                .map(to_val)
        }
        "download_comfyui" => {
            let a: DownloadComfyui = arg(&args)?;
            comfyui::download_comfyui(a.install_dir, a.versions_config)
                .await
                .map(to_val)
        }
        "run_install_step" => {
            let a: RunInstallStep = arg(&args)?;
            installer::steps::run_install_step(
                a.step,
                a.install_dir,
                a.python_exe,
                a.comfyui_dir,
                a.versions_config,
                a.gpu_info,
            )
            .await
            .map(to_val)
        }
        "launch_comfyui" => {
            let a: LaunchComfyui = arg(&args)?;
            installer::config::launch_comfyui(a.install_dir).map(to_val)
        }
        "write_install_config" => {
            let a: WriteInstallConfig = arg(&args)?;
            installer::config::write_install_config(a.config).map(to_val)
        }
        "has_install_config" => {
            let a: HasInstallConfig = arg(&args)?;
            Ok(to_val(installer::config::has_install_config(a.cfg_path)))
        }
        "probe_any_installed" => {
            let a: ProbeAnyInstalled = arg(&args)?;
            Ok(to_val(
                installer::config::probe_any_installed(a.candidate_dir).await,
            ))
        }
        "read_install_config" => {
            let a: InstallDir = arg(&args)?;
            Ok(to_val(installer::config::read_install_config(a.install_dir)))
        }
        "update_install_config" => {
            let a: UpdateInstallConfig = arg(&args)?;
            installer::config::update_install_config(a.install_dir, a.port, a.launch_args)
                .map(to_val)
        }
        "read_install_marker" => Ok(to_val(installer::config::read_install_marker())),
        "check_docker" => Ok(to_val(docker::check_docker().await)),
        "install_docker_mode" => {
            let a: InstallDockerMode = arg(&args)?;
            docker::install_docker_mode(a.install_dir, a.versions_config, a.step_phase)
                .await
                .map(to_val)
        }
        "start_service" => {
            let a: ServiceArgs = arg(&args)?;
            service::start::start_service(a.install_dir, a.install_mode)
                .await
                .map(to_val)
        }
        "stop_service" => {
            let a: ServiceArgs = arg(&args)?;
            service::lifecycle::stop_service(a.install_dir, a.install_mode)
                .await
                .map(to_val)
        }
        "restart_service" => {
            let a: ServiceArgs = arg(&args)?;
            service::lifecycle::restart_service(a.install_dir, a.install_mode)
                .await
                .map(to_val)
        }
        "uninstall_service" => {
            let a: UninstallService = arg(&args)?;
            service::lifecycle::uninstall_service(a.install_dir, a.install_mode, a.keep_models)
                .await
                .map(to_val)
        }
        "get_service_status" => {
            let a: ServiceArgs = arg(&args)?;
            Ok(to_val(
                service::status::get_service_status(a.install_dir, a.install_mode).await,
            ))
        }
        "detect_environment" => {
            let a: ServiceArgs = arg(&args)?;
            diagnostics::detect_environment(a.install_dir, a.install_mode)
                .await
                .map(to_val)
        }
        "check_comfyui_version" => {
            let a: InstallDir = arg(&args)?;
            diagnostics::check_comfyui_version(a.install_dir).map(to_val)
        }
        "update_comfyui" => {
            let a: InstallDir = arg(&args)?;
            diagnostics::update_comfyui(a.install_dir).map(to_val)
        }
        "repair_environment" => {
            let a: ServiceArgs = arg(&args)?;
            repair::repair_environment(a.install_dir, a.install_mode)
                .await
                .map(to_val)
        }
        "scan_models" => {
            let a: InstallDir = arg(&args)?;
            Ok(to_val(resources::scan_models(a.install_dir).await))
        }
        "scan_nodes" => {
            let a: InstallDir = arg(&args)?;
            Ok(to_val(resources::scan_nodes(a.install_dir).await))
        }
        "scan_workflows" => {
            let a: InstallDir = arg(&args)?;
            Ok(to_val(resources::scan_workflows(a.install_dir).await))
        }
        "install_preset_workflow" => {
            let a: InstallPresetWorkflow = arg(&args)?;
            resources::install_preset_workflow(a.install_dir, a.file_name, a.content).map(to_val)
        }
        "delete_workflow" => {
            let a: FileNameArgs = arg(&args)?;
            resources::delete_workflow(a.install_dir, a.file_name).map(to_val)
        }
        "install_custom_node" => {
            let a: InstallCustomNode = arg(&args)?;
            resources::install_custom_node(a.install_dir, a.node_name, a.git_url).map(to_val)
        }
        "delete_node" => {
            let a: NodeNameArgs = arg(&args)?;
            resources::delete_node(a.install_dir, a.node_name).map(to_val)
        }
        "install_translate_node" => {
            let a: InstallDir = arg(&args)?;
            resources::install_translate_node(a.install_dir).map(to_val)
        }
        "scan_blueprints" => {
            let a: InstallDir = arg(&args)?;
            Ok(to_val(resources::scan_blueprints(a.install_dir).await))
        }
        "analyze_workflow" => {
            let a: FileNameArgs = arg(&args)?;
            resources::analyze_workflow(a.install_dir, a.file_name)
                .await
                .map(to_val)
        }
        "download_model" => {
            let a: DownloadModelArgs = arg(&args)?;
            models::download_model(a.install_dir, a.category, a.file_name, a.url).map(to_val)
        }
        "delete_model" => {
            let a: ModelArgs = arg(&args)?;
            models::delete_model(a.install_dir, a.category, a.file_name).map(to_val)
        }
        other => Err(format!("未知命令: {}", other)),
    }
}

async fn events_stream() -> Sse<impl tokio_stream::Stream<Item = Result<SseEvent, std::convert::Infallible>>> {
    let rx = crate::events::subscribe();
    let stream = BroadcastStream::new(rx).map(|item| match item {
        Ok(ev) => {
            let data = serde_json::to_string(&ev.data).unwrap_or_default();
            Ok(SseEvent::default().event(ev.name).data(data))
        }
        Err(_) => Ok(SseEvent::default().event("keepalive").data("")),
    });
    Sse::new(stream).keep_alive(KeepAlive::default())
}
