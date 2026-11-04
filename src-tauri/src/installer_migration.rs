//! Installer-only migration. Runs before Tauri/WebView starts, without PowerShell.
use std::{
    ffi::OsStr,
    fs::{self, File, OpenOptions},
    io::{self, Write},
    os::windows::{
        ffi::OsStrExt,
        fs::{MetadataExt, OpenOptionsExt},
    },
    path::{Component, Path, PathBuf, Prefix},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use windows::{
    core::{Interface, PCWSTR},
    Win32::{
        Foundation::{CloseHandle, GetLastError, ERROR_NOT_ALL_ASSIGNED, HANDLE, LUID},
        Security::{
            AdjustTokenPrivileges, GetTokenInformation, LookupPrivilegeValueW, TokenElevation,
            SE_BACKUP_NAME, SE_PRIVILEGE_ENABLED, SE_RESTORE_NAME, TOKEN_ADJUST_PRIVILEGES,
            TOKEN_ELEVATION, TOKEN_PRIVILEGES, TOKEN_QUERY,
        },
        Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW},
        System::{
            Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IPersistFile,
                CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, STGM_READ,
            },
            Environment::ExpandEnvironmentStringsW,
            Registry::{RegLoadKeyW, RegUnLoadKeyW, HKEY_USERS as NATIVE_USERS},
            Threading::{GetCurrentProcess, OpenProcessToken},
        },
        UI::Shell::{
            FOLDERID_ProgramData, IShellLinkW, SHGetKnownFolderPath, ShellLink, KF_FLAG_DEFAULT,
            SLGP_RAWPATH,
        },
    },
};
use winreg::{enums::*, RegKey};

type Result<T> = std::result::Result<T, String>;
const EXECUTABLES: [&str; 2] = ["mgo-desktop.exe", "MgoDesktop.exe"];
const UNINSTALL_KEYS: [&str; 2] = [
    r"Software\Microsoft\Windows\CurrentVersion\Uninstall\MgoDesktop",
    r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\MgoDesktop",
];
const SHELL_FOLDERS: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders";

fn wide(value: impl AsRef<OsStr>) -> Vec<u16> {
    value.as_ref().encode_wide().chain(Some(0)).collect()
}
fn error_at(path: &Path, error: impl std::fmt::Display) -> String {
    format!("{}: {error}", path.display())
}
fn same_path(left: &Path, right: &Path) -> bool {
    left.as_os_str()
        .to_string_lossy()
        .eq_ignore_ascii_case(&right.as_os_str().to_string_lossy())
}
fn local_path(value: &str) -> Result<PathBuf> {
    let value = value.trim().trim_matches('"');
    if value.contains('%') {
        return Err(format!("Lokasi MGO belum dapat diselesaikan: {value}"));
    }
    let mut parts = Path::new(value).components();
    if !matches!(parts.next(), Some(Component::Prefix(p)) if matches!(p.kind(), Prefix::Disk(_)))
        || !matches!(parts.next(), Some(Component::RootDir))
    {
        return Err(format!("Lokasi MGO harus berupa path drive lokal: {value}"));
    }
    let mut path = PathBuf::from(&value[..3]);
    for part in parts {
        match part {
            Component::Normal(name) => {
                let text = name.to_string_lossy();
                if text.ends_with(['.', ' ']) || text.contains(':') {
                    return Err(format!("Lokasi MGO tidak didukung: {value}"));
                }
                path.push(name);
            }
            Component::CurDir => (),
            Component::ParentDir if path.parent().is_some() => {
                path.pop();
            }
            _ => return Err(format!("Lokasi MGO tidak didukung: {value}")),
        }
    }
    Ok(path)
}
fn no_reparse(path: &Path) -> Result<()> {
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(meta) if meta.file_attributes() & 0x400 != 0 => {
                return Err(format!(
                    "Migrasi menolak junction/symlink: {}",
                    ancestor.display()
                ));
            }
            Ok(_) => (),
            Err(e) if e.kind() == io::ErrorKind::NotFound => (),
            Err(e) => return Err(error_at(ancestor, e)),
        }
    }
    Ok(())
}
fn exists(path: &Path) -> Result<bool> {
    path.try_exists().map_err(|e| error_at(path, e))
}
fn optional_key(hive: &RegKey, path: &str, flags: u32) -> Result<Option<RegKey>> {
    match hive.open_subkey_with_flags(path, flags) {
        Ok(key) => Ok(Some(key)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Registry {path}: {e}")),
    }
}
fn value(key: &RegKey, name: &str) -> Result<Option<String>> {
    match key.get_value(name) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Registry {name}: {e}")),
    }
}
fn shell_value(hive: &RegKey, name: &str) -> Result<Option<String>> {
    match optional_key(hive, SHELL_FOLDERS, KEY_READ)? {
        Some(key) => value(&key, name),
        None => Ok(None),
    }
}
fn profile_value(value: &str, profile: &Path) -> String {
    // Never expand another user's USERPROFILE/APPDATA using the installer account.
    let pattern = regex::Regex::new(r"(?i)%(USERPROFILE|APPDATA)%").unwrap();
    pattern
        .replace_all(value, |capture: &regex::Captures<'_>| {
            if capture[1].eq_ignore_ascii_case("APPDATA") {
                profile
                    .join(r"AppData\Roaming")
                    .to_string_lossy()
                    .into_owned()
            } else {
                profile.to_string_lossy().into_owned()
            }
        })
        .into_owned()
}

