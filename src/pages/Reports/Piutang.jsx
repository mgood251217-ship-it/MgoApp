import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";

export default function Piutang() {
    const [loading, setLoading] = useState(false);
    
    const [piutangData, setPiutangData] = useState([]);
    const [totalPiutang, setTotalPiutang] = useState(0);

    const fetchPiutang = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { action: "piutang" } 
            });

            if (res.data?.success) {
                setPiutangData(res.data.data.data || []);
                setTotalPiutang(res.data.data.total || 0);
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

    const handleExportExcel = () => {
        alert("Fitur Export Excel sedang dipersiapkan.");
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
                    href={formatWaLink(row.nomor)} 
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
                <span style={{ fontWeight: "bold", color: "#ef4444" }}>
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
            
            {/* Header / Aksi Sederhana (Tanpa DateFilter karena tidak butuh start_date & end_date) */}
            <div style={{ 
                padding: "0 24px", 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "24px"
            }}>
                <button 
                    onClick={fetchPiutang}
                    disabled={loading}
                    style={{
                        padding: "8px 16px",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }}
                >
                    {loading ? "Memuat..." : "Refresh Data"}
                </button>

                <button 
                    onClick={handleExportExcel}
                    style={{
                        padding: "8px 16px",
                        background: "var(--success)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "600"
                    }}
                >
                    Export Excel
                </button>
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
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button 
                                    onClick={() => console.log("Detail Order", row.order_id)}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        background: "var(--surface)",
                                        border: "1px solid var(--border)",
                                        color: "var(--text)",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        transition: "all 0.2s"
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = "var(--border)"}
                                    onMouseOut={(e) => e.currentTarget.style.background = "var(--surface)"}
                                >
                                    Detail
                                </button>
                                <a 
                                    href={formatWaLink(row.nomor)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        background: "rgba(76, 175, 80, 0.1)",
                                        border: "1px solid rgba(76, 175, 80, 0.2)",
                                        color: "var(--success)",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        textDecoration: "none",
                                        display: "inline-block"
                                    }}
                                    title="Tagih via WhatsApp"
                                >
                                    WA
                                </a>
                            </div>
                        )}
                    />
                </div>

                {/* Ringkasan Total Piutang */}
                <div style={{ 
                    padding: "20px", 
                    background: "var(--surface)", 
                    borderRadius: "12px", 
                    border: "1px dashed var(--border)",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center"
                }}>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total Keseluruhan Piutang</div>
                        <div style={{ fontWeight: "bold", fontSize: "24px", color: "#ef4444" }}>
                            {formatRupiah(totalPiutang)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}