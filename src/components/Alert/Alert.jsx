import { useEffect, useState } from "react";
import "./Alert.css";

export default function Alert({ type = "error", message, onClose }) {
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        if (!message) return;

        setIsLeaving(false);

        const leaveTimer = setTimeout(() => {
            setIsLeaving(true);
        }, 1700);

        const closeTimer = setTimeout(() => {
            if (onClose) onClose();
        }, 2000);

        return () => {
            clearTimeout(leaveTimer);
            clearTimeout(closeTimer);
        };
    }, [message, onClose]);

    if (!message) return null;

    const handleManualClose = () => {
        setIsLeaving(true);
        setTimeout(() => {
            if (onClose) onClose();
        }, 300);
    };

    return (
        <div className={`alert alert-${type} ${isLeaving ? "alert-leave" : "alert-enter"}`}>
            <div className="alert-content">
                <div className="alert-message">{message}</div>
                {onClose && (
                    <button type="button" className="alert-close" onClick={handleManualClose}>
                        ×
                    </button>
                )}
            </div>
            <div className="alert-progress"></div>
        </div>
    );
}