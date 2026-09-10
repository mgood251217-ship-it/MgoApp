import { useEffect, useState, useCallback, useRef } from "react";
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
    { key: "theme_content", label: "Background Konten" },
    { key: "theme_footer", label: "Background Footer" },
];

const ACCENT_COLORS = [
    { key: "theme_primary", label: "Primary (Utama)" },
    { key: "theme_primary_hover", label: "Primary Hover" },
    { key: "theme_secondary", label: "Secondary (Sekunder)" },
    { key: "theme_secondary_hover", label: "Secondary Hover" },
    { key: "theme_success", label: "Success (Sukses)" },
    { key: "theme_success_hover", label: "Success Hover" },
    { key: "theme_info", label: "Info (Informasi)" },
    { key: "theme_info_hover", label: "Info Hover" },
    { key: "theme_warning", label: "Warning (Peringatan)" },
    { key: "theme_warning_hover", label: "Warning Hover" },
    { key: "theme_danger", label: "Danger (Bahaya)" },
    { key: "theme_danger_hover", label: "Danger Hover" },
];

const TEXT_COLORS = [
    { key: "theme_text", label: "Teks Utama" },
    { key: "theme_text_secondary", label: "Teks Sekunder" },
    { key: "theme_text_muted", label: "Teks Redup (Muted)" },
];

const OTHER_COLORS = [
    { key: "theme_border", label: "Warna Garis (Border)" },
    { key: "theme_active", label: "Warna Aktif (Active)" },
];

const ALL_COLOR_KEYS = [
    ...LAYOUT_COLORS,
    ...ACCENT_COLORS,
    ...TEXT_COLORS,
    ...OTHER_COLORS,
].map(({ key }) => key);

