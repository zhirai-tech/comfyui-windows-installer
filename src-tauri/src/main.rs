#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::{comfyui, diagnostics, docker, gpu, installer, models, python, repair, resources, service, system};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};

static APP_QUITTING: AtomicBool = AtomicBool::new(false);

fn bring_main_window_to_front(app: &AppHandle) {
    if APP_QUITTING.load(Ordering::Relaxed) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();

        let win = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(800));
            let _ = win.set_always_on_top(false);
        });
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn toggle_main_window(app: &AppHandle) {
    if APP_QUITTING.load(Ordering::Relaxed) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            bring_main_window_to_front(app);
        }
    }
}

fn resolve_managed_install() -> Option<(String, String)> {
    installer::config::read_install_marker().map(|marker| (marker.install_dir, marker.install_mode))
}

fn open_url_in_default_browser(url: &str) {
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();

    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();

    #[cfg(all(unix, not(target_os = "macos")))]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

fn spawn_service_action(app: &AppHandle, action: &str) {
    let Some((install_dir, install_mode)) = resolve_managed_install() else {
        bring_main_window_to_front(app);
        return;
    };

    let app_handle = app.clone();
    let action = action.to_string();
    tauri::async_runtime::spawn(async move {
        match action.as_str() {
            "start" => {
                let _ = service::start::start_service(app_handle, install_dir, install_mode).await;
            }
            "stop" => {
                let _ = service::lifecycle::stop_service(app_handle, install_dir, install_mode).await;
            }
            "restart" => {
                let _ = service::lifecycle::restart_service(app_handle, install_dir, install_mode).await;
            }
            _ => {}
        }
    });
}

fn open_managed_ui(app: &AppHandle) {
    if let Some((install_dir, install_mode)) = resolve_managed_install() {
        let status = tauri::async_runtime::block_on(service::status::get_service_status(install_dir, install_mode));
        let target = if status.url.is_empty() {
            "http://127.0.0.1:8188".to_string()
        } else {
            status.url
        };
        open_url_in_default_browser(&target);
    } else {
        bring_main_window_to_front(app);
    }
}

fn install_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show_main", "打开助手", true, None::<&str>)?;
    let open_ui_item = MenuItem::with_id(app, "open_ui", "打开 UI", true, None::<&str>)?;
    let start_item = MenuItem::with_id(app, "start_service", "启动 ComfyUI", true, None::<&str>)?;
    let restart_item = MenuItem::with_id(app, "restart_service", "重启 ComfyUI", true, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "stop_service", "停止 ComfyUI", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide_main", "隐藏到后台", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit_app", "退出并停止 ComfyUI", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &open_ui_item,
            &start_item,
            &restart_item,
            &stop_item,
            &hide_item,
            &separator,
            &quit_item,
        ],
    )?;

    let icon = app.default_window_icon().cloned();
    let mut tray = TrayIconBuilder::with_id("main-tray");
    if let Some(icon) = icon {
        tray = tray.icon(icon);
    }
    tray.tooltip("ComfyUI安装助手")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_main" => bring_main_window_to_front(app),
            "open_ui" => open_managed_ui(app),
            "start_service" => spawn_service_action(app, "start"),
            "restart_service" => spawn_service_action(app, "restart"),
            "stop_service" => spawn_service_action(app, "stop"),
            "hide_main" => hide_main_window(app),
            "quit_app" => {
                APP_QUITTING.store(true, Ordering::Relaxed);
                // 立即隐藏窗口，避免“退出”点击同时触发的托盘左键 toggle 把窗口再弹出来
                hide_main_window(app);
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    // 无论是否已安装，右键退出都必须能退出；有安装则先尽力停止服务
                    if let Some((install_dir, install_mode)) = resolve_managed_install() {
                        let _ = tokio::time::timeout(
                            Duration::from_secs(10),
                            service::lifecycle::stop_service(
                                app_handle.clone(),
                                install_dir,
                                install_mode,
                            ),
                        )
                        .await;
                    }
                    app_handle.exit(0);
                });
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            bring_main_window_to_front(app);
        }))
        .setup(|app| {
            let handle = app.handle().clone();
            install_tray(&handle)?;
            bring_main_window_to_front(&handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if APP_QUITTING.load(Ordering::Relaxed) {
                    return;
                }
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            system::detect_system,
            system::pick_default_install_dir,
            system::validate_install_dir,
            system::prepare_results_dir,
            gpu::detect_gpu,
            python::detect_python,
            python::prepare_python,
            comfyui::download_comfyui,
            installer::steps::run_install_step,
            installer::config::launch_comfyui,
            installer::config::write_install_config,
            installer::config::has_install_config,
            installer::config::probe_any_installed,
            installer::config::read_install_config,
            installer::config::update_install_config,
            installer::config::read_install_marker,
            docker::check_docker,
            docker::install_docker_mode,
            service::start::start_service,
            service::lifecycle::stop_service,
            service::lifecycle::restart_service,
            service::lifecycle::uninstall_service,
            service::status::get_service_status,
            diagnostics::detect_environment,
            diagnostics::check_comfyui_version,
            diagnostics::update_comfyui,
            repair::repair_environment,
            resources::scan_models,
            resources::scan_nodes,
            resources::scan_workflows,
            resources::install_preset_workflow,
            resources::delete_workflow,
            resources::install_custom_node,
            resources::delete_node,
            resources::install_translate_node,
            resources::scan_blueprints,
            resources::analyze_workflow,
            models::download_model,
            models::delete_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
