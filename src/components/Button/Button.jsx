import "./Button.css";

export default function Button({
    children,
    onClick,
    type = "button",
    loading = false,
    disabled = false,
    variant = "primary"
}) {
    const isDisabled = disabled || loading;

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={isDisabled}
            className={`btn btn-${variant} ${isDisabled ? "btn-disabled" : ""}`}
        >
            {loading ? "Loading..." : children}
        </button>
    );
}