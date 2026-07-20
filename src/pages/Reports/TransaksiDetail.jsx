import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import ReportNav from "../../components/ReportNav/ReportNav";
import { formatRupiah } from "../../services/helpers";
import { exportTransaksiDetailExcel } from "../../services/excelService";

export default function TransaksiDetail() {
    const today = new Date().toISOString().split("T")[0];
    
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [orders, setOrders] = useState([]);
    const [itemsByOrder, setItemsByOrder] = useState({});
    const [paymentsByOrder, setPaymentsByOrder] = useState({});
    const [transfersByOrder, setTransfersByOrder] = useState({});
    const [notesByOrder, setNotesByOrder] = useState({});

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "transactions_detail",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                setOrders(res.data.data.orders || []);
                setItemsByOrder(res.data.data.itemsByOrder || {});
                setPaymentsByOrder(res.data.data.paymentsByOrder || {});
                setTransfersByOrder(res.data.data.transfersByOrder || {});
                setNotesByOrder(res.data.data.notesByOrder || {});
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const handleExportExcel = async () => {
        if (orders.length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }
        try {
            await exportTransaksiDetailExcel({
                orders,
                itemsByOrder,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const getBaseImgUrl = (imgName) => {
        return `https://mgood.my.id/admin/assets/img/buktitf/CAHEUM_PRINTING_SUBLIM/${imgName}`;
    };

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
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", paddingBottom: "40px" }}>
            <Header 
                title="Laporan Detail Transaksi" 
                subtitle="Pantau rincian setiap transaksi beserta item, pembayaran, dan catatan." 
            />

            <ReportNav />

            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchTransactions}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ 
                padding: "0 24px",
                display: "flex",
                flexDirection: "column",
                gap: "24px"
            }}>
                {loading && orders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                        Memuat data...
                    </div>
                ) : orders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                        Tidak ada transaksi pada tanggal tersebut.
                    </div>
                ) : (
                    orders.map((order) => {
                        const rawItems = itemsByOrder[order.order_id] || [];
                        const items = rawItems.map((item, idx) => ({ ...item, no: idx + 1 }));
                        const payments = paymentsByOrder[order.order_id] || [];
                        const transfers = transfersByOrder[order.order_id] || [];
                        const note = notesByOrder[order.order_id];
                        
                        return (
                            <div key={order.order_id} style={{ 
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
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>ID: {order.order_id}</div>
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
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Sistem & Operator</div>
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
                                            <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>{order.operator}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: "16px", borderBottom: "1px dashed var(--border)" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Detail Item</div>
                                    
                                    <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                                        <Table 
                                            id={`table-items-${order.order_id}`}
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

                                <div style={{ padding: "16px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Data Pembayaran</div>
                                    {payments.length > 0 ? (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                                            {payments.map((payment, idx) => (
                                                <div key={idx} style={{ 
                                                    border: "1px solid var(--border)", 
                                                    borderRadius: "8px", 
                                                    padding: "12px", 
                                                    minWidth: "220px",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "8px",
                                                    background: "var(--surface)"
                                                }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{payment.date}</span>
                                                        <span style={{ 
                                                            fontSize: "11px", 
                                                            fontWeight: "bold", 
                                                            padding: "4px 8px", 
                                                            borderRadius: "6px",
                                                            background: payment.status === "LUNAS" ? "rgba(76, 175, 80, 0.1)" : "rgba(255, 152, 0, 0.1)",
                                                            color: payment.status === "LUNAS" ? "var(--success)" : "var(--warning)"
                                                        }}>
                                                            {payment.status}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                                        <div>
                                                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>Metode</div>
                                                            <div style={{ fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>{payment.payment_method}</div>
                                                        </div>
                                                        <div style={{ textAlign: "right", fontWeight: "bold", fontSize: "15px", color: "var(--text)" }}>
                                                            {formatRupiah(Number(payment.nominal))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {transfers.length > 0 && (
                                                <div style={{ display: "flex", gap: "12px", marginLeft: "12px", borderLeft: "2px dashed var(--border)", paddingLeft: "16px" }}>
                                                    {transfers.map((tf, idx) => (
                                                        <div key={idx} style={{ textAlign: "center" }}>
                                                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Bukti {idx + 1}</div>
                                                            <a href={getBaseImgUrl(tf.img)} target="_blank" rel="noreferrer">
                                                                <img 
                                                                    src={getBaseImgUrl(tf.img)} 
                                                                    alt="Bukti Transfer" 
                                                                    style={{ 
                                                                        width: "60px", 
                                                                        height: "60px", 
                                                                        objectFit: "cover", 
                                                                        borderRadius: "8px", 
                                                                        border: "2px solid var(--border)",
                                                                        cursor: "pointer",
                                                                        transition: "transform 0.2s"
                                                                    }}
                                                                    onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                                                                    onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                                                                />
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Belum ada pembayaran masuk.</div>
                                    )}
                                </div>

                                {note && (
                                    <div style={{ 
                                        padding: "12px 16px", 
                                        background: "rgba(255, 152, 0, 0.1)", 
                                        borderTop: "1px solid rgba(255, 152, 0, 0.2)",
                                        color: "var(--warning)",
                                        fontSize: "13px",
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "flex-start"
                                    }}>
                                        <span style={{ fontSize: "16px" }}>📝</span>
                                        <div>
                                            <div style={{ fontWeight: "600", marginBottom: "2px" }}>Catatan:</div>
                                            <div style={{ lineHeight: "1.5" }}>{note}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}