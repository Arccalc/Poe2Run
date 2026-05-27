pub mod models;
pub mod parser;
pub mod fsm;

use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tokio::sync::mpsc;
use tauri::{AppHandle, Emitter, State, Manager};
use chrono::{DateTime, Utc};
use crate::fsm::{SpeedrunFsm, RunMode, FsmStatePayload, ZoneAnalytics};
use crate::parser::LogParser;
use crate::models::Route;

pub struct AppState {
    pub fsm: Arc<Mutex<SpeedrunFsm>>,
    pub client_path: Arc<Mutex<Option<PathBuf>>>,
    pub parser_tx: Arc<Mutex<Option<mpsc::Sender<(String, DateTime<Utc>)>>>>,
}

#[tauri::command]
fn get_state(state: State<'_, AppState>) -> Result<FsmStatePayload, String> {
    let fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    Ok(fsm.generate_payload())
}

#[tauri::command]
fn start_run(
    app: AppHandle,
    state: State<'_, AppState>,
    mode: String,
    route_json_path: Option<String>,
    resume: Option<bool>,
    muling: Option<bool>,
) -> Result<String, String> {
    let run_mode = match mode.as_str() {
        "ShadowRecord" => RunMode::ShadowRecord,
        "Speedrun" => RunMode::Speedrun,
        _ => return Err("Invalid run mode".to_string()),
    };
    
    let is_muling = muling.unwrap_or(false);

    let mut reference_route = None;
    if let Some(ref path) = route_json_path {
        if !path.trim().is_empty() {
            let file = std::fs::File::open(path)
                .map_err(|e| format!("Failed to open route file: {}. Please verify the path in Settings.", e))?;
            let route: Route = serde_json::from_reader(file)
                .map_err(|e| format!("Failed to parse route JSON: {}. Please make sure the file is valid.", e))?;
            reference_route = Some(route);
        }
    }

    let mut fsm = state.fsm.lock().map_err(|e| e.to_string())?;

    let is_resume = resume.unwrap_or(false);

    if is_resume {
        if let Some(route) = reference_route {
            fsm.resume_run(route, route_json_path, run_mode);
        } else {
            return Err("No route file selected to resume. Please choose a route file first.".to_string());
        }
    } else {
        if run_mode == RunMode::Speedrun && reference_route.is_none() {
            if !fsm.route_splits.is_empty() {
                reference_route = Some(Route {
                    name: format!("Current_Session_{}", chrono::Utc::now().format("%Y%m%d_%H%M%S")),
                    created_at: chrono::Utc::now(),
                    splits: fsm.route_splits.clone(),
                });
            } else {
                return Err("No reference route available. Please configure a Route JSON path in Settings, or complete a Blind Run first to use the current session's splits.".to_string());
            }
        }
        fsm.start_run(run_mode, reference_route, route_json_path, is_muling);
    }

    let payload = fsm.generate_payload();
    let _ = app.emit("fsm-state-update", payload);

    Ok("Run started successfully".to_string())
}

#[tauri::command]
fn stop_run(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let mut fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    
    let mut saved_message = String::new();
    let mode = fsm.mode;
    let route_splits = fsm.route_splits.clone();
    
    if mode == RunMode::ShadowRecord && !route_splits.is_empty() {
        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|parent| parent.to_path_buf())).unwrap_or_else(|| std::path::PathBuf::from("."));
        let routes_dir = exe_dir.join("routes");
        if let Err(e) = std::fs::create_dir_all(&routes_dir) {
            return Err(format!("Failed to create routes directory. System Access Denied: {:?}", e));
        } else {
            let filename = format!("route_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
            let file_path = routes_dir.join(&filename);
            if let Err(e) = fsm.export_route(&file_path) {
                return Err(format!("Failed to auto-save route: {:?}", e));
            } else {
                if let Ok(absolute_path) = std::fs::canonicalize(&file_path) {
                    saved_message = absolute_path.to_string_lossy().to_string();
                } else {
                    saved_message = file_path.to_string_lossy().to_string();
                }
            }
        }
    } else if mode == RunMode::Speedrun {
        if fsm.actual_durations.iter().all(|x| x.is_none()) {
            saved_message = "Run stopped. Warning: No splits were completed, so the route file was not updated.".to_string();
        } else if let Some(ref _route) = fsm.reference_route {
            let new_route = Route {
                name: format!("Speedrun_Run_{}", chrono::Utc::now().format("%Y%m%d_%H%M%S")),
                created_at: chrono::Utc::now(),
                splits: fsm.get_completed_route(),
            };
            
            let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|parent| parent.to_path_buf())).unwrap_or_else(|| std::path::PathBuf::from("."));
            let routes_dir = exe_dir.join("routes");
            if let Err(e) = std::fs::create_dir_all(&routes_dir) {
                return Err(format!("Failed to create routes directory. System Access Denied: {:?}", e));
            } else {
                let filename = format!("route_speedrun_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
                let file_path = routes_dir.join(&filename);
                if let Ok(file) = std::fs::File::create(&file_path) {
                    if serde_json::to_writer_pretty(file, &new_route).is_ok() {
                        if let Ok(absolute_path) = std::fs::canonicalize(&file_path) {
                            saved_message = absolute_path.to_string_lossy().to_string();
                        } else {
                            saved_message = file_path.to_string_lossy().to_string();
                        }
                    } else {
                        return Err("Failed to serialize route to JSON.".to_string());
                    }
                } else {
                    return Err("Failed to create file in routes directory.".to_string());
                }
            }
        }
    }

    fsm.stop_run();
    let payload = fsm.generate_payload();
    let _ = app.emit("fsm-state-update", payload);

    if !saved_message.is_empty() { Ok(saved_message) } else { Ok("Run stopped".to_string()) }
}

