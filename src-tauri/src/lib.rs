mod commands;

use commands::{folder_order, icon_folder, misc, settings, updater_custom};
use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn toggle_devtools(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let f12 = Shortcut::new(None, Code::F12);
                        let ctrl_shift_i =
                            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyI);
                        if shortcut == &f12 || shortcut == &ctrl_shift_i {
                            toggle_devtools(app);
                        }
                    }
                })
                .build(),
        )
        .menu(|app_handle| tauri::menu::Menu::new(app_handle))
        .setup(|app| {
            let handle = app.handle();

            if let Err(e) = icon_folder::ensure_icons_installed(handle) {
                eprintln!("Gagal setup icons: {}", e);
            }

            let shortcut_manager = handle.global_shortcut();
            if let Err(e) = shortcut_manager.register(Shortcut::new(None, Code::F12)) {
                eprintln!("Gagal register shortcut F12: {}", e);
            }
            if let Err(e) = shortcut_manager.register(Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::KeyI,
            )) {
                eprintln!("Gagal register shortcut Ctrl+Shift+I: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            misc::pilih_file_order,
            misc::pilih_folder,
            misc::buka_link_eksternal,
            misc::save_pdf_data,
            misc::simpan_file_dialog,
            misc::print_window,
            settings::get_settings,
            settings::save_settings,
            settings::restart_app,
            folder_order::cek_folder_order,
            folder_order::cari_folder_order,
            folder_order::buat_folder_order,
            folder_order::analisis_folder_order,
            folder_order::pindah_file_ke_folder,
            folder_order::rename_file_order,
            folder_order::delete_file_order,
            icon_folder::set_icon_folder_order,
            updater_custom::download_update,
            updater_custom::jalankan_installer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
