export const FOLDER_STATUS_LABEL = {
    checking: "Mengecek...",
    ada: "✅ Ada",
    "tidak-ada": "❌ Tidak ada",
    "no-path": "⚠️ Path belum diatur",
};

const sanitizeFolderPart = (str) => String(str || "").replace(/[\\/:*?"<>|]/g, "").trim();

const stripVowels = (str) => str.toLowerCase().replace(/[aeiou]/g, "");

const DAY_NAMES = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

const MONTH_NAMES_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const formatTimeHHMM = (date) => {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}.${mm}`;
};

export const buildDateSubPath = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(String(dateStr).replace(" ", "T"));
    if (isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, "0");
    const monthName = MONTH_NAMES_ID[d.getMonth()];
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}\\${monthNum} ${monthName}\\${day}`;
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

export const checkFoldersForItems = async (settings, orderData, itemsList) => {
    const categoriesInOrder = [...new Set((itemsList || []).map(i => i.category).filter(Boolean))];
    const results = {};

    const dateSubPath = buildDateSubPath(orderData.date);
    const nomorator = orderData.nomorator;

    await Promise.all(categoriesInOrder.map(async (cat) => {
        const basePath = resolveBasePath(settings, cat);
        if (!basePath) {
            results[cat] = { status: "no-path", path: null };
            return;
        }
        try {
            const res = await window.electron.cariFolderOrder({ basePath, dateSubPath, nomorator });
            results[cat] = res?.found
                ? { status: "ada", path: res.path }
                : { status: "tidak-ada", path: null };
        } catch (err) {
            results[cat] = { status: "tidak-ada", path: null };
        }
    }));

    return results;
};

export const extractQuantityFromFilename = (filename) => {
    const nameNoExt = String(filename).replace(/\.[^/.]+$/, "");
    const qtyMatch = nameNoExt.match(/(\d+)\s*(PCS|KALI|SET|LBR|LEMBAR)/i);
    return qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
};

export const formatUkuran = (file) => {
    if (file.panjangM == null || file.lebarM == null) return "-";
    const estimasi = file.dpiDetected === false ? " (estimasi)" : "";
    return `${file.panjangM} x ${file.lebarM} m${estimasi}`;
};

export const listFilesForFolder = async (folderPath) => {
    if (!folderPath) return { success: false, message: "Path folder kosong.", data: [] };

    try {
        const res = await window.electron.analisisFolderOrder(folderPath);
        if (!res?.success) {
            return { success: false, message: res?.message || "Gagal membaca folder.", data: [] };
        }

        const data = res.data.map((file) => {
            const quantity = extractQuantityFromFilename(file.nama);
            const luas = (file.panjangM != null && file.lebarM != null) ? file.panjangM * file.lebarM : null;
            const totalLuas = luas != null ? Math.round(luas * quantity * 100) / 100 : null;
            return { ...file, quantity, luas, totalLuas };
        });

        return { success: true, data };
    } catch (err) {
        return { success: false, message: "Gagal membaca folder.", data: [] };
    }
};
