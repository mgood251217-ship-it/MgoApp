import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import Button from "../../components/Button/Button";
import Icon from "../../components/Icon/Icon";
import { formatTime, formatRupiah, getTodayDate } from "../../services/helpers";
import { exportTransaksiPerItemExcel } from "../../services/excelService";
import { getCachedAllOrderDetail } from "../../services/apiCache";

export default function TransaksiPerItem() {
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [loading, setLoading] = useState(false);
    
    const [transaksiItemData, setTransaksiItemData] = useState({});

    const fetchTransaksiItem = async () => {
        setLoading(true);
        try {
            const res = await getCachedAllOrderDetail(startDate, endDate);
            setTransaksiItemData(res.transaksi_item || {});

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransaksiItem();
    }, []);

    const handleExportExcel = async () => {
        if (Object.keys(transaksiItemData).length === 0) {
            alert("Tidak ada data untuk diexport.");
            return;
        }
        try {
            await exportTransaksiPerItemExcel({
                transaksiItemData,
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
            key: "nomorator", 
            title: "Nomorator",
            render: (row) => <span style={{ fontWeight: "bold" }}>#{row.nomorator}</span>
        },
        { 
            key: "customer_name", 
            title: "Nama", // Disesuaikan menjadi "Nama"
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.customer_name}</span>
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
            title: "Harga Produk", // Disesuaikan menjadi "Harga Produk"
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
            render: (row) => <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatTime(row.date)}</span>
        }
    ], []);

    return (
        <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            width: "100%", 
            maxWidth: "100vw", 
            boxSizing: "border-box",
            paddingBottom: "40px"
        }}>
            <Header title="Transaksi Per Item" subtitle="Ringkasan transaksi berdasarkan produk dan item." />
            <ReportNav />
            
            <DateFilter 
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onFilter={fetchTransaksiItem}
                onExport={handleExportExcel}
                loading={loading}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                {Object.entries(transaksiItemData).map(([namaProduk, daftarOrder]) => (
                    <div key={namaProduk} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ 
                            fontSize: "16px", 
                            fontWeight: "bold", 
                            color: "var(--text)",
                            paddingLeft: "4px",
                            borderLeft: "4px solid var(--primary)"
                        }}>
                            {namaProduk}
                        </div>

                        <Table 
                            id={`table-${namaProduk.replace(/\s+/g, '-').toLowerCase()}`}
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

                {Object.keys(transaksiItemData).length === 0 && !loading && (
                    <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", background: "var(--surface)", borderRadius: "var(--radius)", border: "1px dashed var(--border)" }}>
                        Tidak ada transaksi item pada rentang tanggal ini.
                    </div>
                )}
            </div>
        </div>
    );
}