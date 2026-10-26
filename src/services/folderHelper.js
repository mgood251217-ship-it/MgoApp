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

export const getProductionFolderOptions = (settings, pathKey) => {
    const key = pathKey.startsWith("path_") ? pathKey : `path_${pathKey}`;
    const monthFormat = settings?.[`${key}_month_format`];
    return {
        monthFormat: ["number_name", "number", "name"].includes(monthFormat) ? monthFormat : "number_name",
        separateByProduct: settings?.[`${key}_separate_by_product`] === true,
    };
};

export const buildDateSubPath = (dateStr, monthFormat = "number_name") => {
    if (!dateStr) return "";
    const d = new Date(String(dateStr).replace(" ", "T"));
    if (isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, "0");
    const monthName = MONTH_NAMES_ID[d.getMonth()];
    const day = String(d.getDate()).padStart(2, "0");

    const month = monthFormat === "number" ? monthNum : monthFormat === "name" ? monthName : `${monthNum} ${monthName}`;
    return `${year}\\${month}\\${day}`;
};

export const buildProductionPathPreview = (basePath, options, dateStr, productName = "PRINTPRESS") => {
    if (!basePath) return "Pilih atau isi path terlebih dahulu.";
    const path = joinPath(basePath, buildDateSubPath(dateStr, options.monthFormat));
    return options.separateByProduct ? joinPath(path, sanitizeFolderPart(productName).toUpperCase()) : path;
};

export const buildDateParts = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(String(dateStr).replace(" ", "T"));
    if (isNaN(d.getTime())) return null;

    return {
        year: d.getFullYear(),
        monthNum: d.getMonth() + 1,
        monthName: MONTH_NAMES_ID[d.getMonth()],
        day: d.getDate(),
    };
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

const CATEGORY_PATH_MAP = {
    AKRILIK: ["akrilik"],
    "MERCENDISE AKRILIK": ["akrilik"],
    "LASER A3": ["laser"],
    MERCENDISE: ["laser"],
    "KARTU NAMA": ["laser"],
    STAMP: ["laser"],
    INDOOR: ["indoor"],
    "PAKET INDOOR OUTDOOR": ["indoor", "outdoor"],
    OUTDOOR: ["outdoor"],
    DTF: ["dtf"],
    SUBLIM: ["sublim"],
};

const STANDARD_WIDTHS = {
    sublim: [1.2, 1.5, 1.8],
    dtf: [0.58],
};

export const roundUpToStandardWidth = (value, pathKey) => {
    const sizes = STANDARD_WIDTHS[pathKey];
    if (!sizes || value == null) return value;
    const match = sizes.find(s => value <= s + 1e-9);
    return match != null ? match : value;
};

export const getProductFolderName = (item) => sanitizeFolderPart(item.product_name || (item.product_id ? `PRODUK ${item.product_id}` : "TANPA PRODUK")).replace(/[. ]+$/g, "").toUpperCase() || "TANPA PRODUK";

export const folderInfoMatchesItem = (info, item) => info.category === item.category &&
    (!info.productFolder || info.productFolder === getProductFolderName(item));

export const getItemFolderStatus = (statuses, item) => Object.values(statuses).find(info => folderInfoMatchesItem(info, item))
    || statuses[item.category];

export const checkFoldersForItems = async (settings, orderData, itemsList) => {
    const relevantItems = (itemsList || []).filter(i => i.category && !i.maklun_store);
    const categoriesInOrder = [...new Set(relevantItems.map(i => i.category))];
    const results = {};
    const dateParts = buildDateParts(orderData.date);
    const nomorator = String(orderData.nomorator ?? "").trim();

    await Promise.all(categoriesInOrder.map(async (cat) => {
        const pathKeys = CATEGORY_PATH_MAP[String(cat).toUpperCase()];
        if (!pathKeys) return;
        const configuredKeys = pathKeys.filter(key => settings?.[`path_${key}`]);
        if (!configuredKeys.length) {
            results[cat] = { status: "no-path", category: cat, path: null, createPath: null, createInfo: null, pathKey: null };
            return;
        }
        const splitProducts = configuredKeys.some(key => getProductionFolderOptions(settings, key).separateByProduct);
        const products = splitProducts
            ? [...new Set(relevantItems.filter(item => item.category === cat).map(getProductFolderName))]
            : [null];
        for (const product of products) {
            const resultKey = product ? `${cat} / ${product}` : cat;
            for (const key of configuredKeys) {
                if (!dateParts) continue;
                const options = getProductionFolderOptions(settings, key);
                const productFolder = options.separateByProduct ? product : null;
                const basePath = settings[`path_${key}`];
                try {
                    const res = await window.electron.cariFolderOrder({
                        basePath, ...dateParts, nomorator,
                        monthFormat: settings[`path_${key}_month_format`] ? options.monthFormat : null,
                        productFolder,
                    });
                    if (res?.found) {
                        results[resultKey] = { status: "ada", category: cat, productFolder, path: res.path, createPath: null, createInfo: null, pathKey: key };
                        break;
                    }
                } catch (err) {}
            }
            if (!results[resultKey]) {
                const key = configuredKeys[0];
                const basePath = settings[`path_${key}`];
                const options = getProductionFolderOptions(settings, key);
                const productFolder = options.separateByProduct ? product : null;
                const folderName = buildFolderName(orderData);
                const parentPath = buildProductionPathPreview(basePath, options, orderData.date, product || "");
                const createPath = dateParts ? joinPath(parentPath, folderName) : null;
                const createInfo = dateParts ? {
                    basePath, ...dateParts, folderName, nomorator,
                    monthFormat: settings[`path_${key}_month_format`] ? options.monthFormat : null,
                    productFolder,
                } : null;
                results[resultKey] = { status: "tidak-ada", category: cat, productFolder, path: null, createPath, createInfo, pathKey: key };
            }
        }
    }));
    return results;
};

