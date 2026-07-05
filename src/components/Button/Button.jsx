import "./Button.css";

export default function Button({
    children,
    icon,
    onClick,
    type = "button",
    loading = false,
    disabled = false,
    variant = "primary",
    size = "md"
}) {
    const isDisabled = disabled || loading;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled}
            className={`btn btn-${variant} btn-${size} ${isDisabled ? "btn-disabled" : ""}`}
        >
            {icon}
            {!loading && children}
            {loading && "Loading..."}
        </button>
    );
}