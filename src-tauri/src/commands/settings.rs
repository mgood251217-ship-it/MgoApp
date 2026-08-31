use serde_json::Value;
use std::fs;
use tauri::{AppHandle, Manager};

fn settings_path(app: &AppHandle) -> std::path::PathBuf {
    let dir = app.path().app_data_dir().expect("app data dir tidak tersedia");
    let _ = fs::create_dir_all(&dir);
    dir.join("settings.json")
}

fn read_settings(app: &AppHandle) -> Value {
    let path = settings_path(app);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    }
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Value {
    read_settings(&app)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, new_settings: Value) -> Value {
    let mut current = read_settings(&app);
    if let (Some(current_obj), Some(new_obj)) = (current.as_object_mut(), new_settings.as_object()) {
        for (k, v) in new_obj {
            current_obj.insert(k.clone(), v.clone());
        }
    }
    match serde_json::to_string_pretty(&current) {
        Ok(text) => match fs::write(settings_path(&app), text) {
            Ok(_) => serde_json::json!({ "success": true, "data": current }),
            Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
        },
        Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
    }
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart();
}
