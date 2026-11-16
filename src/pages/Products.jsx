import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import api from "../api/axios";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Icon from "../components/Icon/Icon";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Pagination from "../components/Pagination/Pagination";
import Modal from "../components/Modal/Modal";
import Select from "../components/Select/Select";
import { formatRupiah } from "../services/helpers";
import { 
    getCachedCategories, 
    getCachedPaginatedProducts, 
    getCachedFinishings, 
    clearProductCache, 
    clearFinishingCache,
    getCachedProductVariants,
    getCachedProductFinishingPrices,
    getCachedProductBundles,
    getCachedProductLaserConversions
} from "../services/apiCache";

const numberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 8 });
const unitLabels = { PCS: "pcs", "~": "pcs", M2: "m\u00b2", CM2: "cm\u00b2" };
const detailTitles = { variants: "Varian Produk", tiers: "Harga Bertingkat", packages: "Harga Paket", laser: "Konversi Print Laser" };

function PriceTiers({ rules = [], unit }) {
    const unitLabel = unitLabels[unit] || unit;
    const columns = [
        { key: "quantity_above", title: "Jumlah", render: rule => `Lebih dari ${numberFormat.format(Number(rule.quantity_above))} ${unitLabel}` },
        { key: "price", title: `Harga / ${unitLabel}`, render: rule => formatRupiah(rule.price) }
    ];
    return <Table id="tableProductPriceTiers" columns={columns} rows={rules} rowKey="quantity_above" rowDataKey="quantity_above" showNumber size="lg" />;
}

function VariantPrices({ variants, unit }) {
    const unitLabel = unitLabels[unit] || unit;
    const columns = [
        {
            key: "label",
            title: "Varian",
            render: variant => Object.entries(variant.options || {}).length
                ? Object.entries(variant.options).map(([name, value]) => <div key={name}>{name}: <strong>{value}</strong></div>)
                : variant.label
        },
        { key: "price", title: `Harga / ${unitLabel}`, render: variant => formatRupiah(variant.price) },
        {
            key: "price_tiers",
            title: "Harga Bertingkat",
            render: variant => variant.price_tiers?.length ? variant.price_tiers.map(rule => (
                <div key={rule.quantity_above} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <span>&gt; {numberFormat.format(Number(rule.quantity_above))} {unitLabel}</span>
                    <span style={{ whiteSpace: "nowrap" }}>{formatRupiah(rule.price)}</span>
                </div>
            )) : "-"
        }
    ];
    return <Table id="tableProductVariants" columns={columns} rows={variants} rowKey="id" rowDataKey="id" showNumber size="lg" />;
}

function PackagePrices({ packages, bundle }) {
    const columns = [
        {
            key: "finishing_name",
            title: "Finishing",
            render: rule => (
                <div>
                    <div>{rule.finishing_name || "Finishing tidak tersedia"}</div>
                    {Number(rule.valid) !== 1 && <small style={{ color: "var(--danger)" }}>Produk atau finishing perlu diperiksa.</small>}
                </div>
            )
        },
        {
            key: "panjang",
            title: "Ukuran",
            render: rule => Number(rule.panjang) > 0 && Number(rule.lebar) > 0
                ? `${numberFormat.format(Number(rule.panjang))} \u00d7 ${numberFormat.format(Number(rule.lebar))} m` : "-"
        },
        { key: "price", title: "Harga / set", render: rule => formatRupiah(rule.price) }
    ];
    return (
        <>
            {packages.length > 0 && <Table id="tableProductPackages" columns={columns} rows={packages} rowKey="id" rowDataKey="id" showNumber size="lg" />}
            {bundle && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16, fontSize: 16 }}>
                        <span>Harga per set</span>
                        <strong>{formatRupiah(bundle.price)}</strong>
                    </div>
                    <Table
                        id="tableBundleContents"
                        columns={[{ key: "label", title: "Isi Paket" }, { key: "quantity", title: "Jumlah", render: item => numberFormat.format(Number(item.quantity)) }]}
                        rows={(bundle.contents || []).map((item, index) => ({ ...item, id: index }))}
                        rowKey="id"
                        rowDataKey="id"
                        showNumber
                        size="lg"
                    />
                    {bundle.valid === false && <p role="alert" style={{ color: "var(--danger)" }}>{bundle.error}</p>}
                </div>
            )}
        </>
    );
}

