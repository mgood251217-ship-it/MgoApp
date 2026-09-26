import "./Navbar.css";
import { useEffect, useState } from "react";
import api from "../../api/axios";
import { FiBell, FiLogOut, FiMoon, FiSun, FiHelpCircle, FiInfo, FiMinus, FiPlus, FiZoomIn, FiCommand } from "react-icons/fi";
import { authStore, useSession } from "../../services/session";
import { changeTheme } from "../../services/setting";
import Modal from "../Modal/Modal";
import Input from "../Input/Input";
import Select from "../Select/Select";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import Alert from "../Alert/Alert";
import Table from "../Table/Table";
import ShortcutHelp from "../ShortcutHelp/ShortcutHelp";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const THEME_KEY = "theme";
const ZOOM_KEY = "app-zoom";
const ZOOM_LEVELS = [80, 90, 100, 110, 125, 150];
const GITHUB_OWNER = "mgood251217-ship-it";
const GITHUB_REPO = "MgoApp";

function normalizeTheme(mode) {
    return Number(mode) === 1 || mode === "dark" ? "dark" : "light";
}

function getSessionMode(session) {
    return session?.setting?.mode ?? session?.settings?.mode ?? session?.user?.mode ?? session?.mode;
}

function getInitialTheme(session) {
    const sessionMode = getSessionMode(session);

    if (sessionMode !== undefined && sessionMode !== null) {
        return normalizeTheme(sessionMode);
    }

    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
        return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

async function logout() {
    const { data } = await api.post("?action=logout");
    return data;
}

export default function Navbar() {
    const session = useSession();
    const [theme, setTheme] = useState(() => getInitialTheme(null));
    const [zoom, setZoom] = useState(() => Number(localStorage.getItem(ZOOM_KEY)) || 100);
    const [themeLoading, setThemeLoading] = useState(false);
    const storeName = session?.store?.name ?? "MGO Store";
    const userName = session?.user?.name ?? "Guest";
    const role = session?.user?.role ?? "";
    const userId = session?.user?.user_id ?? session?.user_id;
    const avatar = session?.store?.logo_link;

    const [helpModalOpen, setHelpModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("form");
    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);

    const [formHelp, setFormHelp] = useState({
        subject: "",
        category: "bug",
        detail: ""
    });
    const [helpFile, setHelpFile] = useState(null);

    const helpStatusColors = {
        SENT: "rgba(14, 165, 233, 0.15)",
        OPEN: "rgba(59, 130, 246, 0.15)",
        PROCESS: "rgba(139, 92, 246, 0.15)",
        REJECT: "rgba(239, 68, 68, 0.15)",
        ACCEPT: "rgba(16, 185, 129, 0.15)",
        FINISHED: "rgba(100, 116, 139, 0.15)",
    };

    const helpStatusTextColors = {
        SENT: "#0ea5e9",
        OPEN: "#3b82f6",
        PROCESS: "#8b5cf6",
        REJECT: "#ef4444",
        ACCEPT: "#10b981",
        FINISHED: "#64748b",
    };

    const [changelogOpen, setChangelogOpen] = useState(false);
    const [changelogData, setChangelogData] = useState([]);
    const [changelogLoading, setChangelogLoading] = useState(false);
    const [changelogError, setChangelogError] = useState("");

    const [viewHelpImage, setViewHelpImage] = useState(null);

    const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

    useEffect(() => {
        setTheme(getInitialTheme(session));
    }, [session]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    useEffect(() => {
        document.documentElement.style.zoom = `${zoom}%`;
        localStorage.setItem(ZOOM_KEY, String(zoom));

        return () => {
            document.documentElement.style.zoom = "";
        };
    }, [zoom]);

    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === "F1") {
                e.preventDefault();
                setShortcutHelpOpen((prev) => !prev);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const changeZoom = (direction) => {
        setZoom((currentZoom) => {
            const currentIndex = ZOOM_LEVELS.indexOf(currentZoom);
            const nextIndex = Math.min(
                Math.max(currentIndex + direction, 0),
                ZOOM_LEVELS.length - 1
            );
            return ZOOM_LEVELS[nextIndex];
        });
    };

    async function handleLogout() {
        try { await logout(); } catch (e) {}
        authStore.logout();
    }

    async function handleTheme() {
        if (themeLoading) return;

        const currentTheme = theme;
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        const mode = nextTheme === "dark" ? 1 : 0;

        setTheme(nextTheme);
        setThemeLoading(true);

        try {
            const response = await changeTheme({ user_id: userId, mode });

            if (!response?.success) {
                throw new Error(response?.message || "Gagal menyimpan tema.");
            }
        } catch (error) {
            setTheme(currentTheme);
        } finally {
            setThemeLoading(false);
        }
    }

    const fetchTickets = async () => {
        setIsLoadingList(true);
        try {
            const res = await api.get("", { params: { action: "helps" } });
            if (res.data?.success) {
                setTickets(res.data.data || []);
            } else {
                setTickets([]);
            }
        } catch (error) {
            setTickets([]);
        } finally {
            setIsLoadingList(false);
        }
    };

    const handleOpenHelp = () => {
        setHelpModalOpen(true);
        setActiveTab("form");
        setSelectedTicket(null);
        setFormHelp({ subject: "", category: "bug", detail: "" });
        setHelpFile(null);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedTicket(null);
        if (tab === "list") {
            fetchTickets();
        }
    };

    const handleHelpFileChange = (file) => {
        if (!file) return;
        const maxSizeMb = 5;
        if (file.size > maxSizeMb * 1024 * 1024) {
            setAlertConfig({ show: true, type: "error", message: `Ukuran file maksimal ${maxSizeMb}MB.` });
            return;
        }
        setHelpFile(file);
    };

    const handleSubmitHelp = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const now = new Date();
            const datetimeStr = now.getFullYear() + "-" + 
                                String(now.getMonth() + 1).padStart(2, '0') + "-" + 
                                String(now.getDate()).padStart(2, '0') + " " + 
                                String(now.getHours()).padStart(2, '0') + ":" + 
                                String(now.getMinutes()).padStart(2, '0') + ":" + 
                                String(now.getSeconds()).padStart(2, '0');

            const payload = new FormData();
            payload.append("category", formHelp.category);
            payload.append("subject", formHelp.subject);
            payload.append("detail", formHelp.detail);
            payload.append("status", "SENT");
            payload.append("datetime", datetimeStr);
            if (helpFile) {
                payload.append("picture", helpFile);
            }

            const res = await api.post("", payload, { params: { action: "create_help" } });
            
            if (res.data?.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal mengirim pengajuan." });
            } else {
                setAlertConfig({ show: true, type: "success", message: "Pengajuan berhasil dikirim!" });
                setFormHelp({ subject: "", category: "bug", detail: "" });
                setHelpFile(null);
                setTimeout(() => {
                    handleTabChange("list");
                }, 1000);
            }
        } catch (error) {
            setAlertConfig({ show: true, type: "error", message: "Gagal mengirim pengajuan." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChangelog = async () => {
        setChangelogOpen(true);
        if (changelogData.length > 0) return;
        setChangelogLoading(true);
        setChangelogError("");
        try {
            const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`);
            if (!res.ok) throw new Error("Gagal mengambil data dari GitHub");
            const data = await res.json();
            setChangelogData(data);
        } catch (err) {
            setChangelogError(err.message);
        } finally {
            setChangelogLoading(false);
        }
    };

    return (
        <>
            <header className="navbar">
                <div className="navbar-left">
                    <img src={avatar} alt="Logo" className="navbar-logo" />
                    <div className="navbar-store">
                        <h3>{storeName}</h3>
                        <span>{userName} {role ? `\u2022 ${role}` : ""}</span>
                    </div>
                </div>

                <div className="navbar-right">
                    <div className="navbar-zoom" aria-label="Ukuran tampilan">
                        <FiZoomIn aria-hidden="true" />
                        <button
                            className="navbar-zoom-button"
                            onClick={() => changeZoom(-1)}
                            disabled={zoom === ZOOM_LEVELS[0]}
                            aria-label="Perkecil tampilan"
                            title="Perkecil tampilan"
                        >
                            <FiMinus />
                        </button>
                        <span className="navbar-zoom-value">{zoom}%</span>
                        <button
                            className="navbar-zoom-button"
                            onClick={() => changeZoom(1)}
                            disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                            aria-label="Perbesar tampilan"
                            title="Perbesar tampilan"
                        >
                            <FiPlus />
                        </button>
                    </div>
                    <button
                        className="navbar-button"
                        onClick={handleTheme}
                        disabled={themeLoading}
                        aria-label={theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode"}
                        title={theme === "dark" ? "Light mode" : "Dark mode"}
                    >
                        {theme === "dark" ? <FiSun /> : <FiMoon />}
                    </button>
                    <button
                        className="navbar-button"
                        onClick={() => setShortcutHelpOpen(true)}
                        title="Panduan Keyboard Shortcut (F1)"
                        aria-label="Panduan Keyboard Shortcut"
                    >
                        <FiCommand />
                    </button>
                    <button 
                        className="navbar-button" 
                        onClick={handleOpenChangelog}
                        title="Changelog"
                    >
                        <FiInfo />
                    </button>
                    <button 
                        className="navbar-button" 
                        onClick={handleOpenHelp}
                        title="Help Center"
                    >
                        <FiHelpCircle />
                    </button>
                    <button className="navbar-logout" onClick={handleLogout}>
                        <FiLogOut />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />

            <Modal 
                open={helpModalOpen} 
                onClose={() => setHelpModalOpen(false)} 
                title="Help Center" 
                size="md"
            >
                <div style={{ padding: "0 16px 16px" }}>
                    {alertConfig.show && (
                        <div style={{ marginBottom: "16px" }}>
                            <Alert type={alertConfig.type} message={alertConfig.message} onClose={() => setAlertConfig({ ...alertConfig, show: false, message: "" })} />
                        </div>
                    )}

                    {!selectedTicket && (
                        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                            <Button 
                                variant={activeTab === "form" ? "primary" : "secondary"} 
                                onClick={() => handleTabChange("form")}
                                size="sm"
                            >
                                Buat Pengajuan
                            </Button>
                            <Button 
                                variant={activeTab === "list" ? "primary" : "secondary"} 
                                onClick={() => handleTabChange("list")}
                                size="sm"
                            >
                                Riwayat Pengajuan
                            </Button>
                        </div>
                    )}

                    {activeTab === "form" && !selectedTicket && (
                        <form onSubmit={handleSubmitHelp}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                                <Select
                                    labelPosition="top"
                                    name="category"
                                    label="Kategori"
                                    value={formHelp.category}
                                    onChange={(e) => setFormHelp({ ...formHelp, category: e.target.value })}
                                    options={[
                                        { value: "bug", label: "Lapor Bug / Error" },
                                        { value: "feature", label: "Request Fitur Baru" },
                                        { value: "question", label: "Pertanyaan" },
                                        { value: "other", label: "Lainnya" }
                                    ]}
                                    required
                                />
                                <Input
                                    labelPosition="top"
                                    name="subject"
                                    label="Subjek"
                                    placeholder="Singkat dan jelas..."
                                    value={formHelp.subject}
                                    onChange={(e) => setFormHelp({ ...formHelp, subject: e.target.value })}
                                    required
                                />
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Detail</label>
                                    <textarea 
                                        required
                                        rows={5}
                                        value={formHelp.detail}
                                        onChange={(e) => setFormHelp({ ...formHelp, detail: e.target.value })}
                                        style={{ 
                                            width: "100%", 
                                            padding: "10px", 
                                            borderRadius: "var(--radius)", 
                                            border: "1px solid var(--border)", 
                                            backgroundColor: "var(--bg-content)", 
                                            color: "var(--text)", 
                                            resize: "vertical" 
                                        }}
                                        placeholder="Jelaskan detail masalah atau permintaan Anda..."
                                    />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
                                        Lampiran <span style={{ fontWeight: "400", color: "var(--text-muted)" }}>(opsional, gambar/dokumen, maks 5MB)</span>
                                    </label>

                                    {!helpFile ? (
                                        <label
                                            onDragOver={(e) => e.preventDefault()}
                                            onDragEnter={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const file = e.dataTransfer?.files?.[0];
                                                if (file) handleHelpFileChange(file);
                                            }}
                                            style={{
                                                padding: "16px",
                                                borderRadius: "var(--radius)",
                                                border: "2px dashed var(--border)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "8px",
                                                backgroundColor: "var(--bg-content)",
                                                color: "var(--text-muted)",
                                                fontSize: "13px",
                                                fontWeight: "600",
                                                cursor: "pointer",
                                                transition: "background 0.2s"
                                            }}
                                        >
                                            <input
                                                type="file"
                                                accept="image/*,.pdf,.doc,.docx,.txt"
                                                style={{ display: "none" }}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleHelpFileChange(file);
                                                    e.target.value = null;
                                                }}
                                            />
                                            <Icon name="upload_file" />
                                            Klik atau seret file ke sini untuk melampirkan
                                        </label>
                                    ) : (
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "12px",
                                            padding: "10px 14px",
                                            borderRadius: "var(--radius)",
                                            border: "1px solid var(--border)",
                                            backgroundColor: "var(--bg-content)"
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                                {helpFile.type?.startsWith("image/") ? (
                                                    <img
                                                        src={URL.createObjectURL(helpFile)}
                                                        alt="Preview lampiran"
                                                        style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "6px", border: "1px solid var(--border)" }}
                                                    />
                                                ) : (
                                                    <Icon name="description" />
                                                )}
                                                <span style={{ fontSize: "13px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {helpFile.name}
                                                </span>
                                                <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                                                    ({(helpFile.size / 1024).toFixed(0)} KB)
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="danger"
                                                size="sm"
                                                icon={<Icon name="close" />}
                                                onClick={() => setHelpFile(null)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <Button type="submit" variant="success" disabled={isSubmitting} icon={<Icon name={isSubmitting ? "hourglass_empty" : "send"} />}>
                                    {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {activeTab === "list" && (
                        <div>
                            {selectedTicket ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                                        <Button variant="secondary" size="sm" onClick={() => setSelectedTicket(null)}>
                                            Kembali ke Daftar
                                        </Button>
                                    </div>
                                    <div style={{ padding: "16px", backgroundColor: "var(--bg-content)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                                        <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{selectedTicket.datetime}</span>
                                            <span style={{ 
                                                padding: "4px 12px", 
                                                borderRadius: "12px", 
                                                fontSize: "12px", 
                                                fontWeight: "bold",
                                                backgroundColor: helpStatusColors[selectedTicket.status?.toUpperCase()] || "rgba(148, 163, 184, 0.15)",
                                                color: helpStatusTextColors[selectedTicket.status?.toUpperCase()] || "#64748b"
                                            }}>
                                                {selectedTicket.status}
                                            </span>
                                        </div>
                                        <h3 style={{ margin: "0 0 4px 0", color: "var(--text)" }}>{selectedTicket.subject}</h3>
                                        <div style={{ fontSize: "13px", color: "var(--primary)", fontWeight: "600", marginBottom: "16px", textTransform: "uppercase" }}>
                                            Kategori: {selectedTicket.category}
                                        </div>
                                        <div style={{ 
                                            padding: "12px", 
                                            backgroundColor: "var(--bg-body)", 
                                            borderRadius: "var(--radius)",
                                            whiteSpace: "pre-wrap",
                                            fontSize: "14px",
                                            color: "var(--text)",
                                            border: "1px solid var(--border)"
                                        }}>
                                            {selectedTicket.detail}
                                        </div>

                                        {selectedTicket.picture_link && (
                                            <div style={{ marginTop: "16px" }}>
                                                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "8px" }}>Lampiran</div>
                                                <img
                                                    src={selectedTicket.picture_link}
                                                    alt="Lampiran"
                                                    onClick={() => setViewHelpImage(selectedTicket.picture_link)}
                                                    style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "var(--radius)", border: "1px solid var(--border)", cursor: "pointer" }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : isLoadingList ? (
                                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                                    <Icon name="sync" /> Memuat data...
                                </div>
                            ) : tickets.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", border: "1px dashed var(--border)", borderRadius: "var(--radius)" }}>
                                    Belum ada riwayat pengajuan.
                                </div>
                            ) : (
                                <Table
                                    id="help-ticket-table"
                                    size="sm"
                                    showNumber={true}
                                    rowKey="id"
                                    onRowDoubleClick={(row) => setSelectedTicket(row)}
                                    columns={[
                                        { key: "datetime", title: "Waktu", render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.datetime}</span> },
                                        { key: "category", title: "Kategori", render: (row) => <span style={{ textTransform: "capitalize", fontSize: "12px" }}>{row.category}</span> },
                                        { key: "subject", title: "Subjek", render: (row) => (
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                                <strong>{row.subject}</strong>
                                                {row.picture_link && (
                                                    <img
                                                        src={row.picture_link}
                                                        alt="Lampiran"
                                                        onClick={(e) => { e.stopPropagation(); setViewHelpImage(row.picture_link); }}
                                                        style={{ width: "24px", height: "24px", objectFit: "cover", borderRadius: "4px", border: "1px solid var(--border)", cursor: "pointer" }}
                                                    />
                                                )}
                                            </span>
                                        ) },
                                        { key: "status", title: "Status", render: (row) => (
                                            <span style={{ 
                                                padding: "2px 8px", 
                                                borderRadius: "12px", 
                                                fontSize: "11px", 
                                                fontWeight: "bold",
                                                backgroundColor: helpStatusColors[row.status?.toUpperCase()] || "rgba(148, 163, 184, 0.15)",
                                                color: helpStatusTextColors[row.status?.toUpperCase()] || "#64748b"
                                            }}>
                                                {row.status}
                                            </span>
                                        )}
                                    ]}
                                    rows={tickets}
                                />
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal open={changelogOpen} onClose={() => setChangelogOpen(false)} title="Changelog Aplikasi" size="md">
                <div style={{ padding: "0 16px 16px", maxHeight: "70vh", overflowY: "auto" }}>
                    {changelogLoading ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            <Icon name="sync" /> Memuat data rilis...
                        </div>
                    ) : changelogError ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--danger)" }}>
                            {changelogError}
                        </div>
                    ) : changelogData.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            Belum ada versi rilis.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {changelogData.map((release) => (
                                <div key={release.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "24px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                        <div>
                                            <h3 style={{ margin: "0 0 8px 0", color: "var(--text)", fontSize: "18px" }}>
                                                {release.name || release.tag_name}
                                            </h3>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--primary)", backgroundColor: "rgba(var(--primary-rgb), 0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                                                    {release.tag_name}
                                                </span>
                                                {release.prerelease && (
                                                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--warning)", backgroundColor: "rgba(var(--warning-rgb), 0.1)", padding: "2px 8px", borderRadius: "12px" }}>
                                                        Pre-release
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                            {new Date(release.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div style={{ 
                                        fontSize: "14px", 
                                        color: "var(--text)", 
                                        lineHeight: "1.6",
                                        backgroundColor: "var(--bg-content)",
                                        padding: "14px 30px",
                                        borderRadius: "var(--radius)",
                                        border: "1px solid var(--border)",
                                        overflowWrap: "break-word"
                                    }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {release.body}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                open={!!viewHelpImage}
                onClose={() => setViewHelpImage(null)}
                title="Lampiran"
                size="lg"
            >
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
                    {viewHelpImage && (
                        <img
                            src={viewHelpImage}
                            alt="Lampiran"
                            style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "var(--radius)" }}
                        />
                    )}
                </div>
            </Modal>
        </>
    );
}