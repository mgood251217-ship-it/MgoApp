import { useEffect, useState, useCallback, useMemo } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Select from "../components/Select/Select";
import Button from "../components/Button/Button";
import Icon from "../components/Icon/Icon";
import Table from "../components/Table/Table";

export default function Meteran() {
    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const [category, setCategory] = useState("meter_outdoor");
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    
    const [dataState, setDataState] = useState(null);

    const categoryOptions = useMemo(() => [
        { value: "meter_outdoor", label: "Outdoor" },
        { value: "meter_indoor", label: "Indoor" },
        { value: "meter_jersey", label: "Jersey" },
        { value: "meter_akrilik", label: "Akrilik" },
        { value: "meter_laser", label: "Laser A3" },
        { value: "meter_merchandise", label: "Merchandise" },
        { value: "meter_sublim", label: "Sublim" },
        { value: "meter_mercendise_akrilik", label: "Merchandise Akrilik" },
        { value: "meter_dtf", label: "DTF" },
        { value: "meter_cetakan", label: "Cetakan" },
        { value: "meter_bahan_sublim", label: "Bahan Sublim" },
        { value: "meter_finishing_jersey", label: "Finishing Jersey" }
    ], []);

    const loadData = useCallback(async () => {
        try {
            const res = await api.get("", {
                params: {
                    action: category,
                    start_date: startDate,
                    end_date: endDate
                }
            });
            setDataState(res.data?.data || null);
        } catch (err) {
            console.error(err);
        }
    }, [category, startDate, endDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleExportExcel = () => {
        console.log("Export Excel dijalankan untuk kategori:", category);
    };

    const renderM2Layout = () => {
        if (!dataState || !dataState.product_data) return null;

        const totalKey = Object.keys(dataState).find(key => key.startsWith("total_all_m2"));
        const totalAllM2 = totalKey ? dataState[totalKey] : 0;
        const totalM2Product = dataState.total_m2_product || {};

        const columns = [
            { key: "ukuran", title: "P x L" },
            { key: "qty", title: "Qty" },
            { key: "m2", title: "Total (M²)" }
        ];

        return (
            <>
                <div style={{ marginTop: 24, marginBottom: 24 }}>
                    <div style={{ background: "var(--warning)", padding: "16px", borderRadius: "8px", border: "1px solid var(--warning-hover)", display: "inline-block" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>
                            Total Keseluruhan: {totalAllM2} M²
                        </h3>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                    {Array.isArray(dataState.product_data) && dataState.product_data.map((product, index) => {
                        if (!product.rows || product.rows.length === 0) return null;

                        const formattedRows = product.rows.map((rowItem, idx) => ({
                            id: idx,
                            ukuran: `${rowItem.p} x ${rowItem.l}`,
                            qty: `${rowItem.qty}x`,
                            m2: rowItem.m2
                        }));

                        return (
                            <div key={index} style={{ background: "var(--background)", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                <div style={{ padding: "12px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                                    <h4 style={{ margin: 0, fontSize: "14px" }}>{product.name}</h4>
                                </div>
                                
                                <div style={{ padding: "0", flexGrow: 1 }}>
                                    <Table
                                        id={`table-m2-${product.name}`}
                                        showNumber={true}
                                        size="sm"
                                        rowKey="id"
                                        rowDataKey="id"
                                        columns={columns}
                                        rows={formattedRows}
                                    />
                                </div>

                                <div style={{ padding: "12px 16px", background: "var(--background)", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                                    <strong style={{ color: "var(--warning)", fontSize: "14px" }}>
                                        Total: {totalM2Product[product.name] || 0}
                                    </strong>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        );
    };

    const renderBahanSublimLayout = () => {
        if (!dataState) return null;
        
        const meteranData = dataState.meteran || [];
        const kiloanData = dataState.kiloan || [];

        const meteranColumns = [
            { key: "ukuran", title: "P x L" },
            { key: "qty", title: "Qty" },
            { key: "m2", title: "Total (M²)" }
        ];

        const kiloanColumns = [
            { key: "kg", title: "Berat (Kg)" },
            { key: "qty", title: "Qty" },
            { key: "kg_total", title: "Total (Kg)" }
        ];

        return (
            <>
                {meteranData.length > 0 && (
                    <>
                        <h3 style={{ marginTop: 24, marginBottom: 16 }}>Bahan Meteran</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                            {meteranData.map((product, index) => {
                                if (!product.rows || product.rows.length === 0) return null;
                                
                                const formattedRows = product.rows.map((rowItem, idx) => ({
                                    id: idx,
                                    ukuran: `${rowItem.p} x ${rowItem.l}`,
                                    qty: `${rowItem.qty}x`,
                                    m2: rowItem.m2
                                }));

                                const totalM2 = product.rows.reduce((acc, curr) => acc + (curr.m2 || 0), 0);

                                return (
                                    <div key={`met-${index}`} style={{ background: "var(--background)", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                                            <h4 style={{ margin: 0, fontSize: "14px" }}>{product.name}</h4>
                                        </div>
                                        <div style={{ padding: "0", flexGrow: 1 }}>
                                            <Table id={`table-sublim-met-${index}`} showNumber={true} size="sm" rowKey="id" rowDataKey="id" columns={meteranColumns} rows={formattedRows} />
                                        </div>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                                            <strong style={{ color: "var(--warning)", fontSize: "14px" }}>Total: {totalM2.toFixed(3)} M²</strong>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {kiloanData.length > 0 && (
                    <>
                        <h3 style={{ marginTop: 32, marginBottom: 16 }}>Bahan Kiloan</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                            {kiloanData.map((product, index) => {
                                if (!product.rows || product.rows.length === 0) return null;
                                
                                const formattedRows = product.rows.map((rowItem, idx) => ({
                                    id: idx,
                                    kg: rowItem.kg,
                                    qty: `${rowItem.qty}x`,
                                    kg_total: rowItem.kg_total
                                }));

                                const totalKg = product.rows.reduce((acc, curr) => acc + (curr.kg_total || 0), 0);

                                return (
                                    <div key={`kil-${index}`} style={{ background: "var(--background)", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                                            <h4 style={{ margin: 0, fontSize: "14px" }}>{product.name}</h4>
                                        </div>
                                        <div style={{ padding: "0", flexGrow: 1 }}>
                                            <Table id={`table-sublim-kil-${index}`} showNumber={true} size="sm" rowKey="id" rowDataKey="id" columns={kiloanColumns} rows={formattedRows} />
                                        </div>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                                            <strong style={{ color: "var(--info)", fontSize: "14px" }}>Total: {totalKg.toFixed(3)} Kg</strong>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </>
        );
    };

    const renderQtyLayout = () => {
        if (!dataState) return null;

        let normalizedData = [];
        
        if (dataState.data && Array.isArray(dataState.data)) {
            normalizedData = dataState.data;
        } else if (dataState.product_data) {
            normalizedData = Array.isArray(dataState.product_data) ? dataState.product_data : Object.keys(dataState.product_data).map(key => ({
                name: key,
                total_qty: dataState.product_data[key]
            }));
        } else if (Array.isArray(dataState)) {
            normalizedData = dataState;
        } else if (typeof dataState === "object") {
            normalizedData = Object.keys(dataState).map(key => ({
                name: key,
                total_qty: dataState[key]
            }));
        }

        const totalQty = dataState.total_all_qty ?? dataState.total_all ?? normalizedData.reduce((acc, curr) => acc + (curr.total_qty || 0), 0);

        const columns = [
            { key: "name", title: "Nama Produk" },
            { key: "total_qty", title: "Total Qty" }
        ];

        const rows = normalizedData.map((item, idx) => ({
            id: idx,
            name: item.name,
            total_qty: item.total_qty
        }));

        return (
            <>
                <div style={{ marginTop: 24, marginBottom: 24 }}>
                    <div style={{ background: "var(--success)", padding: "16px", borderRadius: "8px", border: "1px solid var(--success-hover)", display: "inline-block" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>
                            Total Keseluruhan Qty: {totalQty}
                        </h3>
                    </div>
                </div>

                <div style={{ background: "var(--background)", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table
                        id="table-qty"
                        showNumber={true}
                        size="sm"
                        rowKey="id"
                        rowDataKey="id"
                        columns={columns}
                        rows={rows}
                    />
                </div>
            </>
        );
    };

    const renderDtfLayout = () => {
        if (!dataState || !dataState.product_data || !Array.isArray(dataState.product_data)) return null;

        const columns = [
            { key: "panjang", title: "Panjang / Tipe" },
            { key: "qty", title: "Qty" },
            { key: "total", title: "Total" }
        ];

        return (
            <>
                <div style={{ marginTop: 24, marginBottom: 24, display: "flex", gap: "16px" }}>
                    <div style={{ background: "var(--info)", padding: "16px", borderRadius: "8px", border: "1px solid var(--info-hover)" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>
                            Total Panjang DTF: {dataState.total_panjang_dtf || 0}
                        </h3>
                    </div>
                    <div style={{ background: "var(--primary)", padding: "16px", borderRadius: "8px", border: "1px solid var(--primary-hover)" }}>
                        <h3 style={{ margin: 0, color: "var(--background)" }}>
                            Total Panjang DTF UV: {dataState.total_panjang_dtf_uv || 0}
                        </h3>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                    {dataState.product_data.map((product, index) => {
                        if (!product.rows || product.rows.length === 0) return null;

                        const formattedRows = product.rows.map((rowItem, idx) => ({
                            id: idx,
                            panjang: product.isA3 || product.isUV_A3 ? "A3" : rowItem.p,
                            qty: `${rowItem.qty}x`,
                            total: rowItem.total
                        }));

                        const totalProduk = product.rows.reduce((acc, curr) => acc + (curr.total || 0), 0);

                        return (
                            <div key={index} style={{ background: "var(--background)", borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                <div style={{ padding: "12px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                                    <h4 style={{ margin: 0, fontSize: "14px" }}>
                                        {product.name} {product.isUV ? "(UV)" : ""}
                                    </h4>
                                </div>
                                
                                <div style={{ padding: "0", flexGrow: 1 }}>
                                    <Table
                                        id={`table-dtf-${product.name}`}
                                        showNumber={true}
                                        size="sm"
                                        rowKey="id"
                                        rowDataKey="id"
                                        columns={columns}
                                        rows={formattedRows}
                                    />
                                </div>

                                <div style={{ padding: "12px 16px", background: "var(--background)", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                                    <strong style={{ color: "var(--info)", fontSize: "14px" }}>
                                        Total: {totalProduk}
                                    </strong>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        );
    };

    const renderContent = () => {
        if (!dataState) return null;

        if (dataState.meteran !== undefined || dataState.kiloan !== undefined) {
            return renderBahanSublimLayout();
        }

        if (dataState.total_panjang_dtf !== undefined) {
            return renderDtfLayout();
        }

        if (dataState.product_data && Array.isArray(dataState.product_data) && dataState.product_data[0]?.rows !== undefined && dataState.total_m2_product !== undefined) {
            return renderM2Layout();
        }

        return renderQtyLayout();
    };

    return (
        <>
            <Header
                title="Meteran"
                subtitle="Rekapitulasi penggunaan bahan."
                actions={
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <Select
                            name="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            options={categoryOptions}
                            style={{ width: 180 }}
                        />
                        <Input
                            type="date"
                            name="start_date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span style={{ fontWeight: "bold", color: "var(--secondary)" }}>-</span>
                        <Input
                            type="date"
                            name="end_date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <Button 
                            variant="primary" 
                            icon={<Icon name="search" />} 
                            onClick={loadData}
                        >
                            Filter
                        </Button>
                        <Button 
                            variant="success" 
                            icon={<Icon name="download" />} 
                            onClick={handleExportExcel}
                        >
                            Export Excel
                        </Button>
                    </div>
                }
            />

            {renderContent()}
        </>
    );
}