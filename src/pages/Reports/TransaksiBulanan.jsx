import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";

export default function TransaksiBulanan() {
    const todayObj = new Date();
    const y = todayObj.getFullYear();
    const m = String(todayObj.getMonth() + 1).padStart(2, "0");
    const d = String(todayObj.getDate()).padStart(2, "0");
    
    const firstDayOfMonth = `${y}-${m}-01`;
    const todayStr = `${y}-${m}-${d}`;

    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(todayStr);
    const [loading, setLoading] = useState(false);
    
    const [bulananData, setBulananData] = useState([]);
    const [summary, setSummary] = useState({ 
        total_tf: 0, 
        total_cash: 0, 
        grand_total: 0, 
        total_transaksi: 0 
    });

    const fetchBulanan = async () => {
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
                const rawData = res.data.data.rekap?.data_per_tanggal || [];
                setBulananData(rawData);
                setSummary({
                    total_tf: res.data.data.rekap?.total_bulan_tf || 0,
                    total_cash: res.data.data.rekap?.total_bulan_cash || 0,
                    grand_total: res.data.data.rekap?.total_bulan || 0,
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
        fetchBulanan();
    }, []);

    const handleExportExcel = () => {
        alert("Fitur Export Excel sedang dipersiapkan.");
    };

    const columns = useMemo(() => [
        { 
            key: "tanggal", 
            title: "Tanggal",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.tanggal}</span>
        },
        { 
            key: "jumlah_order", 
            title: "Jml Order",
            render: (row) => (
                <span style={{ color: "var(--text)" }}>{row.jumlah_order}</span>
            )
        },
        { 
            key: "jumlah_transaksi", 
            title: "Jml Transaksi",
            render: (row) => (
                <span style={{ color: "var(--text)" }}>{row.jumlah_transaksi}</span>
            )
        },
        { 
            key: "CASH", 
            title: "CASH", 
            render: (row) => (
                <span style={{ fontWeight: "500", color: "var(--success)" }}>
                    {formatRupiah(row.CASH)}
                </span>
            )
        },
        { 
            key: "TF", 
            title: "TRANSFER",
            render: (row) => (
                <span style={{ fontWeight: "500", color: "var(--primary)" }}>
                    {formatRupiah(row.TF)}
                </span>
            )
        },
        { 
            key: "total_nominal", 
            title: "Total Nominal",
            render: (row) => (
                <span style={{ fontWeight: "bold", color: "var(--text)" }}>
                    {formatRupiah(row.total_nominal)}
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
            <Header title="Transaksi Bulanan" subtitle="Rekapitulasi total transaksi per tanggal." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchBulanan}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table 
                        id="table-bulanan"
                        columns={columns}
                        rows={bulananData}
                        rowKey="tanggal"
                        size="sm"
                        showNumber={true}
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
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Grand Total (Periode)</div>
                            <div style={{ fontWeight: "bold", fontSize: "20px", color: "var(--primary)" }}>{formatRupiah(summary.grand_total)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}