import { useEffect, useState, useCallback, useMemo } from 'react';
import api from "../api/axios";
import config from "../services/config";
import Header from "../components/Header/Header";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Icon from "../components/Icon/Icon";
import Input from "../components/Input/Input";
import Select from "../components/Select/Select";
import Modal from "../components/Modal/Modal";
import { Line, Bar } from 'react-chartjs-2';
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend 
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

export default function Store() {
    const [users, setUsers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [locations, setLocations] = useState([]);
    const [stats, setStats] = useState({ chart_30: {}, chart_365: {}, summary: {} });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [loadingForm, setLoadingForm] = useState(false);

    const initialFormState = {
        user_id: "",
        name: "",
        username: "",
        password: "",
        initial: "",
        role: "ADMIN",
        picture: null,
        old_picture: "",
    };
    const [formData, setFormData] = useState(initialFormState);

    const roleOptions = useMemo(() => [
        { value: "ADMIN", label: "ADMIN" },
        { value: "MANAGER", label: "MANAGER" },
        { value: "SETTING", label: "SETTING" },
        { value: "PRODUKSI", label: "PRODUKSI" },
        { value: "ONLINE", label: "ONLINE" }
    ], []);

    const loadData = useCallback(async () => {
        try {
            const [resUsers, resMachines, resLocations, resStats] = await Promise.all([
                api.get("", { params: { action: "users" } }),
                api.get("", { params: { action: "machines" } }),
                api.get("", { params: { action: "locations" } }),
                api.get("", { params: { action: "order_analysis" } })
            ]);

            setUsers(resUsers.data?.data ?? []);
            setMachines(resMachines.data?.data ?? []);
            setLocations(resLocations.data?.data ?? []);
            setStats(resStats.data?.data ?? { chart_30: {}, chart_365: {}, summary: {} });
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleInputChange = (e) => {
        const { name, value, files } = e.target;
        if (name === "picture") {
            setFormData(prev => ({ ...prev, picture: files[0] }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const openAddModal = () => {
        setFormData(initialFormState);
        setIsEditMode(false);
        setIsModalOpen(true);
    };

    const openEditModal = (row) => {
        setFormData({
            user_id: row.user_id,
            name: row.name,
            username: row.username,
            password: "",
            initial: row.initial,
            role: row.role,
            picture: null,
            old_picture: row.picture || "",
        });
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleSubmitUser = async (e) => {
        e.preventDefault();
        setLoadingForm(true);

        try {
            const payload = new FormData();
            
            if (isEditMode) {
                payload.append("user_id", formData.user_id);
                payload.append("old_picture", formData.old_picture);
            }
            
            payload.append("name", formData.name);
            payload.append("username", formData.username);
            payload.append("initial", formData.initial);
            payload.append("role", formData.role);

            if (formData.password) {
                payload.append("password", formData.password);
            }

            if (formData.picture) {
                payload.append("picture", formData.picture);
            }

            const actionType = isEditMode ? "update_user" : "create_user";

            await api.post("", payload, {
                params: { action: actionType },
                headers: { "Content-Type": "multipart/form-data" }
            });

            setIsModalOpen(false);
            setFormData(initialFormState);
            loadData(); 
        } catch (error) {
            console.error(`Gagal ${isEditMode ? 'mengedit' : 'menambah'} user:`, error);
            alert(`Gagal ${isEditMode ? 'mengedit' : 'menambah'} user.`);
        } finally {
            setLoadingForm(false);
        }
    };

    const handleDeleteUser = useCallback(async (userId) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus user ini?")) return;

        try {
            const payload = new FormData();
            payload.append("user_id", userId);

            await api.post("", payload, {
                params: { action: "delete_user" }
            });

            loadData();
        } catch (error) {
            console.error("Gagal menghapus user:", error);
            alert("Gagal menghapus user.");
        }
    }, [loadData]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
            y: { type: 'linear', display: true, position: 'left' },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } },
        }
    }), []);

    const chart30Data = useMemo(() => ({
        labels: stats.chart_30?.tanggal || [],
        datasets: [
            {
                label: 'Jumlah Order',
                data: stats.chart_30?.jumlah || [],
                borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)',
                yAxisID: 'y', tension: 0.3
            },
            {
                label: 'Total Omset',
                data: stats.chart_30?.total || [],
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)',
                yAxisID: 'y1', tension: 0.3
            }
        ]
    }), [stats.chart_30]);

    const chart365Data = useMemo(() => ({
        labels: stats.chart_365?.bulan || [],
        datasets: [
            { label: 'Jumlah Order', data: stats.chart_365?.jumlah || [], backgroundColor: '#f59e0b', yAxisID: 'y' },
            { label: 'Total Omset', data: stats.chart_365?.total || [], backgroundColor: '#3b82f6', yAxisID: 'y1' }
        ]
    }), [stats.chart_365]);

    const userColumns = useMemo(() => [
        {
            key: "picture",
            title: "Foto",
            render: (row) => (
                <img 
                    src={row.picture ? `${config.serverUrl}/assets/img/user/${row.picture}` : `${config.serverUrl}/assets/img/user/default.jpg`} 
                    alt={row.name} 
                    style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#eee" }}
                    onError={(e) => { 
                        e.target.onerror = null; 
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.initial || row.name || 'U')}&background=random`; 
                    }}
                />
            )
        },
        { key: "name", title: "Nama" },
        { key: "username", title: "Username" },
        { key: "role", title: "Role" },
        { key: "initial", title: "Initial" }
    ], []);

    const machineColumns = useMemo(() => [
        { key: "name", title: "Nama Mesin" },
        { key: "type", title: "Tipe" }
    ], []);

    const userActions = useCallback((row) => (
        <div style={{ display: "flex", gap: "4px" }}>
            <Button
                size="sm"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={() => openEditModal(row)}
            />
            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={() => handleDeleteUser(row.user_id)}
            />
        </div>
    ), [handleDeleteUser]);

    const machineActions = useCallback((row) => (
        <div style={{ display: "flex", gap: "4px" }}>
            <Button size="sm" variant="warning" icon={<Icon name="edit" />} onClick={() => console.log("Edit Machine", row.machine_id)} />
            <Button size="sm" variant="danger" icon={<Icon name="delete" />} onClick={() => console.log("Delete Machine", row.machine_id)} />
        </div>
    ), []);

    return (
        <>
            <Header 
                title="Store Dashboard" 
                subtitle="Ringkasan data toko dan statistik." 
                actions={
                    <Button 
                        variant="primary" 
                        icon={<Icon name="plus" />} 
                        onClick={openAddModal}
                    >
                        Tambah User
                    </Button>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '20px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: 'var(--text)' }}>Total Order 30 Hari</small>
                    <h3 style={{ margin: '8px 0 0' }}>{stats.summary?.total_30?.toLocaleString() ?? 0}</h3>
                </div>
                <div style={{ padding: '20px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: 'var(--text)' }}>Total Hari Ini</small>
                    <h3 style={{ margin: '8px 0 0' }}>{stats.summary?.total_today?.toLocaleString() ?? 0}</h3>
                </div>
                <div style={{ padding: '20px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <small style={{ color: 'var(--text)' }}>Top Customer: {stats.summary?.top_customer}</small>
                    <h3 style={{ margin: '8px 0 0' }}>Rp {stats.summary?.top_total?.toLocaleString() ?? 0}</h3>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--background)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h5 style={{ marginTop: 0 }}>Statistik 30 Hari Terakhir</h5>
                    <Line data={chart30Data} options={chartOptions} />
                </div>
                <div style={{ background: 'var(--background)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h5 style={{ marginTop: 0 }}>Statistik 1 Tahun Terakhir</h5>
                    <Bar data={chart365Data} options={chartOptions} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '6.5fr 3.5fr', gap: '24px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <Table 
                        id="tableUsers"
                        title="User Management"
                        columns={userColumns} 
                        rows={users} 
                        size="sm"
                        rowKey="user_id"
                        rowDataKey="user_id"
                        actions={userActions}
                    />
                </div>
                <div style={{ background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <Table 
                        id="tableMachines"
                        title="Data Mesin"
                        columns={machineColumns} 
                        rows={machines} 
                        size="sm"
                        rowKey="machine_id"
                        rowDataKey="machine_id"
                        actions={machineActions}
                    />
                </div>
            </div>

            {locations.length > 0 && (
                <div style={{ background: 'var(--background)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', width: '100%' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Lokasi: {locations[0].name}</h4>
                    <iframe 
                        width="100%" 
                        height="400" 
                        style={{ border: 0, borderRadius: '8px' }} 
                        loading="lazy" 
                        allowFullScreen 
                        src={`https://maps.google.com/maps?q=${locations[0].latitude},${locations[0].longitude}&z=15&output=embed`}
                    ></iframe>
                </div>
            )}

            {isModalOpen && (
            <Modal 
                size='sm'
                open={isModalOpen}
                title={isEditMode ? "Edit User" : "Tambah User Baru"} 
                onClose={() => setIsModalOpen(false)}
            >
                <form onSubmit={handleSubmitUser}>
                    {isEditMode && (
                        <input type="hidden" name="old_picture" value={formData.old_picture} />
                    )}

                    <Input 
                        labelPosition="left"
                        label="Nama Lengkap" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleInputChange} 
                        required 
                    />
                    <Input 
                        labelPosition="left"
                        label="Username" 
                        name="username" 
                        value={formData.username} 
                        onChange={handleInputChange} 
                        required 
                    />
                    <Input 
                        labelPosition="left"
                        type="password" 
                        label="Password" 
                        name="password" 
                        value={formData.password} 
                        onChange={handleInputChange} 
                        required={!isEditMode}
                        placeholder={isEditMode ? "Kosongkan jika tidak diubah" : ""}
                    />
                    <Input 
                        labelPosition="left"
                        label="Inisial" 
                        name="initial" 
                        value={formData.initial} 
                        onChange={handleInputChange} 
                        required 
                        maxLength={5}
                    />
                    <Select 
                        labelPosition="left"
                        label="Role / Jabatan"
                        name="role" 
                        value={formData.role} 
                        onChange={handleInputChange} 
                        options={roleOptions} 
                    />
                    <input 
                        label="Foto"
                        type="file" 
                        name="picture" 
                        accept="image/*" 
                        onChange={handleInputChange} 
                        style={{ display: "block", width: "100%", marginTop: "12px" }}
                    />
                    {isEditMode && formData.old_picture && (
                        <small style={{ color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                            Foto saat ini: {formData.old_picture}
                        </small>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                            Batal
                        </Button>
                        <Button type="submit" variant="primary" disabled={loadingForm}>
                            {loadingForm ? "Menyimpan..." : (isEditMode ? "Simpan Perubahan" : "Simpan User")}
                        </Button>
                    </div>
                </form>
            </Modal>
            )}
        </>
    );
}