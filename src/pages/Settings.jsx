import { useEffect, useState, useCallback } from "react";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Button from "../components/Button/Button";
import Form from "../components/Form/Form";
import Icon from "../components/Icon/Icon";
import Alert from "../components/Alert/Alert";

const PATH_FIELDS = [
    { key: "path_indoor", label: "Path Indoor" },
    { key: "path_outdoor", label: "Path Outdoor" },
    { key: "path_sublim", label: "Path Sublim" },
    { key: "path_laser", label: "Path Laser" },
    { key: "path_akrilik", label: "Path Akrilik" },
    { key: "path_dtf", label: "Path DTF" },
];

const LAYOUT_COLORS = [
    { key: "theme_sidebar", label: "Background Sidebar" },
    { key: "theme_navbar", label: "Background Navbar" },
    { key: "theme_background", label: "Background Utama" },
];

const ACCENT_COLORS = [
    { key: "theme_primary", label: "Primary (Utama)" },
    { key: "theme_secondary", label: "Secondary (Sekunder)" },
    { key: "theme_success", label: "Success (Sukses)" },
    { key: "theme_warning", label: "Warning (Peringatan)" },
    { key: "theme_danger", label: "Danger (Bahaya)" },
];

export default function Settings() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });

    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.electron.getSettings();
            setSettings(data || {});
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal memuat pengaturan." });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handlePilihPath = async (key) => {
        try {
            const folderPath = await window.electron.pilihFolder();
            if (!folderPath) return;
            setSettings(prev => ({ ...prev, [key]: folderPath }));
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal membuka dialog folder." });
        }
    };

    const handleInputChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await window.electron.saveSettings(settings);
            if (!res.success) {
                setAlertConfig({ show: true, type: "error", message: res.message || "Gagal menyimpan pengaturan." });
            } else {
                setSettings(res.data);
                setAlertConfig({ show: true, type: "success", message: "Pengaturan berhasil disimpan. Restart aplikasi untuk menerapkan warna." });
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Terjadi kesalahan saat menyimpan." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {alertConfig.show && (
                <Alert
                    type={alertConfig.type}
                    message={alertConfig.message}
                    onClose={() => setAlertConfig({ ...alertConfig, show: false, message: "" })}
                />
            )}

            <Header
                title="Pengaturan"
                subtitle="Konfigurasi path folder dan personalisasi tampilan aplikasi."
            />

            <div style={{ padding: "32px", flex: 1, overflowY: "auto" }}>
                {loading ? (
                    <div style={{ color: "var(--secondary)", textAlign: "center", padding: "40px" }}>
                        Memuat pengaturan...
                    </div>
                ) : (
                    <Form id="formSettings" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "32px", maxWidth: "1600px" }}>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "32px", alignItems: "start" }}>
                            
                            <div style={{ backgroundColor: "var(--bg-content)", padding: "28px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px" }}>
                                    <h3 style={{ color: "var(--text)", margin: 0, fontSize: "18px" }}>Path Folder Produksi</h3>
                                </div>
                                
                                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                    {PATH_FIELDS.map(({ key, label }) => (
                                        <div key={key} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                            <label style={{ fontWeight: "600", fontSize: 13, color: "var(--text-secondary)" }}>
                                                {label}
                                            </label>
                                            <div style={{ display: "flex", gap: "12px" }}>
                                                <div style={{ flex: 1 }}>
                                                    <Input
                                                        name={key}
                                                        value={settings[key] || ""}
                                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                                        placeholder="Belum diatur..."
                                                        margin="0"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    icon={<Icon name="folder" />}
                                                    onClick={() => handlePilihPath(key)}
                                                >
                                                    Pilih
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ backgroundColor: "var(--bg-content)", padding: "28px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px" }}>
                                    <h3 style={{ color: "var(--text)", margin: 0, fontSize: "18px" }}>Warna Layout & Latar</h3>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    {LAYOUT_COLORS.map(({ key, label }) => (
                                        <div key={key} style={{ 
                                            display: "flex", 
                                            justifyContent: "space-between", 
                                            alignItems: "center", 
                                            padding: "16px 20px", 
                                            backgroundColor: "var(--background)", 
                                            border: "1px solid var(--border)", 
                                            borderRadius: "10px" 
                                        }}>
                                            <label style={{ fontWeight: "600", fontSize: 14, color: "var(--text)" }}>
                                                {label}
                                            </label>
                                            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                                                <span style={{ fontSize: "14px", color: "var(--text-muted)", fontFamily: "monospace", textTransform: "uppercase" }}>
                                                    {settings[key] || "#000000"}
                                                </span>
                                                <div style={{ position: "relative", width: "42px", height: "42px", borderRadius: "8px", overflow: "hidden", border: "2px solid var(--border)" }}>
                                                    <input
                                                        type="color"
                                                        name={key}
                                                        value={settings[key] || "#000000"}
                                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                                        style={{
                                                            position: "absolute",
                                                            top: "-10px",
                                                            left: "-10px",
                                                            width: "62px",
                                                            height: "62px",
                                                            padding: "0",
                                                            border: "none",
                                                            cursor: "pointer",
                                                            background: "transparent"
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ backgroundColor: "var(--bg-content)", padding: "28px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px" }}>
                                    <h3 style={{ color: "var(--text)", margin: 0, fontSize: "18px" }}>Warna Aksen & Status</h3>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    {ACCENT_COLORS.map(({ key, label }) => (
                                        <div key={key} style={{ 
                                            display: "flex", 
                                            justifyContent: "space-between", 
                                            alignItems: "center", 
                                            padding: "16px 20px", 
                                            backgroundColor: "var(--background)", 
                                            border: "1px solid var(--border)", 
                                            borderRadius: "10px" 
                                        }}>
                                            <label style={{ fontWeight: "600", fontSize: 14, color: "var(--text)" }}>
                                                {label}
                                            </label>
                                            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                                                <span style={{ fontSize: "14px", color: "var(--text-muted)", fontFamily: "monospace", textTransform: "uppercase" }}>
                                                    {settings[key] || "#000000"}
                                                </span>
                                                <div style={{ position: "relative", width: "42px", height: "42px", borderRadius: "8px", overflow: "hidden", border: "2px solid var(--border)" }}>
                                                    <input
                                                        type="color"
                                                        name={key}
                                                        value={settings[key] || "#000000"}
                                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                                        style={{
                                                            position: "absolute",
                                                            top: "-10px",
                                                            left: "-10px",
                                                            width: "62px",
                                                            height: "62px",
                                                            padding: "0",
                                                            border: "none",
                                                            cursor: "pointer",
                                                            background: "transparent"
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", paddingBottom: "24px" }}>
                            <Button
                                type="submit"
                                size="lg"
                                variant="success"
                                disabled={saving}
                                icon={<Icon name={saving ? "hourglass_empty" : "save"} />}
                            >
                                {saving ? "Menyimpan Pengaturan..." : "Simpan Pengaturan"}
                            </Button>
                        </div>
                    </Form>
                )}
            </div>
        </div>
    );
}