const COLOR_PRESETS = [
    {
        name: "Aurora Night",
        preview: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #8b5cf6 100%)",
        colors: {
            theme_sidebar: "linear-gradient(135deg, #0f172a 0%, #111827 100%)",
            theme_navbar: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            theme_background: "linear-gradient(180deg, #020817 0%, #0f172a 45%, #111827 100%)",
            theme_content: "linear-gradient(180deg, #111827 0%, #1f2937 100%)",
            theme_footer: "linear-gradient(135deg, #111827 0%, #0f172a 100%)",
            theme_primary: "#60a5fa",
            theme_primary_hover: "#3b82f6",
            theme_secondary: "#a78bfa",
            theme_secondary_hover: "#8b5cf6",
            theme_success: "#34d399",
            theme_success_hover: "#10b981",
            theme_info: "#38bdf8",
            theme_info_hover: "#0ea5e9",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#f87171",
            theme_danger_hover: "#ef4444",
            theme_text: "#e2e8f0",
            theme_text_secondary: "#cbd5e1",
            theme_text_muted: "#94a3b8",
            theme_border: "#334155",
            theme_active: "#60a5fa"
        }
    },
    {
        name: "Ocean Pulse",
        preview: "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 50%, #22d3ee 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #082f49 0%, #0f172a 100%)",
            theme_navbar: "linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%)",
            theme_background: "linear-gradient(180deg, #ecfeff 0%, #e0f2fe 55%, #cffafe 100%)",
            theme_content: "linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)",
            theme_footer: "linear-gradient(135deg, #dbeafe 0%, #cffafe 100%)",
            theme_primary: "#0ea5e9",
            theme_primary_hover: "#0284c7",
            theme_secondary: "#22d3ee",
            theme_secondary_hover: "#06b6d4",
            theme_success: "#14b8a6",
            theme_success_hover: "#0f766e",
            theme_info: "#3b82f6",
            theme_info_hover: "#1d4ed8",
            theme_warning: "#f59e0b",
            theme_warning_hover: "#d97706",
            theme_danger: "#ef4444",
            theme_danger_hover: "#dc2626",
            theme_text: "#0f172a",
            theme_text_secondary: "#334155",
            theme_text_muted: "#64748b",
            theme_border: "#bae6fd",
            theme_active: "#0ea5e9"
        }
    },
    {
        name: "Sunset Glow",
        preview: "linear-gradient(135deg, #fb7185 0%, #f97316 45%, #fbbf24 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #431407 0%, #7c2d12 100%)",
            theme_navbar: "linear-gradient(135deg, #7c2d12 0%, #b45309 100%)",
            theme_background: "linear-gradient(180deg, #fff7ed 0%, #fff1f2 50%, #fde68a 100%)",
            theme_content: "linear-gradient(180deg, #fffaf7 0%, #fff1f2 100%)",
            theme_footer: "linear-gradient(135deg, #fed7aa 0%, #fbcfe8 100%)",
            theme_primary: "#f97316",
            theme_primary_hover: "#ea580c",
            theme_secondary: "#fb7185",
            theme_secondary_hover: "#f43f5e",
            theme_success: "#34d399",
            theme_success_hover: "#10b981",
            theme_info: "#f59e0b",
            theme_info_hover: "#d97706",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#ef4444",
            theme_danger_hover: "#dc2626",
            theme_text: "#1f2937",
            theme_text_secondary: "#4b5563",
            theme_text_muted: "#6b7280",
            theme_border: "#fdba74",
            theme_active: "#f97316"
        }
    },
    {
        name: "Emerald Luxe",
        preview: "linear-gradient(135deg, #10b981 0%, #14b8a6 45%, #22d3ee 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #022c22 0%, #064e3b 100%)",
            theme_navbar: "linear-gradient(135deg, #064e3b 0%, #0f766e 100%)",
            theme_background: "linear-gradient(180deg, #ecfdf5 0%, #d1fae5 50%, #ccfbf1 100%)",
            theme_content: "linear-gradient(180deg, #f0fdf4 0%, #ecfeff 100%)",
            theme_footer: "linear-gradient(135deg, #bbf7d0 0%, #a7f3d0 100%)",
            theme_primary: "#10b981",
            theme_primary_hover: "#059669",
            theme_secondary: "#34d399",
            theme_secondary_hover: "#10b981",
            theme_success: "#22c55e",
            theme_success_hover: "#16a34a",
            theme_info: "#14b8a6",
            theme_info_hover: "#0f766e",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#f87171",
            theme_danger_hover: "#ef4444",
            theme_text: "#0f172a",
            theme_text_secondary: "#1f2937",
            theme_text_muted: "#64748b",
            theme_border: "#86efac",
            theme_active: "#10b981"
        }
    },
    {
        name: "Violet Haze",
        preview: "linear-gradient(135deg, #8b5cf6 0%, #c084fc 45%, #ec4899 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #1f1634 0%, #312e81 100%)",
            theme_navbar: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
            theme_background: "linear-gradient(180deg, #f5f3ff 0%, #fdf2f8 45%, #eef2ff 100%)",
            theme_content: "linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%)",
            theme_footer: "linear-gradient(135deg, #ddd6fe 0%, #fbcfe8 100%)",
            theme_primary: "#8b5cf6",
            theme_primary_hover: "#7c3aed",
            theme_secondary: "#c084fc",
            theme_secondary_hover: "#a855f7",
            theme_success: "#34d399",
            theme_success_hover: "#10b981",
            theme_info: "#60a5fa",
            theme_info_hover: "#3b82f6",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#f87171",
            theme_danger_hover: "#ef4444",
            theme_text: "#1e1b4b",
            theme_text_secondary: "#4338ca",
            theme_text_muted: "#6d28d9",
            theme_border: "#ddd6fe",
            theme_active: "#8b5cf6"
        }
    },
    {
        name: "Slate Calm",
        preview: "linear-gradient(135deg, #334155 0%, #64748b 45%, #cbd5e1 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #1f2937 0%, #334155 100%)",
            theme_navbar: "linear-gradient(135deg, #374151 0%, #475569 100%)",
            theme_background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 52%, #cbd5e1 100%)",
            theme_content: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            theme_footer: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
            theme_primary: "#475569",
            theme_primary_hover: "#334155",
            theme_secondary: "#94a3b8",
            theme_secondary_hover: "#64748b",
            theme_success: "#22c55e",
            theme_success_hover: "#16a34a",
            theme_info: "#3b82f6",
            theme_info_hover: "#1d4ed8",
            theme_warning: "#f59e0b",
            theme_warning_hover: "#d97706",
            theme_danger: "#ef4444",
            theme_danger_hover: "#dc2626",
            theme_text: "#0f172a",
            theme_text_secondary: "#475569",
            theme_text_muted: "#64748b",
            theme_border: "#cbd5e1",
            theme_active: "#475569"
        }
    },
    {
        name: "Rose Quartz",
        preview: "linear-gradient(135deg, #f472b6 0%, #fb7185 40%, #f9a8d4 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #3f1d2e 0%, #7a1c4d 100%)",
            theme_navbar: "linear-gradient(135deg, #9d174d 0%, #be185d 100%)",
            theme_background: "linear-gradient(180deg, #fff1f2 0%, #fdf2f8 55%, #fce7f3 100%)",
            theme_content: "linear-gradient(180deg, #ffffff 0%, #fff1f2 100%)",
            theme_footer: "linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)",
            theme_primary: "#ec4899",
            theme_primary_hover: "#db2777",
            theme_secondary: "#fb7185",
            theme_secondary_hover: "#f43f5e",
            theme_success: "#34d399",
            theme_success_hover: "#10b981",
            theme_info: "#60a5fa",
            theme_info_hover: "#3b82f6",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#ef4444",
            theme_danger_hover: "#dc2626",
            theme_text: "#4c1d95",
            theme_text_secondary: "#7c2d12",
            theme_text_muted: "#9d174d",
            theme_border: "#f9a8d4",
            theme_active: "#ec4899"
        }
    },
    {
        name: "Forest Drift",
        preview: "linear-gradient(135deg, #15803d 0%, #22c55e 40%, #84cc16 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #052e16 0%, #14532d 100%)",
            theme_navbar: "linear-gradient(135deg, #166534 0%, #16a34a 100%)",
            theme_background: "linear-gradient(180deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
            theme_content: "linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%)",
            theme_footer: "linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)",
            theme_primary: "#16a34a",
            theme_primary_hover: "#15803d",
            theme_secondary: "#22c55e",
            theme_secondary_hover: "#16a34a",
            theme_success: "#4ade80",
            theme_success_hover: "#22c55e",
            theme_info: "#38bdf8",
            theme_info_hover: "#0ea5e9",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#f87171",
            theme_danger_hover: "#ef4444",
            theme_text: "#14532d",
            theme_text_secondary: "#166534",
            theme_text_muted: "#4d7c0f",
            theme_border: "#86efac",
            theme_active: "#16a34a"
        }
    },
    {
        name: "Signal Tech",
        preview: "linear-gradient(135deg, #111827 0%, #2563eb 40%, #06b6d4 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #020617 0%, #0f172a 100%)",
            theme_navbar: "linear-gradient(135deg, #0f172a 0%, #2563eb 100%)",
            theme_background: "linear-gradient(180deg, #f8fafc 0%, #e0f2fe 45%, #dbeafe 100%)",
            theme_content: "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)",
            theme_footer: "linear-gradient(135deg, #dbeafe 0%, #cffafe 100%)",
            theme_primary: "#2563eb",
            theme_primary_hover: "#1d4ed8",
            theme_secondary: "#06b6d4",
            theme_secondary_hover: "#0891b2",
            theme_success: "#22c55e",
            theme_success_hover: "#16a34a",
            theme_info: "#38bdf8",
            theme_info_hover: "#0ea5e9",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#f87171",
            theme_danger_hover: "#ef4444",
            theme_text: "#0f172a",
            theme_text_secondary: "#334155",
            theme_text_muted: "#64748b",
            theme_border: "#bfdbfe",
            theme_active: "#2563eb"
        }
    },
    {
        name: "Lunar Mist",
        preview: "linear-gradient(135deg, #1e293b 0%, #6d28d9 42%, #a78bfa 100%)",
        colors: {
            theme_sidebar: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
            theme_navbar: "linear-gradient(135deg, #312e81 0%, #7c3aed 100%)",
            theme_background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 50%, #e0e7ff 100%)",
            theme_content: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
            theme_footer: "linear-gradient(135deg, #e0e7ff 0%, #c4b5fd 100%)",
            theme_primary: "#7c3aed",
            theme_primary_hover: "#6d28d9",
            theme_secondary: "#a78bfa",
            theme_secondary_hover: "#8b5cf6",
            theme_success: "#34d399",
            theme_success_hover: "#10b981",
            theme_info: "#60a5fa",
            theme_info_hover: "#3b82f6",
            theme_warning: "#fbbf24",
            theme_warning_hover: "#f59e0b",
            theme_danger: "#f87171",
            theme_danger_hover: "#ef4444",
            theme_text: "#1f2937",
            theme_text_secondary: "#4b5563",
            theme_text_muted: "#6b7280",
            theme_border: "#c4b5fd",
            theme_active: "#7c3aed"
        }
    }
];

