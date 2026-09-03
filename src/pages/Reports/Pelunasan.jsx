import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Tag from "../../components/Tag/Tag";
import Icon from "../../components/Icon/Icon";
import { formatRupiah, getTodayDate } from "../../services/helpers";
import { exportPelunasanExcel } from "../../services/excelService";
import { getCachedTransactionsCapture } from "../../services/apiCache";
import { isMobile } from "../../services/platform";

export default function Pelunasan() {
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
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
            const res = await getCachedTransactionsCapture(startDate, endDate);

            const rawData = res.pelunasan.data || [];
            const filteredData = rawData.filter(item => item.status_label === "PELUNASAN");
            
            setPelunasanData(filteredData);
            setSummary({
                total_tf: res.pelunasan.total_tf || 0,
                total_cash: res.pelunasan.total_cash || 0,
                grand_total: res.pelunasan.grand_total || 0,
                total_transaksi: filteredData.length
            });
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

    const renderMethodTag = (method) => {
        if (!method || method === "-") return <span style={{ color: "var(--text-muted)" }}>-</span>;
        const isTF = method === "TF";
        return (
            <Tag variant={isTF ? "primary" : "success"}>
                {method}
            </Tag>
            
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
            render: (row) => renderMethodTag(row.dp_method)
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
            render: (row) => renderMethodTag(row.payment_method)
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
            paddingBottom: "40px"
        }}>
            <Header title="Laporan Pelunasan" subtitle="Daftar transaksi yang telah dilunasi beserta data DP." />
            <ReportNav />
            
            <DateFilter 
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onFilter={fetchPelunasan}
                onExport={handleExportExcel}
                loading={loading}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <Table 
                    id="table-pelunasan"
                    columns={columns}
                    rows={pelunasanData}
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
                                    start_date: row.order_date,
                                    end_date: row.order_date 
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
                    alignItems: isMobile ? "flex-start" : "center",
                    flexDirection: isMobile ? "column" : "row"
                }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                        <div style={{ padding: "12px 16px", background: "rgba(33, 150, 243, 0.05)", borderRadius: "var(--radius)", border: "1px solid rgba(33, 150, 243, 0.1)" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Jml Transaksi</div>
                            <div style={{ fontWeight: "bold", fontSize: "18px", color: "var(--primary)" }}>
                                {summary.total_transaksi} <span style={{ fontSize: "12px", fontWeight: "normal" }}>Trx</span>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: "flex",
                        gap: isMobile ? "16px" : "24px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        width: isMobile ? "100%" : "auto",
                        justifyContent: isMobile ? "space-between" : "flex-start"
                    }}>
                        <div style={{ textAlign: isMobile ? "left" : "right" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total CASH</div>
                            <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--text)" }}>{formatRupiah(summary.total_cash)}</div>
                        </div>
                        <div style={{ textAlign: isMobile ? "left" : "right" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total TRANSFER</div>
                            <div style={{ fontWeight: "600", fontSize: "16px", color: "var(--text)" }}>{formatRupiah(summary.total_tf)}</div>
                        </div>
                        <div style={{
                            textAlign: isMobile ? "left" : "right",
                            borderLeft: isMobile ? "none" : "2px solid var(--border)",
                            borderTop: isMobile ? "2px solid var(--border)" : "none",
                            paddingLeft: isMobile ? "0" : "24px",
                            paddingTop: isMobile ? "12px" : "0",
                            width: isMobile ? "100%" : "auto"
                        }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Grand Total (Periode)</div>
                            <div style={{ fontWeight: "bold", fontSize: "20px", color: "var(--primary)" }}>{formatRupiah(summary.grand_total)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}