import api from "../api/axios";

const getStorage = (key, defaultVal) => {
    try {
        const val = localStorage.getItem(`mgo_cache_${key}`);
        return val ? JSON.parse(val) : defaultVal;
    } catch (e) {
        return defaultVal;
    }
};

const setStorage = (key, val) => {
    try {
        localStorage.setItem(`mgo_cache_${key}`, JSON.stringify(val));
    } catch (e) {}
};

let datasetCache = null;
let datasetPromise = null;
let lastFetchTime = 0;

const getServerDataset = async () => {
    const now = Date.now();

    if (datasetCache && (now - lastFetchTime < 3000)) {
        return datasetCache;
    }

    if (datasetPromise) {
        return datasetPromise;
    }

    datasetPromise = api.get("/check_update_dataset.php")
        .then(res => {
            datasetCache = res.data?.data || {};
            lastFetchTime = Date.now();
            datasetPromise = null;
            return datasetCache;
        })
        .catch(err => {
            datasetPromise = null;
            return datasetCache || {};
        });

    return datasetPromise;
};

export const getCachedUsers = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.users_updated_at || 0;
    const cachedData = getStorage("users", null);
    const cachedTime = getStorage("users_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "users" } });
        const result = res.data?.data || [];
        setStorage("users", result);
        setStorage("users_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
};

export const getCachedInitials = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.initials_updated_at || dataset.users_updated_at || 0;
    const cachedData = getStorage("initials", null);
    const cachedTime = getStorage("initials_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "get_initial" } });
        const result = res.data?.data || [];
        setStorage("initials", result);
        setStorage("initials_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
};

export const getCachedMachines = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.machines_updated_at || 0;
    const cachedData = getStorage("machines", null);
    const cachedTime = getStorage("machines_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "machines" } });
        const result = res.data?.data || [];
        setStorage("machines", result);
        setStorage("machines_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
};

export const getCachedLocations = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.locations_updated_at || 0;
    const cachedData = getStorage("locations", null);
    const cachedTime = getStorage("locations_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "locations" } });
        const result = res.data?.data || [];
        setStorage("locations", result);
        setStorage("locations_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
};

export const getCachedStoreNames = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.store_names_updated_at || dataset.storeNames_updated_at || 0;
    const cachedData = getStorage("storeNames", null);
    const cachedTime = getStorage("storeNames_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "store_names" } });
        const result = res.data?.data || [];
        setStorage("storeNames", result);
        setStorage("storeNames_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
};

export const getCachedFailures = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const serverTime = dataset.failures_updated_at || 0;
    const failuresMap = getStorage("failures", {});
    if (failuresMap[cacheKey] && failuresMap[cacheKey].updatedAt >= serverTime) {
        return failuresMap[cacheKey].data;
    }
    try {
        const res = await api.get("", { params: { action: "failure", start_date: startDate, end_date: endDate } });
        const result = res.data?.data || [];
        failuresMap[cacheKey] = { data: result, updatedAt: serverTime };
        setStorage("failures", failuresMap);
        return result;
    } catch (err) {
        return failuresMap[cacheKey]?.data || [];
    }
};

export const getCachedCategories = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.categories_updated_at || 0;
    const cachedData = getStorage("categories", null);
    const cachedTime = getStorage("categories_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "categories" } });
        const result = res.data?.data || [];
        setStorage("categories", result);
        setStorage("categories_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
};

export const getCachedProductsByCategory = async (categoryId) => {
    if (!categoryId) return [];
    const dataset = await getServerDataset();
    const serverTime = dataset.products_updated_at || dataset.categories_updated_at || 0;
    const productsMap = getStorage("productsByCategory", {});
    if (productsMap[categoryId] && productsMap[categoryId].updatedAt >= serverTime) {
        return productsMap[categoryId].data;
    }
    try {
        const res = await api.get("", { params: { action: "products_by_category", category_id: categoryId } });
        const result = res.data?.data || [];
        productsMap[categoryId] = { data: result, updatedAt: serverTime };
        setStorage("productsByCategory", productsMap);
        return result;
    } catch (err) {
        return productsMap[categoryId]?.data || [];
    }
};

export const getCachedFinishingsByCategory = async (categoryId) => {
    if (!categoryId) return [];
    const dataset = await getServerDataset();
    const serverTime = dataset.finishings_updated_at || dataset.categories_updated_at || 0;
    const finishingsMap = getStorage("finishingsByCategory", {});
    if (finishingsMap[categoryId] && finishingsMap[categoryId].updatedAt >= serverTime) {
        return finishingsMap[categoryId].data;
    }
    try {
        const res = await api.get("", { params: { action: "finishing_by_category", category_id: categoryId } });
        const result = res.data?.data || [];
        finishingsMap[categoryId] = { data: result, updatedAt: serverTime };
        setStorage("finishingsByCategory", finishingsMap);
        return result;
    } catch (err) {
        return finishingsMap[categoryId]?.data || [];
    }
};

export const getCachedPaginatedProducts = async (page, limit, search) => {
    const cacheKey = `${page}_${limit}_${search}`;
    const dataset = await getServerDataset();
    const serverTime = dataset.products_updated_at || 0;
    const paginatedMap = getStorage("paginatedProducts", {});
    if (paginatedMap[cacheKey] && paginatedMap[cacheKey].updatedAt >= serverTime) {
        return paginatedMap[cacheKey].result;
    }
    try {
        const res = await api.get("", {
            params: { action: "pagination_products", page, limit, search }
        });
        const result = {
            data: res.data?.data?.data ?? [],
            total_pages: res.data?.data?.total_pages ?? 1
        };
        paginatedMap[cacheKey] = { result, updatedAt: serverTime };
        setStorage("paginatedProducts", paginatedMap);
        return result;
    } catch (err) {
        return paginatedMap[cacheKey]?.result || { data: [], total_pages: 1 };
    }
};

export const getCachedFinishings = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.finishings_updated_at || 0;
    const cachedData = getStorage("finishings", null);
    const cachedTime = getStorage("finishings_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "finishings" } });
        const result = res.data?.data || [];
        setStorage("finishings", result);
        setStorage("finishings_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
};

export const getCachedOrderDetail = async (orderId) => {
    const cacheKey = String(orderId);
    const dataset = await getServerDataset();
    const globalOrderUpdate = dataset.orders_updated_at || 0;
    
    let specificOrderUpdate = 0;
    if (dataset.order_trigger && dataset.order_trigger[cacheKey]) {
        specificOrderUpdate = dataset.order_trigger[cacheKey]; 
    }

    const serverTime = Math.max(globalOrderUpdate, specificOrderUpdate);

    const orderMap = getStorage("orderDetail", {});
    const cachedItem = orderMap[cacheKey];

    if (cachedItem && cachedItem.updatedAt >= serverTime) {
        return cachedItem.data;
    }

    try {
        const res = await api.get("", { params: { action: "order_detail", order_id: orderId } });
        const result = res.data?.data || null;

        if (result) {
            orderMap[cacheKey] = {
                data: result,
                updatedAt: serverTime > 0 ? serverTime : Date.now()
            };
            setStorage("orderDetail", orderMap);
        }

        return result;
    } catch (err) {
        return cachedItem ? cachedItem.data : [];
    }
};

export const clearAllOrderCaches = () => {
    setStorage("orderDetail", {});
};

export const clearUsersCache = () => {
    localStorage.removeItem("mgo_cache_users");
    localStorage.removeItem("mgo_cache_users_time");
    localStorage.removeItem("mgo_cache_initials");
    localStorage.removeItem("mgo_cache_initials_time");
};

export const clearMachinesCache = () => {
    localStorage.removeItem("mgo_cache_machines");
    localStorage.removeItem("mgo_cache_machines_time");
};

export const clearLocationsCache = () => {
    localStorage.removeItem("mgo_cache_locations");
    localStorage.removeItem("mgo_cache_locations_time");
};

export const clearFailuresCache = () => {
    setStorage("failures", {});
};

export const clearProductCache = () => {
    setStorage("paginatedProducts", {});
    setStorage("productsByCategory", {});
};

export const clearFinishingCache = () => {
    localStorage.removeItem("mgo_cache_finishings");
    localStorage.removeItem("mgo_cache_finishings_time");
    setStorage("finishingsByCategory", {});
};

export const clearCategoryCache = () => {
    localStorage.removeItem("mgo_cache_categories");
    localStorage.removeItem("mgo_cache_categories_time");
    clearProductCache();
    clearFinishingCache();
};

export const clearCacheOrderDetail = (orderId) => {
    const orderMap = getStorage("orderDetail", {});
    orderMap[orderId] = null;
    setStorage("orderDetail", orderMap);
};

export const clearCache = () => {
    localStorage.removeItem("mgo_cache_categories");
    localStorage.removeItem("mgo_cache_categories_time");
    setStorage("productsByCategory", {});
    setStorage("finishingsByCategory", {});
    setStorage("paginatedProducts", {});
    localStorage.removeItem("mgo_cache_finishings");
    localStorage.removeItem("mgo_cache_finishings_time");
};