import { useEffect, useState, useMemo, useCallback } from "react";
import api from "../api/axios";
import Table from "../components/Table/Table";
import Form from "../components/Form/Form";
import Button from "../components/Button/Button";
import Select from "../components/Select/Select";
import Icon from "../components/Icon/Icon";
import Modal from "../components/Modal/Modal";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Pagination from "../components/Pagination/Pagination";

export default function Products() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [finishings, setFinishings] = useState([]);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteConfig, setDeleteConfig] = useState({ id: null, type: "" });

    const [openProduct, setOpenProduct] = useState(false);
    const [isEditProduct, setIsEditProduct] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState(null);

    const [openFinishing, setOpenFinishing] = useState(false);
    const [isEditFinishing, setIsEditFinishing] = useState(false);
    const [selectedFinishingId, setSelectedFinishingId] = useState(null);

    const [openCategory, setOpenCategory] = useState(false);
    const [isEditCategory, setIsEditCategory] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);

    const [formProduct, setFormProduct] = useState({
        name: "",
        category_id: "",
        unit_type: "",
        price: "",
        reasonable_price: "",
        failed_price: ""
    });

    const [formFinishing, setFormFinishing] = useState({
        name: "",
        category_id: "",
        unit_type: "",
        price: "",
        reasonable_price: "",
        failed_price: ""
    });

    const [formCategory, setFormCategory] = useState({
        name: ""
    });

    const unit = useMemo(() => [
        { value: "M2", label: "M2" },
        { value: "CM2", label: "CM2" },
        { value: "PCS", label: "PCS" },
        { value: "RIM", label: "RIM" },
        { value: "~", label: "~" }
    ], []);

    const categoryOptions = useMemo(() => {
        return categories.map((c) => ({
            value: c.category_id,
            label: c.name
        }));
    }, [categories]);

    const loadData = useCallback(async () => {
        try {
            const resProd = await api.get("", {
                params: {
                    action: "pagination_products",
                    page,
                    limit,
                    search: debouncedSearch
                }
            });
            setProducts(resProd.data?.data?.data ?? []);
            setTotalPages(resProd.data?.data?.total_pages ?? 1);

            const resCat = await api.get("", {
                params: { action: "categories" }
            });
            setCategories(resCat.data?.data ?? []);

            const resFin = await api.get("", {
                params: { action: "finishings" }
            });
            setFinishings(resFin.data?.data ?? []);
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

    // Load Data triggers when dependencies change
    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFormProductChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormProduct((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleFormFinishingChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormFinishing((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleFormCategoryChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormCategory((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleAddProductClick = () => {
        setFormProduct({
            name: "",
            category_id: "",
            unit_type: "",
            price: "",
            reasonable_price: "",
            failed_price: ""
        });
        setIsEditProduct(false);
        setOpenProduct(true);
    };

    const handleEditProductClick = useCallback((row) => {
        setFormProduct({
            name: row.name || "",
            category_id: row.category_id || "",
            unit_type: row.unit_type || "",
            price: row.price || "",
            reasonable_price: row.reasonable_price || "",
            failed_price: row.failed_price || ""
        });
        setSelectedProductId(row.product_id);
        setIsEditProduct(true);
        setOpenProduct(true);
    }, []);

    const handleAddFinishingClick = () => {
        setFormFinishing({
            name: "",
            category_id: "",
            unit_type: "",
            price: "",
            reasonable_price: "",
            failed_price: ""
        });
        setIsEditFinishing(false);
        setOpenFinishing(true);
    };

    const handleEditFinishingClick = useCallback((row) => {
        setFormFinishing({
            name: row.name || "",
            category_id: row.category_id || "",
            unit_type: row.unit_type || "",
            price: row.price || "",
            reasonable_price: row.reasonable_price || "",
            failed_price: row.failed_price || ""
        });
        setSelectedFinishingId(row.finishing_id);
        setIsEditFinishing(true);
        setOpenFinishing(true);
    }, []);

    const handleAddCategoryClick = () => {
        setFormCategory({ name: "" });
        setIsEditCategory(false);
        setOpenCategory(true);
    };

    const handleEditCategoryClick = useCallback((row) => {
        setFormCategory({ name: row.name || "" });
        setSelectedCategoryId(row.category_id);
        setIsEditCategory(true);
        setOpenCategory(true);
    }, []);

    const handleDeleteClick = useCallback((id, type) => {
        setDeleteConfig({ id, type });
        setConfirmOpen(true);
    }, []);

    const handleSubmitProduct = async (e) => {
        e.preventDefault();
        try {
            const action = isEditProduct ? "update_product" : "create_product";
            const payload = new FormData();
            
            payload.append("name", formProduct.name);
            payload.append("category_id", formProduct.category_id);
            payload.append("unit_type", formProduct.unit_type);
            payload.append("price", formProduct.price);
            payload.append("reasonable_price", formProduct.reasonable_price);
            payload.append("failed_price", formProduct.failed_price);
            
            if (isEditProduct) {
                payload.append("product_id", selectedProductId);
            }

            await api.post("", payload, { params: { action } });
            setOpenProduct(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmitFinishing = async (e) => {
        e.preventDefault();
        try {
            const action = isEditFinishing ? "update_finishing" : "create_finishing";
            const payload = new FormData();
            
            payload.append("name", formFinishing.name);
            payload.append("category_id", formFinishing.category_id);
            payload.append("unit_type", formFinishing.unit_type);
            payload.append("price", formFinishing.price);
            payload.append("reasonable_price", formFinishing.reasonable_price);
            payload.append("failed_price", formFinishing.failed_price);
            
            if (isEditFinishing) {
                payload.append("finishing_id", selectedFinishingId);
            }

            await api.post("", payload, { params: { action } });
            setOpenFinishing(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmitCategory = async (e) => {
        e.preventDefault();
        try {
            const action = isEditCategory ? "update_category" : "create_category";
            const payload = new FormData();
            
            payload.append("name", formCategory.name);
            
            if (isEditCategory) {
                payload.append("category_id", selectedCategoryId);
            }

            await api.post("", payload, { params: { action } });
            setOpenCategory(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleConfirmDelete = async () => {
        try {
            const payload = new FormData();
            let action = "";

            if (deleteConfig.type === "product") {
                payload.append("product_id", deleteConfig.id);
                action = "delete_product";
            } else if (deleteConfig.type === "finishing") {
                payload.append("finishing_id", deleteConfig.id);
                action = "delete_finishing";
            } else if (deleteConfig.type === "category") {
                payload.append("category_id", deleteConfig.id);
                action = "delete_category";
            }

            await api.post("", payload, { params: { action } });
            setConfirmOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleStockUpdate = useCallback(async (type, id, newStock) => {
        try {
            const payload = new FormData();
            if (type === "product") {
                payload.append("product_id", id);
                payload.append("quantity", newStock);
                await api.post("", payload, { params: { action: "update_stock_product" } });
            } else if (type === "finishing") {
                payload.append("finishing_id", id);
                payload.append("quantity", newStock);
                await api.post("", payload, { params: { action: "update_stock_finishing" } });
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

    const productActions = useCallback((row) => (
        <>
            <Button
                size="md"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={() => handleEditProductClick(row)}
            />
            <Button
                size="md"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={() => handleDeleteClick(row.product_id, "product")}
            />
        </>
    ), [handleEditProductClick, handleDeleteClick]);

    const finishingActions = useCallback((row) => (
        <>
            <Button
                size="md"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={() => handleEditFinishingClick(row)}
            />
            <Button
                size="md"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={() => handleDeleteClick(row.finishing_id, "finishing")}
            />
        </>
    ), [handleEditFinishingClick, handleDeleteClick]);

    const categoryActions = useCallback((row) => (
        <>
            <Button
                size="sm"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={() => handleEditCategoryClick(row)}
            />
            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={() => handleDeleteClick(row.category_id, "category")}
            />
        </>
    ), [handleEditCategoryClick, handleDeleteClick]);

    const mappedProducts = useMemo(() => {
        return products.map(p => ({
            ...p,
            stock: (
                <Input
                    key={`prod-${p.product_id}-${p.stock}`}
                    defaultValue={p.stock || 0}
                    type="number"
                    style={{ width: "100px", margin: 0 }}
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
                    style={{ width: "100px", margin: 0}}
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
                    <div style={{ display: "flex", gap: "8px" }}>
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

            <div style={{ padding: "0 16px" }}>
                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0 }}>Daftar Produk</h3>
                        <Button size="md" icon={<Icon name="add" />} onClick={handleAddProductClick}>
                            Tambah Produk
                        </Button>
                    </div>
                    <Table
                        id="tableProducts"
                        showNumber
                        size="sm"
                        rowKey="product_id"
                        rowDataKey="product_id"
                        columns={productColumns}
                        rows={mappedProducts}
                        actions={productActions}
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
                        <Button size="sm" icon={<Icon name="add" />} onClick={handleAddFinishingClick}>
                            Tambah Finishing
                        </Button>
                    </div>
                    <Table
                        id="tableFinishings"
                        showNumber
                        size="sm"
                        rowKey="finishing_id"
                        rowDataKey="finishing_id"
                        columns={productColumns}
                        rows={mappedFinishings}
                        actions={finishingActions}
                    />
                </div>

                <div style={{ marginBottom: "2.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <h3 style={{ margin: 0}}>Daftar Kategori</h3>
                        <Button size="sm" icon={<Icon name="add" />} onClick={handleAddCategoryClick}>
                            Tambah Kategori
                        </Button>
                    </div>
                    <Table
                        id="tableCategories"
                        showNumber
                        size="sm"
                        rowKey="category_id"
                        rowDataKey="category_id"
                        columns={categoryColumns}
                        rows={categories}
                        actions={categoryActions}
                    />
                </div>
            </div>

            <Modal
                open={openProduct}
                title={isEditProduct ? "Edit Produk" : "Tambah Produk"}
                onClose={() => setOpenProduct(false)}
                size="sm"
                headerColor="success"
            >
                <Form
                    id="productForm"
                    onSubmit={handleSubmitProduct}
                >
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="name"
                        value={formProduct.name}
                        onChange={handleFormProductChange}
                        label="Nama Produk"
                        placeholder="Input nama produk"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="category_id"
                        label="Kategori"
                        value={formProduct.category_id}
                        onChange={handleFormProductChange}
                        options={categoryOptions}
                        placeholder="Pilih kategori"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="unit_type"
                        label="Satuan Unit"
                        value={formProduct.unit_type}
                        onChange={handleFormProductChange}
                        options={unit}
                        placeholder="Pilih unit"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="price"
                        value={formProduct.price}
                        onChange={handleFormProductChange}
                        label="Harga"
                        type="number"
                        placeholder="Input harga"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="reasonable_price"
                        value={formProduct.reasonable_price}
                        onChange={handleFormProductChange}
                        label="Harga Maklun"
                        type="number"
                        placeholder="Input harga maklun"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="failed_price"
                        value={formProduct.failed_price}
                        onChange={handleFormProductChange}
                        label="Harga Gagal"
                        type="number"
                        placeholder="Input harga gagal"
                        required
                    />
                    <Button
                        type="submit"
                        size="full-lg"
                        variant="success"
                        icon={<Icon name={isEditProduct ? "edit" : "add"} />}
                    >
                        {isEditProduct ? "Update Produk" : "Tambah Produk"}
                    </Button>
                </Form>
            </Modal>

            <Modal
                open={openFinishing}
                title={isEditFinishing ? "Edit Finishing" : "Tambah Finishing"}
                onClose={() => setOpenFinishing(false)}
                size="sm"
                headerColor="primary"
            >
                <Form
                    id="finishingForm"
                    onSubmit={handleSubmitFinishing}
                >
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="name"
                        value={formFinishing.name}
                        onChange={handleFormFinishingChange}
                        label="Nama Finishing"
                        placeholder="Input nama finishing"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="category_id"
                        label="Kategori"
                        value={formFinishing.category_id}
                        onChange={handleFormFinishingChange}
                        options={categoryOptions}
                        placeholder="Pilih kategori"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="unit_type"
                        label="Satuan Unit"
                        value={formFinishing.unit_type}
                        onChange={handleFormFinishingChange}
                        options={unit}
                        placeholder="Pilih unit"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="price"
                        value={formFinishing.price}
                        onChange={handleFormFinishingChange}
                        label="Harga"
                        type="number"
                        placeholder="Input harga"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="reasonable_price"
                        value={formFinishing.reasonable_price}
                        onChange={handleFormFinishingChange}
                        label="Harga Maklun"
                        type="number"
                        placeholder="Input harga maklun"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="failed_price"
                        value={formFinishing.failed_price}
                        onChange={handleFormFinishingChange}
                        label="Harga Gagal"
                        type="number"
                        placeholder="Input harga gagal"
                        required
                    />
                    <Button
                        type="submit"
                        size="full-lg"
                        variant="primary"
                        icon={<Icon name={isEditFinishing ? "edit" : "add"} />}
                    >
                        {isEditFinishing ? "Update Finishing" : "Tambah Finishing"}
                    </Button>
                </Form>
            </Modal>

            <Modal
                open={openCategory}
                title={isEditCategory ? "Edit Kategori" : "Tambah Kategori"}
                onClose={() => setOpenCategory(false)}
                size="sm"
                headerColor="info"
            >
                <Form
                    id="categoryForm"
                    onSubmit={handleSubmitCategory}
                >
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="name"
                        value={formCategory.name}
                        onChange={handleFormCategoryChange}
                        label="Nama Kategori"
                        placeholder="Input nama kategori"
                        required
                    />
                    <Button
                        type="submit"
                        size="full-lg"
                        variant="info"
                        icon={<Icon name={isEditCategory ? "edit" : "add"} />}
                        className="text-white"
                    >
                        {isEditCategory ? "Update Kategori" : "Tambah Kategori"}
                    </Button>
                </Form>
            </Modal>

            <Modal
                open={confirmOpen}
                title="Konfirmasi Hapus"
                onClose={() => setConfirmOpen(false)}
                size="sm"
                headerColor="danger"
            >
                <div style={{ padding: "16px 0", textAlign: "center", fontSize: "16px" }}>
                    Apakah Anda yakin ingin menghapus data ini?
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                    <Button 
                        variant="secondary" 
                        onClick={() => setConfirmOpen(false)}
                    >
                        Batal
                    </Button>
                    <Button 
                        variant="danger" 
                        icon={<Icon name="delete" />} 
                        onClick={handleConfirmDelete}
                    >
                        Hapus
                    </Button>
                </div>
            </Modal>
        </>
    );
}