#[tauri::command]
fn overwrite_route_splits(state: State<'_, AppState>) -> Result<String, String> {
    let mut fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    
    let mode = fsm.mode;
    let route_file_path = fsm.route_file_path.clone();
    let route_splits = fsm.route_splits.clone();
    
    if mode == RunMode::Speedrun {
        // Читаем данные ДО ТОГО, как берем изменяемую ссылку на route
        if fsm.actual_durations.iter().all(|x| x.is_none()) {
            return Err("No splits completed in this run to overwrite.".to_string());
        }
        let completed_splits = fsm.get_completed_route();
        
        // Теперь безопасно берем изменяемую ссылку
        if let Some(ref mut route) = fsm.reference_route {
            route.splits = completed_splits;
            
            if let Some(ref path) = route_file_path {
                let file = std::fs::File::create(path).map_err(|e| format!("Failed to create/overwrite route file: {}", e))?;
                serde_json::to_writer_pretty(file, route).map_err(|e| format!("Failed to write JSON: {}", e))?;
                return Ok(format!("Updated original route file at: {}", path));
            }
        }
    } else if mode == RunMode::ShadowRecord {
        if route_splits.is_empty() { return Err("No splits recorded in this run to overwrite.".to_string()); }
        if let Some(ref path) = route_file_path {
            let route = Route {
                name: format!("Route_{}", chrono::Utc::now().format("%Y%m%d_%H%M%S")),
                created_at: chrono::Utc::now(),
                splits: route_splits,
            };
            let file = std::fs::File::create(path).map_err(|e| format!("Failed to create/overwrite route file: {}", e))?;
            serde_json::to_writer_pretty(file, &route).map_err(|e| format!("Failed to write JSON: {}", e))?;
            return Ok(format!("Updated original route file at: {}", path));
        }
    }
    Err("No route file path configured to overwrite.".to_string())
}

#[tauri::command]
fn reorder_route_splits(app: AppHandle, state: State<'_, AppState>, new_indices: Vec<usize>) -> Result<(), String> {
    let mut fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    fsm.reorder_splits(new_indices)?;
    let payload = fsm.generate_payload();
    let _ = app.emit("fsm-state-update", payload);
    Ok(())
}

#[tauri::command]
fn select_route_file() -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("JSON Route", &["json"]);
        
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|parent| parent.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let routes_dir = exe_dir.join("routes");
    
    let _ = std::fs::create_dir_all(&routes_dir);
    
    if let Ok(abs_path) = std::fs::canonicalize(&routes_dir) {
        dialog = dialog.set_directory(abs_path);
    } else {
        dialog = dialog.set_directory(routes_dir);
    }
    
    let file = dialog.pick_file();
    Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn reset_run(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let mut fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    fsm.start_run(RunMode::Idle, None, None, false);
    let payload = fsm.generate_payload();
    let _ = app.emit("fsm-state-update", payload);
    Ok("Run reset successfully".to_string())
}

