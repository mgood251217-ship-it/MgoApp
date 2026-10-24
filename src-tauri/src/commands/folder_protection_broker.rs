use super::{windows as win, Request, Response, MAX_BYTES, MAX_FRAME};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    net::windows::named_pipe::{NamedPipeClient, ServerOptions},
};
use windows_sys::Win32::{Security::SECURITY_ATTRIBUTES, Storage::FileSystem::*};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct User {
    pub sid: String,
    pub write: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub root: PathBuf,
    pub state_directory: PathBuf,
    pub users: Vec<User>,
    #[serde(default)]
    pub aliases: Vec<String>,
}

struct Upload {
    owner: String,
    file: File,
    parents: Vec<File>,
    destination: String,
    size: u64,
    offset: u64,
    replace: bool,
    touched: Instant,
    committed: bool,
    expected_target: Option<String>,
}
impl Drop for Upload {
    fn drop(&mut self) {
        if !self.committed {
            let _ = win::delete_open_file(&self.file);
        }
    }
}

struct ScopedFile {
    file: File,
    _parents: Vec<File>,
}
impl std::ops::Deref for ScopedFile {
    type Target = File;
    fn deref(&self) -> &File {
        &self.file
    }
}
impl Read for ScopedFile {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        self.file.read(buffer)
    }
}

pub struct Broker {
    pub config: Config,
    _pins: Vec<File>,
    root: File,
    audit: File,
    next_stage: u64,
    uploads: HashMap<String, Upload>,
}

impl Broker {
    pub fn load(config_path: &std::path::Path) -> Result<Self, String> {
        let sid = win::process_sid().map_err(|e| e.to_string())?;
        let mut pins = win::pin_directory(config_path.parent().ok_or("Missing config parent")?)
            .map_err(|e| e.to_string())?;
        let mut file = win::open(
            config_path,
            FILE_READ_DATA | READ_CONTROL,
            OPEN_EXISTING,
            FILE_SHARE_READ,
        )
        .map_err(|e| e.to_string())?;
        win::require_private(&file, &sid).map_err(|e| e.to_string())?;
        let mut raw = String::new();
        Read::by_ref(&mut file)
            .take(65537)
            .read_to_string(&mut raw)
            .map_err(|e| e.to_string())?;
        if raw.len() > 65536 {
            return Err("Config exceeds size limit".into());
        }
        let config: Config = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        pins.push(file); // Pin trusted configuration against replacement during service lifetime.
        Self::new(config, pins, None)
    }

    pub(super) fn registered(config: Config, expected_id: &str) -> Result<Self, String> {
        Self::new(config, Vec::new(), Some(expected_id))
    }

