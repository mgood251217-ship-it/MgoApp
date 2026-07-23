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
import PaymentModal from "../components/PaymentModal/PaymentModal";
import OrderDetailModal from "../components/OrderDetailModal/OrderDetailModal";
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

    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });

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
        } catch (err) {}
    }, []);

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

    const tableActions = useCallback((row) => (
        <div style={{ display: "flex", gap: "4px", flexWrap: "nowrap" }}>
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
                            margin="0"
                        />
                        <span style={{ fontWeight: "bold", color: "var(--secondary)" }}>-</span>
                        <Input
                            type="date"
                            name="end_date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            margin="0"
                        />
                        <Input
                            name="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari pesanan..."
                            margin="0"
                            style={{ width: 500}}
                        />
                        <Button 
                            variant="primary" 
                            size="lg"
                            icon={<Icon name="search" />} 
                            onClick={loadData}
                        >
                            Filter
                        </Button>
                        <Button 
                            variant="success" 
                            size="lg"
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

            <OrderDetailModal
                open={viewModalOpen}
                onClose={() => setViewModalOpen(false)}
                viewOrderDetails={viewOrderDetails}
                viewOrderData={viewOrderData}
                setAlertConfig={setAlertConfig}
            />

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
