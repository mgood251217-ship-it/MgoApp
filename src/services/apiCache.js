import api from "../api/axios";
import { getTodayDate } from "./helpers";

const pendingRequests = new Map();
const requestVersions = new Map();
let cacheGeneration = 0;

const getRequestScope = () => {
    try {
        const session = JSON.parse(localStorage.getItem("mgo_session") || "null");
        return JSON.stringify([session?.token, session?.user?.user_id, session?.store?.store_id]);
    } catch {
        return "";
    }
};

const getSharedResponse = (url, config = {}) => {
    const scope = getRequestScope();
    const generation = cacheGeneration;
    const action = config.params?.action || url;
    const version = requestVersions.get(action) || 0;
    const params = Object.entries(config.params || {}).sort(([first], [second]) => first.localeCompare(second));
    const key = JSON.stringify([generation, version, scope, url, params]);
    if (pendingRequests.has(key)) return pendingRequests.get(key);

    const request = api.get(url, config).then(response => {
        if (generation !== cacheGeneration || scope !== getRequestScope()) {
            const error = new Error("Sesi cache berubah.");
            error.name = "AbortError";
            throw error;
        }
        if (version !== (requestVersions.get(action) || 0)) return getSharedResponse(url, config);
        return response;
    }).finally(() => pendingRequests.delete(key));
    pendingRequests.set(key, request);
    return request;
};

const memoryFallback = new Map();
const localOrderListeners = new Set();
const localPaymentListeners = new Set();
const cacheEntryLimits = { finishingsByCategory: 100, paginatedProducts: 100, orderProductSearch: 50, orders: 50, transactionsDetail: 50 };
let storageScope = getRequestScope();

const syncStorageScope = () => {
    const scope = getRequestScope();
    if (scope === storageScope) return;
    storageScope = scope;
    resetRuntimeCache();
};

const getStorage = (key, defaultVal) => {
    syncStorageScope();
    try {
        const value = memoryFallback.get(key) ?? localStorage.getItem(`mgo_cache_${key}`);
        return value ? JSON.parse(value) : defaultVal;
    } catch {
        return defaultVal;
    }
};

const setStorage = (key, value) => {
    syncStorageScope();
    const limit = cacheEntryLimits[key];
    if (limit && value && typeof value === "object" && !Array.isArray(value)) {
        const entries = Object.entries(value).filter(([entryKey]) => !entryKey.startsWith("_"));
        if (entries.length > limit) {
            const metadata = Object.entries(value).filter(([entryKey]) => entryKey.startsWith("_"));
            const recent = entries.slice(-limit);
            value = Object.fromEntries([...metadata, ...recent]);
        }
    }
    const serialized = JSON.stringify(value);
    try {
        localStorage.setItem(`mgo_cache_${key}`, serialized);
        memoryFallback.delete(key);
    } catch {
        memoryFallback.set(key, serialized);
        // Jangan biarkan timestamp baru dipasangkan dengan data lama setelah restart.
        try { localStorage.removeItem(`mgo_cache_${key}`); } catch { /* Penyimpanan dapat dinonaktifkan. */ }
    }
    if (["orders", "orderDetail", "transactionsDetail"].includes(key)) localOrderListeners.forEach(listener => listener());
    if (["paymentHistory", "transactionsDetail"].includes(key)) localPaymentListeners.forEach(listener => listener());
};

const removeStorage = key => {
    memoryFallback.delete(key);
    try { localStorage.removeItem(`mgo_cache_${key}`); } catch { /* Cache memori sudah dibersihkan. */ }
};

const resetRuntimeCache = () => {
    memoryFallback.clear();
    cacheGeneration++;
    pendingRequests.clear();
    requestVersions.clear();
    datasetCache = null;
    datasetPromise = null;
    lastFetchTime = 0;
};

const invalidateRequests = actions => {
    for (const action of new Set([...actions, "check_update_dataset"])) {
        requestVersions.set(action, (requestVersions.get(action) || 0) + 1);
    }
    datasetCache = null;
    datasetPromise = null;
    lastFetchTime = 0;
};

