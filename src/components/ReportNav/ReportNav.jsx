import { useLocation, useNavigate } from "react-router-dom";
import "./ReportNav.css";

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
        <div className="report-nav-wrapper">
            <div className="report-nav-scroll">
                {navItems.map((item, index) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={index}
                            onClick={() => navigate(item.path)}
                            className={`report-nav-item${isActive ? " active" : ""}`}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
