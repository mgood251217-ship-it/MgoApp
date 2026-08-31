use base64::Engine;
use chrono::Datelike;
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

/// Padanan ipcMain.handle("pilih-file-order")
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

/// Padanan ipcMain.handle("pilih-folder")
#[tauri::command]
pub async fn pilih_folder(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|f| f.to_string())
}

/// Padanan ipcMain.handle("buka-link-eksternal")
#[tauri::command]
pub async fn buka_link_eksternal(app: AppHandle, url: String) -> Value {
    match app.shell().open(&url, None) {
        Ok(_) => serde_json::json!({ "success": true }),
        Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
    }
}

#[derive(Deserialize)]
pub struct SavePdfArgs {
    pub filename: String,
    #[serde(rename = "base64Data")]
    pub base64_data: String,
}

/// Padanan ipcMain.handle("save-pdf-data")
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
