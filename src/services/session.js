import api from "../api/axios";

const KEY = "mgo_session";
let currentUser = readLocalSession();
const listeners = new Set();

function readLocalSession() {
    const data = localStorage.getItem(KEY);
    return data ? JSON.parse(data) : null;
}

function writeLocalSession(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
}

function removeLocalSession() {
    localStorage.removeItem(KEY);
}

function notify() {
    listeners.forEach((cb) => cb(currentUser));
}

export const authStore = {
    getUser: () => currentUser,

    subscribe: (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    login: async (data) => {
        const response = await api.post("/index.php?action=session", data);
        currentUser = response.data.data;
        writeLocalSession(currentUser);
        notify();
        return response.data.data;
    },

    logout: () => {
        currentUser = null;
        removeLocalSession();
        notify();
    },

    checkSession: async () => {
        try {
            const response = await api.get("?action=session");
            return response.data.success;
        } catch (err) {
            if (err.response?.status === 401) return false;
            throw err;
        }
    },

    refreshSession: async () => {
        const { data } = await api.get("/index.php?action=session");
        currentUser = data.data;
        writeLocalSession(data.data);
        notify();
        return data.data;
    },
};

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