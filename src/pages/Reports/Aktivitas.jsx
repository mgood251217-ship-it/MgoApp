import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";

export default function Aktivitas() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [activityData, setActivityData] = useState([]);
    const [archiveData, setArchiveData] = useState([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resActivity, resArchive] = await Promise.all([
                api.get("", { 
                    params: { 
                        action: "activity",
                        start_date: startDate,
                        end_date: endDate
                    } 
                }),
                api.get("", { 
                    params: { 
                        action: "order_archive",
                        start_date: startDate,
                        end_date: endDate
                    } 
                })
            ]);

            if (resActivity.data?.success) {
                const mappedActivities = (resActivity.data.data || []).map(({ done, ...rest }) => rest);
                setActivityData(mappedActivities);
            }

            if (resArchive.data?.success) {
                const archiveValues = Object.values(resArchive.data.data || {});
                setArchiveData(archiveValues);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleExportExcel = () => {
        alert("Fitur Export Excel sedang dipersiapkan.");
    };

    const activityColumns = useMemo(() => [
        { 
            key: "date", 
            title: "Waktu",
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span>
        },
        { 
            key: "order_id", 
            title: "ID Order",
            render: (row) => <span style={{ fontWeight: "bold" }}>{row.order_id || "-"}</span>
        },
        { 
            key: "title", 
            title: "Aktivitas",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--primary)" }}>{row.title}</span>
        },
        { 
            key: "message", 
            title: "Pesan",
            render: (row) => <span style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>{row.message}</span>
        },
        { 
            key: "information", 
            title: "Info Tambahan",
            render: (row) => <span style={{ fontSize: "12px" }}>{row.information || "-"}</span>
        }
    ], []);

    const itemColumns = useMemo(() => [
        { key: "no", title: "No" },
        { key: "judul", title: "Nama Item" },
        { key: "finishing_names", title: "Finishing", render: (row) => row.finishing_names || "-" },
        { key: "size", title: "Ukuran", render: (row) => row.size || "-" },
        { key: "quantity", title: "Qty" },
        { key: "unit", title: "Satuan", render: (row) => formatRupiah(Number(row.unit)) },
        { key: "amount", title: "Jumlah", render: (row) => formatRupiah(Number(row.amount)) }
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
            <Header title="Aktivitas & Arsip" subtitle="Riwayat perubahan data dan log order yang telah dihapus." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchData}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", marginTop: "24px", display: "flex", flexDirection: "column", gap: "40px" }}>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ 
                        fontSize: "16px", 
                        fontWeight: "bold", 
                        color: "var(--text)",
                        paddingLeft: "4px",
                        borderLeft: "4px solid var(--primary)"
                    }}>
                        Aktivitas Sistem
                    </div>
                    <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                        <Table 
                            id="table-activity"
                            columns={activityColumns}
                            rows={activityData}
                            rowKey="activity_id"
                            size="sm"
                            showNumber={true}
                        />
                    </div>
                    {activityData.length === 0 && !loading && (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                            Tidak ada aktivitas pada rentang tanggal ini.
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ 
                        fontSize: "16px", 
                        fontWeight: "bold", 
                        color: "#e53935",
                        paddingLeft: "4px",
                        borderLeft: "4px solid #e53935"
                    }}>
                        Arsip Order Terhapus
                    </div>

                    {archiveData.length === 0 && !loading ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                            Tidak ada arsip order terhapus pada rentang tanggal ini.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {archiveData.map((order) => {
                                const items = (order.items || []).map((item, idx) => ({ ...item, no: idx + 1 }));
                                
                                return (
                                    <div key={order.deleted_order_id} style={{ 
                                        background: "var(--background)", 
                                        borderRadius: "12px", 
                                        border: "1px solid var(--border)",
                                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                                        overflow: "hidden",
                                        display: "flex",
                                        flexDirection: "column"
                                    }}>
                                        <div style={{ 
                                            padding: "16px", 
                                            borderBottom: "1px dashed var(--border)",
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                            gap: "16px",
                                            background: "var(--surface)"
                                        }}>
                                            <div>
                                                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Nomorator</div>
                                                <div style={{ fontWeight: "bold", fontSize: "16px", color: "var(--text)" }}>#{order.nomorator}</div>
                                                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>ID: {order.order_id || "-"}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Konsumen</div>
                                                <div style={{ fontWeight: "600", color: "var(--text)" }}>{order.customer_name}</div>
                                                <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>{order.nomor}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Waktu Dibuat</div>
                                                <div style={{ fontWeight: "500", fontSize: "14px", color: "var(--text)" }}>{order.date}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Waktu Dihapus</div>
                                                <div style={{ fontWeight: "600", fontSize: "14px", color: "#e53935" }}>{order.deleted_at}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Sistem & Dihapus Oleh</div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ 
                                                        background: order.system === "ONLINE" ? "rgba(33, 150, 243, 0.1)" : "rgba(76, 175, 80, 0.1)",
                                                        color: order.system === "ONLINE" ? "var(--primary)" : "var(--success)",
                                                        padding: "4px 8px",
                                                        borderRadius: "4px",
                                                        fontSize: "11px",
                                                        fontWeight: "600"
                                                    }}>
                                                        {order.system}
                                                    </span>
                                                    <span style={{ fontWeight: "600", fontSize: "13px", color: "#e53935" }}>{order.deleted_by_name}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ padding: "16px" }}>
                                            <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Detail Item</div>
                                            
                                            <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                                                <Table 
                                                    id={`table-items-${order.deleted_order_id}`}
                                                    columns={itemColumns} 
                                                    rows={items} 
                                                    size="sm"
                                                    rowKey="no"
                                                />
                                            </div>

                                            <div style={{ 
                                                display: "flex", 
                                                justifyContent: "flex-end", 
                                                alignItems: "center",
                                                paddingTop: "16px",
                                                gap: "16px"
                                            }}>
                                                <span style={{ fontWeight: "bold", fontSize: "15px", color: "var(--text)" }}>Total Tagihan:</span>
                                                <span style={{ fontWeight: "bold", fontSize: "16px", color: "var(--primary)" }}>
                                                    {formatRupiah(order.total)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}