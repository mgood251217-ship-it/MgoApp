//! Administrator-owned root catalog. One unavailable root never enables direct writes.
use crate::folder_protection as fp;
use fp::{
    broker::{Broker, Config, Handler, User},
    windows as win, Request, Response,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};
use windows_sys::Win32::Storage::FileSystem::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RootSpec {
    pub id: String,
    pub label: String,
    pub path: PathBuf,
    pub file_id: String,
    #[serde(default)]
    pub aliases: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Catalog {
    pub schema: u32,
    pub state_directory: PathBuf,
    pub users: Vec<User>,
    pub roots: Vec<RootSpec>,
}

pub fn local_root(path: &Path) -> Result<String, String> {
    let p = path
        .to_str()
        .ok_or("Invalid Unicode root")?
        .replace('/', "\\");
    let p = p.trim_end_matches('\\');
    let b = p.as_bytes();
    if b.len() < 4 || !b[0].is_ascii_alphabetic() || &b[1..3] != b":\\" {
        return Err(
            "Only a local subfolder may be protected; drive roots and UNC roots are forbidden"
                .into(),
        );
    }
    fp::relative_parts(&p[3..], false)?;
    Ok(p.to_ascii_lowercase())
}
impl Catalog {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != 4
            || self.roots.is_empty()
            || self.roots.len() > 32
            || self.users.is_empty()
            || self.users.len() > 64
        {
            return Err("Invalid root catalog size/schema/users".into());
        }
        for user in &self.users {
            win::descriptor(&format!("D:(A;;GR;;;{})", user.sid)).map_err(|e| e.to_string())?;
            if !user.sid.starts_with("S-1-")
                || !user
                    .sid
                    .bytes()
                    .all(|c| c.is_ascii_digit() || c == b'S' || c == b'-')
            {
                return Err("Invalid enrolled SID".into());
            }
        }
        if serde_json::to_vec(self).map_err(|e| e.to_string())?.len() > 131072 {
            return Err("Root catalog exceeds size limit".into());
        }
        let state = local_root(&self.state_directory)?;
        let mut paths: Vec<String> = Vec::new();
        let mut ids = Vec::new();
        for root in &self.roots {
            if root.id.is_empty()
                || root.id.len() > 64
                || !root
                    .id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
                || ids.contains(&root.id)
                || root.file_id.is_empty()
                || root.file_id.len() > 128
                || root.label.len() > 180
                || root.aliases.len() > 16
            {
                return Err("Invalid or duplicate root identity".into());
            }
            ids.push(root.id.clone());
            let path = local_root(&root.path)?;
            if path == state
                || state.starts_with(&format!("{path}\\"))
                || path.starts_with(&format!("{state}\\"))
                || paths.iter().any(|other| {
                    other == &path
                        || path.starts_with(&format!("{other}\\"))
                        || other.starts_with(&format!("{path}\\"))
                })
            {
                return Err("Overlapping roots or private-state boundary rejected".into());
            }
            paths.push(path);
        }
        Ok(())
    }
}
pub(super) fn trusted_json(path: &Path, sid: &str) -> Result<(Value, Vec<File>), String> {
    let mut pins =
        win::pin_directory(path.parent().ok_or("No config parent")?).map_err(|e| e.to_string())?;
    win::require_private(pins.last().ok_or("No state directory")?, sid)
        .map_err(|e| e.to_string())?;
    let mut file = win::open(
        path,
        FILE_READ_DATA | READ_CONTROL,
        OPEN_EXISTING,
        FILE_SHARE_READ,
    )
    .map_err(|e| e.to_string())?;
    win::require_private(&file, sid).map_err(|e| e.to_string())?;
    let mut raw = Vec::new();
    Read::by_ref(&mut file)
        .take(262145)
        .read_to_end(&mut raw)
        .map_err(|e| e.to_string())?;
    if raw.len() > 262144 {
        return Err("Catalog too large".into());
    }
    let value = serde_json::from_slice(&raw).map_err(|e| e.to_string())?;
    pins.push(file);
    Ok((value, pins))
}
struct RootEntry {
    spec: RootSpec,
    broker: Option<Broker>,
    error: Option<String>,
    legacy_config: Option<PathBuf>,
}
pub struct Registry {
    pub catalog: Catalog,
    entries: Vec<RootEntry>,
    _pins: Vec<File>,
    pub backup_used: bool,
    pub configuration_error: Option<String>,
}
fn validated_header(path: &Path, sid: &str) -> Result<(Value, Vec<File>), String> {
    let (value, pins) = trusted_json(path, sid)?;
    let parent = path.parent().ok_or("No config parent")?;
    if value.get("roots").is_some() {
        let catalog: Catalog = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        catalog.validate()?;
        if local_root(&catalog.state_directory)? != local_root(parent)? {
            return Err("Catalog state must remain in its private config directory".into());
        }
    } else {
        let config: Config = serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
        if local_root(&config.state_directory)? != local_root(parent)?
            || config.users.is_empty()
            || config.users.len() > 64
            || config.root.file_name().and_then(|s| s.to_str()) != Some("MGO-Test")
        {
            return Err("Invalid legacy configuration".into());
        }
        for user in &config.users {
            if !user.sid.starts_with("S-1-")
                || !user
                    .sid
                    .bytes()
                    .all(|c| c.is_ascii_digit() || c == b'S' || c == b'-')
            {
                return Err("Invalid enrolled SID".into());
            }
            win::descriptor(&format!("D:(A;;GR;;;{})", user.sid)).map_err(|e| e.to_string())?;
        }
    }
    Ok((value, pins))
}

