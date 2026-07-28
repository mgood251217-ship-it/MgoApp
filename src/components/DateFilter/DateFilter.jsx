import React from "react";
import Icon from "../Icon/Icon";
import Button from "../Button/Button";
import Input from "../Input/Input";

export default function DateFilter({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    search,
    onSearchChange,
    searchPlaceholder = "Cari data...",
    onFilter,
    onExport,
    loading
}) {
    return (
        <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "flex-end",
            marginBottom: "24px",
            padding: "16px",
            background: "var(--background)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
        }}>
            {onSearchChange && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 200px", maxWidth: "300px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                        Pencarian
                    </label>
                    <Input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        margin="0"
                    />
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                    Tanggal Mulai
                </label>
                <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    margin="0"
                />
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                    Tanggal Akhir
                </label>
                <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    margin="0"
                />
            </div>

            <div style={{ display: "flex", gap: "12px", marginLeft: "auto" }}>
                <Button
                    onClick={onFilter}
                    disabled={loading}
                    icon={<Icon name="filter" />}
                    size="lg"
                >
                    {loading ? "Memuat..." : "Filter"}
                </Button>

                {onExport && (
                    <Button
                        variant="success"
                        onClick={onExport}
                        disabled={loading}
                        icon={<Icon name="excel" />} 
                        size="lg"
                    >
                        Export Excel
                    </Button>
                )}
            </div>
        </div>
    );
}