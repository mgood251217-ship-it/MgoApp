import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";
import { exportPelunasanExcel } from "../../services/excelService";

export default function Pelunasan() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [pelunasanData, setPelunasanData] = useState([]);
    const [summary, setSummary] = useState({ 
        total_tf: 0, 
        total_cash: 0, 
        grand_total: 0,
        total_transaksi: 0
    });

    const fetchPelunasan = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "transactions_capture",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                const rawData = res.data.data.pelunasan.data || [];
                // Filter hanya status_label PELUNASAN jika diperlukan, atau langsung dari response API
                const filteredData = rawData.filter(item => item.status_label === "PELUNASAN");
                
                setPelunasanData(filteredData);
                setSummary({
                    total_tf: res.data.data.pelunasan.total_tf || 0,
                    total_cash: res.data.data.pelunasan.total_cash || 0,
                    grand_total: res.data.data.pelunasan.grand_total || 0,
                    total_transaksi: filteredData.length
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPelunasan();
    }, []);

    const handleExportExcel = async () => {
        if (pelunasanData.length === 0) {
            alert("Tidak ada data pelunasan untuk diexport.");
            return;
        }
        
        try {
            await exportPelunasanExcel({
                pelunasanData,
                summary,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const renderMethodBadge = (method) => {
        if (!method || method === "-") return <span style={{ color: "var(--text-muted)" }}>-</span>;
        const isTF = method === "TF";
        return (
            <span style={{
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "600",
                background: isTF ? "rgba(33, 150, 243, 0.1)" : "rgba(76, 175, 80, 0.1)",
                color: isTF ? "var(--primary)" : "var(--success)"
            }}>
                {method}
            </span>
        );
    };

    const columns = useMemo(() => [
        { 
            key: "nomorator", 
            title: "Nomorator",
            render: (row) => <span style={{ fontWeight: "bold" }}>#{row.nomorator}</span>
        },
        { 
            key: "customer_name", 
            title: "Nama Konsumen",
            render: (row) => (
                <div>
                    <div style={{ fontWeight: "600", color: "var(--text)" }}>{row.customer_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{row.system}</div>
                </div>
            )
        },
        { 
            key: "dp_nominal", 
            title: "Nominal DP", 
            render: (row) => (
                <span style={{ fontWeight: "500", color: "var(--text)" }}>
                    {row.dp_nominal ? formatRupiah(row.dp_nominal) : "-"}
                </span>
            )
        },
        { 
            key: "dp_method", 
            title: "Metode DP",
            render: (row) => renderMethodBadge(row.dp_method)
        },
        { 
            key: "dp_date", 
            title: "Tanggal DP",
            render: (row) => <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{row.dp_date !== "-" ? row.dp_date : "-"}</span>
        },
        { 
            key: "nominal", 
            title: "Nominal Lunas", 
            render: (row) => (
                <span style={{ fontWeight: "600", color: "var(--text)" }}>
                    {formatRupiah(row.nominal)}
                </span>
            )
        },
        { 
            key: "payment_method", 
            title: "Metode Lunas",
            render: (row) => renderMethodBadge(row.payment_method)
        },
        { 
            key: "payment_date", 
            title: "Tanggal Pelunasan",
            render: (row) => <span style={{ color: "var(--text)", fontSize: "12px" }}>{row.payment_date}</span>
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
            <Header title="Laporan Pelunasan" subtitle="Daftar transaksi yang telah dilunasi beserta data DP." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchPelunasan}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table 
                        id="table-pelunasan"
                        columns={columns}
                        rows={pelunasanData}
                        rowKey="order_id"
                        size="sm"
                        showNumber={true}
                        actions={(row) => (
                            <button 
                                onClick={() => console.log("Detail Order", row.order_id)}
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    color: "var(--text)",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    transition: "all 0.2s"
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = "var(--border)"}
                                onMouseOut={(e) => e.currentTarget.style.background = "var(--surface)"}
                            >
                                Lihat
                            </button>
                        )}
                    />
                </div>

                <div style={{ 
                    padding: "20px", 
                    background: "var(--surface)", 
                    borderRadius: "12px", 
                    border: "1px dashed var(--border)",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "24px",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                        <div style={{ padding: "12px 16px", background: "rgba(33, 150, 243, 0.05)", borderRadius: "8px", border: "1px solid rgba(33, 150, 243, 0.1)" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Jml Pelunasan</div>
                            <div style={{ fontWeight: "bold", fontSize: "18px", color: "var(--primary)" }}>
                                {summary.total_transaksi} <span style={{ fontSize: "12px", fontWeight: "normal" }}>Trx</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total CASH (Pelunasan)</div>
                            <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--text)" }}>{formatRupiah(summary.total_cash)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total TF (Pelunasan)</div>
                            <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--text)" }}>{formatRupiah(summary.total_tf)}</div>
                        </div>
                        <div style={{ textAlign: "right", borderLeft: "2px solid var(--border)", paddingLeft: "24px" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Grand Total (Pelunasan)</div>
                            <div style={{ fontWeight: "bold", fontSize: "20px", color: "var(--primary)" }}>{formatRupiah(summary.grand_total)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}