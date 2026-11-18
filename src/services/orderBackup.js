import { getLocalOrdersForBackup } from "./apiCache";
import { tauriApi } from "../lib/tauriApi";
import { authStore } from "./session";

const pending = new Map();
let backupState;
const listeners = new Set();

export const canBackupOrders = session => Boolean(session?.user && session?.store?.name);

export const getOrderBackupDate = (now = new Date()) => {
    const date = new Date(now);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};

export const getOrderBackupState = () => backupState;
export const subscribeOrderBackup = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const setState = state => {
    backupState = state;
    listeners.forEach(listener => listener());
};

const writeOrderBackup = async (session, date, orders) => {
    const isCurrentSession = () => {
        const current = authStore.getUser();
        return current?.token === session.token && current?.user?.user_id === session.user?.user_id
            && current?.user?.username === session.user?.username
            && current?.store?.name === session.store.name;
    };
    if (!isCurrentSession()) return;
    if (!orders.length) {
        setState({ date, message: "Cache order kosong. Backup sebelumnya tetap disimpan." });
        return;
    }

    setState({ date, message: "Memperbarui backup order..." });
    try {
        const { createOrderBackupExcel } = await import("./excelService");
        const buffer = await createOrderBackupExcel({ orders, store: session.store, date });
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = () => reject(new Error("File backup tidak dapat dibuat."));
            reader.readAsDataURL(new Blob([buffer]));
        });
        if (!isCurrentSession()) return;
        const saved = await tauriApi.saveOrderBackup({ date, base64Data });
        if (!saved?.success) throw new Error(saved?.message || "Backup order gagal disimpan.");
        if (isCurrentSession()) {
            setState({
                date,
                directory: saved.directory,
                success: true,
                message: `Backup cache order diperbarui ${new Date().toLocaleTimeString("id-ID")}.`
            });
        }
    } catch (error) {
        if (isCurrentSession()) setState({ date, success: false, message: `Backup order gagal: ${error.message}` });
        console.error("Backup order:", error);
    }
};

export const runOrderBackup = (session, cachedOrders) => {
    if (!canBackupOrders(session)) return Promise.resolve();
    const date = getOrderBackupDate();
    const key = date;
    const orders = cachedOrders ?? getLocalOrdersForBackup(date);
    // Snapshot yang menunggu penulisan dapat melewati pergantian hari.
    const snapshot = { session, orders: orders.filter(order => typeof order?.date === "string" && order.date.slice(0, 10) === date) };
    const existing = pending.get(key);
    if (existing) {
        existing.next = snapshot;
        return existing.promise;
    }

    const job = { next: snapshot, promise: null };
    pending.set(key, job);
    job.promise = Promise.resolve().then(async () => {
        // Jangan jalankan dua penulisan bersamaan: proses snapshot terbaru setelah penulisan aktif selesai.
        while (job.next) {
            const next = job.next;
            job.next = null;
            await writeOrderBackup(next.session, date, next.orders);
        }
    }).finally(() => pending.delete(key));
    return job.promise;
};
