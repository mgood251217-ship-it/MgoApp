import { useState, useMemo, useEffect, useId, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import "./Table.css";

const rowSelectionBus = (() => {
    const listeners = new Set();
    return {
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        notify(activeInstanceId) {
            listeners.forEach((fn) => fn(activeInstanceId));
        },
    };
})();

export default function Table({
    id,
    columns = [],
    rows = [],
    rowKey = "id",
    rowDataKey = "id",
    size = "md",
    actions,
    onRowDoubleClick,
    onRowSelect,
    showNumber = false,
    sortable = true,
    selectedRowKey,
    onVisibleRowsChange,
    getRowTooltip,
    renderTooltip,
    tooltipDebounce = 700,
}) {
    const instanceId = useId();
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [internalSelectedKey, setInternalSelectedKey] = useState(null);

    const [hoveredKey, setHoveredKey] = useState(null);
    const [tooltipData, setTooltipData] = useState(null);
    const [tooltipLoading, setTooltipLoading] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

    const hoverTimerRef = useRef(null);
    const hoverKeyRef = useRef(null);

    const clearHoverTimer = useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => clearHoverTimer();
    }, [clearHoverTimer]);

    const handleRowMouseEnter = useCallback((row, e) => {
        if (!getRowTooltip) return;

        const rowKeyValue = row[rowKey];
        hoverKeyRef.current = rowKeyValue;

        setTooltipPos({ top: e.clientY + 16, left: e.clientX + 16 });

        clearHoverTimer();
        hoverTimerRef.current = setTimeout(async () => {
            setHoveredKey(rowKeyValue);
            setTooltipLoading(true);
            setTooltipData(null);

            try {
                const data = await getRowTooltip(row);
                if (hoverKeyRef.current === rowKeyValue) {
                    setTooltipData(data);
                }
            } catch (err) {
                if (hoverKeyRef.current === rowKeyValue) {
                    setTooltipData(null);
                }
            } finally {
                if (hoverKeyRef.current === rowKeyValue) {
                    setTooltipLoading(false);
                }
            }
        }, tooltipDebounce);
    }, [getRowTooltip, rowKey, tooltipDebounce, clearHoverTimer]);

    const handleRowMouseLeave = useCallback(() => {
        clearHoverTimer();
        hoverKeyRef.current = null;
        setHoveredKey(null);
        setTooltipData(null);
        setTooltipLoading(false);
    }, [clearHoverTimer]);

    const isControlled = selectedRowKey !== undefined;
    const activeSelectedKey = isControlled ? selectedRowKey : internalSelectedKey;

    useEffect(() => {
        if (isControlled) return;

        return rowSelectionBus.subscribe((activeInstanceId) => {
            if (activeInstanceId !== instanceId) {
                setInternalSelectedKey(null);
            }
        });
    }, [isControlled, instanceId]);

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

    useEffect(() => {
        if (typeof onVisibleRowsChange === "function") {
            onVisibleRowsChange(sortedRows);
        }
    }, [sortedRows, onVisibleRowsChange]);

    const handleRowClick = (row) => {
        if (!isControlled) {
            setInternalSelectedKey(row[rowKey]);
            rowSelectionBus.notify(instanceId);
        }
        if (onRowSelect) {
            onRowSelect(row);
        }
    };

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
                        sortedRows.map((row, index) => {
                            const isSelected = activeSelectedKey !== undefined
                                && activeSelectedKey !== null
                                && row[rowKey] === activeSelectedKey;

                            return (
                                <tr
                                    key={row[rowKey]}
                                    data-id={row[rowDataKey]}
                                    onClick={() => handleRowClick(row)}
                                    onDoubleClick={() => {
                                        if (onRowDoubleClick) {
                                            onRowDoubleClick(row);
                                        }
                                    }}
                                    onMouseEnter={(e) => handleRowMouseEnter(row, e)}
                                    onMouseLeave={handleRowMouseLeave}
                                    style={{
                                        cursor: onRowDoubleClick ? "pointer" : undefined,
                                        backgroundColor: isSelected
                                            ? "color-mix(in srgb, var(--primary) 18%, transparent)"
                                            : undefined,
                                        outline: isSelected ? "2px solid var(--primary)" : undefined,
                                        outlineOffset: isSelected ? "-2px" : undefined,
                                    }}
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
                            );
                        })
                    )}
                </tbody>
            </table>

            {getRowTooltip && hoveredKey !== null && createPortal(
                <div
                    style={{
                        position: "fixed",
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        zIndex: 999999,
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        padding: "10px 12px",
                        minWidth: "220px",
                        maxWidth: "320px",
                        fontSize: "0.85rem",
                        pointerEvents: "none",
                    }}
                >
                    {tooltipLoading && !tooltipData ? (
                        <div style={{ opacity: 0.7 }}>Memuat...</div>
                    ) : (
                        renderTooltip ? renderTooltip(tooltipData) : null
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}