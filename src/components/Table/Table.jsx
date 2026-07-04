import './Table.css';

export default function Table({ columns, data, id }) {
    return (
        <table className="custom-table" id={id}>
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th key={column.key}>{column.title}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row, index) => (
                    <tr key={index}>
                        {columns.map((column) => (
                            <td key={column.key}>{row[column.key]}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td colSpan={columns.length}>
                        {/* Footer content goes here */}
                    </td>
                </tr>
            </tfoot>
        </table>
    );
}