import api from "../api/axios";
import config from "./config";

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

        if (!data?.success || !data?.data?.version) return true;

        const latestVersion = data.data.version;
        const downloadUrl = data.data.download_url;
        const isOutdated = compareVersions(config.version, latestVersion) < 0;

        if (isOutdated && downloadUrl) {
            try {
                await window.electron.bukaLinkEksternal(downloadUrl);
            } catch (err) {}
        }

        return true;
    } catch (err) {
        return true;
    }
}
