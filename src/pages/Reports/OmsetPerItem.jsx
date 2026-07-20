import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";
import { exportOmsetPerItemExcel } from "../../services/excelService";

export default function OmsetPerItem() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [omsetItemData, setOmsetItemData] = useState([]);
    const [totalOmsetKeseluruhan, setTotalOmsetKeseluruhan] = useState(0);

    const fetchOmsetItem = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "omset_item",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                const data = res.data.data || [];
                setOmsetItemData(data);
                
                const total = data.reduce((acc, curr) => acc + Number(curr.total_omset), 0);
                setTotalOmsetKeseluruhan(total);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOmsetItem();
    }, []);

    const handleExportExcel = async () => {
        if (omsetItemData.length === 0) {
            alert("Tidak ada data omset per item untuk diexport.");
            return;
        }
        
        try {
            await exportOmsetPerItemExcel({
                omsetItemData,
                totalOmsetKeseluruhan,
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
            key: "total_terjual", 
            title: "Total Terjual",
            render: (row) => (
                <span style={{ fontWeight: "bold" }}>
                    {Number(row.total_terjual).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                </span>
            )
        },
        { 
            key: "total_omset", 
            title: "Total Omset", 
            render: (row) => (
                <span style={{ fontWeight: "600", color: "var(--primary)" }}>
                    {formatRupiah(row.total_omset)}
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
            <Header title="Omset Per Item" subtitle="Ringkasan total penjualan dan omset berdasarkan barang." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchOmsetItem}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", marginTop: "16px", marginBottom: "8px" }}>
                <div style={{
                    background: "var(--primary)",
                    color: "white",
                    padding: "16px 24px",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}>
                    <span style={{ fontSize: "16px", fontWeight: "500" }}>Total Keseluruhan Omset</span>
                    <span style={{ fontSize: "24px", fontWeight: "bold" }}>{formatRupiah(totalOmsetKeseluruhan)}</span>
                </div>
            </div>

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "32px" }}>
                <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table 
                        id="table-omset-item"
                        columns={columns}
                        rows={omsetItemData}
                        rowKey="nama_barang"
                        size="md"
                        showNumber={true}
                    />
                </div>

                {omsetItemData.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                        Tidak ada data omset pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}