use crate::commands::file_meta::get_file_meta;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ---------- helper murni (bukan #[tauri::command]) ----------

fn normalize_for_match(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

fn extract_leading_number(s: &str) -> Option<i32> {
    let re = Regex::new(r"^\s*0*(\d{1,2})").unwrap();
    re.captures(s)?.get(1)?.as_str().parse().ok()
}

fn folder_matches_nomor(entry_name: &str, nomorator: &str) -> bool {
    let escaped = regex::escape(nomorator);
    let pattern = format!(r"(^|[_\-\s]){}$", escaped);
    Regex::new(&pattern)
        .map(|re| re.is_match(entry_name))
        .unwrap_or(false)
        || entry_name.eq_ignore_ascii_case(nomorator)
}

fn find_matching_subfolder<F>(dir: &Path, matcher: F) -> Option<PathBuf>
where
    F: Fn(&str) -> bool,
{
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if matcher(name) {
                    return Some(path);
                }
            }
        }
    }
    None
}

fn resolve_date_folder(
    base_path: &Path,
    year: i32,
    month_num: i32,
    month_name: &str,
    day: i32,
) -> Option<PathBuf> {
    let year_dir = find_matching_subfolder(base_path, |name| {
        Regex::new(r"\d{4}")
            .unwrap()
            .find(name)
            .and_then(|m| m.as_str().parse::<i32>().ok())
            .map(|d| d == year)
            .unwrap_or(false)
    })?;

    let month_name_norm = normalize_for_match(month_name);
    let month_dir = find_matching_subfolder(&year_dir, |name| {
        if extract_leading_number(name) == Some(month_num) {
            return true;
        }
        normalize_for_match(name).contains(&month_name_norm)
    })?;

    find_matching_subfolder(&month_dir, |name| extract_leading_number(name) == Some(day))
}

fn resolve_or_create_subfolder<F>(dir: &Path, matcher: F, default_name: &str) -> std::io::Result<PathBuf>
where
    F: Fn(&str) -> bool,
{
    if let Some(existing) = find_matching_subfolder(dir, matcher) {
        return Ok(existing);
    }
    let new_path = dir.join(default_name);
    fs::create_dir_all(&new_path)?;
    Ok(new_path)
}

fn resolve_or_create_date_folder(
    base_path: &Path,
    year: i32,
    month_num: i32,
    month_name: &str,
    day: i32,
) -> std::io::Result<PathBuf> {
    fs::create_dir_all(base_path)?;

    let year_dir = resolve_or_create_subfolder(
        base_path,
        |name| {
            Regex::new(r"\d{4}")
                .unwrap()
                .find(name)
                .and_then(|m| m.as_str().parse::<i32>().ok())
                .map(|d| d == year)
                .unwrap_or(false)
        },
        &year.to_string(),
    )?;

    let month_name_norm = normalize_for_match(month_name);
    let month_default_name = format!("{:02} {}", month_num, month_name);
    let month_dir = resolve_or_create_subfolder(
        &year_dir,
        |name| {
            if extract_leading_number(name) == Some(month_num) {
                return true;
            }
            normalize_for_match(name).contains(&month_name_norm)
        },
        &month_default_name,
    )?;

    let day_default_name = format!("{:02}", day);
    resolve_or_create_subfolder(
        &month_dir,
        |name| extract_leading_number(name) == Some(day),
        &day_default_name,
    )
}

fn find_folder_recursive(dir: &Path, nomorator: &str, depth: u32, max_depth: u32) -> Option<PathBuf> {
    if depth > max_depth {
        return None;
    }
    let entries: Vec<_> = fs::read_dir(dir).ok()?.flatten().collect();

    for entry in &entries {
        let path = entry.path();
        if path.is_dir() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if folder_matches_nomor(name, nomorator) {
                    return Some(path);
                }
            }
        }
    }
    for entry in &entries {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_folder_recursive(&path, nomorator, depth + 1, max_depth) {
                return Some(found);
            }
        }
    }
    None
}

fn move_file_into_folder(source_path: &Path, target_dir: &Path) -> std::io::Result<PathBuf> {
    fs::create_dir_all(target_dir)?;
    let base_name = source_path.file_name().unwrap().to_string_lossy().to_string();
    let ext = source_path.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
    let name_only = source_path.file_stem().unwrap().to_string_lossy().to_string();

    let mut dest_path = target_dir.join(&base_name);
    let mut counter = 1;
    while dest_path.exists() {
        let candidate = if ext.is_empty() {
            format!("{} ({})", name_only, counter)
        } else {
            format!("{} ({}).{}", name_only, counter, ext)
        };
        dest_path = target_dir.join(candidate);
        counter += 1;
    }

    if fs::rename(source_path, &dest_path).is_err() {
        fs::copy(source_path, &dest_path)?;
        fs::remove_file(source_path)?;
    }

    Ok(dest_path)
}

// ---------- payload structs ----------

#[derive(Deserialize)]
pub struct CariFolderArgs {
    #[serde(rename = "basePath")]
    pub base_path: String,
    pub year: i32,
    #[serde(rename = "monthNum")]
    pub month_num: i32,
    #[serde(rename = "monthName")]
    pub month_name: String,
    pub day: i32,
    pub nomorator: String,
}

#[derive(Deserialize)]
pub struct BuatFolderArgs {
    #[serde(rename = "basePath")]
    pub base_path: String,
    pub year: i32,
    #[serde(rename = "monthNum")]
    pub month_num: i32,
    #[serde(rename = "monthName")]
    pub month_name: String,
    pub day: i32,
    #[serde(rename = "folderName")]
    pub folder_name: String,
}