    fn new(config: Config, mut pins: Vec<File>, expected_id: Option<&str>) -> Result<Self, String> {
        let sid = win::process_sid().map_err(|e| e.to_string())?;
        if expected_id.is_none()
            && config.root.file_name().and_then(|s| s.to_str()) != Some("MGO-Test")
        {
            return Err("Phase 2 only accepts an explicitly created folder named MGO-Test; drive roots are forbidden".into());
        }
        if config.users.is_empty() || config.users.len() > 64 {
            return Err("Register 1..64 Windows user SIDs".into());
        }
        for user in &config.users {
            // Validate using the Windows parser as well as preventing SDDL injection.
            if !user.sid.starts_with("S-1-")
                || !user
                    .sid
                    .bytes()
                    .all(|b| b.is_ascii_digit() || b == b'S' || b == b'-')
            {
                return Err("Invalid enrolled SID".into());
            }
            win::descriptor(&format!("D:(A;;GR;;;{})", user.sid)).map_err(|e| e.to_string())?;
        }
        pins.extend(
            win::pin_directory(config.root.parent().ok_or("Missing test root parent")?).map_err(
                |e| format!("protected_root_unavailable: {}: {e}", config.root.display()),
            )?,
        );
        let root = win::open(
            &config.root,
            FILE_LIST_DIRECTORY
                | FILE_ADD_FILE
                | FILE_ADD_SUBDIRECTORY
                | FILE_WRITE_ATTRIBUTES
                | FILE_READ_ATTRIBUTES
                | READ_CONTROL,
            OPEN_EXISTING,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
        )
        .map_err(|e| format!("protected_root_unavailable: {}: {e}", config.root.display()))?;
        if win::information(&root)
            .map_err(|e| e.to_string())?
            .dwFileAttributes
            & FILE_ATTRIBUTE_DIRECTORY
            == 0
        {
            return Err("Test root is not a directory".into());
        }
        win::require_ntfs(&root).map_err(|e| e.to_string())?;
        if let Some(expected) = expected_id {
            if win::file_id(&root).map_err(|e| e.to_string())? != expected {
                return Err("Root identity changed; administrator recovery required".into());
            }
            win::require_private(&root, &sid)
                .map_err(|e| format!("Root ACL is not protected: {e}"))?;
            for parent in &pins {
                let conflicts =
                    win::parent_security_conflicts(parent, &sid).map_err(|e| e.to_string())?;
                if !conflicts.is_empty() {
                    return Err(format!(
                        "Root parent security changed: {}",
                        conflicts.join("; ")
                    ));
                }
            }
        }

        let state_pins = win::pin_directory(&config.state_directory).map_err(|e| e.to_string())?;
        win::require_private(state_pins.last().ok_or("Missing state directory")?, &sid)
            .map_err(|e| e.to_string())?;
        // Compare canonical identities as well as strings, disallow state inside the data root.
        let root_path = fs::canonicalize(&config.root).map_err(|e| e.to_string())?;
        let state_path = fs::canonicalize(&config.state_directory).map_err(|e| e.to_string())?;
        if state_path.starts_with(&root_path) {
            return Err("Recovery state must be outside the protected root".into());
        }
        pins.extend(state_pins);
        let backup_path = config.state_directory.join("original-acl.json");
        let backup = json!({ "schema": 1, "root": root_path, "file_id": win::file_id(&root).map_err(|e| e.to_string())?,
            "sddl_owner_group_dacl": win::sddl(&root).map_err(|e| e.to_string())?, "sacl_included": false });
        match win::open(
            &backup_path,
            FILE_WRITE_DATA | READ_CONTROL,
            CREATE_NEW,
            FILE_SHARE_READ,
        ) {
            Ok(mut file) => {
                win::require_private(&file, &sid).map_err(|e| e.to_string())?;
                file.write_all(serde_json::to_string_pretty(&backup).unwrap().as_bytes())
                    .and_then(|_| file.sync_all())
                    .map_err(|e| e.to_string())?;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                let mut file = win::open(
                    &backup_path,
                    FILE_READ_DATA | READ_CONTROL,
                    OPEN_EXISTING,
                    FILE_SHARE_READ,
                )
                .map_err(|e| e.to_string())?;
                win::require_private(&file, &sid).map_err(|e| e.to_string())?;
                let mut raw = String::new();
                Read::by_ref(&mut file)
                    .take(65537)
                    .read_to_string(&mut raw)
                    .map_err(|e| e.to_string())?;
                let saved: serde_json::Value = serde_json::from_str(&raw)
                    .map_err(|e| format!("Invalid recovery record: {e}"))?;
                if saved["file_id"] != backup["file_id"] || saved["root"] != backup["root"] {
                    return Err("Recovery record belongs to another directory; administrator review required".into());
                }
            }
            Err(e) => return Err(e.to_string()),
        }
        let audit = win::open(
            &config.state_directory.join("audit.jsonl"),
            FILE_APPEND_DATA | READ_CONTROL,
            OPEN_ALWAYS,
            FILE_SHARE_READ,
        )
        .map_err(|e| e.to_string())?;
        win::require_private(&audit, &sid).map_err(|e| e.to_string())?;
        let mut broker = Self {
            config,
            _pins: pins,
            root,
            audit,
            next_stage: 0,
            uploads: HashMap::new(),
        };
        broker.log("service", "startup", "ready")?;
        Ok(broker)
    }

    pub fn log(&mut self, sid: &str, operation: &str, outcome: &str) -> Result<(), String> {
        self.log_event(sid, operation, outcome, None)
    }

    fn log_event(
        &mut self,
        sid: &str,
        operation: &str,
        outcome: &str,
        target: Option<&str>,
    ) -> Result<(), String> {
        let event = json!({ "time_unix_ms": SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis(),
            "sid": sid, "operation": operation, "outcome": outcome,
            "target": target.map(|s| s.chars().take(180).collect::<String>()) });
        writeln!(self.audit, "{event}")
            .and_then(|_| self.audit.sync_all())
            .map_err(|e| format!("audit_unavailable: {e}"))
    }

