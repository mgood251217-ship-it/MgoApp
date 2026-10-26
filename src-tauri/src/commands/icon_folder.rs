use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

const ICON_FILES: [&str; 3] = ["folder-selesai.ico", "folder-proses.ico", "folder-cancel.ico"];

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
        _ => None,
    }
}

fn run_attrib(args: &[&str]) -> std::io::Result<()> {
    Command::new("attrib").args(args).output()?;
    Ok(())
}

fn notify_shell_update(folder_path: &Path) {
    let ps_command = format!(
        r#"$sig = @"
using System;
using System.Runtime.InteropServices;
public class ShellNotify {{
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
}}
"@
Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue
$path = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni('{}')
[ShellNotify]::SHChangeNotify(0x2000, 0x0005, $path, [IntPtr]::Zero)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($path)
"#,
        folder_path.to_string_lossy().replace('\'', "''")
    );

    let _ = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &ps_command])
        .output();
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

        let folder_str = folder.to_string_lossy();
        let ini_str = desktop_ini_path.to_string_lossy();
        let _ = run_attrib(&["-r", "-s", "-h", &folder_str]);
        let _ = run_attrib(&["-r", "-s", "-h", &ini_str]);

        if let Err(e) = fs::write(&desktop_ini_path, content) {
            return serde_json::json!({ "success": false, "message": e.to_string() });
        }

        if run_attrib(&["+h", "+s", &ini_str]).is_err() || run_attrib(&["+r", &folder_str]).is_err() {
            return serde_json::json!({ "success": false, "message": "Gagal set attribute folder." });
        }

        notify_shell_update(folder);
        serde_json::json!({ "success": true })
    })
    .await
    .unwrap()
}