const THEME_MAPPING = {
    theme_sidebar: '--sidebar',
    theme_navbar: '--navbar',
    theme_background: '--bg-body',
    theme_content: '--bg-content',
    theme_footer: '--footer',
    theme_primary: '--primary',
    theme_primary_hover: '--primary-hover',
    theme_secondary: '--secondary',
    theme_secondary_hover: '--secondary-hover',
    theme_success: '--success',
    theme_success_hover: '--success-hover',
    theme_info: '--info',
    theme_info_hover: '--info-hover',
    theme_warning: '--warning',
    theme_warning_hover: '--warning-hover',
    theme_danger: '--danger',
    theme_danger_hover: '--danger-hover',
    theme_text: '--text',
    theme_text_secondary: '--text-secondary',
    theme_text_muted: '--text-muted',
    theme_border: '--border',
    theme_active: '--active',
    theme_navbar_height: '--navbar-height',
    theme_sidebar_width: '--sidebar-width',
    theme_sidebar_width_hover: '--sidebar-width-hover',
    theme_radius: '--radius'
};

const toHex = (str) => {
    if (!str) return "#000000";
    if (str.startsWith('#')) {
        if (str.length === 4) return '#' + str[1]+str[1]+str[2]+str[2]+str[3]+str[3];
        return str.substring(0, 7);
    }
    const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        return "#" + match.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }
    return "#000000";
};