impl Registry {
    pub fn degraded(error: String) -> Self {
        Self {
            catalog: Catalog {
                schema: 4,
                state_directory: PathBuf::new(),
                users: vec![User {
                    sid: "S-1-5-11".into(),
                    write: false,
                }],
                roots: vec![],
            },
            entries: vec![],
            _pins: vec![],
            backup_used: false,
            configuration_error: Some(error),
        }
    }
    pub fn load(path: &Path) -> Result<Self, String> {
        let sid = win::process_sid().map_err(|e| e.to_string())?;
        let primary = validated_header(path, &sid);
        let (value, pins, backup_used) = match primary {
            Ok((value, pins)) => (value, pins, false),
            Err(primary_error) => {
                let backup = path.with_file_name("service.backup.json");
                let (value, pins) = validated_header(&backup, &sid).map_err(|e| {
                    format!("configuration_unavailable: {primary_error}; backup: {e}")
                })?;
                (value, pins, true)
            }
        };
        if value.get("roots").is_none() {
            let config: Config = serde_json::from_value(value).map_err(|e| e.to_string())?;
            let broker_path = if backup_used {
                path.with_file_name("service.backup.json")
            } else {
                path.to_path_buf()
            };
            let loaded = Broker::load(&broker_path);
            let error = loaded.as_ref().err().cloned();
            let broker = loaded.ok();
            let identity = win::open(
                &config.root,
                FILE_READ_ATTRIBUTES | READ_CONTROL,
                OPEN_EXISTING,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
            )
            .and_then(|f| win::file_id(&f))
            .unwrap_or_default();
            let spec = RootSpec {
                id: "local".into(),
                label: "Folder utama".into(),
                path: config.root.clone(),
                aliases: config.aliases.clone(),
                file_id: identity,
            };

            return Ok(Self {
                catalog: Catalog {
                    schema: 4,
                    state_directory: config.state_directory,
                    users: config.users,
                    roots: vec![spec.clone()],
                },
                entries: vec![RootEntry {
                    spec,
                    broker,
                    error,
                    legacy_config: Some(if backup_used {
                        path.with_file_name("service.backup.json")
                    } else {
                        path.to_path_buf()
                    }),
                }],
                _pins: pins,
                backup_used,
                configuration_error: None,
            });
        }
        let catalog: Catalog = serde_json::from_value(value).map_err(|e| e.to_string())?;
        catalog.validate()?;
        let mut registry = Self {
            catalog,
            entries: vec![],
            _pins: pins,
            backup_used,
            configuration_error: None,
        };
        for spec in registry.catalog.roots.clone() {
            registry.entries.push(RootEntry {
                spec,
                broker: None,
                error: None,
                legacy_config: None,
            });
        }
        for index in 0..registry.entries.len() {
            registry.try_root(index);
        }
        Ok(registry)
    }
    fn try_root(&mut self, index: usize) {
        if self.entries[index].broker.is_some() {
            return;
        }
        let entry = &self.entries[index];
        let result = if let Some(config) = &entry.legacy_config {
            Broker::load(config)
        } else {
            let state = if entry.spec.id == "local" {
                self.catalog.state_directory.clone()
            } else {
                self.catalog
                    .state_directory
                    .join(format!("root-{}", entry.spec.id))
            };
            (|| {
                fs::create_dir_all(&state).map_err(|e| e.to_string())?;
                Broker::registered(
                    Config {
                        root: entry.spec.path.clone(),
                        state_directory: state,
                        users: self.catalog.users.clone(),
                        aliases: entry.spec.aliases.clone(),
                    },
                    &entry.spec.file_id,
                )
            })()
        };
        match result {
            Ok(broker) => {
                self.entries[index].broker = Some(broker);
                self.entries[index].error = None;
            }
            Err(e) => {
                self.entries[index].error = Some(e);
            }
        }
    }
    fn status(&self) -> Response {
        let roots:Vec<Value>=self.entries.iter().map(|entry|json!({"id":entry.spec.id,"label":entry.spec.label,"path":entry.spec.path,"aliases":entry.spec.aliases,"available":entry.broker.is_some(),"error":entry.error})).collect();
        Response::ok(
            json!({"service":if self.configuration_error.is_some(){"recovery_required"}else{"available"},"protocol_version":fp::PROTOCOL_VERSION,"root":self.entries.first().map(|e|&e.spec.path),"aliases":self.entries.first().map(|e|&e.spec.aliases),"roots":roots,"configuration_error":self.configuration_error,"backup_used":self.backup_used,"lan_enabled":false}),
        )
    }
}
impl Handler for Registry {
    fn users(&self) -> &[User] {
        &self.catalog.users
    }
    fn log(&mut self, _sid: &str, _operation: &str, _outcome: &str) -> Result<(), String> {
        Ok(())
    }
    fn handle(&mut self, sid: &str, request: Request) -> Response {
        if let Some(error) = &self.configuration_error {
            return if matches!(request, Request::Status) {
                self.status()
            } else {
                Response::error("configuration_unavailable", error)
            };
        }
        if matches!(request, Request::Status) {
            return self.status();
        }
        if !self.catalog.users.iter().any(|u| u.sid == sid) {
            return Response::error("unauthorized", "Windows user is not enrolled");
        }
        let (id, request) = match request {
            Request::ForRoot { root_id, request } => (root_id, *request),
            other => (
                self.entries
                    .first()
                    .map(|e| e.spec.id.clone())
                    .unwrap_or_default(),
                other,
            ),
        };
        if matches!(request, Request::ForRoot { .. }) {
            return Response::error("invalid_request", "Nested root selection rejected");
        }
        let Some(index) = self.entries.iter().position(|e| e.spec.id == id) else {
            return Response::error("unknown_root", "Root is not registered");
        };
        self.try_root(index);
        let entry = &mut self.entries[index];
        match &mut entry.broker {
            Some(broker) => broker.handle(sid, request),
            None => Response::error(
                "root_unavailable",
                entry.error.as_deref().unwrap_or("Root unavailable"),
            ),
        }
    }
}
