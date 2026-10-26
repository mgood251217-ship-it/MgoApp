use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

const ICON_FILES: [&str; 4] = [
    "folder-selesai.ico",
    "folder-proses.ico",
    "folder-cancel.ico",
    "folder-diambil.ico",
];

fn program_data_dir() -> PathBuf {
    let base = std::env::var("ProgramData").unwrap_or_else(|_| r"C:\ProgramData".to_string());
    PathBuf::from(base).join("MgoDesktop").join("icons")
}

fn bundled_icon_dir(app: &AppHandle) -> PathBuf {
    use tauri::Manager;
    app.path()
        .resource_dir()
        .map(|d| d.join("icons"))
        .unwrap_or_else(|_| PathBuf::from("icons"))
}

pub fn ensure_icons_installed(app: &AppHandle) -> std::io::Result<()> {
    let source_dir = bundled_icon_dir(app);
    let target_dir = program_data_dir();
    fs::create_dir_all(&target_dir)?;

    for file in ICON_FILES {
        let target_path = target_dir.join(file);
        if !target_path.exists() {
            let _ = fs::copy(source_dir.join(file), &target_path);
        }
    }
    Ok(())
}

fn icon_path_for(status: &str) -> Option<PathBuf> {
    let base = program_data_dir();
    match status {
        "selesai" => Some(base.join("folder-selesai.ico")),
        "proses" => Some(base.join("folder-proses.ico")),
        "cancel" => Some(base.join("folder-cancel.ico")),
        "diambil" => Some(base.join("folder-diambil.ico")),
        _ => None,
    }
}

#[cfg(windows)]
mod shell {
    use std::{ffi::c_void, io, os::windows::ffi::OsStrExt, path::Path};

    pub const READONLY: u32 = 0x1;
    pub const HIDDEN: u32 = 0x2;
    pub const SYSTEM: u32 = 0x4;
    const NORMAL: u32 = 0x80;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetFileAttributesW(path: *const u16) -> u32;
        fn SetFileAttributesW(path: *const u16, attributes: u32) -> i32;
    }

    #[link(name = "shell32")]
    extern "system" {
        fn SHChangeNotify(event: i32, flags: u32, item1: *const c_void, item2: *const c_void);
    }

    fn wide_path(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    pub fn attributes(path: &Path, add: u32, remove: u32) -> io::Result<()> {
        let path = wide_path(path);
        // SAFETY: path is a live, null-terminated UTF-16 buffer.
        let current = unsafe { GetFileAttributesW(path.as_ptr()) };
        if current == u32::MAX {
            return Err(io::Error::last_os_error());
        }
        let updated = ((current | add) & !remove) & !NORMAL;
        let updated = if updated == 0 { NORMAL } else { updated };
        if updated == current {
            return Ok(());
        }
        if unsafe { SetFileAttributesW(path.as_ptr(), updated) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    pub fn notify(folder: &Path) {
        const UPDATEITEM: i32 = 0x2000;
        const UPDATEDIR: i32 = 0x1000;
        const PATHW_FLUSHNOWAIT: u32 = 0x0005 | 0x3000;
        let path = wide_path(folder);
        // SAFETY: buffers remain live for each call; Windows copies the notification data.
        unsafe {
            SHChangeNotify(UPDATEITEM, PATHW_FLUSHNOWAIT, path.as_ptr().cast(), std::ptr::null());
        }
        if let Some(parent) = folder.parent() {
            let parent = wide_path(parent);
            unsafe {
                SHChangeNotify(UPDATEDIR, PATHW_FLUSHNOWAIT, parent.as_ptr().cast(), std::ptr::null());
            }
        }
    }
}

#[cfg(not(windows))]
mod shell {
    use std::{io, path::Path};
    pub const READONLY: u32 = 1;
    pub const HIDDEN: u32 = 2;
    pub const SYSTEM: u32 = 4;
    pub fn attributes(_: &Path, _: u32, _: u32) -> io::Result<()> {
        Err(io::Error::new(io::ErrorKind::Unsupported, "Windows only"))
    }
    pub fn notify(_: &Path) {}
}

#[tauri::command]
pub async fn set_icon_folder_order(folder_path: String, status: String) -> Value {
    tauri::async_runtime::spawn_blocking(move || {
        if !cfg!(target_os = "windows") {
            return serde_json::json!({ "success": false, "message": "Fitur ini hanya didukung di Windows." });
        }

        let icon_path = match icon_path_for(&status) {
            Some(p) => p,
            None => return serde_json::json!({ "success": false, "message": format!("Status '{}' tidak dikenal.", status) }),
        };

        let folder = Path::new(&folder_path);
        let desktop_ini_path = folder.join("desktop.ini");
        let content = format!(
            "[.ShellClassInfo]\r\nIconResource={},0\r\n[ViewState]\r\nMode=\r\nVid=\r\nFolderType=Generic\r\n",
            icon_path.to_string_lossy()
        );

        if let Err(e) = fs::create_dir_all(folder) {
            return serde_json::json!({ "success": false, "message": e.to_string() });
        }

        // Only desktop.ini needs its read-only/system/hidden flags cleared for writing.
        if let Err(e) = shell::attributes(&desktop_ini_path, 0, shell::READONLY | shell::SYSTEM | shell::HIDDEN) {
            if e.kind() != std::io::ErrorKind::NotFound {
                return serde_json::json!({ "success": false, "message": format!("Gagal menyiapkan desktop.ini: {}", e) });
            }
        }

        if let Err(e) = fs::write(&desktop_ini_path, content) {
            return serde_json::json!({ "success": false, "message": e.to_string() });
        }

        if let Err(e) = shell::attributes(&desktop_ini_path, shell::HIDDEN | shell::SYSTEM, 0)
            .and_then(|_| shell::attributes(folder, shell::READONLY, 0))
        {
            return serde_json::json!({ "success": false, "message": format!("Gagal set attribute folder: {}", e) });
        }

        shell::notify(folder);
        serde_json::json!({ "success": true })
    })
    .await
    .unwrap()
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::os::windows::fs::MetadataExt;

    #[test]
    fn shell_attributes_preserve_other_flags_and_allow_icon_replacement() {
        let folder = std::env::temp_dir().join(format!(
            "mgo-icon-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        fs::create_dir(&folder).unwrap();
        let ini = folder.join("desktop.ini");
        assert_eq!(shell::attributes(&ini, 0, shell::READONLY).unwrap_err().kind(), std::io::ErrorKind::NotFound);
        fs::write(&ini, "first icon").unwrap();
        shell::attributes(&ini, shell::READONLY | shell::HIDDEN | shell::SYSTEM, 0).unwrap();
        shell::attributes(&ini, 0, shell::READONLY | shell::HIDDEN | shell::SYSTEM).unwrap();
        fs::write(&ini, "second icon").unwrap();
        shell::attributes(&ini, shell::HIDDEN | shell::SYSTEM, 0).unwrap();
        assert_eq!(fs::metadata(&ini).unwrap().file_attributes() & 7, shell::HIDDEN | shell::SYSTEM);
        shell::attributes(&folder, shell::HIDDEN, 0).unwrap();
        shell::attributes(&folder, shell::READONLY, 0).unwrap();
        assert_eq!(fs::metadata(&folder).unwrap().file_attributes() & 3, shell::READONLY | shell::HIDDEN);
        shell::notify(&folder);
        shell::attributes(&ini, 0, shell::HIDDEN | shell::SYSTEM).unwrap();
        shell::attributes(&folder, 0, shell::READONLY | shell::HIDDEN).unwrap();
        fs::remove_dir_all(&folder).unwrap();
    }
}
