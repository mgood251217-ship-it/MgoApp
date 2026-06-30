import "./Alert.css";

export default function Alert({
    type = "error",
    message,
    onClose
}) {
    if (!message) return null;

    return (
        <div className={`alert alert-${type}`}>
            <div className="alert-message">
                {message}
            </div>

            {onClose && (
                <button
                    type="button"
                    className="alert-close"
                    onClick={onClose}
                >
                    ×
                </button>
            )}
        </div>
    );
}