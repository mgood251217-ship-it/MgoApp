//! Small Win32 boundary. All native handles and allocated descriptors have RAII owners.
use std::{
    ffi::c_void,
    fs::File,
    io, mem,
    os::windows::{
        ffi::OsStrExt,
        io::{AsRawHandle, FromRawHandle},
    },
    path::{Path, PathBuf},
    ptr,
};
use windows_sys::Win32::{
    Foundation::{CloseHandle, LocalFree, HANDLE, INVALID_HANDLE_VALUE},
    Security::{Authorization::*, *},
    Storage::FileSystem::*,
    System::{
        Pipes::ImpersonateNamedPipeClient,
        Threading::{GetCurrentProcess, GetCurrentThread, OpenProcessToken, OpenThreadToken},
    },
};

pub fn wide(value: &std::ffi::OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}
pub fn raw(file: &File) -> HANDLE {
    file.as_raw_handle() as HANDLE
}
pub fn checked(ok: i32) -> io::Result<()> {
    if ok == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

pub struct Local(pub *mut c_void);
impl Drop for Local {
    fn drop(&mut self) {
        unsafe {
            LocalFree(self.0);
        }
    }
}
pub struct Handle(pub HANDLE);
impl Drop for Handle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.0);
        }
    }
}

fn sid_string(sid: PSID) -> io::Result<String> {
    unsafe {
        let mut out = ptr::null_mut();
        checked(ConvertSidToStringSidW(sid, &mut out))?;
        let _allocated = Local(out as _);
        let mut len = 0;
        while *out.add(len) != 0 {
            len += 1;
        }
        Ok(String::from_utf16_lossy(std::slice::from_raw_parts(
            out, len,
        )))
    }
}

fn token_sid(token: HANDLE) -> io::Result<String> {
    unsafe {
        let mut size = 0;
        GetTokenInformation(token, TokenUser, ptr::null_mut(), 0, &mut size);
        // usize allocation ensures TOKEN_USER alignment.
        let mut buffer = vec![0usize; (size as usize).div_ceil(mem::size_of::<usize>())];
        checked(GetTokenInformation(
            token,
            TokenUser,
            buffer.as_mut_ptr() as _,
            size,
            &mut size,
        ))?;
        sid_string((*(buffer.as_ptr() as *const TOKEN_USER)).User.Sid)
    }
}

pub fn process_sid() -> io::Result<String> {
    unsafe {
        let mut token = ptr::null_mut();
        checked(OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY,
            &mut token,
        ))?;
        let token = Handle(token);
        token_sid(token.0)
    }
}

pub fn server_sid(pipe: &impl AsRawHandle) -> io::Result<String> {
    use windows_sys::Win32::System::{
        Pipes::GetNamedPipeServerProcessId,
        Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
    };
    let mut pid = 0;
    unsafe {
        checked(GetNamedPipeServerProcessId(
            pipe.as_raw_handle() as _,
            &mut pid,
        ))?;
    }
    let process_identity = (|| unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return Err(io::Error::last_os_error());
        }
        let process = Handle(process);
        let mut token = ptr::null_mut();
        checked(OpenProcessToken(process.0, TOKEN_QUERY, &mut token))?;
        let token = Handle(token);
        token_sid(token.0)
    })();
    match process_identity {
        Ok(sid) => Ok(sid),
        // Standard users may not query a separate service account's process token.
        // Authenticate against the administrator-controlled SCM registration instead.
        Err(e) if e.kind() == io::ErrorKind::PermissionDenied => scm_server_sid(pid),
        Err(e) => Err(e),
    }
}

