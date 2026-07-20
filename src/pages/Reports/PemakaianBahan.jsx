import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { exportPemakaianBahanExcel } from "../../services/excelService";

export default function PemakaianBahan() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [pemakaianBahanData, setPemakaianBahanData] = useState([]);

    const fetchPemakaianBahan = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "product_used",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                setPemakaianBahanData(res.data.data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPemakaianBahan();
    }, []);

    const handleExportExcel = async () => {
        if (pemakaianBahanData.length === 0) {
            alert("Tidak ada data pemakaian bahan untuk diexport.");
            return;
        }
        
        try {
            await exportPemakaianBahanExcel({
                pemakaianBahanData,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const columns = useMemo(() => [
        { 
            key: "nama_barang", 
            title: "Nama Barang",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.nama_barang}</span>
        },
        { 
            key: "satuan", 
            title: "Satuan",
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.satuan}</span>
        },
        { 
            key: "total_pemakaian", 
            title: "Total Pemakaian",
            render: (row) => (
                <span style={{ fontWeight: "bold", color: "var(--primary)" }}>
                    {Number(row.total_pemakaian).toLocaleString('id-ID', { maximumFractionDigits: 4 })}
                </span>
            )
        }
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
            <Header title="Pemakaian Bahan" subtitle="Ringkasan total pemakaian bahan atau produk." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchPemakaianBahan}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", marginTop: "24px", display: "flex", flexDirection: "column", gap: "32px" }}>
                <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table 
                        id="table-pemakaian-bahan"
                        columns={columns}
                        rows={pemakaianBahanData}
                        rowKey="product_id"
                        size="md"
                        showNumber={true}
                    />
                </div>

                {pemakaianBahanData.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                        Tidak ada data pemakaian bahan pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}