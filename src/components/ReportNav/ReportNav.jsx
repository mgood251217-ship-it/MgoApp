import { useLocation, useNavigate } from "react-router-dom";
import { useTabs } from "../../context/TabsContext";
import "./ReportNav.css";

export default function ReportNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const { openTab } = useTabs();

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

    const handleNavClick = (e, item) => {
        const isMiddleClick = e.type === "auxclick" && e.button === 1;
        const isCtrlOrCmdClick = e.type === "click" && (e.ctrlKey || e.metaKey);

        if (isMiddleClick || isCtrlOrCmdClick) {
            openTab(item.path, item.label);
            return;
        }

        if (e.type === "click") {
            navigate(item.path);
        }
    };

    return (
        <div className="report-nav-wrapper">
            <div className="report-nav-scroll">
                {navItems.map((item, index) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={index}
                            title="Ctrl+Klik atau klik tengah untuk buka di tab baru"
                            onClick={(e) => handleNavClick(e, item)}
                            onAuxClick={(e) => handleNavClick(e, item)}
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