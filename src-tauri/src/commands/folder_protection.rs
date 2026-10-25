use crate::folder_protection::{Request, Response};
use serde_json::{json, Value};

// Read-only UI entry point in Phase 2. Windows SID enrollment is enforced by the
// independent broker; neither frontend role claims nor MGO API tokens are trusted.
#[tauri::command]
pub async fn inspect_folder_protection() -> Result<Response, String> {
    let status = crate::folder_protection::request(Request::Status).await?;
    if !status.success {
        return Ok(status);
    }
    let mut data = status.data;
    let roots = data["roots"].as_array().cloned().unwrap_or_default();
    let mut inspected = Vec::with_capacity(roots.len());
    for mut root in roots {
        if root["available"] == true {
            let response = crate::folder_protection::request(Request::ForRoot {
                root_id: root["id"].as_str().unwrap_or_default().to_string(),
                request: Box::new(Request::Inspect),
            })
            .await?;
            if response.success {
                root["inspection"] = response.data;
            } else {
                root["available"] = Value::Bool(false);
                root["error"] = Value::String(
                    response
                        .message
                        .unwrap_or_else(|| response.code.to_string()),
                );
            }
        }
        inspected.push(root);
    }
    data["roots"] = Value::Array(inspected);
    Ok(Response::ok(data))
}

fn service(request: Request) -> Result<Value, String> {
    let response = tauri::async_runtime::block_on(crate::folder_protection::request(request))?;
    if !response.success {
        return Err(response.message.unwrap_or(response.code));
    }
    Ok(response.data)
}

#[tauri::command]
pub async fn folder_protection_lan_status() -> Result<Value, String> {
    #[cfg(windows)]
    {
        use crate::folder_protection::{lan, request_local};
        let local = request_local(Request::Status)
            .await
            .ok()
            .filter(|r| r.success)
            .map(|r| r.data);
        return Ok(
            json!({"server":local,"computer":std::env::var("COMPUTERNAME").unwrap_or_default(),"connections":lan::connections()?.iter().map(|c|c.summary()).collect::<Vec<_>>()}),
        );
    }
    #[cfg(not(windows))]
    {
        Err("LAN memerlukan Windows".into())
    }
}

#[cfg(windows)]
fn elevate_lan(
    cache: &std::path::Path,
    request: &crate::folder_protection::admin::LanRequest,
) -> Result<(), String> {
    use crate::folder_protection::{lan, windows as win};
    use std::{fs, io::Write};
    use windows_sys::Win32::{
        System::Threading::{GetExitCodeProcess, WaitForSingleObject},
        UI::{
            Shell::{ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW},
            WindowsAndMessaging::SW_HIDE,
        },
    };
    fs::create_dir_all(cache).map_err(|e| e.to_string())?;
    let request_path = cache.join(format!("folder-lan-{}.json", lan::random_token()?));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&request_path)
            .map_err(|e| e.to_string())?;
        file.write_all(&serde_json::to_vec(request).map_err(|e| e.to_string())?)
            .and_then(|_| file.sync_all())
            .map_err(|e| e.to_string())?;
        drop(file);
        let launcher = win::known_folder(&windows_sys::Win32::UI::Shell::FOLDERID_ProgramFiles)
            .map_err(|e| e.to_string())?
            .join("MgoFolderProtection")
            .join("activate_folder_protection.ps1");
        let powershell =
            std::path::PathBuf::from(std::env::var_os("SystemRoot").ok_or("Missing Windows path")?)
                .join(r"System32\WindowsPowerShell\v1.0\powershell.exe");
        let parameters = format!(
            "-NoProfile -NonInteractive -File \"{}\" -Action ConfigureLan -RequestFile \"{}\"",
            launcher.display(),
            request_path.display()
        );
        let verb = win::wide(std::ffi::OsStr::new("runas"));
        let exe = win::wide(powershell.as_os_str());
        let params = win::wide(std::ffi::OsStr::new(&parameters));
        let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        info.cbSize = std::mem::size_of_val(&info) as u32;
        info.fMask = SEE_MASK_NOCLOSEPROCESS;
        info.lpVerb = verb.as_ptr();
        info.lpFile = exe.as_ptr();
        info.lpParameters = params.as_ptr();
        info.nShow = SW_HIDE;
        unsafe {
            win::checked(ShellExecuteExW(&mut info))
                .map_err(|e| format!("UAC dibatalkan atau gagal: {e}"))?;
        }
        let process = win::Handle(info.hProcess);
        if process.0.is_null() {
            return Err("Proses administrator tidak dimulai".into());
        }
        if unsafe { WaitForSingleObject(process.0, 600_000) } != 0 {
            return Err(
                "Pengaturan LAN masih berjalan. Periksa status sebelum mencoba lagi.".into(),
            );
        }
        let mut code = 1;
        unsafe {
            win::checked(GetExitCodeProcess(process.0, &mut code)).map_err(|e| e.to_string())?;
        }
        if code != 0 {
            return Err(
                "Pengaturan LAN tidak selesai. Periksa pesan pada jendela administrator.".into(),
            );
        }
        Ok(())
    })();
    let _ = fs::remove_file(request_path);
    result
}

