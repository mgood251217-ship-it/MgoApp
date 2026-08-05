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

export const getCachedStoreData = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.store_data_updated_at || 0;
    const cachedData = getStorage("storeData", null);
    const cachedTime = getStorage("storeData_time", 0);

    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }

    try {
        const res = await api.get("", { params: { action: "store" } });
        const result = res.data?.data || [];
        setStorage("storeData", result);
        setStorage("storeData_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
}

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

export const getCachedOrdersAnalysis = async () => {
    const dataset = await getServerDataset();
    const serverTime = dataset.orders_updated_at || 0;
    const cachedData = getStorage("ordersAnalysis", null);
    const cachedTime = getStorage("ordersAnalysis_time", 0);
    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }
    try {
        const res = await api.get("", { params: { action: "order_analysis" } });
        const result = res.data?.data || { chart_30: {}, chart_365: {}, summary: {} };
        setStorage("ordersAnalysis", result);
        setStorage("ordersAnalysis_time", serverTime);
        return result;
    } catch (err) {
        return cachedData || [];
    }
}

export const getCachedOrders = async (startDate, endDate, search) => {
    const cacheKey = `${startDate}_${endDate}_${search}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const ordersMap = getStorage("orders", {});

    if (ordersMap[cacheKey] && ordersMap[cacheKey].updatedAt >= serverTime) {
        return ordersMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "get_orders",
                search: search,
                start_date: startDate,
                end_date: endDate
            }
        });
        const result = res.data?.data || {};

        ordersMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
        setStorage("orders", ordersMap);
        return result;
    } catch (err) {
        return ordersMap[cacheKey]?.data || {};
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
    const currentMs = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let mapChanged = false;

    for (const key in orderMap) {
        if (orderMap[key] && currentMs - (orderMap[key].localSavedAt || 0) > oneDayMs) {
            delete orderMap[key];
            mapChanged = true;
        }
    }

    if (mapChanged) {
        setStorage("orderDetail", orderMap);
    }

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
                updatedAt: serverTime > 0 ? serverTime : currentMs,
                localSavedAt: currentMs
            };
            setStorage("orderDetail", orderMap);
        }

        return result;
    } catch (err) {
        return cachedItem ? cachedItem.data : [];
    }
};

export const getCachedTransactionsCapture = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const transactionsMap = getStorage("transactionsCapture", {});

    if (transactionsMap[cacheKey] && transactionsMap[cacheKey].updatedAt >= serverTime) {
        return transactionsMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "transactions_capture",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || {};

        transactionsMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("transactionsCapture", transactionsMap);
        
        return result;
    } catch (err) {
        return transactionsMap[cacheKey]?.data || {};
    }
};

export const getCachedTransactionsDetail = async (startDate, endDate, search) => {
    const cacheKey = `${startDate}_${endDate}_${search}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const transactionsDetailMap = getStorage("transactionsDetail", {});

    if (transactionsDetailMap[cacheKey] && transactionsDetailMap[cacheKey].updatedAt >= serverTime) {
        return transactionsDetailMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "transactions_detail",
                start_date: startDate,
                end_date: endDate,
                search: search
            }
        });
        
        const result = res.data?.data || {};

        transactionsDetailMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("transactionsDetail", transactionsDetailMap);
        
        return result;
    } catch (err) {
        return transactionsDetailMap[cacheKey]?.data || {};
    }
};

export const getCachedAllOrderDetail = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const allOrderDetailMap = getStorage("allOrderDetail", {});

    if (allOrderDetailMap[cacheKey] && allOrderDetailMap[cacheKey].updatedAt >= serverTime) {
        return allOrderDetailMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "all_detail_order",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || {};

        allOrderDetailMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("allOrderDetail", allOrderDetailMap);
        
        return result;
    } catch (err) {
        return allOrderDetailMap[cacheKey]?.data || {};
    }
};

