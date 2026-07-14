import { useEffect, useState, useCallback, useMemo } from 'react';
import api from "../api/axios";
import Header from "../components/Header/Header";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Icon from "../components/Icon/Icon";
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

    const chartOptions = useMemo(() => ({
        responsive: true,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false,
                },
            },
        }
    }), []);

    const chart30Data = useMemo(() => ({
        labels: stats.chart_30?.tanggal || [],
        datasets: [
            {
                label: 'Jumlah Order',
                data: stats.chart_30?.jumlah || [],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                yAxisID: 'y',
                tension: 0.3
            },
            {
                label: 'Total Omset',
                data: stats.chart_30?.total || [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                yAxisID: 'y1',
                tension: 0.3
            }
        ]
    }), [stats.chart_30]);

    const chart365Data = useMemo(() => ({
        labels: stats.chart_365?.bulan || [],
        datasets: [
            {
                label: 'Jumlah Order',
                data: stats.chart_365?.jumlah || [],
                backgroundColor: '#f59e0b',
                yAxisID: 'y',
            },
            {
                label: 'Total Omset',
                data: stats.chart_365?.total || [],
                backgroundColor: '#3b82f6',
                yAxisID: 'y1',
            }
        ]
    }), [stats.chart_365]);

    const userColumns = useMemo(() => [
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
                onClick={() => console.log("Edit User", row.user_id)}
            />
            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={() => console.log("Delete User", row.user_id)}
            />
        </div>
    ), []);

    const machineActions = useCallback((row) => (
        <div style={{ display: "flex", gap: "4px" }}>
            <Button
                size="sm"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={() => console.log("Edit Machine", row.machine_id)}
            />
            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="delete" />}
                onClick={() => console.log("Delete Machine", row.machine_id)}
            />
        </div>
    ), []);

    return (
        <>
            <Header title="Store Dashboard" subtitle="Ringkasan data toko dan statistik." />

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
        </>
    );
}