// Cache lama memakai milidetik ketika penanda server belum tersedia.
// Ambil ulang sekali saat server sudah memiliki penanda dalam detik.
const isCacheOutdated = (cachedTime, serverTime) => {
    const cached = Number(cachedTime) || 0;
    const server = Number(serverTime) || 0;
    return cached < server || (server > 0 && server < 1e12 && cached > 1e12);
};

// Detail order memakai nama dari master, jadi perubahan master juga membatalkan cache.
const getOrderCacheVersion = dataset => Math.max(
    dataset.orders_updated_at || 0,
    dataset.products_updated_at || 0,
    dataset.categories_updated_at || 0,
    dataset.finishings_updated_at || 0,
    dataset.product_variants_updated_at || 0,
    dataset.production_components_updated_at || 0,
);

const getCleanedDailyMap = (key) => {
    const map = getStorage(key, {}) || {};
    const today = new Date().toDateString();

    if (map._lastCleared !== today) {
        return { _lastCleared: today };
    }
    return map;
};

let datasetCache = null;
let datasetPromise = null;
let lastFetchTime = 0;

const getServerDataset = async () => {
    const now = Date.now();

    syncStorageScope();
    if (lastFetchTime > 0 && now - lastFetchTime < 3000) {
        return datasetCache || {};
    }

    if (datasetPromise) {
        return datasetPromise;
    }

    const request = getSharedResponse("", { params: { action: "check_update_dataset" } })
        .then(res => {
            if (datasetPromise !== request) return datasetCache || {};
            datasetCache = res.data?.data || {};
            lastFetchTime = Date.now();
            return datasetCache;
        })
        .catch(() => {
            if (datasetPromise === request) lastFetchTime = Date.now();
            return datasetCache || {};
        })
        .finally(() => {
            if (datasetPromise === request) datasetPromise = null;
        });
    datasetPromise = request;

    return datasetPromise;
};

export const validateStoreCache = (newStoreName) => {
    const oldStoreName = localStorage.getItem("last_store_name");

    if (oldStoreName && oldStoreName !== newStoreName) {
        const recaptchaBackup = localStorage.getItem("_grecaptcha");

        resetRuntimeCache();
        localStorage.clear();

        if (recaptchaBackup !== null) {
            localStorage.setItem("_grecaptcha", recaptchaBackup);
        }

        console.log(`Cache dibersihkan karena pindah dari toko "${oldStoreName}" ke "${newStoreName}"`);
    }

    if (newStoreName) {
        localStorage.setItem("last_store_name", newStoreName);
    }
};

