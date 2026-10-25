//! Filesystem routing below the existing order-folder business logic.
use super::{
    mapping::{self, Registration, StorageBackend},
    Request,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::Value;
use std::{
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    sync::OnceLock,
};

type Transport = Box<dyn Fn(Request) -> Result<Value, String> + Send + Sync>;
pub struct Storage {
    roots: Vec<Registration>,
    transport: Transport,
    protocol: OnceLock<Result<(), String>>,
}

fn validate_registrations(roots: &[Registration]) -> Result<(), String> {
    if roots.is_empty() || roots.len() > 64 {
        return Err("Invalid machine root catalog size".into());
    }
    let mut ids = std::collections::HashSet::new();
    for root in roots {
        if root.root_id.is_empty()
            || root.root_id.len() > 68
            || !root
                .root_id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
            || !ids.insert(root.root_id.as_str())
            || root.aliases.is_empty()
            || root.aliases.len() > 17
            || root.aliases.iter().any(|alias| alias.is_empty())
        {
            return Err("Invalid machine root registration".into());
        }
    }
    for root in roots {
        for alias in &root.aliases {
            mapping::resolve(alias, roots)?;
        }
    }
    Ok(())
}

fn ipc(request: Request) -> Result<Value, String> {
    let response = tauri::async_runtime::block_on(super::request(request))?;
    if !response.success {
        return Err(response.message.unwrap_or(response.code));
    }
    Ok(response.data)
}

impl Storage {
    #[cfg(test)]
    pub(crate) fn for_test(roots: Vec<Registration>, transport: Transport) -> Self {
        Self {
            roots,
            transport,
            protocol: OnceLock::new(),
        }
    }
    pub fn new() -> Result<Self, String> {
        let mut roots: Vec<Registration> = Vec::new();
        #[cfg(windows)]
        {
            if let Some(raw) =
                super::windows::registered_value("Roots").map_err(|e| e.to_string())?
            {
                roots = serde_json::from_str(&raw)
                    .map_err(|e| format!("Invalid machine root catalog: {e}"))?;
                validate_registrations(&roots)?;
            } else if let Some(root) =
                super::windows::registered_value("RootPath").map_err(|e| e.to_string())?
            {
                let mut aliases = vec![root];
                if let Some(raw) =
                    super::windows::registered_value("RootAliases").map_err(|e| e.to_string())?
                {
                    aliases.extend(
                        serde_json::from_str::<Vec<String>>(&raw)
                            .map_err(|e| format!("Invalid protected root registration: {e}"))?,
                    );
                }
                roots.push(Registration {
                    root_id: "local".into(),
                    aliases,
                });
                validate_registrations(&roots)?;
            } else if super::windows::registered_value("ServerSid")
                .map_err(|e| e.to_string())?
                .is_some()
            {
                // Legacy installation: require authenticated discovery. A failed discovery
                // never silently converts a protected write into direct filesystem access.
                let status = ipc(Request::Status)?;
                let root = status["root"]
                    .as_str()
                    .ok_or("Service did not return its registered root")?;
                let mut aliases = vec![root.to_string()];
                if let Some(list) = status["aliases"].as_array() {
                    aliases.extend(list.iter().filter_map(|v| v.as_str().map(str::to_owned)));
                }
                roots.push(Registration {
                    root_id: "local".into(),
                    aliases,
                });
                validate_registrations(&roots)?;
            }
        }
        #[cfg(windows)]
        {
            roots.extend(super::lan::registrations()?);
            if !roots.is_empty() {
                validate_registrations(&roots)?;
            }
        }
        Ok(Self {
            roots,
            transport: Box::new(ipc),
            protocol: OnceLock::new(),
        })
    }

    fn classify(&self, path: &Path) -> Result<StorageBackend, String> {
        if self.roots.is_empty() {
            return Ok(StorageBackend::DirectFilesystem);
        }
        let original = path.to_str().ok_or("Invalid Unicode path")?;
        let lexical = mapping::resolve(original, &self.roots)?;
        if lexical != StorageBackend::DirectFilesystem {
            return Ok(lexical);
        }
        // Resolve existing local aliases (including 8.3 names/junction aliases), plus
        // any not-yet-created suffix, against the administrator-registered root.
        let mut ancestor = path;
        let mut suffix = Vec::new();
        while !ancestor.exists() {
            match (ancestor.file_name(), ancestor.parent()) {
                (Some(name), Some(parent)) => {
                    suffix.push(name.to_os_string());
                    ancestor = parent;
                }
                _ => return Ok(lexical),
            }
        }
        if let Ok(canonical) = fs::canonicalize(ancestor) {
            let mut p = PathBuf::from(dos_path(&canonical.to_string_lossy()));
            for component in suffix.into_iter().rev() {
                p.push(component);
            }
            return mapping::resolve(&p.to_string_lossy(), &self.roots);
        }
        Ok(lexical)
    }

    pub fn protected(&self, path: &Path) -> Result<bool, String> {
        Ok(matches!(
            self.classify(path)?,
            StorageBackend::ProtectedFilesystem { .. }
        ))
    }

    pub fn analyze_directory(&self, path: &Path) -> Result<Value, String> {
        match self.classify(path)? {
            StorageBackend::DirectFilesystem => {
                Err("Directory is not registered with Folder Protection".into())
            }
            StorageBackend::ProtectedFilesystem {
                root_id,
                relative_path,
            } => self.call(
                &root_id,
                Request::AnalyzeDirectory {
                    path: relative_path,
                },
            ),
        }
    }

    fn call(&self, root_id: &str, request: Request) -> Result<Value, String> {
        self.protocol.get_or_init(|| {
            let status = (self.transport)(Request::ForRoot { root_id:root_id.into(),request:Box::new(Request::Status) })?;
            if status["protocol_version"].as_u64().unwrap_or(0) < super::PROTOCOL_VERSION as u64 {
                return Err("Versi layanan Folder Protection perlu diperbarui. Jalankan installer MgoApp dan pilih komputer server.".into());
            }
            Ok(())
        }).clone()?;
        (self.transport)(Request::ForRoot {
            root_id: root_id.into(),
            request: Box::new(request),
        })
    }

    pub fn create_dir_all(&self, path: &Path) -> Result<(), String> {
        match self.classify(path)? {
            StorageBackend::DirectFilesystem => fs::create_dir_all(path).map_err(|e| e.to_string()),
            StorageBackend::ProtectedFilesystem {
                root_id,
                relative_path,
            } => {
                if relative_path.is_empty() {
                    return Ok(());
                }
                self.call(
                    &root_id,
                    Request::CreateDirectory {
                        path: relative_path,
                    },
                )?;
                Ok(())
            }
        }
    }

    pub fn remove_file(&self, path: &Path) -> Result<(), String> {
        match self.classify(path)? {
            StorageBackend::DirectFilesystem => fs::remove_file(path).map_err(|e| e.to_string()),
            StorageBackend::ProtectedFilesystem {
                root_id,
                relative_path,
            } => {
                self.call(
                    &root_id,
                    Request::Delete {
                        name: relative_path,
                    },
                )?;
                Ok(())
            }
        }
    }

    pub fn rename(&self, source: &Path, destination: &Path) -> Result<(), String> {
        match (self.classify(source)?, self.classify(destination)?) {
            (StorageBackend::DirectFilesystem, StorageBackend::DirectFilesystem) => {
                fs::rename(source, destination).map_err(|e| e.to_string())
            }
            (
                StorageBackend::ProtectedFilesystem {
                    root_id: a,
                    relative_path: source,
                },
                StorageBackend::ProtectedFilesystem {
                    root_id: b,
                    relative_path: destination,
                },
            ) if a == b => {
                self.call(
                    &a,
                    Request::Rename {
                        source,
                        destination,
                    },
                )?;
                Ok(())
            }
            _ => Err(
                "Pemindahan lintas batas proteksi harus memakai impor file, bukan rename.".into(),
            ),
        }
    }

    pub fn write_file(&self, path: &Path, data: &[u8]) -> Result<(), String> {
        match self.classify(path)? {
            StorageBackend::DirectFilesystem => fs::write(path, data).map_err(|e| e.to_string()),
            StorageBackend::ProtectedFilesystem {
                root_id,
                relative_path,
            } => self.upload(
                &root_id,
                &relative_path,
                data.len() as u64,
                path.exists(),
                &mut &data[..],
            ),
        }
    }

    pub fn set_folder_icon(&self, path: &Path, status: &str) -> Result<bool, String> {
        match self.classify(path)? {
            StorageBackend::DirectFilesystem => Ok(false),
            StorageBackend::ProtectedFilesystem {
                root_id,
                relative_path,
            } => {
                self.call(
                    &root_id,
                    Request::SetFolderIcon {
                        path: relative_path,
                        status: status.into(),
                    },
                )?;
                Ok(true)
            }
        }
    }

    fn upload(
        &self,
        root_id: &str,
        name: &str,
        size: u64,
        replace: bool,
        source: &mut impl Read,
    ) -> Result<(), String> {
        let begin = self.call(
            root_id,
            Request::BeginUpload {
                name: name.into(),
                size,
                replace,
            },
        )?;
        let id = begin["id"]
            .as_str()
            .ok_or("Service returned no upload id")?
            .to_string();
        let result = (|| {
            let mut offset = 0;
            let mut buffer = vec![0; super::MAX_BYTES];
            loop {
                let count = source.read(&mut buffer).map_err(|e| e.to_string())?;
                if count == 0 {
                    break;
                }
                self.call(
                    root_id,
                    Request::UploadChunk {
                        id: id.clone(),
                        offset,
                        data: STANDARD.encode(&buffer[..count]),
                    },
                )?;
                offset += count as u64;
            }
            self.call(root_id, Request::CommitUpload { id: id.clone() })?;
            Ok(())
        })();
        if result.is_err() {
            let _ = self.call(root_id, Request::AbortUpload { id });
        }
        result
    }

    pub fn copy_file(&self, source: &Path, destination: &Path) -> Result<(), String> {
        match (self.classify(source)?, self.classify(destination)?) {
            (
                StorageBackend::ProtectedFilesystem {
                    root_id: a,
                    relative_path: source,
                },
                StorageBackend::ProtectedFilesystem {
                    root_id: b,
                    relative_path: destination,
                },
            ) if a == b => {
                self.call(
                    &a,
                    Request::Copy {
                        source,
                        destination,
                    },
                )?;
                Ok(())
            }
            (
                _,
                StorageBackend::ProtectedFilesystem {
                    root_id,
                    relative_path,
                },
            ) => {
                let mut options = fs::OpenOptions::new();
                options.read(true);
                #[cfg(windows)]
                {
                    use std::os::windows::fs::OpenOptionsExt;
                    options.share_mode(1);
                }
                let mut file = options.open(source).map_err(|e| e.to_string())?;
                let size = file.metadata().map_err(|e| e.to_string())?.len();
                self.upload(&root_id, &relative_path, size, false, &mut file)
            }
            _ => {
                fs::copy(source, destination).map_err(|e| e.to_string())?;
                Ok(())
            }
        }
    }
}

fn dos_path(path: &str) -> String {
    if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{unc}")
    } else {
        path.strip_prefix(r"\\?\").unwrap_or(path).to_string()
    }
}

pub fn io_error(error: String) -> io::Error {
    io::Error::other(error)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn protected_failure_never_writes_directly() {
        let parent = std::env::var_os("MGO_TEST_PARENT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let temp = tempfile::tempdir_in(parent).unwrap();
        let root = temp.path().join("protected");
        fs::create_dir(&root).unwrap();
        let storage = Storage {
            roots: vec![Registration {
                root_id: "test".into(),
                aliases: vec![root.to_string_lossy().into()],
            }],
            transport: Box::new(|_| Err("service offline".into())),
            protocol: OnceLock::new(),
        };
        assert!(storage
            .write_file(&root.join("blocked.txt"), b"must not write")
            .is_err());
        assert!(!root.join("blocked.txt").exists());
        let direct = temp.path().join("normal.txt");
        storage.write_file(&direct, b"normal").unwrap();
        assert_eq!(fs::read(direct).unwrap(), b"normal");
    }
}
