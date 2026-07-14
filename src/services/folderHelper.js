export const FOLDER_STATUS_LABEL = {
    checking: "Mengecek...",
    ada: "✅ Ada",
    "tidak-ada": "❌ Tidak ada",
    "no-path": "⚠️ Path belum diatur",
};

const sanitizeFolderPart = (str) => String(str || "").replace(/[\\/:*?"<>|]/g, "").trim();

const stripVowels = (str) => str.toLowerCase().replace(/[aeiou]/g, "");

const DAY_NAMES = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

const formatTimeHHMM = (date) => {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}.${mm}`;
};

export const formatDeadlineForFolder = (deadline) => {
    if (!deadline) return "";
    const deadlineDate = new Date(String(deadline).replace(" ", "T"));
    if (isNaN(deadlineDate.getTime())) return "";

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const now = new Date();
    const diffDays = Math.round((startOfDay(deadlineDate) - startOfDay(now)) / (1000 * 60 * 60 * 24));
    const timeStr = formatTimeHHMM(deadlineDate);

    if (diffDays === 0) return timeStr;
    if (diffDays === 1) return `${timeStr}bsk`;

    const dayName = DAY_NAMES[deadlineDate.getDay()];
    return `${timeStr}${stripVowels(dayName)}`;
};

export const buildFolderName = (orderData) => {
    const parts = [
        sanitizeFolderPart(orderData.customer_name),
        sanitizeFolderPart(formatDeadlineForFolder(orderData.deadline)),
        sanitizeFolderPart(orderData.op_initial),
        sanitizeFolderPart(orderData.nomorator),
    ];
    return parts.filter(Boolean).join("_").toUpperCase();
};

export const resolveBasePath = (settings, kategori) => {
    if (!kategori) return null;
    const key = `path_${String(kategori).toLowerCase()}`;
    return settings?.[key] || null;
};

export const joinPath = (base, name) => {
    const cleanBase = String(base).replace(/[\\/]+$/, "");
    return `${cleanBase}\\${name}`;
};

export const resolveOrderFolderPath = (settings, row) => {
    const basePath = resolveBasePath(settings, row.kategori);
    if (!basePath) return null;
    return joinPath(basePath, buildFolderName(row));
};

export const checkFoldersForItems = async (settings, orderData, itemsList) => {
    const categoriesInOrder = [...new Set((itemsList || []).map(i => i.category).filter(Boolean))];
    const results = {};

    await Promise.all(categoriesInOrder.map(async (cat) => {
        const basePath = resolveBasePath(settings, cat);
        if (!basePath) {
            results[cat] = "no-path";
            return;
        }
        const folderPath = joinPath(basePath, buildFolderName(orderData));
        try {
            const res = await window.electron.cekFolderOrder(folderPath);
            results[cat] = res?.exists ? "ada" : "tidak-ada";
        } catch (err) {
            results[cat] = "tidak-ada";
        }
    }));

    return results;
};