export default function Settings() {
    const [settings, setSettings] = useState({});
    const [defaultColors, setDefaultColors] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });
    const fileInputRef = useRef(null);

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
        const computedStyles = getComputedStyle(document.documentElement);
        const defaults = {};
        
        Object.keys(THEME_MAPPING).forEach(key => {
            let val = computedStyles.getPropertyValue(THEME_MAPPING[key]).trim();
            if (val) {
                defaults[key] = val;
            } else {
                if (key === 'theme_navbar_height') defaults[key] = '60px';
                else if (key === 'theme_sidebar_width') defaults[key] = '80px';
                else if (key === 'theme_sidebar_width_hover') defaults[key] = '250px';
                else if (key === 'theme_radius') defaults[key] = '8px';
                else defaults[key] = "#000000";
            }
        });
        
        setDefaultColors(defaults);
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

    const handleResetField = (key) => {
        setSettings(prev => ({ ...prev, [key]: "" }));
    };

    const handleApplyPreset = (preset) => {
        setSettings(prev => ({ ...prev, ...preset.colors }));
        setAlertConfig({ show: true, type: "success", message: `Tema "${preset.name}" berhasil diterapkan.` });
    };

    const handleResetAllColors = () => {
        setSettings(prev => {
            const next = { ...prev };
            ALL_COLOR_KEYS.forEach(key => {
                delete next[key];
            });
            return next;
        });
        setAlertConfig({ show: true, type: "success", message: "Semua warna berhasil direset ke bawaan." });
    };

    const handleRestart = async () => {
        try {
            if (window.electron && window.electron.restartApp) {
                await window.electron.restartApp();
            } else {
                setAlertConfig({ show: true, type: "error", message: "Fungsi restartApp belum ditambahkan di preload.js/main.js" });
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal melakukan restart." });
        }
    };

    const handleExportSettings = () => {
        try {
            const dataStr = JSON.stringify(settings, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `mgo_settings_${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setAlertConfig({ show: true, type: "success", message: "Pengaturan berhasil diekspor." });
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal mengekspor pengaturan." });
        }
    };

    const handleImportSettings = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedSettings = JSON.parse(event.target.result);
                setSettings(importedSettings);
                setAlertConfig({ show: true, type: "success", message: "Pengaturan berhasil diimpor. Jangan lupa klik 'Simpan Pengaturan'." });
            } catch (err) {
                setAlertConfig({ show: true, type: "error", message: "File konfigurasi tidak valid." });
            }
            e.target.value = ""; 
        };
        reader.readAsText(file);
    };

    const triggerImport = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
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
                setAlertConfig({ show: true, type: "success", message: "Pengaturan berhasil disimpan. Restart aplikasi untuk menerapkan perubahan." });
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Terjadi kesalahan saat menyimpan." });
        } finally {
            setSaving(false);
        }
    };

    const renderColorItem = (key, label) => {
        const rawVal = settings[key] || defaultColors[key] || "#000000";
        const isGrad = rawVal.includes('linear-gradient');
        
        let type = 'solid';
        let c1 = toHex(rawVal);
        let c2 = '#ffffff';
        let angle = '90';

        if (isGrad) {
            type = 'gradient';
            const match = rawVal.match(/linear-gradient\(\s*(\d+)deg\s*,\s*(.*?)\s*,\s*(.*?)\s*\)/);
            if (match) {
                angle = match[1];
                c1 = toHex(match[2]);
                c2 = toHex(match[3]);
            }
        }

        const updateColor = (newType, newC1, newC2, newAngle) => {
            if (newType === 'solid') {
                handleInputChange(key, newC1);
            } else {
                handleInputChange(key, `linear-gradient(${newAngle}deg, ${newC1}, ${newC2})`);
            }
        };

        return (
            <div key={key} style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "14px 16px",
                backgroundColor: "var(--bg-body)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                minHeight: "150px"
            }}>
                <label style={{ fontWeight: "600", fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>
                    {label}
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                    <select
                        value={type}
                        onChange={e => updateColor(e.target.value, c1, c2, angle)}
                        style={{ padding: "8px 10px", borderRadius: "var(--radius)", background: "var(--bg-content)", color: "var(--text)", border: "1px solid var(--border)", outline: "none", width: "100%" }}
                    >
                        <option value="solid">Solid</option>
                        <option value="gradient">Gradient</option>
                    </select>

                    {type === 'gradient' && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--bg-content)", padding: "6px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <input
                                type="number"
                                value={angle}
                                onChange={e => updateColor('gradient', c1, c2, e.target.value)}
                                style={{ width: "60px", padding: "6px", borderRadius: "var(--radius)", background: "transparent", color: "var(--text)", border: "none", outline: "none" }}
                                title="Sudut rotasi (derajat)"
                            />
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>deg</span>
                        </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg-content)", padding: "4px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <input
                                type="color"
                                value={c1}
                                onChange={e => updateColor(type, e.target.value, c2, angle)}
                                style={{ width: "32px", height: "32px", padding: 0, border: "none", borderRadius: "var(--radius)", cursor: "pointer", background: "transparent" }}
                                title="Warna 1"
                            />
                            {type === 'gradient' && (
                                <input
                                    type="color"
                                    value={c2}
                                    onChange={e => updateColor('gradient', c1, e.target.value, angle)}
                                    style={{ width: "32px", height: "32px", padding: 0, border: "none", borderRadius: "var(--radius)", cursor: "pointer", background: "transparent" }}
                                    title="Warna 2"
                                />
                            )}
                        </div>

                        <div style={{ width: "38px", height: "38px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: rawVal, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }}></div>
                    </div>

                    <Button
                        type="button"
                        variant="danger"
                        icon={<Icon name="refresh" />}
                        onClick={() => handleResetField(key)}
                        style={{ width: "100%" }}
                    >
                        Reset
                    </Button>
                </div>
            </div>
        );
    };

    const renderColorSettingsCard = () => {
        const allColorFields = [
            ...LAYOUT_COLORS,
            ...ACCENT_COLORS,
            ...TEXT_COLORS,
            ...OTHER_COLORS,
        ];

        return (
            <div style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                padding: "28px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                gridColumn: "1 / -1",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)"
            }}>
                <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px" }}>
                    <h3 style={{ color: "var(--text)", margin: 0, fontSize: "18px" }}>Warna Aplikasi</h3>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                            {COLOR_PRESETS.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset)}
                                    style={{
                                        border: "1px solid rgba(255,255,255,0.18)",
                                        borderRadius: "var(--radius)",
                                        background: preset.preview,
                                        color: "#fff",
                                        padding: "10px 14px",
                                        fontWeight: 700,
                                        fontSize: "12px",
                                        cursor: "pointer",
                                        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.18)",
                                        minWidth: "130px",
                                        textShadow: "0 1px 3px rgba(0,0,0,0.35)"
                                    }}
                                >
                                    {preset.name}
                                </button>
                            ))}
                        </div>

                        <Button
                            type="button"
                            variant="danger"
                            icon={<Icon name="refresh" />}
                            onClick={handleResetAllColors}
                        >
                            Reset All Color
                        </Button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" }}>
                        {allColorFields.map(({ key, label }) => renderColorItem(key, label))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
            {alertConfig.show && (
                <Alert
                    type={alertConfig.type}
                    message={alertConfig.message}
                    onClose={() => setAlertConfig({ ...alertConfig, show: false, message: "" })}
                />
            )}

            <Header
                title="Pengaturan"
                subtitle="Konfigurasi sistem, path folder, dan personalisasi tampilan aplikasi."
            />

            {loading ? (
                <div style={{ color: "var(--secondary)", textAlign: "center", padding: "40px" }}>
                    Memuat pengaturan...
                </div>
            ) : (
                <Form id="formSettings" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "32px", maxWidth: "1600px" }}>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "32px", alignItems: "start" }}>
                        
                        <div style={{ backgroundColor: "var(--bg-content)", padding: "28px", borderRadius: "var(--radius)", border: "1px solid var(--border)", gridColumn: "1 / -1" }}>
                            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px" }}>
                                <h3 style={{ color: "var(--text)", margin: 0, fontSize: "18px" }}>Path Folder Produksi</h3>
                            </div>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                                {PATH_FIELDS.map(({ key, label }) => (
                                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <label style={{ fontWeight: "600", fontSize: 13, color: "var(--text-secondary)" }}>
                                            {label}
                                        </label>
                                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                            <div style={{ flex: "1 1 180px" }}>
                                                <Input
                                                    name={key}
                                                    value={settings[key] || ""}
                                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                                    placeholder="Belum diatur..."
                                                    margin="0"
                                                />
                                            </div>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    icon={<Icon name="folder" />}
                                                    onClick={() => handlePilihPath(key)}
                                                >
                                                    Pilih
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="danger"
                                                    icon={<Icon name="refresh" />}
                                                    onClick={() => handleResetField(key)}
                                                >
                                                    Reset
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ backgroundColor: "var(--bg-content)", padding: "28px", borderRadius: "var(--radius)", border: "1px solid var(--border)", gridColumn: "1 / -1" }}>
                            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px" }}>
                                <h3 style={{ color: "var(--text)", margin: 0, fontSize: "18px" }}>Pengaturan Tata Letak & Tabel</h3>
                            </div>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
                                <Input
                                    labelPosition="top"
                                    label="Tinggi Navbar (px/rem)"
                                    name="theme_navbar_height"
                                    value={settings.theme_navbar_height || defaultColors.theme_navbar_height || ""}
                                    onChange={(e) => handleInputChange("theme_navbar_height", e.target.value)}
                                    placeholder="Contoh: 60px"
                                />
                                <Input
                                    labelPosition="top"
                                    label="Lebar Sidebar (px/rem)"
                                    name="theme_sidebar_width"
                                    value={settings.theme_sidebar_width || defaultColors.theme_sidebar_width || ""}
                                    onChange={(e) => handleInputChange("theme_sidebar_width", e.target.value)}
                                    placeholder="Contoh: 80px"
                                />
                                <Input
                                    labelPosition="top"
                                    label="Lebar Sidebar Saat Hover (px/rem)"
                                    name="theme_sidebar_width_hover"
                                    value={settings.theme_sidebar_width_hover || defaultColors.theme_sidebar_width_hover || ""}
                                    onChange={(e) => handleInputChange("theme_sidebar_width_hover", e.target.value)}
                                    placeholder="Contoh: 250px"
                                />
                                <Input
                                    labelPosition="top"
                                    label="Lengkungan Sudut / Radius (px/rem)"
                                    name="theme_radius"
                                    value={settings.theme_radius || defaultColors.theme_radius || ""}
                                    onChange={(e) => handleInputChange("theme_radius", e.target.value)}
                                    placeholder="Contoh: 8px"
                                />
                            </div>
                        </div>

                        {renderColorSettingsCard()}
                        
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", marginTop: "16px", paddingBottom: "24px", flexWrap: "wrap" }}>
                        <input 
                            type="file" 
                            accept=".json" 
                            style={{ display: 'none' }} 
                            ref={fileInputRef} 
                            onChange={handleImportSettings} 
                        />
                        
                        <Button
                            type="button"
                            size="lg"
                            variant="secondary"
                            onClick={triggerImport}
                            icon={<Icon name="upload" />}
                        >
                            Import Tema
                        </Button>
                        <Button
                            type="button"
                            size="lg"
                            variant="info"
                            onClick={handleExportSettings}
                            icon={<Icon name="download" />}
                        >
                            Export Tema
                        </Button>
                        <Button
                            type="button"
                            size="lg"
                            variant="warning"
                            onClick={handleRestart}
                            icon={<Icon name="refresh" />}
                        >
                            Restart Aplikasi
                        </Button>
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
    );
}