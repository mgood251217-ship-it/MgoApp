import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button/Button";

export default function FolderProtection({ settings = {}, onSettingsChange, onSave }) {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [verification, setVerification] = useState(null);

    const [folderPlans, setFolderPlans] = useState({});
    const [folderMessage, setFolderMessage] = useState("");
    const folders = useMemo(() => Array.isArray(settings.folder_protection_paths)
        ? settings.folder_protection_paths.filter(folder => folder && typeof folder.id === "string" && typeof folder.path === "string")
        : [], [settings.folder_protection_paths]);
    const inputStyle = { width: "100%", minWidth: 0, padding: "10px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-content)", color: "var(--text)", boxSizing: "border-box" };
    const updateFolders = (next) => {
        onSettingsChange?.({ ...settings, folder_protection_paths: next });
        setFolderMessage("");
    };
    const updateFolder = (id, patch) => {
        updateFolders(folders.map(folder => folder.id === id ? { ...folder, ...patch } : folder));
        setFolderPlans(prev => { const next = { ...prev }; delete next[id]; return next; });
    };
    const pickFolder = async (id) => {
        try {
            const path = await window.electron.pilihFolder();
            if (path) updateFolder(id, { path });
        } catch (e) { setFolderMessage(String(e.message || e)); }
    };
    const checkFolder = async (folder) => {
        setBusy(true);
        try {
            if (!window.electron?.planFolderProtection) throw new Error("Perbarui aplikasi desktop untuk pemeriksaan folder.");
            const plan = await window.electron.planFolderProtection(folder.path);
            setFolderPlans(prev => ({ ...prev, [folder.id]: plan }));
        } catch (e) { setFolderPlans(prev => ({ ...prev, [folder.id]: { error: String(e.message || e) } })); }
        finally { setBusy(false); }
    };

    useEffect(() => {
        let cancelled = false;
        const savedFolders = folders.filter(folder => folder.path.trim());
        if (!window.electron?.planFolderProtection || savedFolders.length === 0) return undefined;

        Promise.all(savedFolders.map(async folder => {
            try {
                return [folder.id, await window.electron.planFolderProtection(folder.path)];
            } catch (e) {
                return [folder.id, { error: String(e.message || e) }];
            }
        })).then(entries => {
            if (!cancelled) setFolderPlans(Object.fromEntries(entries));
        });

        return () => { cancelled = true; };
    }, [folders]);
    const activateFolder = async (folder) => {
        setBusy(true); setFolderMessage("");
        try {
            const response = await window.electron.activateFolderProtection(folder.path, folder.label || "");
            if (!response.success) throw new Error(response.message || "Aktivasi gagal.");
            const plan = await window.electron.planFolderProtection(folder.path);
            setFolderPlans(prev => ({ ...prev, [folder.id]: plan }));
            setFolderMessage("Folder diaktifkan. Atur Path Folder Produksi di bawah ke lokasi ini untuk memakai CRUD MGO.");
        } catch (e) { setFolderMessage(String(e.message || e)); }
        finally { setBusy(false); }
    };

    const saveFolders = async () => {
        if (folders.some(folder => !folder.path?.trim())) {
            setFolderMessage("Lengkapi lokasi setiap folder terlebih dahulu."); return;
        }
        const paths = folders.map(folder => folder.path.trim().replaceAll("/", "\\").replace(/\\+$/, "").toLowerCase());
        if (new Set(paths).size !== paths.length) { setFolderMessage("Lokasi folder tidak boleh sama."); return; }
        if (folders.length > 32 || paths.some(path => !/^[a-z]:\\.+/i.test(path))) {
            setFolderMessage("Gunakan maksimal 32 subfolder lokal, misalnya D:\\Indoor. Seluruh drive dan path jaringan belum didukung untuk aktivasi."); return;
        }
        const saved = await onSave?.();
        setFolderMessage(saved ? "Daftar folder tersimpan. Folder baru belum diaktifkan sebagai folder terlindungi." : "Daftar folder belum berhasil disimpan.");
    };

    const inspect = async () => {
        setBusy(true);
        setError(null);
        setResult(null);
        setVerification(null);
        try {
            if (!window.electron?.inspectFolderProtection) {
                throw new Error("Inspeksi memerlukan aplikasi desktop Windows.");
            }
            const response = await window.electron.inspectFolderProtection();
            if (!response.success) throw new Error(response.message || response.code);
            setResult(response.data);
        } catch (e) {
            const detail = String(e.message || e);
            const notRegistered = detail.startsWith("service_not_registered:");
            const unavailable = detail.startsWith("service_unavailable:");
            setError({
                title: notRegistered ? "Layanan Folder Protection belum disiapkan di komputer ini."
                    : unavailable ? "Layanan Folder Protection belum berjalan."
                    : "Inspeksi izin belum berhasil.",
                guidance: notRegistered
                    ? "Administrator perlu memasang layanan pada komputer server dan mendaftarkan identitasnya terlebih dahulu."
                    : unavailable ? "Minta administrator memeriksa layanan MgoFolderProtection dan keberadaan folder terdaftar. Memasang ulang aplikasi tidak memulihkan folder yang hilang."
                    : "Periksa koneksi layanan dan izin pengguna Windows yang terdaftar.",
                detail,
            });
        } finally {
            setBusy(false);
        }
    };

    const verify = async (rootId = null) => {
        setBusy(true);
        setError(null);
        setVerification(null);
        try {
            setVerification(await window.electron.verifyFolderProtection(rootId));
        } catch (e) {
            setError({ title: "Pengujian belum berhasil.", guidance: "Periksa versi layanan dan izin akun Windows Anda.", detail: String(e.message || e) });
        } finally { setBusy(false); }
    };

    return (
        <div style={{ backgroundColor: "var(--bg-content)", padding: "28px", borderRadius: "var(--radius)", border: "1px solid var(--border)", gridColumn: "1 / -1" }}>
            <h3 style={{ marginTop: 0, color: "var(--text)", fontSize: 18 }}>MGO Folder Protection</h3>
            <p style={{ color: "var(--text-secondary)" }}>
                Folder terdaftar diproses melalui layanan lokal. Path biasa tetap memakai akses Windows Anda.
                Folder baru diaktifkan melalui persetujuan administrator. Koneksi layanan melalui LAN belum tersedia.
            </p>
            <section aria-label="Custom folder protection" style={{ margin: "24px 0", padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <h4 style={{ margin: "0 0 8px", color: "var(--text)" }}>Custom Folder Protection</h4>
                <p style={{ color: "var(--text-secondary)", marginTop: 0 }}>Tambahkan beberapa lokasi, misalnya D:\Indoor dan D:\Outdoor. Menyimpan daftar tidak mengubah izin Windows. Periksa rencana izin sebelum aktivasi oleh administrator.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {folders.length === 0 && <p style={{ color: "var(--text-muted)" }}>Belum ada custom folder. Klik Tambah folder.</p>}
                    {folders.map((folder, index) => {
                        const plan = folderPlans[folder.id];
                        return <div key={folder.id} style={{ padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                                <label style={{ color: "var(--text)" }}>Nama folder
                                    <input style={inputStyle} aria-label={`Nama folder ${index + 1}`} value={folder.label || ""} placeholder="Contoh: Indoor" onChange={e => updateFolder(folder.id, { label: e.target.value })} />
                                </label>
                                <label style={{ color: "var(--text)" }}>Lokasi folder
                                    <input style={inputStyle} aria-label={`Lokasi folder ${index + 1}`} value={folder.path || ""} placeholder="D:\Indoor" onChange={e => updateFolder(folder.id, { path: e.target.value })} />
                                </label>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                <Button disabled={busy} variant="secondary" onClick={() => pickFolder(folder.id)}>Pilih folder</Button>
                                <Button disabled={busy || !folder.path?.trim()} variant="secondary" onClick={() => checkFolder(folder)}>Periksa folder</Button>
                                {!plan?.registered && <Button disabled={busy || !plan?.can_activate} onClick={() => activateFolder(folder)}>Aktifkan dengan administrator</Button>}
                                {plan?.registered && <Button disabled={busy} onClick={() => verify(plan.root_id)}>Uji CRUD melalui MGO</Button>}
                                <Button disabled={busy} variant="danger" onClick={() => updateFolders(folders.filter(item => item.id !== folder.id))}>Hapus dari daftar</Button>
                            </div>
                            <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>Status: {plan?.registered ? "Terdaftar pada layanan lokal" : plan ? "Belum diaktifkan" : "Sedang memeriksa folder..."}. Menghapus dari daftar tidak menghapus folder atau mencabut proteksi.</p>
                            {plan && <div role="status" style={{ color: "var(--text)", marginTop: 10, overflowWrap: "anywhere" }}>
                                {plan.error ? <p style={{ color: "var(--danger)" }}>{plan.error}</p> : <>
                                    <p>{plan.exists ? "Folder ditemukan." : "Folder belum ada; belum dibuat otomatis."}</p>
                                    <p>{plan.summary}</p>
                                    {plan.warnings?.length > 0 && <ul>{plan.warnings.map((message, i) => <li key={i}>{message}</li>)}</ul>}
                                    {plan.blockers?.length > 0 && <ul>{plan.blockers.map((message, i) => <li key={i}>{message}</li>)}</ul>}
                                    <details><summary>Rencana izin Windows</summary><ul>{plan.permissions?.map(item => <li key={item}>{item}</li>)}</ul><p>{plan.scope}</p></details>
                                </>}
                            </div>}
                        </div>;
                    })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                    <Button disabled={busy || folders.length >= 32} onClick={() => updateFolders([...folders, { id: crypto.randomUUID(), label: "", path: "" }])}>Tambah folder</Button>
                    <Button disabled={busy} variant="secondary" onClick={saveFolders}>Simpan daftar folder</Button>
                </div>
                {folderMessage && <p role="status" style={{ color: "var(--text)", overflowWrap: "anywhere" }}>{folderMessage}</p>}
            </section>
            <Button type="button" variant="secondary" disabled={busy} onClick={inspect}>
                {busy ? "Memeriksa..." : "Inspect Permissions"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy || !result || result.protocol_version < 4 || !result.roots?.some(root => root.available)} onClick={() => verify(result?.roots?.find(root => root.available)?.id || null)}>
                Uji akses Windows dan CRUD MGO
            </Button>
            {error && <div role="alert" style={{ color: "var(--danger)", marginTop: 16, overflowWrap: "anywhere" }}>
                <p>{error.title}</p>
                <p style={{ color: "var(--text-secondary)" }}>{error.guidance}</p>
                <details><summary>Detail teknis</summary>{error.detail}</details>
            </div>}
            {result && <div aria-live="polite" style={{ color: "var(--text)", marginTop: 16 }}>
                <p>{result.protocol_version >= 4 ? "Layanan terhubung. Folder di bawah dipisahkan oleh layanan dan dapat diuji satu per satu." : "Layanan versi lama. Jalankan installer terbaru dan pilih komputer server untuk memperbaruinya."}</p>
                {result.configuration_error && <p role="alert" style={{ color: "var(--danger)" }}>Konfigurasi layanan perlu dipulihkan: {result.configuration_error}</p>}
                {result.backup_used && <p role="alert" style={{ color: "var(--danger)" }}>Layanan sedang memakai konfigurasi cadangan. Minta administrator memeriksa konfigurasi utama.</p>}
                {result.roots?.map(root => <div key={root.id} style={{ padding: 12, marginTop: 10, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <p style={{ marginTop: 0 }}><strong>{root.label || "Folder"}</strong>: {root.path}</p>
                    <p>Status: {root.available ? "Siap untuk CRUD MGO" : `Tidak tersedia${root.error ? ` - ${root.error}` : ""}`}</p>
                    {root.available && <Button disabled={busy} variant="secondary" onClick={() => verify(root.id)}>Uji folder ini</Button>}
                    {root.inspection?.sddl && <details><summary>Detail izin Windows (SDDL)</summary>
                        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{root.inspection.sddl}</pre>
                    </details>}
                </div>)}
            </div>}
            {verification && <div aria-live="polite" style={{ color: "var(--text)", marginTop: 16 }}>
                <p><strong>{verification.passed ? "Pengujian lokal berhasil." : "Ada pengujian yang belum lulus."}</strong>{verification.root_label ? ` ${verification.root_label}: ${verification.root}` : ""}</p>
                <ul>{verification.checks.map((check, index) => <li key={index}>
                    {check.passed ? "Lulus" : "Gagal"}: {check.name}{check.message ? ` - ${check.message}` : ""}
                </li>)}</ul>
                <p>{verification.scope}</p>
                {verification.cleanup_errors.length > 0 && <p role="alert">Pembersihan file uji belum lengkap: {verification.cleanup_errors.join("; ")}</p>}
            </div>}
        </div>
    );
}
