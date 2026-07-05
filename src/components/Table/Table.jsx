import "./Table.css";

export default function Table({
    id,
    columns = [],
    rows = [],
    rowKey = "id",
    rowDataKey = "id",
    size = "md",
    actions,
    showNumber = false,
}) {
    return (
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
                        <th key={column.key}>
                            {column.title}
                        </th>
                    ))}

                    {actions && <th width="140">Aksi</th>}
                </tr>
            </thead>

            <tbody>
                {rows.length === 0 ? (
                    <tr>
                        <td
                            colSpan={columns.length + (actions ? 1 : 0)}
                            className="text-center"
                        >
                            Tidak ada data
                        </td>
                    </tr>
                ) : (
                    rows.map((row, index) => (
                        <tr
                            key={row[rowKey]}
                            data-id={row[rowDataKey]}
                        >
                            {showNumber && (
                                <td className="table-number">
                                    {index + 1}
                                </td>
                            )}

                            {columns.map(column => (
                                <td key={column.key}>
                                    {column.render
                                        ? column.render(row)
                                        : row[column.key]}
                                </td>
                            ))}

                            {actions && (
                                <td className="table-actions">
                                    {actions(row)}
                                </td>
                            )}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}