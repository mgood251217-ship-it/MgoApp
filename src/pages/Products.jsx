import { useEffect, useState, useMemo, useCallback } from "react";
import api from "../api/axios";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Icon from "../components/Icon/Icon";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Pagination from "../components/Pagination/Pagination";
import { formatRupiah } from "../services/helpers";
import { 
    getCachedCategories, 
    getCachedPaginatedProducts, 
    getCachedFinishings, 
    clearProductCache, 
    clearFinishingCache,
    getCachedProductVariants
} from "../services/apiCache";

export default function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [finishings, setFinishings] = useState([]);
    const [variantsByProduct, setVariantsByProduct] = useState({});
    const [expandedProducts, setExpandedProducts] = useState({});

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);

    const loadData = useCallback(async () => {
        try {
            const prodData = await getCachedPaginatedProducts(page, limit, debouncedSearch, (fresh) => {
                setProducts(fresh.data);
                setTotalPages(fresh.total_pages);
            });
            setProducts(prodData.data);
            setTotalPages(prodData.total_pages);

            const catData = await getCachedCategories((fresh) => setCategories(fresh));
            setCategories(catData);

            const finData = await getCachedFinishings((fresh) => setFinishings(fresh));
            setFinishings(finData);
        } catch (err) {
            console.error(err);
        }
    }, [page, limit, debouncedSearch]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        let cancelled = false;
        const productIds = [...new Set(products
            .filter(product => Number(product.variant_count) > 0 && expandedProducts[product.product_id])
            .map(product => product.product_id))];
        let next = 0;
        const loadVariants = async () => {
            while (!cancelled && next < productIds.length) {
                const productId = productIds[next++];
                const apply = rows => {
                    if (!cancelled) setVariantsByProduct(current => ({ ...current, [productId]: { rows } }));
                };
                try {
                    const rows = await getCachedProductVariants(productId, apply, { throwOnError: true });
                    apply(rows);
                } catch {
                    if (!cancelled) setVariantsByProduct(current => ({ ...current, [productId]: { error: true } }));
                }
            }
        };
        for (let i = 0; i < Math.min(4, productIds.length); i++) loadVariants();
        return () => { cancelled = true; };
    }, [products, expandedProducts]);

    const toggleVariants = useCallback(productId => {
        setExpandedProducts(current => ({ ...current, [productId]: !current[productId] }));
    }, []);

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

    const productVariantColumns = useMemo(() => productColumns.map(column => column.key !== "name" ? column : {
        ...column,
        render: row => {
            const data = variantsByProduct[row.product_id];
            const hasVariants = Number(row.variant_count) > 0;
            const expanded = hasVariants && Boolean(expandedProducts[row.product_id]);
            return (
                <div>
                    <div>{row.name}</div>
                    {hasVariants && <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => toggleVariants(row.product_id)}
                        style={{ padding: 0, marginTop: 3, border: 0, background: "none", color: "var(--primary)", fontSize: 10, cursor: "pointer" }}
                    >
                        {expanded ? "Sembunyikan Varian" : "Tampilkan Varian"}
                    </button>}
                    {expanded && data?.rows?.length > 0 && (
                        <div style={{ marginTop: 3, fontSize: 10, lineHeight: 1.4, color: "var(--text-secondary)" }}>
                            {data.rows.map(variant => (
                                <div key={variant.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                    <span>{variant.label || Object.values(variant.options || {}).join(" / ")}</span>
                                    <span style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{formatRupiah(variant.price)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {expanded && !data && <div style={{ fontSize: 10 }}>Memuat varian...</div>}
                    {expanded && data?.rows?.length === 0 && <div style={{ fontSize: 10 }}>Belum ada varian.</div>}
                    {expanded && data?.error && <small style={{ color: "var(--danger)" }}>Varian belum dapat dimuat.</small>}
                </div>
            );
        }
    }), [productColumns, variantsByProduct, expandedProducts, toggleVariants]);

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
        return finishings.map(f => ({
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
    }, [finishings, handleStockUpdate]);

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
                        columns={productVariantColumns}
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
        </>
    );
}
