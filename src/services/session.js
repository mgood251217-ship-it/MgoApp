export async function hasSession() {
    return false;
}

export async function saveSession(data) {
    return true;
}

export async function clearSession() {
    return true;
}

export async function getSession() {
    return null;
}