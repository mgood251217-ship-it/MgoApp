import api from "../api/axios";

const memoryCache = {
    users: null,
    initials: null,
    machines: null,
    locations: null,
    storeNames: null,
    failures: null,
    categories: null,
    productsByCategory: {},
    finishingsByCategory: {},
    paginatedProducts: {},
    finishings: null,
    orderDetail: {},
};

export const getCachedUsers = async () => {
    if (memoryCache.users) return memoryCache.users;
    try {
        const res = await api.get("", { params: { action: "users"}});
        memoryCache.users = res.data?.data || [];
        return memoryCache.users;
    } catch (err) {
        return [];
    }
}

export const getCachedInitials = async () => {
    if (memoryCache.initials) return memoryCache.initials;
    try{
        const res = await api.get("", { params: {action: "get_initial"} })
        memoryCache.initials = res.data?.data || [];
        return memoryCache.initials;
    }catch(err){
        return [];
    }
}

export const getCachedMachines = async () => {
    if (memoryCache.machines) return memoryCache.machines;
    try {
        const res = await api.get("", { params: { action: "machines" } });
        memoryCache.machines = res.data?.data || [];
        return memoryCache.machines;
    } catch (err) {
        return [];
    }
}

export const getCachedLocations = async () => {
    if (memoryCache.locations) return memoryCache.locations;
    try {
        const res = await api.get("", { params: { action: "locations"}});
        memoryCache.locations = res.data?.data || [];
        return memoryCache.locations;
    } catch (err) {
        return [];
    }
}

export const getCachedStoreNames = async () => {
    if (memoryCache.storeNames) return memoryCache.storeNames;
    try {
        const res = await api.get("", { params: { action: "store_names" } });
        memoryCache.storeNames = res.data?.data || [];
        return memoryCache.storeNames;
    } catch (err) {
        return [];
    }
}

export const getCachedFailures = async (startDate, endDate) => {
    const cacheKey = `${startDate}_${endDate}`;
    if (memoryCache.failures?.[cacheKey]) return memoryCache.failures[cacheKey];
    try {
        const res = await api.get("", { params: { action: "failure", start_date: startDate, end_date: endDate } });
        const result = res.data?.data || [];
        if (!memoryCache.failures) memoryCache.failures = {};
        memoryCache.failures[cacheKey] = result;
        return result;
    } catch (err) {
        return [];
    }
}

export const getCachedCategories = async () => {
    if (memoryCache.categories) return memoryCache.categories;
    try {
        const res = await api.get("", { params: { action: "categories" } });
        memoryCache.categories = res.data?.data || [];
        return memoryCache.categories;
    } catch (err) {
        return [];
    }
};

export const getCachedProductsByCategory = async (categoryId) => {
    if (!categoryId) return [];
    if (memoryCache.productsByCategory[categoryId]) return memoryCache.productsByCategory[categoryId];
    try {
        const res = await api.get("", { params: { action: "products_by_category", category_id: categoryId } });
        memoryCache.productsByCategory[categoryId] = res.data?.data || [];
        return memoryCache.productsByCategory[categoryId];
    } catch (err) {
        return [];
    }
};

export const getCachedFinishingsByCategory = async (categoryId) => {
    if (!categoryId) return [];
    if (memoryCache.finishingsByCategory[categoryId]) return memoryCache.finishingsByCategory[categoryId];
    try {
        const res = await api.get("", { params: { action: "finishing_by_category", category_id: categoryId } });
        memoryCache.finishingsByCategory[categoryId] = res.data?.data || [];
        return memoryCache.finishingsByCategory[categoryId];
    } catch (err) {
        return [];
    }
};

export const getCachedPaginatedProducts = async (page, limit, search) => {
    const cacheKey = `${page}_${limit}_${search}`;
    if (memoryCache.paginatedProducts[cacheKey]) return memoryCache.paginatedProducts[cacheKey];
    try {
        const res = await api.get("", {
            params: { action: "pagination_products", page, limit, search }
        });
        const result = {
            data: res.data?.data?.data ?? [],
            total_pages: res.data?.data?.total_pages ?? 1
        };
        memoryCache.paginatedProducts[cacheKey] = result;
        return result;
    } catch (err) {
        return { data: [], total_pages: 1 };
    }
};

export const getCachedFinishings = async () => {
    if (memoryCache.finishings) return memoryCache.finishings;
    try {
        const res = await api.get("", { params: { action: "finishings" } });
        memoryCache.finishings = res.data?.data || [];
        return memoryCache.finishings;
    } catch (err) {
        return [];
    }
};

export const getCachedOrderDetail = async (orderId) => {
    const cacheKey = orderId;
    if (memoryCache.orderDetail[cacheKey]) return memoryCache.orderDetail[cacheKey];
    try {
        const res = await api.get("", { params: { action: "order_detail", order_id: orderId } });
        const result = res.data?.data || null;
        memoryCache.orderDetail[cacheKey] = result;
        return result;
    }catch (err) {
        return [];
    }
}

export const clearUsersCache = () => {
    memoryCache.users = null;
    memoryCache.initials = null;
}

export const clearMachinesCache = () => {
    memoryCache.machines = null;
}

export const clearLocationsCache = () => {
    memoryCache.locations = null;
};

export const clearFailuresCache = () => {
    memoryCache.failures = null;
};

export const clearProductCache = () => {
    memoryCache.paginatedProducts = {};
    memoryCache.productsByCategory = {};
};

export const clearFinishingCache = () => {
    memoryCache.finishings = null;
    memoryCache.finishingsByCategory = {};
};

export const clearCategoryCache = () => {
    memoryCache.categories = null;
    clearProductCache();
    clearFinishingCache();
};

export const clearCacheOrderDetail = (orderId) => {
    memoryCache.orderDetail[orderId] = null;
}

export const clearCache = () => {
    memoryCache.categories = null;
    memoryCache.productsByCategory = {};
    memoryCache.finishingsByCategory = {};
    memoryCache.paginatedProducts = {};
    memoryCache.finishings = null;
};