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
import { getCachedOrderDetail, getCachedStoreNames, clearCacheOrderDetail } from "../services/apiCache";
import { formatTime } from "../services/helpers"

const tierUnitLabel = tier => tier?.unit_label || ({ pcs: 'pcs', m2: 'm\u00b2', cm2: 'cm\u00b2' })[tier?.measure] || 'pcs';

const EMPTY_FORM_ITEM = {
    order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "",
    qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", paketSize: "", size: "", laser_product_id: ""
};

export default function Order() {
    const { order_id } = useParams();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [orderMeta, setOrderMeta] = useState({});
    const [orderInfo, setOrderInfo] = useState({
        total: 0,
        diskon_per_produk: {},
        discounts: null,
        note: ""
    });

    const [stores, setStores] = useState([]);

    const [noteInput, setNoteInput] = useState("");
    const [previewPrice, setPreviewPrice] = useState(0);
    const [previewTier, setPreviewTier] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingDiscountProduct, setDeletingDiscountProduct] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });

    const [activeFormItem, setActiveFormItem] = useState({});

    const [initialFormItem, setInitialFormItem] = useState({ ...EMPTY_FORM_ITEM });

    const [maklunModalOpen, setMaklunModalOpen] = useState(false);
    const [maklunData, setMaklunData] = useState({
        order_item_id: "",
        store_id: ""
    });

    const [selectedItemId, setSelectedItemId] = useState(null);
    const [visibleRows, setVisibleRows] = useState([]);

    const notifyOrderUpdate = useCallback(() => {
        if (!order_id) return;

        const payload = new FormData();
        payload.append("order_id", order_id);

        api.post("", payload, { params: { action: "trigger_order_update" } })
           .catch(() => {});
    }, [order_id]);

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

    const focusNextField = () => {
        setTimeout(() => {
            const panjangInput = document.querySelector('input[name="panjang"]');
            const qtyInput = document.querySelector('input[name="qty"]');

            if (panjangInput && panjangInput.offsetParent !== null) {
                panjangInput.focus();
                if (typeof panjangInput.select === 'function') panjangInput.select();
            }
            else if (qtyInput && qtyInput.offsetParent !== null) {
                qtyInput.focus();
                if (typeof qtyInput.select === 'function') qtyInput.select();
            }
            else {
                focusCategoryField();
            }
        }, 150);
    };

    const applyOrderData = (res, { autoFocus = false } = {}) => {
        const data = res || {};
        const loadedItems = data.items || [];

        setItems(loadedItems);
        setOrderMeta(data.order || {});
        setOrderInfo({
            total: data.total || 0,
            diskon_per_produk: data.diskon_per_produk || {},
            discounts: Array.isArray(data.discounts) ? data.discounts : null,
            note: data.note || ""
        });
        setNoteInput(data.note || "");

        if (autoFocus && loadedItems.length === 0) {
            focusCategoryField();
        }
    };

    const loadOrderData = useCallback(async () => {
        try {
            const res = await getCachedOrderDetail(order_id, (fresh) => {
                applyOrderData(fresh, { autoFocus: false });
            });
            applyOrderData(res, { autoFocus: true });
        } catch (err) {}
    }, [order_id]);

    const handleDeleteDiscount = async discount => {
        if (deletingDiscountProduct !== null || Number(discount.can_delete) !== 1) return;
        setDeletingDiscountProduct(discount.product_id);
        try {
            const payload = new FormData();
            payload.append('order_id', order_id);
            payload.append('product_id', discount.product_id);
            const res = await api.post('', payload, { params: { action: 'delete_order_discount' } });
            if (!res.data?.success) throw new Error(res.data?.message || 'Gagal menghapus diskon.');
            await clearCacheOrderDetail(order_id);
            await loadOrderData();
            notifyOrderUpdate();
        } catch (err) {
            setAlertConfig({ show: true, type: 'error', message: err.response?.data?.message || err.message || 'Gagal menghapus diskon.' });
        } finally {
            setDeletingDiscountProduct(null);
        }
    };

    const productDiscounts = orderInfo.discounts ?? Object.entries(orderInfo.diskon_per_produk).map(([name, value]) => ({ product_name: name, discount: value, can_delete: 0 }));

    const loadStores = useCallback(async () => {
        try {
            const res = await getCachedStoreNames((fresh) => {
                setStores(fresh || []);
            });
            setStores(res || []);
        } catch (err) {}
    }, []);

    useEffect(() => {
        loadOrderData();
        loadStores();
    }, [loadOrderData, loadStores]);

    useEffect(() => {
        let cancelled = false;
        const getPrice = async () => {
            if (!activeFormItem.product_id || !activeFormItem.qty) {
                if (!cancelled) { setPreviewPrice(0); setPreviewTier(null); }
                return;
            }
            try {
                const payload = new FormData();
                payload.append("order_id", order_id);
                payload.append("order_item_id", activeFormItem.order_item_id || "");
                payload.append("product_id", activeFormItem.product_id);
                payload.append("laser_product_id", activeFormItem.laser_product_id || 0);
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
                if (!cancelled) {
                    setPreviewPrice(res.data?.total || res.data?.data?.total || 0);
                    setPreviewTier(res.data?.data?.tier_pricing || null);
                }
            } catch (err) {
                if (!cancelled) { setPreviewPrice(0); setPreviewTier(null); }
            }
        };

        const timeoutId = setTimeout(() => {
            getPrice();
        }, 300);

        return () => { cancelled = true; clearTimeout(timeoutId); };
    }, [activeFormItem, order_id, items]);

    useEffect(() => {
        window.addEventListener("beforeunload", notifyOrderUpdate);

        return () => {
            window.removeEventListener("beforeunload", notifyOrderUpdate);
            notifyOrderUpdate();
        };
    }, [notifyOrderUpdate]);

    const handleCancelEdit = useCallback(() => {
        setInitialFormItem({ ...EMPTY_FORM_ITEM });
    }, []);

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
            payload.append("laser_product_id", submittedForm.laser_product_id || 0);
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

            if (!res.data?.success) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal menyimpan item." });
            } else {
                setInitialFormItem({
                    ...EMPTY_FORM_ITEM,
                    category_id: submittedForm.category_id,
                    product_id: submittedForm.product_id
                });
                await clearCacheOrderDetail(order_id);
                loadOrderData();
                notifyOrderUpdate();

                focusNextField();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Terjadi kesalahan sistem.";
            setAlertConfig({ show: true, type: "error", message: errorMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteItem = useCallback(async (itemId) => {
        try {
            const payload = new FormData();
            payload.append("order_item_id", itemId);
            await api.post("", payload, { params: { action: "delete_order_item" } });
            await clearCacheOrderDetail(order_id);
            loadOrderData();
            notifyOrderUpdate();
        } catch (err) {}
    }, [order_id, loadOrderData, notifyOrderUpdate]);

    const handleOpenMaklun = useCallback((row) => {
        setMaklunData({
            order_item_id: row.order_item_id,
            store_id: row.store_id || ""
        });
        setMaklunModalOpen(true);
    }, []);

    const handleMaklunSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", order_id);
            payload.append("order_item_id", maklunData.order_item_id);
            payload.append("store_id", maklunData.store_id);
            await api.post("", payload, { params: { action: "update_maklun" } });
            setMaklunModalOpen(false);
            await clearCacheOrderDetail(order_id);
            loadOrderData();
            notifyOrderUpdate();
        } catch (err) {}
    };

    const handleUpdateNote = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", order_id);
            payload.append("note", noteInput);
            await api.post("", payload, { params: { action: "update_customer_note" } });
            await clearCacheOrderDetail(order_id);
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
            laser_product_id: row.laser_product_id?.toString() || "",
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

    const handleRowSelect = useCallback((row) => {
        setSelectedItemId(row.order_item_id);
    }, []);

    useEffect(() => {
        function handleKeyDown(e) {
            if (e.ctrlKey && e.key.toLowerCase() === "b") {
                e.preventDefault();
                navigate("/orders");
                return;
            }

            if (e.altKey && /^[0-9]$/.test(e.key)) {
                e.preventDefault();
                const idx = e.key === "0" ? 9 : Number(e.key) - 1;
                const row = visibleRows[idx];
                if (row) setSelectedItemId(row.order_item_id);
                return;
            }

            if (e.altKey && e.key.toLowerCase() === "m") {
                e.preventDefault();
                const row = visibleRows.find(r => r.order_item_id === selectedItemId);
                if (row) handleOpenMaklun(row);
                return;
            }

            if (e.altKey && e.key === "Delete") {
                e.preventDefault();

                if (selectedItemId) {
                    handleDeleteItem(selectedItemId);
                    setSelectedItemId(null);
                    return;
                }

                if (initialFormItem.order_item_id) {
                    handleDeleteItem(initialFormItem.order_item_id);
                    handleCancelEdit();
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [navigate, visibleRows, selectedItemId, handleOpenMaklun, initialFormItem.order_item_id, handleDeleteItem, handleCancelEdit]);

    const storeOptions = useMemo(() => stores.map(s => ({ value: s.store_id, label: s.name })), [stores]);

    const tableColumns = useMemo(() => [
        { key: "judul", title: "Product", render: row => <>{row.judul}{row.laser_material_name && <small style={{ display: "block", color: "var(--text-secondary)" }}>Bahan: {row.laser_material_name}</small>}{row.tier_pricing?.price != null && <small style={{ display: "block", color: "var(--text-secondary)" }}>Harga dasar bertingkat: {formatRupiah(row.tier_pricing.price)}/{tierUnitLabel(row.tier_pricing)}</small>}</> },
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
    ), [handleDeleteItem]);

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

            <div style={{ display: "flex", gap: "24px", marginTop: "20px", alignItems: "flex-start" }}>
                <div style={{ width: "30%", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div style={{ background: "color-mix(in srgb, var(--background) 10%, transparent)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                        <h3 style={{ marginBottom: "16px" }}>{initialFormItem.order_item_id ? "Edit Item" : "Form Item"}</h3>
                        <OrderItemForm
                            initialData={initialFormItem}
                            isSubmitting={isSubmitting}
                            onSubmit={handleAddItem}
                            onChange={(currentFormItem) => setActiveFormItem(currentFormItem)}
                            submitText={initialFormItem.order_item_id ? "Update Item" : "Tambah Item"}
                            submitIcon={initialFormItem.order_item_id ? "edit" : "add"}
                            submitVariant={initialFormItem.order_item_id ? "warning" : "success"}
                            showCancel={!!initialFormItem.order_item_id}
                            onCancel={handleCancelEdit}
                        >
                            <div style={{ padding: "12px", background: "color-mix(in srgb, var(--background) 30%, transparent)", borderRadius: "var(--radius)", marginBottom: "16px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: "bold", fontSize: "14px", color: "var(--text)" }}>Estimasi Harga:</span>
                                <span style={{ fontWeight: "bold", color: "var(--success)", fontSize: "16px" }}>
                                    {formatRupiah(previewPrice)}
                                </span>
                            </div>
                            {previewTier?.price != null && <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                                Harga dasar bertingkat: {formatRupiah(previewTier.price)}/{tierUnitLabel(previewTier)}.
                                {' '}Total produk di nota: {Number(previewTier.quantity).toLocaleString('id-ID', { maximumFractionDigits: 8 })} {tierUnitLabel(previewTier)}.
                            </p>}
                        </OrderItemForm>
                    </div>

                    <div style={{ backgroundColor: "color-mix(in srgb, var(--bg-content) 30%, transparent)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                        <h3 style={{ marginBottom: "16px" }}>Catatan Pesanan</h3>
                        {orderInfo.note && (
                            <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "rgba(var(--warning-rgb), 0.1)", color: "var(--warning)", borderRadius: "var(--radius)", borderLeft: "4px solid var(--warning)" }}>
                                {orderInfo.note}
                            </div>
                        )}
                        <Form id="formUpdateNote" onSubmit={handleUpdateNote}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <Input
                                    name="noteInput"
                                    placeholder="Tulis catatan pesanan di sini..."
                                    value={noteInput}
                                    onChange={(e) => setNoteInput(e.target.value)}
                                />
                                <Button type="submit" size="full-lg" variant="primary" icon={<Icon name="save" />}>
                                    Simpan Catatan
                                </Button>
                            </div>
                        </Form>
                    </div>
                </div>

                <div style={{ width: "70%" }}>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "20px" }}>
                        <div style={{ background: "var(--background)", padding: "12px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Nomorator</div>
                            <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text)" }}>{orderMeta.nomorator || "-"}</div>
                        </div>
                        <div style={{ background: "var(--background)", padding: "12px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Nama Customer</div>
                            <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text)" }}>{orderMeta.customer_name || "-"}</div>
                        </div>
                        <div style={{ background: "var(--background)", padding: "12px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Dibuat</div>
                            <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text)" }}>{formatTime(orderMeta.date) || "-"}</div>
                        </div>
                        <div style={{ background: "var(--background)", padding: "12px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Deadline</div>
                            <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--warning)" }}>{formatTime(orderMeta.deadline) || "-"}</div>
                        </div>
                        <div style={{ background: "var(--background)", padding: "12px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Operator</div>
                            <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--primary)" }}>{orderMeta.operator_initial || "-"}</div>
                        </div>
                    </div>

                    <div style={{ backgroundColor: "color-mix(in srgb, var(--bg-content) 30%, transparent)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                        <h3 style={{ marginBottom: "16px" }}>Daftar Item</h3>
                        <Table
                            id="tableOrderItems"
                            showNumber
                            size="md"
                            rowKey="order_item_id"
                            rowDataKey="order_item_id"
                            columns={tableColumns}
                            rows={tableDataMapped}
                            actions={tableActions}
                            onRowDoubleClick={handleRowDoubleClick}
                            onRowSelect={handleRowSelect}
                            selectedRowKey={selectedItemId}
                            onVisibleRowsChange={setVisibleRows}
                        />

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--border)", alignItems: "center"}}>
                            <div>
                                <h4 style={{ margin: "0 0 8px 0" }}>Diskon Produk:</h4>
                                {productDiscounts.length > 0 ? (
                                    <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text)" }}>
                                        {productDiscounts.map((discount, index) => (
                                            <li key={discount.product_id ?? index} style={{ marginBottom: "8px" }}>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span>{discount.product_name || 'Produk tanpa nama'}: <strong style={{ color: 'var(--danger)' }}>{formatRupiah(discount.discount)}</strong></span>
                                                    {discount.product_id && (
                                                        <span title={Number(discount.can_delete) !== 1 ? 'Hapus semua item produk ini dari order terlebih dahulu.' : 'Hapus diskon produk dari order ini'}>
                                                            <Button variant="danger" size="sm" disabled={Number(discount.can_delete) !== 1 || deletingDiscountProduct !== null} onClick={() => handleDeleteDiscount(discount)}>
                                                                {String(deletingDiscountProduct) === String(discount.product_id) ? 'Menghapus...' : 'Hapus Diskon'}
                                                            </Button>
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span style={{ color: "var(--secondary)" }}>Tidak ada diskon</span>
                                )}
                                {productDiscounts.length > 0 && <small>Hapus semua item produk terkait dari order terlebih dahulu untuk menghapus diskonnya.</small>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <h5 style={{ margin: "0 0 4px 0", color: "var(--secondary)" }}>Total Bayar</h5>
                                <h2 style={{ margin: 0, color: "var(--success)" }}>
                                    {formatRupiah(orderInfo.total)}
                                </h2>
                            </div>
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
