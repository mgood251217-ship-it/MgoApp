use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::{collections::hash_map::DefaultHasher, hash::{Hash, Hasher}, path::{Path, PathBuf}, time::Duration};
use tauri::Manager;
use tokio::io::AsyncWriteExt;

static DOWNLOAD_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
const MAX_BYTES: u64 = 100 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
struct VideoRecord {
    url: String,
    updated_at: String,
    size: u64,
}

async fn cached_video(root: &Path, id: u64, url: &str, updated_at: &str) -> Result<PathBuf, String> {
    let parsed = reqwest::Url::parse(url).map_err(|_| "URL video tidak valid.")?;
    if !matches!(parsed.scheme(), "https" | "http") {
        return Err("URL video harus HTTP atau HTTPS.".into());
    }
    let extension = Path::new(parsed.path()).extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    if !matches!(extension.as_str(), "mp4" | "webm" | "ogv") {
        return Err("Format video tutorial tidak didukung.".into());
    }
    let mut hash = DefaultHasher::new();
    (url, updated_at).hash(&mut hash);
    let key = format!("{}-{:016x}", id, hash.finish());
    let file = root.join(format!("{}.{}", key, extension));
    let manifest = root.join(format!("{}.json", key));
    let _guard = DOWNLOAD_LOCK.lock().await;
    if let Ok(raw) = tokio::fs::read(&manifest).await {
        if let Ok(record) = serde_json::from_slice::<VideoRecord>(&raw) {
            if record.url == url && record.updated_at == updated_at && record.size > 0 {
                if let Ok(meta) = tokio::fs::metadata(&file).await {
                    if meta.is_file() && meta.len() == record.size { return Ok(file); }
                }
            }
        }
    }
    tokio::fs::create_dir_all(root).await.map_err(|e| e.to_string())?;
    let partial = root.join(format!("{}.part", key));
    let result: Result<(), String> = async {
        let client = reqwest::Client::builder().timeout(Duration::from_secs(180))
            .build().map_err(|e| e.to_string())?;
        let response = client.get(parsed).send().await.map_err(|e| e.to_string())?
            .error_for_status().map_err(|e| e.to_string())?;
        let expected = response.content_length();
        if expected.map_or(false, |size| size > MAX_BYTES) { return Err("Video melebihi 100 MB.".into()); }
        let content_type = response.headers().get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok()).unwrap_or("");
        if content_type.contains("text/html") || content_type.contains("application/json") {
            return Err("Server tidak mengirim file video.".into());
        }
        let mut output = tokio::fs::File::create(&partial).await.map_err(|e| e.to_string())?;
        let mut size = 0u64;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| e.to_string())?;
            size += chunk.len() as u64;
            if size > MAX_BYTES { return Err("Video melebihi 100 MB.".into()); }
            output.write_all(&chunk).await.map_err(|e| e.to_string())?;
        }
        if size == 0 || expected.map_or(false, |length| length != size) {
            return Err("Unduhan video belum lengkap.".into());
        }
        output.sync_all().await.map_err(|e| e.to_string())?;
        drop(output);
        if file.exists() { tokio::fs::remove_file(&file).await.map_err(|e| e.to_string())?; }
        tokio::fs::rename(&partial, &file).await.map_err(|e| e.to_string())?;
        let record = VideoRecord { url: url.into(), updated_at: updated_at.into(), size };
        tokio::fs::write(&manifest, serde_json::to_vec(&record).map_err(|e| e.to_string())?)
            .await.map_err(|e| e.to_string())?;
        Ok(())
    }.await;
    if let Err(error) = result {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(error);
    }
    Ok(file)
}

#[tauri::command]
pub async fn get_tutorial_video(app: tauri::AppHandle, id: u64, url: String, updated_at: String) -> Result<String, String> {
    let root = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("tutorial-videos");
    cached_video(&root, id, &url, &updated_at).await.map(|path| path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    #[test]
    fn video_cache_reuses_complete_files_and_refreshes_changed_versions() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/tutorial.mp4", listener.local_addr().unwrap());
        let server = std::thread::spawn(move || {
            for index in 0..5 {
                let (mut socket, _) = listener.accept().unwrap();
                let mut request = [0u8; 4096];
                socket.read(&mut request).unwrap();
                let response = if index == 4 {
                    "HTTP/1.1 500 Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                } else {
                    "HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nContent-Length: 8\r\nConnection: close\r\n\r\nftypTEST"
                };
                socket.write_all(response.as_bytes()).unwrap();
            }
        });
        let temp = std::env::temp_dir();
        let root = temp.join(format!("mgo-video-test-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap().block_on(async {
            let first = cached_video(&root, 1, &url, "2026-10-26 10:00:00").await.unwrap();
            assert_eq!(cached_video(&root, 1, &url, "2026-10-26 10:00:00").await.unwrap(), first);
            let second = cached_video(&root, 1, &url, "2026-10-26 11:00:00").await.unwrap();
            assert_ne!(first, second);
            tokio::fs::write(&second, b"broken").await.unwrap();
            assert_eq!(cached_video(&root, 1, &url, "2026-10-26 11:00:00").await.unwrap(), second);
            assert_eq!(tokio::fs::read(&second).await.unwrap(), b"ftypTEST");
            let other_url = url.replace("tutorial.mp4", "replacement.mp4");
            let third = cached_video(&root, 1, &other_url, "2026-10-26 11:00:00").await.unwrap();
            assert_ne!(third, second);
            assert!(cached_video(&root, 1, &url, "failed-version").await.is_err());
            server.join().unwrap();

            assert_eq!(cached_video(&root, 1, &other_url, "2026-10-26 11:00:00").await.unwrap(), third);
            assert!(!std::fs::read_dir(&root).unwrap().flatten().any(|item| item.path().extension().is_some_and(|ext| ext == "part")));
        });
        assert!(root.starts_with(&temp) && root.file_name().unwrap().to_string_lossy().starts_with("mgo-video-test-"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
