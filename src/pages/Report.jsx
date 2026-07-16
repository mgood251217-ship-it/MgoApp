import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Card from "../components/Card/Card";
import { formatRupiah } from "../services/helpers";

export default function Report() {
    const [data, setData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await api.get("", { params: { action: "report" } });
                setData(res.data?.data || null);
            } catch (error) {
                console.error(error);
            }
        };
        
        fetchReport();
    }, []);

    const colors = [
        "#2196f3",
        "#ff9800",
        "#4caf50",
        "#f44336",
        "rgba(0, 74, 28, 1)",
        "#673ab7",
        "#e91e63",
        "#009688",
        "rgb(248, 141, 230)",
        "rgb(0, 33, 180)",
        "rgb(147, 0, 0)",
        "rgb(44, 25, 25)"
    ];

    const icons = [
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44A.991.991 0 0 1 3 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M3 3v18h18v-2H5V3H3zm6 14h2v-6H9v6zm4 0h2V9h-2v8zm4 0h2V5h-2v12z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zm-3.64 1.36C4.9 9 4 8.1 4 7s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm8-6.18l-1.41-1.41L19 3h3v1l-7 7.82z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 15c-2.21 0-4-1.79-4-4h2c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2h-1c-1.1 0-2-.9-2-2s.9-2 2-2c1.38 0 2.5 1.12 2.5 2.5h-2c0-.55-.45-1-1-1s-1 .45-1 1 .45 1 1 1h1c1.1 0 2 .9 2 2s-.9 2-2 2v1h-2v-1zm1-9V3.5L18.5 9H13z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M21 7.28V5c0-1.1-.9-2-2-2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-2.28A2 2 0 0 0 22 15V9a2 2 0 0 0-1-1.72zM20 9v6h-7V9h7zM5 19V5h14v2h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6v2H5z"/><circle cx="16" cy="12" r="1.5"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
    ];

    const reportCards = [
        {
            title: "Transaksi Detail",
            description1: `Cash: ${formatRupiah(data?.cashTotal || 0)}`,
            description2: `Transfer: ${formatRupiah(data?.tfTotal || 0)}`,
            path: "/reports/transaksi-detail"
        },
        {
            title: "Transaksi Harian",
            description1: `Jumlah: ${data?.jumlahPembayaranHarian || 0} Trx`,
            description2: `Omset: ${formatRupiah(data?.omsetHarian || 0)}`,
            path: "/reports/transaksi-harian"
        },
        {
            title: "Transaksi Bulanan",
            description1: `Jumlah: ${data?.jumlahPembayaranBulanan || 0} Trx`,
            description2: `Omset: ${formatRupiah(data?.omsetBulanan || 0)}`,
            path: "/reports/transaksi-bulanan"
        },
        {
            title: "Transaksi Per Item",
            description1: `Top: ${data?.topProductName || "-"}`,
            description2: `Qty: ${data?.topProductQty || 0}`,
            path: "/reports/transaksi-per-item"
        },
        {
            title: "Transaksi Per Konsumen",
            description1: `Top Konsumen:`,
            description2: data?.topCustomerName || "-",
            path: "/reports/transaksi-per-konsumen"
        },
        {
            title: "Omset Per Item",
            description1: `Top Sales: ${data?.topSalesName || "-"}`,
            description2: `Omset: ${formatRupiah(data?.topSalesOmset || 0)}`,
            path: "/reports/omset-per-item"
        },
        {
            title: "Daftar Pemakaian Bahan",
            description1: `Digunakan: ${data?.usedItem?.join(', ') || "-"}`,
            description2: `Tidak: ${data?.unusedItem?.join(', ') || "-"}`,
            path: "/reports/pemakaian-bahan"
        },
        {
            title: "Daftar Piutang",
            description1: `Jumlah Piutang: ${data?.piutang || 0}`,
            description2: `Total Hutang: ${formatRupiah(data?.totalHutang || 0)}`,
            path: "/reports/piutang"
        },
        {
            title: "Data Pelunasan",
            description1: `Produk Terjual: ${data?.productSold || 0}`,
            description2: "-",
            path: "/reports/pelunasan"
        },
        {
            title: "Keuangan",
            description1: `Offline: ${formatRupiah(data?.omsetOffline || 0)}`,
            description2: `Online: ${formatRupiah(data?.omsetOnline || 0)}`,
            path: "/reports/keuangan"
        },
        {
            title: "Statistik Karyawan",
            description1: `Top Karyawan:`,
            description2: data?.topUserName || "-",
            path: "/reports/statistik-karyawan"
        },
        {
            title: "Aktivitas",
            description1: "Log Aktivitas User",
            description2: "-",
            path: "/reports/aktivitas"
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: "100vh", overflow: "hidden" }}>
            <Header 
                title="Pusat Laporan" 
                subtitle="Ringkasan data laporan, statistik, dan riwayat transaksi toko." 
            />

            <div style={{ 
                flex: 1,
                display: "grid", 
                gridTemplateColumns: "repeat(4, 1fr)", 
                gridTemplateRows: "repeat(3, minmax(0, 1fr))",
                gap: "16px", 
                minHeight: 0,
                paddingBottom: "16px"
            }}>
                {reportCards.map((card, index) => (
                    <Card 
                        key={index}
                        bgColor={colors[index]}
                        bgIcon={icons[index]}
                        title={card.title}
                        description1={card.description1}
                        description2={card.description2}
                        onClick={() => navigate(card.path)}
                    />
                ))}
            </div>
        </div>
    );
}