function LaserConversions({ rules }) {
    const columns = useMemo(() => [
        {
            key: "laser_name",
            title: "Bahan Print",
            render: rule => (
                <div>
                    <div>{rule.laser_name || "Bahan print tidak tersedia"}</div>
                    {Number(rule.valid) !== 1 && <small style={{ color: "var(--danger)" }}>Konversi perlu diperiksa.</small>}
                </div>
            )
        },
        { key: "size", title: "Ukuran", render: rule => rule.size || "-" },
        { key: "finishing_names", title: "Finishing", render: rule => rule.finishing_names || "-" },
        {
            key: "product_quantity",
            title: "Konversi",
            render: rule => (
                <div style={{ whiteSpace: "nowrap" }}>
                    <div>{Number(rule.product_quantity).toLocaleString("id-ID", { maximumFractionDigits: 8 })} pcs produk</div>
                    <div style={{ color: "var(--text-secondary)" }}>= {Number(rule.print_quantity).toLocaleString("id-ID", { maximumFractionDigits: 8 })} pcs print</div>
                </div>
            )
        },
        {
            key: "price",
            title: "Harga / pcs",
            render: rule => <span style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{formatRupiah(rule.price ?? rule.product_price)}</span>
        }
    ], []);

    return <Table id="tableProductLaserConversions" columns={columns} rows={rules} rowKey="id" rowDataKey="id" showNumber size="lg" />;
}

