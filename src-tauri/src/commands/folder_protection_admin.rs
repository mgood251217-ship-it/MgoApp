//! Explicit elevated activation. No service request can call these administrator operations.
use crate::folder_protection as fp;
use fp::{
    broker::Config,
    mapping::Registration,
    registry::{local_root, trusted_json, Catalog, RootSpec},
    windows as win,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use windows_service::{
    service::{ServiceAccess, ServiceState},
    service_manager::{ServiceManager, ServiceManagerAccess},
};
use windows_sys::Win32::{Storage::FileSystem::*, UI::WindowsAndMessaging::*};

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActivationRequest {
    pub path: PathBuf,
    pub label: String,
    pub file_id: String,
    pub sddl: String,
    pub parent_sddl: String,
    pub operator_sid: String,
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct ObjectSnapshot {
    pub path: String,
    pub directory: bool,
    pub file_id: String,
    pub sddl: String,
    pub names: Vec<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TreeSnapshot {
    pub schema: u32,
    pub root: PathBuf,
    pub root_id: String,
    pub file_id: String,
    pub objects: Vec<ObjectSnapshot>,
    pub sacl_changed: bool,
}
struct Node {
    file: File,
    snapshot: ObjectSnapshot,
}
struct AdminLock {
    file: Option<File>,
    path: PathBuf,
}
impl Drop for AdminLock {
    fn drop(&mut self) {
        drop(self.file.take());
        let _ = fs::remove_file(&self.path);
    }
}
fn io<T>(v: std::io::Result<T>) -> Result<T, String> {
    v.map_err(|e| e.to_string())
}
fn machine_state() -> Result<PathBuf, String> {
    Ok(io(win::known_folder(
        &windows_sys::Win32::UI::Shell::FOLDERID_ProgramData,
    ))?
    .join("MgoFolderProtection"))
}
pub fn message(title: &str, text: &str, error: bool) {
    let title = win::wide(std::ffi::OsStr::new(title));
    let text = win::wide(std::ffi::OsStr::new(text));
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            MB_OK
                | if error {
                    MB_ICONERROR
                } else {
                    MB_ICONINFORMATION
                },
        );
    }
}
fn confirm(text: &str) -> bool {
    let title = win::wide(std::ffi::OsStr::new("MGO - Persetujuan izin folder"));
    let text = win::wide(std::ffi::OsStr::new(text));
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            text.as_ptr(),
            title.as_ptr(),
            MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2 | MB_SETFOREGROUND,
        ) == IDYES
    }
}
fn private_write(path: &Path, value: &Value, sid: &str) -> Result<(), String> {
    let mut file = io(win::open(
        path,
        FILE_WRITE_DATA | READ_CONTROL | WRITE_DAC | WRITE_OWNER,
        CREATE_NEW,
        FILE_SHARE_READ,
    ))?;
    io(win::set_security(
        &file,
        &format!("O:BAG:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;0x1301bf;;;{sid})"),
    ))?;
    io(win::require_private(&file, sid))?;
    io(file.write_all(&serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?))?;
    io(file.sync_all())
}
fn replace_json(path: &Path, value: &Value, sid: &str) -> Result<(), String> {
    let next = path.with_extension(format!(
        "{}-{}.next",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    ));
    private_write(&next, value, sid)?;
    let pins = io(win::pin_state_for_update(path.parent().ok_or("Missing catalog parent")?))?;
    let parent = pins.last().ok_or("Missing catalog parent handle")?;
    io(win::require_private(parent, sid))?;
    let staged = io(win::open(&next, DELETE | READ_CONTROL, OPEN_EXISTING, FILE_SHARE_READ))?;
    io(win::require_private(&staged, sid))?;
    // Keep the private directory pinned against replacement, but allow child updates.
    io(win::commit(&staged, parent, path.file_name().and_then(|s| s.to_str()).ok_or("Invalid catalog name")?, true))
}
fn load_catalog(path: &Path, state: &Path, sid: &str) -> Result<Catalog, String> {
    let (value, _pins) = trusted_json(path, sid)?;
    let catalog = if value.get("roots").is_some() {
        serde_json::from_value::<Catalog>(value).map_err(|e| e.to_string())?
    } else {
        let config: Config = serde_json::from_value(value).map_err(|e| e.to_string())?;
        let file = io(win::open(
            &config.root,
            FILE_READ_ATTRIBUTES | READ_CONTROL,
            OPEN_EXISTING,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
        ))?;
        Catalog {
            schema: 4,
            state_directory: config.state_directory,
            users: config.users,
            roots: vec![RootSpec {
                id: "local".into(),
                label: "Folder utama".into(),
                path: config.root,
                file_id: io(win::file_id(&file))?,
                aliases: config.aliases,
            }],
        }
    };
    catalog.validate()?;
    if catalog.state_directory != state {
        return Err("Private state does not match managed machine location".into());
    }
    Ok(catalog)
}
fn collect(
    file: File,
    path: String,
    directory: bool,
    nodes: &mut Vec<Node>,
    depth: usize,
) -> Result<(), String> {
    if depth > 32 || nodes.len() >= 10000 {
        return Err(
            "Batas aktivasi: 10.000 objek dan 32 tingkat. Pilih folder lebih kecil.".into(),
        );
    }
    let mut names = if directory {
        io(win::list(&file))?
    } else {
        vec![]
    };
    names.sort();
    let snapshot = ObjectSnapshot {
        path: path.clone(),
        directory,
        file_id: io(win::file_id(&file))?,
        sddl: io(win::sddl(&file))?,
        names: names.clone(),
    };
    let index = nodes.len();
    nodes.push(Node { file, snapshot });
    for name in names {
        fp::validate_name(&name)?;
        let relative = if path.is_empty() {
            name.clone()
        } else {
            format!("{path}\\{name}")
        };
        match win::admin_child(&nodes[index].file, &name, true) {
            Ok(child) => collect(child, relative, true, nodes, depth + 1)?,
            Err(e) if e.raw_os_error() == Some(267) => {
                let child = io(win::admin_child(&nodes[index].file, &name, false))?;
                collect(child, relative, false, nodes, depth + 1)?;
            }
            Err(e) => {
                return Err(format!(
                    "Tutup aplikasi yang memakai folder/file ini ({relative}): {e}"
                ))
            }
        }
    }
    Ok(())
}
fn verify_namespace(nodes: &[Node]) -> Result<(), String> {
    for node in nodes {
        if io(win::file_id(&node.file))? != node.snapshot.file_id {
            return Err("Identitas objek berubah saat aktivasi".into());
        }
        if node.snapshot.directory {
            let mut names = io(win::list(&node.file))?;
            names.sort();
            if names != node.snapshot.names {
                return Err("Isi folder berubah saat aktivasi; izin akan dipulihkan. Tutup aplikasi lain lalu ulangi.".into());
            }
        }
    }
    Ok(())
}
fn restore_nodes(nodes: &[Node]) -> Vec<String> {
    let mut errors = vec![];
    for node in nodes {
        if let Err(e) = win::set_security(&node.file, &node.snapshot.sddl) {
            errors.push(format!("{}: {e}", node.snapshot.path));
        }
    }
    errors
}
fn publish(catalog: &Catalog) -> Result<(), String> {
    use windows_sys::Win32::System::Registry::*;
    let key = win::wide(std::ffi::OsStr::new(r"SOFTWARE\MGO\FolderProtection"));
    let mut handle = std::ptr::null_mut();
    let status = unsafe {
        RegCreateKeyExW(
            HKEY_LOCAL_MACHINE,
            key.as_ptr(),
            0,
            std::ptr::null(),
            0,
            KEY_SET_VALUE | KEY_WOW64_64KEY,
            std::ptr::null(),
            &mut handle,
            std::ptr::null_mut(),
        )
    };
    if status != 0 {
        return Err(format!("Registry create error {status}"));
    }
    let result = (|| {
        let roots: Vec<Registration> = catalog
            .roots
            .iter()
            .map(|r| Registration {
                root_id: r.id.clone(),
                aliases: std::iter::once(r.path.to_string_lossy().into_owned())
                    .chain(r.aliases.clone())
                    .collect(),
            })
            .collect();
        let values = [
            (
                "Roots",
                serde_json::to_string(&roots).map_err(|e| e.to_string())?,
            ),
            (
                "RootPath",
                catalog.roots[0].path.to_string_lossy().into_owned(),
            ),
            (
                "RootAliases",
                serde_json::to_string(&catalog.roots[0].aliases).map_err(|e| e.to_string())?,
            ),
        ];
        for (name, value) in values {
            let name = win::wide(std::ffi::OsStr::new(name));
            let data = win::wide(std::ffi::OsStr::new(&value));
            let status = unsafe {
                RegSetValueExW(
                    handle,
                    name.as_ptr(),
                    0,
                    REG_SZ,
                    data.as_ptr() as _,
                    (data.len() * 2) as u32,
                )
            };
            if status != 0 {
                return Err(format!("Registry write error {status}"));
            }
        }
        let name = win::wide(std::ffi::OsStr::new("ProtocolVersion"));
        let version = 4u32;
        let status = unsafe {
            RegSetValueExW(
                handle,
                name.as_ptr(),
                0,
                REG_DWORD,
                &version as *const _ as _,
                4,
            )
        };
        if status != 0 {
            return Err(format!("Registry version write error {status}"));
        }
        Ok(())
    })();
    unsafe {
        RegCloseKey(handle);
    };
    result
}
fn service() -> Result<windows_service::service::Service, String> {
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
        .map_err(|e| e.to_string())?;
    let service = manager
        .open_service(
            "MgoFolderProtection",
            ServiceAccess::STOP
                | ServiceAccess::START
                | ServiceAccess::QUERY_STATUS
                | ServiceAccess::QUERY_CONFIG,
        )
        .map_err(|e| e.to_string())?;
    let config = service.query_config().map_err(|e| e.to_string())?;
    if config
        .account_name
        .as_ref()
        .map(|s| s.to_string_lossy())
        .as_deref()
        != Some(r"NT SERVICE\MgoFolderProtection")
    {
        return Err("Service identity differs from managed service".into());
    }
    Ok(service)
}
fn stop(service: &windows_service::service::Service) -> Result<(), String> {
    if service
        .query_status()
        .map_err(|e| e.to_string())?
        .current_state
        != ServiceState::Stopped
    {
        service.stop().map_err(|e| e.to_string())?;
    }
    let end = Instant::now() + Duration::from_secs(30);
    while service
        .query_status()
        .map_err(|e| e.to_string())?
        .current_state
        != ServiceState::Stopped
    {
        if Instant::now() > end {
            return Err("Service stop timeout".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Ok(())
}
fn ready(root_id: &str) -> Result<(), String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| e.to_string())?;
    let end = Instant::now() + Duration::from_secs(15);
    loop {
        if let Ok(reply) = runtime.block_on(fp::request(fp::Request::Status)) {
            if reply.success
                && reply.data["roots"].as_array().is_some_and(|roots| {
                    roots
                        .iter()
                        .any(|r| r["id"] == root_id && r["available"] == true)
                })
            {
                return Ok(());
            }
        }
        if Instant::now() > end {
            return Err("Layanan belum siap untuk folder baru; aktivasi dibatalkan".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}
pub fn activate(request_file: &Path) -> Result<(), String> {
    if !io(win::is_admin())? {
        return Err("Aktivasi memerlukan administrator Windows melalui UAC".into());
    }
    let mut request = io(win::open(
        request_file,
        FILE_READ_DATA,
        OPEN_EXISTING,
        FILE_SHARE_READ,
    ))?;
    let mut raw = vec![];
    io(Read::by_ref(&mut request).take(65537).read_to_end(&mut raw))?;
    if raw.len() > 65536 {
        return Err("Activation request too large".into());
    }
    let request: ActivationRequest = serde_json::from_slice(&raw).map_err(|e| e.to_string())?;
    local_root(&request.path)?;
    if request.label.is_empty()
        || request.label.len() > 180
        || request.label.chars().any(char::is_control)
    {
        return Err("Invalid folder label".into());
    }
    let sid = io(win::registered_server_sid())?;
    let state = machine_state()?;
    let pins = io(win::pin_state_for_update(&state))?;
    io(win::require_private(
        pins.last().ok_or("Private state missing")?,
        &sid,
    ))?;
    let lock_path = state.join("activation.lock");
    let lock_file = io(win::open(
        &lock_path,
        FILE_WRITE_DATA | READ_CONTROL,
        CREATE_NEW,
        0,
    ))
    .map_err(|e| format!("Aktivasi lain atau pemulihan terputus perlu diperiksa: {e}"))?;
    let _lock = AdminLock {
        file: Some(lock_file),
        path: lock_path,
    };
    let config_path = state.join("service.json");
    let old = load_catalog(&config_path, &state, &sid)?;
    if !old
        .users
        .iter()
        .any(|user| user.sid == request.operator_sid && user.write)
    {
        return Err("Akun Windows operator belum mendapat izin CRUD layanan".into());
    }
    let parent = request.path.parent().ok_or("No root parent")?;
    let parent_pins = io(win::pin_directory(parent))?;
    let parent_file = parent_pins.last().ok_or("No root parent handle")?;
    io(win::require_ntfs(parent_file))?;
    if io(win::sddl(parent_file))? != request.parent_sddl {
        return Err("Izin folder induk berubah; periksa ulang folder sebelum aktivasi".into());
    }
    let mut conflicts = Vec::new();
    for file in &parent_pins {
        conflicts.extend(io(win::parent_security_conflicts(file, &sid))?);
    }
    if !conflicts.is_empty() {
        return Err(format!(
            "Izin induk belum aman. Tidak ada izin yang diubah.\n{}",
            conflicts.join("\n")
        ));
    }
    let id = format!(
        "folder-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos()
    );
    let mut catalog = old.clone();
    catalog.roots.push(RootSpec {
        id: id.clone(),
        label: request.label.clone(),
        path: request.path.clone(),
        file_id: request.file_id.clone(),
        aliases: vec![],
    });
    catalog.validate()?;
    io(win::enable_restore_privilege())?;
    let root = io(win::open(
        &request.path,
        FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | READ_CONTROL | WRITE_DAC | WRITE_OWNER,
        OPEN_EXISTING,
        FILE_SHARE_READ,
    ))?;
    if io(win::file_id(&root))? != request.file_id || io(win::sddl(&root))? != request.sddl {
        return Err("Folder/izin berubah sejak diperiksa; aktivasi dibatalkan".into());
    }
    let mut nodes = vec![];
    collect(root, String::new(), true, &mut nodes, 0)?;
    if !confirm(&format!("Aktifkan proteksi folder berikut?\n\n{}\n\n{} objek akan diubah izinnya. File tidak dihapus.\nSYSTEM dan Administrators: Full Control\nLayanan MGO: Modify/CRUD\nPengguna biasa: Read & Execute\nPemilik objek: Administrators\n\nCadangan owner/group/DACL dibuat sebelum perubahan. SACL tidak diubah.\nAkun operator: {}\n\nIzin drive induk tidak diubah.",request.path.display(),nodes.len(),request.operator_sid)){return Err("cancelled".into());}
    let snapshot = TreeSnapshot {
        schema: 1,
        root: request.path.clone(),
        root_id: id.clone(),
        file_id: request.file_id.clone(),
        objects: nodes.iter().map(|n| n.snapshot.clone()).collect(),
        sacl_changed: false,
    };
    private_write(
        &state.join(format!("activation-{id}.json")),
        &serde_json::to_value(&snapshot).map_err(|e| e.to_string())?,
        &sid,
    )?;
    let old_value = serde_json::to_value(&old).map_err(|e| e.to_string())?;
    private_write(
        &state.join(format!("catalog-before-{id}.json")),
        &old_value,
        &sid,
    )?;
    let sd = |inherit: bool| {
        format!(
            "O:BAG:BAD:P(A;{};FA;;;SY)(A;{};FA;;;BA)(A;{};0x1301bf;;;{})(A;{};0x1200a9;;;AU)",
            if inherit { "OICI" } else { "" },
            if inherit { "OICI" } else { "" },
            if inherit { "OICI" } else { "" },
            sid,
            if inherit { "OICI" } else { "" }
        )
    };
    let service = service()?;
    let mut changed = false;
    let mut config_changed = false;
    let mut backup_changed = false;
    let result: Result<(), String> = (|| {
        changed = true;
        for node in nodes.iter().filter(|n| n.snapshot.directory) {
            io(win::set_security(&node.file, &sd(false))).map_err(|e| {
                format!("Mengatur izin awal folder '{}': {e}", node.snapshot.path)
            })?;
        }
        verify_namespace(&nodes).map_err(|e| format!("Verifikasi isi setelah izin awal: {e}"))?;
        for node in nodes.iter().filter(|n| !n.snapshot.directory) {
            io(win::set_security(&node.file, &sd(false))).map_err(|e| {
                format!("Mengatur izin file '{}': {e}", node.snapshot.path)
            })?;
        }
        for node in nodes.iter().filter(|n| n.snapshot.directory) {
            io(win::set_security(&node.file, &sd(true))).map_err(|e| {
                format!("Mengaktifkan warisan izin folder '{}': {e}", node.snapshot.path)
            })?;
        }
        for node in &nodes {
            io(win::require_private(&node.file, &sid)).map_err(|e| {
                format!("Memverifikasi izin objek '{}': {e}", node.snapshot.path)
            })?;
        }
        verify_namespace(&nodes).map_err(|e| format!("Verifikasi akhir isi folder: {e}"))?;
        // Release read-only migration locks before the service opens its writable root.
        drop(std::mem::take(&mut nodes));
        drop(parent_pins);
        stop(&service).map_err(|e| format!("Menghentikan layanan sebelum memperbarui katalog: {e}"))?;
        replace_json(
            &config_path,
            &serde_json::to_value(&catalog).map_err(|e| e.to_string())?,
            &sid,
        )
        .map_err(|e| format!("Memperbarui katalog utama: {e}"))?;
        config_changed = true;
        service
            .start::<&str>(&[])
            .map_err(|e| format!("Menyalakan layanan dengan katalog baru: {e}"))?;
        ready(&id).map_err(|e| format!("Memverifikasi root baru pada layanan: {e}"))?;
        publish(&catalog).map_err(|e| format!("Menerbitkan katalog ke registry: {e}"))?;
        stop(&service).map_err(|e| format!("Menghentikan layanan sebelum memperbarui cadangan: {e}"))?;
        replace_json(
            &state.join("service.backup.json"),
            &serde_json::to_value(&catalog).map_err(|e| e.to_string())?,
            &sid,
        )
        .map_err(|e| format!("Memperbarui katalog cadangan: {e}"))?;
        backup_changed = true;
        service
            .start::<&str>(&[])
            .map_err(|e| format!("Menyalakan layanan setelah memperbarui cadangan: {e}"))?;
        ready(&id).map_err(|e| format!("Verifikasi akhir layanan: {e}"))?;
        Ok(())
    })();
    if let Err(error) = result {
        let mut failures = vec![];
        if config_changed {
            if let Err(e) = stop(&service) {
                failures.push(e);
            }
            if let Err(e) = replace_json(&config_path, &old_value, &sid) {
                failures.push(e);
            }
            if backup_changed {
                if let Err(e) = replace_json(&state.join("service.backup.json"), &old_value, &sid) {
                    failures.push(format!("Pemulihan katalog cadangan gagal: {e}"));
                }
            }
            if let Err(e) = publish(&old) {
                failures.push(e);
            }
        }
        if changed {
            if nodes.is_empty() {
                match win::open(
                    &request.path,
                    FILE_LIST_DIRECTORY | READ_CONTROL | WRITE_DAC | WRITE_OWNER,
                    OPEN_EXISTING,
                    FILE_SHARE_READ,
                ) {
                    Ok(file) => {
                        let mut reopened = vec![];
                        if let Err(e) = collect(file, String::new(), true, &mut reopened, 0) {
                            failures.push(e);
                        } else {
                            for original in &snapshot.objects {
                                if let Some(node) = reopened
                                    .iter()
                                    .find(|n| n.snapshot.file_id == original.file_id)
                                {
                                    if let Err(e) = win::set_security(&node.file, &original.sddl) {
                                        failures.push(e.to_string());
                                    }
                                } else {
                                    failures.push(format!(
                                        "Objek tidak ditemukan untuk pemulihan: {}",
                                        original.path
                                    ));
                                }
                            }
                        }
                    }
                    Err(e) => failures.push(e.to_string()),
                }
            } else {
                failures.extend(restore_nodes(&nodes));
            }
        }
        let _ = service.start::<&str>(&[]);
        return Err(format!(
            "Aktivasi gagal: {error}. Pemulihan: {}. Cadangan: {}",
            if failures.is_empty() {
                "selesai".into()
            } else {
                failures.join("; ")
            },
            state.join(format!("activation-{id}.json")).display()
        ));
    }
    Ok(())
}
