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
    const [open, setOpen] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [totalPages, setTotalPages] = useState(1);

    const kategori = useMemo(() => [
        { value: "OUTDOOR", label: "OUTDOOR" },
        { value: "FINISHING OUTDOOR", label: "FINISHING OUTDOOR" },
        { value: "INDOOR", label: "INDOOR" },
        { value: "FINISHING INDOOR", label: "FINISHING INDOOR" },
        { value: "PAKET INDOOR OUTDOOR", label: "PAKET INDOOR OUTDOOR" },
        { value: "LASER A3", label: "LASER A3" },
        { value: "FINISHING LASER A3", label: "FINISHING LASER A3" },
        { value: "SUBLIM", label: "SUBLIM" },
        { value: "FINISHING SUBLIM", label: "FINISHING SUBLIM" },
        { value: "DTF", label: "DTF" },
        { value: "STAMP", label: "STAMP" },
        { value: "MERCENDISE", label: "MERCENDISE" },
        { value: "MERCENDISE AKRILIK", label: "MERCENDISE AKRILIK" },
        { value: "JERSEY", label: "JERSEY" },
        { value: "FINISHING JERSEY", label: "FINISHING JERSEY" },
        { value: "AKRILIK", label: "AKRILIK" },
        { value: "FINISHING AKRILIK", label: "FINISHING AKRILIK" },
        { value: "KARTU NAMA", label: "KARTU NAMA" },
        { value: "CETAKAN", label: "CETAKAN" },
        { value: "FINISHING CETAKAN", label: "FINISHING CETAKAN" },
        { value: "JASA", label: "JASA" }
    ], []);

    const unit = useMemo(() => [
        { value: "M2", label: "M2" },
        { value: "CM2", label: "CM2" },
        { value: "PCS", label: "PCS" },
        { value: "RIM", label: "RIM" },
        { value: "~", label: "~" }
    ], []);

    const [form, setForm] = useState({
        name: "",
        type: "",
        unit_type: "",
        price: "",
        reasonable_price: "",
        failed_price: ""
    });

    const loadData = useCallback(async () => {
        try {
            const res = await api.get("", {
                params: {
                    action: "pagination_products",
                    page,
                    limit,
                    search: debouncedSearch
                }
            });

            setProducts(res.data?.data?.data ?? []);
            setTotalPages(res.data?.data?.total_pages ?? 1);
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

    const handleFormChange = useCallback((e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: value
        }));
    }, []);

    const handleAddClick = () => {
        setForm({
            name: "",
            type: "",
            unit_type: "",
            price: "",
            reasonable_price: "",
            failed_price: ""
        });
        setIsEdit(false);
        setOpen(true);
    };

    const handleEditClick = useCallback((row) => {
        setForm({
            name: row.name || "",
            type: row.type || "",
            unit_type: row.unit_type || "",
            price: row.price || "",
            reasonable_price: row.reasonable_price || "",
            failed_price: row.failed_price || ""
        });
        setSelectedId(row.product_id);
        setIsEdit(true);
        setOpen(true);
    }, []);

    const handleDeleteClick = useCallback((id) => {
        setSelectedId(id);
        setConfirmOpen(true);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const action = isEdit ? "update_product" : "create_product";
            const payload = new FormData();
            
            payload.append("name", form.name);
            payload.append("type", form.type);
            payload.append("unit_type", form.unit_type);
            payload.append("price", form.price);
            payload.append("reasonable_price", form.reasonable_price);
            payload.append("failed_price", form.failed_price);
            
            if (isEdit) {
                payload.append("product_id", selectedId);
            }

            await api.post("", payload, {
                params: { action }
            });
            
            setOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleConfirmDelete = async () => {
        try {
            const payload = new FormData();
            payload.append("product_id", selectedId);

            await api.post("", payload, {
                params: { action: "delete_product" }
            });
            
            setConfirmOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
        }
    };

    const tableColumns = useMemo(() => [
        { key: "type", title: "Type" },
        { key: "name", title: "Nama" },
        { key: "unit_type", title: "Satuan" },
        { key: "price", title: "Harga" },
        { key: "reasonable_price", title: "Harga Maklun" },
        { key: "failed_price", title: "Harga Gagal" },
        { key: "stock", title: "Stok" }
    ], []);

    const tableActions = useCallback((row) => (
        <>
            <Button
                size="sm"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={() => handleEditClick(row)}
            />

            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={() => handleDeleteClick(row.product_id)}
            />
        </>
    ), [handleEditClick, handleDeleteClick]);

    return (
        <>
            <Header
                title="Products"
                subtitle="Kelola data produk."
                actions={
                    <Input
                        name="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari produk..."
                        style={{ width: 250 }}
                    />
                }
            />

            <Table
                id="tableProducts"
                showNumber
                size="sm"
                rowKey="product_id"
                rowDataKey="product_id"
                columns={tableColumns}
                rows={products}
                actions={tableActions}
            />

            <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                <Pagination
                    page={page}
                    totalPages={totalPages}
                    onChange={setPage}
                />
            </div>

            <div style={{ position: "fixed", bottom: 32, right: 32, zIndex: 999 }}>
                <Button
                    icon={<Icon name="add" />}
                    onClick={handleAddClick}
                >
                    Tambah Produk
                </Button>
            </div>

            <Modal
                open={open}
                title={isEdit ? "Edit Produk" : "Tambah Produk"}
                onClose={() => setOpen(false)}
                size="sm"
                headerColor="success"
            >
                <Form
                    id="productForm"
                    onSubmit={handleSubmit}
                >
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="name"
                        value={form.name}
                        onChange={handleFormChange}
                        label="Product Name"
                        placeholder="Input product name"
                        required
                    />

                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="type"
                        label="Kategori"
                        value={form.type}
                        onChange={handleFormChange}
                        options={kategori}
                        placeholder="Pilih kategori"
                        required
                    />

                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="unit_type"
                        label="Satuan Unit"
                        value={form.unit_type}
                        onChange={handleFormChange}
                        options={unit}
                        placeholder="Pilih unit"
                        required
                    />

                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="price"
                        value={form.price}
                        onChange={handleFormChange}
                        label="Price"
                        type="number"
                        placeholder="Input price"
                        required
                    />

                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="reasonable_price"
                        value={form.reasonable_price}
                        onChange={handleFormChange}
                        label="Reasonable Price"
                        type="number"
                        placeholder="Input reasonable price"
                        required
                    />

                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="failed_price"
                        value={form.failed_price}
                        onChange={handleFormChange}
                        label="Failed Price"
                        type="number"
                        placeholder="Input failed price"
                        required
                    />

                    <Button
                        type="submit"
                        size="full-lg"
                        variant="warning"
                        icon={<Icon name="add" />}
                    >
                        {isEdit ? "Update Product" : "Add Product"}
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
                    Apakah Anda yakin ingin menghapus produk ini?
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