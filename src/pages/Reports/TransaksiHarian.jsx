import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah, getTodayDate } from "../../services/helpers";
import { exportTransaksiHarianExcel } from "../../services/excelService";
import Button from "../../components/Button/Button";
import Tag from "../../components/Tag/Tag";
import Icon from "../../components/Icon/Icon";
import { getCachedTransactionsCapture } from "../../services/apiCache";

export default function TransaksiHarian() {
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
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
            const res = await getCachedTransactionsCapture(startDate, endDate);
            setHarianData(res.harian.data || []);
            setSummary({
                total_tf: res.harian.total_tf || 0,
                total_cash: res.harian.total_cash || 0,
                grand_total: res.harian.grand_total || 0,
                total_transaksi: res.rekap?.total_transaksi_all || 0
            });
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
                endDate
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
                <Tag variant={row.payment_method === "TF" ? "primary" : "success"}>
                    {row.payment_method}
                </Tag>
            )
        },
        { 
            key: "status_label", 
            title: "Status",
            render: (row) => (
                <Tag variant={row.status_label === "LUNAS" || row.status_label === "PELUNASAN" ? "success" : "warning"}>
                    {row.status_label}
                </Tag>
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
            
            <DateFilter 
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onFilter={fetchHarian}
                onExport={handleExportExcel}
                loading={loading}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <Table 
                        id="table-harian"
                        columns={columns}
                        rows={harianData}
                        rowKey="order_id"
                        size="sm"
                        showNumber={true}
                        actions={(row) => (
                            <Button 
                                icon={<Icon name="next" />}
                                size="sm"
                                onClick={() => {
                                    const params = new URLSearchParams({
                                        search: row.nomorator,
                                        start_date: startDate,
                                        end_date: endDate 
                                    }).toString();

                                    navigate(`/reports/transaksi-detail?${params}`);
                                }}
                            >
                                Lihat
                            </Button>
                        )}
                    />

                <div style={{ 
                    padding: "20px", 
                    background: "var(--background)", 
                    borderRadius: "var(--radius)", 
                    border: "1px dashed var(--border)",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "24px",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                        <div style={{ padding: "12px 16px", background: "rgba(33, 150, 243, 0.05)", borderRadius: "var(--radius)", border: "1px solid rgba(33, 150, 243, 0.1)" }}>
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