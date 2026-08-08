import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import CardTrophy from "../../components/CardTrophy/CardTrophy";
import { formatRupiah, getTodayDate } from "../../services/helpers";
import { exportStatistikKaryawanExcel } from "../../services/excelService";
import { getCachedStatistics } from "../../services/apiCache";

export default function StatistikKaryawan() {
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
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
            const res = await getCachedStatistics(startDate, endDate);

            if (res) {
                const { users, receiverCounts, pickupCounts, settingCounts, omsetPerUser } = res;
                
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

    const handleExportExcel = async () => {
        if (karyawanData.length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }
        try {
            await exportStatistikKaryawanExcel({
                karyawanData,
                topPerformers,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
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
                <Table 
                    id="table-statistik-karyawan"
                    columns={columns}
                    rows={karyawanData}
                    rowKey="id"
                    size="md"
                    showNumber={true}
                />

                {karyawanData.length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px dashed var(--border)" }}>
                        Tidak ada data statistik karyawan pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}