    pub fn handle(&mut self, sid: &str, request: Request) -> Response {
        let user = self.config.users.iter().find(|u| u.sid == sid);
        if user.is_none() || request.is_write() && !user.unwrap().write {
            let _ = self.log_event(sid, request.label(), "unauthorized", request.target());
            return Response::error(
                "unauthorized",
                "Windows user is not enrolled or lacks write permission",
            );
        }
        if let Err(e) = self.log_event(sid, request.label(), "begin", request.target()) {
            return Response::error("audit_unavailable", e);
        }
        let label = request.label();
        let target = request.target().map(str::to_owned);
        self.uploads
            .retain(|_, upload| upload.touched.elapsed() < Duration::from_secs(120));
        let response = match self.execute(sid, request) {
            Ok(value) => Response::ok(value),
            Err(e) => Response::error("operation_failed", e),
        };
        if let Err(e) = self.log_event(sid, label, &response.code, target.as_deref()) {
            return Response::error("partial_failure", format!("Operation may have completed; audit finalization failed: {e}. Inspect before retrying."));
        }
        response
    }

    fn file(&self, name: &str, access: u32) -> Result<ScopedFile, String> {
        let (parents, leaf) = self.parent(name)?;
        let file = win::open_child(parents.last().unwrap(), &leaf, access, false)
            .map_err(|e| e.to_string())?;
        if win::information(&file)
            .map_err(|e| e.to_string())?
            .dwFileAttributes
            & FILE_ATTRIBUTE_DIRECTORY
            != 0
        {
            return Err("Only regular files are supported in Phase 2".into());
        }
        Ok(ScopedFile {
            file,
            _parents: parents,
        })
    }

    fn directory(&self, path: &str, create: bool) -> Result<Vec<File>, String> {
        let parts = super::relative_parts(path, true)?;
        let mut pins = vec![self.root.try_clone().map_err(|e| e.to_string())?];
        for part in parts {
            let parent = pins.last().unwrap();
            let file = match win::open_directory(parent, part, create) {
                Err(e) if create && e.kind() == std::io::ErrorKind::AlreadyExists => {
                    win::open_directory(parent, part, false)
                }
                result => result,
            }
            .map_err(|e| e.to_string())?;
            pins.push(file);
        }
        Ok(pins)
    }

    fn parent(&self, path: &str) -> Result<(Vec<File>, String), String> {
        let mut parts = super::relative_parts(path, false)?;
        let name = parts.pop().ok_or("Missing file name")?.to_string();
        Ok((self.directory(&parts.join("\\"), false)?, name))
    }

    fn entries(&self, path: &str) -> Result<serde_json::Value, String> {
        let pins = self.directory(path, false)?;
        let parent = pins.last().unwrap();
        let mut entries = Vec::new();
        for name in win::list(parent).map_err(|e| e.to_string())? {
            if super::validate_name(&name).is_err() {
                continue;
            }
            if let Ok(file) = win::open_directory(parent, &name, false) {
                entries.push(json!({"name": name, "is_dir": true, "size": 0, "file_id": win::file_id(&file).map_err(|e| e.to_string())?}));
            } else if let Ok(file) = win::open_child(parent, &name, FILE_READ_ATTRIBUTES, false) {
                let info = win::information(&file).map_err(|e| e.to_string())?;
                entries.push(json!({"name": name, "is_dir": false, "size": ((info.nFileSizeHigh as u64) << 32) | info.nFileSizeLow as u64,
                    "file_id": win::file_id(&file).map_err(|e| e.to_string())?}));
            }
        }
        entries.sort_by_key(|e| e["name"].as_str().unwrap_or_default().to_ascii_lowercase());
        Ok(json!({"entries": entries}))
    }

