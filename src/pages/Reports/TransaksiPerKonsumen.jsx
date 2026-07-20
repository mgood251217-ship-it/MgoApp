import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";
import { exportTransaksiPerKonsumenExcel } from "../../services/excelService";

export default function TransaksiPerKonsumen() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [transaksiKonsumenData, setTransaksiKonsumenData] = useState({});

    const fetchTransaksiKonsumen = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "all_detail_order",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                setTransaksiKonsumenData(res.data.data.transaksi_konsumen || {});
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransaksiKonsumen();
    }, []);

    const handleExportExcel = async () => {
        if (Object.keys(transaksiKonsumenData).length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }
        try {
            await exportTransaksiPerKonsumenExcel({
                transaksiKonsumenData,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const formatWaLink = (phone) => {
        if (!phone) return "";
        let cleaned = phone.toString().replace(/\D/g, "");
        if (cleaned.startsWith("0")) {
            cleaned = "62" + cleaned.substring(1);
        }
        return cleaned;
    };

    const columns = useMemo(() => [
        { 
            key: "nomorator", 
            title: "Nomorator",
            render: (row) => <span style={{ fontWeight: "bold" }}>#{row.nomorator}</span>
        },
        { 
            key: "judul", 
            title: "Nama",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.judul}</span>
        },
        { 
            key: "size", 
            title: "Ukuran",
            render: (row) => <span style={{ fontSize: "12px" }}>{row.size || "-"}</span>
        },
        { 
            key: "finishing_names", 
            title: "Finishing",
            render: (row) => (
                <span style={{ fontSize: "12px", color: row.finishing_names && row.finishing_names !== "-" ? "var(--text)" : "var(--text-muted)" }}>
                    {row.finishing_names && row.finishing_names !== "-" ? row.finishing_names : "-"}
                </span>
            )
        },
        { 
            key: "price", 
            title: "Harga Produk",
            render: (row) => (
                <span style={{ fontWeight: "500" }}>
                    {formatRupiah(row.price)}
                </span>
            )
        },
        { 
            key: "quantity", 
            title: "Qty",
            render: (row) => <span style={{ fontWeight: "bold" }}>{row.quantity}</span>
        },
        { 
            key: "amount", 
            title: "Subtotal", 
            render: (row) => (
                <span style={{ fontWeight: "600", color: "var(--primary)" }}>
                    {formatRupiah(row.amount)}
                </span>
            )
        },
        { 
            key: "date", 
            title: "Tanggal",
            render: (row) => <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{row.date}</span>
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
            <Header title="Transaksi Per Konsumen" subtitle="Ringkasan transaksi berdasarkan nama konsumen." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchTransaksiKonsumen}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "32px" }}>
                {Object.entries(transaksiKonsumenData).map(([namaKonsumen, daftarOrder]) => (
                    <div key={namaKonsumen} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ 
                            fontSize: "16px", 
                            fontWeight: "bold", 
                            color: "var(--text)",
                            paddingLeft: "4px",
                            borderLeft: "4px solid var(--primary)"
                        }}>
                            {namaKonsumen}
                        </div>

                        <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                            <Table 
                                id={`table-${namaKonsumen.replace(/\s+/g, '-').toLowerCase()}`}
                                columns={columns}
                                rows={daftarOrder}
                                rowKey="order_item_id"
                                size="sm"
                                showNumber={true}
                                actions={(row) => (
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <button 
                                            onClick={() => {
                                                const noHp = row.phone || row.nomor || row.phone_number;
                                                const waNumber = formatWaLink(noHp);
                                                if (waNumber) {
                                                    window.open(`https://wa.me/${waNumber}`, "_blank", "noopener,noreferrer");
                                                } else {
                                                    alert("Nomor HP konsumen tidak tersedia.");
                                                }
                                            }}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: "6px",
                                                background: "rgba(76, 175, 80, 0.1)",
                                                border: "1px solid rgba(76, 175, 80, 0.2)",
                                                color: "var(--success)",
                                                cursor: "pointer",
                                                fontSize: "12px",
                                                fontWeight: "600",
                                                transition: "all 0.2s"
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = "rgba(76, 175, 80, 0.2)"}
                                            onMouseOut={(e) => e.currentTarget.style.background = "rgba(76, 175, 80, 0.1)"}
                                        >
                                            WA
                                        </button>
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
                                            Lihat
                                        </button>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                ))}

                {Object.keys(transaksiKonsumenData).length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "12px", border: "1px dashed var(--border)" }}>
                        Tidak ada transaksi konsumen pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}