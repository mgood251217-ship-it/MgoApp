import "./Pagination.css";

export default function Pagination({
    page = 1,
    totalPages = 1,
    onChange,
    size = "md",
    variant = "primary"
}) {
    if (totalPages <= 1) return null;

    const change = (value) => {
        if (value < 1 || value > totalPages || value === page) return;
        onChange?.(value);
    };

    const pages = [];

    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, page + 2);

    if (page <= 3) {
        end = Math.min(5, totalPages);
    }

    if (page >= totalPages - 2) {
        start = Math.max(1, totalPages - 4);
    }

    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    return (
        <div className={`pagination pagination-${size}`}>
            <button
                className="pagination-btn"
                disabled={page === 1}
                onClick={() => change(1)}
            >
                «
            </button>

            <button
                className="pagination-btn"
                disabled={page === 1}
                onClick={() => change(page - 1)}
            >
                ‹
            </button>

            {start > 1 && (
                <>
                    <button
                        className="pagination-btn"
                        onClick={() => change(1)}
                    >
                        1
                    </button>

                    {start > 2 && (
                        <span className="pagination-dots">...</span>
                    )}
                </>
            )}

            {pages.map(number => (
                <button
                    key={number}
                    className={`pagination-btn ${
                        number === page
                            ? `active ${variant}`
                            : ""
                    }`}
                    onClick={() => change(number)}
                >
                    {number}
                </button>
            ))}

            {end < totalPages && (
                <>
                    {end < totalPages - 1 && (
                        <span className="pagination-dots">...</span>
                    )}

                    <button
                        className="pagination-btn"
                        onClick={() => change(totalPages)}
                    >
                        {totalPages}
                    </button>
                </>
            )}

            <button
                className="pagination-btn"
                disabled={page === totalPages}
                onClick={() => change(page + 1)}
            >
                ›
            </button>

            <button
                className="pagination-btn"
                disabled={page === totalPages}
                onClick={() => change(totalPages)}
            >
                »
            </button>
        </div>
    );
}