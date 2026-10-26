import { useEffect, useState } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Tag from "../components/Tag/Tag";
import Modal from "../components/Modal/Modal";
import CardVideo from "../components/CardVideo/CardVideo";
import Button from "../components/Button/Button";
import { convertFileSrc } from "@tauri-apps/api/core";
import { tauriApi } from "../lib/tauriApi";
import { FiSearch } from "react-icons/fi";

function TutorialVideo({ tutorial }) {
    const [video, setVideo] = useState({ loading: true, src: "", error: "" });
    const [attempt, setAttempt] = useState(0);
    const { id, video_url: url, updated_at: updatedAt, created_at: createdAt } = tutorial;

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        const prepareVideo = async () => {
            let currentUrl = url;
            let version = updatedAt || createdAt || "";
            let latest = null;
            try {
                const { data } = await api.get("", { params: { action: "tutorials" }, signal: controller.signal });
                if (Array.isArray(data?.data)) latest = data.data;
            } catch {
                
            }
            if (!active) return null;
            if (latest) {
                const current = latest.find(item => String(item.id) === String(id));
                if (!current?.video_url) throw new Error("Video tidak tersedia.");
                currentUrl = current.video_url;
                version = current.updated_at || current.created_at || "";
            }
            return tauriApi.getTutorialVideo({ id: Number(id), url: currentUrl, updatedAt: String(version) });
        };
        prepareVideo()
            .then((path) => {
                if (active) setVideo({ loading: false, src: convertFileSrc(path), error: "" });
            })
            .catch(() => {
                if (active) setVideo({ loading: false, src: "", error: "Video belum dapat disiapkan. Periksa koneksi lalu coba lagi." });
            });
        return () => { active = false; controller.abort(); };
    }, [id, url, updatedAt, createdAt, attempt]);

    if (video.loading) return <p role="status">Menyiapkan video dari penyimpanan lokal...</p>;
    if (video.error) return <div role="alert">
        <p>{video.error}</p>
        <Button onClick={() => { setVideo({ loading: true, src: "", error: "" }); setAttempt(value => value + 1); }}>Coba lagi</Button>
    </div>;
    return <video
        style={{ width: "100%", maxHeight: "60vh", background: "#111", borderRadius: "var(--radius)" }}
        controls preload="metadata" poster={tutorial.thumbnail_url || undefined} src={video.src}
        aria-label={`Video ${tutorial.title}`}
        onError={() => setVideo({ loading: false, src: "", error: "Video lokal tidak dapat diputar. Pastikan format video didukung perangkat ini." })}
    />;
}

export default function Guide() {
    const [tutorials, setTutorials] = useState([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        api.get("", { params: { action: "tutorials" }, signal: controller.signal })
            .then(({ data }) => setTutorials(data.data))
            .catch(() => {});
        return () => controller.abort();
    }, []);

    const query = search.trim().toLowerCase();
    const filtered = tutorials.filter((item) =>
        `${item.title} ${item.category || ""} ${item.content || ""}`.toLowerCase().includes(query)
    );

    return (
        <section style={{ width: "100%", minWidth: "0", paddingBottom: "32px", color: "var(--text)" }}>
            <Header title="Guide" subtitle="Temukan panduan untuk membantu pekerjaan sehari-hari." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", margin: "0 0 24px", padding: "18px 20px", background: "var(--bg-content)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 260px", maxWidth: "480px", minWidth: "0" }}>
                    <FiSearch style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden="true" />
                    <Input style={{ flex: 1, minWidth: 0 }} type="search" aria-label="Cari tutorial" value={search} margin="0"
                        onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul, kategori, atau isi panduan..." />
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{`${filtered.length} tutorial tersedia`}</span>
            </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))", gap: "22px" }}>
                    {filtered.map((item) => (
                        <CardVideo
                            key={item.id}
                            title={item.title}
                            description={item.content}
                            category={item.category}
                            thumbnailUrl={item.thumbnail_url}
                            videoUrl={item.video_url}
                            onClick={() => setSelected(item)}
                        />
                    ))}
                </div>

            <Modal open={Boolean(selected)} title={selected?.title} size="lg" onClose={() => setSelected(null)}>
                {selected && <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "20px" }}>
                    {selected.video_url ? <TutorialVideo key={`${selected.id}:${selected.updated_at || ""}:${selected.video_url}`} tutorial={selected} /> : selected.thumbnail_url && <img style={{ width: "100%", maxHeight: "50vh", objectFit: "contain", borderRadius: "var(--radius)" }} src={selected.thumbnail_url} alt={selected.title} />}
                    <Tag>{selected.category || "Umum"}</Tag>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.8, fontSize: "14px", color: "var(--text)" }}>{selected.content}</p>
                </div>}
            </Modal>
        </section>
    );
}
