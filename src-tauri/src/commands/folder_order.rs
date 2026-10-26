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
    let nomorator = nomorator.trim();
    if nomorator.is_empty() { return false; }
    let escaped = regex::escape(nomorator);
    let pattern = format!(r"(^|[^0-9A-Za-z]){}($|[^0-9A-Za-z])", escaped);
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
    month_format: Option<&str>,
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
        if let Some(format) = month_format {
            return name.eq_ignore_ascii_case(&formatted_month(month_num, month_name, format));
        }
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
    month_format: Option<&str>,
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
    let month_default_name = formatted_month(month_num, month_name, month_format.unwrap_or("number_name"));
    let month_dir = resolve_or_create_subfolder(
        &year_dir,
        |name| {
            if month_format.is_some() {
                return name.eq_ignore_ascii_case(&month_default_name);
            }
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

fn formatted_month(month_num: i32, month_name: &str, format: &str) -> String {
    match format {
        "number" => format!("{:02}", month_num),
        "name" => month_name.to_string(),
        _ => format!("{:02} {}", month_num, month_name),
    }
}

fn valid_folder_component(name: &str) -> bool {
    !name.is_empty() && name != "." && name != ".."
        && !name.ends_with(['.', ' '])
        && !name.chars().any(|c| c.is_control() || "\\/:*?\"<>|".contains(c))
}

fn validate_folder_options(month_format: Option<&str>, product: Option<&str>) -> bool {
    month_format.map_or(true, |value| matches!(value, "number_name" | "number" | "name"))
        && product.map_or(true, valid_folder_component)
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

fn find_existing_order_folder(
    base: &Path, year: i32, month: i32, month_name: &str, day: i32,
    month_format: Option<&str>, product: Option<&str>, nomorator: &str,
) -> Option<PathBuf> {
    let mut searched = Vec::new();
    // Format pengaturan menentukan folder baru; format lama tetap dapat ditemukan.
    for format in [month_format, Some("number_name"), Some("number"), Some("name"), None] {
        let Some(day_dir) = resolve_date_folder(base, year, month, month_name, day, format) else { continue };
        if searched.contains(&day_dir) { continue; }
        searched.push(day_dir.clone());
        if let Some(product) = product {
            let product_dir = day_dir.join(product);
            if let Some(found) = find_folder_recursive(&product_dir, nomorator, 0, 12) { return Some(found); }
            if let Some(alias) = find_matching_subfolder(&day_dir, |name| normalize_for_match(name) == normalize_for_match(product)) {
                if let Some(found) = find_folder_recursive(&alias, nomorator, 0, 12) { return Some(found); }
            }
            // Periksa juga nota lama yang langsung berada di bawah tanggal.
            if let Some(found) = find_matching_subfolder(&day_dir, |name| folder_matches_nomor(name, nomorator)) { return Some(found); }
        } else if let Some(found) = find_folder_recursive(&day_dir, nomorator, 0, 12) {
            return Some(found);
        }
    }
    // Pemisahan produk hanya mengatur folder baru. Folder lama tetap dicari
    // berdasarkan nomor nota di seluruh tanggal, setelah lokasi produk diutamakan.
    if product.is_some() {
        for day_dir in searched {
            if let Some(found) = find_folder_recursive(&day_dir, nomorator, 0, 12) {
                return Some(found);
            }
        }
    }
    None
}

fn duplicate_file_suffix(mut index: usize) -> String {
    let mut letters = Vec::new();
    while index > 0 {
        index -= 1;
        letters.push((b'a' + (index % 26) as u8) as char);
        index /= 26;
    }
    letters.into_iter().rev().collect()
}

fn move_file_into_folder(source_path: &Path, target_dir: &Path, copy_only: bool) -> std::io::Result<PathBuf> {
    fs::create_dir_all(target_dir)?;
    let base_name = source_path.file_name().unwrap().to_string_lossy().to_string();
    let ext = source_path.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_default();
    let name_only = source_path.file_stem().unwrap().to_string_lossy().to_string();

    let mut dest_path = target_dir.join(&base_name);
    let mut counter = 1;
    while dest_path.exists() {
        let suffix = duplicate_file_suffix(counter);
        let candidate = if ext.is_empty() {
            format!("{} {}", name_only, suffix)
        } else {
            format!("{} {}.{}", name_only, suffix, ext)
        };
        dest_path = target_dir.join(candidate);
        counter += 1;
    }

    if copy_only {
        fs::copy(source_path, &dest_path)?;
    } else if fs::rename(source_path, &dest_path).is_err() {
        fs::copy(source_path, &dest_path)?;
        fs::remove_file(source_path)?;
    }

    Ok(dest_path)
}

// ---------- payload structs ----------

#[cfg(test)]
mod production_format_tests {
    use super::*;

    #[test]
    fn copy_keeps_source_and_existing_destination() {
        let temp = std::env::temp_dir();
        let root = temp.join(format!("mgo-copy-test-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let target = root.join("target");
        fs::create_dir_all(&target).unwrap();
        let source = root.join("desain.txt");
        fs::write(&source, b"desain baru").unwrap();
        fs::write(target.join("desain.txt"), b"desain lama").unwrap();
        let copied = move_file_into_folder(&source, &target, true).unwrap();
        assert_eq!(fs::read(&source).unwrap(), b"desain baru");
        assert_eq!(fs::read(&copied).unwrap(), b"desain baru");
        assert_eq!(copied, target.join("desain a.txt"));
        assert_eq!(duplicate_file_suffix(26), "z");
        assert_eq!(duplicate_file_suffix(27), "aa");
        assert_eq!(fs::read(target.join("desain.txt")).unwrap(), b"desain lama");
        let moved = move_file_into_folder(&source, &target, false).unwrap();
        assert_eq!(moved, target.join("desain b.txt"));
        assert!(!source.exists());
        assert_eq!(fs::read(moved).unwrap(), b"desain baru");
        assert!(root.starts_with(&temp) && root.file_name().unwrap().to_string_lossy().starts_with("mgo-copy-test-"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn month_formats_create_and_find_the_selected_directory() {
        let temp = std::env::temp_dir();
        let root = temp.join(format!("mgo-production-format-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let existing = root.join("2026").join("10 Oktober").join("26").join("PRINT PRESS")
            .join("SHOPEE EEF_17.00_CINDY_205712");
        fs::create_dir_all(&existing).unwrap();
        assert_eq!(find_existing_order_folder(&root, 2026, 10, "Oktober", 26,
            Some("number"), Some("PRINTPRESS"), " 205712 "), Some(existing.clone()));
        assert_eq!(find_existing_order_folder(&root, 2026, 10, "Oktober", 26,
            Some("number"), Some("JERSEY"), "205712"), Some(existing.clone()));
        assert_eq!(find_existing_order_folder(&root, 2026, 10, "Oktober", 26,
            Some("number"), None, "205712"), Some(existing.clone()));
        let jersey = root.join("2026").join("10").join("26").join("JERSEY").join("UJI_205712");
        fs::create_dir_all(&jersey).unwrap();
        assert_eq!(find_existing_order_folder(&root, 2026, 10, "Oktober", 26,
            Some("number"), Some("JERSEY"), "205712"), Some(jersey));
        let source = root.join("desain.txt");
        fs::write(&source, b"desain").unwrap();
        let target = find_existing_order_folder(&root, 2026, 10, "Oktober", 26,
            None, Some("PRINT PRESS"), "205712").unwrap();
        assert_eq!(move_file_into_folder(&source, &target, true).unwrap(), existing.join("desain.txt"));
        assert!(source.exists());
        assert!(folder_matches_nomor("205712_SHOPEE EEF", "205712"));
        assert!(folder_matches_nomor("SHOPEE_205712 revisi", "205712"));
        assert!(!folder_matches_nomor("SHOPEE_1205712", "205712"));
        assert!(!folder_matches_nomor("SHOPEE_2057120", "205712"));
        for (format, expected) in [("number_name", "10 Oktober"), ("number", "10"), ("name", "Oktober")] {
            let day = resolve_or_create_date_folder(&root, 2026, 10, "Oktober", 26, Some(format)).unwrap();
            assert_eq!(day, root.join("2026").join(expected).join("26"));
            assert_eq!(resolve_date_folder(&root, 2026, 10, "Oktober", 26, Some(format)), Some(day.clone()));
            for product in ["PRINTPRESS", "JERSEY"] {
                let order = day.join(product).join("UJI_123");
                fs::create_dir_all(&order).unwrap();
                assert_eq!(find_folder_recursive(&day.join(product), "123", 0, 12), Some(order));
            }
            assert!(find_folder_recursive(&day.join("PRODUK LAIN"), "123", 0, 12).is_none());
        }
        assert!(root.starts_with(&temp) && root.file_name().unwrap().to_string_lossy().starts_with("mgo-production-format-"));
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn folder_options_reject_nested_product_paths_and_accept_legacy_payloads() {
        assert!(validate_folder_options(None, None));
        assert!(validate_folder_options(Some("number"), Some("PRINTPRESS")));
        for product in ["..", "", "D:\\Other", "A/B", "A\\B"] {
            assert!(!validate_folder_options(Some("name"), Some(product)));
        }
        assert!(!validate_folder_options(Some("unknown"), None));
        let legacy: BuatFolderArgs = serde_json::from_value(serde_json::json!({
            "basePath": "D:\\Produksi", "year": 2026, "monthNum": 10,
            "monthName": "Oktober", "day": 26, "folderName": "UJI_123"
        })).unwrap();
        assert!(legacy.month_format.is_none() && legacy.product_folder.is_none());
    }
}

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
    #[serde(default, rename = "monthFormat")]
    pub month_format: Option<String>,
    #[serde(default, rename = "productFolder")]
    pub product_folder: Option<String>,
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
    #[serde(default, rename = "monthFormat")]
    pub month_format: Option<String>,
    #[serde(default, rename = "productFolder")]
    pub product_folder: Option<String>,
    #[serde(default)]
    pub nomorator: Option<String>,
}

#[derive(Deserialize)]
pub struct PindahFileArgs {
    #[serde(rename = "filePaths")]
    pub file_paths: Vec<String>,
    #[serde(rename = "targetFolderPath")]
    pub target_folder_path: String,
    #[serde(default, rename = "copyOnly")]
    pub copy_only: bool,
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

#[tauri::command]
pub async fn cek_folder_order(folder_path: String) -> serde_json::Value {
    if cfg!(target_os = "android") {
        return serde_json::json!({ "exists": false, "unsupported": true });
    }

    tauri::async_runtime::spawn_blocking(move || {
        serde_json::json!({ "exists": Path::new(&folder_path).exists() })
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn buka_folder(folder_path: String) -> SimpleResult {
    if cfg!(target_os = "android") || cfg!(target_os = "ios") {
        return SimpleResult {
            success: false,
            message: Some("Membuka folder tidak didukung di platform ini.".into()),
        };
    }

    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&folder_path);
        if !path.exists() {
            return SimpleResult {
                success: false,
                message: Some("Folder tidak ditemukan.".into()),
            };
        }

        #[cfg(target_os = "windows")]
        let res = std::process::Command::new("explorer").arg(&folder_path).spawn();

        #[cfg(target_os = "macos")]
        let res = std::process::Command::new("open").arg(&folder_path).spawn();

        #[cfg(target_os = "linux")]
        let res = std::process::Command::new("xdg-open").arg(&folder_path).spawn();

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        let res: std::io::Result<std::process::Child> = Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Platform tidak didukung",
        ));

        match res {
            Ok(_) => SimpleResult { success: true, message: None },
            Err(e) => SimpleResult { success: false, message: Some(e.to_string()) },
        }
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn cari_folder_order(args: CariFolderArgs) -> serde_json::Value {
    tauri::async_runtime::spawn_blocking(move || {
        if !validate_folder_options(args.month_format.as_deref(), args.product_folder.as_deref()) {
            return serde_json::json!({ "found": false, "message": "Format folder tidak valid." });
        }
        let base = Path::new(&args.base_path);
        let found = find_existing_order_folder(base, args.year, args.month_num, &args.month_name,
            args.day, args.month_format.as_deref(), args.product_folder.as_deref(), &args.nomorator);
        serde_json::json!({ "found": found.is_some(), "path": found.map(|p| p.to_string_lossy().to_string()) })
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn buat_folder_order(args: BuatFolderArgs) -> serde_json::Value {
    tauri::async_runtime::spawn_blocking(move || {
        if !validate_folder_options(args.month_format.as_deref(), args.product_folder.as_deref())
            || !valid_folder_component(&args.folder_name) || !valid_folder_component(&args.month_name) {
            return serde_json::json!({ "success": false, "message": "Format atau nama folder tidak valid." });
        }
        let base = Path::new(&args.base_path);
        let nomorator = args.nomorator.as_deref().unwrap_or_else(|| args.folder_name.rsplit('_').next().unwrap_or(""));
        if let Some(existing) = find_existing_order_folder(base, args.year, args.month_num, &args.month_name,
            args.day, args.month_format.as_deref(), args.product_folder.as_deref(), nomorator) {
            return serde_json::json!({ "success": true, "path": existing.to_string_lossy() });
        }
        match resolve_or_create_date_folder(base, args.year, args.month_num, &args.month_name, args.day, args.month_format.as_deref()) {
            Ok(day_dir) => {
                let parent = args.product_folder.as_ref().map_or(day_dir.clone(), |product| day_dir.join(product));
                let target = parent.join(&args.folder_name);
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
            match move_file_into_folder(source, target_dir, args.copy_only) {
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
