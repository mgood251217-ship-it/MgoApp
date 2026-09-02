import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah, getTodayDate } from "../../services/helpers";
import { exportAktivitasExcel } from "../../services/excelService";
import { getCachedActivity, getCachedOrderArchive } from "../../services/apiCache";

export default function Aktivitas() {
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [loading, setLoading] = useState(false);
    
    const [activityData, setActivityData] = useState([]);
    const [archiveData, setArchiveData] = useState([]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resActivity, resArchive] = await Promise.all([
                getCachedActivity(startDate, endDate),
                getCachedOrderArchive(startDate, endDate)
            ]);

            if (resActivity) {
                const mappedActivities = (resActivity || []).map(({ done, ...rest }) => rest);
                setActivityData(mappedActivities);
            }

            if (resArchive) {
                const archiveValues = Object.values(resArchive || {});
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

    const handleExportExcel = async () => {
        if (activityData.length === 0 && archiveData.length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }

        try {
            await exportAktivitasExcel({
                activityData,
                archiveData,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const activityColumns = useMemo(() => [
        { 
            key: "date", 
            title: "Waktu",
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span>
        },
        { 
            key: "order_date", 
            title: "Tanggal Order",
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
            
            <DateFilter 
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onFilter={fetchData}
                onExport={handleExportExcel}
                loading={loading}
            />

            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "40px" }}>
                
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
                    <Table 
                        id="table-activity"
                        columns={activityColumns}
                        rows={activityData}
                        rowKey="activity_id"
                        size="sm"
                        showNumber={true}
                    />
                    {activityData.length === 0 && !loading && (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px dashed var(--border)" }}>
                            Tidak ada aktivitas pada rentang tanggal ini.
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ 
                        fontSize: "16px", 
                        fontWeight: "bold", 
                        color: "var(--danger)",
                        paddingLeft: "4px",
                        borderLeft: "4px solid var(--danger)"
                    }}>
                        Arsip Order Terhapus
                    </div>

                    {archiveData.length === 0 && !loading ? (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px dashed var(--border)" }}>
                            Tidak ada arsip order terhapus pada rentang tanggal ini.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                            {archiveData.map((order) => {
                                const items = (order.items || []).map((item, idx) => ({ ...item, no: idx + 1 }));
                                
                                return (
                                    <div key={order.deleted_order_id} style={{ 
                                        background: "var(--background)", 
                                        borderRadius: "var(--radius)", 
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
                                                <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--danger)" }}>{order.deleted_at}</div>
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
                                                    <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--danger)" }}>{order.deleted_by_name}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ padding: "16px" }}>
                                            <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Detail Item</div>                            
                                            <Table 
                                                id={`table-items-${order.deleted_order_id}`}
                                                columns={itemColumns} 
                                                rows={items} 
                                                size="sm"
                                                rowKey="no"
                                            />

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