export const getCachedStoreData = async (onUpdate) => {
    const cachedData = getStorage("storeData", null);
    const cachedTime = getStorage("storeData_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.store_data_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "store" } });
                const result = res.data?.data || [];
                setStorage("storeData", result);
                setStorage("storeData_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
}

export const getCachedUsers = async (onUpdate) => {
    const cachedData = getStorage("users", null);
    const cachedTime = getStorage("users_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.users_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "users" } });
                const result = res.data?.data || [];
                setStorage("users", result);
                setStorage("users_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
};

export const getCachedInitials = async (onUpdate) => {
    const cachedData = getStorage("initials", null);
    const cachedTime = getStorage("initials_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.initials_updated_at || dataset.users_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "get_initial" } });
                const result = res.data?.data || [];
                setStorage("initials", result);
                setStorage("initials_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
};

export const getCachedMachines = async (onUpdate) => {
    const cachedData = getStorage("machines", null);
    const cachedTime = getStorage("machines_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.machines_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "machines" } });
                const result = res.data?.data || [];
                setStorage("machines", result);
                setStorage("machines_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
};

export const getCachedLocations = async (onUpdate) => {
    const cachedData = getStorage("locations", null);
    const cachedTime = getStorage("locations_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.locations_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "locations" } });
                const result = res.data?.data || [];
                setStorage("locations", result);
                setStorage("locations_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
};

export const getCachedStoreNames = async (onUpdate) => {
    const cachedData = getStorage("storeNames", null);
    const cachedTime = getStorage("storeNames_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.store_names_updated_at || dataset.storeNames_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "store_names" } });
                const result = res.data?.data || [];
                setStorage("storeNames", result);
                setStorage("storeNames_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
};

export const getCachedFailures = async (startDate, endDate, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const failuresMap = getCleanedDailyMap("failures");
    const cachedItem = failuresMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.failures_updated_at || 0;

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "failure", start_date: startDate, end_date: endDate } });
                const result = res.data?.data || [];
                const currentMap = getCleanedDailyMap("failures");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("failures", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || [];
};

export const getCachedCategories = async (onUpdate) => {
    const cachedData = getStorage("categories", null);
    const cachedTime = getStorage("categories_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.categories_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "categories" } });
                const result = res.data?.data || [];
                setStorage("categories", result);
                setStorage("categories_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
};

export const getCachedProductsByCategory = async (categoryId, onUpdate) => {
    if (!categoryId) return [];

    const productsMap = getStorage("productsByCategory", {});
    const cachedItem = productsMap[categoryId];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = Math.max(dataset.products_updated_at || 0, dataset.categories_updated_at || 0);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "products_by_category", category_id: categoryId } });
                const result = res.data?.data || [];
                const currentMap = getStorage("productsByCategory", {});
                currentMap[categoryId] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("productsByCategory", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || [];
};

export const getCachedGlobalStocks = async (month, onUpdate) => {
    if (!month) return {};

    const stocksMap = getStorage("globalStocksByMonth", {});
    const cachedItem = stocksMap[month];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.global_stocks_updated_at || 0;

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "grouped_stock_global_stock", month: month } });
                const result = res.data?.success ? (res.data.data.grouped_stocks || {}) : {};
                const currentMap = getStorage("globalStocksByMonth", {});
                currentMap[month] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("globalStocksByMonth", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || {};
};

export const getCachedFinishingsByCategory = async (categoryId, onUpdate, productId = 0, orderItemId = 0) => {
    if (!categoryId) return [];

    const cacheKey = productId ? `product_${productId}_${orderItemId}` : categoryId;
    const finishingsMap = getStorage("finishingsByCategory", {});
    const cachedItem = finishingsMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = Math.max(dataset.products_updated_at || 0, dataset.product_finishings_updated_at || 0, dataset.finishings_updated_at || 0, dataset.categories_updated_at || 0, dataset.product_finishing_prices_updated_at || 0);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "finishing_by_category", category_id: categoryId, product_id: productId, order_item_id: orderItemId } });
                const result = res.data?.data || [];
                const currentMap = getStorage("finishingsByCategory", {});
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("finishingsByCategory", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || [];
};

export const getCachedProductFinishingPrices = async (categoryId, onUpdate, { throwOnError = false } = {}) => {
    if (!categoryId) return [];
    const cacheKey = "productFinishingPricesByCategory";
    const stored = getStorage(cacheKey, {})[categoryId];
    const cached = stored?.version === 2 ? stored : null;
    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = Math.max(dataset.product_finishing_prices_updated_at || 0, dataset.products_updated_at || 0,
            dataset.categories_updated_at || 0, dataset.finishings_updated_at || 0);
        if (cached && !isCacheOutdated(cached.updatedAt, serverTime)) return cached.data;
        const res = await getSharedResponse("", { params: { action: "product_finishing_prices", category_id: categoryId } });
        if (!res.data?.success || !Array.isArray(res.data.data)) throw new Error("Gagal memuat harga paket.");
        const rows = res.data.data;
        const map = getStorage(cacheKey, {});
        map[categoryId] = { data: rows, updatedAt: serverTime, version: 2 };
        setStorage(cacheKey, map);
        onUpdate?.(rows);
        return rows;
    };
    if (cached) {
        fetchLatest().catch(() => {});
        return cached.data;
    }
    // Server lama belum memiliki endpoint ini; form biasa tetap dapat digunakan.
    return fetchLatest().catch(error => {
        if (throwOnError) throw error;
        return [];
    });
};

export const getCachedProductLaserConversions = async (categoryId, onUpdate, { throwOnError = false } = {}) => {
    if (!categoryId) return [];
    const key = "productLaserConversionsByCategory";
    const cached = getStorage(key, {})[categoryId];
    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = Math.max(dataset.product_laser_conversion_updated_at || 0, dataset.products_updated_at || 0, dataset.categories_updated_at || 0, dataset.finishings_updated_at || 0);
        if (cached && !isCacheOutdated(cached.updatedAt, serverTime)) return cached.data;
        const res = await getSharedResponse("", { params: { action: "product_laser_conversions", category_id: categoryId } });
        if (!res.data?.success || !Array.isArray(res.data.data)) throw new Error("Gagal memuat varian print laser.");
        const map = getStorage(key, {});
        map[categoryId] = { data: res.data.data, updatedAt: serverTime };
        setStorage(key, map);
        onUpdate?.(res.data.data);
        return res.data.data;
    };
    if (cached) {
        fetchLatest().catch(() => {});
        return cached.data;
    }
    return fetchLatest().catch(error => {
        if (throwOnError) throw error;
        return [];
    });
};

export const getCachedProductBundles = async (onUpdate, { throwOnError = false } = {}) => {
    const key = 'productBundles';
    const cached = getStorage(key, null);
    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = Math.max(dataset.product_bundles_updated_at || 0, dataset.products_updated_at || 0,
            dataset.product_variants_updated_at || 0, dataset.product_laser_conversion_updated_at || 0,
            dataset.categories_updated_at || 0, dataset.finishings_updated_at || 0, dataset.production_components_updated_at || 0);
        if (cached && !isCacheOutdated(cached.updatedAt, serverTime)) return cached.data;
        const res = await getSharedResponse('', { params: { action: 'product_bundles' } });
        if (!res.data?.success || !Array.isArray(res.data.data)) throw new Error('Gagal memuat paket gabungan.');
        setStorage(key, { data: res.data.data, updatedAt: serverTime });
        onUpdate?.(res.data.data); return res.data.data;
    };
    if (cached) { fetchLatest().catch(() => {}); return cached.data; }
    return fetchLatest().catch(error => {
        if (throwOnError) throw error;
        return [];
    });
};

export const getCachedProductVariants = async (productId, onUpdate, { throwOnError = false } = {}) => {
    if (!productId) return [];
    const key = 'productVariantsByProduct';
    const cached = getStorage(key, {})[productId];
    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = Math.max(dataset.product_variants_updated_at || 0, dataset.products_updated_at || 0, dataset.categories_updated_at || 0, dataset.product_price_tiers_updated_at || 0, dataset.production_components_updated_at || 0);
        const hasPriceTiers = cached?.data?.every(variant => Array.isArray(variant.price_tiers));
        if (cached && hasPriceTiers && !isCacheOutdated(cached.updatedAt, serverTime)) return cached.data;
        const res = await getSharedResponse('', { params: { action: 'product_variants', product_id: productId } });
        if (!res.data?.success || !Array.isArray(res.data.data)) throw new Error('Gagal memuat varian produk.');
        const map = getStorage(key, {});
        map[productId] = { data: res.data.data, updatedAt: serverTime };
        setStorage(key, map); onUpdate?.(res.data.data);
        return res.data.data;
    };
    if (cached) { fetchLatest().catch(() => {}); return cached.data; }
    return fetchLatest().catch(error => {
        if (throwOnError) throw error;
        return [];
    });
};

export const searchOrderProducts = async (search) => {
    const query = search.trim().replace(/\s+/g, ' ').toLowerCase();
    if (query.length < 2) return [];
    const cached = getStorage('orderProductSearch', {})[query];
    try {
        const dataset = await getServerDataset();
        const updatedAt = Math.max(dataset.products_updated_at || 0, dataset.product_variants_updated_at || 0, dataset.categories_updated_at || 0);
        if (cached && !isCacheOutdated(cached.updatedAt, updatedAt) && Date.now() - cached.savedAt < 60000) return cached.data;
        const response = await getSharedResponse('', { params: { action: 'search_order_products', search: query } });
        if (!response.data?.success || !Array.isArray(response.data.data)) throw new Error('Pencarian produk gagal.');
        const map = getStorage('orderProductSearch', {});
        map[query] = { data: response.data.data, updatedAt, savedAt: Date.now() };
        setStorage('orderProductSearch', map);
        return response.data.data;
    } catch (error) {
        if (cached) return cached.data;
        throw error;
    }
};

export const getCachedPaginatedProducts = async (page, limit, search, onUpdate, categoryId = 0) => {
    const category = Number(categoryId) || 0;
    const cacheKey = `${category}_${page}_${limit}_${search}`;
    const paginatedMap = getStorage("paginatedProducts", {});
    const cachedItem = paginatedMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = Math.max(dataset.products_updated_at || 0, dataset.product_variants_updated_at || 0, dataset.categories_updated_at || 0, dataset.product_price_tiers_updated_at || 0, dataset.product_promotions_updated_at || 0);
        const hasProductDetails = cachedItem?.result?.data?.every(product => Object.hasOwn(product, "variant_count") && Array.isArray(product.price_tiers) && Object.hasOwn(product, "promotion") && Object.hasOwn(product, "package_count") && Object.hasOwn(product, "laser_conversion_count") && Object.hasOwn(product, "has_bundle"));

        if (!cachedItem || !hasProductDetails || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "pagination_products", page, limit, search, category_id: category } });
                const result = {
                    data: res.data?.data?.data ?? [],
                    total_pages: res.data?.data?.total_pages ?? 1
                };
                const currentMap = getStorage("paginatedProducts", {});
                currentMap[cacheKey] = { result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("paginatedProducts", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.result;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.result;
    }

    return (await fetchLatest()) || { data: [], total_pages: 1 };
};

export const getCachedFinishings = async (onUpdate) => {
    const cachedData = getStorage("finishings", null);
    const cachedTime = getStorage("finishings_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.finishings_updated_at || 0;

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "finishings" } });
                const result = res.data?.data || [];
                setStorage("finishings", result);
                setStorage("finishings_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || [];
};