    fn execute(&mut self, sid: &str, request: Request) -> Result<serde_json::Value, String> {
        if win::information(&self.root)
            .map_err(|e| e.to_string())?
            .dwFileAttributes
            & FILE_ATTRIBUTE_REPARSE_POINT
            != 0
        {
            return Err(
                "Test root changed into a reparse point; administrator review required".into(),
            );
        }
        match request {
            Request::ForRoot { .. } => Err("Nested root selection is not allowed".into()),
            Request::Status => Ok(
                json!({ "service": "available", "transport": "local_named_pipe", "phase": 3, "protocol_version": super::PROTOCOL_VERSION,
                "root": self.config.root, "aliases": self.config.aliases, "scope": "nested_test_folder", "acl_enforcement": "not_verified",
                "lan_enabled": false, "windows_identity": win::process_sid().map_err(|e| e.to_string())? }),
            ),
            Request::Inspect => Ok(
                json!({ "root": self.config.root, "file_id": win::file_id(&self.root).map_err(|e| e.to_string())?,
                "sddl": win::sddl(&self.root).map_err(|e| e.to_string())?, "backup": "original-acl.json", "protocol_version": super::PROTOCOL_VERSION,
                "protection_status": "not_verified", "message": "ACL inspected only; no permissions changed. Effective access and SMB verification are pending." }),
            ),
            Request::List => {
                let mut names = Vec::new();
                for name in win::list(&self.root).map_err(|e| e.to_string())? {
                    if super::validate_name(&name).is_ok()
                        && self.file(&name, FILE_READ_ATTRIBUTES).is_ok()
                    {
                        names.push(name);
                    }
                    if names.len() > 1000 {
                        return Err("Too many files for test prototype".into());
                    }
                }
                names.sort();
                Ok(json!({ "files": names }))
            }
            Request::Read { name } => {
                let mut file = self.file(&name, FILE_READ_DATA)?;
                let mut data = Vec::new();
                Read::by_ref(&mut file)
                    .take((MAX_BYTES + 1) as u64)
                    .read_to_end(&mut data)
                    .map_err(|e| e.to_string())?;
                if data.len() > MAX_BYTES {
                    return Err("File exceeds 1 MiB prototype limit".into());
                }
                Ok(json!({ "data": STANDARD.encode(data) }))
            }
            Request::Create { name, data } => self.write(&name, &data, false),
            Request::Update { name, data } => self.write(&name, &data, true),
            Request::Delete { name } => {
                let file = self.file(&name, DELETE)?;
                win::delete_open_file(&file).map_err(|e| e.to_string())?;
                Ok(json!({ "deleted": true }))
            }
            Request::ListDirectory { path } => self.entries(&path),
            Request::CreateDirectory { path } => {
                self.directory(&path, true)?;
                Ok(json!({"created": true}))
            }
            Request::RemoveDirectory { path } => {
                let (pins, leaf) = self.parent(&path)?;
                let file = win::open_directory_for_delete(pins.last().unwrap(), &leaf)
                    .map_err(|e| e.to_string())?;
                if !win::list(&file).map_err(|e| e.to_string())?.is_empty() {
                    return Err("Directory is not empty; recursive removal is not supported".into());
                }
                let attributes = win::information(&file)
                    .map_err(|e| e.to_string())?
                    .dwFileAttributes;
                if attributes & FILE_ATTRIBUTE_READONLY != 0 {
                    win::set_attributes(&file, attributes & !FILE_ATTRIBUTE_READONLY)
                        .map_err(|e| e.to_string())?;
                }
                if let Err(e) = win::delete_open_file(&file) {
                    let restore = win::set_attributes(&file, attributes);
                    return Err(format!(
                        "Directory removal failed: {e}; attribute restore: {restore:?}"
                    ));
                }
                Ok(json!({"deleted": true}))
            }
            Request::Rename {
                source,
                destination,
            } => {
                let file = self.file(&source, DELETE)?;
                let (pins, leaf) = self.parent(&destination)?;
                win::commit(&file, pins.last().unwrap(), &leaf, false)
                    .map_err(|e| e.to_string())?;
                Ok(json!({"renamed": true}))
            }
            Request::Copy {
                source,
                destination,
            } => {
                let mut source = self.file(&source, FILE_READ_DATA)?;
                let size = source.metadata().map_err(|e| e.to_string())?.len();
                if size > 2 * 1024 * 1024 * 1024 {
                    return Err("File exceeds 2 GiB transfer limit".into());
                }
                let id = self.begin_upload(sid, &destination, size, false)?;
                let upload = self.uploads.get_mut(&id).unwrap();
                upload.offset =
                    std::io::copy(&mut source, &mut upload.file).map_err(|e| e.to_string())?;
                self.commit_upload(sid, &id)
            }
            Request::BeginUpload {
                name,
                size,
                replace,
            } => Ok(json!({"id": self.begin_upload(sid, &name, size, replace)?})),
            Request::UploadChunk { id, offset, data } => {
                let bytes = STANDARD.decode(data).map_err(|_| "Invalid base64")?;
                let upload = self
                    .uploads
                    .get_mut(&id)
                    .filter(|u| u.owner == sid)
                    .ok_or("Unknown upload or unauthorized owner")?;
                if bytes.is_empty()
                    || bytes.len() > MAX_BYTES
                    || offset != upload.offset
                    || upload.offset + bytes.len() as u64 > upload.size
                {
                    return Err("Invalid upload size or offset; abort and restart transfer".into());
                }
                if let Err(e) = upload.file.write_all(&bytes) {
                    self.uploads.remove(&id);
                    return Err(format!("Upload write failed and was aborted: {e}"));
                }
                upload.offset += bytes.len() as u64;
                upload.touched = Instant::now();
                Ok(json!({"offset": upload.offset}))
            }
            Request::CommitUpload { id } => self.commit_upload(sid, &id),
            Request::AbortUpload { id } => {
                if !self.uploads.get(&id).is_some_and(|u| u.owner == sid) {
                    return Err("Unknown upload or unauthorized owner".into());
                }
                self.uploads.remove(&id);
                Ok(json!({"aborted": true}))
            }
            Request::SetFolderIcon { path, status } => {
                if !["proses", "selesai", "cancel"].contains(&status.as_str()) {
                    return Err("Unknown folder status".into());
                }
                self.directory(&path, true)?;
                let icon = PathBuf::from(
                    std::env::var_os("ProgramData").unwrap_or_else(|| r"C:\ProgramData".into()),
                )
                .join("MgoDesktop")
                .join("icons")
                .join(format!("folder-{status}.ico"));
                let ini = if path.is_empty() {
                    "desktop.ini".into()
                } else {
                    format!("{path}\\desktop.ini")
                };
                let content = format!("[.ShellClassInfo]\r\nIconResource={},0\r\n[ViewState]\r\nMode=\r\nVid=\r\nFolderType=Generic\r\n", icon.display());
                let exists = self.file(&ini, FILE_READ_ATTRIBUTES).is_ok();
                self.write(&ini, &STANDARD.encode(content), exists)?;
                let pins = self.directory(&path, false)?;
                let file = self.file(&ini, FILE_WRITE_ATTRIBUTES)?;
                win::add_attributes(&file, FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)
                    .map_err(|e| e.to_string())?;
                win::add_attributes(pins.last().unwrap(), FILE_ATTRIBUTE_READONLY)
                    .map_err(|e| e.to_string())?;
                Ok(json!({"updated": true}))
            }
        }
    }

