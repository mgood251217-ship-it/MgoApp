#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod installer_migration;

fn main() {
    #[cfg(windows)]
    if let Some(code) = installer_migration::run_if_requested() {
        std::process::exit(code);
    }
    mgo_desktop_lib::run();
}
