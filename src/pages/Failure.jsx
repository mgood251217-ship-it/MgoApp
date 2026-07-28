import { useEffect, useState, useMemo, useCallback } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import DateFilter from "../components/DateFilter/DateFilter";
import Table from "../components/Table/Table";
import Modal from "../components/Modal/Modal";
import Button from "../components/Button/Button";
import Input from "../components/Input/Input";
import Select from "../components/Select/Select";
import Icon from "../components/Icon/Icon";
import Alert from "../components/Alert/Alert";
import { formatRupiah } from "../services/helpers";
import { exportFailureExcel } from "../services/excelService"; 
import OrderItemForm from "../components/OrderItemForm/OrderItemForm";

const DESAIN_LIST = ['Resolusi pecah', 'Salah ukuran', 'Salah penulisan teks', 'Salah data customer', 'Font berubah', 'File corrupt'];
const CETAK_LIST = ['Warna tidak sesuai', 'Hasil belang/banding', 'Hasil blur', 'Head strike', 'Tinta bocor', 'Kertas/media macet', 'Hasil miring', 'Hasil terpotong'];
const FINISH_FAIL_LIST = ['Salah potong', 'Salah laminasi', 'Mata ayam tidak rapi', 'Sambungan spanduk kurang rapi', 'Bubble laminasi', 'Lipatan rusak'];

