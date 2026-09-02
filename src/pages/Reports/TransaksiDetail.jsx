import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import ReportNav from "../../components/ReportNav/ReportNav";
import Icon from "../../components/Icon/Icon";
import Button from "../../components/Button/Button";
import Input from "../../components/Input/Input";
import Tag from "../../components/Tag/Tag";
import Modal from "../../components/Modal/Modal";
import { formatRupiah, getTodayDate, formatKeInternasional } from "../../services/helpers";
import { exportTransaksiDetailExcel } from "../../services/excelService";
import { getCachedTransactionsDetail } from "../../services/apiCache";
import { checkFoldersForItems, listFilesForFolder, formatUkuran } from "../../services/folderHelper";

export default function TransaksiDetail() {
    const [searchParams] = useSearchParams();
    const [startDate, setStartDate] = useState(searchParams.get("start_date") || getTodayDate());
    const [endDate, setEndDate] = useState(searchParams.get("end_date") || getTodayDate());
    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [loading, setLoading] = useState(false);
    
    const [orders, setOrders] = useState([]);
    const [itemsByOrder, setItemsByOrder] = useState({});
    const [paymentsByOrder, setPaymentsByOrder] = useState({});
    const [transfersByOrder, setTransfersByOrder] = useState({});
    const [notesByOrder, setNotesByOrder] = useState({});
    
    const [checkAllFolders, setCheckAllFolders] = useState(false);
    const [isScanningAll, setIsScanningAll] = useState(false);
    const [scannedFolders, setScannedFolders] = useState({});
    
    const [hoveredTf, setHoveredTf] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await getCachedTransactionsDetail(startDate, endDate, search);
            setOrders(res.orders || []);
            setItemsByOrder(res.itemsByOrder || {});
            setPaymentsByOrder(res.paymentsByOrder || {});
            setTransfersByOrder(res.transfersByOrder || {});
            setNotesByOrder(res.notesByOrder || {});
            
            setCheckAllFolders(false);
            setScannedFolders({});
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

    const handleToggleCheckFolders = async (e) => {
        const isChecked = e.target.checked;
        setCheckAllFolders(isChecked);

        if (isChecked && orders.length > 0) {
            setIsScanningAll(true);
            try {
                const settings = await window.electron.getSettings();
                const newScannedFolders = {};

                for (const order of orders) {
                    const rawItems = itemsByOrder[order.order_id] || [];
                    const itemsList = rawItems.map((item, idx) => ({ ...item, no: idx + 1 }));

                    const folderCheck = await checkFoldersForItems(settings, order, itemsList);
                    const fileResults = {};
                    
                    for (const cat of Object.keys(folderCheck)) {
                        if (folderCheck[cat].status === "ada" && folderCheck[cat].path) {
                            const filesRes = await listFilesForFolder(folderCheck[cat].path);
                            if (filesRes.success) {
                                fileResults[cat] = filesRes.data;
                            } else {
                                fileResults[cat] = [];
                            }
                        }
                    }
                    
                    newScannedFolders[order.order_id] = {
                        folders: folderCheck,
                        files: fileResults
                    };
                }
                
                setScannedFolders(newScannedFolders);
            } catch (err) {
                console.error(err);
                alert("Gagal mengecek folder secara massal.");
                setCheckAllFolders(false);
            } finally {
                setIsScanningAll(false);
            }
        }
    };

    const itemColumns = useMemo(() => [
        { key: "no", title: "No" },
        { key: "judul", title: "Nama Item" },
        { key: "finishing_names", title: "Finishing", render: (row) => row.finishing_names || "-" },
        { key: "category", title: "Kategori", render: (row) => row.category || "-" },
        { key: "size", title: "Ukuran", render: (row) => row.size || "-" },
        { key: "quantity", title: "Qty" },
        { key: "unit", title: "Satuan", render: (row) => formatRupiah(Number(row.unit)) },
        { key: "amount", title: "Jumlah", render: (row) => formatRupiah(Number(row.amount)) }
    ], []);

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", paddingBottom: "40px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Header 
                    title="Laporan Detail Transaksi" 
                    subtitle="Pantau rincian setiap transaksi beserta item, pembayaran, dan catatan." 
                />
                
                <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "10px", 
                    background: "var(--surface)", 
                    padding: "8px 16px", 
                    borderRadius: "var(--radius)", 
                    border: "1px solid var(--border)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                }}>
                    <input 
                        type="checkbox" 
                        id="checkAllFolders" 
                        checked={checkAllFolders}
                        onChange={handleToggleCheckFolders}
                        disabled={isScanningAll || orders.length === 0}
                        style={{ width: "16px", height: "16px", cursor: isScanningAll ? "wait" : "pointer" }}
                    />
                    <label 
                        htmlFor="checkAllFolders" 
                        style={{ 
                            fontSize: "14px", 
                            fontWeight: "600", 
                            cursor: isScanningAll ? "wait" : "pointer", 
                            userSelect: "none",
                            color: "var(--text)"
                        }}
                    >
                        {isScanningAll ? "Mengecek Semua Folder..." : "Cek Semua Folder Desain"}
                    </label>
                </div>
            </div>

            <ReportNav />

            <DateFilter 
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Cari data ...."
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onFilter={fetchTransactions}
                onExport={handleExportExcel}
                loading={loading}
            />

            <div style={{ 
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
                        
                        const totalTagihan = Number(order.total) || 0;
                        const totalTerbayar = payments.reduce((sum, p) => sum + (Number(p.nominal) || 0), 0);
                        const selisih = totalTerbayar - totalTagihan;
                        
                        const isTfMethod = payments.some(p => p.payment_method?.toLowerCase().includes("tf") || p.payment_method?.toLowerCase().includes("transfer"));
                        
                        const scanResult = scannedFolders[order.order_id];
                        
                        return (
                            <div key={order.order_id} style={{ 
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
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>ID: {order.order_id}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Konsumen</div>
                                        <div style={{ fontWeight: "600", color: "var(--text)" }}>{order.customer_name}</div>
                                        <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>{formatKeInternasional(order.nomor)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Waktu Dibuat</div>
                                        <div style={{ fontWeight: "500", fontSize: "14px", color: "var(--text)" }}>{order.date}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Sistem & Operator</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <Tag
                                                variant={order.system === "ONLINE" ? "primary" : "success"}
                                            >
                                                {order.system}
                                            </Tag>
                                            <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text)" }}>{order.operator}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: "16px", borderBottom: "1px dashed var(--border)" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Detail Item</div>
                                    
                                    <Table 
                                        id={`table-items-${order.order_id}`}
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
                                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginRight: "auto" }}>
                                            {totalTerbayar === 0 && <Tag variant="danger" size="lg">Belum Bayar</Tag>}
                                            {totalTerbayar > 0 && selisih < 0 && <Tag variant="warning" size="lg">Kurang Bayar ({formatRupiah(Math.abs(selisih))})</Tag>}
                                            {selisih > 0 && <Tag variant="primary" size="lg">Kelebihan Bayar ({formatRupiah(selisih)})</Tag>}
                                        </div>

                                        <span style={{ fontWeight: "bold", fontSize: "15px", color: "var(--text)" }}>Total Tagihan:</span>
                                        <span style={{ fontWeight: "bold", fontSize: "16px", color: "var(--primary)" }}>
                                            {formatRupiah(totalTagihan)}
                                        </span>
                                    </div>
                                </div>

                                {checkAllFolders && (
                                    <div style={{ padding: "16px", borderBottom: "1px dashed var(--border)", background: "var(--surface)" }}>
                                        <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Data Folder & File Desain</div>

                                        {isScanningAll ? (
                                            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sedang mengecek isi direktori...</div>
                                        ) : scanResult ? (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                                {Object.keys(scanResult.folders).length === 0 ? (
                                                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Tidak ada kategori pesanan valid yang terdaftar untuk pengecekan.</div>
                                                ) : (
                                                    Object.keys(scanResult.folders).map((cat) => {
                                                        const fData = scanResult.folders[cat];
                                                        const cFiles = scanResult.files[cat] || [];
                                                        
                                                        const totalLuasKategori = cFiles.reduce((sum, file) => sum + (Number(file.totalLuas) || 0), 0);

                                                        return (
                                                            <div key={cat} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px", background: "var(--background)" }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                                    <span style={{ fontWeight: "bold", fontSize: "13px", color: "var(--text)" }}>Kategori: {cat}</span>
                                                                    <Tag variant={fData.status === "ada" ? "success" : fData.status === "tidak-ada" ? "danger" : "warning"}>
                                                                        {fData.status === "ada" ? "✅ Ada" : fData.status === "tidak-ada" ? "❌ Tidak ada" : "⚠️ Path belum diatur"}
                                                                    </Tag>
                                                                </div>
                                                                {fData.status === "ada" && cFiles.length > 0 && (
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                                                                        {cFiles.map((file, fIdx) => (
                                                                            <div key={fIdx} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", width: "100%" }}>
                                                                                <span style={{ fontSize: "20px", marginTop: "2px" }}>{file.is_dir || file.type === "folder" ? "📁" : "📄"}</span>
                                                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                                                                                    
                                                                                    <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", wordBreak: "break-all" }}>
                                                                                        {file.nama}
                                                                                    </span>
                                                                                    
                                                                                    {!(file.is_dir || file.type === "folder") && (
                                                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                                                                                            {file.quantity > 0 && (
                                                                                                <span><strong style={{color: "var(--text)"}}>Qty:</strong> {file.quantity}</span>
                                                                                            )}
                                                                                            <span><strong style={{color: "var(--text)"}}>Ukuran:</strong> {formatUkuran(file)}</span>
                                                                                            {file.colorMode && (
                                                                                                <span><strong style={{color: "var(--text)"}}>Warna:</strong> {file.colorMode}</span>
                                                                                            )}
                                                                                            {file.totalLuas != null && (
                                                                                                <span><strong style={{color: "var(--text)"}}>Total Luas:</strong> {file.totalLuas} m²</span>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}

                                                                        {totalLuasKategori > 0 && (
                                                                            <div style={{ 
                                                                                marginTop: "8px", 
                                                                                paddingTop: "12px", 
                                                                                borderTop: "1px dashed var(--border)", 
                                                                                display: "flex", 
                                                                                justifyContent: "flex-end", 
                                                                                alignItems: "center" 
                                                                            }}>
                                                                                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginRight: "8px" }}>Total Luas {cat}:</span>
                                                                                <span style={{ fontSize: "14px", fontWeight: "bold", color: "var(--primary)" }}>
                                                                                    {totalLuasKategori.toFixed(2).replace(/\.00$/, '')} m²
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {fData.status === "ada" && cFiles.length === 0 && (
                                                                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "12px" }}>Folder kosong, tidak ada file di dalamnya.</div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                                                Gagal memuat ketersediaan folder desain pada pesanan ini.
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ padding: "16px", borderBottom: "1px dashed var(--border)" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--text)" }}>Data Pembayaran & Bukti Transfer</div>
                                    
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", flex: 1, alignItems: "center" }}>
                                            {payments.length > 0 ? (
                                                payments.map((payment, idx) => (
                                                    <div key={idx} style={{ 
                                                        border: "1px solid var(--border)", 
                                                        borderRadius: "var(--radius)", 
                                                        padding: "12px", 
                                                        minWidth: "220px",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "8px",
                                                        background: "var(--background)"
                                                    }}>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{payment.date}</span>
                                                            {payment.status !== "LUNAS" && (
                                                                <Tag variant="warning">
                                                                    {payment.status}
                                                                </Tag>
                                                            )}
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
                                                <div style={{ fontSize: "15px", fontWeight: "600", color: "var(--danger)", display: "flex", alignItems: "center", gap: "6px" }}>
                                                    ⚠️ Belum Bayar
                                                </div>
                                            )}
                                            
                                            {isTfMethod && transfers.length === 0 && (
                                                <div style={{ 
                                                    padding: "16px 24px", 
                                                    background: "rgba(239, 68, 68, 0.1)", 
                                                    border: "2px dashed var(--danger)", 
                                                    borderRadius: "var(--radius)", 
                                                    color: "var(--danger)", 
                                                    fontWeight: "bold", 
                                                    fontSize: "18px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    width: "100%",
                                                    marginTop: "8px",
                                                    textAlign: "center"
                                                }}>
                                                    ⚠️ TRANSAKSI TRANSFER: BELUM ADA BUKTI PEMBAYARAN
                                                </div>
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
                                                                {!tf.img_link ? (
                                                                     <div style={{ 
                                                                        width: "60px", 
                                                                        height: "60px", 
                                                                        borderRadius: "var(--radius)", 
                                                                        border: "1px dashed var(--danger)",
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        justifyContent: "center",
                                                                        fontSize: "9px",
                                                                        color: "var(--danger)",
                                                                        background: "var(--background)",
                                                                        textAlign: "center",
                                                                        padding: "4px"
                                                                    }}>
                                                                        Belum ada <br/> bukti transfer
                                                                    </div>
                                                                ) : (
                                                                    <img 
                                                                        src={tf.img_link} 
                                                                        onClick={ () => setSelectedImage(tf.img_link) }
                                                                        alt="Bukti Transfer" 
                                                                        style={{ 
                                                                            width: "60px", 
                                                                            height: "60px", 
                                                                            objectFit: "cover", 
                                                                            borderRadius: "var(--radius)", 
                                                                            border: "2px solid var(--border)",
                                                                            cursor: "pointer",
                                                                            transition: "transform 0.2s"
                                                                        }}
                                                                        onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                                                                        onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                                                                    />
                                                                )}
                                                                
                                                                {hoveredTf === tf.transfer_id && (
                                                                    <Button
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
                                                                    </Button>
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
                                                    borderRadius: "var(--radius)",
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
                                                    borderRadius: "var(--radius)",
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
                                        <Input 
                                            type="text"
                                            name="note" 
                                            placeholder="Ketik catatan baru di sini..."
                                            style={{marginBottom : "0"}}
                                        />
                                        <Button 
                                            type="submit"
                                            size="lg"
                                            icon={<Icon name="save" />}
                                        >
                                            Simpan Catatan
                                        </Button>
                                    </form>
                                </div>

                            </div>
                        );
                    })
                )}
            </div>
            <Modal 
                open={!!selectedImage} 
                onClose={() => setSelectedImage(null)} 
                title="Bukti Lengkap"
                size="lg"
            >
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "16px", background: "var(--background)", borderRadius: "8px" }}>
                    {selectedImage && (
                        <img 
                            src={selectedImage} 
                            alt="Bukti Lengkap" 
                            style={{ 
                                maxWidth: "100%", 
                                maxHeight: "70vh", 
                                objectFit: "contain", 
                                borderRadius: "var(--radius)" 
                            }} 
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
}