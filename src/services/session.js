import api from "../api/axios";
import { clearAllCache } from "./apiCache";
import { getSessionIdentity } from "./helpers";
import { useSyncExternalStore } from "react";

const KEY = "mgo_session";
let currentUser = readLocalSession();
let sessionRevision = 0;
const listeners = new Set();

function readLocalSession() {
    const data = localStorage.getItem(KEY);
    if (!data) return null;
    try {
        const session = JSON.parse(data);
        return session?.user && session?.store ? session : null;
    } catch {
        localStorage.removeItem(KEY);
        return null;
    }
}

function notify() {
    listeners.forEach(callback => callback(currentUser));
}

export const authStore = {
    getUser: () => currentUser,

    subscribe: (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    setSession: (data) => {
        if (!data?.user || !data?.store) throw new Error("Sesi toko tidak valid.");
        const changed = getSessionIdentity(currentUser) !== getSessionIdentity(data);
        localStorage.setItem(KEY, JSON.stringify(data));
        currentUser = data;
        sessionRevision++;
        if (changed) clearAllCache();
        notify();
        return currentUser;
    },

    // Batalkan pembacaan lama sebelum handoff mulai mengganti cookie server.
    beginSessionChange: () => {
        sessionRevision++;
        clearAllCache();
    },

    login: async (data) => {
        const revision = ++sessionRevision;
        const response = await api.post("/?action=login", data);
        if (revision !== sessionRevision) return currentUser;
        if (!response.data?.success) throw new Error(response.data?.message || "Login gagal.");
        return authStore.refreshSession();
    },

    logout: () => {
        localStorage.removeItem(KEY);
        currentUser = null;
        sessionRevision++;
        clearAllCache();
        notify();
    },

    checkSession: async () => {
        const revision = ++sessionRevision;
        try {
            const response = await api.get("?action=session");
            if (revision !== sessionRevision) return Boolean(currentUser);
            if (response.data?.success && response.data.data?.user && response.data.data?.store) {
                authStore.setSession(response.data.data);
                return true;
            }
            authStore.logout();
            return false;
        } catch {
            if (revision !== sessionRevision) return Boolean(currentUser);
            authStore.logout();
            return false;
        }
    },

    refreshSession: async () => {
        const revision = ++sessionRevision;
        try {
            const { data } = await api.get("/?action=session");
            if (revision !== sessionRevision) return currentUser;
            if (!data?.success || !data.data?.user || !data.data?.store) throw new Error(data?.message || "Sesi toko tidak valid.");
            return authStore.setSession(data.data);
        } catch (error) {
            if (revision !== sessionRevision) return currentUser;
            authStore.logout();
            throw error;
        }
    },
};

export function useSession() {
    return useSyncExternalStore(authStore.subscribe, authStore.getUser, authStore.getUser);
}

export async function hasSession() {
    return authStore.checkSession();
}

export async function saveSession(data) {
    return authStore.login(data);
}

export async function clearSession() {
    authStore.logout();
    return true;
}

export async function getSession() {
    return authStore.refreshSession();
}
