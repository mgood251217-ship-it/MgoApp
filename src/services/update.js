import api from "../api/axios";
import config from "./config";
import { isMobile, isLinux } from "./platform";

function compareVersions(a, b) {
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    const len = Math.max(pa.length, pb.length);

    for (let i = 0; i < len; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

export async function checkUpdate() {
    try {
        const { data } = await api.get("", { params: { action: "app_version" } });

        if (!data?.success || !data?.data?.version) {
            return { hasUpdate: false, latestVersion: config.version };
        }

        const info = data.data;
        // Rilis Linux dapat diterbitkan terpisah dari Windows; jangan mengirim installer EXE ke Linux.
        const downloadUrl = isLinux ? info.download_url_linux : isMobile
            ? (info.download_url_mobile || info.download_url) : info.download_url;
        if (isLinux && !downloadUrl) return { hasUpdate: false, latestVersion: config.version };
        const latestVersion = isLinux ? (info.version_linux || info.version) : info.version;
        const minRequiredVersion = isLinux
            ? (info.min_required_version_linux || latestVersion)
            : (info.min_required_version || latestVersion);
        const notes = isLinux ? (info.release_notes_linux || info.release_notes) : info.release_notes;
        const releaseNotes = Array.isArray(notes) ? notes : [];

        const hasUpdate = compareVersions(config.version, latestVersion) < 0;
        const forceUpdate = compareVersions(config.version, minRequiredVersion) < 0;

        return { hasUpdate, latestVersion, downloadUrl, forceUpdate, minRequiredVersion, releaseNotes };
    } catch {
        return { hasUpdate: false, latestVersion: config.version };
    }
}