import { useEffect } from "react";
import "./Modal.css";

export default function Modal({
    open,
    title,
    size = "md",
    closeOnOverlay = true,
    onClose,
    children,
    headerColor = "primary",
}) {
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };

        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    if (!open) return null;

    const handleOverlayClick = (e) => {
        if (closeOnOverlay && e.target === e.currentTarget) {
            onClose?.();
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={handleOverlayClick}
        >
            <div className={`modal modal-${size}`}>
                {(title || onClose) && (
                    <div className={`modal-header modal-header-${headerColor}`}>
                        <h3 className="modal-title">{title}</h3>

                        {onClose && (
                            <button
                                type="button"
                                className="modal-close"
                                onClick={onClose}
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}

                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}