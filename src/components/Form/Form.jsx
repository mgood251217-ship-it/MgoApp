export default function Form({
    id,
    children,
    onSubmit,
    className = "",
    autoComplete = "off"
}) {
    return (
        <form
            id={id}
            className={`form ${className}`}
            autoComplete={autoComplete}
            onSubmit={onSubmit}
        >
            {children}
        </form>
    );
}