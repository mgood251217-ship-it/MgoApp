use futures_util::StreamExt;
use serde_json::Value;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub async fn download_update(app: AppHandle, url: String) -> Value {
    let result: Result<PathBuf, String> = async {
        let parsed = reqwest::Url::parse(&url).map_err(|_| "URL update tidak valid.")?;
        if !matches!(parsed.scheme(), "https" | "http") {
            return Err("URL update harus HTTP atau HTTPS.".into());
        }
        let file_name = parsed.path_segments().and_then(|mut parts| parts.next_back())
            .filter(|name| !name.is_empty()).ok_or("Nama installer update tidak valid.")?;
        #[cfg(windows)]
        let extension = "exe";
        #[cfg(target_os = "linux")]
        let extension = "deb";
        #[cfg(not(any(windows, target_os = "linux")))]
        let extension = "";
        if extension.is_empty() || !std::path::Path::new(file_name).extension().is_some_and(|ext| ext.eq_ignore_ascii_case(extension)) {
            return Err("Format installer tidak sesuai sistem operasi.".into());
        }

        let downloads_dir = app
            .path()
            .download_dir()
            .map_err(|e| e.to_string())?;
        let dest_path = downloads_dir.join(&file_name);

        let response = reqwest::get(parsed.clone()).await.map_err(|e| e.to_string())?;
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

#[cfg(target_os = "linux")]
fn validate_debian_identity(package: &str, architecture: &str, system_architecture: &str) -> Result<(), String> {
    if package.trim() != "mgo-desktop" {
        return Err("Paket update bukan MgoDesktop. Unduh installer MGO yang benar.".into());
    }
    if architecture.trim() != system_architecture.trim() {
        return Err("Arsitektur paket update berbeda dari komputer ini.".into());
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn launch_installer(file_path: &str) -> Result<(), String> {
    use std::{path::Path, process::Command};
    let path = Path::new(file_path);
    if !path.is_absolute() || !path.is_file() || !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("deb")) {
        return Err("File installer DEB tidak ditemukan. Unduh ulang update.".into());
    }
    let path = path.canonicalize().map_err(|error| error.to_string())?;
    let field = |name: &str| -> Result<String, String> {
        let output = Command::new("/usr/bin/dpkg-deb").arg("--field").arg(&path).arg(name)
            .output().map_err(|error| format!("Paket DEB tidak dapat diperiksa: {}", error))?;
        if !output.status.success() {
            return Err("File DEB rusak atau belum selesai diunduh. Unduh ulang update.".into());
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    };
    let system = Command::new("/usr/bin/dpkg").arg("--print-architecture")
        .output().map_err(|error| error.to_string())?;
    if !system.status.success() {
        return Err("Arsitektur Linux tidak dapat diperiksa.".into());
    }
    validate_debian_identity(&field("Package")?, &field("Architecture")?, &String::from_utf8_lossy(&system.stdout))?;
    // Polkit menampilkan dialog sandi; aplikasi tetap berjalan sampai APT berhasil memasang paket.
    let output = Command::new("/usr/bin/pkexec").arg("/usr/bin/apt-get")
        .args(["install", "--yes", "--no-remove"]).arg(&path).output()
        .map_err(|error| format!("Dialog administrator Linux tidak tersedia (pkexec): {}", error))?;
    match output.status.code() {
        Some(0) => Ok(()),
        Some(126) => Err("Pemasangan update dibatalkan. Klik jalankan installer lagi untuk mencoba kembali.".into()),
        Some(127) => Err("Izin administrator Linux tidak diperoleh. Pastikan polkit dan dialog autentikasi desktop tersedia.".into()),
        _ => Err(format!("Pemasangan update gagal: {}", String::from_utf8_lossy(&output.stderr).trim())),
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
fn launch_installer(_: &str) -> Result<(), String> {
    Err("Update installer belum didukung pada sistem operasi ini.".into())
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
