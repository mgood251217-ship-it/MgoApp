use std::{
    ffi::OsStr,
    io,
    os::windows::{ffi::OsStrExt, process::CommandExt},
    path::Path,
    process::Command,
    ptr,
};
use windows_sys::Win32::{
    Foundation::{GetLastError, ERROR_NOT_FOUND, ERROR_SESSION_CREDENTIAL_CONFLICT, NO_ERROR},
    NetworkManagement::WNet::{WNetAddConnection2W, NETRESOURCEW, RESOURCETYPE_DISK},
    Security::Credentials::{
        CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    },
};

struct SmbTarget {
    host: String,
    share_path: String,
}

fn wide(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

fn parse_target(path: &str) -> Result<SmbTarget, String> {
    let normalized = path.replace('/', "\\");
    let unc = normalized
        .strip_prefix("\\\\")
        .ok_or("Akses Explorer LAN hanya tersedia untuk path UNC MGO.")?;
    let components: Vec<_> = unc.split('\\').collect();
    let mut parts = components.iter().copied();
    let host = parts.next().unwrap_or_default();
    let share = parts.next().unwrap_or_default();
    if host.is_empty()
        || share.is_empty()
        || components.iter().any(|part| *part == "." || *part == "..")
        || !host
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-'))
        || !share.to_ascii_uppercase().starts_with("MGOFP_")
        || !share
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        return Err("Path Explorer harus berupa share MGOFP_ pada server LAN.".into());
    }
    Ok(SmbTarget {
        host: host.into(),
        share_path: format!("\\\\{host}\\{share}"),
    })
}

pub fn is_mgo_share_path(path: &str) -> bool {
    parse_target(path).is_ok()
}

fn credential_target(host: &str) -> String {
    format!(
        "MgoDesktop:FolderProtection:SMB:{}",
        host.to_ascii_lowercase()
    )
}

fn connect(target: &SmbTarget, username: &str, password: &mut [u16]) -> Result<(), String> {
    let remote = wide(&target.share_path);
    let user = wide(username);
    let resource = NETRESOURCEW {
        dwType: RESOURCETYPE_DISK,
        lpRemoteName: remote.as_ptr() as *mut u16,
        ..NETRESOURCEW::default()
    };
    let status = unsafe { WNetAddConnection2W(&resource, password.as_ptr(), user.as_ptr(), 0) };
    password.fill(0);
    if status == NO_ERROR {
        Ok(())
    } else if status == ERROR_SESSION_CREDENTIAL_CONFLICT {
        Err(format!("Windows sudah tersambung ke {} memakai akun lain. Tutup koneksi SMB lama ke server ini, lalu simpan akses Explorer lagi.", target.host))
    } else {
        Err(format!(
            "Windows menolak akses SMB ke {} (kode {status}): {}",
            target.share_path,
            io::Error::from_raw_os_error(status as i32)
        ))
    }
}

pub fn save_credentials_and_connect(
    path: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    if username.trim().is_empty()
        || username.len() > 512
        || username.contains('\0')
        || password.is_empty()
        || password.len() > 1024
        || password.contains('\0')
    {
        return Err("Nama akun atau kata sandi Windows tidak valid.".into());
    }
    let target = parse_target(path)?;
    let mut secret: Vec<u16> = password.encode_utf16().chain(Some(0)).collect();
    connect(&target, username.trim(), &mut secret)?;

    let target_name = wide(&credential_target(&target.host));
    let user_name = wide(username.trim());
    let mut password_blob: Vec<u16> = password.encode_utf16().collect();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: target_name.as_ptr() as *mut u16,
        CredentialBlobSize: (password_blob.len() * std::mem::size_of::<u16>()) as u32,
        CredentialBlob: password_blob.as_mut_ptr() as *mut u8,
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: user_name.as_ptr() as *mut u16,
        ..unsafe { std::mem::zeroed() }
    };
    let saved = unsafe { CredWriteW(&credential, 0) } != 0;
    password_blob.fill(0);
    if !saved {
        let error = unsafe { GetLastError() };
        return Err(format!(
            "Koneksi SMB berhasil, tetapi Windows Credential Manager gagal menyimpan akun (kode {error}): {}",
            io::Error::from_raw_os_error(error as i32)
        ));
    }
    Ok(())
}

pub fn save_credentials_and_open(path: &str, username: &str, password: &str) -> Result<(), String> {
    save_credentials_and_connect(path, username, password)?;
    Command::new("explorer")
        .arg(Path::new(path))
        .creation_flags(0x08000000)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Explorer gagal dibuka: {error}"))
}

pub fn connect_saved(path: &str) -> Result<(), String> {
    let target = parse_target(path)?;
    let target_name = wide(&credential_target(&target.host));
    let mut credential = ptr::null_mut();
    if unsafe { CredReadW(target_name.as_ptr(), CRED_TYPE_GENERIC, 0, &mut credential) } == 0 {
        let error = unsafe { GetLastError() };
        if error == ERROR_NOT_FOUND {
            return Err(format!(
                "Akses Explorer ke {} belum disiapkan. Isi akun Windows server sekali pada Folder Protection LAN.",
                target.host
            ));
        }
        return Err(format!(
            "Akun SMB tidak dapat dibaca dari Windows Credential Manager (kode {error}): {}",
            io::Error::from_raw_os_error(error as i32)
        ));
    }

    let result = unsafe {
        let credential = &*credential;
        if credential.UserName.is_null()
            || credential.CredentialBlob.is_null()
            || credential.CredentialBlobSize == 0
            || credential.CredentialBlobSize % 2 != 0
            || credential.CredentialBlobSize > 4096
        {
            Err("Simpan akses Explorer perlu diatur ulang.".to_string())
        } else {
            let mut password = std::slice::from_raw_parts(
                credential.CredentialBlob as *const u16,
                credential.CredentialBlobSize as usize / 2,
            )
            .to_vec();
            password.push(0);
            let mut username_len = 0usize;
            while username_len < 512 && *credential.UserName.add(username_len) != 0 {
                username_len += 1;
            }
            if username_len == 512 {
                password.fill(0);
                Err("Akun Windows tersimpan tidak valid.".to_string())
            } else {
                let username = String::from_utf16_lossy(std::slice::from_raw_parts(
                    credential.UserName,
                    username_len,
                ));
                connect(&target, &username, &mut password)
            }
        }
    };
    unsafe {
        CredFree(credential as _);
    }
    result
}

pub fn open_explorer(path: &str) -> Result<(), String> {
    connect_saved(path)?;
    Command::new("explorer")
        .arg(Path::new(path))
        .creation_flags(0x08000000)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Explorer gagal dibuka: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{is_mgo_share_path, parse_target};

    #[test]
    fn explorer_credentials_are_scoped_to_mgo_shares() {
        let target = parse_target(r"\\DEV\MGOFP_2804501245431100\2026\10").unwrap();
        assert_eq!(target.host, "DEV");
        assert_eq!(target.share_path, r"\\DEV\MGOFP_2804501245431100");
        assert!(!is_mgo_share_path(r"\\DEV\D\TEST PATH FOLDER"));
        assert!(!is_mgo_share_path(r"D:\TEST PATH FOLDER"));
        assert!(parse_target(r"\\DEV\MGOFP_x\..\D").is_err());
    }
}
