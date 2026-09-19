import { useEffect, useRef } from "react";
import "./Modal.css";

export default function Modal({
    open,
    title,
    size = "md",
    closeOnOverlay = true,
    onClose,
    children,
    headerColor = "primary",
    initialFocusRef,
}) {
    const modalRef = useRef(null);

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

    useEffect(() => {
        if (!open) return;

        const focusTimeout = setTimeout(() => {
            let target = initialFocusRef?.current;

            if (!target) {
                const focusableSelector =
                    'input, textarea, select, [contenteditable="true"], button:not(.modal-close), [tabindex]:not([tabindex="-1"])';
                target = modalRef.current?.querySelector(focusableSelector);
            }

            if (!target) return;

            target.focus();

            if (target.tagName === "BUTTON") {
                target.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key: "ArrowDown",
                        bubbles: true,
                        cancelable: true,
                    })
                );
            }
        }, 0);

        return () => clearTimeout(focusTimeout);
    }, [open, initialFocusRef]);

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
            <div className={`modal modal-${size}`} ref={modalRef}>
                {(title || onClose) && (
                    <div className={`modal-header modal-header-${headerColor}`}>
                        <h3 className="modal-title">{title}</h3>

                        {onClose && (
                            <button
                                type="button"
                                className={`modal-close ${headerColor}`}
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