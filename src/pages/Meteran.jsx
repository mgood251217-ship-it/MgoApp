import { useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Select from "../components/Select/Select";
import Table from "../components/Table/Table";
import DateFilter from "../components/DateFilter/DateFilter";
import { exportMeteranExcel } from "../services/excelService";
import { authStore } from "../services/session";
import { rapihkanAngka, getTodayDate } from "../services/helpers";

export default function Meteran() {
    const session = authStore.getUser();
    const storeName = session?.store?.name ?? "Toko";
    const storeAddress = session?.store?.address ?? "Alamat";

    const [category, setCategory] = useState("meter_outdoor");
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());
    
    const [dataState, setDataState] = useState(null);

    const mergeQtyResult = (responses) => {
        const merged = {};
        let totalAllQty = 0;

        responses.forEach((payload) => {
            const source = payload?.product_data ?? payload?.data ?? payload ?? {};

            if (Array.isArray(source)) {
                source.forEach((item) => {
                    const name = item?.name ?? "Unnamed";
                    const qty = Number(item?.total_qty ?? 0);
                    merged[name] = (merged[name] || 0) + qty;
                });
            } else if (source && typeof source === "object") {
                Object.entries(source).forEach(([name, value]) => {
                    if (name === "product_data" || name === "data" || name === "total_all_qty" || name === "total_all" || name === "message" || name === "success") return;
                    merged[name] = (merged[name] || 0) + Number(value || 0);
                });
            }

            totalAllQty += Number(
                payload?.total_all_qty ??
                payload?.total_all ??
                (Array.isArray(payload?.product_data) ? payload.product_data.reduce((sum, item) => sum + Number(item?.total_qty || 0), 0) : 0) ??
                (Array.isArray(payload?.data) ? payload.data.reduce((sum, item) => sum + Number(item?.total_qty || 0), 0) : 0) ??
                0
            );
        });

        return {
            product_data: Object.entries(merged).map(([name, total_qty]) => ({ name, total_qty })),
            total_all_qty: totalAllQty
        };
    };

    const mergeM2Result = (responses) => {
        const merged = {};
        const totalM2Product = {};
        let totalAllM2 = 0;
        const mergedQty = {};

        responses.forEach((payload) => {
            const source = payload?.product_data ?? payload?.data ?? payload ?? [];
            const productData = Array.isArray(source) ? source : [];

            productData.forEach((product) => {
                const name = product?.name ?? "Unnamed";

                if (Array.isArray(product?.rows) && product.rows.length > 0) {
                    if (!merged[name]) {
                        merged[name] = { name, rows: [] };
                        totalM2Product[name] = 0;
                    }

                    product.rows.forEach((row) => {
                        merged[name].rows.push({ ...row });
                        totalM2Product[name] += Number(row?.m2 || 0);
                        totalAllM2 += Number(row?.m2 || 0);
                    });
                } else if (typeof product?.total_qty !== "undefined") {
                    mergedQty[name] = (mergedQty[name] || 0) + Number(product.total_qty || 0);
                }
            });
        });

        return {
            product_data: Object.values(merged),
            data: Object.entries(mergedQty).map(([name, total_qty]) => ({ name, total_qty })),
            total_all_m2: totalAllM2,
            total_m2_product: totalM2Product,
            max_rows: Math.max(...Object.values(merged).map((p) => p.rows.length), 0)
        };
    };

    const categoryOptions = useMemo(() => [
        { value: "meter_outdoor", label: "Outdoor" },
        { value: "meter_indoor", label: "Indoor" },
        { value: "meter_jersey_finishing_jersey", label: "Jersey + Finishing Jersey" },
        { value: "meter_akrilik_merchandise_akrilik", label: "Akrilik + Merchandise Akrilik" },
        { value: "meter_laser_merchandise", label: "Laser A3 + Merchandise" },
        { value: "meter_sublim", label: "Sublim" },
        { value: "meter_dtf", label: "DTF" },
        { value: "meter_cetakan", label: "Cetakan" },
        { value: "meter_bahan_sublim", label: "Bahan Sublim" }
    ], []);

    const loadData = async () => {
        try {
            const groupedActions = {
                meter_jersey_finishing_jersey: ["meter_jersey", "meter_finishing_jersey"],
                meter_akrilik_merchandise_akrilik: ["meter_akrilik", "meter_mercendise_akrilik"],
                meter_laser_merchandise: ["meter_laser", "meter_merchandise"]
            };

            if (groupedActions[category]) {
                const responses = await Promise.all(
                    groupedActions[category].map((actionName) =>
                        api.get("", {
                            params: {
                                action: actionName,
                                start_date: startDate,
                                end_date: endDate
                            }
                        })
                    )
                );

                const groupedSections = [
                    { title: "Jersey", source: responses[0]?.data?.data ?? responses[0]?.data ?? {} },
                    { title: "Finishing Jersey", source: responses[1]?.data?.data ?? responses[1]?.data ?? {} }
                ];

                if (category === "meter_akrilik_merchandise_akrilik") {
                    groupedSections[0] = { title: "Akrilik", source: responses[0]?.data?.data ?? responses[0]?.data ?? {} };
                    groupedSections[1] = { title: "Merchandise Akrilik", source: responses[1]?.data?.data ?? responses[1]?.data ?? {} };
                }

                if (category === "meter_laser_merchandise") {
                    groupedSections[0] = { title: "Laser A3", source: responses[0]?.data?.data ?? responses[0]?.data ?? {} };
                    groupedSections[1] = { title: "Merchandise", source: responses[1]?.data?.data ?? responses[1]?.data ?? {} };
                }

                setDataState({ grouped_sections: groupedSections });
                return;
            }

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
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleExportExcel = async () => {
        if (!dataState) return;
        
        await exportMeteranExcel({
            dataState,
            category,
            startDate,
            endDate,
            storeName,
            storeAddress
        });
    };

    const renderM2Section = (title, payload) => {
        if (!payload || !payload.product_data) return null;

        const totalKey = Object.keys(payload).find(key => key.startsWith("total_all_m2"));
        const totalAllM2 = totalKey ? payload[totalKey] : 0;

        const columns = [
            { key: "p", title: "P" },
            { key: "l", title: "L" },
            { key: "qty", title: "Qty" },
            { key: "m2", title: "Total (M²)" }
        ];

        return (
            <div key={title}>
                {title && (
                    <h3 style={{ marginTop: 24, marginBottom: 16 }}>{title}</h3>
                )}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ background: "var(--warning)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--warning-hover)", display: "inline-block" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>
                            Total Keseluruhan: {rapihkanAngka(totalAllM2)} M²
                        </h3>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px" }}>
                    {Array.isArray(payload.product_data) && payload.product_data.map((product, index) => {
                        if (!product.rows || product.rows.length === 0) return null;

                        const formattedRows = product.rows.map((rowItem, idx) => ({
                            id: idx,
                            p: rowItem.p,
                            l: rowItem.l,
                            qty: `${rowItem.qty}x`,
                            m2: rapihkanAngka(rowItem.m2)
                        }));

                        const totalM2Value = payload.total_m2_product?.[product.name] !== undefined 
                            ? payload.total_m2_product[product.name] 
                            : product.rows.reduce((sum, r) => sum + (r.m2 || 0), 0);

                        return (
                            <div key={`${title}-${index}`} style={{ background: "var(--background)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                <div style={{ padding: "12px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                                    <h4 style={{ margin: 0, fontSize: "14px" }}>{product.name}</h4>
                                </div>
                                
                                <div style={{ padding: "0", flexGrow: 1 }}>
                                    <Table
                                        id={`table-m2-${title}-${product.name}`}
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
                                        Total: {rapihkanAngka(totalM2Value)}
                                    </strong>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderBahanSublimLayout = () => {
        if (!dataState) return null;
        
        const meteranData = dataState.meteran || [];
        const kiloanData = dataState.kiloan || [];

        const meteranColumns = [
            { key: "p", title: "P" },
            { key: "l", title: "L" },
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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px" }}>
                            {meteranData.map((product, index) => {
                                if (!product.rows || product.rows.length === 0) return null;
                                
                                const formattedRows = product.rows.map((rowItem, idx) => ({
                                    id: idx,
                                    p: rowItem.p,
                                    l: rowItem.l,
                                    qty: `${rowItem.qty}x`,
                                    m2: rapihkanAngka(rowItem.m2)
                                }));

                                const totalM2 = product.rows.reduce((acc, curr) => acc + (curr.m2 || 0), 0);

                                return (
                                    <div key={`met-${index}`} style={{ background: "var(--background)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                                            <h4 style={{ margin: 0, fontSize: "14px" }}>{product.name}</h4>
                                        </div>
                                        <div style={{ padding: "0", flexGrow: 1 }}>
                                            <Table id={`table-sublim-met-${index}`} showNumber={true} size="sm" rowKey="id" rowDataKey="id" columns={meteranColumns} rows={formattedRows} />
                                        </div>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                                            <strong style={{ color: "var(--warning)", fontSize: "14px" }}>Total: {rapihkanAngka(totalM2)} M²</strong>
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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px" }}>
                            {kiloanData.map((product, index) => {
                                if (!product.rows || product.rows.length === 0) return null;
                                
                                const formattedRows = product.rows.map((rowItem, idx) => ({
                                    id: idx,
                                    kg: rowItem.kg,
                                    qty: `${rowItem.qty}x`,
                                    kg_total: rapihkanAngka(rowItem.kg_total)
                                }));

                                const totalKg = product.rows.reduce((acc, curr) => acc + (curr.kg_total || 0), 0);

                                return (
                                    <div key={`kil-${index}`} style={{ background: "var(--background)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderBottom: "1px solid var(--border)" }}>
                                            <h4 style={{ margin: 0, fontSize: "14px" }}>{product.name}</h4>
                                        </div>
                                        <div style={{ padding: "0", flexGrow: 1 }}>
                                            <Table id={`table-sublim-kil-${index}`} showNumber={true} size="sm" rowKey="id" rowDataKey="id" columns={kiloanColumns} rows={formattedRows} />
                                        </div>
                                        <div style={{ padding: "12px 16px", background: "var(--background)", borderTop: "1px solid var(--border)", textAlign: "right" }}>
                                            <strong style={{ color: "var(--info)", fontSize: "14px" }}>Total: {rapihkanAngka(totalKg)} Kg</strong>
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

    const renderQtySection = (title, payload) => {
        if (!payload) return null;

        let normalizedData = [];
        
        if (payload.data && Array.isArray(payload.data)) {
            normalizedData = payload.data;
        } else if (payload.product_data) {
            normalizedData = Array.isArray(payload.product_data) ? payload.product_data : Object.keys(payload.product_data).map(key => ({
                name: key,
                total_qty: payload.product_data[key]
            }));
        } else if (Array.isArray(payload)) {
            normalizedData = payload;
        } else if (typeof payload === "object") {
            normalizedData = Object.keys(payload).map(key => ({
                name: key,
                total_qty: payload[key]
            }));
        }

        const totalQty = payload.total_all_qty ?? payload.total_all ?? normalizedData.reduce((acc, curr) => acc + (curr.total_qty || 0), 0);

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
            <div key={title}>
                {title && (
                    <h3 style={{ marginTop: 24, marginBottom: 16 }}>{title}</h3>
                )}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ background: "var(--success)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--success-hover)", display: "inline-block" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>
                            Total Keseluruhan Qty: {totalQty}
                        </h3>
                    </div>
                </div>

                <div style={{ background: "var(--background)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
                    <Table
                        id={`table-qty-${title}`}
                        showNumber={true}
                        size="sm"
                        rowKey="id"
                        rowDataKey="id"
                        columns={columns}
                        rows={rows}
                    />
                </div>
            </div>
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
                    <div style={{ background: "var(--info)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--info-hover)" }}>
                        <h3 style={{ margin: 0, color: "var(--text)" }}>
                            Total Panjang DTF: {dataState.total_panjang_dtf || 0}
                        </h3>
                    </div>
                    <div style={{ background: "var(--primary)", padding: "16px", borderRadius: "var(--radius)", border: "1px solid var(--primary-hover)" }}>
                        <h3 style={{ margin: 0, color: "var(--background)" }}>
                            Total Panjang DTF UV: {dataState.total_panjang_dtf_uv || 0}
                        </h3>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px" }}>
                    {dataState.product_data.map((product, index) => {
                        if (!product.rows || product.rows.length === 0) return null;

                        const formattedRows = product.rows.map((rowItem, idx) => ({
                            id: idx,
                            panjang: product.isA3 || product.isUV_A3 ? "A3" : rowItem.p,
                            qty: `${rowItem.qty}x`,
                            total: rapihkanAngka(rowItem.total)
                        }));

                        const totalProduk = product.rows.reduce((acc, curr) => acc + (curr.total || 0), 0);

                        return (
                            <div key={index} style={{ background: "var(--background)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
                                        Total: {rapihkanAngka(totalProduk)}
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

        if (dataState.grouped_sections && Array.isArray(dataState.grouped_sections)) {
            return (
                <div style={{ display: "flex", gap: "32px", alignItems: "flex-start", flexWrap: "wrap" }}>
                    {dataState.grouped_sections.map((section) => {
                        const source = section?.source;
                        return (
                            <div key={section?.title || Math.random()} style={{ flex: "1 1 420px", minWidth: "300px" }}>
                                {source?.product_data && Array.isArray(source.product_data) && source.product_data[0]?.rows !== undefined
                                    ? renderM2Section(section.title, source)
                                    : renderQtySection(section.title, source)}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (dataState.meteran !== undefined || dataState.kiloan !== undefined) {
            return renderBahanSublimLayout();
        }

        if (dataState.total_panjang_dtf !== undefined) {
            return renderDtfLayout();
        }

        const hasTotalM2 = Object.keys(dataState).some(key => key.startsWith("total_all_m2"));
        if (dataState.product_data && Array.isArray(dataState.product_data) && dataState.product_data[0]?.rows !== undefined && hasTotalM2) {
            return renderM2Section(null, dataState);
        }

        return renderQtySection(null, dataState);
    };

    return (
        <>
            <Header
                title="Meteran"
                subtitle="Rekapitulasi penggunaan bahan."
                actions={
                        <Select
                            name="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            options={categoryOptions}
                            margin="0"
                            style={{ width: "180px"}}
                        />
                }
            />
            <DateFilter 
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onFilter={loadData}
                onExport={handleExportExcel}
            />
            {renderContent()}
        </>
    );
}