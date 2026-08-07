import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Icon from "../../components/Icon/Icon";
import { formatRupiah, formatKeInternasional } from "../../services/helpers";
import { exportPiutangExcel } from "../../services/excelService";
import { getCachedPiutang } from "../../services/apiCache";

export default function Piutang() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    
    const [piutangData, setPiutangData] = useState([]);
    const [totalPiutang, setTotalPiutang] = useState(0);

    const fetchPiutang = async () => {
        setLoading(true);
        try {
            const res = await getCachedPiutang();

            if (res) {
                setPiutangData(res.data || []);
                setTotalPiutang(res.total || 0);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPiutang();
    }, []);

    const handleExportExcel = async () => {
        if (piutangData.length === 0) {
            alert("Tidak ada data piutang untuk diexport.");
            return;
        }
        
        try {
            await exportPiutangExcel({
                piutangData,
                totalPiutang
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const formatWaLink = (phone) => {
        if (!phone) return "#";
        let cleaned = phone.replace(/\D/g, ""); 
        
        if (cleaned.startsWith("0")) {
            cleaned = "62" + cleaned.substring(1);
        }
        return `https://wa.me/${cleaned}`;
    };

    const columns = useMemo(() => [
        { 
            key: "nomorator", 
            title: "Nomorator",
            render: (row) => <span style={{ fontWeight: "bold" }}>#{row.nomorator}</span>
        },
        { 
            key: "nama", 
            title: "Nama Konsumen",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.nama}</span>
        },
        { 
            key: "nomor", 
            title: "Nomor",
            render: (row) => (
                <a 
                    href={formatKeInternasional(row.nomor)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: "var(--primary)", textDecoration: "none", fontWeight: "500" }}
                    title="Hubungi via WhatsApp"
                >
                    {row.nomor || "-"}
                </a>
            )
        },
        { 
            key: "hutang", 
            title: "Piutang", 
            render: (row) => (
                <span style={{ fontWeight: "bold", color: "var(--danger)" }}>
                    {formatRupiah(Number(row.hutang))}
                </span>
            )
        },
        { 
            key: "op_initial", 
            title: "Operator",
            render: (row) => <span style={{ fontWeight: "500" }}>{row.op_initial}</span>
        },
        { 
            key: "date", 
            title: "Tanggal",
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span>
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
            <Header title="Laporan Piutang" subtitle="Daftar tagihan konsumen yang belum lunas." />
            <ReportNav />
            
            <div style={{ 
                padding: "0 24px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "24px"
            }}>
                <Button 
                    onClick={fetchPiutang}
                    disabled={loading}
                >
                    {loading ? "Memuat..." : "Refresh Data"}
                </Button>

                <Button 
                    onClick={handleExportExcel}
                    variant="success"
                    icon={<Icon name="excel"/>}
                >
                    Export Excel
                </Button>
            </div>

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table 
                        id="table-piutang"
                        columns={columns}
                        rows={piutangData}
                        rowKey="order_id"
                        size="md"
                        showNumber={true}
                        actions={(row) => (
                                <Button 
                                    icon={<Icon name="next" />}
                                    size="sm"
                                    onClick={() => {
                                        const params = new URLSearchParams({
                                            search: row.nomorator,
                                            start_date: row.date,
                                            end_date: row.date 
                                        }).toString();

                                        navigate(`/reports/transaksi-detail?${params}`);
                                    }}
                                >
                                    Detail
                                </Button>
                        )}
                    />
                </div>

                <div style={{ 
                    padding: "20px", 
                    background: "var(--background)", 
                    borderRadius: "12px", 
                    border: "1px dashed var(--border)",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center"
                }}>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total Keseluruhan Piutang</div>
                        <div style={{ fontWeight: "bold", fontSize: "24px", color: "var(--danger)" }}>
                            {formatRupiah(totalPiutang)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}