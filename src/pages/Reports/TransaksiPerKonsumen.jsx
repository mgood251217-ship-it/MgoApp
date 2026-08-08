import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Icon from "../../components/Icon/Icon"
import { formatRupiah, getTodayDate } from "../../services/helpers";
import { exportTransaksiPerKonsumenExcel } from "../../services/excelService";
import { getCachedAllOrderDetail } from "../../services/apiCache";

export default function TransaksiPerKonsumen() {
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [loading, setLoading] = useState(false);
    
    const [transaksiKonsumenData, setTransaksiKonsumenData] = useState({});

    const fetchTransaksiKonsumen = async () => {
        setLoading(true);
        try {
            const res = await getCachedAllOrderDetail(startDate, endDate);
            setTransaksiKonsumenData(res.transaksi_konsumen || {});
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

                        <Table 
                            id={`table-${namaKonsumen.replace(/\s+/g, '-').toLowerCase()}`}
                            columns={columns}
                            rows={daftarOrder}
                            rowKey="order_item_id"
                            size="sm"
                            showNumber={true}
                            actions={(row) => (
                                <div style={{ display: "flex", gap: "6px" }}>
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
                                        Lihat
                                    </Button>
                                </div>
                            )}
                        />
                    </div>
                ))}

                {Object.keys(transaksiKonsumenData).length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px dashed var(--border)" }}>
                        Tidak ada transaksi konsumen pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}