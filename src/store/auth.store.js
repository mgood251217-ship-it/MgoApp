let currentUser = null;

const listeners = new Set();

export const authStore = {
    getUser: () => currentUser,

    login: (userData) => {
        currentUser = userData;
        notify();
    },

    logout: () => {
        currentUser = null;
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