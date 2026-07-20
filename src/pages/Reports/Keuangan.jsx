import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import { formatRupiah } from "../../services/helpers";
import { exportKeuanganExcel } from "../../services/excelService";

export default function Keuangan() {
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [loading, setLoading] = useState(false);
    
    const [financeData, setFinanceData] = useState([]);
    const [expenditureData, setExpenditureData] = useState([]);
    const [incomeData, setIncomeData] = useState([]);

    const fetchFinance = async () => {
        setLoading(true);
        try {
            const res = await api.get("", { 
                params: { 
                    action: "finance",
                    start_date: startDate,
                    end_date: endDate
                } 
            });

            if (res.data?.success) {
                setFinanceData(res.data.data.finance || []);
                setExpenditureData(res.data.data.expenditure || []);
                setIncomeData(res.data.data.income || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFinance();
    }, []);

    const handleExportExcel = async () => {
        if (financeData.length === 0 && expenditureData.length === 0 && incomeData.length === 0) {
            alert("Tidak ada data keuangan untuk diexport.");
            return;
        }

        try {
            await exportKeuanganExcel({
                financeData,
                expenditureData,
                incomeData,
                startDate,
                endDate
            });
        } catch (error) {
            console.error("Gagal export excel:", error);
            alert("Terjadi kesalahan saat melakukan export.");
        }
    };

    const financeColumns = useMemo(() => [
        { 
            key: "date", 
            title: "Tanggal",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.date}</span>
        },
        { 
            key: "omset_offline", 
            title: "Omset Offline",
            render: (row) => formatRupiah(row.omset_offline)
        },
        { 
            key: "omset_online", 
            title: "Omset Online",
            render: (row) => formatRupiah(row.omset_online)
        },
        { 
            key: "total_omset", 
            title: "Total Omset",
            render: (row) => <span style={{ fontWeight: "bold", color: "var(--primary)" }}>{formatRupiah(row.total_omset)}</span>
        },
        { 
            key: "transfer", 
            title: "Transfer Masuk",
            render: (row) => formatRupiah(row.transfer)
        },
        { 
            key: "cash_masuk", 
            title: "Cash Masuk",
            render: (row) => formatRupiah(row.cash_masuk)
        },
        { 
            key: "expenditure", 
            title: "Pengeluaran",
            render: (row) => <span style={{ color: "#ef4444", fontWeight: "600" }}>{formatRupiah(row.expenditure)}</span>
        },
        { 
            key: "saldo", 
            title: "Saldo Cash",
            render: (row) => (
                <span style={{ 
                    fontWeight: "bold", 
                    color: row.saldo < 0 ? "#ef4444" : "var(--success)" 
                }}>
                    {formatRupiah(row.saldo)}
                </span>
            )
        }
    ], []);

    const expenditureColumns = useMemo(() => [
        { 
            key: "date", 
            title: "Tanggal",
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span>
        },
        { 
            key: "information", 
            title: "Keterangan",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.information}</span>
        },
        { 
            key: "nominal", 
            title: "Nominal",
            render: (row) => <span style={{ fontWeight: "600", color: "#ef4444" }}>{formatRupiah(row.nominal)}</span>
        },
        { 
            key: "img", 
            title: "Bukti",
            render: (row) => row.img ? (
                <span style={{ fontSize: "12px", color: "var(--primary)", cursor: "pointer", textDecoration: "underline" }}>
                    Lihat
                </span>
            ) : "-"
        }
    ], []);

    const incomeColumns = useMemo(() => [
        { 
            key: "date", 
            title: "Tanggal",
            render: (row) => <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{row.date}</span>
        },
        { 
            key: "information", 
            title: "Keterangan",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--text)" }}>{row.information}</span>
        },
        { 
            key: "nominal", 
            title: "Nominal",
            render: (row) => <span style={{ fontWeight: "600", color: "var(--success)" }}>{formatRupiah(row.nominal)}</span>
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
            <Header title="Laporan Keuangan" subtitle="Pantau arus kas, omset, pendapatan, dan pengeluaran toko." />
            <ReportNav />
            
            <div style={{ padding: "0 24px" }}>
                <DateFilter 
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onFilter={fetchFinance}
                    onExport={handleExportExcel}
                    loading={loading}
                />
            </div>

            <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>Rekap Keuangan</h3>
                    <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                        <Table 
                            id="table-finance"
                            columns={financeColumns}
                            rows={financeData}
                            rowKey="finance_id"
                            size="md"
                            showNumber={true}
                        />
                    </div>
                </div>

                <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", 
                    gap: "24px",
                    alignItems: "start"
                }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>Data Pengeluaran</h3>
                        <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                            <Table 
                                id="table-expenditure"
                                columns={expenditureColumns}
                                rows={expenditureData}
                                rowKey="expenditure_id"
                                size="sm"
                                showNumber={true}
                            />
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>Data Pemasukan Tambahan</h3>
                        <div style={{ background: "var(--background)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
                            <Table 
                                id="table-income"
                                columns={incomeColumns}
                                rows={incomeData}
                                rowKey="income_id"
                                size="sm"
                                showNumber={true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}