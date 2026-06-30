import { getSession, setSession, clearSession } from "../utils/session";

let currentUser = getSession();

const listeners = new Set();

export const authStore = {
    getUser: () => currentUser,

    login: (userData) => {
        currentUser = userData;
        setSession(userData);
        notify();
    },

    logout: () => {
        currentUser = null;
        clearSession();
        notify();
    },

    subscribe: (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
    }
};

function notify() {
    listeners.forEach((cb) => cb(currentUser));
}