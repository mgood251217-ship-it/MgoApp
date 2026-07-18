import { useLocation, useNavigate } from "react-router-dom";

export default function ReportNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { label: "Transaksi Detail", path: "/reports/transaksi-detail" },
        { label: "Transaksi Harian", path: "/reports/transaksi-harian" },
        { label: "Transaksi Bulanan", path: "/reports/transaksi-bulanan" },
        { label: "Transaksi Per Item", path: "/reports/transaksi-per-item" },
        { label: "Transaksi Per Konsumen", path: "/reports/transaksi-per-konsumen" },
        { label: "Omset Per Item", path: "/reports/omset-per-item" },
        { label: "Pemakaian Bahan", path: "/reports/pemakaian-bahan" },
        { label: "Piutang", path: "/reports/piutang" },
        { label: "Pelunasan", path: "/reports/pelunasan" },
        { label: "Keuangan", path: "/reports/keuangan" },
        { label: "Statistik Karyawan", path: "/reports/statistik-karyawan" },
        { label: "Aktivitas", path: "/reports/aktivitas" }
    ];

    return (
        <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
            <div style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                padding: "0 24px 16px 24px",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                boxSizing: "border-box"
            }}>
                {navItems.map((item, index) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={index}
                            onClick={() => navigate(item.path)}
                            style={{
                                whiteSpace: "nowrap",
                                padding: "8px 16px",
                                borderRadius: "20px",
                                fontSize: "13px",
                                fontWeight: "600",
                                border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
                                background: isActive ? "var(--primary)" : "var(--surface)",
                                color: isActive ? "#ffffff" : "var(--text)",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                flexShrink: 0
                            }}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}