export const extractQuantityFromFilename = (filename) => {
    const nameNoExt = String(filename).replace(/\.[^/.]+$/, "");

    let match = nameNoExt.match(/(?:^|[^0-9a-zA-Z.])(\d+)(\s*)(PCS|PC|KALI|SET|LBR|LMB|LEMBAR|BUAH|BIJI|BOX|RIM|ROLL|BUKU|PLY|EKS|COPIES|COPY)(?![a-zA-Z])/i);
    if (match) return parseInt(match[1], 10);

    match = nameNoExt.match(/(?:^|[^a-zA-Z])(?:QTY|JUMLAH|JML)\s*[:=.-]?\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);

    match = nameNoExt.match(/(?:^|[^0-9a-zA-Z.])(\d+)(\s*)(X)(?!\s*[0-9.a-zA-Z])/i);
    if (match) return parseInt(match[1], 10);

    return 1;
};

export const buildRenamedFilenameWithQuantity = (filename, newQuantity) => {
    const extMatch = String(filename).match(/\.[^/.]+$/);
    const ext = extMatch ? extMatch[0] : "";
    const nameNoExt = ext ? filename.slice(0, -ext.length) : filename;

    let match = nameNoExt.match(/(^|[^0-9a-zA-Z.])(\d+)(\s*)(PCS|PC|KALI|SET|LBR|LMB|LEMBAR|BUAH|BIJI|BOX|RIM|ROLL|BUKU|PLY|EKS|COPIES|COPY)(?![a-zA-Z])/i);
    if (match) {
        const before = nameNoExt.slice(0, match.index) + match[1];
        const after = nameNoExt.slice(match.index + match[0].length);
        return `${before}${newQuantity}${match[3]}${match[4]}${after}${ext}`;
    }

    match = nameNoExt.match(/(^|[^a-zA-Z])(QTY|JUMLAH|JML)(\s*[:=.-]?\s*)(\d+)/i);
    if (match) {
        const before = nameNoExt.slice(0, match.index) + match[1];
        const after = nameNoExt.slice(match.index + match[0].length);
        return `${before}${match[2]}${match[3]}${newQuantity}${after}${ext}`;
    }

    match = nameNoExt.match(/(^|[^0-9a-zA-Z.])(\d+)(\s*)(X)(?!\s*[0-9.a-zA-Z])/i);
    if (match) {
        const before = nameNoExt.slice(0, match.index) + match[1];
        const after = nameNoExt.slice(match.index + match[0].length);
        return `${before}${newQuantity}${match[3]}${match[4]}${after}${ext}`;
    }

    return `${nameNoExt}_${newQuantity}PCS${ext}`;
};

export const formatUkuran = (file) => {
    if (file.panjangM == null || file.lebarM == null) return "-";
    const estimasi = file.dpiDetected === false ? " (estimasi)" : "";
    return `${file.panjangM} x ${file.lebarM} m${estimasi}`;
};

export const listFilesForFolder = async (folderPath, pathKey) => {
    if (!folderPath) return { success: false, message: "Path folder kosong.", data: [] };

    try {
        const res = await window.electron.analisisFolderOrder(folderPath);
        if (!res?.success) {
            return { success: false, message: res?.message || "Gagal membaca folder.", data: [] };
        }

        const data = res.data.map((file) => {
            const quantity = extractQuantityFromFilename(file.nama);
            const panjangM = roundUpToStandardWidth(file.panjangM, pathKey);
            const luas = (panjangM != null && file.lebarM != null) ? panjangM * file.lebarM : null;
            const totalLuas = luas != null ? Math.round(luas * quantity * 100) / 100 : null;
            return { ...file, panjangM, quantity, luas, totalLuas };
        });

        return { success: true, data };
    } catch (err) {
        return { success: false, message: "Gagal membaca folder.", data: [] };
    }
};
