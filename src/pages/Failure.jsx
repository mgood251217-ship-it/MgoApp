import { useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import DateFilter from "../components/DateFilter/DateFilter";
import Table from "../components/Table/Table";
import { formatRupiah } from "../services/helpers";
import { exportFailureExcel } from "../services/excelService"; 

export default function Failure() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [failures, setFailures] = useState([]);

    const fetchFailures = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "failure",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                setFailures(res.data.data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFailures();
    }, []);

    const handleExportExcel = async () => {
        if (failures.length === 0) {
            alert("Tidak ada data kegagalan produksi untuk diexport.");
            return;
        }

        try {
            await exportFailureExcel({
                failures,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const handleEdit = (row) => {
        console.log("Edit:", row.failure_id);
    };

    const handleDelete = (row) => {
        if (window.confirm("Yakin ingin menghapus data kegagalan ini?")) {
            console.log("Hapus:", row.failure_id);
        }
    };

    const columns = useMemo(() => [
        { 
            key: "formatted_date", 
            title: "Tanggal", 
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.formatted_date}</span> 
        },
        { 
            key: "nomorator", 
            title: "Nomorator", 
            render: (row) => <span style={{ fontWeight: "bold" }}>{row.nomorator}</span> 
        },
        { key: "customer_name", title: "Customer" },
        { key: "operator_name", title: "Operator" },
        { key: "nama_mesin", title: "Mesin" },
        { key: "judul", title: "Judul", render: (row) => <span style={{ fontWeight: "600" }}>{row.judul}</span> },
        { key: "size", title: "Ukuran", render: (row) => row.size || "-" },
        { key: "quantity", title: "Qty" },
        { key: "finishing_names_str", title: "Finishing", render: (row) => row.finishing_names_str || "-" },
        { 
            key: "detail_gagal", 
            title: "Detail Gagal", 
            render: (row) => (
                <div 
                    style={{ fontSize: "12px", lineHeight: "1.4", whiteSpace: "nowrap" }}
                    dangerouslySetInnerHTML={{ __html: row.detail_gagal }}
                />
            ) 
        },
        { 
            key: "total_loss", 
            title: "Kerugian", 
            render: (row) => <span style={{ fontWeight: "600", color: "#ef4444" }}>{formatRupiah(Number(row.total_loss))}</span> 
        },
        { 
            key: "loss_burden", 
            title: "Beban", 
            render: (row) => (
                <span style={{ 
                    fontWeight: "bold", 
                    color: row.loss_burden === "OPERATOR" ? "#f59e0b" : "var(--primary)" 
                }}>
                    {row.loss_burden}
                </span>
            )
        },
        { 
            key: "info", 
            title: "Keterangan",
            render: (row) => <span style={{ fontSize: "12px" }}>{row.info || "-"}</span>
        },
        {
            key: "aksi",
            title: "Aksi",
            render: (row) => (
                <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                        onClick={() => handleEdit(row)}
                        style={{
                            padding: "4px 8px", background: "var(--primary)", color: "#fff",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                        }}
                    >
                        Edit
                    </button>
                    <button 
                        onClick={() => handleDelete(row)}
                        style={{
                            padding: "4px 8px", background: "#ef4444", color: "#fff",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                        }}
                    >
                        Hapus
                    </button>
                </div>
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
            <Header 
                title="Laporan Kegagalan Produksi" 
                subtitle="Pantau rincian kegagalan produksi (reject) beserta beban kerugian." 
            />
            
            <div style={{ padding: "24px 24px 0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchFailures}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>
                        Data Kegagalan
                    </h3>
                    <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                        <Table 
                            id="table-failure"
                            columns={columns}
                            rows={failures}
                            rowKey="failure_id"
                            size="sm"
                            showNumber={true}
                        />
                    </div>
                    {failures.length === 0 && !loading && (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                            Tidak ada data kegagalan produksi pada rentang tanggal ini.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}