export const getCachedOrdersAnalysis = async (onUpdate) => {
    const cachedData = getStorage("ordersAnalysis", null);
    const cachedTime = getStorage("ordersAnalysis_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "order_analysis" } });
                const result = res.data?.data || { chart_30: {}, chart_365: {}, summary: {} };
                setStorage("ordersAnalysis", result);
                setStorage("ordersAnalysis_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || { chart_30: {}, chart_365: {}, summary: {} };
}

export const subscribeLocalOrdersCache = listener => {
    localOrderListeners.add(listener);
    return () => localOrderListeners.delete(listener);
};

export const getLocalOrdersForBackup = (date = getTodayDate()) => {
    const entries = [];
    for (const source of ["orders", "transactionsDetail", "orderDetail"]) {
        for (const entry of Object.values(getCleanedDailyMap(source))) {
            if (!entry?.data || typeof entry.data !== "object") continue;
            const time = Number(entry.updatedAt) || 0;
            entries.push({ source, data: entry.data, updatedAt: time > 0 && time < 1e12 ? time * 1000 : time });
        }
    }
    entries.sort((a, b) => a.updatedAt - b.updatedAt);

    const latest = new Map();
    const addOrder = (order, items, paid) => {
        if (!order?.order_id || typeof order.date !== "string" || order.date.slice(0, 10) !== date) return;
        const key = String(order.order_id);
        const values = {
            order_id: order.order_id,
            nomorator: order.nomorator,
            date: order.date,
            customer_name: order.customer_name,
            operator: order.operator || order.op_initial || order.operator_initial,
            total: order.total,
            total_paid: order.total_paid ?? paid
        };
        const snapshot = { ...latest.get(key), ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) };
        if (Array.isArray(items)) {
            snapshot.items = items.filter(item => item && typeof item === "object").map(item => ({
                judul: item.judul || item.product_name || "-",
                variant_label: item.variant?.label || item.variant_label,
                laser_material_name: item.laser_material_name,
                finishing_names: item.finishing_names,
                size: item.size,
                quantity: item.quantity,
                unit: item.unit,
                amount: item.amount
            }));
        }
        latest.set(key, snapshot);
    };

    for (const { source, data } of entries) {
        if (source === "orders") {
            for (const orders of [data.offline, data.online]) {
                if (Array.isArray(orders)) orders.forEach(order => addOrder(order));
            }
        } else if (source === "transactionsDetail") {
            if (!Array.isArray(data.orders)) continue;
            for (const order of data.orders) {
                if (!order) continue;
                const payments = data.paymentsByOrder?.[order.order_id];
                const paid = Array.isArray(payments)
                    ? payments.reduce((sum, payment) => sum + (Number(payment.nominal) || 0), 0) : undefined;
                const items = data.itemsByOrder ? data.itemsByOrder[order.order_id] || [] : undefined;
                addOrder(order, items, paid);
            }
        } else {
            addOrder(data.order, data.items);
        }
    }
    return [...latest.values()].sort((a, b) => Number(a.order_id) - Number(b.order_id));
};

export const subscribeLocalPaymentsCache = listener => {
    localPaymentListeners.add(listener);
    return () => localPaymentListeners.delete(listener);
};

export const cacheOrderPayments = (orderId, payments, order = {}, replace = true) => {
    if (!orderId || !Array.isArray(payments)) return;
    const today = getTodayDate();
    const map = getCleanedDailyMap("paymentHistory");
    const previous = map[String(orderId)]?.data;
    const validPayments = payments.filter(payment => payment?.payment_id && String(payment.order_id) === String(orderId)
        && typeof payment.date === "string" && payment.date.slice(0, 10) === today);
    if (!replace && !validPayments.length) return;
    const rows = new Map();
    if (!replace) {
        for (const payment of previous?.payments || []) rows.set(String(payment.payment_id), payment);
    }
    for (const payment of validPayments) {
        rows.set(String(payment.payment_id), {
            payment_id: payment.payment_id,
            order_id: payment.order_id,
            nominal: payment.nominal,
            payment_method: payment.payment_method,
            status: payment.status,
            date: payment.date
        });
    }
    map[String(orderId)] = {
        updatedAt: Date.now(),
        data: {
            order: { order_id: orderId, nomorator: order.nomorator ?? previous?.order?.nomorator, customer_name: order.customer_name ?? previous?.order?.customer_name },
            payments: [...rows.values()],
            complete: replace || previous?.complete === true
        }
    };
    setStorage("paymentHistory", map);
};

export const getLocalPaymentsForBackup = (date = getTodayDate()) => {
    const entries = [];
    for (const source of ["transactionsDetail", "paymentHistory"]) {
        for (const entry of Object.values(getCleanedDailyMap(source))) {
            if (!entry?.data || typeof entry.data !== "object") continue;
            const time = Number(entry.updatedAt) || 0;
            entries.push({ source, data: entry.data, updatedAt: time > 0 && time < 1e12 ? time * 1000 : time });
        }
    }
    entries.sort((a, b) => a.updatedAt - b.updatedAt);
    const byOrder = new Map();
    const addPayments = (orderId, payments, order = {}, replace = true) => {
        const key = String(orderId);
        const previous = byOrder.get(key);
        const metadata = {
            nomorator: order.nomorator ?? previous?.metadata.nomorator,
            customer_name: order.customer_name ?? previous?.metadata.customer_name
        };
        const rows = replace ? new Map() : previous?.payments || new Map();
        for (const payment of payments) {
            if (!payment?.payment_id || String(payment.order_id) !== key || typeof payment.date !== "string" || payment.date.slice(0, 10) !== date) continue;
            rows.set(String(payment.payment_id), {
                payment_id: payment.payment_id,
                order_id: payment.order_id,
                date: payment.date,
                nominal: payment.nominal,
                payment_method: payment.payment_method,
                status: payment.status
            });
        }
        byOrder.set(key, { metadata, payments: rows });
    };
    for (const { source, data } of entries) {
        if (source === "paymentHistory") {
            if (data.order?.order_id && Array.isArray(data.payments)) addPayments(data.order.order_id, data.payments, data.order, data.complete === true);
        } else {
            const orders = new Map((Array.isArray(data.orders) ? data.orders : []).filter(Boolean).map(order => [String(order.order_id), order]));
            const orderIds = new Set([...orders.keys(), ...Object.keys(data.paymentsByOrder || {})]);
            for (const orderId of orderIds) {
                const payments = data.paymentsByOrder?.[orderId] || [];
                if (Array.isArray(payments)) addPayments(orderId, payments, orders.get(orderId));
            }
        }
    }
    const payments = [...byOrder.values()].flatMap(group => [...group.payments.values()].map(payment => ({ ...payment, ...group.metadata })));
    return payments.sort((a, b) => a.date.localeCompare(b.date) || Number(a.payment_id) - Number(b.payment_id));
};

export const getCachedOrders = async (startDate, endDate, search, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}_${search}`;
    const ordersMap = getCleanedDailyMap("orders");
    const cachedItem = ordersMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "get_orders", search: search, start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("orders");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("orders", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || {};
};

export const getCachedOrderDetail = async (orderId, onUpdate) => {
    const cacheKey = String(orderId);
    const orderMap = getCleanedDailyMap("orderDetail");
    const cachedItem = orderMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const globalOrderUpdate = getOrderCacheVersion(dataset);
        let specificOrderUpdate = 0;

        if (dataset.order_trigger && dataset.order_trigger[cacheKey]) {
            specificOrderUpdate = dataset.order_trigger[cacheKey];
        }

        const serverTime = Math.max(globalOrderUpdate, specificOrderUpdate);

        if (!cachedItem || !Array.isArray(cachedItem.data?.discounts) || cachedItem.data?.items?.some(item => !Object.prototype.hasOwnProperty.call(item, 'laser_product_id') || !Object.prototype.hasOwnProperty.call(item, 'tier_pricing') || !Object.prototype.hasOwnProperty.call(item, 'promotion') || !Object.prototype.hasOwnProperty.call(item, 'variant')) || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "order_detail", order_id: orderId } });
                const result = res.data?.data || null;

                if (result) {
                    const currentMap = getCleanedDailyMap("orderDetail");
                    currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                    setStorage("orderDetail", currentMap);
                    if (onUpdate) onUpdate(result);
                }
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem ? cachedItem.data : [];
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || [];
};

export const getCachedTransactionsCapture = async (startDate, endDate, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const transactionsMap = getCleanedDailyMap("transactionsCapture");
    const cachedItem = transactionsMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "transactions_capture", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("transactionsCapture");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("transactionsCapture", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || {};
};

export const getCachedTransactionsDetail = async (startDate, endDate, search, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}_${search}`;
    const transactionsDetailMap = getCleanedDailyMap("transactionsDetail");
    const cachedItem = transactionsDetailMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "transactions_detail", start_date: startDate, end_date: endDate, search: search }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("transactionsDetail");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("transactionsDetail", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || {};
};