export default function Failure() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [failures, setFailures] = useState([]);

    const [operators, setOperators] = useState([]);
    const [machines, setMachines] = useState([]);

    const [modalOpen, setModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ show: false, type: "error", message: "" });

    const [editInfoModalOpen, setEditInfoModalOpen] = useState(false);
    const [editInfoData, setEditInfoData] = useState({ failure_id: "", info: "" });

    const [initialFormItem, setInitialFormItem] = useState({
        order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "",
        qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", paketSize: "", size: ""
    });

    const [failureData, setFailureData] = useState({
        failure_id: "",
        nomorator: "",
        customer_name: "",
        user_id: "",
        machine_id: "",
        loss_burden: "KANTOR",
        date: today,
        info: "",
        failure_cause: "",
        failure_design: [],
        failure_print: [],
        failure_finishing: []
    });

    const fetchFailures = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "failure",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                setFailures(res.data.data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    const loadOperatorsAndMachines = useCallback(async () => {
        try {
            const resUsers = await api.get("", { params: { action: "users" } });
            setOperators(resUsers.data?.data || []);

            const resMachines = await api.get("", { params: { action: "machines" } });
            setMachines(resMachines.data?.data || []);
        } catch (err) {
            console.error("Gagal load dropdown:", err);
        }
    }, []);

    useEffect(() => {
        fetchFailures();
        loadOperatorsAndMachines();
    }, [fetchFailures, loadOperatorsAndMachines]);

    const handleExportExcel = async () => {
        if (failures.length === 0) {
            alert("Tidak ada data kegagalan produksi untuk diexport.");
            return;
        }

        try {
            await exportFailureExcel({
                failures,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const resetForm = () => {
        setInitialFormItem({
            order_item_id: "", category_id: "", product_id: "", panjang: "", lebar: "",
            qty: "", diskon: "", finishings: [], kiloan: "", waktu: "", ukuranJersey: "", paketSize: "", size: ""
        });
        setFailureData({
            failure_id: "", nomorator: "", customer_name: "", user_id: "", machine_id: "",
            loss_burden: "KANTOR", date: today, info: "", failure_cause: "",
            failure_design: [], failure_print: [], failure_finishing: []
        });
    };

    const handleOpenAddModal = () => {
        resetForm();
        setModalOpen(true);
    };

    const handleEdit = (row) => {
        setEditInfoData({
            failure_id: row.failure_id,
            info: row.info || ""
        });
        setEditInfoModalOpen(true);
    };

    const handleUpdateInfo = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const payload = new FormData();
            payload.append("failure_id", editInfoData.failure_id);
            payload.append("info", editInfoData.info);

            const res = await api.post("", payload, { params: { action: "update_failure_info" } });
            
            if (res.data && res.data.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal update info." });
            } else {
                setEditInfoModalOpen(false);
                fetchFailures();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Terjadi kesalahan sistem.";
            setAlertConfig({ show: true, type: "error", message: errorMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (row) => {
        if (window.confirm(`Yakin ingin menghapus data kegagalan ${row.judul}?`)) {
            try {
                const payload = new FormData();
                payload.append("failure_id", row.failure_id);
                await api.post("", payload, { params: { action: "delete_failure" } });
                fetchFailures();
            } catch (err) {
                console.error(err);
                alert("Gagal menghapus data.");
            }
        }
    };

    const handleSubmitFailure = async (submittedItemForm) => {
        setIsSubmitting(true);
        try {
            const payload = new FormData();
            
            payload.append("product_id", submittedItemForm.product_id);
            payload.append("judul", submittedItemForm.selectedProductName || ""); 
            payload.append("quantity", submittedItemForm.qty || 0);
            payload.append("finishing", (submittedItemForm.finishings || []).join(","));
            payload.append("panjang", submittedItemForm.panjang || 0);
            payload.append("lebar", submittedItemForm.lebar || 0);
            
            payload.append("kiloan", submittedItemForm.kiloan || 0);
            payload.append("waktu", submittedItemForm.waktu || 0);
            payload.append("size", submittedItemForm.size || submittedItemForm.ukuranJersey || submittedItemForm.paketSize || "");

            if (failureData.failure_id) payload.append("failure_id", failureData.failure_id);
            
            payload.append("date", failureData.date);
            payload.append("nomorator", failureData.nomorator);
            payload.append("customer_name", failureData.customer_name);
            payload.append("user_id", failureData.user_id);
            payload.append("machine_id", failureData.machine_id);
            payload.append("loss_burden", failureData.loss_burden);
            payload.append("info", failureData.info);
            
            failureData.failure_design.forEach(item => {
                payload.append("failure_design[]", item);
            });
            
            failureData.failure_print.forEach(item => {
                payload.append("failure_print[]", item);
            });
            
            failureData.failure_finishing.forEach(item => {
                payload.append("failure_finishing[]", item);
            });
            
            payload.append("failure_cause", failureData.failure_cause || "");

            payload.append("failure_cause_other", ""); 

            const endpointAction = failureData.failure_id ? "update_failure" : "create_failure";

            const res = await api.post("", payload, { params: { action: endpointAction } });
            
            if (res.data && res.data.success === false) {
                setAlertConfig({ show: true, type: "error", message: res.data.message || "Gagal menyimpan data." });
            } else {
                setModalOpen(false);
                fetchFailures();
                resetForm();
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Terjadi kesalahan sistem.";
            setAlertConfig({ show: true, type: "error", message: errorMsg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFailureDataChange = (e) => {
        const { name, value } = e.target;
        setFailureData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxToggle = (category, value) => {
        setFailureData(prev => {
            const currentList = prev[category];
            const isChecked = currentList.includes(value);
            return {
                ...prev,
                [category]: isChecked 
                    ? currentList.filter(item => item !== value)
                    : [...currentList, value]
            };
        });
    };

    const operatorOptions = useMemo(() => operators.map(u => ({ value: u.user_id, label: u.name })), [operators]);
    const machineOptions = useMemo(() => machines.map(m => ({ value: m.machine_id, label: m.nama_mesin })), [machines]);
    const burdenOptions = [
        { value: "KANTOR", label: "Kantor" },
        { value: "OPERATOR", label: "Operator" }
    ];

    const columns = useMemo(() => [
        { 
            key: "formatted_date", 
            title: "Tanggal", 
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.formatted_date}</span> 
        },
        { 
            key: "nomorator", 
            title: "Nomorator", 
            render: (row) => <span style={{ fontWeight: "bold" }}>{row.nomorator}</span> 
        },
        { key: "customer_name", title: "Customer" },
        { key: "operator_name", title: "Operator" },
        { key: "nama_mesin", title: "Mesin" },
        { key: "judul", title: "Judul", render: (row) => <span style={{ fontWeight: "600" }}>{row.judul}</span> },
        { key: "size", title: "Ukuran", render: (row) => row.size || "-" },
        { key: "quantity", title: "Qty" },
        { key: "finishing_names_str", title: "Finishing", render: (row) => row.finishing_names_str || "-" },
        { 
            key: "detail_gagal", 
            title: "Detail Gagal", 
            render: (row) => (
                <div 
                    style={{ fontSize: "12px", lineHeight: "1.4", whiteSpace: "nowrap" }}
                    dangerouslySetInnerHTML={{ __html: row.detail_gagal }}
                />
            ) 
        },
        { 
            key: "total_loss", 
            title: "Kerugian", 
            render: (row) => <span style={{ fontWeight: "600", color: "#ef4444" }}>{formatRupiah(Number(row.total_loss))}</span> 
        },
        { 
            key: "loss_burden", 
            title: "Beban", 
            render: (row) => (
                <span style={{ 
                    fontWeight: "bold", 
                    color: row.loss_burden === "OPERATOR" ? "#f59e0b" : "var(--primary)" 
                }}>
                    {row.loss_burden}
                </span>
            )
        },
        { 
            key: "info", 
            title: "Keterangan",
            render: (row) => <span style={{ fontSize: "12px" }}>{row.info || "-"}</span>
        },
        {
            key: "aksi",
            title: "Aksi",
            render: (row) => (
                <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                        onClick={() => handleEdit(row)}
                        style={{
                            padding: "4px 8px", background: "var(--primary)", color: "#fff",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                        }}
                    >
                        Edit
                    </button>
                    <button 
                        onClick={() => handleDelete(row)}
                        style={{
                            padding: "4px 8px", background: "#ef4444", color: "#fff",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                        }}
                    >
                        Hapus
                    </button>
                </div>
            )
        }
    ], []);

    const renderCheckboxGroup = (title, categoryKey, list) => (
        <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
                {title}
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "12px", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--bg-body)" }}>
                {list.map((item) => (
                    <label key={item} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", width: "calc(50% - 12px)" }}>
                        <input
                            type="checkbox"
                            checked={failureData[categoryKey].includes(item)}
                            onChange={() => handleCheckboxToggle(categoryKey, item)}
                        />
                        {item}
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            width: "100%", 
            maxWidth: "100vw", 
            boxSizing: "border-box",
            overflowX: "hidden",
            paddingBottom: "40px"
        }}>
            <Header 
                title="Laporan Kegagalan Produksi" 
                subtitle="Pantau rincian kegagalan produksi (reject) beserta beban kerugian."
                actions={
                    <Button 
                        variant="primary" 
                        size="full-lg"
                        icon={<Icon name="add" />} 
                        onClick={handleOpenAddModal}
                    >
                        Input Kegagalan
                    </Button>
                }
            />
            
            {alertConfig.show && (
                <div style={{ padding: "0 24px" }}>
                    <Alert 
                        type={alertConfig.type} 
                        message={alertConfig.message} 
                        onClose={() => setAlertConfig({ ...alertConfig, show: false, message: "" })} 
                    />
                </div>
            )}

            <div style={{ padding: "24px 24px 0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchFailures}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>
                        Data Kegagalan
                    </h3>
                    <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                        <Table 
                            id="table-failure"
                            columns={columns}
                            rows={failures}
                            rowKey="failure_id"
                            size="sm"
                            showNumber={true}
                        />
                    </div>
                    {failures.length === 0 && !loading && (
                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                            Tidak ada data kegagalan produksi pada rentang tanggal ini.
                        </div>
                    )}
                </div>
            </div>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={failureData.failure_id ? "Edit Kegagalan Produksi" : "Input Kegagalan Produksi"}
                size="md"
            >
                <div style={{ padding: "16px" }}>
                    <OrderItemForm 
                        initialData={initialFormItem}
                        isSubmitting={isSubmitting}
                        onSubmit={handleSubmitFailure}
                        submitText={failureData.failure_id ? "Update Kegagalan" : "Simpan Kegagalan"}
                        submitIcon={failureData.failure_id ? "edit" : "save"}
                        submitVariant={failureData.failure_id ? "warning" : "danger"}
                        showCancel={false}
                    >
                        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "2px dashed var(--border)" }}>
                            <h4 style={{ marginBottom: "16px", color: "var(--danger)" }}>Detail Kegagalan</h4>
                            
                            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                                <div style={{ flex: 1 }}>
                                    <Input
                                        labelPosition="top"
                                        name="date"
                                        type="date"
                                        label="Tanggal"
                                        value={failureData.date}
                                        onChange={handleFailureDataChange}
                                        required
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Input
                                        labelPosition="top"
                                        name="nomorator"
                                        type="text"
                                        label="Nomorator"
                                        placeholder="No pesanan..."
                                        value={failureData.nomorator}
                                        onChange={handleFailureDataChange}
                                        required
                                    />
                                </div>
                            </div>

                            <Input
                                labelPosition="top"
                                name="customer_name"
                                type="text"
                                label="Nama Customer"
                                placeholder="Masukkan nama..."
                                value={failureData.customer_name}
                                onChange={handleFailureDataChange}
                                required
                            />

                            <div style={{ display: "flex", gap: "12px", marginTop: "16px", marginBottom: "16px" }}>
                                <div style={{ flex: 1 }}>
                                    <Select
                                        labelPosition="top"
                                        name="user_id"
                                        label="Operator"
                                        value={failureData.user_id}
                                        onChange={handleFailureDataChange}
                                        options={operatorOptions}
                                        placeholder="Pilih Operator"
                                        required
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Select
                                        labelPosition="top"
                                        name="machine_id"
                                        label="Mesin"
                                        value={failureData.machine_id}
                                        onChange={handleFailureDataChange}
                                        options={machineOptions}
                                        placeholder="Pilih Mesin"
                                    />
                                </div>
                            </div>

                            <Select
                                labelPosition="top"
                                name="loss_burden"
                                label="Beban Kerugian"
                                value={failureData.loss_burden}
                                onChange={handleFailureDataChange}
                                options={burdenOptions}
                                required
                            />

                            <div style={{ marginTop: "24px" }}>
                                {renderCheckboxGroup("1. Kesalahan Desain", "failure_design", DESAIN_LIST)}
                                {renderCheckboxGroup("2. Kesalahan Cetak", "failure_print", CETAK_LIST)}
                                {renderCheckboxGroup("3. Kesalahan Finishing", "failure_finishing", FINISH_FAIL_LIST)}
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <Input
                                    labelPosition="top"
                                    name="failure_cause"
                                    type="text"
                                    label="Penyebab Lainnya (Ketik Manual)"
                                    placeholder="Contoh: Setting warna salah, Kurang QC..."
                                    value={failureData.failure_cause}
                                    onChange={handleFailureDataChange}
                                />
                            </div>

                            <Input
                                labelPosition="top"
                                name="info"
                                type="text"
                                label="Keterangan Tambahan"
                                placeholder="Info tambahan..."
                                value={failureData.info}
                                onChange={handleFailureDataChange}
                            />
                        </div>
                    </OrderItemForm>
                </div>
            </Modal>

            <Modal
                open={editInfoModalOpen}
                onClose={() => setEditInfoModalOpen(false)}
                title="Edit Keterangan"
                size="sm"
            >
                <form onSubmit={handleUpdateInfo} style={{ padding: "16px" }}>
                    <Input
                        labelPosition="top"
                        name="info"
                        type="text"
                        label="Keterangan (Info)"
                        placeholder="Masukkan keterangan tambahan..."
                        value={editInfoData.info}
                        onChange={(e) => setEditInfoData({ ...editInfoData, info: e.target.value })}
                        required
                    />
                    
                    <div style={{ marginTop: "24px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => setEditInfoModalOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button 
                            type="submit" 
                            variant="primary" 
                            disabled={isSubmitting} 
                            icon={<Icon name={isSubmitting ? "hourglass_empty" : "save"} />}
                        >
                            {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}