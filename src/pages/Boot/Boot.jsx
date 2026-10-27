import { useEffect, useState, useCallback } from "react";
import Splash from "../../components/Splash/Splash";
import UpdatePrompt from "../../components/UpdatePrompt/UpdatePrompt";
import { delay } from "../../services/helpers";
import { isMobile } from "../../services/platform";
import { bootSteps } from "./steps";

export default function Boot({ onComplete }) {
    const [message, setMessage] = useState("Initializing application...");
    const [error, setError] = useState(null);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [installerPath, setInstallerPath] = useState(null);
    const [installing, setInstalling] = useState(false);
    const [updateError, setUpdateError] = useState("");

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
                    onComplete(Boolean(result));
                    return;
                }
            }
            onComplete(false);
        } catch (err) {
            console.error(err);
            setError("Terjadi kesalahan saat memulai aplikasi.");
        }
    }, [onComplete]);

    const initialize = useCallback(() => {
        setError(null);
        setUpdateInfo(null);
        return runSteps(0);
    }, [runSteps]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    const handleContinueOld = () => {
        if (updateInfo?.forceUpdate) return;
        const resumeIndex = updateInfo.nextStepIndex;
        setUpdateInfo(null);
        runSteps(resumeIndex);
    };

    const handleUpdateNowMobile = async () => {
        try {
            await window.electron.bukaLinkEksternal(updateInfo.downloadUrl);
        } catch (err) {
            setError("Gagal membuka link download.");
            return;
        }

        if (!updateInfo.forceUpdate) {
            const resumeIndex = updateInfo.nextStepIndex;
            setUpdateInfo(null);
            runSteps(resumeIndex);
        }
    };

    const handleUpdateNowDesktop = async () => {
        if (downloading) return;
        setDownloading(true);
        setUpdateError("");
        let stopListening = () => {};
        try {
            let filePath = installerPath;
            if (!filePath) {
                setProgress(0);
                stopListening = window.electron.onDownloadProgress(setProgress);
                const res = await window.electron.downloadUpdate(updateInfo.downloadUrl);
                if (!res.success || !res.filePath) throw new Error(res.message || "Gagal download update.");
                filePath = res.filePath;
                setInstallerPath(filePath);
            }
            setProgress(100);
            setInstalling(true);
            const result = await window.electron.jalankanInstaller(filePath);
            if (!result?.success) throw new Error(result?.message || "Gagal membuka installer.");
            // Keep the busy state until the native command closes MGO after launch succeeds.
        } catch (err) {
            setUpdateError(err.message || String(err) || "Gagal memperbarui aplikasi.");
            setDownloading(false);
            setInstalling(false);
        } finally {
            stopListening();
        }
    };

    const handleUpdateNow = isMobile ? handleUpdateNowMobile : handleUpdateNowDesktop;

    if (updateInfo) {
        return (
            <UpdatePrompt
                latestVersion={updateInfo.latestVersion}
                downloading={downloading}
                progress={progress}
                installing={installing}
                error={updateError}
                installerReady={!!installerPath}
                onDownloadAgain={() => { setInstallerPath(null); setProgress(0); setUpdateError(""); }}
                mandatory={updateInfo.forceUpdate}
                releaseNotes={updateInfo.releaseNotes}
                onContinueOld={handleContinueOld}
                onUpdateNow={handleUpdateNow}
                showProgress={!isMobile}
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