fn with_token<T>(action: impl FnOnce(HANDLE) -> Result<T>) -> Result<T> {
    let mut token = HANDLE::default();
    // SAFETY: all API output buffers and handles remain live for each call.
    unsafe {
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY | TOKEN_ADJUST_PRIVILEGES,
            &mut token,
        )
    }
    .map_err(|e| e.to_string())?;
    let result = action(token);
    unsafe {
        let _ = CloseHandle(token);
    }
    result
}
fn require_admin() -> Result<()> {
    with_token(|token| {
        let mut elevation = TOKEN_ELEVATION::default();
        let mut size = 0;
        unsafe {
            GetTokenInformation(
                token,
                TokenElevation,
                Some((&mut elevation as *mut TOKEN_ELEVATION).cast()),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut size,
            )
        }
        .map_err(|e| e.to_string())?;
        if elevation.TokenIsElevated == 0 {
            return Err("Jalankan installer dengan izin administrator Windows.".into());
        }
        Ok(())
    })
}
fn enable_hive_privileges() -> Result<()> {
    with_token(|token| {
        for name in [SE_BACKUP_NAME, SE_RESTORE_NAME] {
            let mut luid = LUID::default();
            unsafe { LookupPrivilegeValueW(None, name, &mut luid) }.map_err(|e| e.to_string())?;
            let mut privileges = TOKEN_PRIVILEGES::default();
            privileges.PrivilegeCount = 1;
            privileges.Privileges[0].Luid = luid;
            privileges.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
            unsafe { AdjustTokenPrivileges(token, false, Some(&privileges), 0, None, None) }
                .map_err(|e| e.to_string())?;
            if unsafe { GetLastError() } == ERROR_NOT_ALL_ASSIGNED {
                return Err(
                    "Akun administrator tidak memiliki hak memeriksa registry profil Windows lain."
                        .into(),
                );
            }
        }
        Ok(())
    })
}

