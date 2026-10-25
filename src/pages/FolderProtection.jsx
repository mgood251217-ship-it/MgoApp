import { useEffect, useMemo, useState } from "react";
import Button from "../components/Button/Button";

export default function FolderProtection({ settings = {}, onSettingsChange, onSave }) {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [verification, setVerification] = useState(null);
    const [lan, setLan] = useState(null);
    const [lanRoot, setLanRoot] = useState("");
    const [lanHost, setLanHost] = useState("");
    const [lanPath, setLanPath] = useState("");
    const [connectionCode, setConnectionCode] = useState("");
    const [newCode, setNewCode] = useState("");
    const [lanMessage, setLanMessage] = useState("");
    const [smbUsername, setSmbUsername] = useState("");
    const [smbPassword, setSmbPassword] = useState("");

    const managedLanPath = (host, rootId) => {
        const suffix = rootId.slice(-16);
        return `\\\\${host}\\MGOFP_${suffix}`;
    };
    const refreshLan = async () => {
        const status = await window.electron.folderProtectionLanStatus();
        setLan(status);
        setLanHost(host => host || status.computer || "");
        return status;
    };
    useEffect(() => {
        let cancelled = false;
        if (!window.electron?.folderProtectionLanStatus) return undefined;
        window.electron.folderProtectionLanStatus().then(status => {
            if (!cancelled) { setLan(status); setLanHost(status.computer || ""); }
        }).catch(e => { if (!cancelled) setLanMessage(String(e.message || e)); });
        return () => { cancelled = true; };
    }, []);
    const selectLanRoot = (id) => {
        setLanRoot(id); setNewCode("");
        if (id) setLanPath(managedLanPath(lanHost, id));
    };
    const configureLan = async (enabled) => {
        setBusy(true); setNewCode(""); setLanMessage("");
        try {
            const response = await window.electron.configureFolderProtectionLan(lanRoot, lanHost, lanPath, enabled);
            setNewCode(response.code || ""); setLanMessage(response.message);
            await refreshLan();
        } catch (e) { setLanMessage(String(e.message || e)); }
        finally { setBusy(false); }
    };
    const connectLan = async () => {
        setBusy(true); setLanMessage("");
        try {
            const connection = await window.electron.connectFolderProtectionLan(connectionCode);
            setConnectionCode(""); await refreshLan();
            setLanMessage(`Terhubung. Gunakan ${connection.path} pada Path Folder Produksi, lalu simpan pengaturan.`);
        } catch (e) { setLanMessage(String(e.message || e)); }
        finally { setBusy(false); }
    };
    const disconnectLan = async (id) => {
        setBusy(true);
        try {
            await window.electron.disconnectFolderProtectionLan(id); await refreshLan();
            setLanMessage("Koneksi pada akun Windows ini dihapus. Untuk mencabut kode di semua klien, gunakan Cabut akses LAN pada server.");
        } catch (e) { setLanMessage(String(e.message || e)); }
        finally { setBusy(false); }
    };
    const saveExplorerAccess = async (path) => {
        setBusy(true); setLanMessage("");
        try {
            const response = await window.electron.saveFolderProtectionSmbCredential(path, smbUsername, smbPassword);
            if (!response.success) throw new Error(response.message || "Akses Explorer gagal disiapkan.");
            setLanMessage("Akses baca Explorer tersimpan aman untuk akun Windows ini. Folder sudah dibuka.");
        } catch (e) {
            setLanMessage(String(e.message || e));
        } finally {
            setSmbPassword("");
            setBusy(false);
        }
    };
    const openExplorer = async (path) => {
        setBusy(true); setLanMessage("");
        try {
            const response = await window.electron.openFolder(path);
            if (!response.success) throw new Error(response.message || "Folder Explorer gagal dibuka.");
            setLanMessage("Folder dibuka di Explorer dengan akses baca.");
        } catch (e) {
            setLanMessage(String(e.message || e));
        } finally { setBusy(false); }
    };

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
            const detail = String(e.message || e);
            const parentSecurityChanged = detail.includes("Root parent security changed:");
            setError({
                title: parentSecurityChanged ? "Folder masih terdaftar, tetapi izin folder induk membuatnya tidak tersedia."
                    : "Pengujian belum berhasil.",
                guidance: parentSecurityChanged
                    ? "Minta administrator memeriksa izin folder induk untuk S-1-1-0 (Everyone). Jangan daftar ulang folder atau mengubah izin seluruh drive tanpa memeriksa dampaknya. Setelah izin induk diperbaiki, muat ulang status LAN."
                    : "Periksa versi layanan dan izin akun Windows Anda.",
                detail,
            });
        } finally { setBusy(false); }
    };

    return (
        <div style={{ backgroundColor: "var(--bg-content)", padding: "28px", borderRadius: "var(--radius)", border: "1px solid var(--border)", gridColumn: "1 / -1" }}>
            <h3 style={{ marginTop: 0, color: "var(--text)", fontSize: 18 }}>MGO Folder Protection</h3>
            <p style={{ color: "var(--text-secondary)" }}>
                Folder terdaftar diproses melalui layanan MGO. Path biasa tetap memakai akses Windows Anda.
                Aktifkan folder pada server, lalu sambungkan komputer lain melalui pengaturan LAN di bawah.
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
            <section aria-label="Folder Protection LAN" style={{ margin: "24px 0", padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                <h4 style={{ marginTop: 0 }}>Folder Protection LAN</h4>
                <p>IP komputer klien boleh berubah. Kode koneksi berlaku 10 menit untuk mendaftarkan komputer yang dipercaya ke satu folder. Setelah terdaftar, klien tetap bisa CRUD sampai aksesnya dicabut.</p>
                <details>
                    <summary>Komputer server — buat atau cabut kode koneksi</summary>
                    <p>Pilih folder yang sudah dilindungi. MGO akan membuat share Explorer khusus untuk folder itu dengan izin baca-saja bagi akun Windows yang berhasil login. Share dibatasi ke subnet lokal dan dihapus saat akses LAN folder dicabut. Untuk memakai share Windows lain, ganti path di bawah; izin share itu tidak diubah.</p>
                    <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
                        <label>Folder server
                            <select style={inputStyle} value={lanRoot} disabled={busy} onChange={e => selectLanRoot(e.target.value)}>
                                <option value="">Pilih folder terdaftar</option>
                                {lan?.server?.roots?.map(root => <option key={root.id} value={root.id} disabled={!root.available}>{root.path}</option>)}
                            </select>
                        </label>
                        {lan?.server?.roots?.some(root => !root.available) && <div role="alert" style={{ color: "var(--danger)", overflowWrap: "anywhere" }}>
                            <strong>Folder tetap terdaftar, tetapi layanan belum dapat membukanya:</strong>
                            <ul>{lan.server.roots.filter(root => !root.available).map(root => <li key={root.id}>{root.path}: {root.error || "Penyebab tidak diketahui"}</li>)}</ul>
                            <p>Minta administrator memeriksa izin pada folder induk yang disebutkan. Jangan daftar ulang folder. Setelah izin diperbaiki, muat ulang status LAN.</p>
                        </div>}
                        <label>Nama atau IPv4 server
                            <input style={inputStyle} value={lanHost} disabled={busy} placeholder="Contoh: DEV" onChange={e => {
                                const nextHost = e.target.value;
                                setLanHost(nextHost); setNewCode("");
                                setLanPath(current => current.toLowerCase().startsWith(`\\\\${lanHost.toLowerCase()}\\`)
                                    ? `\\\\${nextHost}\\${current.slice(lanHost.length + 3)}`
                                    : current);
                            }} />
                        </label>
                        <label>Path jaringan folder
                            <input style={inputStyle} value={lanPath} disabled={busy} placeholder="\\\\DEV\\MGOFP_folder-id" onChange={e => { setLanPath(e.target.value); setNewCode(""); }} />
                        </label>
                    </div>
                    <p>Membuat kode baru mencabut kode dan pendaftaran klien lama untuk folder ini. Semua klien folder ini perlu disambungkan kembali. Layanan dimulai ulang; selesaikan pekerjaan file dahulu.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Button disabled={busy || lan?.server?.lan_protocol !== 1 || !lanRoot || !lanHost.trim() || !lanPath.trim()} onClick={() => configureLan(true)}>Buat kode dengan administrator</Button>
                        <Button variant="danger" disabled={busy || !lanRoot || !lan?.server?.lan?.roots?.includes(lanRoot)} onClick={() => configureLan(false)}>Cabut akses LAN</Button>
                    </div>
                    {lan?.server?.lan_error && <p role="alert">Layanan LAN: {lan.server.lan_error}</p>}
                    {!lan?.server && <p>Pasang/perbarui layanan lewat installer pada komputer server, lalu muat ulang status.</p>}
                    {lan?.server && lan.server.lan_protocol !== 1 && <p>Perbarui layanan lewat installer terbaru dengan mencentang komputer server, lalu muat ulang status LAN.</p>}
                    {newCode && <div style={{ marginTop: 12 }}>
                        <label>Kode koneksi baru — salin ke MGO pada komputer klien
                            <textarea style={{ ...inputStyle, height: 100 }} readOnly value={newCode} onFocus={e => e.target.select()} />
                        </label>
                        <Button variant="secondary" disabled={busy} onClick={() => setNewCode("")}>Tutup kode</Button>
                    </div>}
                </details>
                <h5 style={{ marginBottom: 8 }}>Komputer klien — sambungkan folder server</h5>
                <label>Kode dari administrator server
                    <input type="password" autoComplete="off" style={inputStyle} value={connectionCode} disabled={busy} placeholder="Tempel kode MGO-LAN-1:..." onChange={e => setConnectionCode(e.target.value)} />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    <Button disabled={busy || !connectionCode.trim()} onClick={connectLan}>Sambungkan dan simpan koneksi</Button>
                    <Button variant="secondary" disabled={busy} onClick={async () => {
                        setBusy(true);
                        try { await refreshLan(); } catch (e) { setLanMessage(String(e.message || e)); }
                        finally { setBusy(false); }
                    }}>Muat ulang status LAN</Button>
                </div>
                {lan?.connections?.map(connection => <div key={connection.id} style={{ marginTop: 16 }}>
                    <p><strong>Folder tersambung:</strong> {connection.path}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <Button disabled={busy} onClick={() => verify(connection.id)}>Uji akses Windows dan CRUD LAN</Button>
                        <Button variant="secondary" disabled={busy} onClick={() => openExplorer(connection.path)}>Buka di Explorer</Button>
                        <Button variant="secondary" disabled={busy} onClick={() => disconnectLan(connection.id)}>Hapus koneksi klien</Button>
                    </div>
                    <details style={{ marginTop: 12 }}>
                        <summary>Siapkan akses baca Explorer (sekali untuk akun client ini)</summary>
                        <p>Masukkan akun Windows di komputer server. MGO menyimpan kredensial dengan aman di Credential Manager akun Windows client ini. Akses share tetap baca-saja; CRUD dilakukan lewat MGO.</p>
                        <label>Akun Windows server (contoh DEV\akun)
                            <input style={inputStyle} autoComplete="username" value={smbUsername} disabled={busy} onChange={e => setSmbUsername(e.target.value)} />
                        </label>
                        <label>Kata sandi akun Windows server
                            <input type="password" autoComplete="current-password" style={inputStyle} value={smbPassword} disabled={busy} onChange={e => setSmbPassword(e.target.value)} />
                        </label>
                        <Button disabled={busy || !smbUsername.trim() || !smbPassword} onClick={() => saveExplorerAccess(connection.path)}>
                            {busy ? "Menyimpan..." : "Simpan akses aman & buka Explorer"}
                        </Button>
                    </details>
                </div>)}
                <p>Koneksi MGO dan akses Explorer adalah dua jalur terpisah. CRUD MGO memakai kode koneksi; Explorer hanya baca dan memakai kredensial Windows yang disiapkan sekali di atas. Jangan ubah izin seluruh drive server.</p>
                {lanMessage && <p role="status" style={{ overflowWrap: "anywhere" }}>{lanMessage}</p>}
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
                <p><strong>{verification.passed ? "Pengujian berhasil." : "Ada pengujian yang belum lulus."}</strong>{verification.root_label ? ` ${verification.root_label}: ${verification.root}` : ""}</p>
                <ul>{verification.checks.map((check, index) => <li key={index}>
                    {check.passed ? "Lulus" : "Gagal"}: {check.name}{check.message ? ` - ${check.message}` : ""}
                </li>)}</ul>
                <p>{verification.scope}</p>
                {verification.cleanup_errors.length > 0 && <p role="alert">Pembersihan file uji belum lengkap: {verification.cleanup_errors.join("; ")}</p>}
            </div>}
        </div>
    );
}