fn scm_server_sid(pipe_server_pid: u32) -> io::Result<String> {
    use windows_service::{
        service::{ServiceAccess, ServiceState, ServiceType},
        service_manager::{ServiceManager, ServiceManagerAccess},
    };
    const ACCOUNT: &str = r"NT SERVICE\MgoFolderProtection";
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
        .map_err(io::Error::other)?;
    let service = manager
        .open_service(
            "MgoFolderProtection",
            ServiceAccess::QUERY_STATUS | ServiceAccess::QUERY_CONFIG,
        )
        .map_err(io::Error::other)?;
    let status = service.query_status().map_err(io::Error::other)?;
    let config = service.query_config().map_err(io::Error::other)?;
    if status.current_state != ServiceState::Running
        || status.process_id != Some(pipe_server_pid)
        || config.service_type != ServiceType::OWN_PROCESS
        || !config
            .account_name
            .is_some_and(|s| s.to_string_lossy().eq_ignore_ascii_case(ACCOUNT))
    {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "Pipe server does not match the registered virtual-account service",
        ));
    }
    let name = wide(std::ffi::OsStr::new(ACCOUNT));
    let mut sid_size = 0;
    let mut domain_size = 0;
    let mut kind = 0;
    unsafe {
        LookupAccountNameW(
            ptr::null(),
            name.as_ptr(),
            ptr::null_mut(),
            &mut sid_size,
            ptr::null_mut(),
            &mut domain_size,
            &mut kind,
        );
        if sid_size == 0 {
            return Err(io::Error::last_os_error());
        }
        let mut sid = vec![0usize; (sid_size as usize).div_ceil(mem::size_of::<usize>())];
        let mut domain = vec![0u16; domain_size as usize];
        checked(LookupAccountNameW(
            ptr::null(),
            name.as_ptr(),
            sid.as_mut_ptr() as _,
            &mut sid_size,
            domain.as_mut_ptr(),
            &mut domain_size,
            &mut kind,
        ))?;
        sid_string(sid.as_mut_ptr() as _)
    }
}

pub fn registered_server_sid() -> io::Result<String> {
    let sid = registered_value("ServerSid")?.ok_or_else(|| io::Error::from_raw_os_error(2))?;
    if !sid.starts_with("S-1-") {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid registered service SID",
        ));
    }
    Ok(sid)
}

pub fn registered_value(value_name: &str) -> io::Result<Option<String>> {
    use windows_sys::Win32::System::Registry::*;
    let key = wide(std::ffi::OsStr::new(r"SOFTWARE\MGO\FolderProtection"));
    let value = wide(std::ffi::OsStr::new(value_name));
    let mut text = vec![0u16; 131072];
    let mut size = (text.len() * 2) as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_LOCAL_MACHINE,
            key.as_ptr(),
            value.as_ptr(),
            RRF_RT_REG_SZ | RRF_SUBKEY_WOW6464KEY,
            ptr::null_mut(),
            text.as_mut_ptr() as _,
            &mut size,
        )
    };
    if status == 2 {
        return Ok(None);
    }
    if status != 0 {
        return Err(io::Error::from_raw_os_error(status as i32));
    }
    let sid =
        String::from_utf16_lossy(&text[..text.iter().position(|c| *c == 0).unwrap_or(text.len())]);
    Ok(Some(sid))
}

/// Must run synchronously on one thread after reading the client's request.
/// Revert before any privileged filesystem work; never hold impersonation across await.
pub fn caller_sid(pipe: &impl AsRawHandle) -> io::Result<String> {
    unsafe {
        checked(ImpersonateNamedPipeClient(pipe.as_raw_handle() as _))?;
        let result = (|| {
            let mut token = ptr::null_mut();
            checked(OpenThreadToken(
                GetCurrentThread(),
                TOKEN_QUERY,
                1,
                &mut token,
            ))?;
            let token = Handle(token);
            token_sid(token.0)
        })();
        if RevertToSelf() == 0 {
            // Continuing under the wrong security identity is unsafe.
            std::process::abort();
        }
        result
    }
}

pub fn descriptor(sddl: &str) -> io::Result<Local> {
    let mut sd = ptr::null_mut();
    let text = wide(std::ffi::OsStr::new(sddl));
    unsafe {
        checked(ConvertStringSecurityDescriptorToSecurityDescriptorW(
            text.as_ptr(),
            SDDL_REVISION_1,
            &mut sd,
            ptr::null_mut(),
        ))?;
    }
    Ok(Local(sd))
}

pub fn open(path: &Path, access: u32, disposition: u32, sharing: u32) -> io::Result<File> {
    let name = wide(path.as_os_str());
    let handle = unsafe {
        CreateFileW(
            name.as_ptr(),
            access,
            sharing,
            ptr::null(),
            disposition,
            FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS,
            ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    let file = unsafe { File::from_raw_handle(handle as _) };
    let info = information(&file)?;
    if info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 || info.nNumberOfLinks > 1 {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "Reparse points and hard links are not permitted",
        ));
    }
    Ok(file)
}

