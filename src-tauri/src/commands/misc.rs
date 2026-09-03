use base64::Engine;
use chrono::Datelike;
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn pilih_file_order(app: AppHandle) -> Vec<String> {
    let files = app
        .dialog()
        .file()
        .add_filter("File Desain", &["jpg", "jpeg", "png", "pdf", "tif", "tiff", "cdr"])
        .blocking_pick_files();

    files
        .map(|list| list.into_iter().map(|f| f.to_string()).collect())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn pilih_folder(app: AppHandle) -> Option<String> {
    #[cfg(desktop)]
    {
        return app
            .dialog()
            .file()
            .blocking_pick_folder()
            .map(|f| f.to_string());
    }

    #[cfg(not(desktop))]
    {
        let _ = app;
        None
    }
}

#[tauri::command]
pub async fn buka_link_eksternal(app: AppHandle, url: String) -> Value {
    match app.shell().open(&url, None) {
        Ok(_) => serde_json::json!({ "success": true }),
        Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
    }
}

#[derive(Deserialize)]
pub struct SimpanFileArgs {
    #[serde(rename = "base64Data")]
    pub base64_data: String,
    #[serde(rename = "defaultFileName")]
    pub default_file_name: String,
    pub filters: Option<Vec<(String, Vec<String>)>>,
}

#[tauri::command]
pub async fn simpan_file_dialog(app: AppHandle, args: SimpanFileArgs) -> Value {
    let mut dialog = app.dialog().file().set_file_name(&args.default_file_name);

    if let Some(filters) = &args.filters {
        for (label, extensions) in filters {
            let ext_refs: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter(label, &ext_refs);
        }
    }

    let picked_path = dialog.blocking_save_file();

    let dest_path = match picked_path {
        Some(p) => match p.into_path() {
            Ok(path) => path,
            Err(e) => return serde_json::json!({ "success": false, "message": e.to_string() }),
        },
        None => return serde_json::json!({ "success": false, "cancelled": true }),
    };

    let buffer = match base64::engine::general_purpose::STANDARD.decode(&args.base64_data) {
        Ok(b) => b,
        Err(e) => return serde_json::json!({ "success": false, "message": e.to_string() }),
    };

    match fs::write(&dest_path, buffer) {
        Ok(_) => serde_json::json!({ "success": true, "filePath": dest_path.to_string_lossy() }),
        Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
    }
}

#[tauri::command]
pub fn print_window(app: AppHandle) -> Value {
    #[cfg(desktop)]
    {
        return match app.get_webview_window("main") {
            Some(window) => match window.print() {
                Ok(_) => serde_json::json!({ "success": true }),
                Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
            },
            None => {
                serde_json::json!({ "success": false, "message": "Window utama tidak ditemukan." })
            }
        };
    }

    #[cfg(not(desktop))]
    {
        let _ = app;
        serde_json::json!({ "success": false, "message": "Print tidak didukung di platform ini." })
    }
}

#[derive(Deserialize)]
pub struct SavePdfArgs {
    pub filename: String,
    #[serde(rename = "base64Data")]
    pub base64_data: String,
}

#[tauri::command]
pub fn save_pdf_data(args: SavePdfArgs) -> Value {
    let program_data = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());
    let today = chrono::Local::now();

    let struk_dir: PathBuf = PathBuf::from(program_data)
        .join("MgoDesktop")
        .join("StrukBackup")
        .join(today.year().to_string())
        .join(format!("{:02}", today.month()))
        .join(format!("{:02}", today.day()));

    if let Err(e) = fs::create_dir_all(&struk_dir) {
        return serde_json::json!({ "success": false, "message": e.to_string() });
    }

    let file_path = struk_dir.join(&args.filename);

    let buffer = match base64::engine::general_purpose::STANDARD.decode(&args.base64_data) {
        Ok(b) => b,
        Err(e) => return serde_json::json!({ "success": false, "message": e.to_string() }),
    };

    match fs::write(&file_path, buffer) {
        Ok(_) => serde_json::json!({ "success": true, "filePath": file_path.to_string_lossy() }),
        Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
    }
}
