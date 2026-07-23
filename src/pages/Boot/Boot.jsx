import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Splash from "../../components/Splash/Splash";
import { delay } from "../../utils/delay";
import { bootSteps } from "./steps";

export default function Boot() {
    const navigate = useNavigate();
    const [message, setMessage] = useState("Initializing application...");
    const [error, setError] = useState(null);

    const initialize = useCallback(async () => {
        setError(null);
        try {
            let hasSessionResult = false;
            for (const step of bootSteps) {
                setMessage(step.message);
                const result = await step.action();
                await delay(500);

                if (step.key === "internet" && !result) {
                    setError("Tidak ada koneksi internet.");
                    return;
                }
                if (step.key === "server" && !result) {
                    setError("Server tidak dapat dihubungi.");
                    return;
                }
                if (step.key === "session") {
                    hasSessionResult = result;
                }
            }
            navigate(
                hasSessionResult ? "/store" : "/login",
                { replace: true }
            );
        } catch (err) {
            console.error(err);
            setError("Terjadi kesalahan saat memulai aplikasi.");
        }
    }, [navigate]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    return (
        <Splash
            message={error ?? message}
            error={!!error}
            onRetry={initialize}
        />
    );
}