pub fn information(file: &File) -> io::Result<BY_HANDLE_FILE_INFORMATION> {
    let mut info = unsafe { mem::zeroed() };
    unsafe {
        checked(GetFileInformationByHandle(raw(file), &mut info))?;
    }
    Ok(info)
}

/// Open exactly one component relative to an already authorized directory object.
/// Never re-resolve a client-supplied absolute path during data operations.
pub fn open_child(root: &File, name: &str, access: u32, create: bool) -> io::Result<File> {
    open_relative(root, name, access, create, false)
}

pub fn open_directory(root: &File, name: &str, create: bool) -> io::Result<File> {
    open_relative(
        root,
        name,
        FILE_LIST_DIRECTORY
            | FILE_ADD_FILE
            | FILE_ADD_SUBDIRECTORY
            | FILE_WRITE_ATTRIBUTES
            | READ_CONTROL,
        create,
        true,
    )
}

pub fn open_directory_for_delete(root: &File, name: &str) -> io::Result<File> {
    open_relative(
        root,
        name,
        FILE_LIST_DIRECTORY | DELETE | FILE_WRITE_ATTRIBUTES,
        false,
        true,
    )
}

fn open_relative(
    root: &File,
    name: &str,
    access: u32,
    create: bool,
    directory: bool,
) -> io::Result<File> {
    open_relative_shared(
        root,
        name,
        access,
        create,
        directory,
        if directory {
            FILE_SHARE_READ | FILE_SHARE_WRITE
        } else {
            FILE_SHARE_READ
        },
    )
}

pub fn admin_child(root: &File, name: &str, directory: bool) -> io::Result<File> {
    open_relative_shared(
        root,
        name,
        READ_CONTROL
            | WRITE_DAC
            | WRITE_OWNER
            | if directory {
                FILE_LIST_DIRECTORY
            } else {
                FILE_READ_DATA
            },
        false,
        directory,
        FILE_SHARE_READ,
    )
}

fn open_relative_shared(
    root: &File,
    name: &str,
    access: u32,
    create: bool,
    directory: bool,
    sharing: u32,
) -> io::Result<File> {
    use windows_sys::{
        Wdk::{Foundation::OBJECT_ATTRIBUTES, Storage::FileSystem as nt},
        Win32::{
            Foundation::{RtlNtStatusToDosError, OBJ_CASE_INSENSITIVE, UNICODE_STRING},
            System::IO::IO_STATUS_BLOCK,
        },
    };
    let mut text: Vec<u16> = name.encode_utf16().collect();
    let mut unicode = UNICODE_STRING {
        Length: (text.len() * 2) as u16,
        MaximumLength: (text.len() * 2) as u16,
        Buffer: text.as_mut_ptr(),
    };
    let attributes = OBJECT_ATTRIBUTES {
        Length: mem::size_of::<OBJECT_ATTRIBUTES>() as u32,
        RootDirectory: raw(root),
        ObjectName: &mut unicode,
        Attributes: OBJ_CASE_INSENSITIVE,
        SecurityDescriptor: ptr::null_mut(),
        SecurityQualityOfService: ptr::null_mut(),
    };
    let mut handle = ptr::null_mut();
    let mut io_status: IO_STATUS_BLOCK = unsafe { mem::zeroed() };
    let status = unsafe {
        nt::NtCreateFile(
            &mut handle,
            access | SYNCHRONIZE | FILE_READ_ATTRIBUTES,
            &attributes,
            &mut io_status,
            ptr::null(),
            if directory {
                FILE_ATTRIBUTE_DIRECTORY
            } else {
                FILE_ATTRIBUTE_NORMAL
            },
            sharing,
            if create {
                nt::FILE_CREATE
            } else {
                nt::FILE_OPEN
            },
            nt::FILE_OPEN_REPARSE_POINT
                | nt::FILE_SYNCHRONOUS_IO_NONALERT
                | if directory {
                    nt::FILE_DIRECTORY_FILE
                } else {
                    nt::FILE_NON_DIRECTORY_FILE
                },
            ptr::null(),
            0,
        )
    };
    if status < 0 {
        return Err(io::Error::from_raw_os_error(
            unsafe { RtlNtStatusToDosError(status) } as i32,
        ));
    }
    let file = unsafe { File::from_raw_handle(handle as _) };
    let info = information(&file)?;
    if info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 || info.nNumberOfLinks != 1 {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "Reparse points and hard links are not permitted",
        ));
    }
    Ok(file)
}

