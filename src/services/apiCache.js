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

const getCleanedDailyMap = (key) => {
    const map = getStorage(key, {});
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

    if (datasetCache && (now - lastFetchTime < 3000)) {
        return datasetCache;
    }

    if (datasetPromise) {
        return datasetPromise;
    }

    datasetPromise = api.get("", { params: { action: "check_update_dataset" } })
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

export const validateStoreCache = (newStoreName) => {
    const oldStoreName = localStorage.getItem("last_store_name");

    if (oldStoreName && oldStoreName !== newStoreName) {
        const recaptchaBackup = localStorage.getItem("_grecaptcha");

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

export const getCachedStoreData = async () => {
    const cachedData = getStorage("storeData", null);
    const cachedTime = getStorage("storeData_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.store_data_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "store" } });
                const result = res.data?.data || [];
                setStorage("storeData", result);
                setStorage("storeData_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedUsers = async () => {
    const cachedData = getStorage("users", null);
    const cachedTime = getStorage("users_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.users_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "users" } });
                const result = res.data?.data || [];
                setStorage("users", result);
                setStorage("users_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedInitials = async () => {
    const cachedData = getStorage("initials", null);
    const cachedTime = getStorage("initials_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.initials_updated_at || dataset.users_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "get_initial" } });
                const result = res.data?.data || [];
                setStorage("initials", result);
                setStorage("initials_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedMachines = async () => {
    const cachedData = getStorage("machines", null);
    const cachedTime = getStorage("machines_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.machines_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "machines" } });
                const result = res.data?.data || [];
                setStorage("machines", result);
                setStorage("machines_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedLocations = async () => {
    const cachedData = getStorage("locations", null);
    const cachedTime = getStorage("locations_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.locations_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "locations" } });
                const result = res.data?.data || [];
                setStorage("locations", result);
                setStorage("locations_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedStoreNames = async () => {
    const cachedData = getStorage("storeNames", null);
    const cachedTime = getStorage("storeNames_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.store_names_updated_at || dataset.storeNames_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "store_names" } });
                const result = res.data?.data || [];
                setStorage("storeNames", result);
                setStorage("storeNames_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedFailures = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const failuresMap = getCleanedDailyMap("failures");
    const cachedItem = failuresMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.failures_updated_at || 0;
        
        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", { params: { action: "failure", start_date: startDate, end_date: endDate } });
                const result = res.data?.data || [];
                const currentMap = getCleanedDailyMap("failures");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("failures", currentMap);
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

export const getCachedCategories = async () => {
    const cachedData = getStorage("categories", null);
    const cachedTime = getStorage("categories_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.categories_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "categories" } });
                const result = res.data?.data || [];
                setStorage("categories", result);
                setStorage("categories_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedProductsByCategory = async (categoryId) => {
    if (!categoryId) return [];
    
    const productsMap = getStorage("productsByCategory", {});
    const cachedItem = productsMap[categoryId];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.products_updated_at || dataset.categories_updated_at || 0;
        
        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", { params: { action: "products_by_category", category_id: categoryId } });
                const result = res.data?.data || [];
                const currentMap = getStorage("productsByCategory", {});
                currentMap[categoryId] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("productsByCategory", currentMap);
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

export const getCachedGlobalStocks = async (month) => {
    if (!month) return {};
    
    const stocksMap = getStorage("globalStocksByMonth", {});
    const cachedItem = stocksMap[month];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.global_stocks_updated_at || 0;
        
        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", { params: { action: "grouped_stock_global_stock", month: month } });
                const result = res.data?.success ? (res.data.data.grouped_stocks || {}) : {};
                const currentMap = getStorage("globalStocksByMonth", {});
                currentMap[month] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("globalStocksByMonth", currentMap);
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

export const getCachedFinishingsByCategory = async (categoryId) => {
    if (!categoryId) return [];
    
    const finishingsMap = getStorage("finishingsByCategory", {});
    const cachedItem = finishingsMap[categoryId];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.finishings_updated_at || dataset.categories_updated_at || 0;
        
        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", { params: { action: "finishing_by_category", category_id: categoryId } });
                const result = res.data?.data || [];
                const currentMap = getStorage("finishingsByCategory", {});
                currentMap[categoryId] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("finishingsByCategory", currentMap);
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

export const getCachedPaginatedProducts = async (page, limit, search) => {
    const cacheKey = `${page}_${limit}_${search}`;
    const paginatedMap = getStorage("paginatedProducts", {});
    const cachedItem = paginatedMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.products_updated_at || 0;
        
        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", { params: { action: "pagination_products", page, limit, search } });
                const result = {
                    data: res.data?.data?.data ?? [],
                    total_pages: res.data?.data?.total_pages ?? 1
                };
                const currentMap = getStorage("paginatedProducts", {});
                currentMap[cacheKey] = { result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("paginatedProducts", currentMap);
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

export const getCachedFinishings = async () => {
    const cachedData = getStorage("finishings", null);
    const cachedTime = getStorage("finishings_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.finishings_updated_at || 0;
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "finishings" } });
                const result = res.data?.data || [];
                setStorage("finishings", result);
                setStorage("finishings_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedOrdersAnalysis = async () => {
    const cachedData = getStorage("ordersAnalysis", null);
    const cachedTime = getStorage("ordersAnalysis_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);
        
        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "order_analysis" } });
                const result = res.data?.data || { chart_30: {}, chart_365: {}, summary: {} };
                setStorage("ordersAnalysis", result);
                setStorage("ordersAnalysis_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedOrders = async (startDate, endDate, search) => {
    const cacheKey = `${startDate}_${endDate}_${search}`;
    const ordersMap = getCleanedDailyMap("orders");
    const cachedItem = ordersMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "get_orders", search: search, start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("orders");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("orders", currentMap);
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

export const getCachedOrderDetail = async (orderId) => {
    const cacheKey = String(orderId);
    const orderMap = getCleanedDailyMap("orderDetail");
    const cachedItem = orderMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const globalOrderUpdate = dataset.orders_updated_at || 0;
        let specificOrderUpdate = 0;
        
        if (dataset.order_trigger && dataset.order_trigger[cacheKey]) {
            specificOrderUpdate = dataset.order_trigger[cacheKey]; 
        }

        const serverTime = Math.max(globalOrderUpdate, specificOrderUpdate);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", { params: { action: "order_detail", order_id: orderId } });
                const result = res.data?.data || null;
                
                if (result) {
                    const currentMap = getCleanedDailyMap("orderDetail");
                    currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                    setStorage("orderDetail", currentMap);
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

export const getCachedTransactionsCapture = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const transactionsMap = getCleanedDailyMap("transactionsCapture");
    const cachedItem = transactionsMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "transactions_capture", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("transactionsCapture");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("transactionsCapture", currentMap);
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

export const getCachedTransactionsDetail = async (startDate, endDate, search) => {
    const cacheKey = `${startDate}_${endDate}_${search}`;
    const transactionsDetailMap = getCleanedDailyMap("transactionsDetail");
    const cachedItem = transactionsDetailMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "transactions_detail", start_date: startDate, end_date: endDate, search: search }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("transactionsDetail");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("transactionsDetail", currentMap);
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

export const getCachedAllOrderDetail = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const allOrderDetailMap = getCleanedDailyMap("allOrderDetail");
    const cachedItem = allOrderDetailMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "all_detail_order", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("allOrderDetail");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("allOrderDetail", currentMap);
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

export const getCachedPiutang = async () => {
    const cachedData = getStorage("piutang", null);
    const cachedTime = getStorage("piutang_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "piutang" } });
                const result = res.data?.data || { data: [], total: 0 };
                setStorage("piutang", result);
                setStorage("piutang_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedReport = async () => {
    const cachedData = getStorage("report", null);
    const cachedTime = getStorage("report_time", 0);

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedData || cachedTime < serverTime) {
            try {
                const res = await api.get("", { params: { action: "report" } });
                const result = res.data?.data || { data: [], total: 0 };
                setStorage("report", result);
                setStorage("report_time", serverTime > 0 ? serverTime : Date.now());
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

export const getCachedProductUsed = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const productUsedMap = getCleanedDailyMap("productUsed");
    const cachedItem = productUsedMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.orders_updated_at || 0;

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "product_used", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || [];
                const currentMap = getCleanedDailyMap("productUsed");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("productUsed", currentMap);
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

export const getCachedOmsetItem = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const omsetItemMap = getCleanedDailyMap("omsetItem");
    const cachedItem = omsetItemMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const serverTime = dataset.orders_updated_at || 0;

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "omset_item", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || [];
                const currentMap = getCleanedDailyMap("omsetItem");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("omsetItem", currentMap);
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

export const getCachedStatistics = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const statisticMap = getCleanedDailyMap("statistic");
    const cachedItem = statisticMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "statistics", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("statistic");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("statistic", currentMap);
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

export const getCachedFinance = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const financeMap = getCleanedDailyMap("finance");
    const cachedItem = financeMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const financeTime = dataset.finance_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, financeTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "finance", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("finance");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("finance", currentMap);
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

export const getCachedActivity = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const activityMap = getCleanedDailyMap("activity");
    const cachedItem = activityMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "activity", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || [];
                const currentMap = getCleanedDailyMap("activity");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("activity", currentMap);
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

export const getCachedOrderArchive = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    const archiveMap = getCleanedDailyMap("orderArchive");
    const cachedItem = archiveMap[cacheKey];

    const fetchLatest = async () => {
        const dataset = await getServerDataset();
        const orderTime = dataset.orders_updated_at || 0;
        const paymentTime = dataset.payments_updated_at || 0;
        const serverTime = Math.max(orderTime, paymentTime);

        if (!cachedItem || cachedItem.updatedAt < serverTime) {
            try {
                const res = await api.get("", {
                    params: { action: "order_archive", start_date: startDate, end_date: endDate }
                });
                const result = res.data?.data || {};
                const currentMap = getCleanedDailyMap("orderArchive");
                currentMap[cacheKey] = { data: result, updatedAt: serverTime > 0 ? serverTime : Date.now() };
                setStorage("orderArchive", currentMap);
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