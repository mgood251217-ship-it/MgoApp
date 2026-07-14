import { useEffect, useState, useCallback } from "react";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Button from "../components/Button/Button";
import Form from "../components/Form/Form";
import Icon from "../components/Icon/Icon";
import Alert from "../components/Alert/Alert";

// Tambah path baru di sini kalau ada kategori baru (contoh: path_dtf, path_akrilik, dst)
const PATH_FIELDS = [
    { key: "path_indoor", label: "Path Indoor" },
    { key: "path_outdoor", label: "Path Outdoor" },
    { key: "path_sublim", label: "Path Sublim" },
    { key: "path_laser", label: "Path Laser" },
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
            if (!folderPath) return; // user membatalkan
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
                setAlertConfig({ show: true, type: "success", message: "Pengaturan berhasil disimpan." });
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Terjadi kesalahan saat menyimpan." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            {alertConfig.show && (
                <Alert
                    type={alertConfig.type}
                    message={alertConfig.message}
                    onClose={() => setAlertConfig({ ...alertConfig, show: false, message: "" })}
                />
            )}

            <Header
                title="Pengaturan"
                subtitle="Konfigurasi path folder dan pengaturan aplikasi lainnya."
            />

            <div style={{ marginTop: 24, maxWidth: 700 }}>
                <div style={{ backgroundColor: "var(--bg-content)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <h3 style={{ marginBottom: 16 }}>Path Folder Produksi</h3>

                    {loading ? (
                        <div style={{ color: "var(--secondary)" }}>Memuat pengaturan...</div>
                    ) : (
                        <Form id="formSettings" onSubmit={handleSubmit}>
                            {PATH_FIELDS.map(({ key, label }) => (
                                <div key={key} style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", marginBottom: 6, fontWeight: "bold", fontSize: 14 }}>
                                        {label}
                                    </label>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <div style={{ flex: 1 }}>
                                            <Input
                                                name={key}
                                                value={settings[key] || ""}
                                                onChange={(e) => handleInputChange(key, e.target.value)}
                                                placeholder={`Belum diatur...`}
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

                            <Button
                                type="submit"
                                size="full-lg"
                                variant="success"
                                disabled={saving}
                                icon={<Icon name={saving ? "hourglass_empty" : "save"} />}
                            >
                                {saving ? "Menyimpan..." : "Simpan Pengaturan"}
                            </Button>
                        </Form>
                    )}
                </div>
            </div>
        </>
    );
}
