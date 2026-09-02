import { useEffect, useState, useCallback, useMemo } from 'react';
import api from "../api/axios";
import Header from "../components/Header/Header";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Icon from "../components/Icon/Icon";
import Input from "../components/Input/Input";
import Select from "../components/Select/Select";
import Modal from "../components/Modal/Modal";
import {
    getCachedUsers, getCachedMachines, getCachedLocations, getCachedOrdersAnalysis,
    clearUsersCache, clearMachinesCache, clearLocationsCache
} from '../services/apiCache';
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

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function MapClickHandler({ onMapClick }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
        }
    });
    return null;
}

export default function Store() {
    const [users, setUsers] = useState([]);
    const [machines, setMachines] = useState([]);
    const [locations, setLocations] = useState([]);
    const [stats, setStats] = useState({ chart_30: {}, chart_365: {}, summary: {} });

    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isUserEditMode, setIsUserEditMode] = useState(false);
    const [loadingUserForm, setLoadingUserForm] = useState(false);

    const initialUserFormState = {
        user_id: "",
        name: "",
        username: "",
        password: "",
        initial: "",
        role: "ADMIN",
        picture: null,
        old_picture: "",
    };
    const [userFormData, setUserFormData] = useState(initialUserFormState);

    const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
    const [isMachineEditMode, setIsMachineEditMode] = useState(false);
    const [loadingMachineForm, setLoadingMachineForm] = useState(false);

    const initialMachineFormState = {
        machine_id: "",
        name: "",
        type: ""
    };
    const [machineFormData, setMachineFormData] = useState(initialMachineFormState);

    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [pendingLocation, setPendingLocation] = useState(null);
    const [loadingLocationForm, setLoadingLocationForm] = useState(false);

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
                getCachedUsers(),
                getCachedMachines(),
                getCachedLocations(),
                getCachedOrdersAnalysis()
            ]);

            setUsers(resUsers);
            setMachines(resMachines);
            setLocations(resLocations);
            setStats(resStats);
        } catch (error) {
            console.error(error);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleUserInputChange = (e) => {
        const { name, value, files } = e.target;
        if (name === "picture") {
            setUserFormData(prev => ({ ...prev, picture: files[0] }));
        } else {
            setUserFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const openAddUserModal = () => {
        setUserFormData(initialUserFormState);
        setIsUserEditMode(false);
        setIsUserModalOpen(true);
    };

    const openEditUserModal = (row) => {
        setUserFormData({
            user_id: row.user_id,
            name: row.name,
            username: row.username,
            password: "",
            initial: row.initial,
            role: row.role,
            picture: null,
            old_picture: row.picture || "",
        });
        setIsUserEditMode(true);
        setIsUserModalOpen(true);
    };

    const handleSubmitUser = async (e) => {
        e.preventDefault();
        setLoadingUserForm(true);

        try {
            const payload = new FormData();
            
            if (isUserEditMode) {
                payload.append("user_id", userFormData.user_id);
                payload.append("old_picture", userFormData.old_picture);
            }
            
            payload.append("name", userFormData.name);
            payload.append("username", userFormData.username);
            payload.append("initial", userFormData.initial);
            payload.append("role", userFormData.role);

            if (userFormData.password) {
                payload.append("password", userFormData.password);
            }

            if (userFormData.picture) {
                payload.append("picture", userFormData.picture);
            }

            const actionType = isUserEditMode ? "update_user" : "create_user";

            await api.post("", payload, {
                params: { action: actionType },
                headers: { "Content-Type": "multipart/form-data" }
            });

            setIsUserModalOpen(false);
            setUserFormData(initialUserFormState);
            await clearUsersCache();
            loadData();
        } catch (error) {
            alert(`Gagal ${isUserEditMode ? 'mengedit' : 'menambah'} user.`);
        } finally {
            setLoadingUserForm(false);
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

            await clearUsersCache();
            loadData();
        } catch (error) {
            alert("Gagal menghapus user.");
        }
    }, [loadData]);

    const handleMachineInputChange = (e) => {
        const { name, value } = e.target;
        setMachineFormData(prev => ({ ...prev, [name]: value }));
    };

    const openAddMachineModal = () => {
        setMachineFormData(initialMachineFormState);
        setIsMachineEditMode(false);
        setIsMachineModalOpen(true);
    };

    const openEditMachineModal = (row) => {
        setMachineFormData({
            machine_id: row.machine_id,
            name: row.name,
            type: row.type
        });
        setIsMachineEditMode(true);
        setIsMachineModalOpen(true);
    };

    const handleSubmitMachine = async (e) => {
        e.preventDefault();
        setLoadingMachineForm(true);

        try {
            const payload = new FormData();
            
            if (isMachineEditMode) {
                payload.append("machine_id", machineFormData.machine_id);
            }
            
            payload.append("name", machineFormData.name);
            payload.append("type", machineFormData.type);

            const actionType = isMachineEditMode ? "update_machine" : "create_machine";

            await api.post("", payload, {
                params: { action: actionType },
                headers: { "Content-Type": "multipart/form-data" }
            });

            setIsMachineModalOpen(false);
            setMachineFormData(initialMachineFormState);
            await clearMachinesCache();
            loadData();
        } catch (error) {
            alert(`Gagal ${isMachineEditMode ? 'mengedit' : 'menambah'} mesin.`);
        } finally {
            setLoadingMachineForm(false);
        }
    };

    const handleDeleteMachine = useCallback(async (machineId) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus mesin ini?")) return;

        try {
            const payload = new FormData();
            payload.append("machine_id", machineId);

            await api.post("", payload, {
                params: { action: "delete_machine" }
            });

            await clearMachinesCache();
            loadData();
        } catch (error) {
            alert("Gagal menghapus mesin.");
        }
    }, [loadData]);

    const handleMapClick = (lat, lng) => {
        setPendingLocation({ lat, lng });
        setIsLocationModalOpen(true);
    };

    const handleSubmitLocation = async (e) => {
        e.preventDefault();
        if (!pendingLocation) return;
        setLoadingLocationForm(true);

        try {
            const payload = new FormData();
            payload.append("latitude", pendingLocation.lat);
            payload.append("longitude", pendingLocation.lng);

            await api.post("", payload, {
                params: { action: "set_location" }
            });

            alert("Lokasi berhasil ditambahkan!");
            await clearLocationsCache();
            loadData();
            
            setIsLocationModalOpen(false);
            setPendingLocation(null);
        } catch (error) {
            console.error(error);
            alert("Gagal menambahkan lokasi.");
        } finally {
            setLoadingLocationForm(false);
        }
    };

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
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
            key: "picture_link",
            title: "Foto",
            render: (row) => (
                <img 
                    src={row.picture_link} 
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
                onClick={() => openEditUserModal(row)}
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
            <Button 
                size="sm" 
                variant="warning" 
                icon={<Icon name="edit" />} 
                onClick={() => openEditMachineModal(row)} 
            />
            <Button 
                size="sm" 
                variant="danger" 
                icon={<Icon name="delete" />} 
                onClick={() => handleDeleteMachine(row.machine_id)} 
            />
        </div>
    ), [handleDeleteMachine]);

    const mapCenter = locations.length > 0 
        ? [parseFloat(locations[0].latitude), parseFloat(locations[0].longitude)]
        : [-6.9175, 107.6191];

    return (
        <div style={{ paddingBottom: "32px" }}>
            <Header 
                title="Store Dashboard" 
                subtitle="Ringkasan data toko dan statistik." 
                actions={
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <Button 
                            variant="primary" 
                            icon={<Icon name="add" />}
                            onClick={openAddUserModal}
                        >
                            Tambah User
                        </Button>
                        <Button 
                            variant="success" 
                            icon={<Icon name="add" />} 
                            onClick={openAddMachineModal}
                        >
                            Tambah Mesin
                        </Button>
                    </div>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--background)' }}>
                    <small style={{ color: 'var(--text)' }}>Total Order 30 Hari</small>
                    <h3 style={{ margin: '8px 0 0' }}>{stats.summary?.total_30?.toLocaleString() ?? 0}</h3>
                </div>
                <div style={{ padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--background)' }}>
                    <small style={{ color: 'var(--text)' }}>Total Hari Ini</small>
                    <h3 style={{ margin: '8px 0 0' }}>{stats.summary?.total_today?.toLocaleString() ?? 0}</h3>
                </div>
                <div style={{ padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--background)' }}>
                    <small style={{ color: 'var(--text)' }}>Top Customer: {stats.summary?.top_customer}</small>
                    <h3 style={{ margin: '8px 0 0' }}>Rp {stats.summary?.top_total?.toLocaleString() ?? 0}</h3>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--background)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', height: '320px', display: 'flex', flexDirection: 'column' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '12px' }}>Statistik 30 Hari Terakhir</h5>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Line data={chart30Data} options={chartOptions} />
                    </div>
                </div>
                <div style={{ background: 'var(--background)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', height: '320px', display: 'flex', flexDirection: 'column' }}>
                    <h5 style={{ marginTop: 0, marginBottom: '12px' }}>Statistik 1 Tahun Terakhir</h5>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Bar data={chart365Data} options={chartOptions} />
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                <div style={{ overflow: 'hidden' }}>
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
                <div style={{ overflow: 'hidden' }}>
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

            <div style={{ background: 'var(--background)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: '100%', marginBottom: '24px' }}>
                <h4 style={{ marginTop: 0, marginBottom: '8px' }}>Lokasi Cabang</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)' }}>Klik di mana saja pada peta untuk menambahkan titik lokasi baru.</p>
                <div style={{ height: '400px', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <MapContainer 
                        center={mapCenter} 
                        zoom={13} 
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        
                        {locations.map((loc, idx) => (
                            <Marker 
                                key={loc.id || idx} 
                                position={[parseFloat(loc.latitude), parseFloat(loc.longitude)]}
                                icon={customIcon}
                            >
                                <Popup>
                                    <strong>{loc.name || `Lokasi ${idx + 1}`}</strong><br/>
                                    Lat: {loc.latitude}<br/>
                                    Lng: {loc.longitude}
                                </Popup>
                            </Marker>
                        ))}
                        
                        <MapClickHandler onMapClick={handleMapClick} />
                    </MapContainer>
                </div>
            </div>

            {isLocationModalOpen && (
            <Modal 
                size='sm'
                open={isLocationModalOpen}
                title="Tambah Lokasi Cabang" 
                onClose={() => setIsLocationModalOpen(false)}
            >
                <form onSubmit={handleSubmitLocation}>
                    <div style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--text)" }}>
                        <p style={{ marginTop: 0, marginBottom: "12px" }}>Anda akan menyimpan titik koordinat berikut sebagai lokasi baru:</p>
                        <div style={{ padding: "12px", background: "var(--background)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                            <strong>Latitude:</strong> {pendingLocation?.lat.toFixed(6)} <br/>
                            <strong>Longitude:</strong> {pendingLocation?.lng.toFixed(6)}
                        </div>
                    </div>
                    <Button
                        type="submit"
                        variant="primary"
                        size='full-lg'
                        disabled={loadingLocationForm}
                        icon={<Icon name="save" />}>
                        {loadingLocationForm ? "Menyimpan..." : "Simpan Lokasi"}
                    </Button>
                </form>
            </Modal>
            )}

            {isUserModalOpen && (
            <Modal 
                size='sm'
                open={isUserModalOpen}
                title={isUserEditMode ? "Edit User" : "Tambah User Baru"} 
                onClose={() => setIsUserModalOpen(false)}
            >
                <form onSubmit={handleSubmitUser}>
                    {isUserEditMode && (
                        <input type="hidden" name="old_picture" value={userFormData.old_picture} />
                    )}

                    <Input 
                        labelPosition="left"
                        label="Nama Lengkap" 
                        name="name" 
                        value={userFormData.name} 
                        onChange={handleUserInputChange} 
                        required 
                    />
                    <Input 
                        labelPosition="left"
                        label="Username" 
                        name="username" 
                        value={userFormData.username} 
                        onChange={handleUserInputChange} 
                        required 
                    />
                    <Input 
                        labelPosition="left"
                        type="password" 
                        label="Password" 
                        name="password" 
                        value={userFormData.password} 
                        onChange={handleUserInputChange} 
                        required={!isUserEditMode}
                        placeholder={isUserEditMode ? "Kosongkan jika tidak diubah" : ""}
                    />
                    <Input 
                        labelPosition="left"
                        label="Inisial" 
                        name="initial" 
                        value={userFormData.initial} 
                        onChange={handleUserInputChange} 
                        required 
                        maxLength={5}
                    />
                    <Select 
                        labelPosition="left"
                        label="Role / Jabatan"
                        name="role" 
                        value={userFormData.role} 
                        onChange={handleUserInputChange} 
                        options={roleOptions} 
                    />
                    <input 
                        type="file" 
                        name="picture" 
                        accept="image/*" 
                        onChange={handleUserInputChange} 
                        style={{ display: "block", width: "100%", marginTop: "12px" }}
                    />
                    {isUserEditMode && userFormData.old_picture && (
                        <small style={{ color: "var(--text-muted)", display: "block", marginTop: "4px" }}>
                            Foto saat ini: {userFormData.old_picture}
                        </small>
                    )}

                    <Button
                        size='full-lg'
                        type="submit"
                        variant="primary"
                        disabled={loadingUserForm}
                        icon={<Icon name="save" />} >
                        {loadingUserForm ? "Menyimpan..." : (isUserEditMode ? "Simpan Perubahan" : "Simpan User")}
                    </Button>
                </form>
            </Modal>
            )}

            {isMachineModalOpen && (
            <Modal 
                size='sm'
                open={isMachineModalOpen}
                title={isMachineEditMode ? "Edit Mesin" : "Tambah Mesin Baru"} 
                onClose={() => setIsMachineModalOpen(false)}
            >
                <form onSubmit={handleSubmitMachine}>
                    <Input 
                        labelPosition="left"
                        label="Nama Mesin" 
                        name="name" 
                        value={machineFormData.name} 
                        onChange={handleMachineInputChange} 
                        required 
                    />
                    <Input 
                        labelPosition="left"
                        label="Tipe Mesin" 
                        name="type" 
                        value={machineFormData.type} 
                        onChange={handleMachineInputChange} 
                        required 
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        size='full-lg'
                        disabled={loadingMachineForm}
                        icon={<Icon name="save" />}>
                        {loadingMachineForm ? "Menyimpan..." : (isMachineEditMode ? "Simpan Perubahan" : "Simpan Mesin")}
                    </Button>
                </form>
            </Modal>
            )}
        </div>
    );
}