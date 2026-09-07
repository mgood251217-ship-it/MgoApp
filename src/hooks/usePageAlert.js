import { createElement, useState } from "react";
import Alert from "../components/Alert/Alert";

export default function usePageAlert() {
    const [alertConfig, setAlertConfig] = useState({ type: "error", message: "" });

    const showAlert = (message, type = "error") => {
        setAlertConfig({ type, message });
    };

    const dismissAlert = () => {
        setAlertConfig((current) => ({ ...current, message: "" }));
    };

    const alertElement = createElement(Alert, {
        type: alertConfig.type,
        message: alertConfig.message,
        onClose: dismissAlert
    });

    return { showAlert, alertElement };
}