pub fn list(root: &File) -> io::Result<Vec<String>> {
    let mut buffer = vec![0u64; 8192];
    let mut names = Vec::new();
    let mut class = FileIdBothDirectoryRestartInfo;
    loop {
        let ok = unsafe {
            GetFileInformationByHandleEx(
                raw(root),
                class,
                buffer.as_mut_ptr() as _,
                (buffer.len() * 8) as u32,
            )
        };
        if ok == 0 {
            let e = io::Error::last_os_error();
            if e.raw_os_error() == Some(windows_sys::Win32::Foundation::ERROR_NO_MORE_FILES as i32)
            {
                break;
            }
            return Err(e);
        }
        class = FileIdBothDirectoryInfo;
        let mut offset = 0usize;
        loop {
            let entry = unsafe {
                &*((buffer.as_ptr() as *const u8).add(offset) as *const FILE_ID_BOTH_DIR_INFO)
            };
            let len = entry.FileNameLength as usize / 2;
            if offset + mem::offset_of!(FILE_ID_BOTH_DIR_INFO, FileName) + len * 2
                > buffer.len() * 8
            {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "Invalid directory record",
                ));
            }
            let name = unsafe {
                String::from_utf16_lossy(std::slice::from_raw_parts(entry.FileName.as_ptr(), len))
            };
            if name != "." && name != ".." {
                names.push(name);
            }
            if names.len() > 1000 {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "Too many files for test prototype",
                ));
            }
            if entry.NextEntryOffset == 0 {
                break;
            }
            offset += entry.NextEntryOffset as usize;
        }
    }
    Ok(names)
}

pub fn file_id(file: &File) -> io::Result<String> {
    let i = information(file)?;
    Ok(format!(
        "{}:{}:{}",
        i.dwVolumeSerialNumber, i.nFileIndexHigh, i.nFileIndexLow
    ))
}

pub fn require_ntfs(directory: &File) -> io::Result<()> {
    let mut name = [0u16; 32];
    unsafe {
        checked(GetVolumeInformationByHandleW(
            raw(directory),
            ptr::null_mut(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            name.as_mut_ptr(),
            name.len() as u32,
        ))?;
    }
    let name =
        String::from_utf16_lossy(&name[..name.iter().position(|c| *c == 0).unwrap_or(name.len())]);
    if !name.eq_ignore_ascii_case("NTFS") {
        return Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Phase 2 requires a local NTFS volume",
        ));
    }
    Ok(())
}

/// Pin every ancestor without write/delete sharing, and refuse all reparse points.
/// Holding these handles prevents ancestor replacement between validation and use.
pub fn pin_directory(path: &Path) -> io::Result<Vec<File>> {
    pin_directory_with_leaf_sharing(path, FILE_SHARE_READ)
}

/// Private state needs child replacement while its own directory remains pinned.
/// The caller must validate the private ACL before updating any entries.
pub fn pin_state_for_update(path: &Path) -> io::Result<Vec<File>> {
    pin_directory_with_leaf_sharing(path, FILE_SHARE_READ | FILE_SHARE_WRITE)
}

fn pin_directory_with_leaf_sharing(path: &Path, leaf_sharing: u32) -> io::Result<Vec<File>> {
    let spelling = path.to_string_lossy();
    if !path.is_absolute()
        || spelling.len() < 3
        || !spelling.as_bytes()[0].is_ascii_alphabetic()
        || &spelling.as_bytes()[1..3] != b":\\"
        || spelling.contains('\0')
        || spelling[3..].split(['\\', '/']).any(|s| {
            s == "." || s == ".." || s.contains(':') || s.ends_with('.') || s.ends_with(' ')
        })
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "A local absolute DOS path is required",
        ));
    }
    let mut handles = Vec::new();
    let mut current = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::Prefix(_) => {
                current.push(component);
                continue;
            }
            std::path::Component::ParentDir | std::path::Component::CurDir => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "Traversal rejected",
                ))
            }
            _ => current.push(component),
        }
        // READ_ATTRIBUTES alone does not participate in Windows share-access checks.
        let file = open(
            &current,
            FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | READ_CONTROL,
            OPEN_EXISTING,
            if current == path {
                leaf_sharing
            } else {
                FILE_SHARE_READ
            },
        )?;
        if information(&file)?.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Not a directory",
            ));
        }
        handles.push(file);
    }
    if handles.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Missing directory",
        ));
    }
    Ok(handles)
}

