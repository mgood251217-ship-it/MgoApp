import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Input from "../Input/Input";
import Select from "../Select/Select";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import { 
    getCachedCategories, 
    getCachedProductsByCategory, 
    getCachedFinishingsByCategory,
    getCachedProductFinishingPrices
} from "../../services/apiCache";

const EMPTY_ITEM = {
    order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "",
    qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "",
    paketSize: "", size: ""
};

const normalizeId = value => value?.toString() ?? value;

const focusField = (fieldName, delay = 100) => {
    if (!fieldName) return;
    setTimeout(() => {
        const el = document.querySelector(`[name="${fieldName}"]`);
        if (!el) return;

        el.focus();

        if (el.tagName === "BUTTON") {
            el.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "ArrowDown",
                    bubbles: true,
                    cancelable: true,
                })
            );
        }
    }, delay);
};

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
    const [allFinishings, setFinishings] = useState([]);
    const [packageRules, setPackageRules] = useState([]);
    const finishingRefs = useRef([]);
    const isFirstRenderRef = useRef(true);

    const [formItem, setFormItem] = useState({ ...EMPTY_ITEM, ...initialData });

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
            const data = await getCachedCategories(setCategories);
            setCategories(data);
        } catch (err) {}
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    const selectedCategory = categories.find(c => normalizeId(c.category_id) === normalizeId(formItem.category_id));
    const selectedCategoryName = selectedCategory?.name?.toUpperCase() || "";

    const categoryPackageRules = useMemo(() => packageRules.filter(rule => normalizeId(rule.category_id) === normalizeId(formItem.category_id)), [packageRules, formItem.category_id]);
    const packageFinishingIds = useMemo(() => [
        ...categoryPackageRules.map(rule => normalizeId(rule.finishing_id)),
        ...allFinishings.filter(f => ["INDOOR", "OUTDOOR"].includes(selectedCategoryName) && ["XBANNER", "ROLLUP"].includes(f.name?.trim().toUpperCase()) && parseFloat(f.price || 0) === 0).map(f => normalizeId(f.finishing_id)),
    ], [categoryPackageRules, allFinishings, selectedCategoryName]);
    const productPackageRules = useMemo(() => categoryPackageRules.filter(rule => parseFloat(rule.valid || 0) === 1 && normalizeId(rule.product_id) === normalizeId(formItem.product_id)), [categoryPackageRules, formItem.product_id]);
    const finishings = allFinishings.filter(f => {
        return !packageFinishingIds.includes(normalizeId(f.finishing_id)) || formItem.finishings.includes(normalizeId(f.finishing_id))
            || productPackageRules.some(rule => normalizeId(rule.finishing_id) === normalizeId(f.finishing_id));
    });
    const packageChoices = useMemo(() => productPackageRules.filter(rule => formItem.finishings.includes(normalizeId(rule.finishing_id))), [productPackageRules, formItem.finishings]);
    const hasPackageFinishing = formItem.finishings.some(id => packageFinishingIds.includes(normalizeId(id)));
    const selectedPackage = packageChoices.find(rule => (parseFloat(rule.panjang || 0) === 0 && parseFloat(rule.lebar || 0) === 0)
        || (parseFloat(rule.panjang || 0) === parseFloat(formItem.panjang || 0) && parseFloat(rule.lebar || 0) === parseFloat(formItem.lebar || 0)));
    const packageNeedsSize = packageChoices.some(rule => parseFloat(rule.panjang || 0) > 0 && parseFloat(rule.lebar || 0) > 0);

    useEffect(() => {
        let cancelled = false;
        setPackageRules([]);
        if (!["INDOOR", "OUTDOOR", "LASER", "LASER A3"].includes(selectedCategoryName)) return;
        const apply = rows => { if (!cancelled) setPackageRules(rows); };
        getCachedProductFinishingPrices(formItem.category_id, apply).then(apply);
        return () => { cancelled = true; };
    }, [formItem.category_id, selectedCategoryName]);

    useEffect(() => {
        if (!packageChoices.length) return;
        setFormItem(prev => {
            const rule = packageChoices.find(row => parseFloat(row.panjang || 0) === parseFloat(prev.panjang || 0) && parseFloat(row.lebar || 0) === parseFloat(prev.lebar || 0))
                || (packageChoices.length === 1 ? packageChoices[0] : null);
            const sized = rule && parseFloat(rule.panjang || 0) > 0 && parseFloat(rule.lebar || 0) > 0;
            const panjang = sized ? parseFloat(rule.panjang).toString() : "";
            const lebar = sized ? parseFloat(rule.lebar).toString() : "";
            const size = rule ? (sized ? `${panjang}x${lebar}` : "-") : "";
            return prev.panjang === panjang && prev.lebar === lebar && prev.size === size ? prev : { ...prev, panjang, lebar, size };
        });
    }, [packageChoices]);

    useEffect(() => {
        let cancelled = false;
        const fetchProductsAndFinishings = async () => {
            if (!formItem.category_id) {
                setProducts([]);
                setFinishings([]);
                setPaketSizesMap({});
                return;
            }
            try {
                const applyProducts = (fetchedProducts) => {
                    if (cancelled) return;
                
                    let mappedProducts = [];
                    let sizesMap = {};

                    if (selectedCategoryName === "PAKET INDOOR OUTDOOR") {
                        const seen = [];
                        fetchedProducts.forEach(p => {
                            let nameOnly = p.name.replace(/\s*\d+(\.\d+)?\s*[x×X]\s*\d+(\.\d+)?/gi, '').trim();
                            const ukuranMatch = p.name.match(/(\d+(\.\d+)?\s*[x×X]\s*\d+(\.\d+)?)/i);
                            const ukuran = ukuranMatch ? ukuranMatch[0].replace(/×/gi, 'x') : null;

                            if (!sizesMap[nameOnly]) sizesMap[nameOnly] = [];
                            if (ukuran && !sizesMap[nameOnly].includes(ukuran)) {
                                sizesMap[nameOnly].push(ukuran);
                            }

                            if (!seen.includes(nameOnly)) {
                                seen.push(nameOnly);
                                mappedProducts.push({ ...p, display_name: nameOnly });
                            }
                        });
                    } else {
                        mappedProducts = fetchedProducts.map(p => ({ ...p, display_name: p.name }));
                    }

                    setProducts(mappedProducts);
                    setPaketSizesMap(sizesMap);
                };
                const fetchedProducts = await getCachedProductsByCategory(formItem.category_id, applyProducts);
                applyProducts(fetchedProducts);
                if (cancelled) return;

                const applyFinishings = rows => { if (!cancelled) setFinishings(rows); };
                const fetchedFinishings = await getCachedFinishingsByCategory(formItem.category_id, applyFinishings);
                applyFinishings(fetchedFinishings);
            } catch (err) {}
        };
        fetchProductsAndFinishings();
        return () => { cancelled = true; };
    }, [formItem.category_id, selectedCategoryName]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormItem(prev => ({ ...prev, [name]: value }));
    };

    const handleCategoryChange = (e) => {
        const category_id = e.target.value;
        setFormItem(prev => ({ ...prev, category_id, product_id: "", finishings: [], paketSize: "", size: "" }));
        focusField("product_id");
    };

    const resolveNextFieldAfterProduct = (pId) => {
        const prod = products.find(p => normalizeId(p.product_id) === normalizeId(pId));
        const pName = (prod?.display_name || prod?.name || "").toUpperCase();
        const pUnit = prod?.unit_type?.toUpperCase();
        const noSizeCheck = pUnit === "PCS" || pUnit === "~";

        if (selectedCategoryName === "PAKET INDOOR OUTDOOR" && paketSizesMap[pName]?.length > 0) {
            return "paketSize";
        }
        if (pName === "SETTING" || pName === "POTONG AKRILIK") {
            return "waktu";
        }
        if (selectedCategoryName === "SUBLIM" && pName.includes("BAHAN") && pUnit !== "M2") {
            return "kiloan";
        }
        if (selectedCategoryName === "DTF" && pName.includes("KAOS") && pUnit === "PCS") {
            return "ukuranJersey";
        }
        if (selectedCategoryName === "JERSEY") {
            return "ukuranJersey";
        }
        if (noSizeCheck) {
            return "qty";
        }
        return "panjang";
    };

    const handleProductChange = (e) => {
        const product_id = e.target.value;
        setFormItem(prev => ({ ...prev, product_id, finishings: prev.finishings.filter(id => !packageFinishingIds.includes(normalizeId(id))), size: "", paketSize: "" }));
        focusField(resolveNextFieldAfterProduct(e.target.value));
    };

    useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }
        if (!initialData) return;

        if (!initialData.category_id) {
            focusField("category_id");
        } else if (!initialData.product_id) {
            focusField("product_id");
        } else {
            focusField(resolveNextFieldAfterProduct(initialData.product_id));
        }
    }, [initialData]);

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
        focusField("qty");
    };

    const handleFinishingChange = (e) => {
        const { value, checked } = e.target;
        setFormItem(prev => {
            const newFinishings = !checked ? prev.finishings.filter(f => f !== value)
            : packageFinishingIds.includes(value) ? [value]
            : [...prev.finishings.filter(id => !packageFinishingIds.includes(normalizeId(id))), value];
            return { ...prev, finishings: newFinishings };
        });
    };

    const toggleFinishingByIndex = (idx) => {
        const f = finishings[idx];
        if (!f) return;
        const fid = normalizeId(f.finishing_id);
        handleFinishingChange({ target: { value: fid, checked: !formItem.finishings.includes(fid) } });
    };

    const handleFinishingKeyDown = (e) => {
        const key = e.key;

        if (!e.ctrlKey && !e.altKey && !e.metaKey && /^[0-9]$/.test(key)) {
            const idx = key === "0" ? 9 : parseFloat(key) - 1;
            if (idx < finishings.length) {
                e.preventDefault();
                toggleFinishingByIndex(idx);
                finishingRefs.current[idx]?.focus();
            }
            return;
        }

        const currentIdx = finishingRefs.current.findIndex(el => el === document.activeElement);
        if (currentIdx === -1) return;

        if (key === "ArrowRight" || key === "ArrowDown") {
            e.preventDefault();
            const next = Math.min(currentIdx + 1, finishings.length - 1);
            finishingRefs.current[next]?.focus();
        } else if (key === "ArrowLeft" || key === "ArrowUp") {
            e.preventDefault();
            const prev = Math.max(currentIdx - 1, 0);
            finishingRefs.current[prev]?.focus();
        }
    };

    const selectedProduct = products.find(p => normalizeId(p.product_id) === normalizeId(formItem.product_id));
    const selectedProductName = selectedProduct?.display_name?.toUpperCase() || selectedProduct?.name?.toUpperCase() || "";
    
    const isNoSize = selectedProduct?.unit_type?.toUpperCase() === "PCS" || selectedProduct?.unit_type === "~";

    const isDTF = selectedCategoryName === "DTF";
    const isDTFUV = selectedCategoryName === "DTF UV";
    const isAkrilik = selectedCategoryName === "AKRILIK";
    const isJersey = selectedCategoryName === "JERSEY";
    const isDtfKaosPcs = isDTF && selectedProductName.includes("KAOS") && selectedProduct?.unit_type?.toUpperCase() === "PCS";
    const isSublim = selectedCategoryName === "SUBLIM";
    const isPaketIndoorOutdoor = selectedCategoryName === "PAKET INDOOR OUTDOOR";
    
    const isWaktu = selectedProductName === "SETTING" || selectedProductName === "POTONG AKRILIK";
    const isBahan = selectedProductName.includes("BAHAN");
    const isBahanM2 = isBahan && selectedProduct?.unit_type?.toUpperCase() === "M2";
    const isTransferPaperOrPrintPres = selectedProductName.includes("TRANSFERPAPER") || selectedProductName.includes("PRINT PRES");

    const hideFinishing = ["PAKET INDOOR OUTDOOR", "STAMP", "MERCENDISE", "MERCENDISE AKRILIK"].includes(selectedCategoryName);
    const showFinishing = !hideFinishing && finishings.length > 0;

    useEffect(() => {
        if ((isDTF || isDTFUV) && formItem.lebar !== "0.58") {
            setFormItem(prev => ({ ...prev, lebar: "0.58" }));
        }
    }, [isDTF, isDTFUV, formItem.lebar]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (hasPackageFinishing && !selectedPackage) return;
        if (onSubmit) {
            onSubmit({ ...formItem, selectedProductName }); 
        }
    };

    useEffect(() => {
        function handleKeyDown(e) {
            if (e.ctrlKey && e.key === "Enter") {
                e.preventDefault();
                handleSubmit(e);
                return;
            }

            if (e.altKey && e.key.toLowerCase() === "k") {
                e.preventDefault();
                focusField("category_id", 0);
                return;
            }

            if (e.altKey && e.key.toLowerCase() === "p") {
                e.preventDefault();
                focusField("product_id", 0);
                return;
            }

            if (e.altKey && e.key.toLowerCase() === "d") {
                e.preventDefault();
                focusField("diskon", 0);
                return;
            }

            if (e.key === "Escape" && showCancel && onCancel) {
                e.preventDefault();
                setFormItem({ ...EMPTY_ITEM });
                onCancel();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSubmit, showCancel, onCancel]);

    const categoryOptions = useMemo(() => categories.map(c => ({ value: c.category_id, label: c.name })), [categories]);
    const productOptions = useMemo(() => products.map(p => ({ value: p.product_id, label: p.display_name })), [products]);
    const jerseySizeOptions = [
        { value: 'XS', label: 'XS' }, { value: 'S', label: 'S' }, { value: 'M', label: 'M' },
        { value: 'L', label: 'L' }, { value: 'XL', label: 'XL' }, { value: '2XL', label: '2XL' },
        { value: '3XL', label: '3XL' }, { value: '4XL', label: '4XL' }, { value: '5XL', label: '5XL' }
    ];
    const sublimLebarOptions = [
        { value: "1.1", label: "1.1" }, { value: "1.2", label: "1.2" }, { value: "1.3", label: "1.3" },
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
                    onChange={handleCategoryChange}
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
                onChange={handleProductChange}
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

            {hasPackageFinishing && (
                <div>
                    {packageNeedsSize && (
                    <Select
                        labelPosition="left"
                        labelWidth={110}
                        name="packagePrice"
                        label="Ukuran Paket"
                        value={selectedPackage ? normalizeId(selectedPackage.id) : ""}
                        onChange={(e) => {
                            const rule = packageChoices.find(row => normalizeId(row.id) === e.target.value);
                            if (!rule) return;
                            const sized = parseFloat(rule.panjang || 0) > 0 && parseFloat(rule.lebar || 0) > 0;
                            const panjang = sized ? parseFloat(rule.panjang).toString() : "";
                            const lebar = sized ? parseFloat(rule.lebar).toString() : "";
                            setFormItem(prev => ({ ...prev, panjang, lebar, size: sized ? `${panjang}x${lebar}` : "-" }));
                        }}
                        options={packageChoices.map(rule => ({ value: normalizeId(rule.id), label: `${parseFloat(rule.panjang || 0)} × ${parseFloat(rule.lebar || 0)} m — Rp${parseFloat(rule.price || 0).toLocaleString("id-ID")}/set` }))}
                        placeholder="Pilih ukuran paket"
                        required
                    />
                    )}
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>{packageChoices.length ? `Harga paket sudah termasuk bahan dan finishing ${packageChoices[0].finishing_name}.${!packageNeedsSize ? ` Tanpa ukuran — Rp${parseFloat(packageChoices[0].price || 0).toLocaleString("id-ID")}/paket.` : ""}` : "Paket belum tersedia untuk bahan ini. Lepas finishing paket atau pilih bahan lain."}</p>
                </div>
            )}
            
            <div style={{ marginBottom: "16px" }}>
                {isWaktu ? (
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
                ) : (isSublim && isBahan && !isBahanM2) ? (
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
                ) : (isJersey || isDtfKaosPcs) ? (
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
                                    onChange={hasPackageFinishing ? undefined : handleFormChange}
                                    readOnly={hasPackageFinishing}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            focusField("lebar", 0);
                                        }
                                    }}
                                />
                            </div>
                            <span style={{ fontWeight: "bold", color: "var(--text)", marginBottom: "12px" }}>X</span>
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
                                        onChange={isDTF || isDTFUV || hasPackageFinishing ? undefined : handleFormChange}
                                        readOnly={isDTF || isDTFUV || hasPackageFinishing}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                focusField("qty", 0);
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
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.ctrlKey && showFinishing) {
                        e.preventDefault();
                        finishingRefs.current[0]?.focus();
                    }
                }}
                required
            />

            {showFinishing && (
                <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
                        Finishing
                    </label>
                    <div
                        onKeyDown={handleFinishingKeyDown}
                        style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                    >
                        {finishings.map((f, idx) => (
                            <label key={f.finishing_id} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px" }}>
                                <input
                                    type="checkbox"
                                    ref={(el) => (finishingRefs.current[idx] = el)}
                                    value={f.finishing_id}
                                    checked={formItem.finishings.includes(normalizeId(f.finishing_id))}
                                    onChange={handleFinishingChange}
                                />
                                {idx < 10 && (
                                    <span
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            minWidth: "16px",
                                            height: "16px",
                                            padding: "0 4px",
                                            borderRadius: "4px",
                                            background: "var(--border)",
                                            fontSize: "11px",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        {idx === 9 ? "0" : idx + 1}
                                    </span>
                                )}
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
                <Button type="submit" size="full-lg" variant={submitVariant} disabled={isSubmitting || (hasPackageFinishing && !selectedPackage)} icon={<Icon name={isSubmitting ? "hourglass_empty" : submitIcon} />}>
                    {isSubmitting ? "Loading..." : submitText}
                </Button>
                {showCancel && onCancel && (
                    <Button 
                        type="button" 
                        size="full-lg" 
                        variant="secondary" 
                        onClick={() => {
                            setFormItem({ ...EMPTY_ITEM });
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
