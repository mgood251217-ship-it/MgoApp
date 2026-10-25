#[cfg(windows)]
mod host {
    use mgo_desktop_lib::folder_protection::{lan, registry::Registry};
    use std::{
        ffi::OsString,
        path::PathBuf,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::Duration,
    };
    use windows_service::{
        define_windows_service,
        service::{
            ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
            ServiceType,
        },
        service_control_handler::{self, ServiceControlHandlerResult},
        service_dispatcher,
    };

    const NAME: &str = "MgoFolderProtection";
    define_windows_service!(entry, service_main);

    fn config_path() -> Result<PathBuf, String> {
        std::env::args_os()
            .nth(2)
            .map(PathBuf::from)
            .ok_or("Supply an absolute configuration file path".into())
    }
    fn run(
        stop: Arc<AtomicBool>,
        ready: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        let broker = Registry::load(&config_path()?).unwrap_or_else(Registry::degraded);
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| e.to_string())?
            .block_on(lan::serve(broker, stop, ready))
    }
    fn report_failure(message: &str) {
        use mgo_desktop_lib::folder_protection::windows::wide;
        use windows_sys::Win32::System::EventLog::{
            DeregisterEventSource, RegisterEventSourceW, ReportEventW, EVENTLOG_ERROR_TYPE,
        };
        let source = wide(std::ffi::OsStr::new(NAME));
        let detail = wide(std::ffi::OsStr::new(message));
        unsafe {
            let event = RegisterEventSourceW(std::ptr::null(), source.as_ptr());
            if !event.is_null() {
                let strings = [detail.as_ptr()];
                ReportEventW(
                    event,
                    EVENTLOG_ERROR_TYPE,
                    0,
                    1000,
                    std::ptr::null_mut(),
                    1,
                    0,
                    strings.as_ptr(),
                    std::ptr::null(),
                );
                DeregisterEventSource(event);
            }
        }
    }
    fn status(state: ServiceState, failed: bool) -> ServiceStatus {
        ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: state,
            controls_accepted: if state == ServiceState::Running {
                ServiceControlAccept::STOP
            } else {
                ServiceControlAccept::empty()
            },
            exit_code: ServiceExitCode::Win32(if failed { 1 } else { 0 }),
            checkpoint: 0,
            wait_hint: Duration::from_secs(10),
            process_id: None,
        }
    }
    fn service_main(_: Vec<OsString>) {
        let stop = Arc::new(AtomicBool::new(false));
        let signal = stop.clone();
        let handler = service_control_handler::register(NAME, move |control| match control {
            ServiceControl::Stop => {
                signal.store(true, Ordering::SeqCst);
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        });
        if let Ok(handler) = handler {
            let _ = handler.set_service_status(status(ServiceState::StartPending, false));
            let result = run(stop, || {
                handler
                    .set_service_status(status(ServiceState::Running, false))
                    .map_err(|e| e.to_string())
            });
            if let Err(message) = &result {
                report_failure(message);
            }
            let _ = handler.set_service_status(status(ServiceState::Stopped, result.is_err()));
        }
    }
    pub fn main() -> Result<(), String> {
        match std::env::args().nth(1).as_deref() {
            Some("--service") => service_dispatcher::start(NAME, entry).map_err(|e| e.to_string()),
            Some("--console") => run(Arc::new(AtomicBool::new(false)), || Ok(())),
            Some("--check-service") => {
                let response = tokio::runtime::Builder::new_current_thread().enable_all().build().map_err(|e| e.to_string())?
                    .block_on(mgo_desktop_lib::folder_protection::request_local(mgo_desktop_lib::folder_protection::Request::Status))?;
                // The elevated installer account need not be enrolled for CRUD. An
                // authenticated authorization refusal still proves that the broker is ready.
                if !response.success && response.code != "unauthorized" { return Err(response.message.unwrap_or(response.code)); }
                if response.success && (response.data["configuration_error"].is_string()) { return Err(format!("Service requires recovery: {}",response.data)); }
                println!("Service authenticated and ready");
                Ok(())
            },
            Some("--configure-lan-file") => {
                let path=std::env::args_os().nth(2).ok_or("Supply a LAN request")?;
                match mgo_desktop_lib::folder_protection::admin::configure_lan(std::path::Path::new(&path)) {
                    Ok(())=>Ok(()),
                    Err(error)=>{ if error!="cancelled" {mgo_desktop_lib::folder_protection::admin::message("MGO - LAN belum berhasil",&error,true);} Err(error) }
                }
            },
            Some("--activate-file") => {
                let path=std::env::args_os().nth(2).ok_or("Supply an activation request")?;
                match mgo_desktop_lib::folder_protection::admin::activate(std::path::Path::new(&path)) {
                    Ok(())=>Ok(()),
                    Err(error)=>{ if error!="cancelled" {mgo_desktop_lib::folder_protection::admin::message("MGO - Aktivasi belum berhasil",&error,true);} Err(error) }
                }
            },
            Some("--request") => {
                let file = std::env::args_os().nth(2).ok_or("Supply a JSON request file")?;
                let request = serde_json::from_slice(&std::fs::read(file).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
                let response = tokio::runtime::Builder::new_current_thread().enable_all().build().map_err(|e| e.to_string())?
                    .block_on(mgo_desktop_lib::folder_protection::request(request))?;
                println!("{}", serde_json::to_string_pretty(&response).unwrap());
                if !response.success { return Err(response.code); }
                Ok(())
            },
            _ => Err("Usage: mgo-folder-protection --console|--service <absolute-config.json> | --request <request.json>".into()),
        }
    }
}
fn main() {
    #[cfg(windows)]
    if let Err(e) = host::main() {
        eprintln!("{e}");
        std::process::exit(1);
    }
    #[cfg(not(windows))]
    {
        eprintln!("Windows only");
        std::process::exit(1);
    }
}
