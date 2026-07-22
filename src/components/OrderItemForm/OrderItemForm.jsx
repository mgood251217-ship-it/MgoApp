import { useEffect, useState, useCallback, useMemo } from "react";
import api from "../../api/axios";
import Input from "../Input/Input";
import Select from "../Select/Select";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";

export default function OrderItemForm({ 
    initialData,
    onSubmit,
    onChange,
    isSubmitting,
    submitText = "Simpan Item",
    submitIcon = "save",
    submitVariant = "primary",
    onCancel,
    showCancel = false,
    children
}) {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [paketSizesMap, setPaketSizesMap] = useState({});
    const [finishings, setFinishings] = useState([]);

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
        paketSize: "",
        size: "",
        ...initialData
    });

    useEffect(() => {
        if (initialData) {
            setFormItem(prev => ({ ...prev, ...initialData }));
        }
    }, [initialData]);

    useEffect(() => {
        if (onChange) onChange(formItem);
    }, [formItem, onChange]);

    const loadCategories = useCallback(async () => {
        try {
            const res = await api.get("", { params: { action: "categories" } });
            setCategories(res.data?.data || []);
        } catch (err) {}
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const selectedCategory = categories.find(c => String(c.category_id) === String(formItem.category_id));
    const selectedCategoryName = selectedCategory?.name?.toUpperCase() || "";

    useEffect(() => {
        const fetchProductsAndFinishings = async () => {
            if (!formItem.category_id) {
                setProducts([]);
                setFinishings([]);
                setPaketSizesMap({});
                return;
            }
            try {
                const resProducts = await api.get("", {
                    params: { action: "products_by_category", category_id: formItem.category_id }
                });
                
                const fetchedProducts = resProducts.data?.data || [];
                let mappedProducts = [];
                let sizesMap = {};

                if (selectedCategoryName === "PAKET INDOOR OUTDOOR") {
                    const seen = new Set();
                    fetchedProducts.forEach(p => {
                        let nameOnly = p.name.replace(/\s*\d+(\.\d+)?\s*[x×X]\s*\d+(\.\d+)?/gi, '').trim();
                        const ukuranMatch = p.name.match(/(\d+(\.\d+)?\s*[x×X]\s*\d+(\.\d+)?)/i);
                        const ukuran = ukuranMatch ? ukuranMatch[0].replace(/×/gi, 'x') : null;

                        if (!sizesMap[nameOnly]) sizesMap[nameOnly] = [];
                        if (ukuran && !sizesMap[nameOnly].includes(ukuran)) {
                            sizesMap[nameOnly].push(ukuran);
                        }

                        if (!seen.has(nameOnly)) {
                            seen.add(nameOnly);
                            mappedProducts.push({ ...p, display_name: nameOnly });
                        }
                    });
                } else {
                    mappedProducts = fetchedProducts.map(p => ({ ...p, display_name: p.name }));
                }

                setProducts(mappedProducts);
                setPaketSizesMap(sizesMap);

                const resFinishings = await api.get("", {
                    params: { action: "finishing_by_category", category_id: formItem.category_id }
                });
                setFinishings(resFinishings.data?.data || []);
            } catch (err) {}
        };
        fetchProductsAndFinishings();
    }, [formItem.category_id, selectedCategoryName]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormItem(prev => ({ ...prev, [name]: value }));
    };

    const handlePaketSizeChange = (e) => {
        const val = e.target.value;
        setFormItem(prev => {
            const next = { ...prev, paketSize: val };
            if (val && val.includes('x')) {
                const parts = val.split('x').map(s => parseFloat(s.trim()));
                next.panjang = parts[0];
                next.lebar = parts[1];
            }
            return next;
        });
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

    const selectedProduct = products.find(p => String(p.product_id) === String(formItem.product_id));
    const selectedProductName = selectedProduct?.display_name?.toUpperCase() || selectedProduct?.name?.toUpperCase() || "";
    
    const isNoSize = selectedProduct?.unit_type?.toUpperCase() === "PCS" || selectedProduct?.unit_type === "~";

    const isDTF = selectedCategoryName === "DTF";
    const isAkrilik = selectedCategoryName === "AKRILIK";
    const isJersey = selectedCategoryName === "JERSEY";
    const isSublim = selectedCategoryName === "SUBLIM";
    const isPaketIndoorOutdoor = selectedCategoryName === "PAKET INDOOR OUTDOOR";
    
    const isSetting = selectedProductName === "SETTING";
    const isBahan = selectedProductName.includes("BAHAN");
    const isTransferPaperOrPrintPres = selectedProductName.includes("TRANSFERPAPER") || selectedProductName.includes("PRINT PRES");

    const hideFinishing = ["PAKET INDOOR OUTDOOR", "STAMP", "MERCENDISE", "MERCENDISE AKRILIK"].includes(selectedCategoryName);

    useEffect(() => {
        if (isDTF && formItem.lebar !== "0.58") {
            setFormItem(prev => ({ ...prev, lebar: "0.58" }));
        }
    }, [isDTF, formItem.lebar]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSubmit) {
            onSubmit({ ...formItem, selectedProductName }); 
        }
    };

    const categoryOptions = useMemo(() => categories.map(c => ({ value: c.category_id, label: c.name })), [categories]);
    const productOptions = useMemo(() => products.map(p => ({ value: p.product_id, label: p.display_name })), [products]);
    const jerseySizeOptions = [
        { value: 'XS', label: 'XS' }, { value: 'S', label: 'S' }, { value: 'M', label: 'M' },
        { value: 'L', label: 'L' }, { value: 'XL', label: 'XL' }, { value: '2XL', label: '2XL' },
        { value: '3XL', label: '3XL' }, { value: '4XL', label: '4XL' }, { value: '5XL', label: '5XL' }
    ];
    const sublimLebarOptions = [
        { value: "1.1", label: "1.1" }, { value: "1.2", label: "1.2" },
        { value: "1.5", label: "1.5" }, { value: "1.6", label: "1.6" }, { value: "1.8", label: "1.8" }
    ];

    return (
        <form onSubmit={handleSubmit}>
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
                onChange={(e) => {
                    handleFormChange(e);
                    setTimeout(() => {
                        const pId = e.target.value;
                        const prod = products.find(p => String(p.product_id) === String(pId));
                        const pName = (prod?.display_name || prod?.name || "").toUpperCase();
                        const pUnit = prod?.unit_type?.toUpperCase();
                        const noSizeCheck = pUnit === "PCS" || pUnit === "~";

                        if (pName === "SETTING") {
                            document.querySelector('input[name="waktu"]')?.focus();
                        } else if (selectedCategoryName === "SUBLIM" && pName.includes("BAHAN")) {
                            document.querySelector('input[name="kiloan"]')?.focus();
                        } else if (selectedCategoryName === "JERSEY") {
                            document.querySelector('select[name="ukuranJersey"]')?.focus();
                        } else if (noSizeCheck) {
                            document.querySelector('input[name="qty"]')?.focus();
                        } else {
                            document.querySelector('input[name="panjang"]')?.focus();
                        }
                    }, 100);
                }}
                options={productOptions}
                placeholder="Pilih Produk"
                required
            />

            {isPaketIndoorOutdoor && paketSizesMap[selectedProductName]?.length > 0 && (
                <Select
                    labelPosition="left"
                    labelWidth={110}
                    name="paketSize"
                    label="Ukuran Paket"
                    value={formItem.paketSize}
                    onChange={handlePaketSizeChange}
                    options={paketSizesMap[selectedProductName].map(s => ({ value: s, label: s }))}
                    placeholder="Pilih Ukuran"
                />
            )}
            
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
                ) : isNoSize ? null : (
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
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            document.querySelector('input[name="lebar"]')?.focus();
                                        }
                                    }}
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
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                document.querySelector('input[name="qty"]')?.focus();
                                            }
                                        }}
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

            {children}

            <div style={{ display: "flex", gap: "8px" }}>
                <Button type="submit" size="full-lg" variant={submitVariant} disabled={isSubmitting} icon={<Icon name={isSubmitting ? "hourglass_empty" : submitIcon} />}>
                    {isSubmitting ? "Loading..." : submitText}
                </Button>
                {showCancel && onCancel && (
                    <Button 
                        type="button" 
                        size="full-lg" 
                        variant="secondary" 
                        onClick={() => {
                            setFormItem({ order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "", qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", paketSize: "", size: "" });
                            onCancel();
                        }}
                    >
                        Batal
                    </Button>
                )}
            </div>
        </form>
    );
}