    fn begin_upload(
        &mut self,
        sid: &str,
        path: &str,
        size: u64,
        replace: bool,
    ) -> Result<String, String> {
        if size > 2 * 1024 * 1024 * 1024 || self.uploads.len() >= 4 {
            return Err("Transfer quota exceeded (2 GiB/file, 4 active transfers)".into());
        }
        let (parents, destination) = self.parent(path)?;
        let expected_target = if replace {
            Some(
                win::file_id(&*self.file(path, FILE_READ_ATTRIBUTES)?)
                    .map_err(|e| e.to_string())?,
            )
        } else {
            None
        };
        self.next_stage += 1;
        let id = format!("{}-{}", std::process::id(), self.next_stage);
        let file = win::open_child(
            parents.last().unwrap(),
            &format!(".mgo-stage-{id}"),
            FILE_WRITE_DATA | DELETE,
            true,
        )
        .map_err(|e| e.to_string())?;
        self.uploads.insert(
            id.clone(),
            Upload {
                owner: sid.into(),
                file,
                parents,
                destination,
                size,
                offset: 0,
                replace,
                touched: Instant::now(),
                committed: false,
                expected_target,
            },
        );
        Ok(id)
    }

    fn commit_upload(&mut self, sid: &str, id: &str) -> Result<serde_json::Value, String> {
        if !self.uploads.get(id).is_some_and(|u| u.owner == sid) {
            return Err("Unknown upload or unauthorized owner".into());
        }
        let mut upload = self.uploads.remove(id).unwrap();
        if upload.offset != upload.size
            || upload.file.metadata().map_err(|e| e.to_string())?.len() != upload.size
        {
            return Err("Incomplete upload; original target preserved".into());
        }
        if let Some(expected) = &upload.expected_target {
            let target = win::open_child(
                upload.parents.last().unwrap(),
                &upload.destination,
                FILE_READ_ATTRIBUTES,
                false,
            )
            .map_err(|e| e.to_string())?;
            if win::file_id(&target).map_err(|e| e.to_string())? != *expected {
                return Err("Write conflict: target changed during transfer".into());
            }
        }
        upload.file.sync_all().map_err(|e| e.to_string())?;
        win::commit(
            &upload.file,
            upload.parents.last().unwrap(),
            &upload.destination,
            upload.replace,
        )
        .map_err(|e| e.to_string())?;
        // The staging handle now identifies the committed file; do not delete it on drop.
        let bytes = upload.offset;
        upload.committed = true;
        Ok(json!({"committed": true, "bytes": bytes}))
    }

