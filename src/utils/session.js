const KEY = "mgo_session";

export function setSession(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
}

export function getSession() {
    const data = localStorage.getItem(KEY);
    return data ? JSON.parse(data) : null;
}

export function clearSession() {
    localStorage.removeItem(KEY);
}