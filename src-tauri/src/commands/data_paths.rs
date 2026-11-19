use std::{io, path::PathBuf};
use tauri::AppHandle;
#[cfg(not(windows))]
use tauri::Manager;

pub fn data_directory(app: &AppHandle) -> io::Result<PathBuf> {
    #[cfg(windows)]
    {
        let _ = app;
        let base = std::env::var_os("ProgramData").unwrap_or_else(|| r"C:\ProgramData".into());
        Ok(PathBuf::from(base).join("MgoDesktop"))
    }
    #[cfg(not(windows))]
    {
        app.path().app_local_data_dir().map_err(|error| io::Error::other(error.to_string()))
    }
}