fn security(file: &File) -> io::Result<(Local, PSID, *mut ACL)> {
    let mut sd = ptr::null_mut();
    let mut owner = ptr::null_mut();
    let mut dacl = ptr::null_mut();
    let status = unsafe {
        GetSecurityInfo(
            raw(file),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner,
            ptr::null_mut(),
            &mut dacl,
            ptr::null_mut(),
            &mut sd,
        )
    };
    if status != 0 {
        return Err(io::Error::from_raw_os_error(status as i32));
    }
    Ok((Local(sd), owner, dacl))
}

pub fn sddl(file: &File) -> io::Result<String> {
    let (sd, _, _) = security(file)?;
    let mut out = ptr::null_mut();
    let mut len = 0;
    unsafe {
        checked(ConvertSecurityDescriptorToStringSecurityDescriptorW(
            sd.0,
            SDDL_REVISION_1,
            OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut out,
            &mut len,
        ))?;
        let _allocated = Local(out as _);
        Ok(String::from_utf16_lossy(std::slice::from_raw_parts(
            out,
            len.saturating_sub(1) as usize,
        )))
    }
}

/// Service configuration, audit and recovery records must not be writable by clients.
/// This check reads ACLs; it never repairs them or changes ownership.
pub fn require_private(file: &File, service_sid: &str) -> io::Result<()> {
    let (_sd, owner, acl) = security(file)?;
    let trusted = |sid: &str| sid == service_sid || sid == "S-1-5-18" || sid == "S-1-5-32-544";
    if !trusted(&sid_string(owner)?) || acl.is_null() {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "State/config owner or null DACL is unsafe",
        ));
    }
    unsafe {
        for index in 0..(*acl).AceCount {
            let mut ace = ptr::null_mut();
            checked(GetAce(acl, index as u32, &mut ace))?;
            let header = &*(ace as *const ACE_HEADER);
            if header.AceFlags & INHERIT_ONLY_ACE as u8 != 0 {
                continue;
            }
            match header.AceType {
                0 => {
                    let allow = &*(ace as *const ACCESS_ALLOWED_ACE);
                    // Generic all/write, delete, write owner/DACL, data/EA/attribute writes,
                    // create child and delete child. Conservative: ignores deny exceptions.
                    if allow.Mask & 0x500d_0156 != 0
                        && !trusted(&sid_string(&allow.SidStart as *const _ as _)?)
                    {
                        return Err(io::Error::new(
                            io::ErrorKind::PermissionDenied,
                            "State/config writable by an untrusted principal",
                        ));
                    }
                }
                1 => (), // Deny ACE cannot grant additional access.
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::PermissionDenied,
                        "Unsupported state/config ACL; review required",
                    ))
                }
            }
        }
    }
    Ok(())
}

pub fn delete_open_file(file: &File) -> io::Result<()> {
    let info = FILE_DISPOSITION_INFO { DeleteFile: true };
    unsafe {
        checked(SetFileInformationByHandle(
            raw(file),
            FileDispositionInfo,
            &info as *const _ as _,
            mem::size_of_val(&info) as u32,
        ))
    }
}

pub fn add_attributes(file: &File, attributes: u32) -> io::Result<()> {
    set_attributes(
        file,
        (information(file)?.dwFileAttributes & !FILE_ATTRIBUTE_NORMAL) | attributes,
    )
}

pub fn set_attributes(file: &File, attributes: u32) -> io::Result<()> {
    let mut basic: FILE_BASIC_INFO = unsafe { mem::zeroed() };
    basic.FileAttributes = attributes;
    unsafe {
        checked(SetFileInformationByHandle(
            raw(file),
            FileBasicInfo,
            &basic as *const _ as _,
            mem::size_of_val(&basic) as u32,
        ))
    }
}

