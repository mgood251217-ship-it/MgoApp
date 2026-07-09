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
import { formatRupiah } from "../services/helpers";

export default function Order() {
    const { order_id } = useParams();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [orderInfo, setOrderInfo] = useState({
        total: 0,
        diskon_per_produk: {},
        note: ""
    });
    
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [finishings, setFinishings] = useState([]);
    const [stores, setStores] = useState([]);

    const [noteInput, setNoteInput] = useState("");
    const [previewPrice, setPreviewPrice] = useState(0);

    const [formItem, setFormItem] = useState({
        order_item_id: "",
        category_id: "",
        product_id: "",
        panjang: "",
        lebar: "",
        qty: "",
        diskon: "",
        finishings: [],
        kiloan: "",
        waktu: "",
        ukuranJersey: "",
        size: ""
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

    const loadCategories = useCallback(async () => {
        try {
            const res = await api.get("", { params: { action: "categories" } });
            setCategories(res.data?.data || []);
        } catch (err) {}
    }, []);

    const loadStores = useCallback(async () => {
        try {
            const res = await api.get("", { params: { action: "store_names" } });
            setStores(res.data?.data || []);
        } catch (err) {}
    }, []);

    useEffect(() => {
        loadOrderData();
        loadCategories();
        loadStores();
    }, [loadOrderData, loadCategories, loadStores]);

    useEffect(() => {
        const fetchProductsAndFinishings = async () => {
            if (!formItem.category_id) {
                setProducts([]);
                setFinishings([]);
                return;
            }
            try {
                const resProducts = await api.get("", {
                    params: { action: "products_by_category", category_id: formItem.category_id }
                });
                setProducts(resProducts.data?.data || []);

                const resFinishings = await api.get("", {
                    params: { action: "finishing_by_category", category_id: formItem.category_id }
                });
                setFinishings(resFinishings.data?.data || []);
            } catch (err) {}
        };
        fetchProductsAndFinishings();
    }, [formItem.category_id]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormItem(prev => ({ ...prev, [name]: value }));
    };

    const handleFinishingChange = (e) => {
        const { value, checked } = e.target;
        setFormItem(prev => {
            const newFinishings = checked
                ? [...prev.finishings, value]
                : prev.finishings.filter(f => f !== value);
            return { ...prev, finishings: newFinishings };
        });
    };

    const selectedCategory = categories.find(c => String(c.category_id) === String(formItem.category_id));
    const selectedCategoryName = selectedCategory?.name?.toUpperCase() || "";
    
    const selectedProduct = products.find(p => String(p.product_id) === String(formItem.product_id));
    const selectedProductName = selectedProduct?.name?.toUpperCase() || "";

    const isDTF = selectedCategoryName === "DTF";
    const isAkrilik = selectedCategoryName === "AKRILIK";
    const isJersey = selectedCategoryName === "JERSEY";
    const isSublim = selectedCategoryName === "SUBLIM";
    
    const isSetting = selectedProductName === "SETTING";
    const isBahan = selectedProductName.includes("BAHAN");
    const isTransferPaperOrPrintPres = selectedProductName.includes("TRANSFERPAPER") || selectedProductName.includes("PRINT PRES");

    const hideFinishing = ["PAKET INDOOR OUTDOOR", "STAMP", "MERCENDISE", "MERCENDISE AKRILIK"].includes(selectedCategoryName);

    useEffect(() => {
        if (isDTF && formItem.lebar !== "0.58") {
            setFormItem(prev => ({ ...prev, lebar: "0.58" }));
        }
    }, [isDTF, formItem.lebar]);

    useEffect(() => {
        const getPrice = async () => {
            if (!formItem.product_id || !formItem.qty) {
                setPreviewPrice(0);
                return;
            }
            try {
                const payload = new FormData();
                payload.append("order_id", order_id);
                payload.append("product_id", formItem.product_id);
                payload.append("judul", selectedProductName);
                payload.append("quantity", formItem.qty || 0);
                payload.append("finishing", formItem.finishings.join(","));
                payload.append("panjang", formItem.panjang || 0);
                payload.append("lebar", formItem.lebar || 0);
                payload.append("kiloan", formItem.kiloan || 0);
                payload.append("waktu", formItem.waktu || 0);
                payload.append("ukuranJersey", formItem.ukuranJersey || "");
                payload.append("diskon", formItem.diskon || 0);
                payload.append("size", formItem.size || formItem.ukuranJersey || "");

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
    }, [formItem, order_id, selectedProductName]);

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", order_id);
            if (formItem.order_item_id) payload.append("order_item_id", formItem.order_item_id);
            
            payload.append("product_id", formItem.product_id);
            payload.append("judul", selectedProductName);
            payload.append("quantity", formItem.qty || 0);
            payload.append("finishing", formItem.finishings.join(","));
            payload.append("panjang", formItem.panjang || 0);
            payload.append("lebar", formItem.lebar || 0);
            payload.append("kiloan", formItem.kiloan || 0);
            payload.append("waktu", formItem.waktu || 0);
            payload.append("ukuranJersey", formItem.ukuranJersey || "");
            payload.append("diskon", formItem.diskon || 0);
            payload.append("size", formItem.size || formItem.ukuranJersey || "");

            const endpointAction = formItem.order_item_id ? "update_item" : "create_order_item";

            await api.post("", payload, { params: { action: endpointAction } });
            
            setFormItem({
                order_item_id: "",
                category_id: "",
                product_id: "",
                panjang: "",
                lebar: "",
                qty: "",
                diskon: "",
                finishings: [],
                kiloan: "",
                waktu: "",
                ukuranJersey: "",
                size: ""
            });
            
            loadOrderData();
            focusCategoryField();
        } catch (err) {}
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
        const formEl = document.getElementById("formAddItem");
        
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

        setFormItem({
            order_item_id: row.order_item_id,
            category_id: row.category_id || formItem.category_id, 
            product_id: row.product_id || "",
            panjang: p,
            lebar: w,
            qty: row.quantity || "",
            diskon: row.diskon || "",
            finishings: currentFinishings,
            kiloan: row.kiloan || "",
            waktu: row.waktu || "",
            ukuranJersey: row.size || "",
            size: row.size || ""
        });

        if (formEl) {
            window.scrollTo({
                top: formEl.offsetTop - 100,
                behavior: 'smooth'
            });
        }
    };

    const categoryOptions = useMemo(() => {
        return categories.map(c => ({ value: c.category_id, label: c.name }));
    }, [categories]);

    const productOptions = useMemo(() => {
        return products.map(p => ({ value: p.product_id, label: p.name }));
    }, [products]);

    const storeOptions = useMemo(() => {
        return stores.map(s => ({ value: s.store_id, label: s.name }));
    }, [stores]);

    const jerseySizeOptions = [
        { value: 'XS', label: 'XS' },
        { value: 'S', label: 'S' },
        { value: 'M', label: 'M' },
        { value: 'L', label: 'L' },
        { value: 'XL', label: 'XL' },
        { value: '2XL', label: '2XL' },
        { value: '3XL', label: '3XL' },
        { value: '4XL', label: '4XL' },
        { value: '5XL', label: '5XL' }
    ];

    const sublimLebarOptions = [
        { value: "1.1", label: "1.1" },
        { value: "1.2", label: "1.2" },
        { value: "1.5", label: "1.5" },
        { value: "1.6", label: "1.6" },
        { value: "1.8", label: "1.8" }
    ];

    const tableColumns = useMemo(() => [
        { key: "product_name", title: "Product" },
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
                Maklun
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
                    <h3 style={{ marginBottom: "16px" }}>{formItem.order_item_id ? "Edit Item" : "Form Item"}</h3>
                    <Form id="formAddItem" onSubmit={handleAddItem}>
                        <div id="categorySelectField" tabIndex={-1} style={{ outline: "none" }}>
                            <Select
                                labelPosition="left"
                                labelWidth={110}
                                name="category_id"
                                label="Kategori"
                                value={formItem.category_id}
                                onChange={handleFormChange}
                                options={categoryOptions}
                                placeholder="Pilih Kategori"
                                required
                            />
                        </div>
                        <Select
                            labelPosition="left"
                            labelWidth={110}
                            name="product_id"
                            label="Produk"
                            value={formItem.product_id}
                            onChange={handleFormChange}
                            options={productOptions}
                            placeholder="Pilih Produk"
                            required
                        />
                        
                        <div style={{ marginBottom: "16px" }}>
                            {isSetting ? (
                                <Input
                                    labelPosition="left"
                                    labelWidth={110}
                                    name="waktu"
                                    type="number"
                                    step="any"
                                    label="Waktu"
                                    placeholder="Waktu pengerjaan..."
                                    value={formItem.waktu}
                                    onChange={handleFormChange}
                                />
                            ) : (isSublim && isBahan) ? (
                                <Input
                                    labelPosition="left"
                                    labelWidth={110}
                                    name="kiloan"
                                    type="number"
                                    step="any"
                                    label="Kiloan"
                                    placeholder="Berat (kg)..."
                                    value={formItem.kiloan}
                                    onChange={handleFormChange}
                                />
                            ) : isJersey ? (
                                <Select
                                    labelPosition="left"
                                    labelWidth={110}
                                    name="ukuranJersey"
                                    label="Ukuran"
                                    value={formItem.ukuranJersey}
                                    onChange={handleFormChange}
                                    options={jerseySizeOptions}
                                    placeholder="Pilih Ukuran"
                                />
                            ) : (
                                <div>
                                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
                                        Ukuran (P x L)
                                    </label>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div style={{ flex: 1 }}>
                                            <Input
                                                name="panjang"
                                                type="number"
                                                step="any"
                                                placeholder={isAkrilik ? "Panjang (cm)" : "Panjang (m)"}
                                                value={formItem.panjang}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                        <span style={{ fontWeight: "bold", color: "var(--secondary)" }}>X</span>
                                        <div style={{ flex: 1 }}>
                                            {(isSublim && isTransferPaperOrPrintPres) ? (
                                                <Select
                                                    name="lebar"
                                                    value={formItem.lebar}
                                                    onChange={handleFormChange}
                                                    options={sublimLebarOptions}
                                                    placeholder="Pilih Lebar"
                                                />
                                            ) : (
                                                <Input
                                                    name="lebar"
                                                    type="number"
                                                    step="any"
                                                    placeholder={isAkrilik ? "Lebar (cm)" : "Lebar (m)"}
                                                    value={formItem.lebar}
                                                    onChange={isDTF ? undefined : handleFormChange}
                                                    readOnly={isDTF}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Input
                            labelPosition="left"
                            labelWidth={110}
                            name="qty"
                            type="number"
                            label="Quantity"
                            value={formItem.qty}
                            onChange={handleFormChange}
                            required
                        />

                        {!hideFinishing && finishings.length > 0 && (
                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
                                    Finishing
                                </label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "12px", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--bg-body)" }}>
                                    {finishings.map((f) => (
                                        <label key={f.finishing_id} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
                                            <input
                                                type="checkbox"
                                                value={f.finishing_id}
                                                checked={formItem.finishings.includes(String(f.finishing_id))}
                                                onChange={handleFinishingChange}
                                            />
                                            {f.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Input
                            labelPosition="left"
                            labelWidth={110}
                            name="diskon"
                            type="number"
                            label="Diskon"
                            value={formItem.diskon}
                            onChange={handleFormChange}
                        />

                        {/* Kalkulasi Live Preview Harga */}
                        <div style={{ padding: "12px", backgroundColor: "var(--bg-body)", borderRadius: "6px", marginBottom: "16px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "bold", fontSize: "14px", color: "var(--text)" }}>Estimasi Harga:</span>
                            <span style={{ fontWeight: "bold", color: "var(--success)", fontSize: "16px" }}>
                                {formatRupiah(previewPrice)}
                            </span>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <Button type="submit" size="full-lg" variant={formItem.order_item_id ? "warning" : "success"} icon={<Icon name={formItem.order_item_id ? "edit" : "add"} />}>
                                {formItem.order_item_id ? "Update Item" : "Tambah Item"}
                            </Button>
                            {formItem.order_item_id && (
                                <Button 
                                    type="button" 
                                    size="full-lg" 
                                    variant="secondary" 
                                    onClick={() => setFormItem({
                                        order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "", qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", size: ""
                                    })}
                                >
                                    Batal
                                </Button>
                            )}
                        </div>
                    </Form>
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