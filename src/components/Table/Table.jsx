import { useState, useMemo } from "react";
import "./Table.css";

export default function Table({
    id,
    columns = [],
    rows = [],
    rowKey = "id",
    rowDataKey = "id",
    size = "md",
    actions,
    onRowDoubleClick,
    showNumber = false,
    sortable = true,
}) {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const handleSort = (key) => {
        if (!sortable) return;
        
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRows = useMemo(() => {
        if (!sortable || sortConfig.key === null) return rows;

        const parseValue = (val) => {
            if (val === null || val === undefined) return "";
            if (typeof val === "string") {
                if (/^(Rp\s*)?-?[\d.,]+$/i.test(val.trim())) {
                    return parseFloat(val.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, ""));
                }
                return val.toLowerCase();
            }
            return val;
        };

        const sortableRows = [...rows];
        sortableRows.sort((a, b) => {
            const aValue = parseValue(a[sortConfig.key]);
            const bValue = parseValue(b[sortConfig.key]);

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return sortableRows;
    }, [rows, sortConfig, sortable]);

    return (
        <div className="table-responsive">
            <table
                id={id}
                className={`table table-${size}`}
            >
                <thead>
                    <tr>
                        {showNumber && (
                            <th className="table-number">No.</th>
                        )}
                        {columns.map(column => (
                            <th
                                key={column.key}
                                onClick={() => handleSort(column.key)}
                                style={sortable ? { cursor: "pointer", userSelect: "none" } : {}}
                                className={column.hideMobile ? "hide-mobile" : ""}
                            >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>{column.title}</span>
                                    {sortable && sortConfig.key === column.key && (
                                        <span style={{ fontSize: "0.8em", opacity: 0.7, marginLeft: "4px" }}>
                                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                        </span>
                                    )}
                                </div>
                            </th>
                        ))}

                        {actions && <th width="140">Aksi</th>}
                    </tr>
                </thead>

                <tbody>
                    {sortedRows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length + (actions ? 1 : 0) + (showNumber ? 1 : 0)}
                                className="text-center"
                            >
                                Tidak ada data
                            </td>
                        </tr>
                    ) : (
                        sortedRows.map((row, index) => (
                            <tr
                                key={row[rowKey]}
                                data-id={row[rowDataKey]}
                                onDoubleClick={() => {
                                    if (onRowDoubleClick) {
                                        onRowDoubleClick(row);
                                    }
                                }}
                                style={onRowDoubleClick ? { cursor: "pointer" } : {}}

                            >
                                {showNumber && (
                                    <td className="table-number">
                                        {index + 1}
                                    </td>
                                )}

                                {columns.map(column => (
                                    <td
                                        key={column.key}
                                        data-label={column.title}
                                        className={column.hideMobile ? "hide-mobile" : ""}
                                    >
                                        {column.render
                                            ? column.render(row)
                                            : row[column.key]}
                                    </td>
                                ))}

                                {actions && (
                                    <td>
                                        <div className="table-actions">
                                            {actions(row)}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}