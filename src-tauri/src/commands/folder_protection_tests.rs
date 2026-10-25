#![cfg(windows)]
use crate::folder_protection::{
    broker::{self, Broker, Config, User},
    windows, Request,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

pub(super) struct Fixture {
    _temp: tempfile::TempDir,
    pub(super) root: PathBuf,
    state: PathBuf,
    pub(super) config: PathBuf,
    pub(super) sid: String,
}

struct ServiceWorker {
    thread: Option<std::thread::JoinHandle<()>>,
    stop: Arc<AtomicBool>,
}
impl Drop for ServiceWorker {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
impl Fixture {
    pub(super) fn new(write: bool) -> Self {
        let parent = std::env::var_os("MGO_TEST_PARENT")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
            .unwrap_or_else(std::env::temp_dir);
        let temp = tempfile::Builder::new()
            .prefix("MGO-protection-test-")
            .tempdir_in(parent)
            .unwrap();
        // Make each disposable fixture independent from the caller's TEMP ACL.
        // Production rejects private state writable by any unrelated principal,
        // so the test container must explicitly model that same boundary.
        let sid = windows::process_sid().unwrap();
        let temp_handle = windows::open(
            temp.path(),
            windows_sys::Win32::Storage::FileSystem::READ_CONTROL
                | windows_sys::Win32::Storage::FileSystem::WRITE_DAC
                | windows_sys::Win32::Storage::FileSystem::WRITE_OWNER,
            windows_sys::Win32::Storage::FileSystem::OPEN_EXISTING,
            windows_sys::Win32::Storage::FileSystem::FILE_SHARE_READ
                | windows_sys::Win32::Storage::FileSystem::FILE_SHARE_WRITE
                | windows_sys::Win32::Storage::FileSystem::FILE_SHARE_DELETE,
        )
        .unwrap();
        windows::set_security(
            &temp_handle,
            &format!("O:{sid}G:{sid}D:P(A;OICI;FA;;;{sid})(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)"),
        )
        .unwrap();
        drop(temp_handle);
        let root = temp.path().join("MGO-Test");
        fs::create_dir(&root).unwrap();
        let state = temp.path().join("state");
        fs::create_dir(&state).unwrap();
        let config = state.join("service.json");
        let settings = Config {
            root: root.clone(),
            state_directory: state.clone(),
            users: vec![User {
                sid: sid.clone(),
                write,
            }],
            aliases: Vec::new(),
        };
        fs::write(&config, serde_json::to_vec(&settings).unwrap()).unwrap();
        Self {
            _temp: temp,
            root,
            state,
            config,
            sid,
        }
    }
}
fn create(name: &str, data: &[u8]) -> Request {
    Request::Create {
        name: name.into(),
        data: STANDARD.encode(data),
    }
}
fn update(name: &str, data: &[u8]) -> Request {
    Request::Update {
        name: name.into(),
        data: STANDARD.encode(data),
    }
}

#[test]
fn local_crud_atomic_failure_and_acl_backup() {
    let f = Fixture::new(true);
    let before = fs::metadata(&f.root).unwrap().permissions().readonly();
    let mut b = Broker::load(&f.config).unwrap();
    let first_sddl = b.handle(&f.sid, Request::Inspect).data["sddl"].clone();
    assert!(b.handle(&f.sid, create("order.pdf", b"first")).success);
    assert!(!b.handle(&f.sid, create("order.pdf", b"collision")).success);
    assert!(b.handle(&f.sid, update("order.pdf", b"updated")).success);
    let read = b.handle(
        &f.sid,
        Request::Read {
            name: "order.pdf".into(),
        },
    );
    assert_eq!(read.data["data"], STANDARD.encode(b"updated"));
    assert!(
        !b.handle(
            &f.sid,
            Request::Update {
                name: "order.pdf".into(),
                data: "!invalid!".into()
            }
        )
        .success
    );
    assert!(
        !b.handle(
            &f.sid,
            update(
                "order.pdf",
                &vec![0; crate::folder_protection::MAX_BYTES + 1]
            )
        )
        .success
    );
    assert_eq!(fs::read(f.root.join("order.pdf")).unwrap(), b"updated");
    assert!(!b.handle(&f.sid, update("missing.pdf", b"x")).success);
    assert!(!f.root.join("missing.pdf").exists());
    assert!(
        b.handle(
            &f.sid,
            Request::Delete {
                name: "order.pdf".into()
            }
        )
        .success
    );
    assert!(!f.root.join("order.pdf").exists());
    assert_eq!(b.handle(&f.sid, Request::Inspect).data["sddl"], first_sddl);
    assert_eq!(
        fs::metadata(&f.root).unwrap().permissions().readonly(),
        before
    );
    let saved: serde_json::Value =
        serde_json::from_slice(&fs::read(f.state.join("original-acl.json")).unwrap()).unwrap();
    assert_eq!(saved["sddl_owner_group_dacl"], first_sddl);
    drop(b);
    let mut restarted = Broker::load(&f.config).unwrap();
    assert!(restarted.handle(&f.sid, Request::Status).success);
    assert!(fs::read_to_string(f.state.join("audit.jsonl"))
        .unwrap()
        .contains("operation_failed"));
}

#[test]
fn refuses_unauthorized_and_read_only_users() {
    let f = Fixture::new(false);
    let mut b = Broker::load(&f.config).unwrap();
    assert_eq!(
        b.handle("S-1-5-21-0-0-0-1234", Request::Status).code,
        "unauthorized"
    );
    assert_eq!(
        b.handle(&f.sid, create("denied.txt", b"x")).code,
        "unauthorized"
    );
    assert!(b.handle(&f.sid, Request::List).success);
    assert!(!f.root.join("denied.txt").exists());
}

#[test]
fn rejects_hardlinks_traversal_and_directory_deletion() {
    let f = Fixture::new(true);
    let outside = f._temp.path().join("outside.txt");
    fs::write(&outside, b"safe").unwrap();
    fs::hard_link(&outside, f.root.join("link.txt")).unwrap();
    fs::create_dir(f.root.join("child")).unwrap();
    let mut b = Broker::load(&f.config).unwrap();
    for name in ["..", "../outside.txt", "child", "link.txt", "x:stream"] {
        assert!(
            !b.handle(&f.sid, Request::Delete { name: name.into() })
                .success,
            "{name}"
        );
        assert!(!b.handle(&f.sid, update(name, b"bad")).success, "{name}");
    }
    assert_eq!(fs::read(&outside).unwrap(), b"safe");
    assert!(
        fs::rename(&f.root, f._temp.path().join("moved")).is_err(),
        "root must remain pinned"
    );
}

#[test]
fn refuses_drive_roots_and_replaced_recovery_targets() {
    let f = Fixture::new(true);
    let b = Broker::load(&f.config).unwrap();
    drop(b);
    let original = fs::read(f.state.join("original-acl.json")).unwrap();
    fs::rename(&f.root, f._temp.path().join("original-root")).unwrap();
    fs::create_dir(&f.root).unwrap();
    assert!(
        Broker::load(&f.config).is_err(),
        "must not overwrite another folder's recovery record"
    );
    assert_eq!(
        fs::read(f.state.join("original-acl.json")).unwrap(),
        original
    );
    let mut config: Config = serde_json::from_slice(&fs::read(&f.config).unwrap()).unwrap();
    config.root = PathBuf::from(r"D:\");
    fs::write(&f.config, serde_json::to_vec(&config).unwrap()).unwrap();
    assert!(Broker::load(&f.config).is_err());
}

#[test]
fn locked_destination_preserves_existing_bytes() {
    let f = Fixture::new(true);
    let mut b = Broker::load(&f.config).unwrap();
    assert!(b.handle(&f.sid, create("locked.txt", b"original")).success);
    use windows_sys::Win32::Storage::FileSystem::*;
    let _reader = windows::open(
        &f.root.join("locked.txt"),
        FILE_READ_DATA,
        OPEN_EXISTING,
        FILE_SHARE_READ,
    )
    .unwrap();
    assert!(
        !b.handle(&f.sid, update("locked.txt", b"replacement"))
            .success
    );
    assert_eq!(fs::read(f.root.join("locked.txt")).unwrap(), b"original");
    assert_eq!(
        fs::read_dir(&f.root).unwrap().count(),
        1,
        "staging file must be removed after failed commit"
    );
}

#[test]
fn rejects_junction_root() {
    let f = Fixture::new(true);
    fs::remove_dir(&f.root).unwrap();
    let outside = f._temp.path().join("outside");
    fs::create_dir(&outside).unwrap();
    // Test fixture only, within TempDir; no ACL commands and no production paths.
    let result = std::process::Command::new("cmd")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(&f.root)
        .arg(&outside)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    assert!(Broker::load(&f.config).is_err());
    fs::remove_dir(&f.root).unwrap(); // Remove junction itself, never recurse into target.
    assert!(outside.exists());
}

#[test]
fn nested_crud_preserves_unicode_names_and_rejects_collisions() {
    let f = Fixture::new(true);
    let mut b = Broker::load(&f.config).unwrap();
    let sid = &f.sid;
    assert!(
        b.handle(
            sid,
            Request::CreateDirectory {
                path: r"2026\10 Oktober\23\Pesanan".into()
            }
        )
        .success
    );
    let source = "2026\\10 Oktober\\23\\Pesanan\\Desain é.pdf";
    assert!(b.handle(sid, create(source, b"original")).success);
    let copied = r"2026\10 Oktober\23\Pesanan\copy.pdf";
    assert!(
        b.handle(
            sid,
            Request::Copy {
                source: source.into(),
                destination: copied.into()
            }
        )
        .success
    );
    assert!(
        !b.handle(
            sid,
            Request::Rename {
                source: source.into(),
                destination: copied.into()
            }
        )
        .success
    );
    assert_eq!(fs::read(f.root.join(source)).unwrap(), b"original");
    let renamed = r"2026\10 Oktober\23\Pesanan\renamed.pdf";
    assert!(
        b.handle(
            sid,
            Request::Rename {
                source: source.into(),
                destination: renamed.into()
            }
        )
        .success
    );
    assert!(
        !b.handle(
            sid,
            Request::RemoveDirectory {
                path: r"2026\10 Oktober\23\Pesanan".into()
            }
        )
        .success
    );
    let list = b.handle(
        sid,
        Request::ListDirectory {
            path: r"2026\10 Oktober\23\Pesanan".into(),
        },
    );
    assert!(list.success, "{list:?}");
    assert_eq!(list.data["entries"].as_array().unwrap().len(), 2);
    let analysis = b.handle(
        sid,
        Request::AnalyzeDirectory {
            path: r"2026\10 Oktober\23\Pesanan".into(),
        },
    );
    assert!(analysis.success, "{analysis:?}");
    assert_eq!(analysis.data["items"].as_array().unwrap().len(), 2);
    for path in [copied, renamed] {
        assert!(b.handle(sid, Request::Delete { name: path.into() }).success);
    }
    assert!(
        b.handle(
            sid,
            Request::RemoveDirectory {
                path: r"2026\10 Oktober\23\Pesanan".into()
            }
        )
        .success
    );
    assert!(
        !b.handle(sid, Request::RemoveDirectory { path: "".into() })
            .success
    );
}

#[test]
fn streaming_upload_is_bounded_atomic_and_rejects_stale_updates() {
    let f = Fixture::new(true);
    let mut b = Broker::load(&f.config).unwrap();
    let sid = &f.sid;
    b.handle(
        sid,
        Request::CreateDirectory {
            path: "designs".into(),
        },
    );
    let path = r"designs\large.cdr";
    let bytes = vec![42; 2 * crate::folder_protection::MAX_BYTES + 123];
    let begin = b.handle(
        sid,
        Request::BeginUpload {
            name: path.into(),
            size: bytes.len() as u64,
            replace: false,
        },
    );
    assert!(begin.success, "{begin:?}");
    let id = begin.data["id"].as_str().unwrap().to_string();
    assert!(
        !b.handle(
            sid,
            Request::UploadChunk {
                id: id.clone(),
                offset: 1,
                data: STANDARD.encode(b"wrong offset")
            }
        )
        .success
    );
    let mut offset = 0;
    for chunk in bytes.chunks(crate::folder_protection::MAX_BYTES) {
        assert!(
            b.handle(
                sid,
                Request::UploadChunk {
                    id: id.clone(),
                    offset,
                    data: STANDARD.encode(chunk)
                }
            )
            .success
        );
        offset += chunk.len() as u64;
    }
    assert!(
        !f.root.join(path).exists(),
        "upload must remain invisible until commit"
    );
    let commit = b.handle(sid, Request::CommitUpload { id });
    assert!(commit.success, "{commit:?}");
    assert_eq!(fs::read(f.root.join(path)).unwrap(), bytes);

    let begin = b.handle(
        sid,
        Request::BeginUpload {
            name: path.into(),
            size: 3,
            replace: true,
        },
    );
    let id = begin.data["id"].as_str().unwrap().to_string();
    b.handle(
        sid,
        Request::UploadChunk {
            id: id.clone(),
            offset: 0,
            data: STANDARD.encode(b"x"),
        },
    );
    assert!(!b.handle(sid, Request::CommitUpload { id }).success);
    assert_eq!(fs::read(f.root.join(path)).unwrap(), bytes);

    let begin = b.handle(
        sid,
        Request::BeginUpload {
            name: path.into(),
            size: 3,
            replace: true,
        },
    );
    let id = begin.data["id"].as_str().unwrap().to_string();
    b.handle(
        sid,
        Request::UploadChunk {
            id: id.clone(),
            offset: 0,
            data: STANDARD.encode(b"old"),
        },
    );
    assert!(b.handle(sid, update(path, b"new")).success);
    assert!(
        !b.handle(sid, Request::CommitUpload { id }).success,
        "must not overwrite a newer commit"
    );
    assert_eq!(fs::read(f.root.join(path)).unwrap(), b"new");
    assert_eq!(
        fs::read_dir(f.root.join("designs")).unwrap().count(),
        1,
        "failed stages should be removed"
    );
}

#[test]
fn nested_junction_escape_and_upload_owner_are_rejected() {
    let f = Fixture::new(true);
    let outside = f._temp.path().join("outside");
    fs::create_dir(&outside).unwrap();
    fs::write(outside.join("secret.txt"), b"untouched").unwrap();
    let output = std::process::Command::new("cmd")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(f.root.join("escape"))
        .arg(&outside)
        .output()
        .unwrap();
    assert!(output.status.success());
    let mut config: Config = serde_json::from_slice(&fs::read(&f.config).unwrap()).unwrap();
    let other = "S-1-5-21-0-0-0-1234";
    config.users.push(User {
        sid: other.into(),
        write: true,
    });
    fs::write(&f.config, serde_json::to_vec(&config).unwrap()).unwrap();
    let mut b = Broker::load(&f.config).unwrap();
    for request in [
        Request::Read {
            name: r"escape\secret.txt".into(),
        },
        Request::CreateDirectory {
            path: r"escape\new".into(),
        },
        Request::Delete {
            name: r"escape\secret.txt".into(),
        },
    ] {
        assert!(!b.handle(&f.sid, request).success);
    }
    b.handle(
        &f.sid,
        Request::CreateDirectory {
            path: "pinned".into(),
        },
    );
    let begin = b.handle(
        &f.sid,
        Request::BeginUpload {
            name: r"pinned\file.txt".into(),
            size: 1,
            replace: false,
        },
    );
    let id = begin.data["id"].as_str().unwrap().to_string();
    assert!(
        fs::rename(f.root.join("pinned"), outside.join("moved")).is_err(),
        "upload must pin its ancestors"
    );
    assert!(
        !b.handle(
            other,
            Request::UploadChunk {
                id: id.clone(),
                offset: 0,
                data: STANDARD.encode(b"x")
            }
        )
        .success
    );
    assert!(
        !b.handle(other, Request::AbortUpload { id: id.clone() })
            .success
    );
    assert!(b.handle(&f.sid, Request::AbortUpload { id }).success);
    assert_eq!(fs::read(outside.join("secret.txt")).unwrap(), b"untouched");
    drop(b);
    fs::remove_dir(f.root.join("escape")).unwrap();
}

#[test]
fn routed_operations_reuse_service_for_nested_import_rename_export_and_delete() {
    use crate::folder_protection::{mapping::Registration, storage::Storage};
    use std::sync::Mutex;
    let f = Fixture::new(true);
    let b = Arc::new(Mutex::new(Broker::load(&f.config).unwrap()));
    let target = b.clone();
    let sid = f.sid.clone();
    let calls = Arc::new(Mutex::new(Vec::new()));
    let logged = calls.clone();
    let storage = Storage::for_test(
        vec![Registration {
            root_id: "test".into(),
            aliases: vec![f.root.to_string_lossy().into()],
        }],
        Box::new(move |request| {
            logged.lock().unwrap().push(request.label());
            let request = match request {
                Request::ForRoot { root_id, request } => {
                    assert_eq!(root_id, "test");
                    *request
                }
                other => other,
            };
            let response = target.lock().unwrap().handle(&sid, request);
            if response.success {
                Ok(response.data)
            } else {
                Err(response.message.unwrap_or(response.code))
            }
        }),
    );
    let folder = f.root.join(r"2026\10 Oktober\23\Order");
    storage.create_dir_all(&folder).unwrap();
    let source = f._temp.path().join("import.cdr");
    let bytes = vec![17; 2 * crate::folder_protection::MAX_BYTES + 19];
    fs::write(&source, &bytes).unwrap();
    let imported = folder.join("import.cdr");
    storage.copy_file(&source, &imported).unwrap();
    assert_eq!(fs::read(&imported).unwrap(), bytes);
    assert!(source.exists(), "copy must not remove the source");
    let renamed = folder.join("renamed.cdr");
    storage.rename(&imported, &renamed).unwrap();
    storage
        .write_file(&folder.join("export.xlsx"), b"exported")
        .unwrap();
    storage.remove_file(&renamed).unwrap();
    assert!(!renamed.exists());
    assert!(storage.set_folder_icon(&folder, "proses").unwrap());
    assert!(storage.set_folder_icon(&folder, "selesai").unwrap());
    assert!(fs::read_to_string(folder.join("desktop.ini"))
        .unwrap()
        .contains("folder-selesai.ico"));
    storage.remove_file(&folder.join("desktop.ini")).unwrap();
    assert!(storage
        .rename(
            &folder.join("export.xlsx"),
            &f._temp.path().join("outside.xlsx")
        )
        .is_err());
    let count = calls.lock().unwrap().len();
    storage
        .write_file(&f._temp.path().join("ordinary.txt"), b"ordinary")
        .unwrap();
    assert_eq!(
        calls.lock().unwrap().len(),
        count,
        "normal paths must not invoke the service"
    );
    storage.remove_file(&folder.join("export.xlsx")).unwrap();
    let relative = r"2026\10 Oktober\23\Order";
    let removed = b.lock().unwrap().handle(
        &f.sid,
        Request::RemoveDirectory {
            path: relative.into(),
        },
    );
    assert!(
        removed.success,
        "Readonly icon directory cleanup: {removed:?}"
    );
    for operation in [
        "create_directory",
        "begin_upload",
        "upload_chunk",
        "commit_upload",
        "rename",
        "delete",
        "set_folder_icon",
    ] {
        assert!(
            calls.lock().unwrap().contains(&operation),
            "missing routed operation: {operation}"
        );
    }
}

#[tokio::test(flavor = "current_thread")]
async fn readiness_is_not_reported_when_pipe_name_is_already_owned() {
    let f = Fixture::new(true);
    let broker = Broker::load(&f.config).unwrap();
    let pipe = format!(
        r"\\.\pipe\MgoFolderProtection-occupied-{}",
        std::process::id()
    );
    let _existing = tokio::net::windows::named_pipe::ServerOptions::new()
        .first_pipe_instance(true)
        .create(&pipe)
        .unwrap();
    let ready = Arc::new(AtomicBool::new(false));
    let reported = ready.clone();
    let result = broker::serve_ready(broker, &pipe, Arc::new(AtomicBool::new(true)), move || {
        reported.store(true, Ordering::SeqCst);
        Ok(())
    })
    .await;
    assert!(result.is_err());
    assert!(!ready.load(Ordering::SeqCst));
}

#[test]
fn missing_root_is_reported_without_recreating_it_or_replacing_recovery_state() {
    let f = Fixture::new(true);
    drop(Broker::load(&f.config).unwrap());
    let backup = fs::read(f.state.join("original-acl.json")).unwrap();
    fs::remove_dir(&f.root).unwrap();
    let error = Broker::load(&f.config)
        .err()
        .expect("Missing root must fail startup");
    assert!(error.contains("protected_root_unavailable"), "{error}");
    assert!(!f.root.exists());
    assert_eq!(fs::read(f.state.join("original-acl.json")).unwrap(), backup);
}

#[tokio::test(flavor = "current_thread")]
async fn real_pipe_authentication_crud_and_interrupted_request() {
    let f = Fixture::new(true);
    let pipe = format!(r"\\.\pipe\MgoFolderProtection-test-{}", std::process::id());
    let server_pipe = pipe.clone();
    let config = f.config.clone();
    let stop = Arc::new(AtomicBool::new(false));
    let signal = stop.clone();
    let worker = std::thread::spawn(move || {
        let b = Broker::load(&config).unwrap();
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(broker::serve(b, &server_pipe, signal))
            .unwrap();
    });
    let worker = ServiceWorker {
        thread: Some(worker),
        stop: stop.clone(),
    };
    let mut ready = false;
    for _ in 0..100 {
        if broker::client(&pipe, &f.sid, Request::Status).await.is_ok() {
            ready = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert!(ready, "server failed to start");
    assert!(
        broker::client(&pipe, "S-1-5-21-0-0-0-1234", Request::Status)
            .await
            .is_err(),
        "fake server identity must be refused"
    );
    let created = broker::client(&pipe, &f.sid, create("via-pipe.txt", b"safe"))
        .await
        .unwrap();
    assert!(created.success, "{created:?}");
    // Break a frame before its body completes. No operation may execute.
    use tokio::io::AsyncWriteExt;
    let mut partial = tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            match tokio::net::windows::named_pipe::ClientOptions::new().open(&pipe) {
                Ok(c) => break c,
                Err(_) => tokio::time::sleep(Duration::from_millis(20)).await,
            }
        }
    })
    .await
    .unwrap();
    partial.write_u32_le(100).await.unwrap();
    partial.write_all(b"{\"oper").await.unwrap();
    drop(partial);
    assert!(
        broker::client(
            &pipe,
            &f.sid,
            Request::Read {
                name: "via-pipe.txt".into()
            }
        )
        .await
        .unwrap()
        .success
    );
    assert_eq!(fs::read(f.root.join("via-pipe.txt")).unwrap(), b"safe");
    stop.store(true, Ordering::SeqCst);
    drop(worker);
}

#[test]
fn multi_root_selection_isolated_failure_and_replacement_identity() {
    use crate::folder_protection::{
        broker::Handler,
        registry::{Catalog, Registry, RootSpec},
    };
    let f = Fixture::new(true);
    let indoor = f._temp.path().join("Indoor");
    let outdoor = f._temp.path().join("Outdoor");
    fs::create_dir(&indoor).unwrap();
    fs::create_dir(&outdoor).unwrap();
    let spec = |id: &str, path: &std::path::Path| RootSpec {
        id: id.into(),
        label: id.into(),
        path: path.into(),
        file_id: windows::file_id(&windows::open(path, 0x20080, 3, 3).unwrap()).unwrap(),
        aliases: vec![],
    };
    let catalog = Catalog {
        schema: 4,
        state_directory: f.state.clone(),
        users: vec![User {
            sid: f.sid.clone(),
            write: true,
        }],
        roots: vec![spec("indoor", &indoor), spec("outdoor", &outdoor)],
    };
    fs::write(&f.config, serde_json::to_vec(&catalog).unwrap()).unwrap();
    fs::rename(&outdoor, f._temp.path().join("original-outdoor")).unwrap();
    let mut registry = Registry::load(&f.config).unwrap();
    let selected = |id: &str, request: Request| Request::ForRoot {
        root_id: id.into(),
        request: Box::new(request),
    };
    let indoor_create = registry.handle(&f.sid, selected("indoor", create("safe.txt", b"indoor")));
    assert!(indoor_create.success, "{indoor_create:?}");
    assert_eq!(
        registry
            .handle(
                &f.sid,
                selected("outdoor", create("blocked.txt", b"outside"))
            )
            .code,
        "root_unavailable"
    );
    assert_eq!(
        registry
            .handle(
                &f.sid,
                selected("unknown", create("blocked.txt", b"outside"))
            )
            .code,
        "unknown_root"
    );
    assert_eq!(
        registry
            .handle(
                "S-1-5-21-0-0-0-1234",
                selected("indoor", create("denied.txt", b"x"))
            )
            .code,
        "unauthorized"
    );
    fs::create_dir(&outdoor).unwrap();
    assert_eq!(
        registry
            .handle(
                &f.sid,
                selected("outdoor", create("blocked.txt", b"replacement"))
            )
            .code,
        "root_unavailable"
    );
    assert!(!outdoor.join("blocked.txt").exists());
    assert_eq!(fs::read(indoor.join("safe.txt")).unwrap(), b"indoor");
    let status = registry.handle(&f.sid, Request::Status);
    assert_eq!(status.data["roots"][0]["available"], true);
    assert_eq!(status.data["roots"][1]["available"], false);
    assert!(
        registry
            .handle(
                &f.sid,
                selected(
                    "indoor",
                    Request::Delete {
                        name: "safe.txt".into()
                    }
                )
            )
            .success
    );
}

#[test]
fn catalog_backup_recovers_corruption_and_degraded_mode_refuses_writes() {
    use crate::folder_protection::{broker::Handler, registry::Registry};
    let f = Fixture::new(true);
    fs::copy(&f.config, f.state.join("service.backup.json")).unwrap();
    fs::write(&f.config, br#"{"roots":null}"#).unwrap();
    let mut registry = Registry::load(&f.config).unwrap();
    assert!(registry.backup_used);
    assert!(
        registry
            .handle(&f.sid, create("recovered.txt", b"backup"))
            .success
    );
    assert_eq!(fs::read(f.root.join("recovered.txt")).unwrap(), b"backup");
    let mut degraded = Registry::degraded("Config deleted".into());
    assert!(degraded.handle(&f.sid, Request::Status).success);
    assert_eq!(
        degraded.handle(&f.sid, create("forbidden.txt", b"x")).code,
        "configuration_unavailable"
    );
    assert!(!f.root.join("forbidden.txt").exists());
}

#[test]
fn activation_requires_elevation_before_any_request_or_acl_access() {
    if windows::is_admin().unwrap() {
        return;
    }
    let error =
        crate::folder_protection::admin::activate(std::path::Path::new(r"Z:\does-not-exist.json"))
            .unwrap_err();
    assert!(error.contains("administrator"), "{error}");
}
