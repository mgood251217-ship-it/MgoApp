//! TLS transport for the existing bounded, root-relative broker protocol.
//! Credentials authorize a selected root, never arbitrary paths or admin operations.
use super::{
    broker::{self, Handler, User},
    registry::Registry,
    Request, Response,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use ring::{
    digest,
    rand::{SecureRandom, SystemRandom},
    signature::{Ed25519KeyPair, KeyPair, UnparsedPublicKey, ED25519},
};
use rustls::pki_types::{CertificateDer, PrivatePkcs8KeyDer, ServerName};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    future::Future,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use tokio::{
    net::{TcpListener, TcpStream},
    time::timeout,
};
use tokio_rustls::{TlsAcceptor, TlsConnector};

pub const PORT: u16 = 42765;
const TLS_NAME: &str = "mgo-folder-protection";
const PREFIX: &str = "MGO-LAN-1:";
type ClientStream = tokio_rustls::client::TlsStream<TcpStream>;
struct CachedClientStream {
    stream: ClientStream,
    connected_at: Instant,
    last_used: Instant,
}
type ClientSession = Arc<tokio::sync::Mutex<Option<CachedClientStream>>>;
static CLIENT_SESSIONS: OnceLock<Mutex<std::collections::HashMap<String, ClientSession>>> =
    OnceLock::new();
const CLIENT_SESSION_MAX_AGE: Duration = Duration::from_secs(10);

fn err(e: impl ToString) -> String {
    e.to_string()
}
pub fn random_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    SystemRandom::new().fill(&mut bytes).map_err(err)?;
    Ok(B64.encode(bytes))
}
pub fn token_hash(token: &str) -> Result<String, String> {
    let bytes = B64.decode(token).map_err(|_| "Kode koneksi tidak valid")?;
    if bytes.len() != 32 {
        return Err("Kode koneksi tidak valid".into());
    }
    Ok(B64.encode(digest::digest(&digest::SHA256, &bytes)))
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Grant {
    pub root_id: String,
    pub operator_sid: String,
    pub token_hash: String,
    #[serde(default)]
    pub enroll_until: u64,
}
pub fn unix_time() -> Result<u64, String> {
    Ok(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(err)?
        .as_secs())
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ServerConfig {
    pub schema: u32,
    pub certificate: String,
    pub private_key: String,
    pub grants: Vec<Grant>,
}
impl ServerConfig {
    pub fn generate() -> Result<Self, String> {
        let rcgen::CertifiedKey { cert, signing_key } =
            rcgen::generate_simple_self_signed(vec![TLS_NAME.into()]).map_err(err)?;
        Ok(Self {
            schema: 1,
            certificate: B64.encode(cert.der()),
            private_key: B64.encode(signing_key.serialize_der()),
            grants: vec![],
        })
    }
    pub fn public(&self) -> Value {
        json!({"port":PORT,"certificate":self.certificate,"roots":self.grants.iter().map(|g| &g.root_id).collect::<Vec<_>>()})
    }
    fn tls(&self) -> Result<TlsAcceptor, String> {
        if self.schema != 1 || self.grants.len() > 32 {
            return Err("Konfigurasi LAN tidak valid".into());
        }
        let provider = Arc::new(rustls::crypto::ring::default_provider());
        let config = rustls::ServerConfig::builder_with_provider(provider)
            .with_protocol_versions(&[&rustls::version::TLS13])
            .map_err(err)?
            .with_no_client_auth()
            .with_single_cert(
                vec![CertificateDer::from(
                    B64.decode(&self.certificate).map_err(err)?,
                )],
                PrivatePkcs8KeyDer::from(B64.decode(&self.private_key).map_err(err)?).into(),
            )
            .map_err(err)?;
        Ok(TlsAcceptor::from(Arc::new(config)))
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Connection {
    pub schema: u32,
    pub host: String,
    pub certificate: String,
    pub token: String,
    pub root_id: String,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_key: Option<String>,
    #[serde(default)]
    pub enrolled: bool,
}
impl Connection {
    pub fn prepare_device(&mut self) -> Result<(), String> {
        self.device_key = Some(
            B64.encode(
                Ed25519KeyPair::generate_pkcs8(&SystemRandom::new())
                    .map_err(err)?
                    .as_ref(),
            ),
        );
        self.enrolled = false;
        Ok(())
    }
    pub fn id(&self) -> String {
        let hash = digest::digest(
            &digest::SHA256,
            format!("{}\n{}", self.host.to_ascii_lowercase(), self.root_id).as_bytes(),
        );
        format!(
            "lan-{}",
            hash.as_ref()
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        )
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != 1
            || self.host.is_empty()
            || self.host.len() > 253
            || !self
                .host
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
            || self.host.starts_with('.')
            || self.host.ends_with('.')
            || self.root_id.is_empty()
            || self.root_id.len() > 64
            || !self
                .root_id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
            || self.certificate.len() > 8192
        {
            return Err("Alamat server atau identitas folder tidak valid".into());
        }
        token_hash(&self.token)?;
        if let Some(key) = &self.device_key {
            Ed25519KeyPair::from_pkcs8(&B64.decode(key).map_err(err)?).map_err(err)?;
        } else if self.enrolled {
            return Err("Identitas perangkat tidak tersedia".into());
        }
        let prefix = format!("\\\\{}\\", self.host);
        if !self
            .path
            .to_ascii_lowercase()
            .starts_with(&prefix.to_ascii_lowercase())
        {
            return Err("Path harus berupa UNC pada server yang sama, misalnya \\\\DEV\\D\\TEST PATH FOLDER".into());
        }
        super::relative_parts(&self.path[prefix.len()..], false)?;
        self.tls()?;
        Ok(())
    }
    fn tls(&self) -> Result<TlsConnector, String> {
        let mut roots = rustls::RootCertStore::empty();
        roots
            .add(CertificateDer::from(
                B64.decode(&self.certificate).map_err(err)?,
            ))
            .map_err(err)?;
        let config = rustls::ClientConfig::builder_with_provider(Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(err)?
        .with_root_certificates(roots)
        .with_no_client_auth();
        Ok(TlsConnector::from(Arc::new(config)))
    }
    pub fn encode(&self) -> Result<String, String> {
        if self.device_key.is_some() || self.enrolled {
            return Err(
                "Identitas pribadi perangkat tidak boleh diekspor sebagai kode koneksi".into(),
            );
        }
        self.validate()?;
        Ok(format!(
            "{PREFIX}{}",
            B64.encode(serde_json::to_vec(self).map_err(err)?)
        ))
    }
    pub fn decode(code: &str) -> Result<Self, String> {
        if code.len() > 16384 {
            return Err("Kode koneksi terlalu panjang".into());
        }
        let code = code
            .trim()
            .strip_prefix(PREFIX)
            .ok_or("Gunakan kode koneksi yang dibuat MGO pada server")?;
        let connection: Self =
            serde_json::from_slice(&B64.decode(code).map_err(|_| "Kode koneksi tidak valid")?)
                .map_err(|_| "Kode koneksi tidak valid")?;
        connection.validate()?;
        if connection.device_key.is_some() || connection.enrolled {
            return Err("Kode pendaftaran tidak boleh berisi kunci pribadi perangkat".into());
        }
        Ok(connection)
    }
    pub fn summary(&self) -> Value {
        json!({"id":self.id(),"host":self.host,"path":self.path})
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    enroll_token: Option<String>,
    public_key: String,
    signature: String,
    root_id: String,
    request: Request,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Device {
    root_id: String,
    epoch: String,
    public_key: String,
}
struct DeviceStore {
    path: PathBuf,
    sid: String,
    devices: Vec<Device>,
}
impl DeviceStore {
    fn load(state: &std::path::Path, config: &ServerConfig) -> Result<Self, String> {
        let sid = super::windows::process_sid().map_err(err)?;
        // Catalogs pin their own parent read-only. Keep mutable enrollment records
        // in a private child so atomic commits do not conflict with those pins.
        let parent_pins = super::windows::pin_directory(state).map_err(err)?;
        super::windows::require_private(parent_pins.last().ok_or("State LAN hilang")?, &sid)
            .map_err(err)?;
        let directory = state.join("lan");
        fs::create_dir_all(&directory).map_err(err)?;
        let pins = super::windows::pin_state_for_update(&directory).map_err(err)?;
        super::windows::require_private(pins.last().ok_or("State perangkat hilang")?, &sid)
            .map_err(err)?;
        let path = directory.join("lan-devices.json");
        let mut devices: Vec<Device> = if path.try_exists().map_err(err)? {
            let (value, _pins) = super::registry::trusted_json(&path, &sid)?;
            serde_json::from_value(value).map_err(|_| "Daftar perangkat LAN rusak")?
        } else {
            vec![]
        };
        if devices.len() > 128 {
            return Err("Batas 128 pendaftaran perangkat/folder LAN terlampaui".into());
        }
        devices.retain(|d| {
            config
                .grants
                .iter()
                .any(|g| g.root_id == d.root_id && g.token_hash == d.epoch)
        });
        Ok(Self { path, sid, devices })
    }
    fn enroll(&mut self, grant: &Grant, public_key: &str) -> Result<(), String> {
        if self.contains(grant, public_key) {
            return Ok(());
        }
        if self.devices.len() >= 128 {
            return Err("Batas perangkat LAN tercapai; cabut akses yang tidak dipakai".into());
        }
        use std::io::Write;
        use windows_sys::Win32::Storage::FileSystem::*;
        let mut next = self.devices.clone();
        next.push(Device {
            root_id: grant.root_id.clone(),
            epoch: grant.token_hash.clone(),
            public_key: public_key.into(),
        });
        let parent = self.path.parent().ok_or("State perangkat hilang")?;
        let pins = super::windows::pin_state_for_update(parent).map_err(err)?;
        let directory = pins.last().ok_or("State perangkat hilang")?;
        super::windows::require_private(directory, &self.sid).map_err(err)?;
        let stage = parent.join(format!("lan-devices-{}.next", random_token()?));
        let result = (|| {
            let mut file = super::windows::open(
                &stage,
                FILE_WRITE_DATA | READ_CONTROL | DELETE,
                CREATE_NEW,
                FILE_SHARE_READ,
            )
            .map_err(err)?;
            super::windows::require_private(&file, &self.sid).map_err(err)?;
            file.write_all(&serde_json::to_vec(&next).map_err(err)?)
                .and_then(|_| file.sync_all())
                .map_err(err)?;
            super::windows::commit(&file, directory, "lan-devices.json", true).map_err(err)
        })();
        let _ = fs::remove_file(&stage);
        result?;
        self.devices = next;
        Ok(())
    }
    fn contains(&self, grant: &Grant, key: &str) -> bool {
        self.devices.iter().any(|d| {
            d.root_id == grant.root_id && d.epoch == grant.token_hash && d.public_key == key
        })
    }
}
fn signed_request(challenge: &[u8], root_id: &str, request: &Request) -> Result<Vec<u8>, String> {
    let mut bytes = challenge.to_vec();
    bytes.extend(serde_json::to_vec(&(root_id, request)).map_err(err)?);
    Ok(bytes)
}
fn envelope(
    connection: &Connection,
    request: Request,
    challenge: &[u8],
) -> Result<Envelope, String> {
    if challenge.len() != 32 {
        return Err("Tantangan identitas server tidak valid".into());
    }
    let key = Ed25519KeyPair::from_pkcs8(
        &B64.decode(
            connection
                .device_key
                .as_deref()
                .ok_or("Perangkat belum disiapkan untuk pendaftaran")?,
        )
        .map_err(err)?,
    )
    .map_err(err)?;
    let signature = key.sign(&signed_request(challenge, &connection.root_id, &request)?);
    Ok(Envelope {
        enroll_token: if connection.enrolled {
            None
        } else {
            Some(connection.token.clone())
        },
        public_key: B64.encode(key.public_key().as_ref()),
        signature: B64.encode(signature.as_ref()),
        root_id: connection.root_id.clone(),
        request,
    })
}

#[derive(Clone)]
struct SharedRegistry {
    registry: Arc<Mutex<Registry>>,
    users: Vec<User>,
    public: Value,
    error: Option<String>,
    devices: Option<Arc<Mutex<DeviceStore>>>,
}
impl Handler for SharedRegistry {
    fn users(&self) -> &[User] {
        &self.users
    }
    fn log(&mut self, sid: &str, operation: &str, outcome: &str) -> Result<(), String> {
        self.registry
            .lock()
            .map_err(err)?
            .log(sid, operation, outcome)
    }
    fn handle(&mut self, sid: &str, request: Request) -> Response {
        let status = matches!(request, Request::Status);
        let mut response = match self.registry.lock() {
            Ok(mut registry) => registry.handle(sid, request),
            Err(_) => return Response::error("unavailable", "Layanan perlu dimulai ulang"),
        };
        if status && response.success {
            response.data["lan_protocol"] = json!(1);
            response.data["lan_enabled"] = json!(!self.public.is_null());
            response.data["lan"] = self.public.clone();
            response.data["lan_error"] = json!(self.error);
        }
        response
    }
}
fn dispatch(
    handler: &mut SharedRegistry,
    config: &ServerConfig,
    challenge: &[u8],
    envelope: Envelope,
) -> Response {
    let Some(grant) = config.grants.iter().find(|g| g.root_id == envelope.root_id) else {
        return Response::error(
            "unauthorized",
            "Kode koneksi ditolak atau telah diganti pada server",
        );
    };
    if !handler
        .users()
        .iter()
        .any(|u| u.sid == grant.operator_sid && u.write)
    {
        return Response::error("unauthorized", "Izin operator sudah dicabut");
    }
    let verified = (|| {
        let public = B64.decode(&envelope.public_key).map_err(err)?;
        let signature = B64.decode(&envelope.signature).map_err(err)?;
        UnparsedPublicKey::new(&ED25519, public)
            .verify(
                &signed_request(challenge, &envelope.root_id, &envelope.request)?,
                &signature,
            )
            .map_err(|_| "Identitas perangkat tidak terverifikasi")?;
        let store = handler
            .devices
            .as_ref()
            .ok_or("Pendaftaran perangkat belum tersedia")?;
        let mut store = store.lock().map_err(err)?;
        if let Some(token) = &envelope.enroll_token {
            if !matches!(envelope.request, Request::Status)
                || token_hash(token)? != grant.token_hash
                || unix_time()? >= grant.enroll_until
            {
                return Err("Kode pendaftaran ditolak, sudah diganti, atau lewat 10 menit. Buat kode baru pada server.".into());
            }
            store.enroll(grant, &envelope.public_key)?;
        } else if !store.contains(grant, &envelope.public_key) {
            return Err("Perangkat belum terdaftar atau aksesnya sudah dicabut".into());
        }
        Ok::<_, String>(())
    })();
    if let Err(e) = verified {
        return Response::error("unauthorized", e);
    }
    if matches!(envelope.request, Request::ForRoot { .. }) {
        return Response::error("invalid_request", "Pemilihan folder bertingkat ditolak");
    }
    if matches!(envelope.request, Request::Status) {
        let response = handler.handle(&grant.operator_sid, Request::Status);
        if !response.success {
            return response;
        }
        let roots: Vec<Value> = response.data["roots"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|r| r["id"] == grant.root_id)
            .cloned()
            .collect();
        return Response::ok(
            json!({"protocol_version":super::PROTOCOL_VERSION,"roots":roots,"lan_enabled":true}),
        );
    }
    handler.handle(
        &grant.operator_sid,
        Request::ForRoot {
            root_id: grant.root_id.clone(),
            request: Box::new(envelope.request),
        },
    )
}

pub async fn serve(
    registry: Registry,
    stop: Arc<AtomicBool>,
    ready: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let path = registry.catalog.state_directory.join("lan.json");
    let setup = (|| {
        if registry.configuration_error.is_some() {
            return Ok(None);
        }
        if !path.try_exists().map_err(err)? {
            return Ok(None);
        }
        let sid = super::windows::registered_server_sid().map_err(err)?;
        let (raw, pins) = super::registry::trusted_json(&path, &sid)?;
        let config: ServerConfig = serde_json::from_value(raw).map_err(err)?;
        let tls = config.tls()?;
        if config.grants.is_empty() {
            return Ok(None);
        }
        let devices = DeviceStore::load(&registry.catalog.state_directory, &config)?;
        Ok::<_, String>(Some((config, tls, pins, Arc::new(Mutex::new(devices)))))
    })();
    let (setup, mut error) = match setup {
        Ok(v) => (v, None),
        Err(e) => (None, Some(e)),
    };
    let mut listener = None;
    if setup.is_some() {
        match TcpListener::bind((std::net::Ipv4Addr::UNSPECIFIED, PORT)).await {
            Ok(v) => listener = Some(v),
            Err(e) => error = Some(format!("Port LAN {PORT} gagal dibuka: {e}")),
        }
    }
    let shared = SharedRegistry {
        devices: setup.as_ref().map(|s| s.3.clone()),
        users: registry.catalog.users.clone(),
        registry: Arc::new(Mutex::new(registry)),
        public: if listener.is_some() {
            setup.as_ref().unwrap().0.public()
        } else {
            Value::Null
        },
        error,
    };
    if let (Some(listener), Some((config, tls, _pins, _devices))) = (listener, setup) {
        tokio::select! {
            result = broker::serve_ready(shared.clone(), super::PIPE, stop.clone(), ready) => result,
            result = serve_network(listener,tls,config,shared,stop) => result,
        }
    } else {
        broker::serve_ready(shared, super::PIPE, stop, ready).await
    }
}
async fn serve_network(
    listener: TcpListener,
    tls: TlsAcceptor,
    config: ServerConfig,
    handler: SharedRegistry,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    let slots = Arc::new(tokio::sync::Semaphore::new(16));
    let config = Arc::new(config);
    let mut tasks = tokio::task::JoinSet::new();
    while !stop.load(Ordering::SeqCst) {
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(100)) => (),
            Some(_) = tasks.join_next(), if !tasks.is_empty() => (),
            accepted = listener.accept() => {
                let (socket,_) = accepted.map_err(err)?;
                let Ok(permit) = slots.clone().try_acquire_owned() else { continue };
                let tls = tls.clone(); let config = config.clone(); let mut handler = handler.clone();
                tasks.spawn(async move {
                    let _permit = permit;
                    if let Ok(Ok(mut stream)) =
                        timeout(Duration::from_secs(15), tls.accept(socket)).await
                    {
                        let _ = serve_connection(&mut stream, &config, &mut handler).await;
                    }
                });
            }
        }
    }
    tasks.abort_all();
    Ok(())
}

async fn serve_connection(
    stream: &mut tokio_rustls::server::TlsStream<TcpStream>,
    config: &ServerConfig,
    handler: &mut SharedRegistry,
) -> Result<(), String> {
    loop {
        let challenge = B64.decode(random_token()?).map_err(err)?;
        timeout(
            Duration::from_secs(15),
            broker::write_frame(stream, &challenge),
        )
        .await
        .map_err(|_| "Timeout saat mengirim tantangan TLS".to_string())??;
        let raw = timeout(Duration::from_secs(15), broker::read_frame(stream))
            .await
            .map_err(|_| "Koneksi LAN idle terlalu lama".to_string())??;
        let response = match serde_json::from_slice::<Envelope>(&raw) {
            Ok(envelope) => dispatch(handler, config, &challenge, envelope),
            Err(_) => Response::error("invalid_request", "Permintaan LAN tidak valid"),
        };
        let bytes = serde_json::to_vec(&response).map_err(err)?;
        timeout(Duration::from_secs(15), broker::write_frame(stream, &bytes))
            .await
            .map_err(|_| "Timeout saat mengirim jawaban layanan MGO".to_string())??;
    }
}

pub async fn client(connection: &Connection, request: Request) -> Result<Response, String> {
    client_at(connection, request, PORT).await
}

async fn stage<T>(
    name: &str,
    limit: Duration,
    operation: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    timeout(limit, operation)
        .await
        .map_err(|_| format!("Timeout saat {name} setelah {} detik.", limit.as_secs()))?
}

async fn connect_client(connection: &Connection, port: u16) -> Result<ClientStream, String> {
    let socket = stage(
        &format!("membuka TCP ke {}:{port}", connection.host),
        Duration::from_secs(60),
        async {
            TcpStream::connect((connection.host.as_str(), port))
                .await
                .map_err(|e| format!("Server {}:{port} tidak terhubung: {e}", connection.host))
        },
    )
    .await?;
    let connector = connection.tls()?;
    stage(
        "negosiasi TLS dengan server",
        Duration::from_secs(15),
        async {
            connector
                .connect(ServerName::try_from(TLS_NAME).map_err(err)?, socket)
                .await
                .map_err(|e| format!("Identitas TLS server tidak dapat diverifikasi: {e}"))
        },
    )
    .await
}

async fn client_at(
    connection: &Connection,
    request: Request,
    port: u16,
) -> Result<Response, String> {
    let key = format!(
        "{}|{port}|{}|{}",
        connection.host.to_ascii_lowercase(),
        connection.root_id,
        connection.certificate
    );
    let sessions = CLIENT_SESSIONS.get_or_init(|| Mutex::new(std::collections::HashMap::new()));
    let session = {
        let mut sessions = sessions.lock().map_err(err)?;
        sessions
            .entry(key)
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(None)))
            .clone()
    };
    let mut cached = session.lock().await;
    let mut stream = match cached.take() {
        Some(mut saved)
            if saved.connected_at.elapsed() < CLIENT_SESSION_MAX_AGE
                && saved.last_used.elapsed() < CLIENT_SESSION_MAX_AGE =>
        {
            match stage(
                "menunggu tantangan TLS dari server",
                Duration::from_secs(15),
                async {
                    broker::read_frame(&mut saved.stream)
                        .await
                        .map_err(|e| format!("Gagal membaca tantangan TLS dari server: {e}"))
                },
            )
            .await
            {
                Ok(challenge) => (saved.stream, challenge, saved.connected_at),
                Err(_) => {
                    let mut stream = connect_client(connection, port).await?;
                    let challenge = stage(
                        "menunggu tantangan TLS dari server; TCP sudah tersambung, tetapi layanan MGO belum menjawab",
                        Duration::from_secs(15),
                        async {
                            broker::read_frame(&mut stream)
                                .await
                                .map_err(|e| format!("Gagal membaca tantangan TLS dari server: {e}"))
                        },
                    )
                    .await?;
                    (stream, challenge, Instant::now())
                }
            }
        }
        Some(_) => {
            let mut stream = connect_client(connection, port).await?;
            let challenge = stage(
                "menunggu tantangan TLS dari server; TCP sudah tersambung, tetapi layanan MGO belum menjawab",
                Duration::from_secs(15),
                async {
                    broker::read_frame(&mut stream)
                        .await
                        .map_err(|e| format!("Gagal membaca tantangan TLS dari server: {e}"))
                },
            )
            .await?;
            (stream, challenge, Instant::now())
        }
        None => {
            let mut stream = connect_client(connection, port).await?;
            let challenge = stage(
                "menunggu tantangan TLS dari server; TCP sudah tersambung, tetapi layanan MGO belum menjawab",
                Duration::from_secs(15),
                async {
                    broker::read_frame(&mut stream)
                        .await
                        .map_err(|e| format!("Gagal membaca tantangan TLS dari server: {e}"))
                },
            )
            .await?;
            (stream, challenge, Instant::now())
        }
    };
    let connected_at = stream.2;
    let envelope = envelope(connection, request, &stream.1)?;
    let bytes = serde_json::to_vec(&envelope).map_err(err)?;
    let result = async {
        stage(
            "mengirim permintaan autentikasi ke server",
            Duration::from_secs(15),
            async {
                broker::write_frame(&mut stream.0, &bytes)
                    .await
                    .map_err(|e| format!("Gagal mengirim permintaan autentikasi: {e}"))
            },
        )
        .await?;
        let response = stage(
            "menunggu jawaban layanan MGO di server",
            Duration::from_secs(15),
            async {
                broker::read_frame(&mut stream.0)
                    .await
                    .map_err(|e| format!("Gagal membaca jawaban layanan MGO: {e}"))
            },
        )
        .await?;
        serde_json::from_slice(&response).map_err(err)
    }
    .await;
    if result.is_ok() {
        *cached = Some(CachedClientStream {
            stream: stream.0,
            connected_at,
            last_used: Instant::now(),
        });
    }
    result
}

fn client_path() -> Result<PathBuf, String> {
    Ok(
        super::windows::known_folder(&windows_sys::Win32::UI::Shell::FOLDERID_LocalAppData)
            .map_err(err)?
            .join("id.mgo.desktop")
            .join("folder-lan.dat"),
    )
}
fn protect(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::*};
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as _,
    };
    let mut output: CRYPT_INTEGER_BLOB = unsafe { std::mem::zeroed() };
    let success = unsafe {
        if encrypt {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if success == 0 {
        return Err(format!(
            "Kredensial LAN akun Windows ini tidak dapat dibaca/disimpan: {}",
            std::io::Error::last_os_error()
        ));
    }
    let data =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData as _);
    }
    Ok(data)
}
pub fn connections() -> Result<Vec<Connection>, String> {
    use std::io::Read;
    let path = client_path()?;
    let file = match fs::File::open(&path) {
        Ok(v) => v,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(err(e)),
    };
    let mut bytes = vec![];
    file.take(524289).read_to_end(&mut bytes).map_err(err)?;
    if bytes.len() > 524288 {
        return Err("Konfigurasi klien LAN terlalu besar".into());
    }
    let connections: Vec<Connection> = serde_json::from_slice(&protect(&bytes, false)?)
        .map_err(|_| "Konfigurasi klien LAN rusak")?;
    if connections.len() > 32 {
        return Err("Maksimal 32 koneksi folder LAN".into());
    }
    for c in &connections {
        c.validate()?;
    }
    Ok(connections)
}
pub fn save_connections(connections: &[Connection]) -> Result<(), String> {
    use std::io::Write;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    if connections.len() > 32 {
        return Err("Maksimal 32 koneksi folder LAN".into());
    }
    for c in connections {
        c.validate()?;
    }
    let path = client_path()?;
    fs::create_dir_all(path.parent().unwrap()).map_err(err)?;
    let stage = path.with_extension(format!("{}.tmp", random_token()?));
    let result = (|| {
        let bytes = protect(&serde_json::to_vec(connections).map_err(err)?, true)?;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&stage)
            .map_err(err)?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(err)?;
        drop(file);
        let from = super::windows::wide(stage.as_os_str());
        let to = super::windows::wide(path.as_os_str());
        unsafe {
            super::windows::checked(MoveFileExW(
                from.as_ptr(),
                to.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            ))
            .map_err(err)
        }
    })();
    let _ = fs::remove_file(stage);
    result
}
pub fn registrations() -> Result<Vec<super::mapping::Registration>, String> {
    Ok(connections()?
        .into_iter()
        .map(|c| super::mapping::Registration {
            root_id: c.id(),
            aliases: vec![c.path],
        })
        .collect())
}
pub async fn route(request: Request) -> Result<Response, String> {
    if let Request::ForRoot {
        root_id,
        request: inner,
    } = &request
    {
        if root_id.starts_with("lan-") {
            let c = connections()?
                .into_iter()
                .find(|c| c.id() == *root_id)
                .ok_or("Koneksi folder LAN tidak terdaftar")?;
            return client(&c, (**inner).clone()).await;
        }
    }
    if !matches!(request, Request::Status) {
        return super::request_local(request).await;
    }
    let connections = connections()?;
    let local = super::request_local(Request::Status).await;
    if connections.is_empty() {
        return local;
    }
    let mut data = match local {
        Ok(r) if r.success => r.data,
        _ => json!({"roots":[],"protocol_version":super::PROTOCOL_VERSION}),
    };
    let mut roots = data["roots"].as_array().cloned().unwrap_or_default();
    use futures_util::{stream, StreamExt};
    let replies = stream::iter(connections.into_iter().map(|c| async move {
        let reply = client(&c, Request::Status).await;
        (c, reply)
    }))
    .buffered(8)
    .collect::<Vec<_>>()
    .await;
    for (c, result) in replies {
        let (available, error, label) = match result {
            Ok(r) if r.success => {
                let root = r.data["roots"]
                    .as_array()
                    .and_then(|rs| rs.iter().find(|r| r["id"] == c.root_id));
                (
                    root.is_some_and(|r| r["available"] == true),
                    root.and_then(|r| r["error"].as_str())
                        .map(str::to_owned)
                        .or_else(|| {
                            if root.is_none() {
                                Some("Folder tidak terdaftar pada server".into())
                            } else {
                                None
                            }
                        }),
                    root.and_then(|r| r["label"].as_str())
                        .unwrap_or("Folder LAN")
                        .to_string(),
                )
            }
            Ok(r) => (
                false,
                Some(r.message.unwrap_or(r.code)),
                "Folder LAN".into(),
            ),
            Err(e) => (false, Some(e), "Folder LAN".into()),
        };
        roots.push(json!({"id":c.id(),"label":label,"path":c.path,"aliases":[c.path],"available":available,"error":error,"remote":true}));
    }
    data["roots"] = json!(roots);
    Ok(Response::ok(data))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::folder_protection::native_tests::Fixture;
    use base64::engine::general_purpose::STANDARD;
    fn setup() -> (Fixture, ServerConfig, Connection, SharedRegistry) {
        let fixture = Fixture::new(true);
        let mut config = ServerConfig::generate().unwrap();
        let mut connection = Connection {
            schema: 1,
            host: "127.0.0.1".into(),
            certificate: config.certificate.clone(),
            token: random_token().unwrap(),
            root_id: "local".into(),
            path: r"\\127.0.0.1\share\folder".into(),
            device_key: None,
            enrolled: false,
        };
        config.grants.push(Grant {
            root_id: "local".into(),
            operator_sid: fixture.sid.clone(),
            token_hash: token_hash(&connection.token).unwrap(),
            enroll_until: unix_time().unwrap() + 600,
        });
        connection.prepare_device().unwrap();
        let registry = Registry::load(&fixture.config).unwrap();
        let shared = SharedRegistry {
            devices: Some(Arc::new(Mutex::new(
                DeviceStore::load(&registry.catalog.state_directory, &config).unwrap(),
            ))),
            users: registry.catalog.users.clone(),
            registry: Arc::new(Mutex::new(registry)),
            public: config.public(),
            error: None,
        };
        (fixture, config, connection, shared)
    }
    #[test]
    fn lan_codes_are_scoped_revocable_and_dpapi_protected() {
        let (fixture, mut config, mut c, mut handler) = setup();
        let challenge = [42; 32];
        let status = dispatch(
            &mut handler,
            &config,
            &challenge,
            envelope(&c, Request::Status, &challenge).unwrap(),
        );
        assert!(status.success, "{status:?}");
        c.enrolled = true;
        assert_eq!(status.data["roots"].as_array().unwrap().len(), 1);
        let mut wrong = envelope(&c, Request::Status, &challenge).unwrap();
        wrong.root_id = "other".into();
        assert_eq!(
            dispatch(&mut handler, &config, &challenge, wrong).code,
            "unauthorized"
        );
        let nested = envelope(
            &c,
            Request::ForRoot {
                root_id: "other".into(),
                request: Box::new(Request::Status),
            },
            &challenge,
        )
        .unwrap();
        assert_eq!(
            dispatch(&mut handler, &config, &challenge, nested).code,
            "invalid_request"
        );
        // Captured signatures cannot be replayed on a new TLS connection.
        assert_eq!(
            dispatch(
                &mut handler,
                &config,
                &[43; 32],
                envelope(&c, Request::Status, &challenge).unwrap()
            )
            .code,
            "unauthorized"
        );
        let mut second = c.clone();
        second.prepare_device().unwrap();
        let registered = dispatch(
            &mut handler,
            &config,
            &challenge,
            envelope(&second, Request::Status, &challenge).unwrap(),
        );
        assert!(
            registered.success,
            "Second enrollment atomically replaces the registry: {registered:?}"
        );
        second.enrolled = true;
        config.grants[0].enroll_until = 0;
        assert!(
            dispatch(
                &mut handler,
                &config,
                &challenge,
                envelope(&c, Request::Status, &challenge).unwrap()
            )
            .success,
            "Registered devices survive enrollment expiry"
        );
        let mut stranger = c.clone();
        stranger.prepare_device().unwrap();
        assert_eq!(
            dispatch(
                &mut handler,
                &config,
                &challenge,
                envelope(&stranger, Request::Status, &challenge).unwrap()
            )
            .code,
            "unauthorized"
        );
        stranger.enrolled = true;
        assert_eq!(
            dispatch(
                &mut handler,
                &config,
                &challenge,
                envelope(&stranger, Request::Status, &challenge).unwrap()
            )
            .code,
            "unauthorized"
        );
        // Enrollment survives service restart, using only the private persisted public-key registry.
        handler.devices = Some(Arc::new(Mutex::new(
            DeviceStore::load(fixture.config.parent().unwrap(), &config).unwrap(),
        )));
        assert!(
            dispatch(
                &mut handler,
                &config,
                &challenge,
                envelope(&c, Request::Status, &challenge).unwrap()
            )
            .success
        );
        assert!(
            dispatch(
                &mut handler,
                &config,
                &challenge,
                envelope(&second, Request::Status, &challenge).unwrap()
            )
            .success
        );
        config.grants[0].token_hash = token_hash(&random_token().unwrap()).unwrap();
        assert_eq!(
            dispatch(
                &mut handler,
                &config,
                &challenge,
                envelope(&c, Request::Status, &challenge).unwrap()
            )
            .code,
            "unauthorized"
        );
        config.grants.clear();
        assert_eq!(
            dispatch(
                &mut handler,
                &config,
                &challenge,
                envelope(&c, Request::Status, &challenge).unwrap()
            )
            .code,
            "unauthorized"
        );
        assert!(
            c.encode().is_err(),
            "Device private keys must never be exported in pairing codes"
        );
        let encoded = serde_json::to_vec(&c).unwrap();
        let encrypted = protect(&encoded, true).unwrap();
        assert!(!encrypted
            .windows(c.token.len())
            .any(|part| part == c.token.as_bytes()));
        assert_eq!(protect(&encrypted, false).unwrap(), encoded);
        let mut corrupted = encrypted;
        let last = corrupted.len() - 1;
        corrupted[last] ^= 1;
        assert!(protect(&corrupted, false).is_err());
        let mut escaped = c.clone();
        escaped.path = r"\\127.0.0.1\share\..\private".into();
        assert!(escaped.validate().is_err());
        escaped.path = r"C:\Windows".into();
        assert!(escaped.validate().is_err());
        assert!(Connection::decode("MGO-LAN-1:invalid").is_err());
        c.device_key = None;
        c.enrolled = false;
        assert_eq!(
            Connection::decode(&c.encode().unwrap()).unwrap().id(),
            c.id()
        );
    }
    #[tokio::test]
    async fn lan_tls_real_crud_upload_authentication_and_certificate_validation() {
        let (fixture, config, mut c, handler) = setup();
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .await
            .unwrap();
        let port = listener.local_addr().unwrap().port();
        let stop = Arc::new(AtomicBool::new(false));
        let server = tokio::spawn(serve_network(
            listener,
            config.tls().unwrap(),
            config,
            handler,
            stop.clone(),
        ));
        let mut wrong = c.clone();
        wrong.token = random_token().unwrap();
        assert_eq!(
            client_at(&wrong, Request::Status, port).await.unwrap().code,
            "unauthorized"
        );
        wrong = c.clone();
        wrong.certificate = ServerConfig::generate().unwrap().certificate;
        assert!(client_at(&wrong, Request::Status, port).await.is_err());
        assert!(client_at(&c, Request::Status, port).await.unwrap().success);
        c.enrolled = true;
        let operations = [
            Request::CreateDirectory {
                path: "orders".into(),
            },
            Request::Create {
                name: r"orders\file.txt".into(),
                data: STANDARD.encode(b"first"),
            },
            Request::Update {
                name: r"orders\file.txt".into(),
                data: STANDARD.encode(b"updated"),
            },
            Request::Rename {
                source: r"orders\file.txt".into(),
                destination: r"orders\renamed.txt".into(),
            },
            Request::Copy {
                source: r"orders\renamed.txt".into(),
                destination: r"orders\copy.txt".into(),
            },
        ];
        for request in operations {
            let reply = client_at(&c, request, port).await.unwrap();
            assert!(reply.success, "{reply:?}");
        }
        let read = client_at(
            &c,
            Request::Read {
                name: r"orders\copy.txt".into(),
            },
            port,
        )
        .await
        .unwrap();
        assert_eq!(read.data["data"], STANDARD.encode(b"updated"));
        assert_eq!(
            fs::read(fixture.root.join(r"orders\copy.txt")).unwrap(),
            b"updated"
        );
        let denied = client_at(
            &c,
            Request::Create {
                name: r"..\escape.txt".into(),
                data: STANDARD.encode(b"escape"),
            },
            port,
        )
        .await
        .unwrap();
        assert!(!denied.success);
        let bytes = vec![37; super::super::MAX_BYTES + 17];
        let begun = client_at(
            &c,
            Request::BeginUpload {
                name: r"orders\large.bin".into(),
                size: bytes.len() as u64,
                replace: false,
            },
            port,
        )
        .await
        .unwrap();
        assert!(begun.success, "{begun:?}");
        let id = begun.data["id"].as_str().unwrap().to_string();
        for (i, chunk) in bytes.chunks(super::super::MAX_BYTES).enumerate() {
            let reply = client_at(
                &c,
                Request::UploadChunk {
                    id: id.clone(),
                    offset: (i * super::super::MAX_BYTES) as u64,
                    data: STANDARD.encode(chunk),
                },
                port,
            )
            .await
            .unwrap();
            assert!(reply.success, "{reply:?}");
        }
        assert!(
            client_at(&c, Request::CommitUpload { id }, port)
                .await
                .unwrap()
                .success
        );
        assert_eq!(
            fs::read(fixture.root.join(r"orders\large.bin")).unwrap(),
            bytes
        );
        // Reject oversized frames without allocating their declared size or breaking later requests.
        use tokio::io::AsyncWriteExt;
        let socket = TcpStream::connect((std::net::Ipv4Addr::LOCALHOST, port))
            .await
            .unwrap();
        let mut stream = c
            .tls()
            .unwrap()
            .connect(ServerName::try_from(TLS_NAME).unwrap(), socket)
            .await
            .unwrap();
        assert_eq!(broker::read_frame(&mut stream).await.unwrap().len(), 32);
        stream
            .write_u32_le((super::super::MAX_FRAME + 1) as u32)
            .await
            .unwrap();
        assert!(
            timeout(Duration::from_secs(2), broker::read_frame(&mut stream))
                .await
                .unwrap()
                .is_err()
        );
        for name in [
            r"orders\renamed.txt",
            r"orders\copy.txt",
            r"orders\large.bin",
        ] {
            assert!(
                client_at(&c, Request::Delete { name: name.into() }, port)
                    .await
                    .unwrap()
                    .success
            );
        }
        assert!(
            client_at(
                &c,
                Request::RemoveDirectory {
                    path: "orders".into()
                },
                port
            )
            .await
            .unwrap()
            .success
        );
        stop.store(true, Ordering::SeqCst);
        server.await.unwrap().unwrap();
        assert!(!fixture.root.join("orders").exists());
    }
}
