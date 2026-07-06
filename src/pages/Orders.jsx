import { useEffect, useState, useCallback, useMemo } from "react";
import api from "../api/axios";
import Header from "../components/Header/Header";
import Input from "../components/Input/Input";
import Table from "../components/Table/Table";
import Button from "../components/Button/Button";
import Icon from "../components/Icon/Icon";
import { formatRupiah, hitungDeadline, formatKeInternasional as formatNomorInternasional } from "../services/helpers";

export default function Orders() {
    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const [ordersOnline, setOrdersOnline] = useState([]);
    const [ordersOffline, setOrdersOffline] = useState([]);
    
    const [search, setSearch] = useState("");
    const [startDate, setStartDate] = useState(getTodayDate());
    const [endDate, setEndDate] = useState(getTodayDate());

    const formatTableData = useCallback((data) => {
        return data.map(row => ({
            ...row,
            formatted_nomor: formatNomorInternasional(row.nomor),
            formatted_total: formatRupiah(row.total),
            formatted_deadline: hitungDeadline(row.deadline),
            formatted_dibayar: row.is_lunas ? `Lunas ${row.lunas_method}` : formatRupiah(row.total_paid),
            formatted_proses: row.project_initial !== "" ? `${row.project_process} ${row.project_initial}` : row.project_process
        }));
    }, []);

    const loadData = useCallback(async () => {
        try {
            const res = await api.get("", {
                params: {
                    action: "get_orders",
                    search: search,
                    start_date: startDate,
                    end_date: endDate
                }
            });

            const responseData = res.data?.data || {};
            setOrdersOnline(formatTableData(responseData.online ?? []));
            setOrdersOffline(formatTableData(responseData.offline ?? []));
        } catch (err) {
            console.error(err);
        }
    }, [search, startDate, endDate, formatTableData]);

    useEffect(() => {
        loadData();
    }, []); 

    const tableColumns = useMemo(() => [
        { key: "nomorator", title: "Invoice" },
        { key: "customer_name", title: "Pelanggan" },
        { key: "formatted_nomor", title: "Nomor" },
        { key: "formatted_total", title: "Total" },
        { key: "formatted_deadline", title: "Deadline" },
        { key: "formatted_dibayar", title: "Dibayar" },
        { key: "formatted_proses", title: "Proses" },
        { key: "op_initial", title: "CS" }
    ], []);

    const tableActions = useCallback((row) => (
        <div style={{ display: "flex", gap: "4px" }}>
            <Button
                size="sm"
                variant="success"
                icon={<Icon name="payments" />}
                disabled={row.is_lunas}
                onClick={() => console.log("Pay", row.order_id)}
            />
            <Button
                size="sm"
                variant="info"
                icon={<Icon name="visibility" />}
                onClick={() => console.log("View", row.order_id)}
            />
            <Button
                size="sm"
                variant="warning"
                icon={<Icon name="edit" />}
                onClick={() => console.log("Edit", row.order_id)}
            />
            <Button
                size="sm"
                variant="primary"
                icon={<Icon name="print" />}
                onClick={() => console.log("Print", row.order_id)}
            />
            <Button
                size="sm"
                variant="danger"
                icon={<Icon name="picture_as_pdf" />}
                onClick={() => console.log("PDF", row.order_id)}
            />
            <Button
                size="sm"
                variant="secondary"
                icon={<Icon name="engineering" />}
                disabled={row.project_initial !== ""}
                onClick={() => console.log("Process", row.order_id)}
            />
        </div>
    ), []);

    return (
        <>
            <Header
                title="Orders"
                subtitle="Data pesanan masuk."
                actions={
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <Input
                            type="date"
                            name="start_date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span style={{ fontWeight: "bold", color: "#666" }}>-</span>
                        <Input
                            type="date"
                            name="end_date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                        <Input
                            name="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari pesanan..."
                            style={{ width: 250 }}
                        />
                        <Button 
                            variant="primary" 
                            icon={<Icon name="search" />} 
                            onClick={loadData}
                        >
                            Filter
                        </Button>
                    </div>
                }
            />

            <div style={{ marginTop: 24, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Pesanan Offline</h3>
                <Table
                    id="tableOffline"
                    showNumber
                    size="sm"
                    rowKey="order_id"
                    rowDataKey="order_id"
                    columns={tableColumns}
                    rows={ordersOffline}
                    actions={tableActions}
                />
            </div>

            <div style={{ marginTop: 32 }}>
                <h3 style={{ marginBottom: 12 }}>Pesanan Online</h3>
                <Table
                    id="tableOnline"
                    showNumber
                    size="sm"
                    rowKey="order_id"
                    rowDataKey="order_id"
                    columns={tableColumns}
                    rows={ordersOnline}
                    actions={tableActions}
                />
            </div>
        </>
    );
}