/// Rename the opened staging file over the destination entry (no link traversal).
pub fn commit(file: &File, root: &File, destination: &str, replace: bool) -> io::Result<()> {
    use windows_sys::{
        Wdk::Storage::FileSystem as nt,
        Win32::{Foundation::RtlNtStatusToDosError, System::IO::IO_STATUS_BLOCK},
    };
    let name: Vec<u16> = destination.encode_utf16().collect();
    let offset = mem::offset_of!(FILE_RENAME_INFO, FileName);
    let size = offset + name.len() * 2;
    let mut buffer = vec![0usize; size.div_ceil(mem::size_of::<usize>())];
    unsafe {
        let info = buffer.as_mut_ptr() as *mut FILE_RENAME_INFO;
        (*info).Anonymous.ReplaceIfExists = replace;
        (*info).RootDirectory = raw(root);
        (*info).FileNameLength = (name.len() * 2) as u32;
        ptr::copy_nonoverlapping(name.as_ptr(), (*info).FileName.as_mut_ptr(), name.len());
        let mut io_status: IO_STATUS_BLOCK = mem::zeroed();
        let status = nt::NtSetInformationFile(
            raw(file),
            &mut io_status,
            info as _,
            size as u32,
            nt::FileRenameInformation,
        );
        if status < 0 {
            Err(io::Error::from_raw_os_error(
                RtlNtStatusToDosError(status) as i32
            ))
        } else {
            Ok(())
        }
    }
}

/// Read-only preflight: parent ownership/delete-child/security-control can undermine a child ACL.
pub fn parent_security_conflicts(file: &File, service_sid: &str) -> io::Result<Vec<String>> {
    let (_sd, owner, acl) = security(file)?;
    let trusted = |sid: &str| sid == service_sid || sid == "S-1-5-18" || sid == "S-1-5-32-544";
    let mut conflicts = Vec::new();
    let owner_sid = sid_string(owner)?;
    if !trusted(&owner_sid) && !owner_sid.starts_with("S-1-5-80-") {
        conflicts.push(format!("Pemilik folder induk {owner_sid} dapat mengubah izinnya; perlu peninjauan administrator."));
    }
    if acl.is_null() {
        conflicts.push("Folder induk mempunyai DACL kosong/tidak dibatasi.".into());
        return Ok(conflicts);
    }
    unsafe {
        for index in 0..(*acl).AceCount {
            let mut ace = ptr::null_mut();
            checked(GetAce(acl, index as u32, &mut ace))?;
            let header = &*(ace as *const ACE_HEADER);
            if header.AceFlags & INHERIT_ONLY_ACE as u8 != 0 {
                continue;
            }
            if header.AceType == 0 {
                let allow = &*(ace as *const ACCESS_ALLOWED_ACE);
                let sid = sid_string(&allow.SidStart as *const _ as _)?;
                if allow.Mask & 0x100d_0040 != 0 && !trusted(&sid) {
                    conflicts.push(format!("Folder induk memberi {sid} hak menghapus anak atau mengubah keamanan. Proteksi anak belum aman."));
                }
            } else if header.AceType != 1 {
                conflicts
                    .push("Jenis izin folder induk memerlukan peninjauan administrator.".into());
            }
        }
    }
    Ok(conflicts)
}

pub fn known_folder(id: &windows_sys::core::GUID) -> io::Result<PathBuf> {
    let mut path = ptr::null_mut();
    let result = unsafe {
        windows_sys::Win32::UI::Shell::SHGetKnownFolderPath(id, 0, ptr::null_mut(), &mut path)
    };
    if result < 0 {
        return Err(io::Error::other(format!("Known folder HRESULT {result}")));
    }
    let mut len = 0;
    while unsafe { *path.add(len) } != 0 {
        len += 1;
    }
    let value = PathBuf::from(String::from_utf16_lossy(unsafe {
        std::slice::from_raw_parts(path, len)
    }));
    unsafe {
        windows_sys::Win32::System::Com::CoTaskMemFree(path as _);
    }
    Ok(value)
}

pub fn is_admin() -> io::Result<bool> {
    let descriptor = descriptor("O:BAG:BAD:(A;;GA;;;BA)")?;
    let mut owner = ptr::null_mut();
    let mut defaulted = 0;
    unsafe {
        checked(GetSecurityDescriptorOwner(
            descriptor.0,
            &mut owner,
            &mut defaulted,
        ))?;
        let mut member = 0;
        checked(CheckTokenMembership(ptr::null_mut(), owner, &mut member))?;
        Ok(member != 0)
    }
}

