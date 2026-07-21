import { useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import DateFilter from "../components/DateFilter/DateFilter";
import Table from "../components/Table/Table";
import { formatRupiah } from "../services/helpers";
import { exportMaklunExcel } from "../services/excelService";

export default function Maklun() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [maklunMasuk, setMaklunMasuk] = useState([]);
    const [maklunKeluar, setMaklunKeluar] = useState([]);

    const fetchMaklun = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "maklun",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                setMaklunMasuk(res.data.data.maklunIn || []);
                setMaklunKeluar(res.data.data.maklunOut || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMaklun();
    }, []);

    const handleExportExcel = async () => {
        if (maklunMasuk.length === 0 && maklunKeluar.length === 0) {
            alert("Tidak ada data maklun untuk diexport.");
            return;
        }

        try {
            await exportMaklunExcel({
                maklunMasuk,
                maklunKeluar,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const kolomMaklunMasuk = useMemo(() => [
        { key: "judul", title: "Nama", render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.judul}</span> },
        { key: "size", title: "Ukuran", render: (row) => row.size || "-" },
        { key: "finishing_names", title: "Finishing", render: (row) => row.finishing_names || "-" },
        { key: "quantity", title: "Qty" },
        { key: "harga_satuan_calc", title: "Satuan", render: (row) => formatRupiah(Number(row.harga_satuan_calc)) },
        { key: "jumlah_harga_calc", title: "Jumlah", render: (row) => <span style={{ fontWeight: "600", color: "var(--primary)" }}>{formatRupiah(Number(row.jumlah_harga_calc))}</span> },
        { key: "branch_name", title: "Dari Cabang", render: (row) => <span style={{ fontWeight: "bold" }}>{row.branch_name}</span> },
        { key: "date", title: "Tanggal", render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span> }
    ], []);

    const kolomMaklunKeluar = useMemo(() => [
        { key: "judul", title: "Nama", render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.judul}</span> },
        { key: "size", title: "Ukuran", render: (row) => row.size || "-" },
        { key: "finishing_names", title: "Finishing", render: (row) => row.finishing_names || "-" },
        { key: "quantity", title: "Qty" },
        { key: "harga_satuan_calc", title: "Satuan", render: (row) => formatRupiah(Number(row.harga_satuan_calc)) },
        { key: "jumlah_harga_calc", title: "Jumlah", render: (row) => <span style={{ fontWeight: "600", color: "#ef4444" }}>{formatRupiah(Number(row.jumlah_harga_calc))}</span> },
        { key: "branch_name", title: "Ke Cabang", render: (row) => <span style={{ fontWeight: "bold" }}>{row.branch_name}</span> },
        { key: "date", title: "Tanggal", render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span> }
    ], []);

    return (
        <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            width: "100%", 
            maxWidth: "100vw", 
            boxSizing: "border-box",
            overflowX: "hidden",
            paddingBottom: "40px"
        }}>
            <Header title="Laporan Maklun" subtitle="Pantau rincian pekerjaan maklun masuk dan maklun keluar antar cabang." />
            
            <div style={{ padding: "24px 24px 0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchMaklun}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ 
                padding: "24px", 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", 
                gap: "24px",
                alignItems: "start"
            }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>
                            📥 Maklun Masuk
                        </h3>
                    </div>
                    <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                        <Table 
                            id="table-maklun-masuk"
                            columns={kolomMaklunMasuk}
                            rows={maklunMasuk}
                            rowKey={(row, index) => row.order_item_id || index}
                            size="sm"
                            showNumber={true}
                        />
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>
                            📤 Maklun Keluar
                        </h3>
                    </div>
                    <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                        <Table 
                            id="table-maklun-keluar"
                            columns={kolomMaklunKeluar}
                            rows={maklunKeluar}
                            rowKey={(row, index) => row.order_item_id || index}
                            size="sm"
                            showNumber={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}