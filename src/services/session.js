import api from "../api/axios";

export async function hasSession() {
    try {
        const response = await api.get("?action=session");
        return response.data.success;
    } catch (err) {
        if (err.response?.status === 401) return false;
        throw err;
    }
}

export async function saveSession(data) {
    const { data: response } = await api.post("/index.php?action=session", data);
    return response;
}

export async function clearSession() {
    return true;
}

export async function getSession() {
    const { data } = await api.get("/index.php?action=session");
    return data;
}