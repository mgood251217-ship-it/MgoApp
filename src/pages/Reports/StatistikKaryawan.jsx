import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";

export default function StatistikKaryawan() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [karyawanData, setKaryawanData] = useState([]);
    const [topPerformers, setTopPerformers] = useState({
        receiver: null,
        pickup: null,
        setting: null,
        omset: null
    });

    const fetchStatistik = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "statistics",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success && res.data.data) {
                const { users, receiverCounts, pickupCounts, settingCounts, omsetPerUser } = res.data.data;
                
                const normUsers = users || {};
                const normReceiver = receiverCounts || {};
                const normPickup = Array.isArray(pickupCounts) ? {} : (pickupCounts || {});
                const normSetting = settingCounts || {};
                const normOmset = omsetPerUser || {};

                const allUserIds = new Set([
                    ...Object.keys(normUsers),
                    ...Object.keys(normReceiver),
                    ...Object.keys(normPickup),
                    ...Object.keys(normSetting),
                    ...Object.keys(normOmset)
                ]);

                const formattedData = Array.from(allUserIds).map(id => ({
                    id,
                    name: normUsers[id] || `User ${id}`,
                    receiver: Number(normReceiver[id]) || 0,
                    pickup: Number(normPickup[id]) || 0,
                    setting: Number(normSetting[id]) || 0,
                    omset: Number(normOmset[id]) || 0
                })).filter(u => u.receiver > 0 || u.pickup > 0 || u.setting > 0 || u.omset > 0);

                formattedData.sort((a, b) => b.omset - a.omset);

                setKaryawanData(formattedData);

                if (formattedData.length > 0) {
                    setTopPerformers({
                        receiver: [...formattedData].sort((a, b) => b.receiver - a.receiver)[0],
                        pickup: [...formattedData].sort((a, b) => b.pickup - a.pickup)[0],
                        setting: [...formattedData].sort((a, b) => b.setting - a.setting)[0],
                        omset: [...formattedData].sort((a, b) => b.omset - a.omset)[0]
                    });
                } else {
                    setTopPerformers({ receiver: null, pickup: null, setting: null, omset: null });
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatistik();
    }, []);

    const handleExportExcel = () => {
        alert("Fitur Export Excel sedang dipersiapkan.");
    };

    const columns = useMemo(() => [
        { 
            key: "name", 
            title: "Nama Karyawan",
            render: (row) => <span style={{ fontWeight: "bold", color: "var(--text)" }}>{row.name}</span>
        },
        { 
            key: "receiver", 
            title: "Penerima Konsumen",
            render: (row) => <span>{row.receiver} Kali</span>
        },
        { 
            key: "setting", 
            title: "Setting",
            render: (row) => <span>{row.setting} Kali</span>
        },
        { 
            key: "pickup", 
            title: "Pengambilan Barang",
            render: (row) => <span>{row.pickup} Kali</span>
        },
        { 
            key: "omset", 
            title: "Total Omset",
            render: (row) => (
                <span style={{ fontWeight: "600", color: "var(--primary)" }}>
                    {formatRupiah(row.omset)}
                </span>
            )
        }
    ], []);

    const CardTrophy = ({ title, value, person, unit }) => (
        <div style={{
            flex: "1 1 200px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
        }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase" }}>
                🏆 {title}
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--primary)" }}>
                {person || "-"}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text)" }}>
                {value !== null && value !== undefined ? `${value} ${unit}` : "-"}
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
            <Header title="Statistik Karyawan" subtitle="Performa kinerja karyawan berdasarkan transaksi dan aktivitas." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchStatistik}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ 
                padding: "0 24px", 
                marginTop: "24px", 
                display: "flex", 
                gap: "16px", 
                flexWrap: "wrap" 
            }}>
                <CardTrophy 
                    title="Penerima Terbanyak" 
                    person={topPerformers.receiver?.receiver > 0 ? topPerformers.receiver.name : null} 
                    value={topPerformers.receiver?.receiver > 0 ? topPerformers.receiver.receiver : null} 
                    unit="Konsumen"
                />
                <CardTrophy 
                    title="Setting Terbanyak" 
                    person={topPerformers.setting?.setting > 0 ? topPerformers.setting.name : null} 
                    value={topPerformers.setting?.setting > 0 ? topPerformers.setting.setting : null} 
                    unit="Kali"
                />
                <CardTrophy 
                    title="Pengambilan Barang" 
                    person={topPerformers.pickup?.pickup > 0 ? topPerformers.pickup.name : null} 
                    value={topPerformers.pickup?.pickup > 0 ? topPerformers.pickup.pickup : null} 
                    unit="Kali"
                />
                <CardTrophy 
                    title="Omset Tertinggi" 
                    person={topPerformers.omset?.omset > 0 ? topPerformers.omset.name : null} 
                    value={topPerformers.omset?.omset > 0 ? formatRupiah(topPerformers.omset.omset) : null} 
                    unit=""
                />
            </div>

            <div style={{ padding: "0 24px", marginTop: "24px", display: "flex", flexDirection: "column", gap: "32px" }}>
                <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table 
                        id="table-statistik-karyawan"
                        columns={columns}
                        rows={karyawanData}
                        rowKey="id"
                        size="md"
                        showNumber={true}
                    />
                </div>

                {karyawanData.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                        Tidak ada data statistik karyawan pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}