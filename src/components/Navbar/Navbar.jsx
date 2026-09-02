import "./Navbar.css";
import { useEffect, useState } from "react";
import api from "../../api/axios";
import { FiBell, FiLogOut, FiMoon, FiSun, FiHelpCircle, FiInfo } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { authStore, useSession } from "../../services/session";
import { changeTheme } from "../../services/setting";
import Modal from "../Modal/Modal";
import Input from "../Input/Input";
import Select from "../Select/Select";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import Alert from "../Alert/Alert";
import Table from "../Table/Table";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const THEME_KEY = "theme";
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
    const navigate = useNavigate();
    const session = useSession();
    const [theme, setTheme] = useState(() => getInitialTheme(null));
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

    const [changelogOpen, setChangelogOpen] = useState(false);
    const [changelogData, setChangelogData] = useState([]);
    const [changelogLoading, setChangelogLoading] = useState(false);
    const [changelogError, setChangelogError] = useState("");

    useEffect(() => {
        setTheme(getInitialTheme(session));
    }, [session]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    async function handleLogout() {
        try { await logout(); } catch (e) {}
        authStore.logout();
        navigate("/login", { replace: true });
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
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedTicket(null);
        if (tab === "list") {
            fetchTickets();
        }
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
            payload.append("status", "OPEN");
            payload.append("datetime", datetimeStr);

            const res = await api.post("", payload, { params: { action: "create_help" } });
            
            if (res.data?.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal mengirim pengajuan." });
            } else {
                setAlertConfig({ show: true, type: "success", message: "Pengajuan berhasil dikirim!" });
                setFormHelp({ subject: "", category: "bug", detail: "" });
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
                    <button className="navbar-button">
                        <FiBell />
                        <span className="navbar-badge">3</span>
                    </button>
                    <button className="navbar-logout" onClick={handleLogout}>
                        <FiLogOut />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

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
                                                backgroundColor: selectedTicket.status?.toUpperCase() === 'OPEN' ? 'rgba(var(--warning-rgb), 0.2)' : 'rgba(var(--success-rgb), 0.2)',
                                                color: selectedTicket.status?.toUpperCase() === 'OPEN' ? 'var(--warning)' : 'var(--success)'
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
                                        { key: "subject", title: "Subjek", render: (row) => <strong>{row.subject}</strong> },
                                        { key: "status", title: "Status", render: (row) => (
                                            <span style={{ 
                                                padding: "2px 8px", 
                                                borderRadius: "12px", 
                                                fontSize: "11px", 
                                                fontWeight: "bold",
                                                backgroundColor: row.status?.toUpperCase() === 'OPEN' ? 'rgba(var(--warning-rgb), 0.2)' : 'rgba(var(--success-rgb), 0.2)',
                                                color: row.status?.toUpperCase() === 'OPEN' ? 'var(--warning)' : 'var(--success)'
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
        </>
    );
}