#[tauri::command]
pub async fn configure_folder_protection_lan(
    app: tauri::AppHandle,
    root_id: String,
    host: String,
    path: String,
    enabled: bool,
) -> Result<Value, String> {
    #[cfg(windows)]
    {
        use crate::folder_protection::{self as fp, admin::LanRequest, lan, windows as win};
        use tauri::Manager;
        let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
        let status = fp::request_local(Request::Status).await?;
        if status.data["lan_protocol"] != 1 {
            return Err("Perbarui layanan menggunakan installer terbaru dan centang komputer server sebelum mengatur LAN.".into());
        }
        return tauri::async_runtime::spawn_blocking(move || {
            let token=lan::random_token()?;
            let request=LanRequest { root_id:root_id.clone(),operator_sid:win::process_sid().map_err(|e|e.to_string())?,host:host.trim().into(),path:path.trim().trim_end_matches('\\').into(),token_hash:if enabled {Some(lan::token_hash(&token)?)}else{None} };
            // Only the hash crosses the elevation boundary; the credential stays in this process.
            elevate_lan(&cache,&request)?;
            if !enabled { return Ok(json!({"message":"Akses LAN MGO folder ini dicabut. Share Explorer khusus MGO dihapus bila digunakan."})); }
            let response=tauri::async_runtime::block_on(fp::request_local(Request::Status))?;
            let certificate=response.data["lan"]["certificate"].as_str().ok_or("Layanan LAN belum siap; perbarui layanan melalui installer terbaru")?;
            let c=lan::Connection { schema:1,host:request.host,path:request.path,root_id,certificate:certificate.into(),token,device_key:None,enrolled:false };
            Ok(json!({"code":c.encode()?,"message":format!("Path Explorer baca-saja: {}. Kode berlaku 10 menit untuk mendaftarkan klien; kode dan pendaftaran lama folder ini sudah dicabut.",c.path)}))
        }).await.map_err(|e|e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        let _ = (app, root_id, host, path, enabled);
        Err("LAN memerlukan Windows".into())
    }
}

#[tauri::command]
pub async fn connect_folder_protection_lan(code: String) -> Result<Value, String> {
    #[cfg(windows)]
    {
        use crate::folder_protection::lan;
        let mut c = lan::Connection::decode(&code)?;
        c.prepare_device()?;
        let response = lan::client(&c, Request::Status).await?;
        if !response.success {
            return Err(response.message.unwrap_or(response.code));
        }
        if response.data["protocol_version"].as_u64().unwrap_or(0)
            < crate::folder_protection::PROTOCOL_VERSION as u64
            || !response.data["roots"].as_array().is_some_and(|rs| {
                rs.iter()
                    .any(|r| r["id"] == c.root_id && r["available"] == true)
            })
        {
            return Err("Folder server belum siap atau versi layanan perlu diperbarui".into());
        }
        c.enrolled = true;
        let mut saved = lan::connections()?;
        saved.retain(|old| old.id() != c.id());
        let summary = c.summary();
        saved.push(c);
        let registrations: Vec<_> = saved
            .iter()
            .map(|c| crate::folder_protection::mapping::Registration {
                root_id: c.id(),
                aliases: vec![c.path.clone()],
            })
            .collect();
        for r in &registrations {
            crate::folder_protection::mapping::resolve(&r.aliases[0], &registrations)?;
        }
        lan::save_connections(&saved)?;
        return Ok(summary);
    }
    #[cfg(not(windows))]
    {
        let _ = code;
        Err("LAN memerlukan Windows".into())
    }
}

#[tauri::command]
pub async fn disconnect_folder_protection_lan(id: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use crate::folder_protection::lan;
        let mut saved = lan::connections()?;
        saved.retain(|c| c.id() != id);
        return lan::save_connections(&saved);
    }
    #[cfg(not(windows))]
    {
        let _ = id;
        Err("LAN memerlukan Windows".into())
    }
}

