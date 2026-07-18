import React from "react";

export default function DateFilter({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                    Tanggal Mulai
                </label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        outline: "none",
                        fontFamily: "inherit"
                    }}
                />
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                    Tanggal Akhir
                </label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    style={{
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        outline: "none",
                        fontFamily: "inherit"
                    }}
                />
            </div>

            <div style={{ display: "flex", gap: "12px", marginLeft: "auto" }}>
                <button
                    onClick={onFilter}
                    disabled={loading}
                    style={{
                        padding: "10px 20px",
                        borderRadius: "8px",
                        background: "var(--primary)",
                        color: "#ffffff",
                        border: "none",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        opacity: loading ? 0.7 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        transition: "0.2s"
                    }}
                >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                    </svg>
                    {loading ? "Memuat..." : "Filter"}
                </button>

                {onExport && (
                    <button
                        onClick={onExport}
                        disabled={loading}
                        style={{
                            padding: "10px 20px",
                            borderRadius: "8px",
                            background: "var(--success)",
                            color: "#ffffff",
                            border: "none",
                            cursor: loading ? "not-allowed" : "pointer",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.884 6.68a.5.5 0 1 0-.768.64L7.349 10l-2.233 2.68a.5.5 0 0 0 .768.64L8 10.781l2.116 2.54a.5.5 0 0 0 .768-.641L8.651 10l2.233-2.68a.5.5 0 0 0-.768-.64L8 9.219l-2.116-2.54z"/>
                            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
                        </svg>
                        Export Excel
                    </button>
                )}
            </div>
        </div>
    );
}