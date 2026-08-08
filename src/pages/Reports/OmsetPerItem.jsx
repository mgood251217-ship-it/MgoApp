import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah, getTodayDate } from "../../services/helpers";
import { exportOmsetPerItemExcel } from "../../services/excelService";
import { getCachedOmsetItem } from "../../services/apiCache";

export default function OmsetPerItem() {
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [loading, setLoading] = useState(false);
    
    const [omsetItemData, setOmsetItemData] = useState([]);
    const [totalOmsetKeseluruhan, setTotalOmsetKeseluruhan] = useState(0);

    const fetchOmsetItem = async () => {
        setLoading(true);
        try {
            const res = await getCachedOmsetItem(startDate, endDate);

            const data = res || [];
            setOmsetItemData(data);
            
            const total = data.reduce((acc, curr) => acc + Number(curr.total_omset), 0);
            setTotalOmsetKeseluruhan(total);
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

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "32px" }}>
                <Table 
                    id="table-omset-item"
                    columns={columns}
                    rows={omsetItemData}
                    rowKey="nama_barang"
                    size="md"
                    showNumber={true}
                />
                <div style={{ 
                    padding: "20px", 
                    background: "var(--background)", 
                    borderRadius: "var(--radius)", 
                    border: "1px dashed var(--border)",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center"
                }}>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total Keseluruhan Omset</div>
                        <div style={{ fontWeight: "bold", fontSize: "24px", color: "var(--primary)" }}>
                            {formatRupiah(totalOmsetKeseluruhan)}
                        </div>
                    </div>
                </div>
                {omsetItemData.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px dashed var(--border)" }}>
                        Tidak ada data omset pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}