    fn write(
        &mut self,
        name: &str,
        encoded: &str,
        replace: bool,
    ) -> Result<serde_json::Value, String> {
        let (parents, leaf) = self.parent(name)?;
        if encoded.len() > MAX_FRAME {
            return Err("Payload too large".into());
        }
        let data = STANDARD
            .decode(encoded)
            .map_err(|_| "Invalid base64 payload")?;
        if data.len() > MAX_BYTES {
            return Err("File exceeds 1 MiB prototype limit".into());
        }
        if replace {
            drop(self.file(name, FILE_READ_ATTRIBUTES)?);
        }
        // Staging file and destination are on the same pinned volume/directory.
        // Clients cannot address internal staging names. CREATE_NEW prevents collision attacks.
        self.next_stage += 1;
        let stage_name = format!(".mgo-stage-{}-{}", std::process::id(), self.next_stage);
        let mut stage = win::open_child(
            parents.last().unwrap(),
            &stage_name,
            FILE_WRITE_DATA | DELETE,
            true,
        )
        .map_err(|e| e.to_string())?;
        let result = stage
            .write_all(&data)
            .and_then(|_| stage.sync_all())
            .and_then(|_| win::commit(&stage, parents.last().unwrap(), &leaf, replace));
        if let Err(e) = result {
            let cleanup = win::delete_open_file(&stage);
            return Err(format!("Commit failed: {e}; staging cleanup: {cleanup:?}"));
        }
        Ok(json!({ "committed": true, "bytes": data.len() }))
    }
}

pub async fn read_frame<T: AsyncRead + Unpin>(io: &mut T) -> Result<Vec<u8>, String> {
    let length = io.read_u32_le().await.map_err(|e| e.to_string())? as usize;
    if length == 0 || length > MAX_FRAME {
        return Err("Invalid frame size".into());
    }
    let mut data = vec![0; length];
    io.read_exact(&mut data).await.map_err(|e| e.to_string())?;
    Ok(data)
}