struct ProfileHive {
    key: Option<RegKey>,
    mount: Option<String>,
}
impl ProfileHive {
    fn open(sid: &str, profile: &Path, apply: bool) -> Result<Option<Self>> {
        let users = RegKey::predef(HKEY_USERS);
        let flags = if apply {
            KEY_READ | KEY_WRITE
        } else {
            KEY_READ
        };
        if let Some(key) = optional_key(&users, sid, flags)? {
            return Ok(Some(Self {
                key: Some(key),
                mount: None,
            }));
        }
        let file = profile.join("NTUSER.DAT");
        if !exists(&file)? {
            if exists(&profile.join(r"AppData\Local\MgoDesktop"))? {
                return Err(
                    "Folder MGO lama ditemukan tetapi NTUSER.DAT profil tidak tersedia.".into(),
                );
            }
            return Ok(None);
        }
        no_reparse(&file)?;
        enable_hive_privileges()?;
        let mount = format!(
            "MgoMigration_{}_{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let status = unsafe {
            RegLoadKeyW(
                NATIVE_USERS,
                PCWSTR(wide(&mount).as_ptr()),
                PCWSTR(wide(&file).as_ptr()),
            )
        };
        if let Err(e) = status.ok() {
            // A simultaneous sign-in may have loaded the hive after our first check.
            if let Some(key) = optional_key(&users, sid, flags)? {
                return Ok(Some(Self {
                    key: Some(key),
                    mount: None,
                }));
            }
            return Err(format!("Registry profil belum dapat diperiksa: {e}. Keluar dari sesi akun ini (Sign out), lalu ulangi installer."));
        }
        let mut hive = Self {
            key: None,
            mount: Some(mount.clone()),
        };
        hive.key = optional_key(&users, &mount, flags)?;
        if hive.key.is_none() {
            return Err("Registry profil yang dimuat tidak tersedia.".into());
        }
        Ok(Some(hive))
    }
    fn close(&mut self) -> Result<()> {
        drop(self.key.take());
        if let Some(mount) = &self.mount {
            for attempt in 0..3 {
                let status = unsafe { RegUnLoadKeyW(NATIVE_USERS, PCWSTR(wide(mount).as_ptr())) };
                if status.is_ok() {
                    self.mount = None;
                    return Ok(());
                }
                if attempt == 2 {
                    return Err(format!(
                        "Registry sementara {mount} belum dapat dilepas: {}",
                        io::Error::from_raw_os_error(status.0 as i32)
                    ));
                }
                thread::sleep(Duration::from_millis(250));
            }
        }
        Ok(())
    }
}
impl Drop for ProfileHive {
    fn drop(&mut self) {
        let _ = self.close();
    }
}

fn executable_identity(path: &Path) -> Result<()> {
    no_reparse(path)?;
    let name = wide(path);
    let size = unsafe { GetFileVersionInfoSizeW(PCWSTR(name.as_ptr()), None) };
    if size == 0 {
        return Err(format!(
            "Identitas executable tidak tersedia; tidak dihapus: {}",
            path.display()
        ));
    }
    let mut data = vec![0u32; (size as usize).div_ceil(4)];
    unsafe { GetFileVersionInfoW(PCWSTR(name.as_ptr()), None, size, data.as_mut_ptr().cast()) }
        .map_err(|e| error_at(path, e))?;
    let query = |key: &str| {
        let mut pointer = std::ptr::null_mut();
        let mut length = 0;
        let found = unsafe {
            VerQueryValueW(
                data.as_ptr().cast(),
                PCWSTR(wide(key).as_ptr()),
                &mut pointer,
                &mut length,
            )
        }
        .as_bool();
        if found && !pointer.is_null() {
            Some((pointer, length))
        } else {
            None
        }
    };
    if let Some((translations, length)) = query(r"\VarFileInfo\Translation") {
        let translations =
            unsafe { std::slice::from_raw_parts(translations.cast::<u16>(), length as usize / 2) };
        for pair in translations.chunks_exact(2) {
            let field = |name: &str| -> Option<String> {
                let (pointer, length) = query(&format!(
                    r"\StringFileInfo\{:04x}{:04x}\{name}",
                    pair[0], pair[1]
                ))?;
                let chars =
                    unsafe { std::slice::from_raw_parts(pointer.cast::<u16>(), length as usize) };
                Some(
                    String::from_utf16_lossy(chars)
                        .trim_end_matches('\0')
                        .into(),
                )
            };
            if field("ProductName").as_deref() == Some("MgoDesktop")
                && field("CompanyName").as_deref() == Some("Viki Alvian Riyadi")
            {
                return Ok(());
            }
        }
    }
    Err(format!(
        "Identitas executable tidak sesuai; tidak dihapus: {}",
        path.display()
    ))
}
fn unlocked(path: &Path) -> Result<()> {
    for attempt in 0..4 {
        match OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0)
            .open(path)
        {
            Ok(_) => return Ok(()),
            Err(e) if matches!(e.raw_os_error(), Some(32 | 33)) => {
                if attempt == 3 {
                    return Err(format!("File MGO lama masih digunakan: {}. Tutup MGO pada semua akun Windows lalu coba lagi.", path.display()));
                }
                thread::sleep(Duration::from_millis(500));
            }
            Err(e) => return Err(error_at(path, e)),
        }
    }
    unreachable!()
}