#[tauri::command]
pub async fn verify_folder_protection(root_id: Option<String>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || verify_current_user(root_id))
        .await
        .map_err(|e| e.to_string())?
}

fn verify_current_user(requested_root_id: Option<String>) -> Result<Value, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use std::{
        fs,
        io::Write,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };
    let status = service(Request::Status)?;
    if status["protocol_version"].as_u64().unwrap_or(0)
        < crate::folder_protection::PROTOCOL_VERSION as u64
    {
        return Err("Perbarui layanan melalui installer MgoApp: pilih komputer server.".into());
    }
    let roots = status["roots"]
        .as_array()
        .ok_or("Layanan belum memberikan daftar folder terdaftar")?;
    let selected = if let Some(id) = requested_root_id.as_deref() {
        roots
            .iter()
            .find(|root| root["id"] == id)
            .ok_or("Folder tidak terdaftar pada layanan")?
    } else {
        roots.first().ok_or("Belum ada folder terdaftar")?
    };
    if selected["available"] != true {
        return Err(format!(
            "Folder terdaftar belum tersedia: {}",
            selected["error"]
                .as_str()
                .unwrap_or("status tidak diketahui")
        ));
    }
    let root_id = selected["id"]
        .as_str()
        .ok_or("Identitas folder tidak tersedia")?
        .to_string();
    let root_label = selected["label"].as_str().unwrap_or("Folder").to_string();
    let root = PathBuf::from(
        selected["path"]
            .as_str()
            .ok_or("Lokasi folder terdaftar tidak tersedia")?,
    );
    let service_for_root = |request| {
        service(Request::ForRoot {
            root_id: root_id.clone(),
            request: Box::new(request),
        })
    };
    let probe = format!(
        "MGO-check-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );
    service_for_root(Request::CreateDirectory {
        path: probe.clone(),
    })?;
    let name = |leaf: &str| format!("{probe}\\{leaf}");
    let mut checks = Vec::new();
    let result: Result<(), String> = (|| {
        service_for_root(Request::Create {
            name: name("read.txt"),
            data: STANDARD.encode(b"MGO permission check"),
        })?;
        checks.push(json!({"name": "Baca melalui Windows", "passed": fs::read(root.join(&probe).join("read.txt")).is_ok()}));
        let direct = root.join(&probe).join("direct.txt");
        let create_denied = match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&direct)
        {
            Ok(mut file) => {
                let _ = file.write_all(b"unexpected write permission");
                false
            }
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => true,
            Err(e) => {
                checks.push(json!({"name":"Akses langsung Windows belum dapat dipastikan", "passed":false,"message":e.to_string()}));
                false
            }
        };
        checks.push(
            json!({"name": "Windows menolak pembuatan file langsung", "passed": create_denied}),
        );
        let delete_denied = match fs::remove_file(root.join(&probe).join("read.txt")) {
            Ok(()) => false,
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => true,
            Err(e) => {
                checks.push(json!({"name":"Akses hapus Windows belum dapat dipastikan", "passed":false,"message":e.to_string()}));
                false
            }
        };
        checks
            .push(json!({"name": "Windows menolak penghapusan langsung", "passed": delete_denied}));
        service_for_root(Request::Create {
            name: name("crud.txt"),
            data: STANDARD.encode(b"first"),
        })?;
        service_for_root(Request::Update {
            name: name("crud.txt"),
            data: STANDARD.encode(b"second"),
        })?;
        let read = service_for_root(Request::Read {
            name: name("crud.txt"),
        })?;
        if read["data"] != STANDARD.encode(b"second") {
            return Err("Read-back data mismatch".into());
        }
        service_for_root(Request::Rename {
            source: name("crud.txt"),
            destination: name("renamed.txt"),
        })?;
        service_for_root(Request::Copy {
            source: name("renamed.txt"),
            destination: name("copy.txt"),
        })?;
        service_for_root(Request::Delete {
            name: name("renamed.txt"),
        })?;
        checks.push(json!({"name": "CRUD, rename dan copy melalui layanan", "passed": true}));
        Ok(())
    })();
    if let Err(e) = result {
        checks.push(json!({"name": "Operasi layanan", "passed": false, "message": e}));
    }
    // Only remove files created by this unique probe; never recursively delete a tree.
    let mut cleanup_errors = Vec::new();
    match service_for_root(Request::ListDirectory {
        path: probe.clone(),
    }) {
        Ok(list) => {
            if let Some(entries) = list["entries"].as_array() {
                for entry in entries {
                    if let Some(leaf) = entry["name"].as_str() {
                        if [
                            "read.txt",
                            "crud.txt",
                            "renamed.txt",
                            "copy.txt",
                            "direct.txt",
                        ]
                        .contains(&leaf)
                        {
                            if let Err(e) = service_for_root(Request::Delete { name: name(leaf) }) {
                                cleanup_errors.push(e);
                            }
                        }
                    }
                }
            }
            if let Err(e) = service_for_root(Request::RemoveDirectory {
                path: probe.clone(),
            }) {
                cleanup_errors.push(e);
            }
        }
        Err(e) => cleanup_errors.push(e),
    }
    let passed = checks.iter().all(|c| c["passed"] == true) && cleanup_errors.is_empty();
    Ok(
        json!({"passed": passed, "checks": checks, "cleanup_errors": cleanup_errors,
        "root_id":root_id,"root_label":root_label,"root": root, "scope": if root_id.starts_with("lan-") { "CRUD melalui koneksi TLS ke server; akses Windows melalui share SMB memakai kredensial Windows aktif pada klien ini." } else { "Akun Windows yang menjalankan MgoApp pada komputer ini; akses dari komputer LAN lain belum diuji." }}),
    )
}