#[tauri::command]
fn toggle_pause(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let mut fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    fsm.toggle_pause();
    let payload = fsm.generate_payload();
    let _ = app.emit("fsm-state-update", payload);
    Ok("Pause toggled".to_string())
}
#[tauri::command]
fn set_always_on_top(window: tauri::Window, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}
#[tauri::command]
fn set_window_size(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height })).map_err(|e| e.to_string())
}
#[tauri::command]
fn set_decorations(window: tauri::Window, decorations: bool) -> Result<(), String> {
    window.set_decorations(decorations).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_dragging(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_context_menu(window: tauri::Window, app_handle: tauri::AppHandle, just_timer: bool, always_on_top: bool, is_paused: bool) -> Result<(), String> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};

    let pause_text = if is_paused {
        "▶ Продолжить (Resume)"
    } else {
        "⏸ Пауза (Pause)"
    };
    let pause_item = MenuItemBuilder::new(pause_text)
        .id("menu_toggle_pause")
        .build(&app_handle)
        .map_err(|e| e.to_string())?;

    let minimize_item = MenuItemBuilder::new("Свернуть (Minimize)")
        .id("menu_minimize")
        .build(&app_handle)
        .map_err(|e| e.to_string())?;

    let toggle_mode_text = if just_timer {
        "Полный режим (Full UI)"
    } else {
        "Только таймер (Just Timer)"
    };
    let toggle_mode_item = MenuItemBuilder::new(toggle_mode_text)
        .id("menu_toggle_mode")
        .build(&app_handle)
        .map_err(|e| e.to_string())?;

    let pin_text = if always_on_top {
        "Открепить поверх окон"
    } else {
        "Поверх всех окон"
    };
    let pin_item = MenuItemBuilder::new(pin_text)
        .id("menu_toggle_pin")
        .build(&app_handle)
        .map_err(|e| e.to_string())?;

    let close_item = MenuItemBuilder::new("Закрыть (Close)")
        .id("menu_close")
        .build(&app_handle)
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(&app_handle)
        .items(&[&pause_item, &minimize_item, &toggle_mode_item, &pin_item, &close_item])
        .build()
        .map_err(|e| e.to_string())?;

    window.popup_menu(&menu).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn export_shadow_route(state: State<'_, AppState>, export_path: String) -> Result<String, String> {
    let fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    if fsm.mode != RunMode::ShadowRecord && fsm.route_splits.is_empty() {
        return Err("No route data recorded to export".to_string());
    }
    fsm.export_route(&export_path).map_err(|e| format!("Export failed: {}", e))?;
    Ok(format!("Route exported to {}", export_path))
}

#[tauri::command]
fn get_zone_analytics(state: State<'_, AppState>) -> Result<std::collections::HashMap<String, ZoneAnalytics>, String> {
    let fsm = state.fsm.lock().map_err(|e| e.to_string())?;
    Ok(fsm.zone_analytics.clone())
}

#[tauri::command]
fn set_client_path(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err("Provided path does not exist".to_string());
    }

    {
        let mut path_guard = state.client_path.lock().map_err(|e| e.to_string())?;
        *path_guard = Some(path_buf.clone());
    }

    let fsm_clone = Arc::clone(&state.fsm);
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let (tx, mut rx) = mpsc::channel::<(String, DateTime<Utc>)>(100);
        let parser = LogParser::new(path_buf);

        tauri::async_runtime::spawn(async move {
            if let Err(e) = parser.start_tailing(tx).await {
                eprintln!("Parser stopped with error: {:?}", e);
            }
        });

        while let Some((zone_name, timestamp)) = rx.recv().await {
            let payload = {
                let mut fsm = match fsm_clone.lock() {
                    Ok(guard) => guard,
                    Err(_) => continue,
                };
                fsm.handle_zone_transition(zone_name, timestamp);
                fsm.generate_payload()
            };

            let _ = app_clone.emit("fsm-state-update", payload);
        }
    });

    Ok("Client.txt path set and tailing started".to_string())
}

pub fn run() {
    let fsm = Arc::new(Mutex::new(SpeedrunFsm::new()));
    let client_path = Arc::new(Mutex::new(None));
    let parser_tx = Arc::new(Mutex::new(None));

    let fsm_timer_clone = Arc::clone(&fsm);
    let app_state = AppState {
        fsm,
        client_path,
        parser_tx,
    };

    tauri::Builder::default()
        .manage(app_state)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_millis(100));
                let mut last_mode = RunMode::Idle;
                loop {
                    interval.tick().await;
                    let payload = {
                        let mut fsm = match fsm_timer_clone.lock() {
                            Ok(guard) => guard,
                            Err(_) => continue,
                        };
                        fsm.update_timers();
                        fsm.generate_payload()
                    };
                    
                    if payload.mode != RunMode::Idle || last_mode != RunMode::Idle {
                        last_mode = payload.mode;
                        let _ = app_handle.emit("fsm-state-update", payload);
                    }
                }
            });

            let handle_clone = app.handle().clone();
            app.on_menu_event(move |app_handle, event| {
                let id = event.id().0.as_str();
                match id {
                    "menu_toggle_pause" => {
                        let app_state = app_handle.state::<AppState>();
                        let mut locked = app_state.fsm.lock();
                        if let Ok(ref mut fsm) = locked {
                            fsm.toggle_pause();
                            let payload = fsm.generate_payload();
                            let _ = app_handle.emit("fsm-state-update", payload);
                        }
                    }
                    "menu_minimize" => {
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.minimize();
                        }
                    }
                    "menu_toggle_mode" => {
                        let _ = app_handle.emit("menu-toggle-mode", ());
                    }
                    "menu_toggle_pin" => {
                        let _ = app_handle.emit("menu-toggle-pin", ());
                    }
                    "menu_close" => {
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.close();
                        }
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            start_run,
            stop_run,
            overwrite_route_splits,
            select_route_file,
            reset_run,
            toggle_pause,
            export_shadow_route,
            get_zone_analytics,
            set_client_path,
            set_always_on_top,
            set_window_size,
            set_decorations,
            start_dragging,
            minimize_window,
            close_window,
            show_context_menu,
            reorder_route_splits
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}