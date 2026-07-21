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
    
    const [hoveredTf, setHoveredTf] = useState(null);

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
            console.error(error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const handleUploadTf = async (order_id, file) => {
        if (!file || !file.type.startsWith("image/")) {
            alert("File harus berupa gambar.");
            return;
        }
        
        const formData = new FormData();
        formData.append("picture", file);
        formData.append("order_id", order_id);

        try {
            const res = await api.post("", formData, {
                params: {
                    action: "create_tf"
                }
            });
            if (res.data?.success) {
                fetchTransactions();
                alert("Bukti transfer berhasil diupload.");
            } else {
                alert("Gagal upload bukti transfer.");
            }
        } catch (error) {
            console.error(error);
            alert("Terjadi kesalahan sistem.");
        }
    };

    const handleDeleteTf = async (transfer_id) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus bukti transfer ini?")) {
            return;
        }

        const formData = new FormData();
        formData.append("transfer_id", transfer_id);

        try {
            const res = await api.post("", formData, {
                params: {
                    action: "delete_tf"
                }
            });
            if (res.data?.success) {
                fetchTransactions();
            } else {
                alert("Gagal menghapus bukti transfer.");
            }
        } catch (error) {
            console.error(error);
            alert("Terjadi kesalahan sistem.");
        }
    };

    const handlePasteClick = async (order_id) => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const clipboardItem of clipboardItems) {
                const imageTypes = clipboardItem.types.filter(type => type.startsWith("image/"));
                if (imageTypes.length > 0) {
                    const blob = await clipboardItem.getType(imageTypes[0]);
                    const file = new File([blob], "paste_image.png", { type: blob.type });
                    handleUploadTf(order_id, file);
                    return;
                }
            }
            alert("Tidak ada gambar di clipboard.");
        } catch (err) {
            console.error(err);
            alert("Gagal membaca clipboard secara otomatis. Silakan klik kotak lalu tekan CTRL+V.");
        }
    };

    const handlePaste = (e, order_id) => {
        const file = e.clipboardData?.files?.[0];
        if (file && file.type.startsWith("image/")) {
            handleUploadTf(order_id, file);
        }
    };

    const preventDefault = (e) => e.preventDefault();

    const handleDrop = (e, order_id) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            handleUploadTf(order_id, file);
        }
    };

    const handleUpdateNote = async (e, order_id) => {
        e.preventDefault();
        const note = e.target.note.value;
        
        const formData = new FormData();
        formData.append("note", note);
        formData.append("order_id", order_id);

        try {
            const res = await api.post("", formData, {
                params: {
                    action: "update_detail_note"
                }
            });
            if (res.data?.success) {
                fetchTransactions();
                alert("Catatan berhasil diupdate.");
                e.target.reset();
            } else {
                alert("Gagal mengupdate catatan.");
            }
        } catch (error) {
            console.error(error);
            alert("Terjadi kesalahan sistem.");
        }
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

                                <div style={{ padding: "16px", borderBottom: "1px dashed var(--border)" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Data Pembayaran & Bukti Transfer</div>
                                    
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", flex: 1 }}>
                                            {payments.length > 0 ? (
                                                payments.map((payment, idx) => (
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
                                                ))
                                            ) : (
                                                <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>Belum ada pembayaran masuk.</div>
                                            )}
                                            
                                            {transfers.length > 0 && (
                                                <div style={{ display: "flex", gap: "12px", marginLeft: "12px", borderLeft: "2px dashed var(--border)", paddingLeft: "16px", alignItems: "center" }}>
                                                    {transfers.map((tf, idx) => (
                                                        <div key={idx} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>Bukti {idx + 1}</div>
                                                            <div 
                                                                style={{ position: "relative" }}
                                                                onMouseEnter={() => setHoveredTf(tf.transfer_id)}
                                                                onMouseLeave={() => setHoveredTf(null)}
                                                            >
                                                                <a href={tf.img_link} target="_blank" rel="noreferrer">
                                                                    <img 
                                                                        src={tf.img_link} 
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
                                                                
                                                                {hoveredTf === tf.transfer_id && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            handleDeleteTf(tf.transfer_id);
                                                                        }}
                                                                        style={{
                                                                            position: "absolute",
                                                                            top: "-6px",
                                                                            right: "-6px",
                                                                            background: "#ef4444",
                                                                            color: "white",
                                                                            border: "none",
                                                                            borderRadius: "50%",
                                                                            width: "20px",
                                                                            height: "20px",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            justifyContent: "center",
                                                                            fontSize: "12px",
                                                                            fontWeight: "bold",
                                                                            cursor: "pointer",
                                                                            zIndex: 10,
                                                                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                                                            padding: 0
                                                                        }}
                                                                        title="Hapus Bukti Transfer"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", gap: "12px" }}>
                                            <div 
                                                tabIndex={0}
                                                onClick={() => handlePasteClick(order.order_id)}
                                                onPaste={(e) => handlePaste(e, order.order_id)}
                                                style={{
                                                    height: "76px",
                                                    padding: "0 16px",
                                                    borderRadius: "8px",
                                                    border: "2px dashed var(--border)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: "var(--background)",
                                                    color: "var(--text-muted)",
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    cursor: "pointer",
                                                    outline: "none",
                                                    transition: "border 0.2s, background 0.2s"
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = "var(--border)"}
                                                onMouseOut={(e) => e.currentTarget.style.background = "var(--background)"}
                                                onFocus={(e) => e.currentTarget.style.border = "2px dashed var(--primary)"}
                                                onBlur={(e) => e.currentTarget.style.border = "2px dashed var(--border)"}
                                            >
                                                📋 Paste Foto (CTRL+V)
                                            </div>
                                            
                                            <label 
                                                onDragOver={preventDefault}
                                                onDragEnter={preventDefault}
                                                onDrop={(e) => handleDrop(e, order.order_id)}
                                                style={{
                                                    height: "76px",
                                                    padding: "0 16px",
                                                    borderRadius: "8px",
                                                    border: "2px dashed var(--border)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: "var(--background)",
                                                    color: "var(--text-muted)",
                                                    fontSize: "12px",
                                                    fontWeight: "600",
                                                    cursor: "pointer",
                                                    transition: "background 0.2s"
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = "var(--border)"}
                                                onMouseOut={(e) => e.currentTarget.style.background = "var(--background)"}
                                            >
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    style={{ display: "none" }} 
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleUploadTf(order.order_id, file);
                                                        e.target.value = null;
                                                    }} 
                                                />
                                                📁 Upload / Drop
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: "16px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>Catatan Transaksi</div>
                                    
                                    {note && (
                                        <div style={{ 
                                            padding: "12px 16px", 
                                            background: "rgba(255, 152, 0, 0.1)", 
                                            borderLeft: "4px solid var(--warning)",
                                            color: "var(--warning)",
                                            borderRadius: "0 8px 8px 0",
                                            fontSize: "13px",
                                            lineHeight: "1.5"
                                        }}>
                                            <div style={{ fontWeight: "600", marginBottom: "4px", color: "var(--text)" }}>Catatan Saat Ini:</div>
                                            {note}
                                        </div>
                                    )}

                                    <form 
                                        onSubmit={(e) => handleUpdateNote(e, order.order_id)}
                                        style={{ display: "flex", gap: "12px", alignItems: "center" }}
                                    >
                                        <input 
                                            type="text"
                                            name="note" 
                                            placeholder="Ketik catatan baru di sini..."
                                            style={{
                                                flex: 1,
                                                padding: "10px 16px",
                                                borderRadius: "8px",
                                                border: "1px solid var(--border)",
                                                background: "var(--background)",
                                                color: "var(--text)",
                                                fontFamily: "inherit",
                                                fontSize: "13px"
                                            }}
                                        />
                                        <button 
                                            type="submit"
                                            style={{
                                                padding: "10px 20px",
                                                background: "var(--primary)",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: "8px",
                                                fontWeight: "600",
                                                cursor: "pointer",
                                                whiteSpace: "nowrap",
                                                fontSize: "13px"
                                            }}
                                        >
                                            Simpan Catatan
                                        </button>
                                    </form>
                                </div>

                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}