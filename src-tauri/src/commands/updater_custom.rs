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
                let percent = ((downloaded as f64 / total as f64 * 100.0) as u32).min(99);
                let _ = app.emit("download-update-progress", percent);
            }
        }

        if downloaded == 0 || (total > 0 && downloaded != total) {
            return Err("Download installer belum lengkap. Silakan coba lagi.".into());
        }
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        let _ = app.emit("download-update-progress", 100u32);
        Ok(dest_path)
    }
    .await;

    match result {
        Ok(path) => serde_json::json!({ "success": true, "filePath": path.to_string_lossy() }),
        Err(message) => serde_json::json!({ "success": false, "message": message }),
    }
}

#[cfg(windows)]
fn launch_installer(file_path: &str) -> Result<(), String> {
    use std::{ffi::c_void, os::windows::ffi::OsStrExt, path::Path};
    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(hwnd: *mut c_void, operation: *const u16, file: *const u16,
            parameters: *const u16, directory: *const u16, show: i32) -> *mut c_void;
    }
    let path = Path::new(file_path);
    if !path.is_absolute() || !path.is_file() || !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("exe")) {
        return Err("File installer tidak ditemukan atau bukan file EXE. Unduh ulang update.".into());
    }
    let file: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let operation: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
    // SAFETY: both UTF-16 buffers remain valid during the call; optional pointers are null.
    // Let the installer's manifest decide whether UAC elevation is needed.
    // ShellExecute handles elevation; CreateProcess would fail with error 740.
    let result = unsafe {
        ShellExecuteW(std::ptr::null_mut(), operation.as_ptr(), file.as_ptr(),
            std::ptr::null(), std::ptr::null(), 1)
    } as isize;
    if result > 32 {
        Ok(())
    } else if result == 5 {
        Err("Izin administrator dibatalkan atau akses installer ditolak. Klik Coba Jalankan Installer Lagi dan izinkan permintaan Windows.".into())
    } else {
        Err(format!("Windows gagal membuka installer (kode {}). Coba jalankan installer lagi.", result))
    }
}

#[cfg(not(windows))]
fn launch_installer(file_path: &str) -> Result<(), String> {
    std::process::Command::new(file_path).spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn jalankan_installer(app: AppHandle, file_path: String) -> Value {
    let result = tauri::async_runtime::spawn_blocking(move || launch_installer(&file_path))
        .await.unwrap_or_else(|e| Err(e.to_string()));
    match result {
        Ok(()) => {
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