fn candidate_folder(path: &str) -> Result<std::path::PathBuf, String> {
    let path = path.replace('/', "\\");
    let path = path.trim_end_matches('\\');
    let bytes = path.as_bytes();
    if bytes.len() < 4 || !bytes[0].is_ascii_alphabetic() || &bytes[1..3] != b":\\" {
        return Err("Pilih subfolder lokal seperti D:\\Indoor, bukan seluruh drive, UNC, atau path perangkat.".into());
    }
    crate::folder_protection::relative_parts(&path[3..], false)?;
    Ok(std::path::PathBuf::from(path))
}

#[tauri::command]
pub async fn plan_folder_protection(path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || plan_candidate(&path))
        .await
        .map_err(|e| e.to_string())?
}

fn plan_candidate(path: &str) -> Result<Value, String> {
    let path = candidate_folder(path)?;
    #[cfg(windows)]
    {
        use crate::folder_protection::{
            mapping::{resolve, Registration, StorageBackend},
            windows as win,
        };
        use windows_sys::Win32::Storage::FileSystem::*;
        let sid = win::registered_server_sid()
            .map_err(|e| format!("Identitas layanan belum tersedia: {e}"))?;
        // This is only a read-only preview. Activation must independently reopen/pin
        // every component and revalidate identities/ACLs after administrator approval.
        let mut ancestor = Some(path.as_path());
        let mut exists = false;
        while let Some(current) = ancestor {
            match std::fs::symlink_metadata(current) {
                Ok(meta) => {
                    use std::os::windows::fs::MetadataExt;
                    if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                        return Err("Junction/symlink pada path tidak diperbolehkan.".into());
                    }
                    if current == path {
                        exists = true;
                        if !meta.is_dir() {
                            return Err("Lokasi yang dipilih bukan folder.".into());
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
                Err(e) => return Err(format!("Path belum dapat diperiksa: {e}")),
            }
            ancestor = current.parent();
        }
        let mut root_id = None;
        let mut registrations: Vec<Registration> =
            if let Some(raw) = win::registered_value("Roots").map_err(|e| e.to_string())? {
                serde_json::from_str(&raw).map_err(|e| format!("Invalid machine roots: {e}"))?
            } else {
                vec![]
            };
        if registrations.is_empty() {
            if let Some(root) = win::registered_value("RootPath").map_err(|e| e.to_string())? {
                registrations.push(Registration {
                    root_id: "local".into(),
                    aliases: vec![root],
                });
            }
        }
        if let StorageBackend::ProtectedFilesystem { root_id: id, .. } =
            resolve(&path.to_string_lossy(), &registrations)?
        {
            root_id = Some(id);
        }
        let registered = root_id.is_some();
        let mut parent = path.parent().ok_or("Folder induk tidak ditemukan")?;
        while !parent.exists() {
            parent = parent.parent().ok_or("Folder induk tidak ditemukan")?;
        }
        let handle = win::open(
            parent,
            READ_CONTROL | FILE_READ_ATTRIBUTES,
            OPEN_EXISTING,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        )
        .map_err(|e| format!("Izin induk tidak dapat diperiksa: {e}"))?;
        win::require_ntfs(&handle).map_err(|e| e.to_string())?;
        let parent_sddl = win::sddl(&handle).map_err(|e| e.to_string())?;
        let mut blockers = Vec::new();
        let mut ancestor = Some(parent);
        while let Some(current) = ancestor {
            let file = win::open(
                current,
                READ_CONTROL | FILE_READ_ATTRIBUTES,
                OPEN_EXISTING,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )
            .map_err(|e| e.to_string())?;
            for error in win::parent_security_conflicts(&file, &sid).map_err(|e| e.to_string())? {
                blockers.push(format!("{}: {error}", current.display()));
            }
            ancestor = current.parent();
        }
        let status = service(Request::Status).ok();
        let protocol = status
            .as_ref()
            .and_then(|s| s["protocol_version"].as_u64())
            .unwrap_or(0);
        if protocol < 4 {
            blockers.push(
                "Perbarui aplikasi dan layanan server untuk aktivasi beberapa folder (protokol 4)."
                    .into(),
            );
        }
        if !exists {
            blockers.push(
                "Pilih folder yang sudah ada. Aktivasi tidak membuat ulang folder yang hilang."
                    .into(),
            );
        }
        let mut file_id = None;
        let mut warnings = Vec::new();
        let mut sddl = None;
        if exists {
            let handle = win::open(
                &path,
                READ_CONTROL | FILE_READ_ATTRIBUTES,
                OPEN_EXISTING,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )
            .map_err(|e| e.to_string())?;
            sddl = Some(win::sddl(&handle).map_err(|e| e.to_string())?);
            file_id = Some(win::file_id(&handle).map_err(|e| e.to_string())?);
            if std::fs::read_dir(&path)
                .map_err(|e| e.to_string())?
                .next()
                .is_some()
            {
                warnings.push("Folder berisi data. Aktivasi mencadangkan owner/group/DACL seluruh objek, meminta persetujuan administrator, lalu memverifikasi hasilnya. Tutup aplikasi lain yang sedang menulis file.".to_string());
            }
        }
        Ok(
            json!({"path":path,"exists":exists,"registered":registered,"blockers":blockers,"warnings":warnings,"sddl":sddl,"file_id":file_id,"parent_sddl":parent_sddl,"root_id":root_id,"operator_sid":win::process_sid().map_err(|e|e.to_string())?,"can_activate":exists && !registered && blockers.is_empty(),
            "summary":if registered {"Lokasi tercakup oleh registrasi layanan. Gunakan pengujian akses untuk memastikan izin akun ini."} else {"Pilih Aktifkan dengan administrator setelah semua penghalang izin diselesaikan."},
            "permissions":["SYSTEM dan Administrators: Full Control","Identitas layanan MGO: Modify/CRUD","Pengguna biasa: Read & Execute"],
            "scope":"Pemeriksaan hanya membaca izin folder/induk; tidak membuat folder, mengubah ACL, atau mendaftarkan lokasi pada layanan. Izin SMB dan seluruh isi belum diverifikasi."}),
        )
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("Pemeriksaan izin folder memerlukan Windows.".into())
    }
}

#[cfg(test)]
mod folder_plan_tests {
    use super::candidate_folder;
    #[test]
    fn candidate_rejects_drive_roots_namespaces_and_traversal() {
        for path in [
            "D:",
            r"D:\",
            r"D:\..\secret",
            r"\\DEV\D\Indoor",
            r"\\?\D:\Indoor",
            r"D:\x:stream",
            r"D:\CON",
        ] {
            assert!(candidate_folder(path).is_err(), "{path}");
        }
        assert_eq!(
            candidate_folder(r"D:\Indoor").unwrap(),
            std::path::PathBuf::from(r"D:\Indoor")
        );
        assert!(candidate_folder(r"D:\Produksi\Outdoor").is_ok());
    }
}

#[tauri::command]
pub async fn activate_folder_protection(
    app: tauri::AppHandle,
    path: String,
    label: String,
) -> Result<Value, String> {
    use tauri::Manager;
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move||{
        let plan=plan_candidate(&path)?;
        if plan["can_activate"]!=true {return Err(format!("Folder belum dapat diaktifkan: {}",plan["blockers"]));}
        #[cfg(windows)] {
            use crate::folder_protection::{admin::ActivationRequest,windows as win};
            use std::{fs,io::Write,time::{SystemTime,UNIX_EPOCH}};
            use windows_sys::Win32::{System::Threading::{WaitForSingleObject,GetExitCodeProcess},UI::{Shell::{ShellExecuteExW,SHELLEXECUTEINFOW,SEE_MASK_NOCLOSEPROCESS},WindowsAndMessaging::SW_HIDE}};
            let root=std::path::PathBuf::from(plan["path"].as_str().ok_or("Missing folder path")?);
            let request=ActivationRequest{label:if label.trim().is_empty(){root.file_name().ok_or("Missing name")?.to_string_lossy().into_owned()}else{label},path:root,file_id:plan["file_id"].as_str().ok_or("Missing identity")?.into(),sddl:plan["sddl"].as_str().ok_or("Missing ACL")?.into(),parent_sddl:plan["parent_sddl"].as_str().ok_or("Missing parent ACL")?.into(),operator_sid:win::process_sid().map_err(|e|e.to_string())?};
            fs::create_dir_all(&cache).map_err(|e|e.to_string())?;
            let request_path=cache.join(format!("folder-activation-{}-{}.json",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos()));
            let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&request_path).map_err(|e|e.to_string())?;
            file.write_all(&serde_json::to_vec(&request).map_err(|e|e.to_string())?).and_then(|_|file.sync_all()).map_err(|e|e.to_string())?;drop(file);
            let result=(||{
                let launcher=win::known_folder(&windows_sys::Win32::UI::Shell::FOLDERID_ProgramFiles).map_err(|e|e.to_string())?.join("MgoFolderProtection").join("activate_folder_protection.ps1");
                let windows=std::env::var_os("SystemRoot").ok_or("Missing Windows path")?;
                let powershell=std::path::PathBuf::from(windows).join(r"System32\WindowsPowerShell\v1.0\powershell.exe");
                let parameters=format!("-NoProfile -NonInteractive -File \"{}\" -RequestFile \"{}\"",launcher.display(),request_path.display());
                let verb=win::wide(std::ffi::OsStr::new("runas"));let exe=win::wide(powershell.as_os_str());let params=win::wide(std::ffi::OsStr::new(&parameters));
                let mut info:SHELLEXECUTEINFOW=unsafe{std::mem::zeroed()};info.cbSize=std::mem::size_of_val(&info)as u32;info.fMask=SEE_MASK_NOCLOSEPROCESS;info.lpVerb=verb.as_ptr();info.lpFile=exe.as_ptr();info.lpParameters=params.as_ptr();info.nShow=SW_HIDE;
                unsafe{win::checked(ShellExecuteExW(&mut info)).map_err(|e|format!("UAC dibatalkan atau gagal: {e}"))?;}
                let process=win::Handle(info.hProcess);
                if process.0.is_null(){return Err("Administrator process was not started".into());}
                let wait=unsafe{WaitForSingleObject(process.0,600_000)};
                if wait!=0{return Err("Aktivasi masih berjalan atau waktu tunggu habis. Periksa status folder sebelum mencoba lagi.".into());}
                let mut code=1;unsafe{win::checked(GetExitCodeProcess(process.0,&mut code)).map_err(|e|e.to_string())?;}
                if code!=0{return Err("Aktivasi tidak selesai. Periksa pesan administrator; izin dipulihkan bila tahap aktivasi gagal.".into());}
                Ok(serde_json::json!({"success":true,"message":"Folder terdaftar pada layanan. Atur Path Folder Produksi ke lokasi ini untuk CRUD MGO."}))
            })();
            let _=fs::remove_file(&request_path);result
        }
        #[cfg(not(windows))] {let _=(cache,label);Err("Aktivasi memerlukan Windows".into())}
    }).await.map_err(|e|e.to_string())?
}
