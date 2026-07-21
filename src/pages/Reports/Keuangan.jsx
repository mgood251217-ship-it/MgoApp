import { useEffect, useState, useMemo } from "react";
import api from "../../api/axios";
import Header from "../../components/Header/Header";
import ReportNav from "../../components/ReportNav/ReportNav";
import DateFilter from "../../components/DateFilter/DateFilter";
import Table from "../../components/Table/Table";
import Modal from "../../components/Modal/Modal";
import Input from "../../components/Input/Input";
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

    // Modal States
    const [showExpModal, setShowExpModal] = useState(false);
    const [showIncModal, setShowIncModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null); // State untuk modal foto
    
    // Form States
    const [editExpData, setEditExpData] = useState(null);
    const [editIncData, setEditIncData] = useState(null);
    
    const [expForm, setExpForm] = useState({ information: "", nominal: "", picture: null });
    const [incForm, setIncForm] = useState({ information: "", nominal: "" });

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

    const handleSyncFinance = async () => {
        if (!window.confirm("Sinkronisasi data keuangan akan menghitung ulang data pada periode ini. Lanjutkan?")) return;
        
        try {
            const res = await api.post("", new FormData(), {
                params: {
                    action: "sync_finance",
                    start_date: startDate,
                    end_date: endDate
                }
            });
            if (res.data?.success) {
                alert("Data keuangan berhasil disinkronisasi.");
                fetchFinance();
            } else {
                alert("Gagal melakukan sinkronisasi.");
            }
        } catch (error) {
            console.error(error);
            alert("Terjadi kesalahan sistem saat sinkronisasi.");
        }
    };

    // Form Handlers
    const handleSaveExpenditure = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append("information", expForm.information);
        formData.append("nominal", expForm.nominal);
        formData.append("date", startDate);

        let action = "create_expenditure";
        if (editExpData) {
            action = "update_expenditure";
            formData.append("expenditure_id", editExpData.expenditure_id);
        } else {
            if (expForm.picture) {
                formData.append("picture", expForm.picture);
            }
        }

        try {
            const res = await api.post("", formData, { params: { action } });
            if (res.data?.success) {
                alert(`Pengeluaran berhasil ${editExpData ? 'diperbarui' : 'ditambahkan'}.`);
                setShowExpModal(false);
                fetchFinance();
            } else {
                alert("Gagal menyimpan pengeluaran.");
            }
        } catch (error) {
            console.error(error);
            alert("Terjadi kesalahan sistem.");
        }
    };

    const handleSaveIncome = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append("information", incForm.information);
        formData.append("nominal", incForm.nominal);
        formData.append("date", startDate);

        let action = "create_income";
        if (editIncData) {
            action = "update_income";
            formData.append("income_id", editIncData.income_id);
        }

        try {
            const res = await api.post("", formData, { params: { action } });
            if (res.data?.success) {
                alert(`Pemasukan berhasil ${editIncData ? 'diperbarui' : 'ditambahkan'}.`);
                setShowIncModal(false);
                fetchFinance();
            } else {
                alert("Gagal menyimpan pemasukan.");
            }
        } catch (error) {
            console.error(error);
            alert("Terjadi kesalahan sistem.");
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
            key: "img_link", 
            title: "Bukti",
            render: (row) => row.img_link ? (
                <img 
                    src={row.img_link} 
                    alt="Bukti Pengeluaran"
                    onClick={() => setSelectedImage(row.img_link)}
                    style={{ 
                        width: "40px", 
                        height: "40px", 
                        objectFit: "cover", 
                        borderRadius: "6px", 
                        cursor: "pointer", 
                        border: "1px solid var(--border)",
                        transition: "transform 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                    onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                />
            ) : "-"
        },
        {
            key: "action",
            title: "Aksi",
            render: (row) => (
                <button 
                    onClick={() => {
                        setEditExpData(row);
                        setExpForm({ information: row.information, nominal: row.nominal, picture: null });
                        setShowExpModal(true);
                    }}
                    style={{
                        padding: "4px 8px", background: "var(--primary)", color: "#fff",
                        border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                    }}
                >
                    Edit
                </button>
            )
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
        },
        {
            key: "action",
            title: "Aksi",
            render: (row) => (
                <button 
                    onClick={() => {
                        setEditIncData(row);
                        setIncForm({ information: row.information, nominal: row.nominal });
                        setShowIncModal(true);
                    }}
                    style={{
                        padding: "4px 8px", background: "var(--primary)", color: "#fff",
                        border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "11px"
                    }}
                >
                    Edit
                </button>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>Rekap Keuangan</h3>
                        <button 
                            onClick={handleSyncFinance}
                            style={{
                                padding: "6px 12px",
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: "600",
                                fontSize: "12px",
                                color: "var(--text)"
                            }}
                        >
                            🔄 Sync Data
                        </button>
                    </div>
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>Data Pengeluaran</h3>
                            <button 
                                onClick={() => {
                                    setEditExpData(null);
                                    setExpForm({ information: "", nominal: "", picture: null });
                                    setShowExpModal(true);
                                }}
                                style={{
                                    padding: "6px 12px",
                                    background: "#ef4444",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "12px",
                                    color: "#fff"
                                }}
                            >
                                ＋ Tambah
                            </button>
                        </div>
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)", fontWeight: "600" }}>Data Pemasukan Tambahan</h3>
                            <button 
                                onClick={() => {
                                    setEditIncData(null);
                                    setIncForm({ information: "", nominal: "" });
                                    setShowIncModal(true);
                                }}
                                style={{
                                    padding: "6px 12px",
                                    background: "var(--success)",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "12px",
                                    color: "#fff"
                                }}
                            >
                                ＋ Tambah
                            </button>
                        </div>
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

            <Modal 
                open={!!selectedImage} 
                onClose={() => setSelectedImage(null)} 
                title="Bukti Pengeluaran"
                size="lg"
            >
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "16px", background: "var(--background)", borderRadius: "8px" }}>
                    {selectedImage && (
                        <img 
                            src={selectedImage} 
                            alt="Bukti Lengkap" 
                            style={{ 
                                maxWidth: "100%", 
                                maxHeight: "70vh", 
                                objectFit: "contain", 
                                borderRadius: "8px" 
                            }} 
                        />
                    )}
                </div>
            </Modal>

            <Modal 
                open={showExpModal} 
                onClose={() => setShowExpModal(false)} 
                title={editExpData ? "Edit Pengeluaran" : "Tambah Pengeluaran"}
            >
                <form onSubmit={handleSaveExpenditure} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <Input 
                        label="Keterangan" 
                        type="text"
                        value={expForm.information} 
                        onChange={(e) => setExpForm({...expForm, information: e.target.value})} 
                        required
                    />
                    <Input 
                        label="Nominal (Rp)" 
                        type="number"
                        value={expForm.nominal} 
                        onChange={(e) => setExpForm({...expForm, nominal: e.target.value})} 
                        required
                    />
                    {!editExpData && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>Bukti Pengeluaran</label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => setExpForm({...expForm, picture: e.target.files[0]})}
                                style={{
                                    padding: "8px",
                                    border: "1px solid var(--border)",
                                    borderRadius: "6px",
                                    background: "var(--surface)"
                                }}
                                required
                            />
                        </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                        <button type="button" onClick={() => setShowExpModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>Batal</button>
                        <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontWeight: "600" }}>Simpan</button>
                    </div>
                </form>
            </Modal>

            <Modal 
                open={showIncModal} 
                onClose={() => setShowIncModal(false)} 
                title={editIncData ? "Edit Pemasukan" : "Tambah Pemasukan"}
            >
                <form onSubmit={handleSaveIncome} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <Input 
                        label="Keterangan" 
                        type="text"
                        value={incForm.information} 
                        onChange={(e) => setIncForm({...incForm, information: e.target.value})} 
                        required
                    />
                    <Input 
                        label="Nominal (Rp)" 
                        type="number"
                        value={incForm.nominal} 
                        onChange={(e) => setIncForm({...incForm, nominal: e.target.value})} 
                        required
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                        <button type="button" onClick={() => setShowIncModal(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}>Batal</button>
                        <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontWeight: "600" }}>Simpan</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}