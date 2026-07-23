import { useEffect, useState, useMemo, useRef } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Icon from "../components/Icon/Icon";
import Modal from "../components/Modal/Modal";
import Input from "../components/Input/Input";
import Select from "../components/Select/Select";
import Button from "../components/Button/Button";
import Alert from "../components/Alert/Alert";
import Table from "../components/Table/Table";
import { formatRupiah } from "../services/helpers"; 
import { exportGlobalStocksToExcel } from "../services/excelService";

export default function GlobalStocks() {
    const todayStr = new Date().toISOString().split("T")[0];
    const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    
    const [monthFilter, setMonthFilter] = useState(defaultMonth);
    const [loading, setLoading] = useState(false);
    const [groupedStocks, setGroupedStocks] = useState({});

    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });
    const [stores, setStores] = useState([]); 

    const fileInputRef = useRef(null);

    const handleExportCSV = async () => {
        try {
            const res = await api.get("", {
                params: { action: "export_csv_global_stock", month: monthFilter },
                responseType: "blob"
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Global_Stock_${monthFilter}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            setAlertConfig({ show: true, type: "error", message: "Gagal mengekspor CSV dari server." });
        }
    };

    const handleTriggerImport = () => {
        fileInputRef.current.click();
    };

    const handleImportCSV = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const payload = new FormData();
        payload.append("csv_file", file);

        try {
            const res = await api.post("", payload, { params: { action: "export_csv_global_stock" } });
            
            if (res.data?.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal import file." });
            } else {
                setAlertConfig({ show: true, type: "success", message: "Data berhasil diimport!" });
                fetchGlobalStocks();
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: err.response?.data?.message || err.message });
        } finally {
            e.target.value = null;
        }
    };

    const handleExportExcel = () => {
        exportGlobalStocksToExcel({
            groupedStocks: groupedStocks,
            month: monthFilter
        });
    };

    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deliveriesHistory, setDeliveriesHistory] = useState([]);

    const handleOpenHistory = async () => {
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const res = await api.get("", { params: { action: "deliveries_global_stock" } });
            if (res.data?.success) {
                setDeliveriesHistory(res.data.data || []);
            } else {
                setDeliveriesHistory([]);
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal mengambil data riwayat pengiriman." });
        } finally {
            setHistoryLoading(false);
        }
    };

    const [sendModalOpen, setSendModalOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [destinationProducts, setDestinationProducts] = useState([]);
    const [loadingDestProducts, setLoadingDestProducts] = useState(false);
    const [sendForm, setSendForm] = useState({
        to_store_id: "", global_stock_id: "", to_global_stock_id: "", date: todayStr, qty: ""
    });

    const handleOpenSendStock = () => {
        setSendForm({ to_store_id: "", global_stock_id: "", to_global_stock_id: "", date: todayStr, qty: "" });
        setDestinationProducts([]);
        setSendModalOpen(true);
    };

    useEffect(() => {
        const fetchDestinationProducts = async () => {
            if (!sendForm.to_store_id) { setDestinationProducts([]); return; }
            setLoadingDestProducts(true);
            try {
                const res = await api.get("", { params: { action: "global_stocks_by_store", store_id: sendForm.to_store_id } });
                if (res.data?.success) setDestinationProducts(res.data.data || []);
            } catch (err) { console.error("Gagal load produk tujuan:", err); } 
            finally { setLoadingDestProducts(false); }
        };
        fetchDestinationProducts();
    }, [sendForm.to_store_id]);

    const handleSubmitSendStock = async (e) => {
        e.preventDefault();
        setIsSending(true);
        try {
            const payload = new FormData();
            payload.append("global_stock_id", sendForm.global_stock_id); payload.append("to_store_id", sendForm.to_store_id); payload.append("to_global_stock_id", sendForm.to_global_stock_id); payload.append("qty", sendForm.qty); payload.append("date", sendForm.date);
            const res = await api.post("", payload, { params: { action: "send_global_stock" } });
            if (res.data && res.data.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal mengirim stok." });
            } else {
                setSendModalOpen(false); fetchGlobalStocks();
            }
        } catch (err) { setAlertConfig({ show: true, type: "error", message: err.message }); } 
        finally { setIsSending(false); }
    };

    const localProductsOptions = useMemo(() => {
        const options = [];
        Object.keys(groupedStocks).forEach(cat => {
            Object.keys(groupedStocks[cat]).forEach(prodName => {
                const variations = groupedStocks[cat][prodName];
                Object.keys(variations).forEach(id => {
                    const p = variations[id]; options.push({ value: p.id, label: `${p.name} ${p.size && p.size !== "-" ? `(${p.size})` : ""}` });
                });
            });
        });
        return options;
    }, [groupedStocks]);

    const [updateModalOpen, setUpdateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedCell, setSelectedCell] = useState(null);
    const [updateForm, setUpdateForm] = useState({ stock_in: 0, stock_out: 0 });

    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ id: "", name: "" });

    const [productModalOpen, setProductModalOpen] = useState(false);
    const [isProductSubmitting, setIsProductSubmitting] = useState(false);
    const [productForm, setProductForm] = useState({ id: "", name: "", size: "", price: 0, category_id: "" });

    const fetchGlobalStocks = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { params: { action: "grouped_stock_global_stock", month: monthFilter } });
            if (res.data?.success) setGroupedStocks(res.data.data.grouped_stocks || {});
            else setGroupedStocks({});
        } catch (error) { setGroupedStocks({}); } 
        finally { setLoading(false); }
    };

    const fetchStores = async () => {
        try {
            const res = await api.get("", { params: { action: "get_store_global_stock" } }); 
            if (res.data?.success) setStores(res.data.data || []);
        } catch (err) { console.error("Gagal load stores", err); }
    };

    useEffect(() => { fetchGlobalStocks(); }, [monthFilter]); 
    useEffect(() => { fetchStores(); }, []);

    const handleCellClick = (details, day, sm, sk, type) => {
        const fullDate = `${monthFilter}-${String(day).padStart(2, "0")}`;
        setSelectedCell({
            global_stock_id: details.id, productName: `${details.name} ${details.size && details.size !== "-" ? `(${details.size})` : ""}`, day: day, fullDate: fullDate
        });
        setUpdateForm({ stock_in: sm || 0, stock_out: sk || 0 });
        setUpdateModalOpen(true);
        setTimeout(() => {
            const inputName = type === 'in' ? 'stock_in' : 'stock_out';
            const inputEl = document.querySelector(`input[name="${inputName}"]`);
            if (inputEl) { inputEl.focus(); if (typeof inputEl.select === 'function') inputEl.select(); }
        }, 150);
    };

    const handleUpdateDailyStock = async (e) => {
        e.preventDefault(); setIsSubmitting(true);
        try {
            const payload = new FormData(); payload.append("global_stock_id", selectedCell.global_stock_id); payload.append("date", selectedCell.fullDate); payload.append("stock_in", updateForm.stock_in || 0); payload.append("stock_out", updateForm.stock_out || 0);
            const res = await api.post("", payload, { params: { action: "update_daily_global_stock" } });
            if (res.data && res.data.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal update stok harian." });
            } else {
                setUpdateModalOpen(false); fetchGlobalStocks();
            }
        } catch (err) { setAlertConfig({ show: true, type: "error", message: err.message }); } 
        finally { setIsSubmitting(false); }
    };

    const handleOpenAddCategory = () => { setCategoryForm({ id: "", name: "" }); setCategoryModalOpen(true); };
    const handleOpenEditCategory = (id, name) => { setCategoryForm({ id, name }); setCategoryModalOpen(true); };
    const handleDeleteCategory = async (id, name) => {
        if (window.confirm(`PERINGATAN KRITIS!\n\nApakah Anda yakin ingin menghapus kategori "${name.toUpperCase()}"?`)) {
            try {
                const payload = new FormData(); payload.append("id", id);
                await api.post("", payload, { params: { action: "delete_category_global_stock" } });
                fetchGlobalStocks();
            } catch (err) { setAlertConfig({ show: true, type: "error", message: err.message }); }
        }
    };
    const handleSubmitCategory = async (e) => {
        e.preventDefault(); setIsCategorySubmitting(true);
        try {
            const payload = new FormData(); payload.append("name", categoryForm.name);
            if (categoryForm.id) payload.append("id", categoryForm.id);
            const action = categoryForm.id ? "update_category_global_stock" : "create_category_global_stock";
            await api.post("", payload, { params: { action: action } });
            setCategoryModalOpen(false); fetchGlobalStocks();
        } catch (err) { setAlertConfig({ show: true, type: "error", message: err.message }); } 
        finally { setIsCategorySubmitting(false); }
    };

    const handleOpenAddProduct = (categoryId) => { setProductForm({ id: "", name: "", size: "", price: 0, category_id: categoryId }); setProductModalOpen(true); };
    const handleOpenEditProduct = (details) => { setProductForm({ id: details.id, name: details.name || "", size: details.size || "", price: details.price || 0, category_id: details.global_stock_category_id || "" }); setProductModalOpen(true); };
    const handleDeleteProduct = async (details) => {
        if (window.confirm(`PERINGATAN!\n\nApakah Anda yakin ingin menghapus produk "${details.name}"?`)) {
            try {
                const payload = new FormData(); payload.append("id", details.id);
                await api.post("", payload, { params: { action: "delete_global_stock" } });
                fetchGlobalStocks();
            } catch (err) { setAlertConfig({ show: true, type: "error", message: err.message }); }
        }
    };
    const handleSubmitProduct = async (e) => {
        e.preventDefault(); setIsProductSubmitting(true);
        try {
            const payload = new FormData(); payload.append("name", productForm.name); payload.append("size", productForm.size); payload.append("price", productForm.price); payload.append("category_id", productForm.category_id);
            if (productForm.id) payload.append("id", productForm.id);
            const action = productForm.id ? "update_global_stock" : "create_global_stock";
            await api.post("", payload, { params: { action: action } });
            setProductModalOpen(false); fetchGlobalStocks();
        } catch (err) { setAlertConfig({ show: true, type: "error", message: err.message }); } 
        finally { setIsProductSubmitting(false); }
    };

    const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
    const renderTableHeaders = () => (
        <thead>
            <tr>
                <th rowSpan={2} style={{ padding: "12px", border: "1px solid var(--border)", backgroundColor: "var(--bg-body)", width: "40px" }}>No</th>
                <th rowSpan={2} style={{ padding: "12px", border: "1px solid var(--border)", backgroundColor: "var(--bg-body)", minWidth: "200px" }}>Item & Harga</th>
                <th rowSpan={2} style={{ padding: "12px", border: "1px solid var(--border)", backgroundColor: "var(--bg-body)", width: "70px" }}>Aksi</th>
                <th rowSpan={2} style={{ padding: "12px 6px", border: "1px solid var(--border)", backgroundColor: "var(--bg-body)", whiteSpace: "normal", width: "60px", lineHeight: "1.2" }}>Stok<br/>Awal</th>
                <th colSpan={31} style={{ padding: "8px", border: "1px solid var(--border)", backgroundColor: "var(--bg-body)", textAlign: "center" }}>Tanggal (M: Masuk, K: Keluar)</th>
                <th rowSpan={2} style={{ padding: "12px 6px", border: "1px solid var(--border)", backgroundColor: "var(--bg-body)", whiteSpace: "normal", width: "60px", lineHeight: "1.2" }}>Stok<br/>Akhir</th>
            </tr>
            <tr>
                {daysInMonth.map(day => (
                    <th key={day} style={{ padding: "0", border: "1px solid var(--border)", backgroundColor: "var(--bg-body)", minWidth: "40px" }}>
                        <div style={{ textAlign: "center", borderBottom: "1px solid var(--border)", padding: "4px", backgroundColor: "rgba(0,0,0,0.02)" }}>{day}</div>
                        <div style={{ display: "flex", fontSize: "11px" }}>
                            <div style={{ flex: 1, padding: "4px 2px", borderRight: "1px solid var(--border)", color: "var(--success)" }}>M</div>
                            <div style={{ flex: 1, padding: "4px 2px", color: "var(--danger)" }}>K</div>
                        </div>
                    </th>
                ))}
            </tr>
        </thead>
    );

    const renderRow = (productDetails, index) => {
        const isEven = index % 2 === 0;
        const rowBg = isEven ? "rgba(0,0,0,0.02)" : "var(--bg-content)";
        return (
            <tr key={productDetails.id} style={{ borderBottom: "1px solid var(--border)", backgroundColor: rowBg, transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(var(--primary-rgb), 0.15)"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBg}>
                <td style={{ padding: "8px", textAlign: "center", borderRight: "1px solid var(--border)" }}>{index}</td>
                <td style={{ padding: "8px 12px", borderRight: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                        <span><strong>{productDetails.name}</strong> {productDetails.size && productDetails.size !== "-" ? `(${productDetails.size})` : ""}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", backgroundColor: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: "4px" }}>{formatRupiah(productDetails.price || 0)}</span>
                    </div>
                </td>
                <td style={{ padding: "8px", textAlign: "center", borderRight: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                        <Button
                            icon={<Icon name="edit" />}
                            onClick={() => handleOpenEditProduct(productDetails)}
                            title="Edit Produk"
                            variant="warning">
                        </Button>
                        <Button
                            icon={<Icon name="delete" />}
                            onClick={() => handleDeleteProduct(productDetails)}
                            title="Hapus Produk"
                            variant="danger">
                        </Button>
                    </div>
                </td>
                <td style={{ padding: "8px", textAlign: "center", fontWeight: "bold", borderRight: "1px solid var(--border)", backgroundColor: "rgba(var(--info-rgb), 0.1)" }}>{productDetails.sa_awal || 0}</td>
                {daysInMonth.map(day => {
                    const dailyData = productDetails.daily?.[day];
                    const stockIn = dailyData?.sm || 0;
                    const stockOut = dailyData?.sk || 0;
                    return (
                        <td key={day} style={{ padding: "0", borderRight: "1px solid var(--border)", minWidth: "40px", transition: "background 0.2s" }} title={`Edit tanggal ${day}`} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(var(--primary-rgb), 0.3)"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                            <div style={{ display: "flex", width: "100%", height: "100%", cursor: "pointer" }}>
                                <div onClick={() => handleCellClick(productDetails, day, stockIn, stockOut, 'in')} style={{ flex: 1, textAlign: "center", padding: "8px 2px", borderRight: "1px dotted var(--border)", color: stockIn > 0 ? "var(--success)" : "inherit", fontWeight: stockIn > 0 ? "bold" : "normal" }}>{stockIn}</div>
                                <div onClick={() => handleCellClick(productDetails, day, stockIn, stockOut, 'out')} style={{ flex: 1, textAlign: "center", padding: "8px 2px", color: stockOut > 0 ? "var(--danger)" : "inherit", fontWeight: stockOut > 0 ? "bold" : "normal" }}>{stockOut}</div>
                            </div>
                        </td>
                    );
                })}
                <td style={{ padding: "8px", textAlign: "center", fontWeight: "bold", borderLeft: "1px solid var(--border)", backgroundColor: "rgba(var(--warning-rgb), 0.1)" }}>{productDetails.sa_akhir || 0}</td>
            </tr>
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: "100vw", boxSizing: "border-box", paddingBottom: "40px" }}>
            <Header 
                title="Global Stocks" 
                subtitle="Pantau pergerakan masuk dan keluar stok global (Bulanan)." 
                actions={
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button variant="secondary" icon={<Icon name="download" />} onClick={handleExportCSV}>
                            Export CSV
                        </Button>
                        <Button variant="secondary" icon={<Icon name="upload" />} onClick={handleTriggerImport}>
                            Import CSV
                        </Button>
                        <Button variant="success" icon={<Icon name="excel" />} onClick={handleExportExcel}>
                            Export Excel
                        </Button>
                        <Button variant="secondary" icon={<Icon name="history" />} onClick={handleOpenHistory}>
                            Riwayat
                        </Button>
                        <Button variant="info" icon={<Icon name="send" />} onClick={handleOpenSendStock}>
                            Kirim Stok
                        </Button>
                        <Button variant="primary" icon={<Icon name="add" />} onClick={handleOpenAddCategory}>
                            Kategori
                        </Button>
                    </div>
                }
            />

            {/* Hidden File Input untuk Import CSV */}
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".csv" 
                onChange={handleImportCSV} 
            />
            
            {alertConfig.show && (
                <div style={{ padding: "0 24px" }}>
                    <Alert type={alertConfig.type} message={alertConfig.message} onClose={() => setAlertConfig({ ...alertConfig, show: false, message: "" })} />
                </div>
            )}

            <div style={{ padding: "24px 24px 0 24px", display: "flex", gap: "16px", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text)" }}>Bulan & Tahun</label>
                    <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--bg-content)", color: "var(--text)", outline: "none", fontSize: "14px" }} />
                </div>
                {loading && <span style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "10px" }}><Icon name="sync" /> Memuat data...</span>}
            </div>

            <div style={{ padding: "24px", overflowX: "hidden" }}>
                {Object.keys(groupedStocks).length === 0 && !loading ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-content)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                        Tidak ada data stok untuk bulan ini.
                    </div>
                ) : (
                    Object.keys(groupedStocks).map((categoryName) => {
                        const categoryProducts = groupedStocks[categoryName];
                        let globalIndex = 1;
                        let categoryId = "";
                        const firstProductName = Object.keys(categoryProducts)[0];
                        if (firstProductName) {
                            const firstVariationKey = Object.keys(categoryProducts[firstProductName])[0];
                            if (firstVariationKey) categoryId = categoryProducts[firstProductName][firstVariationKey].global_stock_category_id;
                        }
                        return (
                            <div key={categoryName} style={{ marginBottom: "32px", background: "var(--bg-content)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", overflowX: "auto" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h3 style={{ margin: 0, color: "var(--text)", fontWeight: "700" }}>
                                        Kategori: <span style={{ color: "var(--primary)" }}>{categoryName.toUpperCase()}</span>
                                    </h3>
                                    {categoryId && (
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button onClick={() => handleOpenAddProduct(categoryId)} style={{ padding: "6px 12px", background: "var(--success)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}><Icon name="add" /> Produk</button>
                                            <button onClick={() => handleOpenEditCategory(categoryId, categoryName)} style={{ padding: "6px 12px", background: "var(--warning)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}><Icon name="edit" /> Edit Kategori</button>
                                            <button onClick={() => handleDeleteCategory(categoryId, categoryName)} style={{ padding: "6px 12px", background: "var(--danger)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}><Icon name="delete" /> Hapus Kategori</button>
                                        </div>
                                    )}
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                    {renderTableHeaders()}
                                    <tbody>
                                        {Object.keys(categoryProducts).map((productName) => {
                                            return Object.keys(categoryProducts[productName]).map((idKey) => {
                                                return renderRow(categoryProducts[productName][idKey], globalIndex++);
                                            });
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })
                )}
            </div>

            {/* MODAL KIRIM BARANG */}
            <Modal open={sendModalOpen} onClose={() => setSendModalOpen(false)} title="Kirim Barang ke Toko Lain" size="md">
                <form onSubmit={handleSubmitSendStock} style={{ padding: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
                        
                        <Select
                            labelPosition="top"
                            name="global_stock_id"
                            label="Barang yang akan dikirim"
                            value={sendForm.global_stock_id}
                            onChange={(e) => setSendForm({ ...sendForm, global_stock_id: e.target.value })}
                            options={localProductsOptions}
                            placeholder="-- Pilih Produk Asal --"
                            required
                        />

                        <Select
                            labelPosition="top"
                            name="to_store_id"
                            label="Toko Tujuan"
                            value={sendForm.to_store_id}
                            onChange={(e) => setSendForm({ ...sendForm, to_store_id: e.target.value })}
                            options={stores.map(s => ({ value: s.store_id, label: s.name }))} 
                            placeholder="-- Pilih Toko Tujuan --"
                            required
                        />

                        {sendForm.to_store_id && (
                            <Select
                                labelPosition="top"
                                name="to_global_stock_id"
                                label="Diterima di tujuan sebagai barang"
                                value={sendForm.to_global_stock_id}
                                onChange={(e) => setSendForm({ ...sendForm, to_global_stock_id: e.target.value })}
                                options={[
                                    { value: "NEW", label: "🌟 -- BUAT BARU OTOMATIS -- 🌟" },
                                    ...destinationProducts.map(p => ({ 
                                        value: p.id, 
                                        label: `${p.category_name} - ${p.name} ${p.size && p.size !== "-" ? `(${p.size})` : ""}` 
                                    }))
                                ]}
                                placeholder={loadingDestProducts ? "Memuat produk..." : "-- Pilih Produk Tujuan --"}
                                required
                            />
                        )}

                        <div style={{ display: "flex", gap: "12px" }}>
                            <div style={{ flex: 1 }}>
                                <Input
                                    labelPosition="top"
                                    name="date"
                                    type="date"
                                    label="Tanggal Kirim"
                                    value={sendForm.date}
                                    onChange={(e) => setSendForm({ ...sendForm, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <Input
                                    labelPosition="top"
                                    name="qty"
                                    type="number"
                                    label="Quantity (Qty)"
                                    value={sendForm.qty}
                                    onChange={(e) => setSendForm({ ...sendForm, qty: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                    </div>
                    
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Button type="button" variant="secondary" onClick={() => setSendModalOpen(false)}>Batal</Button>
                        <Button type="submit" variant="info" disabled={isSending} icon={<Icon name={isSending ? "hourglass_empty" : "send"} />}>
                            {isSending ? "Mengirim..." : "Kirim Stok"}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL RIWAYAT */}
            <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title="Riwayat Pengiriman & Penerimaan Stok" size="lg">
                <div style={{ padding: "16px" }}>
                    {historyLoading ? (
                        <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}><Icon name="sync" /> Memuat data riwayat...</div>
                    ) : (
                        <Table
                            id="table-delivery-history"
                            size="sm"
                            showNumber={true}
                            rowKey="id"
                            columns={[
                                { key: "date", title: "Tanggal", render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span> },
                                { key: "status", title: "Status", render: (row) => <span style={{ fontWeight: "bold", color: "var(--primary)" }}>Pengiriman / Penerimaan</span> },
                                { key: "toko", title: "Toko Terkait", render: (row) => <span style={{ fontSize: "12px" }}>Dari: <strong>{row.from_store}</strong><br/>Ke: <strong>{row.to_store}</strong></span> },
                                { key: "produk", title: "Produk & Ukuran", render: (row) => <span><strong>{row.item_name}</strong> {row.item_size && row.item_size !== "-" ? `(${row.item_size})` : ""}</span> },
                                { key: "qty", title: "Qty", render: (row) => <strong style={{ color: "var(--success)" }}>{row.qty}</strong> }
                            ]}
                            rows={deliveriesHistory}
                        />
                    )}
                </div>
            </Modal>

            {/* MODAL LAINNYA (Update, Kategori, Produk) */}
            <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={categoryForm.id ? "Edit Kategori" : "Tambah Kategori Baru"} size="sm">
                <form onSubmit={handleSubmitCategory} style={{ padding: "16px" }}><div style={{ marginBottom: "24px" }}><Input labelPosition="top" name="name" type="text" label="Nama Kategori" placeholder="Contoh: ATEXCO..." value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /></div><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Button type="button" variant="secondary" onClick={() => setCategoryModalOpen(false)}>Batal</Button><Button type="submit" variant="primary" disabled={isCategorySubmitting} icon={<Icon name={isCategorySubmitting ? "hourglass_empty" : "save"} />}>Simpan Kategori</Button></div></form>
            </Modal>

            <Modal open={productModalOpen} onClose={() => setProductModalOpen(false)} title={productForm.id ? "Edit Produk" : "Tambah Produk Baru"} size="md">
                <form onSubmit={handleSubmitProduct} style={{ padding: "16px" }}><div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}><Input labelPosition="top" name="name" type="text" label="Nama Produk" placeholder="Contoh: Protectpaper..." value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /><div style={{ display: "flex", gap: "12px" }}><div style={{ flex: 1 }}><Input labelPosition="top" name="size" type="text" label="Ukuran (Size)" placeholder="Contoh: 1.2, roll, -" value={productForm.size} onChange={(e) => setProductForm({ ...productForm, size: e.target.value })} /></div><div style={{ flex: 1 }}><Input labelPosition="top" name="price" type="number" label="Harga (Opsional)" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div></div></div><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Button type="button" variant="secondary" onClick={() => setProductModalOpen(false)}>Batal</Button><Button type="submit" variant="primary" disabled={isProductSubmitting} icon={<Icon name={isProductSubmitting ? "hourglass_empty" : "save"} />}>Simpan Produk</Button></div></form>
            </Modal>

            <Modal open={updateModalOpen} onClose={() => setUpdateModalOpen(false)} title="Update Stok Harian" size="sm">
                <form onSubmit={handleUpdateDailyStock} style={{ padding: "16px" }}>
                    <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "var(--bg-body)", border: "1px solid var(--border)", borderRadius: "8px" }}><div style={{ marginBottom: "8px" }}><span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Produk:</span><br/><strong>{selectedCell?.productName}</strong></div><div><span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Tanggal:</span><br/><strong>{selectedCell?.fullDate}</strong></div></div>
                    <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}><div style={{ flex: 1 }}><Input labelPosition="top" name="stock_in" type="number" label="Stok Masuk (M)" value={updateForm.stock_in} onChange={(e) => setUpdateForm({ ...updateForm, stock_in: e.target.value })} /></div><div style={{ flex: 1 }}><Input labelPosition="top" name="stock_out" type="number" label="Stok Keluar (K)" value={updateForm.stock_out} onChange={(e) => setUpdateForm({ ...updateForm, stock_out: e.target.value })} /></div></div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><Button type="button" variant="secondary" onClick={() => setUpdateModalOpen(false)}>Batal</Button><Button type="submit" variant="primary" disabled={isSubmitting} icon={<Icon name={isSubmitting ? "hourglass_empty" : "save"} />}>Simpan Stok</Button></div>
                </form>
            </Modal>
        </div>
    );
}