pub fn enable_restore_privilege() -> io::Result<()> {
    unsafe {
        let mut token = ptr::null_mut();
        checked(OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
            &mut token,
        ))?;
        let token = Handle(token);
        for privilege_name in ["SeRestorePrivilege", "SeTakeOwnershipPrivilege"] {
            let name = wide(std::ffi::OsStr::new(privilege_name));
            let mut privileges: TOKEN_PRIVILEGES = mem::zeroed();
            privileges.PrivilegeCount = 1;
            checked(LookupPrivilegeValueW(
                ptr::null(),
                name.as_ptr(),
                &mut privileges.Privileges[0].Luid,
            ))?;
            privileges.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
            checked(AdjustTokenPrivileges(
                token.0,
                0,
                &privileges,
                0,
                ptr::null_mut(),
                ptr::null_mut(),
            ))?;
            let error = windows_sys::Win32::Foundation::GetLastError();
            if error != 0 {
                return Err(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    format!(
                        "Tidak dapat mengaktifkan {privilege_name}: {}",
                        io::Error::from_raw_os_error(error as i32)
                    ),
                ));
            }
        }
    }
    Ok(())
}

pub fn set_security(file: &File, sddl: &str) -> io::Result<()> {
    let sd = descriptor(sddl)?;
    let mut acl = ptr::null_mut();
    let (mut defaulted, mut present, mut control, mut revision) = (0, 0, 0, 0);
    unsafe {
        checked(GetSecurityDescriptorDacl(
            sd.0,
            &mut present,
            &mut acl,
            &mut defaulted,
        ))?;
        checked(GetSecurityDescriptorControl(
            sd.0,
            &mut control,
            &mut revision,
        ))?;
        if present == 0 || acl.is_null() {
            return Err(io::Error::other(
                "Unrestricted DACL restoration is not supported",
            ));
        }
        if SetKernelObjectSecurity(raw(file), OWNER_SECURITY_INFORMATION, sd.0) == 0 {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                format!("Owner: {}", io::Error::last_os_error()),
            ));
        }
        let status = SetSecurityInfo(
            raw(file),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION
                | if control & SE_DACL_PROTECTED != 0 {
                    PROTECTED_DACL_SECURITY_INFORMATION
                } else {
                    UNPROTECTED_DACL_SECURITY_INFORMATION
                },
            ptr::null_mut(),
            ptr::null_mut(),
            acl,
            ptr::null(),
        );
        if status != 0 {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                format!("DACL: {}", io::Error::from_raw_os_error(status as i32)),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod security_handle_tests {
    use super::*;

    #[test]
    fn replace_catalog_under_pinned_parent() {
        let temp = tempfile::tempdir().unwrap();
        let old = temp.path().join("service.json");
        let next = temp.path().join("service.next");
        std::fs::write(&old, b"old").unwrap();
        std::fs::write(&next, b"new").unwrap();
        let pins = pin_state_for_update(temp.path()).unwrap();
        let staged = open(&next, DELETE | READ_CONTROL, OPEN_EXISTING, FILE_SHARE_READ).unwrap();
        commit(&staged, pins.last().unwrap(), "service.json", true).unwrap();
        drop(staged);
        assert_eq!(std::fs::read(&old).unwrap(), b"new");
    }

    #[test]
    fn set_security_on_pinned_directory() {
        let temp = tempfile::tempdir().unwrap();
        let child = temp.path().join("root");
        std::fs::create_dir(&child).unwrap();
        let _parents = pin_directory(temp.path()).unwrap();
        let file = open(
            &child,
            FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | READ_CONTROL | WRITE_DAC | WRITE_OWNER,
            OPEN_EXISTING,
            FILE_SHARE_READ,
        )
        .unwrap();
        let original = sddl(&file).unwrap();
        set_security(&file, &original).expect("restore unchanged security through pinned handle");
    }

    #[test]
    fn set_inheritable_acl_with_migration_handles_open() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::write(temp.path().join("child.txt"), b"data").unwrap();
        let root = open(
            temp.path(),
            FILE_LIST_DIRECTORY | READ_CONTROL | WRITE_DAC | WRITE_OWNER,
            OPEN_EXISTING,
            FILE_SHARE_READ,
        )
        .unwrap();
        let _child = admin_child(&root, "child.txt", false).unwrap();
        let sid = process_sid().unwrap();
        set_security(
            &root,
            &format!("O:{sid}G:{sid}D:P(A;OICI;FA;;;{sid})(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)"),
        )
        .unwrap();
    }
}
