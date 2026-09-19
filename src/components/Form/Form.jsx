export default function Form({
    id,
    children,
    onSubmit,
    className = "",
    autoComplete = "off"
}) {
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.requestSubmit();
        }
    };

    return (
        <form
            id={id}
            className={`form ${className}`}
            autoComplete={autoComplete}
            onSubmit={onSubmit}
            onKeyDown={handleKeyDown}
        >
            {children}
        </form>
    );
}