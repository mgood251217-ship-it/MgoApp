use futures_util::StreamExt;
use serde_json::Value;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub async fn download_update(app: AppHandle, url: String) -> Value {
    let result: Result<PathBuf, String> = async {
        let file_name = url
            .rsplit('/')
            .next()
            .filter(|s| !s.is_empty())
            .unwrap_or("MgoDesktopUpdate.exe")
            .to_string();

        let downloads_dir = app
            .path()
            .download_dir()
            .map_err(|e| e.to_string())?;
        let dest_path = downloads_dir.join(&file_name);

        let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("Gagal download, status {}", response.status()));
        }

        let total = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut file = std::fs::File::create(&dest_path).map_err(|e| e.to_string())?;
        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            file.write_all(&chunk).map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;
            if total > 0 {
                let percent = (downloaded as f64 / total as f64 * 100.0).round() as u32;
                let _ = app.emit("download-update-progress", percent);
            }
        }

        Ok(dest_path)
    }
    .await;

    match result {
        Ok(path) => serde_json::json!({ "success": true, "filePath": path.to_string_lossy() }),
        Err(message) => serde_json::json!({ "success": false, "message": message }),
    }
}

/// Padanan ipcMain.handle("jalankan-installer")
#[tauri::command]
pub fn jalankan_installer(app: AppHandle, file_path: String) -> Value {
    match std::process::Command::new(&file_path).spawn() {
        Ok(_) => {
            let app_handle = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                app_handle.exit(0);
            });
            serde_json::json!({ "success": true })
        }
        Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
    }
}