pub async fn write_frame<T: AsyncWrite + Unpin>(io: &mut T, data: &[u8]) -> Result<(), String> {
    if data.is_empty() || data.len() > MAX_FRAME {
        return Err("Invalid frame size".into());
    }
    io.write_u32_le(data.len() as u32)
        .await
        .map_err(|e| e.to_string())?;
    io.write_all(data).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub trait Handler {
    fn users(&self) -> &[User];
    fn handle(&mut self, sid: &str, request: Request) -> Response;
    fn log(&mut self, sid: &str, operation: &str, outcome: &str) -> Result<(), String>;
}
impl Handler for Broker {
    fn users(&self) -> &[User] {
        &self.config.users
    }
    fn handle(&mut self, sid: &str, request: Request) -> Response {
        Broker::handle(self, sid, request)
    }
    fn log(&mut self, sid: &str, operation: &str, outcome: &str) -> Result<(), String> {
        Broker::log(self, sid, operation, outcome)
    }
}

pub async fn serve(broker: Broker, pipe: &str, stop: Arc<AtomicBool>) -> Result<(), String> {
    serve_ready(broker, pipe, stop, || Ok(())).await
}

/// Report readiness only after configuration, recovery identity and pipe creation succeed.
pub async fn serve_ready(
    mut broker: impl Handler,
    pipe: &str,
    stop: Arc<AtomicBool>,
    ready: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let own_sid = win::process_sid().map_err(|e| e.to_string())?;
    let mut sddl = format!("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;{own_sid})");
    for user in broker.users() {
        // Read data, write data, read attributes, synchronize; NO create-pipe-instance right.
        sddl.push_str(&format!("(A;;0x00100083;;;{})", user.sid));
    }
    let sd = win::descriptor(&sddl).map_err(|e| e.to_string())?;
    let attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: sd.0,
        bInheritHandle: 0,
    };
    let mut options = ServerOptions::new();
    options
        .first_pipe_instance(true)
        .reject_remote_clients(true)
        .max_instances(2);
    let mut server =
        unsafe { options.create_with_security_attributes_raw(pipe, &attributes as *const _ as _) }
            .map_err(|e| e.to_string())?;
    ready()?;
    loop {
        if stop.load(Ordering::SeqCst) {
            break;
        }
        match tokio::time::timeout(Duration::from_millis(200), server.connect()).await {
            Err(_) => continue,
            Ok(Err(e)) => return Err(e.to_string()),
            Ok(Ok(())) => (),
        }
        let result = tokio::time::timeout(Duration::from_secs(5), read_frame(&mut server)).await;
        let response = match result {
            Ok(Ok(bytes)) => {
                // No await until impersonation has reverted to the service identity.
                match win::caller_sid(&server) {
                    Ok(sid) => match serde_json::from_slice::<Request>(&bytes) {
                        Ok(request) => broker.handle(&sid, request),
                        Err(_) => {
                            let _ = broker.log(&sid, "protocol", "invalid_request");
                            Response::error("invalid_request", "Unsupported request schema")
                        }
                    },
                    Err(_) => {
                        let _ = broker.log("unknown", "authentication", "failed");
                        Response::error(
                            "authentication_failed",
                            "Cannot verify Windows caller identity",
                        )
                    }
                }
            }
            _ => {
                let _ = broker.log("unknown", "protocol", "incomplete_request");
                Response::error(
                    "invalid_request",
                    "Incomplete, oversized or timed out request",
                )
            }
        };
        let bytes = serde_json::to_vec(&response).map_err(|e| e.to_string())?;
        let _ =
            tokio::time::timeout(Duration::from_secs(5), write_frame(&mut server, &bytes)).await;
        // Keep the instance alive to prevent pipe-name squatting between requests.
        // Wait for the client to consume the response/close; bounded against client DoS.
        let mut eof = [0u8; 1];
        let _ = tokio::time::timeout(Duration::from_millis(500), server.read(&mut eof)).await;
        // Recreate the I/O instance so a prior disconnected client's EOF state
        // cannot leak into the next session. Keep the old instance until creation
        // succeeds to retain the protected pipe name continuously.
        options.first_pipe_instance(false);
        let next = unsafe {
            options.create_with_security_attributes_raw(pipe, &attributes as *const _ as _)
        }
        .map_err(|e| e.to_string())?;
        server = next;
    }
    broker.log("service", "shutdown", "stopped")
}

pub async fn client(
    pipe: &str,
    expected_server_sid: &str,
    request: Request,
) -> Result<Response, String> {
    let task = async {
        // Identification only: a fake pipe server cannot impersonate this client for writes.
        let name = win::wide(std::ffi::OsStr::new(pipe));
        let mut stream = loop {
            let handle = unsafe {
                CreateFileW(
                    name.as_ptr(),
                    FILE_READ_DATA | FILE_WRITE_DATA | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
                    0,
                    std::ptr::null(),
                    OPEN_EXISTING,
                    FILE_FLAG_OVERLAPPED | SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION,
                    std::ptr::null_mut(),
                )
            };
            if handle != windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
                let stream = unsafe { NamedPipeClient::from_raw_handle(handle as _) }
                    .map_err(|e| e.to_string())?;
                break stream;
            }
            let e = std::io::Error::last_os_error();
            if e.raw_os_error() != Some(windows_sys::Win32::Foundation::ERROR_PIPE_BUSY as i32) {
                return Err(format!("service_unavailable: {e}"));
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        };
        if win::server_sid(&stream).map_err(|e| format!("server_authentication_failed: {e}"))?
            != expected_server_sid
        {
            return Err(
                "server_authentication_failed: service SID differs from administrator registration"
                    .into(),
            );
        }
        write_frame(
            &mut stream,
            &serde_json::to_vec(&request).map_err(|e| e.to_string())?,
        )
        .await?;
        let data = read_frame(&mut stream).await?;
        serde_json::from_slice(&data).map_err(|e| format!("Invalid service response: {e}"))
    };
    tokio::time::timeout(Duration::from_secs(8), task)
        .await
        .map_err(|_| "service_timeout: outcome unknown; inspect before retrying".to_string())?
}
