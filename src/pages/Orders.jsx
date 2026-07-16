import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { formatRupiah, hitungDeadline, formatKeInternasional as formatNomorInternasional, getTodayDate } from "../services/helpers";
import {
    FOLDER_STATUS_LABEL,
    buildFolderName,
    checkFoldersForItems,
    listFilesForFolder,
    formatUkuran,
} from "../services/folderHelper";
import PaymentModal from "../components/PaymentModal/PaymentModal";
import PrintStruk from "../components/PrintStruk/PrintStruk";
import PrintPdf from "../components/PrintPdf/PrintPdf";

export default function Orders() {
    const navigate = useNavigate();
    const [ordersOnline, setOrdersOnline] = useState([]);
    const [ordersOffline, setOrdersOffline] = useState([]);
    const [operators, setOperators] = useState([]);
    const initialLoadRef = useRef(false);
    
    const [search, setSearch] = useState("");
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const [printStrukOrderId, setPrintStrukOrderId] = useState(null);
    const [PrintPdfOrderId, setPrintPdfOrderId] = useState(null);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewOrderData, setViewOrderData] = useState({ total: 0, items: [], diskon_per_produk: {} });
    const [viewOrderDetails, setViewOrderDetails] = useState(null);
    const [itemFolderStatus, setItemFolderStatus] = useState({}); // { [category]: { status, path } }
    const [folderFilesByCategory, setFolderFilesByCategory] = useState({}); // { [category]: file[] }
    const [loadingFilesByCategory, setLoadingFilesByCategory] = useState({}); // { [category]: boolean }

    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });

    const [copyFeedbackId, setCopyFeedbackId] = useState(null);
    const [iconModalOpen, setIconModalOpen] = useState(false);
    const [iconModalOrder, setIconModalOrder] = useState(null);
    const [folderIconTarget, setFolderIconTarget] = useState(null);
    const [folderIconFound, setFolderIconFound] = useState(false);
    const [searchingFolder, setSearchingFolder] = useState(false);
    const [applyingIcon, setApplyingIcon] = useState(false);
    const [appSettings, setAppSettings] = useState({});

    useEffect(() => {
        window.electron.getSettings()
            .then(setAppSettings)
            .catch(() => {});
    }, []);

    const fetchFilesForCategory = async (category, folderPath) => {
        setLoadingFilesByCategory(prev => ({ ...prev, [category]: true }));
        const res = await listFilesForFolder(folderPath);
        setFolderFilesByCategory(prev => ({ ...prev, [category]: res.success ? res.data : [] }));
        setLoadingFilesByCategory(prev => ({ ...prev, [category]: false }));
    };

    const checkFoldersForViewItems = async (orderRow, itemsList) => {
        const categoriesInOrder = [...new Set((itemsList || []).map(i => i.category).filter(Boolean))];
        setFolderFilesByCategory({});
        setLoadingFilesByCategory({});

        if (categoriesInOrder.length === 0) {
            setItemFolderStatus({});
            return;
        }
        setItemFolderStatus(() => {
            const next = {};
            categoriesInOrder.forEach(cat => { next[cat] = { status: "checking", path: null }; });
            return next;
        });

        const results = await checkFoldersForItems(appSettings, orderRow, itemsList);
        setItemFolderStatus(results);

        Object.entries(results).forEach(([cat, info]) => {
            if (info.status === "ada" && info.path) {
                fetchFilesForCategory(cat, info.path);
            }
        });
    };

    const handleCopyFolderName = async (row) => {
        const folderName = buildFolderName(row);
        try {
            await navigator.clipboard.writeText(folderName);
            setCopyFeedbackId(row.order_id);
            setTimeout(() => setCopyFeedbackId(null), 1500);
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal menyalin nama folder ke clipboard." });
        }
    };

    const handleOpenIconModalForCategory = (category, folderPath, orderRow) => {
        setIconModalOrder({ ...orderRow, kategori: category });
        setFolderIconTarget(folderPath);
        setFolderIconFound(true);
        setSearchingFolder(false);
        setIconModalOpen(true);
    };

    const handlePilihFolderManual = async () => {
        try {
            const path = await window.electron.pilihFolder();
            if (!path) return;
            setFolderIconTarget(path);
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal membuka dialog folder." });
        }
    };

    const handleTerapkanIcon = async (status) => {
        if (!folderIconTarget) return;
        setApplyingIcon(true);
        try {
            const res = await window.electron.setIconFolderOrder({
                folderPath: folderIconTarget,
                status
            });
            if (!res.success) {
                setAlertConfig({ show: true, type: "error", message: res.message || "Gagal mengubah icon folder." });
            } else {
                setAlertConfig({ show: true, type: "success", message: "Icon folder berhasil diubah." });
                setIconModalOpen(false);
                setFolderIconTarget(null);
                setFolderIconFound(false);
                setIconModalOrder(null);
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Terjadi kesalahan saat mengubah icon folder." });
        } finally {
            setApplyingIcon(false);
        }
    };
    const [processModalOpen, setProcessModalOpen] = useState(false);
    const [processOrderData, setProcessOrderData] = useState({
        order_id: "",
        status: "",
        customStatus: "",
        user_id: ""
    });

    const [formOrder, setFormOrder] = useState({
        order_id: "",
        nomorator: "",
        customer_name: "",
        nomor: "",
        deadline: "",
        date: "",
        user_id: "",
        system: "OFFLINE"
    });

    const formatTableData = useCallback((data) => {
        return data.map(row => ({
            ...row,
            formatted_nomor: formatNomorInternasional(row.nomor),
            formatted_total: formatRupiah(row.total),
            formatted_deadline: hitungDeadline(row.deadline),
            formatted_dibayar: row.is_lunas ? `Lunas ${row.lunas_method}` : formatRupiah(row.total_paid),
            formatted_proses: row.project_initial !== "" ? `${row.project_process} ${row.project_initial}` : row.project_process
        }));
    }, []);

    const loadData = useCallback(async () => {
        try {
            const res = await api.get("", {
                params: {
                    action: "get_orders",
                    search: search,
                    start_date: startDate,
                    end_date: endDate
                }
            });

            const responseData = res.data?.data || {};
            setOrdersOnline(formatTableData(responseData.online ?? []));
            setOrdersOffline(formatTableData(responseData.offline ?? []));
        } catch (err) {}
    }, [search, startDate, endDate, formatTableData]);

    const getOperators = useCallback(async () => {
        try {
            const res = await api.get("", { params: { action: "get_initial" } });
            setOperators(res.data?.data || []);
        } catch (err) {}
    }, []);

    useEffect(() => {
        if (initialLoadRef.current) return;
        const timeoutId = window.setTimeout(() => {
            loadData();
            getOperators();
            initialLoadRef.current = true;
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [loadData, getOperators]); 

    const handlePayClick = useCallback((row) => {
        setSelectedOrder(row);
        setPaymentModalOpen(true);
    }, []);

    const handlePaymentSuccess = useCallback(() => {
        setPaymentModalOpen(false);
        loadData();
    }, [loadData]);

    const handleViewOrder = useCallback(async (row) => {
        try {
            const res = await api.get("", { 
                params: { action: "order_detail", order_id: row.order_id } 
            });
            const data = res.data?.data || { total: 0, items: [], diskon_per_produk: {} };
            setViewOrderData(data);
            setViewOrderDetails(row);
            setViewModalOpen(true);
            checkFoldersForViewItems(row, data.items || []);
        } catch (err) {}
    }, [appSettings]);

    const handleProcessClick = useCallback((row) => {
        setProcessOrderData({
            order_id: row.order_id,
            status: "",
            customStatus: "",
            user_id: ""
        });
        setProcessModalOpen(true);
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormOrder(prev => ({ ...prev, [name]: value }));
    };

    const formatDateTime = (val) => {
        if (!val) return "";
        return val.replace(" ", "T").substring(0, 16);
    };

    const getOneHourAhead = () => {
        const date = new Date();
        date.setHours(date.getHours() + 1);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 16);
    };

    const handleAddOrder = () => {
        let defaultSystem = "OFFLINE";
        const sessionRole = localStorage.getItem("role") || "";
        if (sessionRole === "ONLINE") defaultSystem = "ONLINE";

        setFormOrder({
            order_id: "",
            nomorator: "",
            customer_name: "",
            nomor: "",
            deadline: getOneHourAhead(),
            date: "",
            user_id: "",
            system: defaultSystem
        });
        setAddModalOpen(true);
    };

    const handleEditOrder = useCallback((row) => {
        setFormOrder({
            order_id: row.order_id,
            nomorator: row.nomorator,
            customer_name: row.customer_name,
            nomor: row.nomor,
            deadline: formatDateTime(row.deadline),
            date: formatDateTime(row.date),
            user_id: row.user_id,
            system: row.system || "ONLINE"
        });
        setEditModalOpen(true);
    }, []);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("customer_name", formOrder.customer_name);
            payload.append("nomor", formOrder.nomor);
            payload.append("deadline", formOrder.deadline ? formOrder.deadline.replace("T", " ") + ":00" : "");
            payload.append("user_id", formOrder.user_id);
            payload.append("system", formOrder.system);

            const res = await api.post("", payload, { params: { action: "create_order" } });
            setAddModalOpen(false);
            
            const newOrderId = res.data?.order_id || res.data?.data?.order_id;
            if (newOrderId) {
                navigate(`/order/${newOrderId}`);
            } else {
                loadData();
            }
        } catch (err) {}
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", formOrder.order_id);
            payload.append("customer_name", formOrder.customer_name);
            payload.append("nomor", formOrder.nomor);
            payload.append("deadline", formOrder.deadline ? formOrder.deadline.replace("T", " ") + ":00" : "");
            payload.append("date", formOrder.date ? formOrder.date.replace("T", " ") + ":00" : "");
            payload.append("user_id", formOrder.user_id);
            payload.append("system", formOrder.system);

            await api.post("", payload, { params: { action: "update_order" } });
            setEditModalOpen(false);
            loadData();
        } catch (err) {}
    };

    const handleProcessSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", processOrderData.order_id);
            
            const finalStatus = processOrderData.status === "LAINYA" ? processOrderData.customStatus : processOrderData.status;
            payload.append("status", finalStatus);
            
            if (processOrderData.status === "DIAMBIL") {
                payload.append("user_id", processOrderData.user_id);
            } else {
                payload.append("user_id", "");
            }

            await api.post("", payload, { params: { action: "update_project" } });
            setProcessModalOpen(false);
            loadData();
        } catch (err) {}
    };

    const tableColumns = useMemo(() => [
        { key: "nomorator", title: "Invoice" },
        { key: "customer_name", title: "Pelanggan" },
        { key: "formatted_nomor", title: "Nomor" },
        { key: "formatted_total", title: "Total" },
        { key: "formatted_deadline", title: "Deadline" },
        { key: "formatted_dibayar", title: "Dibayar" },
        { key: "formatted_proses", title: "Proses" },
        { key: "op_initial", title: "CS" }
    ], []);

    const viewTableColumns = useMemo(() => [
        { key: "product_name", title: "Nama" },
        { key: "size", title: "Ukuran" },
        { key: "finishing_names", title: "Finishing" },
        { key: "quantity", title: "Qty" },
        { key: "formatted_amount", title: "Jumlah" },
        { key: "maklun_store", title: "Maklun" },
        { key: "folder_status", title: "Folder" }
    ], []);

    const viewItemsMapped = useMemo(() => {
        return (viewOrderData?.items || []).map(item => {
            const isMaklun = !!(item.maklun_store && String(item.maklun_store).trim() !== "");
            return {
                ...item,
                formatted_amount: formatRupiah(item.amount),
                folder_status: isMaklun ? "🤝 Maklun" : (FOLDER_STATUS_LABEL[itemFolderStatus[item.category]?.status] || "-")
            };
        });
    }, [viewOrderData, itemFolderStatus]);

    const viewTableActions = useCallback((row) => {
        const isMaklun = !!(row.maklun_store && String(row.maklun_store).trim() !== "");
        if (isMaklun) return null;

        const info = itemFolderStatus[row.category];
        if (!info || info.status !== "ada" || !info.path) return null;

        return (
            <Button
                size="sm"
                variant="secondary"
                icon={<Icon name="folder" />}
                style={{ whiteSpace: "nowrap" }}
                onClick={(e) => {
                    e.stopPropagation();
                    handleOpenIconModalForCategory(row.category, info.path, viewOrderDetails);
                }}
            >
                Ganti Icon
            </Button>
        );
    }, [itemFolderStatus, viewOrderDetails]);

    const tableActions = useCallback((row) => (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <Button
                size="sm"
                variant="success"
                icon={<Icon name="payments" />}
                disabled={row.is_lunas}
                onClick={(e) => { e.stopPropagation(); handlePayClick(row); }}
            />
            <Button
                size="sm"
                variant="info"
                icon={<Icon name="visibility" />}
                onClick={(e) => { e.stopPropagation(); handleViewOrder(row); }}
            />
            <Button
                size="sm"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={(e) => { e.stopPropagation(); handleEditOrder(row); }}
            />
            <Button
                size="sm"
                variant="primary"
                icon={<Icon name="print" />}
                onClick={(e) => { e.stopPropagation(); setPrintStrukOrderId(row.order_id); }}
            />
            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="picture_as_pdf" />}
                onClick={(e) => { e.stopPropagation(); setPrintPdfOrderId( row.order_id); }}
            />
            <Button
                size="sm"
                variant="secondary"
                icon={<Icon name="engineering" />}
                disabled={row.project_initial !== ""}
                onClick={(e) => { e.stopPropagation(); handleProcessClick(row); }}
            />
        </div>
    ), [handlePayClick, handleViewOrder, handleEditOrder, handleProcessClick]);

    const operatorOptions = useMemo(() => {
        return Object.entries(operators).map(([id, name]) => ({
            value: id,
            label: name
        }));
    }, [operators]);

    const systemOptions = [
        { value: "ONLINE", label: "ONLINE" },
        { value: "OFFLINE", label: "OFFLINE" }
    ];

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
                title="Orders"
                subtitle="Data pesanan masuk."
                actions={
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <Input
                            type="date"
                            name="start_date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span style={{ fontWeight: "bold", color: "var(--secondary)" }}>-</span>
                        <Input
                            type="date"
                            name="end_date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <Input
                            name="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari pesanan..."
                            style={{ width: 250 }}
                        />
                        <Button 
                            variant="primary" 
                            size="full-lg"
                            icon={<Icon name="search" />} 
                            onClick={loadData}
                        >
                            Filter
                        </Button>
                        <Button 
                            variant="success" 
                            size="full-lg"
                            icon={<Icon name="add" />} 
                            onClick={handleAddOrder}
                        >
                            Tambah
                        </Button>
                    </div>
                }
            />

            <div style={{ marginTop: 24, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Pesanan Offline</h3>
                <Table
                    id="tableOffline"
                    showNumber
                    size="sm"
                    rowKey="order_id"
                    rowDataKey="order_id"
                    columns={tableColumns}
                    rows={ordersOffline}
                    actions={tableActions}
                    onRowDoubleClick={(row) => navigate(`/order/${row.order_id}`)}
                />
            </div>

            <div style={{ marginTop: 32 }}>
                <h3 style={{ marginBottom: 12 }}>Pesanan Online</h3>
                <Table
                    id="tableOnline"
                    showNumber
                    size="sm"
                    rowKey="order_id"
                    rowDataKey="order_id"
                    columns={tableColumns}
                    rows={ordersOnline}
                    actions={tableActions}
                    onRowDoubleClick={(row) => navigate(`/order/${row.order_id}`)}
                />
            </div>

            <PaymentModal
                open={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                order={selectedOrder}
                onSuccess={handlePaymentSuccess}
            />

            <Modal
                open={viewModalOpen}
                onClose={() => { setViewModalOpen(false); setItemFolderStatus({}); setFolderFilesByCategory({}); setLoadingFilesByCategory({}); }}
                title={`Detail Order - ${viewOrderDetails?.nomorator || ""}`}
                size="lg"
                headerColor="info"
            >
                <div style={{ display: "flex", gap: "8px", marginBottom: 16, flexWrap: "nowrap" }}>
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={<Icon name="content_copy" />}
                        style={{ whiteSpace: "nowrap" }}
                        onClick={() => viewOrderDetails && handleCopyFolderName(viewOrderDetails)}
                    >
                        {viewOrderDetails && copyFeedbackId === viewOrderDetails.order_id ? "Tersalin!" : "Salin Nama Folder"}
                    </Button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <Table
                        id="tableViewItems"
                        showNumber
                        size="sm"
                        rowKey="order_item_id"
                        rowDataKey="order_item_id"
                        columns={viewTableColumns}
                        rows={viewItemsMapped}
                        actions={viewTableActions}
                    />
                </div>


                {Object.keys(itemFolderStatus).some(cat => itemFolderStatus[cat]?.status === "ada") && (
                    <div style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 12 }}>Isi Folder (untuk dibandingkan dengan nota)</h4>
                        {Object.entries(itemFolderStatus)
                            .filter(([, info]) => info.status === "ada")
                            .map(([cat]) => {
                                const files = folderFilesByCategory[cat] || [];
                                const isLoading = loadingFilesByCategory[cat];
                                const totalSemua = files.reduce((sum, f) => sum + (f.totalLuas || 0), 0);

                                return (
                                    <div key={cat} style={{ marginBottom: 16, padding: 12, backgroundColor: "var(--bg-body)", borderRadius: 8, border: "1px solid var(--border)" }}>
                                        <div style={{ fontWeight: "bold", marginBottom: 8 }}>{cat}</div>
                                        {isLoading ? (
                                            <div style={{ color: "var(--secondary)", fontSize: 13 }}>Membaca isi folder...</div>
                                        ) : files.length === 0 ? (
                                            <div style={{ color: "var(--secondary)", fontSize: 13 }}>Tidak ada file JPG/PNG/PDF/TIFF di folder ini.</div>
                                        ) : (
                                            <>
                                                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                                                    <thead>
                                                        <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                                            <th style={{ padding: "4px 8px" }}>Nama File</th>
                                                            <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Ukuran</th>
                                                            <th style={{ padding: "4px 8px" }}>Qty</th>
                                                            <th style={{ padding: "4px 8px" }}>Warna</th>
                                                            <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Total (m²)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {files.map((f, idx) => (
                                                            <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                                                <td style={{ padding: "4px 8px", wordBreak: "break-all" }}>{f.nama}</td>
                                                                <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{formatUkuran(f)}</td>
                                                                <td style={{ padding: "4px 8px" }}>{f.quantity}</td>
                                                                <td style={{ padding: "4px 8px" }}>{f.colorMode}</td>
                                                                <td style={{ padding: "4px 8px" }}>{f.totalLuas != null ? f.totalLuas : "-"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <div style={{ textAlign: "right", marginTop: 8, fontWeight: "bold", fontSize: 13 }}>
                                                    Total {cat}: {totalSemua.toFixed(2)} m²
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, padding: "16px", backgroundColor: "var(--bg-content)", borderRadius: "8px", border: "1px solid var(--border)"}}>
                    <div>
                        <h5 style={{ margin: "0 0 8px 0" }}>Diskon Produk:</h5>
                        {Object.keys(viewOrderData?.diskon_per_produk || {}).length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text)" }}>
                                {Object.entries(viewOrderData.diskon_per_produk).map(([nama, diskon]) => (
                                    <li key={nama}>
                                        {nama}: {formatRupiah(diskon)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <span style={{ color: "var(--secondary)" }}>Tidak ada diskon</span>
                        )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <h4 style={{ margin: 0 }}>Total Bayar</h4>
                        <h2 style={{ margin: "4px 0 0 0", color: "var(--success)" }}>
                            {formatRupiah(viewOrderData?.total || 0)}
                        </h2>
                    </div>
                </div>
            </Modal>

            <Modal
                open={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                title="Tambah Order"
                size="sm"
                headerColor="success"
            >
                <Form id="formAddOrder" onSubmit={handleAddSubmit}>
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="customer_name"
                        value={formOrder.customer_name}
                        onChange={handleFormChange}
                        label="Nama"
                        placeholder="Nama Pelanggan"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="nomor"
                        value={formOrder.nomor}
                        onChange={handleFormChange}
                        label="Nomor"
                        placeholder="Nomor Telepon / WA"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="deadline"
                        type="datetime-local"
                        value={formOrder.deadline}
                        onChange={handleFormChange}
                        label="Deadline"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="user_id"
                        label="Operator"
                        value={formOrder.user_id}
                        onChange={handleFormChange}
                        options={operatorOptions}
                        placeholder="Pilih Operator"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="system"
                        label="System"
                        value={formOrder.system}
                        onChange={handleFormChange}
                        options={systemOptions}
                        required
                    />
                    <Button type="submit" size="full-lg" variant="success" icon={<Icon name="add" />}>
                        Simpan Order
                    </Button>
                </Form>
            </Modal>

            <Modal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                title="Edit Order"
                size="sm"
                headerColor="warning"
            >
                <Form id="formEditOrder" onSubmit={handleEditSubmit}>
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="nomorator"
                        value={formOrder.nomorator}
                        onChange={handleFormChange}
                        label="Inv"
                        readOnly
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="date"
                        type="datetime-local"
                        value={formOrder.date}
                        onChange={handleFormChange}
                        label="Tanggal"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="customer_name"
                        value={formOrder.customer_name}
                        onChange={handleFormChange}
                        label="Nama"
                        placeholder="Nama Pelanggan"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="nomor"
                        value={formOrder.nomor}
                        onChange={handleFormChange}
                        label="Nomor"
                        placeholder="Nomor Telepon / WA"
                        required
                    />
                    <Input
                        labelPosition="left"
                        labelWidth={130}
                        name="deadline"
                        type="datetime-local"
                        value={formOrder.deadline}
                        onChange={handleFormChange}
                        label="Deadline"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="user_id"
                        label="Operator"
                        value={formOrder.user_id}
                        onChange={handleFormChange}
                        options={operatorOptions}
                        placeholder="Pilih Operator"
                        required
                    />
                    <Select
                        labelPosition="left"
                        labelWidth={130}
                        name="system"
                        label="System"
                        value={formOrder.system}
                        onChange={handleFormChange}
                        options={systemOptions}
                        required
                    />
                    <Button type="submit" size="full-lg" variant="warning" icon={<Icon name="edit" />}>
                        Update Order
                    </Button>
                </Form>
            </Modal>

            <Modal
                open={processModalOpen}
                onClose={() => setProcessModalOpen(false)}
                title="Proses Order"
                size="sm"
                headerColor="secondary"
            >
                <Form id="formProcessOrder" onSubmit={handleProcessSubmit}>
                    <div style={{ display: "flex", flexWrap: "nowrap", gap: "8px", marginBottom: "16px" }}>
                        {["BELUM DIPROSES", "DIPROSES", "DIAMBIL", "LAINYA"].map((statusItem) => (
                            <Button
                                key={statusItem}
                                type="button"
                                variant={processOrderData.status === statusItem ? "primary" : "secondary"}
                                onClick={() => setProcessOrderData(prev => ({ ...prev, status: statusItem }))}
                                size="md"
                            >
                                {statusItem}
                            </Button>
                        ))}
                    </div>

                    {processOrderData.status === "LAINYA" && (
                        <div style={{ marginBottom: "16px" }}>
                            <Input
                                labelPosition="left"
                                labelWidth={130}
                                name="customStatus"
                                value={processOrderData.customStatus}
                                onChange={(e) => setProcessOrderData(prev => ({ ...prev, customStatus: e.target.value }))}
                                label="Status Lainnya"
                                placeholder="Ketik status manual..."
                                required
                            />
                        </div>
                    )}

                    {processOrderData.status === "DIAMBIL" && (
                        <div style={{ marginBottom: "16px" }}>
                            <Select
                                labelPosition="left"
                                labelWidth={130}
                                name="user_id"
                                label="Operator"
                                value={processOrderData.user_id}
                                onChange={(e) => setProcessOrderData(prev => ({ ...prev, user_id: e.target.value }))}
                                options={operatorOptions}
                                placeholder="Pilih Operator"
                                required
                            />
                        </div>
                    )}

                    <Button 
                        type="submit" 
                        size="full-lg" 
                        variant="primary" 
                        icon={<Icon name="save" />}
                        disabled={!processOrderData.status}
                    >
                        Update Proses
                    </Button>
                </Form>
            </Modal>

            <Modal
                open={iconModalOpen}
                onClose={() => { setIconModalOpen(false); setFolderIconTarget(null); setFolderIconFound(false); setIconModalOrder(null); }}
                title={`Ganti Icon Folder - ${iconModalOrder?.kategori || ""} - ${iconModalOrder?.nomorator || ""}`}
                size="sm"
                headerColor="secondary"
            >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {searchingFolder ? (
                        <div style={{ fontSize: "13px", color: "var(--secondary)" }}>
                            🔍 Mencari folder di dalam struktur tanggal order...
                        </div>
                    ) : (
                        <div style={{ fontSize: "13px", color: "var(--secondary)", wordBreak: "break-all" }}>
                            {folderIconFound ? "✅ Folder ditemukan:" : "⚠️ Belum ditemukan, akan dibuat baru di:"}{" "}
                            <strong style={{ color: "var(--text)" }}>{folderIconTarget}</strong>
                        </div>
                    )}
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={<Icon name="folder_open" />}
                        style={{ whiteSpace: "nowrap" }}
                        disabled={searchingFolder}
                        onClick={handlePilihFolderManual}
                    >
                        Pilih Folder Manual (kalau path di atas salah)
                    </Button>
                    <div style={{ fontSize: "14px", fontWeight: "bold" }}>Pilih status order:</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                            size="md"
                            variant="success"
                            disabled={applyingIcon || searchingFolder}
                            icon={<Icon name="folder" />}
                            onClick={() => handleTerapkanIcon("selesai")}
                        >
                            Selesai
                        </Button>
                        <Button
                            size="md"
                            variant="primary"
                            disabled={applyingIcon || searchingFolder}
                            icon={<Icon name="folder" />}
                            onClick={() => handleTerapkanIcon("proses")}
                        >
                            Proses
                        </Button>
                        <Button
                            size="md"
                            variant="danger"
                            disabled={applyingIcon || searchingFolder}
                            icon={<Icon name="folder" />}
                            onClick={() => handleTerapkanIcon("cancel")}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
            </Modal>

            {printStrukOrderId && (
                <PrintStruk 
                    orderId={printStrukOrderId} 
                    onClose={() => setPrintStrukOrderId(null)} 
                />
            )}
            {PrintPdfOrderId && (
                <PrintPdf 
                    orderId={PrintPdfOrderId} 
                    onClose={() => setPrintPdfOrderId(null)} 
                />
            )}
        </>
    );
}