#[derive(Deserialize)]
pub struct PindahFileArgs {
    #[serde(rename = "filePaths")]
    pub file_paths: Vec<String>,
    #[serde(rename = "targetFolderPath")]
    pub target_folder_path: String,
}

#[derive(Deserialize)]
pub struct RenameFileArgs {
    #[serde(rename = "oldPath")]
    pub old_path: String,
    #[serde(rename = "newPath")]
    pub new_path: String,
}

#[derive(Serialize)]
pub struct SimpleResult {
    pub success: bool,
    pub message: Option<String>,
}

#[derive(Serialize)]
pub struct MoveResultItem {
    pub source: String,
    pub success: bool,
    pub dest: Option<String>,
    pub message: Option<String>,
}

#[derive(Serialize)]
pub struct AnalisisItem {
    pub nama: String,
    #[serde(rename = "ukuranByte")]
    pub ukuran_byte: u64,
    #[serde(flatten)]
    pub meta: crate::commands::file_meta::FileMeta,
}

// ---------- commands ----------
// Semua dibungkus spawn_blocking supaya kerjaan I/O berat (readdir, scan
// rekursif, baca metadata gambar) tidak jalan di main thread dan bikin
// window freeze/"not responding" saat folder besar atau di network drive.

#[tauri::command]
pub async fn cek_folder_order(folder_path: String) -> serde_json::Value {
    tauri::async_runtime::spawn_blocking(move || {
        serde_json::json!({ "exists": Path::new(&folder_path).exists() })
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn cari_folder_order(args: CariFolderArgs) -> serde_json::Value {
    tauri::async_runtime::spawn_blocking(move || {
        let base = Path::new(&args.base_path);
        match resolve_date_folder(base, args.year, args.month_num, &args.month_name, args.day) {
            Some(day_dir) => {
                let found_path = find_folder_recursive(&day_dir, &args.nomorator, 0, 12);
                serde_json::json!({
                    "found": found_path.is_some(),
                    "path": found_path.map(|p| p.to_string_lossy().to_string()),
                    "searchedPath": day_dir.to_string_lossy().to_string(),
                })
            }
            None => serde_json::json!({ "found": false }),
        }
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn buat_folder_order(args: BuatFolderArgs) -> serde_json::Value {
    tauri::async_runtime::spawn_blocking(move || {
        let base = Path::new(&args.base_path);
        match resolve_or_create_date_folder(base, args.year, args.month_num, &args.month_name, args.day) {
            Ok(day_dir) => {
                let target = day_dir.join(&args.folder_name);
                match fs::create_dir_all(&target) {
                    Ok(_) => serde_json::json!({ "success": true, "path": target.to_string_lossy() }),
                    Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
                }
            }
            Err(e) => serde_json::json!({ "success": false, "message": e.to_string() }),
        }
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn analisis_folder_order(folder_path: String) -> serde_json::Value {
    tauri::async_runtime::spawn_blocking(move || {
        let allowed_ext = ["jpg", "jpeg", "png", "pdf", "tif", "tiff", "cdr"];
        let dir = Path::new(&folder_path);

        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(e) => return serde_json::json!({ "success": false, "message": e.to_string() }),
        };

        let mut hasil = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if !allowed_ext.contains(&ext.as_str()) {
                continue;
            }
            let meta = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            let file_meta = get_file_meta(&path);
            hasil.push(AnalisisItem {
                nama: path.file_name().unwrap().to_string_lossy().to_string(),
                ukuran_byte: meta.len(),
                meta: file_meta,
            });
        }

        serde_json::json!({ "success": true, "data": hasil })
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn pindah_file_ke_folder(args: PindahFileArgs) -> serde_json::Value {
    tauri::async_runtime::spawn_blocking(move || {
        let target_dir = Path::new(&args.target_folder_path);
        let mut results = Vec::new();

        for file_path in &args.file_paths {
            let source = Path::new(file_path);
            match move_file_into_folder(source, target_dir) {
                Ok(dest) => results.push(MoveResultItem {
                    source: file_path.clone(),
                    success: true,
                    dest: Some(dest.to_string_lossy().to_string()),
                    message: None,
                }),
                Err(e) => results.push(MoveResultItem {
                    source: file_path.clone(),
                    success: false,
                    dest: None,
                    message: Some(e.to_string()),
                }),
            }
        }

        serde_json::json!({ "success": true, "results": results })
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn rename_file_order(args: RenameFileArgs) -> SimpleResult {
    tauri::async_runtime::spawn_blocking(move || {
        if args.old_path == args.new_path {
            return SimpleResult { success: true, message: None };
        }
        if Path::new(&args.new_path).exists() {
            return SimpleResult {
                success: false,
                message: Some("Nama file sudah dipakai di folder ini.".into()),
            };
        }
        match fs::rename(&args.old_path, &args.new_path) {
            Ok(_) => SimpleResult { success: true, message: None },
            Err(e) => SimpleResult { success: false, message: Some(e.to_string()) },
        }
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn delete_file_order(file_path: String) -> SimpleResult {
    tauri::async_runtime::spawn_blocking(move || match fs::remove_file(&file_path) {
        Ok(_) => SimpleResult { success: true, message: None },
        Err(e) => SimpleResult { success: false, message: Some(e.to_string()) },
    })
    .await
    .unwrap()
}
