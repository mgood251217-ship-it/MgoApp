import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Splash from "../../components/Splash/Splash";
import UpdatePrompt from "../../components/UpdatePrompt/UpdatePrompt";
import { delay } from "../../utils/delay";
import { bootSteps } from "./steps";

export default function Boot() {
    const navigate = useNavigate();
    const [message, setMessage] = useState("Initializing application...");
    const [error, setError] = useState(null);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);

    const runSteps = useCallback(async (startIndex) => {
        try {
            for (let i = startIndex; i < bootSteps.length; i++) {
                const step = bootSteps[i];
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
                if (step.key === "update" && result?.hasUpdate) {
                    setUpdateInfo({ ...result, nextStepIndex: i + 1 });
                    return;
                }
                if (step.key === "session") {
                    navigate(result ? "/store" : "/login", { replace: true });
                    return;
                }
            }
            navigate("/login", { replace: true });
        } catch (err) {
            console.error(err);
            setError("Terjadi kesalahan saat memulai aplikasi.");
        }
    }, [navigate]);

    const initialize = useCallback(() => {
        setError(null);
        setUpdateInfo(null);
        return runSteps(0);
    }, [runSteps]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    const handleContinueOld = () => {
        const resumeIndex = updateInfo.nextStepIndex;
        setUpdateInfo(null);
        runSteps(resumeIndex);
    };

    const handleUpdateNow = async () => {
        setDownloading(true);
        setProgress(0);

        const stopListening = window.electron.onDownloadProgress((percent) => {
            setProgress(percent);
        });

        try {
            const res = await window.electron.downloadUpdate(updateInfo.downloadUrl);
            stopListening();

            if (!res.success) {
                setDownloading(false);
                setUpdateInfo(null);
                setError(res.message || "Gagal download update.");
                return;
            }

            await window.electron.jalankanInstaller(res.filePath);
        } catch (err) {
            stopListening();
            setDownloading(false);
            setUpdateInfo(null);
            setError("Gagal download update.");
        }
    };

    if (updateInfo) {
        return (
            <UpdatePrompt
                latestVersion={updateInfo.latestVersion}
                downloading={downloading}
                progress={progress}
                onContinueOld={handleContinueOld}
                onUpdateNow={handleUpdateNow}
            />
        );
    }

    return (
        <Splash
            message={error ?? message}
            error={!!error}
            onRetry={initialize}
        />
    );
}