struct Plan {
    directory: PathBuf,
    executables: Vec<PathBuf>,
    uninstaller: Option<PathBuf>,
    keys: Vec<&'static str>,
}
fn plan(hive: &RegKey, profile: &Path) -> Result<Plan> {
    let local = match shell_value(hive, "Local AppData")? {
        Some(text) => local_path(&profile_value(&text, profile))?,
        None => profile.join(r"AppData\Local"),
    };
    let directory = local.join("MgoDesktop");
    no_reparse(&directory)?;
    let mut keys = Vec::new();
    for name in UNINSTALL_KEYS {
        if let Some(key) = optional_key(hive, name, KEY_READ)? {
            if value(&key, "DisplayName")?.as_deref() != Some("MgoDesktop")
                || value(&key, "Publisher")?.as_deref() != Some("Viki Alvian Riyadi")
            {
                return Err("Entri aplikasi lama tidak dikenal; migrasi dihentikan.".into());
            }
            let location = match value(&key, "InstallLocation")?.filter(|text| !text.is_empty()) {
                Some(text) => local_path(&text)?,
                None => {
                    let command = value(&key, "UninstallString")?.unwrap_or_default();
                    if !same_path(&local_path(&command)?, &directory.join("uninstall.exe")) {
                        return Err("Lokasi uninstaller lama perlu ditinjau.".into());
                    }
                    directory.clone()
                }
            };
            if !same_path(&location, &directory) {
                return Err(format!(
                    "Instalasi lama di lokasi khusus perlu dimigrasikan terlebih dahulu: {}",
                    location.display()
                ));
            }
            keys.push(name);
        }
    }
    let mut executables = Vec::new();
    for name in EXECUTABLES {
        let exe = directory.join(name);
        if exists(&exe)? {
            no_reparse(&exe)?;
            unlocked(&exe)?;
            executable_identity(&exe)?;
            executables.push(exe);
        }
    }
    let uninstaller = directory.join("uninstall.exe");
    let uninstaller = if (!executables.is_empty() || !keys.is_empty()) && exists(&uninstaller)? {
        no_reparse(&uninstaller)?;
        unlocked(&uninstaller)?;
        Some(uninstaller)
    } else {
        None
    };
    Ok(Plan {
        directory,
        executables,
        uninstaller,
        keys,
    })
}

