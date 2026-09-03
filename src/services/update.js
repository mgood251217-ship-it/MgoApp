import api from "../api/axios";
import config from "./config";
import { isMobile } from "./platform";

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

        const latestVersion = data.data.version;
        const downloadUrl = isMobile
            ? (data.data.download_url_mobile || data.data.download_url)
            : data.data.download_url;
        const minRequiredVersion = data.data.min_required_version || latestVersion;
        const releaseNotes = Array.isArray(data.data.release_notes) ? data.data.release_notes : [];

        const hasUpdate = compareVersions(config.version, latestVersion) < 0;
        const forceUpdate = compareVersions(config.version, minRequiredVersion) < 0;

        return { hasUpdate, latestVersion, downloadUrl, forceUpdate, minRequiredVersion, releaseNotes };
    } catch (err) {
        return { hasUpdate: false, latestVersion: config.version };
    }
}