export default function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [finishings, setFinishings] = useState([]);
    const [variantsByProduct, setVariantsByProduct] = useState({});
    const [packagesByCategory, setPackagesByCategory] = useState({});
    const [bundlesByProduct, setBundlesByProduct] = useState({});
    const [bundleError, setBundleError] = useState(false);
    const [laserConversionsByCategory, setLaserConversionsByCategory] = useState({});
    const [detail, setDetail] = useState(null);

    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const loadRequest = useRef(0);
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);

    const loadData = useCallback(async () => {
        const requestId = ++loadRequest.current;
        try {
            const applyProducts = fresh => {
                if (requestId !== loadRequest.current) return;
                setProducts(fresh.data);
                setTotalPages(fresh.total_pages);
            };
            const prodData = await getCachedPaginatedProducts(page, limit, debouncedSearch, applyProducts, categoryId);
            applyProducts(prodData);
            if (requestId !== loadRequest.current) return;

            const applyCategories = fresh => { if (requestId === loadRequest.current) setCategories(fresh); };
            const catData = await getCachedCategories(applyCategories);
            applyCategories(catData);

            const applyFinishings = fresh => { if (requestId === loadRequest.current) setFinishings(fresh); };
            const finData = await getCachedFinishings(applyFinishings);
            applyFinishings(finData);
        } catch (err) {
            console.error(err);
        }
    }, [page, limit, debouncedSearch, categoryId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        loadData();
        return () => { loadRequest.current++; };
    }, [loadData]);

    useEffect(() => {
        if (detail?.type !== "variants") return;
        let cancelled = false;
        const productId = detail.product.product_id;
        setVariantsByProduct(current => ({ ...current, [productId]: { ...current[productId], loading: true, error: false } }));
        const apply = rows => {
            if (!cancelled) setVariantsByProduct(current => ({ ...current, [productId]: { rows } }));
        };
        getCachedProductVariants(productId, apply, { throwOnError: true }).then(apply).catch(() => {
            if (!cancelled) setVariantsByProduct(current => ({ ...current, [productId]: { error: true } }));
        });
        return () => { cancelled = true; };
    }, [detail]);

    useEffect(() => {
        let cancelled = false;
        const categoryIds = [...new Set(products
            .filter(product => ["INDOOR", "OUTDOOR", "LASER", "LASER A3"].includes(product.category?.trim().toUpperCase()))
            .map(product => product.category_id))];
        categoryIds.forEach(async categoryId => {
            const apply = rows => {
                if (!cancelled) setPackagesByCategory(current => ({ ...current, [categoryId]: { rows } }));
            };
            try {
                const rows = await getCachedProductFinishingPrices(categoryId, apply, { throwOnError: true });
                apply(rows);
            } catch {
                if (!cancelled) setPackagesByCategory(current => ({ ...current, [categoryId]: { error: true } }));
            }
        });
        const laserCategoryIds = [...new Set(products
            .filter(product => product.category?.trim().toUpperCase() === "ANEKA CETAK")
            .map(product => product.category_id))];
        laserCategoryIds.forEach(async categoryId => {
            const apply = rows => {
                if (!cancelled) setLaserConversionsByCategory(current => ({ ...current, [categoryId]: { rows } }));
            };
            try {
                const rows = await getCachedProductLaserConversions(categoryId, apply, { throwOnError: true });
                apply(rows);
            } catch {
                if (!cancelled) setLaserConversionsByCategory(current => ({ ...current, [categoryId]: { error: true } }));
            }
        });
        if (products.some(product => product.category?.trim().toUpperCase() === "PELENGKAP")) {
            const apply = rows => {
                if (!cancelled) {
                    setBundlesByProduct(Object.fromEntries(rows.map(bundle => [bundle.product_id, bundle])));
                    setBundleError(false);
                }
            };
            getCachedProductBundles(apply, { throwOnError: true }).then(apply).catch(() => {
                if (!cancelled) setBundleError(true);
            });
        }
        return () => { cancelled = true; };
    }, [products]);

    const openDetails = useCallback((type, product) => setDetail({ type, product }), []);
    const closeDetails = useCallback(() => setDetail(null), []);
    const detailProduct = products.find(product => String(product.product_id) === String(detail?.product.product_id)) || detail?.product;
    const selectedVariants = variantsByProduct[detailProduct?.product_id];
    const selectedPackageData = packagesByCategory[detailProduct?.category_id];
    const selectedPackages = selectedPackageData?.rows?.filter(rule => String(rule.product_id) === String(detailProduct?.product_id)) || [];
    const selectedBundle = bundlesByProduct[detailProduct?.product_id];
    const selectedConversionData = laserConversionsByCategory[detailProduct?.category_id];
    const selectedConversions = selectedConversionData?.rows?.filter(rule => String(rule.product_id) === String(detailProduct?.product_id)) || [];

    const handleStockUpdate = useCallback(async (type, id, newStock) => {
        try {
            const payload = new FormData();
            if (type === "product") {
                payload.append("product_id", id);
                payload.append("quantity", newStock);
                await api.post("", payload, { params: { action: "update_stock_product" } });
                clearProductCache();
            } else if (type === "finishing") {
                payload.append("finishing_id", id);
                payload.append("quantity", newStock);
                await api.post("", payload, { params: { action: "update_stock_finishing" } });
                clearFinishingCache();
            }
            loadData();
        } catch (err) {
            console.error(err);
        }
    }, [loadData]);

    const productColumns = useMemo(() => [
        { key: "category", title: "Kategori" },
        { key: "name", title: "Nama" },
        { key: "unit_type", title: "Satuan" },
        { key: "price", title: "Harga" },
        { key: "reasonable_price", title: "Harga Maklun" },
        { key: "failed_price", title: "Harga Gagal" },
        { key: "stock", title: "Stok" }
    ], []);

    const categoryColumns = useMemo(() => [
        { key: "category_id", title: "ID Kategori" },
        { key: "name", title: "Nama Kategori" }
    ], []);

    const productDetailColumns = useMemo(() => productColumns.map(column => {
        if (column.key === "price") return {
            ...column,
            render: row => (
                <div>
                    <div>{formatRupiah(row.price)}</div>
                    {row.price_tiers?.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                            <Button size="sm" onClick={() => openDetails("tiers", row)}>Harga Bertingkat</Button>
                        </div>
                    )}
                </div>
            )
        };
        if (column.key !== "name") return column;
        return {
            ...column,
            render: row => {
                const packageData = packagesByCategory[row.category_id];
                const hasPackages = packageData?.rows?.some(rule => String(rule.product_id) === String(row.product_id)) || Boolean(bundlesByProduct[row.product_id]);
                const conversionData = laserConversionsByCategory[row.category_id];
                const hasConversions = conversionData?.rows?.some(rule => String(rule.product_id) === String(row.product_id));
                return (
                    <div>
                        <div>{row.name}</div>
                        {row.promotion && (
                            <div style={{ marginTop: 3, fontSize: 12, color: "var(--success)", fontWeight: 500 }}>
                                Beli {Number(row.promotion.buy_quantity).toLocaleString("id-ID")} gratis {Number(row.promotion.free_quantity).toLocaleString("id-ID")}
                            </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                            {Number(row.variant_count) > 0 && <Button size="sm" onClick={() => openDetails("variants", row)}>Varian</Button>}
                            {hasPackages && <Button size="sm" onClick={() => openDetails("packages", row)}>Harga Paket</Button>}
                            {hasConversions && <Button size="sm" onClick={() => openDetails("laser", row)}>Konversi Laser</Button>}
                        </div>
                        {(packageData?.error || (bundleError && row.category?.trim().toUpperCase() === "PELENGKAP")) && (
                            <small style={{ color: "var(--danger)" }}>Harga paket belum dapat dimuat.</small>
                        )}
                        {conversionData?.error && <small style={{ color: "var(--danger)" }}>Konversi laser belum dapat dimuat.</small>}
                    </div>
                );
            }
        };
    }), [productColumns, packagesByCategory, bundlesByProduct, bundleError, laserConversionsByCategory, openDetails]);

    const mappedProducts = useMemo(() => {
        return products.map(p => ({
            ...p,
            stock: (
                <Input
                    key={`prod-${p.product_id}-${p.stock}`}
                    defaultValue={p.stock || 0}
                    type="number"
                    style={{ width: "100px", margin: 0}}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleStockUpdate("product", p.product_id, e.target.value);
                        }
                    }}
                />
            )
        }));
    }, [products, handleStockUpdate]);

    const mappedFinishings = useMemo(() => {
        return finishings.filter(finishing => !categoryId || String(finishing.category_id) === categoryId).map(f => ({
            ...f,
            stock: (
                <Input
                    key={`fin-${f.finishing_id}-${f.stock}`}
                    defaultValue={f.stock || 0}
                    type="number"
                    style={{ width: "100px", margin: 0 }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleStockUpdate("finishing", f.finishing_id, e.target.value);
                        }
                    }}
                />
            )
        }));
    }, [finishings, handleStockUpdate, categoryId]);

    const executeSearch = () => {
        setDebouncedSearch(search);
        setPage(1);
    };

    return (
        <>
            <Header
                title="Manajemen Produk"
                subtitle="Kelola data produk, finishing, dan kategori."
                actions={
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Select
                            name="category_id"
                            value={categoryId}
                            onChange={event => {
                                loadRequest.current++;
                                setCategoryId(event.target.value);
                                setDebouncedSearch(search);
                                setPage(1);
                                setProducts([]);
                                setTotalPages(1);
                            }}
                            options={[
                                { value: "", label: "Semua Kategori" },
                                ...categories.map(category => ({ value: String(category.category_id), label: category.name }))
                            ]}
                            placeholder="Semua Kategori"
                            margin="0"
                            style={{ width: 220 }}
                        />
                        <Input
                            name="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    executeSearch();
                                }
                            }}
                            placeholder="Cari produk..."
                            margin="0"
                            style={{ width: 250 }}
                        />
                        <Button 
                            size="lg"
                            variant="primary" 
                            icon={<Icon name="search" />}
                            onClick={executeSearch}
                        >
                            Cari
                        </Button>
                    </div>
                }
            />

            <>
                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0 }}>Daftar Produk</h3>
                    </div>
                    <Table
                        id="tableProducts"
                        showNumber
                        size="sm"
                        rowKey="product_id"
                        rowDataKey="product_id"
                        columns={productDetailColumns}
                        rows={mappedProducts}
                    />
                    <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            onChange={setPage}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0}}>Daftar Finishing</h3>
                    </div>
                    <Table
                        id="tableFinishings"
                        showNumber
                        size="sm"
                        rowKey="finishing_id"
                        rowDataKey="finishing_id"
                        columns={productColumns}
                        rows={mappedFinishings}
                    />
                </div>

                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0}}>Daftar Kategori</h3>
                    </div>
                    <Table
                        id="tableCategories"
                        showNumber
                        size="sm"
                        rowKey="category_id"
                        rowDataKey="category_id"
                        columns={categoryColumns}
                        rows={categories}
                    />
                </div>
            </>
            <Modal
                open={Boolean(detail)}
                title={`${detailTitles[detail?.type] || ""} - ${detailProduct?.name || ""}`}
                size="xl"
                onClose={closeDetails}
            >
                {detail?.type === "variants" && (
                    selectedVariants?.error ? <p role="alert">Varian belum dapat dimuat. Coba buka kembali.</p>
                        : !selectedVariants || selectedVariants.loading ? <p>Memuat varian...</p>
                        : selectedVariants.rows?.length ? <VariantPrices variants={selectedVariants.rows} unit={detailProduct.unit_type} />
                        : <p>Produk ini belum memiliki varian.</p>
                )}
                {detail?.type === "tiers" && (
                    detailProduct.price_tiers?.length ? <PriceTiers rules={detailProduct.price_tiers} unit={detailProduct.unit_type} />
                        : <p>Produk ini belum memiliki harga bertingkat.</p>
                )}
                {detail?.type === "packages" && (
                    selectedPackageData?.error || (bundleError && detailProduct.category?.trim().toUpperCase() === "PELENGKAP")
                        ? <p role="alert">Harga paket belum dapat dimuat.</p>
                        : selectedPackages.length || selectedBundle ? <PackagePrices packages={selectedPackages} bundle={selectedBundle} />
                        : <p>Produk ini belum memiliki harga paket.</p>
                )}
                {detail?.type === "laser" && (
                    selectedConversionData?.error ? <p role="alert">Konversi laser belum dapat dimuat.</p>
                        : !selectedConversionData ? <p>Memuat konversi laser...</p>
                        : selectedConversions.length ? <LaserConversions rules={selectedConversions} />
                        : <p>Produk ini belum memiliki konversi print laser.</p>
                )}
            </Modal>
        </>
    );
}
