import api from "../api/axios";
import { validateStoreCache } from "./apiCache";

const KEY = "mgo_session";
let currentUser = readLocalSession();
const listeners = new Set();

function readLocalSession() {
  const data = localStorage.getItem(KEY);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch (e) {
    console.error("Data rusak, menghapus dari localStorage:", KEY);
    removeLocalSession();
    return null;
  }
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

    setSession: (data) => {
        currentUser = data;
        writeLocalSession(currentUser);
        notify();
        return currentUser;
    },

    login: async (data) => {
        const response = await api.post("/?action=login", data);

        if (response.data.data?.store?.name) {
            validateStoreCache(response.data.data.store.name);
        }

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
            await writeLocalSession(response.data.data);
            return response.data.success;
        } catch (err) {
            if (err.response?.status === 401) return false;
            throw err;
        }
    },

    refreshSession: async () => {
        const { data } = await api.get("/?action=session");
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
