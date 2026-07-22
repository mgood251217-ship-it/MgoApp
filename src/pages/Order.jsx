import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Select from "../components/Select/Select";
import Form from "../components/Form/Form";
import Modal from "../components/Modal/Modal";
import Icon from "../components/Icon/Icon";
import Alert from "../components/Alert/Alert";
import { formatRupiah } from "../services/helpers";
import OrderItemForm from "../components/OrderItemForm/OrderItemForm";

export default function Order() {
    const { order_id } = useParams();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [orderInfo, setOrderInfo] = useState({
        total: 0,
        diskon_per_produk: {},
        note: ""
    });
    
    const [stores, setStores] = useState([]);

    const [noteInput, setNoteInput] = useState("");
    const [previewPrice, setPreviewPrice] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });

    const [activeFormItem, setActiveFormItem] = useState({});
    
    const [initialFormItem, setInitialFormItem] = useState({
        order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "",
        qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", paketSize: "", size: ""
    });

    const [maklunModalOpen, setMaklunModalOpen] = useState(false);
    const [maklunData, setMaklunData] = useState({
        order_item_id: "",
        store_id: ""
    });

    const focusCategoryField = () => {
        setTimeout(() => {
            const wrapper = document.getElementById("categorySelectField");
            if (!wrapper) return;
            const focusable = wrapper.querySelector('select, input, textarea');
            if (focusable) {
                focusable.focus();
                if (typeof focusable.select === 'function') focusable.select();
            }
        }, 100);
    };

    const loadOrderData = useCallback(async () => {
        try {
            const res = await api.get("", {
                params: { action: "order_detail", order_id: order_id }
            });
            const data = res.data?.data || {};
            const loadedItems = data.items || [];
            
            setItems(loadedItems);
            setOrderInfo({
                total: data.total || 0,
                diskon_per_produk: data.diskon_per_produk || {},
                note: data.note || ""
            });
            setNoteInput(data.note || "");
            
            if (loadedItems.length === 0) {
                focusCategoryField();
            }
        } catch (err) {}
    }, [order_id]);

    const loadStores = useCallback(async () => {
        try {
            const res = await api.get("", { params: { action: "store_names" } });
            setStores(res.data?.data || []);
        } catch (err) {}
    }, []);

    useEffect(() => {
        loadOrderData();
        loadStores();
    }, [loadOrderData, loadStores]);

    useEffect(() => {
        const getPrice = async () => {
            if (!activeFormItem.product_id || !activeFormItem.qty) {
                setPreviewPrice(0);
                return;
            }
            try {
                const payload = new FormData();
                payload.append("order_id", order_id);
                payload.append("product_id", activeFormItem.product_id);
                payload.append("quantity", activeFormItem.qty || 0);
                payload.append("finishing", (activeFormItem.finishings || []).join(","));
                payload.append("panjang", activeFormItem.panjang || 0);
                payload.append("lebar", activeFormItem.lebar || 0);
                payload.append("kiloan", activeFormItem.kiloan || 0);
                payload.append("waktu", activeFormItem.waktu || 0);
                payload.append("ukuranJersey", activeFormItem.ukuranJersey || "");
                payload.append("diskon", activeFormItem.diskon || 0);
                payload.append("size", activeFormItem.size || activeFormItem.ukuranJersey || activeFormItem.paketSize || "");

                const res = await api.post("", payload, { params: { action: "item_price" } });
                setPreviewPrice(res.data?.total || res.data?.data?.total || 0);
            } catch (err) {
                setPreviewPrice(0);
            }
        };

        const timeoutId = setTimeout(() => {
            getPrice();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [activeFormItem, order_id]);

    const handleAddItem = async (submittedForm) => {
        if (!submittedForm.category_id || !submittedForm.product_id || !submittedForm.qty) {
            setAlertConfig({ show: true, type: "error", message: "Kategori, Produk, dan Quantity wajib diisi!" });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = new FormData();
            payload.append("order_id", order_id);
            if (submittedForm.order_item_id) payload.append("order_item_id", submittedForm.order_item_id);
            
            payload.append("product_id", submittedForm.product_id);
            payload.append("judul", submittedForm.selectedProductName || ""); 
            payload.append("quantity", submittedForm.qty || 0);
            payload.append("finishing", submittedForm.finishings.join(","));
            payload.append("panjang", submittedForm.panjang || 0);
            payload.append("lebar", submittedForm.lebar || 0);
            payload.append("kiloan", submittedForm.kiloan || 0);
            payload.append("waktu", submittedForm.waktu || 0);
            payload.append("ukuranJersey", submittedForm.ukuranJersey || "");
            payload.append("diskon", submittedForm.diskon || 0);
            payload.append("size", submittedForm.size || submittedForm.ukuranJersey || submittedForm.paketSize || "");

            const endpointAction = submittedForm.order_item_id ? "update_item" : "create_order_item";

            const res = await api.post("", payload, { params: { action: endpointAction } });
            
            if (res.data && res.data.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal menyimpan item." });
            } else {
                setInitialFormItem({
                    order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "",
                    qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", paketSize: "", size: ""
                });
                loadOrderData();
                focusCategoryField();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Terjadi kesalahan sistem.";
            setAlertConfig({ show: true, type: "error", message: errorMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        try {
            const payload = new FormData();
            payload.append("order_item_id", itemId);
            await api.post("", payload, { params: { action: "delete_order_item" } });
            loadOrderData();
        } catch (err) {}
    };

    const handleOpenMaklun = (row) => {
        setMaklunData({
            order_item_id: row.order_item_id,
            store_id: row.store_id || ""
        });
        setMaklunModalOpen(true);
    };

    const handleMaklunSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_item_id", maklunData.order_item_id);
            payload.append("store_id", maklunData.store_id);
            await api.post("", payload, { params: { action: "update_maklun" } });
            setMaklunModalOpen(false);
            loadOrderData();
        } catch (err) {}
    };

    const handleUpdateNote = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", order_id);
            payload.append("note", noteInput);
            await api.post("", payload, { params: { action: "update_customer_note" } });
            loadOrderData();
        } catch (err) {}
    };

    const handleRowDoubleClick = (row) => {
        const currentFinishings = row.finishing 
            ? String(row.finishing).split(",").map(f => f.trim()) 
            : [];

        let w = row.lebar || "";
        let p = row.panjang || "";

        if (row.size && String(row.size).includes("x")) {
            const parts = row.size.split("x").map(s => s.trim());
            p = parts[0] || p;
            w = parts[1] || w;
        }

        setInitialFormItem({
            order_item_id: row.order_item_id,
            category_id: row.category_id || "", 
            product_id: row.product_id || "",
            panjang: p,
            lebar: w,
            qty: row.quantity || "",
            diskon: row.diskon || "",
            finishings: currentFinishings,
            kiloan: row.kiloan || "",
            waktu: row.waktu || "",
            ukuranJersey: row.size || "",
            paketSize: row.size || "",
            size: row.size || ""
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const storeOptions = useMemo(() => stores.map(s => ({ value: s.store_id, label: s.name })), [stores]);

    const tableColumns = useMemo(() => [
        { key: "judul", title: "Product" },
        { key: "finishing_names", title: "Finishing" },
        { key: "size", title: "Ukuran" },
        { key: "quantity", title: "Qty" },
        { key: "unit", title: "Harga" },
        { key: "formatted_amount", title: "Jumlah" }
    ], []);

    const tableDataMapped = useMemo(() => {
        return items.map(item => ({
            ...item,
            formatted_amount: formatRupiah(item.amount)
        }));
    }, [items]);

    const tableActions = useCallback((row) => (
        <div style={{ display: "flex", gap: "4px" }}>
            <Button
                size="sm"
                variant="info"
                icon={<Icon name="storefront" />}
                onClick={(e) => { e.stopPropagation(); handleOpenMaklun(row); }}
            >
                {row.maklun_store && row.maklun_store.trim() !== "" ? row.maklun_store : "Maklun"}
            </Button>
            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={(e) => { e.stopPropagation(); handleDeleteItem(row.order_item_id); }}
            />
        </div>
    ), []);

    return (
        <>
            {alertConfig.show && (
                <Alert 
                    type={alertConfig.type} 
                    message={alertConfig.message} 
                    onClose={() => setAlertConfig({ ...alertConfig, show: false, message: "" })} 
                />
            )}
            
            <Header
                title={`Input Order Item #${order_id}`}
                subtitle="Tambahkan produk ke dalam pesanan"
                actions={
                    <Button 
                        variant="secondary" 
                        size="full-lg"
                        icon={<Icon name="arrow_back" />} 
                        onClick={() => navigate("/orders")}
                    >
                        Kembali
                    </Button>
                }
            />

            <div style={{ display: "flex", gap: "24px", marginTop: "24px", alignItems: "flex-start" }}>
                <div style={{ width: "40%", backgroundColor: "var(--bg-content)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <h3 style={{ marginBottom: "16px" }}>{initialFormItem.order_item_id ? "Edit Item" : "Form Item"}</h3>
                    
                    {/* Memanggil Komponen yang sudah di pisah */}
                    <OrderItemForm 
                        initialData={initialFormItem}
                        isSubmitting={isSubmitting}
                        onSubmit={handleAddItem}
                        onChange={(currentFormItem) => setActiveFormItem(currentFormItem)}
                        submitText={initialFormItem.order_item_id ? "Update Item" : "Tambah Item"}
                        submitIcon={initialFormItem.order_item_id ? "edit" : "add"}
                        submitVariant={initialFormItem.order_item_id ? "warning" : "success"}
                        showCancel={!!initialFormItem.order_item_id}
                        onCancel={() => setInitialFormItem({
                            order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "",
                            qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", paketSize: "", size: ""
                        })}
                    >
                        {/* Anak elemen (children) dimasukkan ke dalam form jika diperlukan */}
                        <div style={{ padding: "12px", backgroundColor: "var(--bg-body)", borderRadius: "6px", marginBottom: "16px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "bold", fontSize: "14px", color: "var(--text)" }}>Estimasi Harga:</span>
                            <span style={{ fontWeight: "bold", color: "var(--success)", fontSize: "16px" }}>
                                {formatRupiah(previewPrice)}
                            </span>
                        </div>
                    </OrderItemForm>
                </div>

                <div style={{ width: "60%" }}>
                    <div style={{ backgroundColor: "var(--bg-content)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        <h3 style={{ marginBottom: "16px" }}>Daftar Item</h3>
                        <Table
                            id="tableOrderItems"
                            showNumber
                            size="sm"
                            rowKey="order_item_id"
                            rowDataKey="order_item_id"
                            columns={tableColumns}
                            rows={tableDataMapped}
                            actions={tableActions}
                            onRowDoubleClick={handleRowDoubleClick}
                        />

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", padding: "16px", backgroundColor: "var(--bg-body)", borderRadius: "8px", border: "1px solid var(--border)", alignItems: "center"}}>
                            <div>
                                <h4 style={{ margin: "0 0 8px 0" }}>Diskon Produk:</h4>
                                {Object.keys(orderInfo.diskon_per_produk || {}).length > 0 ? (
                                    <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text)" }}>
                                        {Object.entries(orderInfo.diskon_per_produk).map(([nama, diskon], index) => (
                                            <li key={index} style={{ marginBottom: "4px" }}>
                                                {nama || "Produk tanpa nama"}: <strong style={{ color: "var(--danger)" }}>{formatRupiah(diskon)}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span style={{ color: "var(--secondary)" }}>Tidak ada diskon</span>
                                )}
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <h5 style={{ margin: "0 0 4px 0", color: "var(--secondary)" }}>Total Bayar</h5>
                                <h2 style={{ margin: 0, color: "var(--success)" }}>
                                    {formatRupiah(orderInfo.total)}
                                </h2>
                            </div>
                        </div>

                        <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "var(--bg-body)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                            {orderInfo.note && (
                                <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "rgba(var(--warning-rgb), 0.1)", color: "var(--warning)", borderRadius: "6px", borderLeft: "4px solid var(--warning)" }}>
                                    {orderInfo.note}
                                </div>
                            )}
                            <Form id="formUpdateNote" onSubmit={handleUpdateNote}>
                                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                    <div style={{ flex: 1 }}>
                                        <Input
                                            name="noteInput"
                                            placeholder="Tulis catatan pesanan di sini..."
                                            value={noteInput}
                                            onChange={(e) => setNoteInput(e.target.value)}
                                        />
                                    </div>
                                    <Button type="submit" size="md" variant="primary" icon={<Icon name="save" />}>
                                        Simpan
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                open={maklunModalOpen}
                onClose={() => setMaklunModalOpen(false)}
                title="Pilih Maklun Store"
                size="sm"
                headerColor="info"
            >
                <Form id="formMaklun" onSubmit={handleMaklunSubmit}>
                    <Select
                        labelPosition="top"
                        name="store_id"
                        label="Store Maklun"
                        value={maklunData.store_id}
                        onChange={(e) => setMaklunData(prev => ({ ...prev, store_id: e.target.value }))}
                        options={storeOptions}
                        placeholder="Pilih Store"
                        required
                    />
                    <Button type="submit" size="full-lg" variant="info" icon={<Icon name="save" />}>
                        Simpan Maklun
                    </Button>
                </Form>
            </Modal>
        </>
    );
}