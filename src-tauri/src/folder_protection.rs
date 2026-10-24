//! Phase 2: local, Windows-authenticated test-folder broker. No ACL mutations.
#[cfg(windows)]
#[path = "commands/folder_protection_admin.rs"]
pub mod admin;
#[cfg(windows)]
#[path = "commands/folder_protection_broker.rs"]
pub mod broker;
#[path = "commands/folder_protection_mapping.rs"]
pub mod mapping;
#[cfg(windows)]
#[path = "commands/folder_protection_registry.rs"]
pub mod registry;
#[path = "commands/folder_protection_storage.rs"]
pub mod storage;
#[cfg(windows)]
#[path = "commands/folder_protection_windows.rs"]
pub mod windows;

#[cfg(all(test, windows))]
#[path = "commands/folder_protection_tests.rs"]
mod native_tests;

use serde::{Deserialize, Serialize};

pub const PIPE: &str = r"\\.\pipe\MgoFolderProtection-v1";
pub const MAX_BYTES: usize = 1024 * 1024;
pub const MAX_FRAME: usize = 2 * MAX_BYTES;
pub const PROTOCOL_VERSION: u32 = 4;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    ForRoot {
        root_id: String,
        request: Box<Request>,
    },
    Status,
    Inspect,
    List,
    Read {
        name: String,
    },
    Create {
        name: String,
        data: String,
    },
    Update {
        name: String,
        data: String,
    },
    Delete {
        name: String,
    },
    ListDirectory {
        #[serde(default)]
        path: String,
    },
    CreateDirectory {
        path: String,
    },
    RemoveDirectory {
        path: String,
    },
    Rename {
        source: String,
        destination: String,
    },
    Copy {
        source: String,
        destination: String,
    },
    BeginUpload {
        name: String,
        size: u64,
        #[serde(default)]
        replace: bool,
    },
    UploadChunk {
        id: String,
        offset: u64,
        data: String,
    },
    CommitUpload {
        id: String,
    },
    AbortUpload {
        id: String,
    },
    SetFolderIcon {
        path: String,
        status: String,
    },
}

impl Request {
    pub fn is_write(&self) -> bool {
        if let Self::ForRoot { request, .. } = self {
            return request.is_write();
        }
        matches!(
            self,
            Self::Create { .. }
                | Self::Update { .. }
                | Self::Delete { .. }
                | Self::CreateDirectory { .. }
                | Self::RemoveDirectory { .. }
                | Self::Rename { .. }
                | Self::Copy { .. }
                | Self::BeginUpload { .. }
                | Self::UploadChunk { .. }
                | Self::CommitUpload { .. }
                | Self::AbortUpload { .. }
                | Self::SetFolderIcon { .. }
        )
    }
    pub fn label(&self) -> &'static str {
        match self {
            Self::ForRoot { request, .. } => request.label(),
            Self::Status => "status",
            Self::Inspect => "inspect",
            Self::List => "list",
            Self::Read { .. } => "read",
            Self::Create { .. } => "create",
            Self::Update { .. } => "update",
            Self::Delete { .. } => "delete",
            Self::ListDirectory { .. } => "list_directory",
            Self::CreateDirectory { .. } => "create_directory",
            Self::RemoveDirectory { .. } => "remove_directory",
            Self::Rename { .. } => "rename",
            Self::Copy { .. } => "copy",
            Self::BeginUpload { .. } => "begin_upload",
            Self::UploadChunk { .. } => "upload_chunk",
            Self::CommitUpload { .. } => "commit_upload",
            Self::AbortUpload { .. } => "abort_upload",
            Self::SetFolderIcon { .. } => "set_folder_icon",
        }
    }
    pub fn target(&self) -> Option<&str> {
        match self {
            Self::ForRoot { request, .. } => request.target(),
            Self::Read { name }
            | Self::Create { name, .. }
            | Self::Update { name, .. }
            | Self::Delete { name } => Some(name),
            Self::ListDirectory { path }
            | Self::CreateDirectory { path }
            | Self::RemoveDirectory { path } => Some(path),
            Self::Rename { source, .. } | Self::Copy { source, .. } => Some(source),
            Self::BeginUpload { name, .. } => Some(name),
            Self::SetFolderIcon { path, .. } => Some(path),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub success: bool,
    pub code: String,
    pub message: Option<String>,
    pub data: serde_json::Value,
}

impl Response {
    pub fn ok(data: serde_json::Value) -> Self {
        Self {
            success: true,
            code: "ok".into(),
            message: None,
            data,
        }
    }
    pub fn error(code: &str, message: impl ToString) -> Self {
        Self {
            success: false,
            code: code.into(),
            message: Some(message.to_string()),
            data: serde_json::Value::Null,
        }
    }
}

/// A single Windows component, also used by the handle-relative directory walker.
pub fn validate_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.len() > 180
        || name.starts_with('.')
        || name.ends_with('.')
        || name.ends_with(' ')
        || name.bytes().any(|b| b < 32 || b"\\/:*?\"<>|".contains(&b))
    {
        return Err(
            "invalid_path: use a single ASCII file name without streams or separators".into(),
        );
    }
    let stem = name
        .split('.')
        .next()
        .unwrap()
        .trim_end()
        .to_ascii_uppercase();
    if ["CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$"].contains(&stem.as_str())
        || ["COM¹", "COM²", "COM³", "LPT¹", "LPT²", "LPT³"].contains(&stem.as_str())
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.as_bytes()[3].is_ascii_digit())
    {
        return Err("invalid_path: reserved Windows device name".into());
    }
    Ok(())
}

pub fn relative_parts(path: &str, allow_root: bool) -> Result<Vec<&str>, String> {
    if path.is_empty() && allow_root {
        return Ok(Vec::new());
    }
    if path.len() > 2048 {
        return Err("invalid_path: path too long".into());
    }
    let parts: Vec<_> = path.split(['\\', '/']).collect();
    if parts.len() > 32 {
        return Err("invalid_path: path too deep".into());
    }
    for part in &parts {
        validate_name(part)?;
    }
    Ok(parts)
}

#[cfg(windows)]
pub async fn request(request: Request) -> Result<Response, String> {
    let sid =
        windows::registered_server_sid().map_err(|e| format!("service_not_registered: {e}"))?;
    broker::client(PIPE, &sid, request).await
}

#[cfg(not(windows))]
pub async fn request(_request: Request) -> Result<Response, String> {
    Err("Folder Protection prototype requires Windows.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_windows_path_escapes() {
        for name in [
            "",
            "..",
            "../x",
            r"a\b",
            r"C:\x",
            r"\\DEV\D\x",
            "x:secret",
            "CON.txt",
            "lpt1",
            "a.",
            "a ",
            ".mgo-stage",
            "x\0z",
            "NUL .txt",
        ] {
            assert!(validate_name(name).is_err(), "{name:?}");
        }
        assert!(validate_name("order 123.pdf").is_ok());
        assert!(validate_name("Pelanggan é.pdf").is_ok());
    }
    #[test]
    fn protocol_rejects_shell_and_extra_fields() {
        assert!(
            serde_json::from_str::<Request>(r#"{"operation":"shell","command":"whoami"}"#).is_err()
        );
        assert!(serde_json::from_str::<Request>(
            r#"{"operation":"delete","name":"a","root":"C:"}"#
        )
        .is_err());
    }
}
