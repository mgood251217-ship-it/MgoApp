import { useEffect, useState } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Tag from "../components/Tag/Tag";
import Modal from "../components/Modal/Modal";
import CardVideo from "../components/CardVideo/CardVideo";
import { FiSearch } from "react-icons/fi";

export default function About() {
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
            <Header title="Tutorial & Panduan" subtitle="Temukan panduan untuk membantu pekerjaan sehari-hari." />
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
                    {selected.video_url ? <video style={{ width: "100%", maxHeight: "60vh", background: "#111", borderRadius: "var(--radius)" }} key={selected.id} controls preload="metadata" poster={selected.thumbnail_url || undefined} src={selected.video_url} aria-label={`Video ${selected.title}`} /> : selected.thumbnail_url && <img style={{ width: "100%", maxHeight: "50vh", objectFit: "contain", borderRadius: "var(--radius)" }} src={selected.thumbnail_url} alt={selected.title} />}
                    <Tag>{selected.category || "Umum"}</Tag>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.8, fontSize: "14px", color: "var(--text)" }}>{selected.content}</p>
                </div>}
            </Modal>
        </section>
    );
}