export const getCachedPiutang = async () => {
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const cachedData = getStorage("piutang", null);
    const cachedTime = getStorage("piutang_time", 0);

    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }

    try {
        const res = await api.get("", { params: { action: "piutang" } });
        const result = res.data?.data || { data: [], total: 0 };
        setStorage("piutang", result);
        setStorage("piutang_time", serverTime > 0 ? serverTime : Date.now());
        return result;
    } catch (err) {
        return cachedData || { data: [], total: 0 };
    }
};

export const getCachedReport = async () => {
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const cachedData = getStorage("report", null);
    const cachedTime = getStorage("report_time", 0);

    if (cachedData && cachedTime >= serverTime) {
        return cachedData;
    }

    try {
        const res = await api.get("", { params: { action: "report" } });
        const result = res.data?.data || { data: [], total: 0 };
        setStorage("report", result);
        setStorage("report_time", serverTime > 0 ? serverTime : Date.now());
        return result;
    } catch (err) {
        return cachedData || { data: [], total: 0 };
    }
};

export const getCachedProductUsed = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const serverTime = orderTime;
    const productUsedMap = getStorage("productUsed", {});

    if (productUsedMap[cacheKey] && productUsedMap[cacheKey].updatedAt >= serverTime) {
        return productUsedMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "product_used",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || [];

        productUsedMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("productUsed", productUsedMap);
        
        return result;
    } catch (err) {
        return productUsedMap[cacheKey]?.data || [];
    }
};

export const getCachedOmsetItem = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const serverTime = orderTime;
    const omsetItemMap = getStorage("omsetItem", {});

    if (omsetItemMap[cacheKey] && omsetItemMap[cacheKey].updatedAt >= serverTime) {
        return omsetItemMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "omset_item",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || [];

        omsetItemMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("omsetItem", omsetItemMap);
        
        return result;
    } catch (err) {
        return omsetItemMap[cacheKey]?.data || [];
    }
};

export const getCachedStatistics = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const statisticMap = getStorage("statistic", {});

    if (statisticMap[cacheKey] && statisticMap[cacheKey].updatedAt >= serverTime) {
        return statisticMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "statistics",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || {};

        statisticMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("statistic", statisticMap);
        
        return result;
    } catch (err) {
        return statisticMap[cacheKey]?.data || {};
    }
};

export const getCachedFinance = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const financeTime = dataset.finance_updated_at || 0;
    const serverTime = Math.max(orderTime, financeTime);
    const financeMap = getStorage("finance", {});

    if (financeMap[cacheKey] && financeMap[cacheKey].updatedAt >= serverTime) {
        return financeMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "finance",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || {};

        financeMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("finance", financeMap);
        
        return result;
    } catch (err) {
        return financeMap[cacheKey]?.data || {};
    }
};

export const getCachedActivity = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const activityMap = getStorage("activity", {});

    if (activityMap[cacheKey] && activityMap[cacheKey].updatedAt >= serverTime) {
        return activityMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "activity",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || [];

        activityMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("activity", activityMap);
        
        return result;
    } catch (err) {
        return activityMap[cacheKey]?.data || [];
    }
};

export const getCachedOrderArchive = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const dataset = await getServerDataset();
    const orderTime = dataset.orders_updated_at || 0;
    const paymentTime = dataset.payments_updated_at || 0;
    const serverTime = Math.max(orderTime, paymentTime);
    const archiveMap = getStorage("orderArchive", {});

    if (archiveMap[cacheKey] && archiveMap[cacheKey].updatedAt >= serverTime) {
        return archiveMap[cacheKey].data;
    }

    try {
        const res = await api.get("", {
            params: {
                action: "order_archive",
                start_date: startDate,
                end_date: endDate
            }
        });
        
        const result = res.data?.data || {};

        archiveMap[cacheKey] = { 
            data: result, 
            updatedAt: serverTime > 0 ? serverTime : Date.now() 
        };
        setStorage("orderArchive", archiveMap);
        
        return result;
    } catch (err) {
        return archiveMap[cacheKey]?.data || {};
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