struct Log(File);
impl Log {
    fn write(&mut self, text: impl AsRef<str>) {
        let _ = writeln!(self.0, "{}", text.as_ref());
    }
}
struct Com;
impl Com {
    fn new() -> Result<Self> {
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }
            .ok()
            .map_err(|e| e.to_string())?;
        Ok(Self)
    }
}
impl Drop for Com {
    fn drop(&mut self) {
        unsafe {
            CoUninitialize();
        }
    }
}
fn shortcut_target(path: &Path) -> windows::core::Result<PathBuf> {
    let link: IShellLinkW = unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }?;
    let file: IPersistFile = link.cast()?;
    unsafe { file.Load(PCWSTR(wide(path).as_ptr()), STGM_READ) }?;
    let mut target = vec![0u16; 32768];
    unsafe { link.GetPath(&mut target, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32) }?;
    let length = target
        .iter()
        .position(|ch| *ch == 0)
        .unwrap_or(target.len());
    Ok(PathBuf::from(String::from_utf16_lossy(&target[..length])))
}
fn old_shortcuts(hive: &RegKey, profile: &Path, old: &Plan, log: &mut Log) -> Vec<PathBuf> {
    let mut pending = vec![
        profile.join("Desktop"),
        profile.join(r"AppData\Roaming\Microsoft\Windows\Start Menu\Programs"),
        profile
            .join(r"AppData\Roaming\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"),
    ];
    for name in ["Desktop", "Programs"] {
        match shell_value(hive, name).and_then(|text| {
            text.map(|v| local_path(&profile_value(&v, profile)))
                .transpose()
        }) {
            Ok(Some(path)) => pending.push(path),
            Err(e) => log.write(format!("Lewati lokasi shortcut {name}: {e}")),
            _ => (),
        }
    }
    let mut visited = std::collections::HashSet::new();
    let mut shortcuts = Vec::new();
    while let Some(directory) = pending.pop() {
        if !visited.insert(directory.to_string_lossy().to_lowercase()) {
            continue;
        }
        let entries = match no_reparse(&directory)
            .and_then(|_| fs::read_dir(&directory).map_err(|e| error_at(&directory, e)))
        {
            Ok(entries) => entries,
            Err(e) => {
                log.write(format!("Lokasi shortcut dilewati: {e}"));
                continue;
            }
        };
        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(e) => {
                    log.write(e.to_string());
                    continue;
                }
            };
            let path = entry.path();
            if no_reparse(&path).is_err() {
                continue;
            }
            let kind = match entry.file_type() {
                Ok(kind) => kind,
                Err(_) => continue,
            };
            if kind.is_dir() {
                pending.push(path);
                continue;
            }
            if !path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
            {
                continue;
            }
            match shortcut_target(&path) {
                Ok(target)
                    if EXECUTABLES
                        .iter()
                        .chain(["uninstall.exe"].iter())
                        .any(|name| same_path(&target, &old.directory.join(name))) =>
                {
                    shortcuts.push(path)
                }
                Err(e) => log.write(format!("Shortcut dilewati: {}: {e}", path.display())),
                _ => (),
            }
        }
    }
    shortcuts
}
fn migrate_profile(
    hive: &RegKey,
    profile: &Path,
    destination: &Path,
    apply: bool,
    log: &mut Log,
) -> Result<()> {
    let old = plan(hive, profile)?;
    if old.executables.is_empty() && old.keys.is_empty() {
        return Ok(());
    }
    if same_path(&old.directory, destination) {
        return Err(
            "Lokasi aplikasi per pengguna menunjuk instalasi bersama; tidak dihapus.".into(),
        );
    }
    log.write(format!("Instalasi lama: {}", old.directory.display()));
    if !apply {
        return Ok(());
    }
    executable_identity(&destination.join("mgo-desktop.exe"))?;
    let shortcuts = old_shortcuts(hive, profile, &old, log);
    // Only exact, validated launchers. No recursive directory deletion and no elevated
    // execution of a user-writable uninstaller. Settings and user data stay in place.
    for exe in &old.executables {
        executable_identity(exe)?;
        fs::remove_file(exe).map_err(|e| error_at(exe, e))?;
    }
    if let Some(path) = &old.uninstaller {
        no_reparse(path)?;
        fs::remove_file(path).map_err(|e| error_at(path, e))?;
    }
    for shortcut in shortcuts {
        if let Err(e) = no_reparse(&shortcut)
            .and_then(|_| fs::remove_file(&shortcut).map_err(|e| error_at(&shortcut, e)))
        {
            log.write(format!("Shortcut lama belum dapat dihapus: {e}"));
        }
    }
    for name in &old.keys {
        hive.delete_subkey_all(name)
            .map_err(|e| format!("Registry {name}: {e}"))?;
    }
    for name in [
        r"Software\Viki Alvian Riyadi\MgoDesktop",
        r"Software\WOW6432Node\Viki Alvian Riyadi\MgoDesktop",
    ] {
        if let Some(key) = optional_key(hive, name, KEY_READ | KEY_WRITE)? {
            if let Some(path) = value(&key, "")? {
                if same_path(&local_path(&path)?, &old.directory) {
                    key.delete_value("").map_err(|e| e.to_string())?;
                }
            }
        }
    }
    if let Some(run) = optional_key(
        hive,
        r"Software\Microsoft\Windows\CurrentVersion\Run",
        KEY_READ | KEY_WRITE,
    )? {
        if let Some(command) = value(&run, "MgoDesktop")? {
            for name in EXECUTABLES {
                let path = old.directory.join(name).to_string_lossy().into_owned();
                let pattern = regex::Regex::new(&format!(
                    r#"(?i)^(?:"{}"|{})(?P<args>\s.*)?$"#,
                    regex::escape(&path),
                    regex::escape(&path)
                ))
                .unwrap();
                if let Some(capture) = pattern.captures(&command) {
                    let arguments = capture.name("args").map_or("", |m| m.as_str());
                    run.set_value(
                        "MgoDesktop",
                        &format!(
                            "\"{}\"{arguments}",
                            destination.join("mgo-desktop.exe").display()
                        ),
                    )
                    .map_err(|e| e.to_string())?;
                    break;
                }
            }
        }
    }
    let remaining = plan(hive, profile)?;
    if !remaining.executables.is_empty() || !remaining.keys.is_empty() {
        return Err("Migrasi instalasi lama belum selesai.".into());
    }
    log.write("Migrasi selesai. Pengaturan dan data pengguna dipertahankan.");
    Ok(())
}
fn program_data() -> Result<PathBuf> {
    let pointer = unsafe { SHGetKnownFolderPath(&FOLDERID_ProgramData, KF_FLAG_DEFAULT, None) }
        .map_err(|e| e.to_string())?;
    let path = unsafe { pointer.to_string() }
        .map(PathBuf::from)
        .map_err(|e| e.to_string());
    unsafe {
        CoTaskMemFree(Some(pointer.0.cast()));
    }
    path
}
fn expand_system(value: &str) -> Result<String> {
    let text = wide(value);
    let size = unsafe { ExpandEnvironmentStringsW(PCWSTR(text.as_ptr()), None) };
    if size == 0 {
        return Err(io::Error::last_os_error().to_string());
    }
    let mut output = vec![0u16; size as usize];
    let written = unsafe { ExpandEnvironmentStringsW(PCWSTR(text.as_ptr()), Some(&mut output)) };
    if written == 0 || written > size {
        return Err("Lokasi profil Windows tidak dapat diselesaikan.".into());
    }
    Ok(String::from_utf16_lossy(&output[..written as usize - 1]))
}
fn migrate(mode: &str, destination: &Path, log: &mut Log) -> Result<()> {
    require_admin()?;
    if !same_path(destination, &program_data()?.join("MgoDesktop")) {
        return Err("Tujuan instalasi harus ProgramData\\MgoDesktop.".into());
    }
    no_reparse(destination)?;
    let _com = Com::new()?;
    let list = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(
            r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList",
            KEY_READ | KEY_WOW64_64KEY,
        )
        .map_err(|e| e.to_string())?;
    let sid_pattern = regex::Regex::new(r"^S-1-(5-21|12-1)-[0-9-]+$").unwrap();
    for sid in list.enum_keys() {
        let sid = sid.map_err(|e| e.to_string())?;
        if !sid_pattern.is_match(&sid) {
            continue;
        }
        let record = list.open_subkey(&sid).map_err(|e| e.to_string())?;
        let path: String = record
            .get_value("ProfileImagePath")
            .map_err(|e| e.to_string())?;
        let profile = local_path(&expand_system(&path)?)?;
        if !exists(&profile)? {
            continue;
        }
        no_reparse(&profile)?;
        log.write(format!("Memeriksa profil: {} ({mode})", profile.display()));
        let result = (|| {
            if let Some(mut hive) = ProfileHive::open(&sid, &profile, mode == "Apply")? {
                let result = migrate_profile(
                    hive.key.as_ref().unwrap(),
                    &profile,
                    destination,
                    mode == "Apply",
                    log,
                );
                let close = hive.close();
                result?;
                close?;
            }
            Ok(())
        })();
        result.map_err(|e: String| format!("Profil {}: {e}", profile.display()))?;
    }
    log.write(format!("Pemeriksaan/migrasi {mode} selesai."));
    Ok(())
}
fn write_error(path: &Path, message: &str) {
    let mut bytes = vec![0xff, 0xfe];
    for ch in message.replace(['\r', '\n'], " ").encode_utf16() {
        bytes.extend(ch.to_le_bytes());
    }
    let _ = fs::write(path, bytes);
}
pub fn run_if_requested() -> Option<i32> {
    let arguments: Vec<_> = std::env::args_os().collect();
    if arguments
        .get(1)
        .is_none_or(|arg| arg != "--mgo-installer-migrate")
    {
        return None;
    }
    if arguments.len() != 6 {
        return Some(2);
    }
    let error_file = Path::new(&arguments[5]);
    let result = (|| {
        let mode = arguments[2].to_str().ok_or("Mode migrasi tidak valid.")?;
        if !matches!(mode, "Check" | "Apply") {
            return Err("Mode migrasi tidak valid.".into());
        }
        // Validate elevation before opening any caller-supplied log file.
        require_admin()?;
        let destination = local_path(&arguments[3].to_string_lossy())?;
        let mut log = Log(File::create(&arguments[4]).map_err(|e| e.to_string())?);
        log.write(format!("Migrasi MGO native: {mode}"));
        let result = migrate(mode, &destination, &mut log);
        if let Err(message) = &result {
            log.write(message);
        }
        result
    })();
    Some(match result {
        Ok(()) => 0,
        Err(message) => {
            write_error(error_file, &message);
            1
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture {
        root: PathBuf,
        registry: String,
        hive: RegKey,
    }
    impl Fixture {
        fn new() -> Self {
            let name = format!(
                "MgoMigrationTest_{}_{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            );
            let root = std::env::temp_dir().join(&name);
            fs::create_dir(&root).unwrap();
            let registry = format!(r"Software\{name}");
            let (hive, _) = RegKey::predef(HKEY_CURRENT_USER)
                .create_subkey(&registry)
                .unwrap();
            Self {
                root,
                registry,
                hive,
            }
        }
        fn old(&self) -> PathBuf {
            self.root.join(r"AppData\Local\MgoDesktop")
        }
        fn log(&self) -> Log {
            Log(File::create(self.root.join("migration.log")).unwrap())
        }
        fn install_old(&self) -> PathBuf {
            let old = self.old();
            fs::create_dir_all(&old).unwrap();
            let executable = std::env::current_exe().unwrap();
            executable_identity(&executable).unwrap();
            fs::copy(executable, old.join(EXECUTABLES[0])).unwrap();
            fs::write(old.join("uninstall.exe"), b"old uninstaller").unwrap();
            fs::write(old.join("settings.json"), b"keep settings").unwrap();
            let (record, _) = self.hive.create_subkey(UNINSTALL_KEYS[0]).unwrap();
            record.set_value("DisplayName", &"MgoDesktop").unwrap();
            record
                .set_value("Publisher", &"Viki Alvian Riyadi")
                .unwrap();
            record
                .set_value("InstallLocation", &old.to_string_lossy().as_ref())
                .unwrap();
            old
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            // Only this test's explicitly named temp directory and registry key.
            if self.root.parent() == Some(std::env::temp_dir().as_path())
                && self
                    .root
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("MgoMigrationTest_")
            {
                let _ = fs::remove_dir_all(&self.root);
                let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(&self.registry);
            }
        }
    }
    #[test]
    fn accepts_only_local_unambiguous_paths() {
        assert!(same_path(
            &local_path(r#""C:\Users\Kasir\..\Kasir\AppData\Local\MgoDesktop""#).unwrap(),
            Path::new(r"C:\Users\Kasir\AppData\Local\MgoDesktop")
        ));
        for path in [
            r"\\server\share",
            r"C:relative",
            r"%USERPROFILE%\MgoDesktop",
            r"C:\app:stream",
            r"C:\app.\exe",
            r"C:\..\outside",
        ] {
            assert!(local_path(path).is_err(), "{path}");
        }
    }
    #[test]
    fn unrelated_profile_does_not_require_desktop_access() {
        let fixture = Fixture::new();
        fixture
            .hive
            .create_subkey(SHELL_FOLDERS)
            .unwrap()
            .0
            .set_value("Desktop", &r"%OneDrive%\Desktop")
            .unwrap();
        migrate_profile(
            &fixture.hive,
            &fixture.root,
            Path::new(r"C:\unused"),
            true,
            &mut fixture.log(),
        )
        .unwrap();
    }
    #[test]
    fn unknown_executable_is_never_removed() {
        let fixture = Fixture::new();
        fs::create_dir_all(fixture.old()).unwrap();
        let exe = fixture.old().join(EXECUTABLES[0]);
        fs::write(&exe, b"not MGO").unwrap();
        assert!(plan(&fixture.hive, &fixture.root).is_err());
        assert_eq!(fs::read(exe).unwrap(), b"not MGO");
    }
    #[test]
    fn check_and_apply_preserve_user_data_and_autostart() {
        let fixture = Fixture::new();
        let old = fixture.install_old();
        let destination = fixture.root.join("shared");
        fs::create_dir(&destination).unwrap();
        fs::copy(
            std::env::current_exe().unwrap(),
            destination.join(EXECUTABLES[0]),
        )
        .unwrap();
        let (run, _) = fixture
            .hive
            .create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run")
            .unwrap();
        run.set_value(
            "MgoDesktop",
            &format!("\"{}\"", old.join(EXECUTABLES[0]).display()),
        )
        .unwrap();
        migrate_profile(
            &fixture.hive,
            &fixture.root,
            &destination,
            false,
            &mut fixture.log(),
        )
        .unwrap();
        assert!(old.join(EXECUTABLES[0]).exists());
        // An unavailable replacement must not retire the old app.
        assert!(migrate_profile(
            &fixture.hive,
            &fixture.root,
            &fixture.root.join("missing"),
            true,
            &mut fixture.log()
        )
        .is_err());
        assert!(old.join(EXECUTABLES[0]).exists());
        let _com = Com::new().unwrap();
        migrate_profile(
            &fixture.hive,
            &fixture.root,
            &destination,
            true,
            &mut fixture.log(),
        )
        .unwrap();
        assert!(!old.join(EXECUTABLES[0]).exists());
        assert!(!old.join("uninstall.exe").exists());
        assert_eq!(
            fs::read(old.join("settings.json")).unwrap(),
            b"keep settings"
        );
        assert!(optional_key(&fixture.hive, UNINSTALL_KEYS[0], KEY_READ)
            .unwrap()
            .is_none());
        assert_eq!(
            value(&run, "MgoDesktop").unwrap().unwrap(),
            format!("\"{}\"", destination.join(EXECUTABLES[0]).display())
        );
        // Reinstallation is idempotent.
        migrate_profile(
            &fixture.hive,
            &fixture.root,
            &destination,
            true,
            &mut fixture.log(),
        )
        .unwrap();
    }
    #[test]
    fn locked_old_app_blocks_migration_without_deleting_data() {
        let fixture = Fixture::new();
        let old = fixture.install_old();
        let _lock = OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(old.join(EXECUTABLES[0]))
            .unwrap();
        let error = plan(&fixture.hive, &fixture.root).err().unwrap();
        assert!(error.contains("masih digunakan"), "{error}");
        assert!(old.join("settings.json").exists());
    }
    #[test]
    fn migration_does_not_remove_the_shared_installation() {
        let fixture = Fixture::new();
        let old = fixture.install_old();
        assert!(
            migrate_profile(&fixture.hive, &fixture.root, &old, true, &mut fixture.log()).is_err()
        );
        assert!(old.join(EXECUTABLES[0]).exists());
        assert!(old.join("settings.json").exists());
    }
    #[test]
    fn removes_only_shortcuts_pointing_to_old_launchers() {
        let fixture = Fixture::new();
        let old = fixture.install_old();
        let _com = Com::new().unwrap();
        let desktop = fixture.root.join("Desktop");
        fs::create_dir(&desktop).unwrap();
        let make_link = |name: &str, target: &Path| {
            let link: IShellLinkW =
                unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }.unwrap();
            unsafe { link.SetPath(PCWSTR(wide(target).as_ptr())) }.unwrap();
            let file: IPersistFile = link.cast().unwrap();
            unsafe { file.Save(PCWSTR(wide(desktop.join(name)).as_ptr()), true) }.unwrap();
        };
        make_link("MgoDesktop.lnk", &old.join(EXECUTABLES[0]));
        make_link("Other.lnk", &fixture.root.join("other.exe"));
        fs::write(desktop.join("Broken.lnk"), b"broken shortcut").unwrap();
        let detected = old_shortcuts(
            &fixture.hive,
            &fixture.root,
            &plan(&fixture.hive, &fixture.root).unwrap(),
            &mut fixture.log(),
        );
        assert_eq!(detected, vec![desktop.join("MgoDesktop.lnk")]);
        let destination = fixture.root.join("shared");
        fs::create_dir(&destination).unwrap();
        fs::copy(
            std::env::current_exe().unwrap(),
            destination.join(EXECUTABLES[0]),
        )
        .unwrap();
        migrate_profile(
            &fixture.hive,
            &fixture.root,
            &destination,
            true,
            &mut fixture.log(),
        )
        .unwrap();
        assert!(!desktop.join("MgoDesktop.lnk").exists());
        assert!(desktop.join("Other.lnk").exists());
        assert!(desktop.join("Broken.lnk").exists());
    }
    #[test]
    fn errors_for_nsis_use_utf16_with_bom() {
        let fixture = Fixture::new();
        let path = fixture.root.join("error.txt");
        write_error(&path, "Akses ditolak: akun Kasir\r\nLokasi C:\\Data");
        let bytes = fs::read(path).unwrap();
        assert_eq!(&bytes[..2], &[0xff, 0xfe]);
        let chars: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();
        assert_eq!(
            String::from_utf16(&chars).unwrap(),
            "Akses ditolak: akun Kasir  Lokasi C:\\Data"
        );
    }
}