export const getCachedAllOrderDetail = async (startDate, endDate, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const allOrderDetailMap = getCleanedDailyMap("allOrderDetail");
    const cachedItem = allOrderDetailMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "all_detail_order", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("allOrderDetail");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("allOrderDetail", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || {};
};

export const getCachedPiutang = async (onUpdate) => {
    const cachedData = getStorage("piutang", null);
    const cachedTime = getStorage("piutang_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "piutang" } });
                const result = res.data?.data || { data: [], total: 0 };
                setStorage("piutang", result);
                setStorage("piutang_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || { data: [], total: 0 };
};

export const getCachedReport = async (onUpdate) => {
    const cachedData = getStorage("report", null);
    const cachedTime = getStorage("report_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedData || isCacheOutdated(cachedTime, serverTime)) {
            try {
                const res = await getSharedResponse("", { params: { action: "report" } });
                const result = res.data?.data || { data: [], total: 0 };
                setStorage("report", result);
                setStorage("report_time", serverTime > 0 ? serverTime : Date.now());
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedData;
    };

    if (cachedData) {
        fetchLatest();
        return cachedData;
    }

    return (await fetchLatest()) || { data: [], total: 0 };
};

export const getCachedProductUsed = async (startDate, endDate, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const productUsedMap = getCleanedDailyMap("productUsed");
    const cachedItem = productUsedMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = getOrderCacheVersion(dataset);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "product_used", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || [];
                const currentMap = getCleanedDailyMap("productUsed");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("productUsed", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || [];
};

export const getCachedOmsetItem = async (startDate, endDate, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const omsetItemMap = getCleanedDailyMap("omsetItem");
    const cachedItem = omsetItemMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = getOrderCacheVersion(dataset);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "omset_item", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || [];
                const currentMap = getCleanedDailyMap("omsetItem");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("omsetItem", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || [];
};

export const getCachedStatistics = async (startDate, endDate, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const statisticMap = getCleanedDailyMap("statistic");
    const cachedItem = statisticMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "statistics", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("statistic");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("statistic", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || {};
};

export const getCachedExpenditureCategories = async (onUpdate) => {
    const cachedItem = getStorage("expenditureCategories", null);
    const hasCache = Array.isArray(cachedItem?.data);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.finance_updated_at || 0;
        const expired = Date.now() - (cachedItem?.fetchedAt || 0) >= 5 * 60 * 1000;

        if (!hasCache || isCacheOutdated(cachedItem.updatedAt, serverTime) || expired) {
            try {
                const res = await getSharedResponse("", { params: { action: "expenditure_categories" } });
                const payload = res.data?.data ?? res.data;
                const result = Array.isArray(payload) ? payload : payload?.expenditure_categories;
                if (res.data?.success === false || !Array.isArray(result)) {
                    throw new Error("Daftar kategori tidak tersedia.");
                }
                setStorage("expenditureCategories", { data: result, updatedAt: serverTime, fetchedAt: Date.now() });
                if (onUpdate) onUpdate(result);
                return result;
            } catch {
                return null;
            }
        }
        return cachedItem.data;
    };

    if (hasCache) {
        fetchLatest();
        return cachedItem.data;
    }
    return fetchLatest();
};

export const getCachedFinance = async (startDate, endDate, onUpdate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const financeMap = getCleanedDailyMap("finance");
    const cachedItem = financeMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = getOrderCacheVersion(dataset);
        const financeTime = dataset.finance_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, financeTime, paymentTime);

        if (!cachedItem || isCacheOutdated(cachedItem.updatedAt, serverTime)) {
            try {
                const res = await getSharedResponse("", {
                    params: { action: "finance", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("finance");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("finance", currentMap);
                if (onUpdate) onUpdate(result);
                return result;
            } catch (err) {
                return null;
            }
        }
        return cachedItem?.data;
    };

    if (cachedItem) {
        fetchLatest();
        return cachedItem.data;
    }

    return (await fetchLatest()) || {};
};

export const clearAllOrderCaches = () => {
    invalidateRequests(["order_detail"]);
    setStorage("orderDetail", {});
};

export const clearUsersCache = () => {
    invalidateRequests(["users", "initials"]);
    removeStorage("users");
    removeStorage("users_time");
    removeStorage("initials");
    removeStorage("initials_time");
};

export const clearMachinesCache = () => {
    invalidateRequests(["machines"]);
    removeStorage("machines");
    removeStorage("machines_time");
};

export const clearLocationsCache = () => {
    invalidateRequests(["locations"]);
    removeStorage("locations");
    removeStorage("locations_time");
};

export const clearFailuresCache = () => {
    invalidateRequests(["failures"]);
    setStorage("failures", {});
};

export const clearProductCache = () => {
    invalidateRequests(["pagination_products", "products_by_category", "product_variants", "product_finishing_prices", "product_laser_conversions", "product_bundles", "search_order_products"]);
    setStorage("paginatedProducts", {});
    setStorage("productsByCategory", {});
    for (const key of ["productVariantsByProduct", "productBundles", "productFinishingPricesByCategory", "productLaserConversionsByCategory", "orderProductSearch"]) removeStorage(key);
};

export const clearFinishingCache = () => {
    invalidateRequests(["finishings", "finishings_by_category", "product_finishing_prices", "product_laser_conversions", "product_bundles"]);
    removeStorage("finishings");
    removeStorage("finishings_time");
    setStorage("finishingsByCategory", {});
    setStorage("productFinishingPricesByCategory", {});
    removeStorage("productLaserConversionsByCategory");
    removeStorage("productBundles");
};

export const clearCategoryCache = () => {
    invalidateRequests(["categories"]);
    removeStorage("categories");
    removeStorage("categories_time");
    clearProductCache();
    clearFinishingCache();
};

export const clearCacheOrderDetail = (orderId) => {
    invalidateRequests(["order_detail"]);
    const orderMap = getStorage("orderDetail", {});
    orderMap[orderId] = null;
    setStorage("orderDetail", orderMap);
};

export const clearOrdersCache = () => {
    invalidateRequests(["get_orders"]);
    removeStorage("orders");
};

export const clearCache = () => {
    clearCategoryCache();
};

export const clearAllCache = () => {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("mgo_cache_")) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        return { success: true, cleared: keysToRemove.length };
    } catch (e) {
        return { success: false, cleared: 0 };
    } finally {
        resetRuntimeCache();
    }
};
