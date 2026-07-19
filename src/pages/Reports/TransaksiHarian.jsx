import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";
import { exportTransaksiHarianExcel } from "../../services/excelService";

export default function TransaksiHarian() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [harianData, setHarianData] = useState([]);
    const [summary, setSummary] = useState({ 
        total_tf: 0, 
        total_cash: 0, 
        grand_total: 0, 
        total_transaksi: 0 
    });

    const fetchHarian = async () => {
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
                setHarianData(res.data.data.harian.data || []);
                setSummary({
                    total_tf: res.data.data.harian.total_tf || 0,
                    total_cash: res.data.data.harian.total_cash || 0,
                    grand_total: res.data.data.harian.grand_total || 0,
                    total_transaksi: res.data.data.rekap?.total_transaksi_all || 0
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHarian();
    }, []);

    const handleExportExcel = async () => {
        if (harianData.length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }
        try {
            await exportTransaksiHarianExcel({
                harianData,
                summary,
                startDate,
                endDate,
                storeName: "CAHEUM PRINTING SUBLIM",
                storeAddress: "Alamat Toko Anda"
            });
        } catch (error) {
            console.error("Gagal export:", error);
            alert("Terjadi kesalahan saat export.");
        }
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
            key: "nominal", 
            title: "Nominal", 
            render: (row) => (
                <span style={{ fontWeight: "600", color: "var(--text)" }}>
                    {formatRupiah(row.nominal)}
                </span>
            )
        },
        { 
            key: "payment_method", 
            title: "Metode",
            render: (row) => (
                <span style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "600",
                    background: row.payment_method === "TF" ? "rgba(33, 150, 243, 0.1)" : "rgba(76, 175, 80, 0.1)",
                    color: row.payment_method === "TF" ? "var(--primary)" : "var(--success)"
                }}>
                    {row.payment_method}
                </span>
            )
        },
        { 
            key: "status_label", 
            title: "Status",
            render: (row) => (
                <span style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "600",
                    background: (row.status_label === "LUNAS" || row.status_label === "PELUNASAN") 
                        ? "rgba(76, 175, 80, 0.1)" 
                        : "rgba(255, 152, 0, 0.1)",
                    color: (row.status_label === "LUNAS" || row.status_label === "PELUNASAN") 
                        ? "var(--success)" 
                        : "var(--warning)"
                }}>
                    {row.status_label}
                </span>
            )
        },
        { 
            key: "payment_date", 
            title: "Tanggal" 
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
            <Header title="Transaksi Harian" subtitle="Ringkasan transaksi harian toko." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchHarian}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table 
                        id="table-harian"
                        columns={columns}
                        rows={harianData}
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
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Jml Transaksi</div>
                            <div style={{ fontWeight: "bold", fontSize: "18px", color: "var(--primary)" }}>
                                {summary.total_transaksi} <span style={{ fontSize: "12px", fontWeight: "normal" }}>Trx</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total CASH</div>
                            <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--text)" }}>{formatRupiah(summary.total_cash)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total TRANSFER</div>
                            <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--text)" }}>{formatRupiah(summary.total_tf)}</div>
                        </div>
                        <div style={{ textAlign: "right", borderLeft: "2px solid var(--border)", paddingLeft: "24px" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Grand Total (Harian)</div>
                            <div style={{ fontWeight: "bold", fontSize: "20px", color: "var(--primary)" }}>{formatRupiah(summary.grand_total)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}