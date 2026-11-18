import { getLocalOrdersForBackup, getLocalPaymentsForBackup } from "./apiCache";
import { tauriApi } from "../lib/tauriApi";
import { authStore } from "./session";

const pending = new Map();
const states = new Map();
const backupTypes = {
    order: { label: "order", key: "orders", load: getLocalOrdersForBackup, create: "createOrderBackupExcel", save: args => tauriApi.saveOrderBackup(args) },
    payment: { label: "pembayaran", key: "payments", load: getLocalPaymentsForBackup, create: "createPaymentBackupExcel", save: args => tauriApi.savePaymentBackup(args) }
};
const listeners = new Set();

export const canBackupOrders = session => Boolean(session?.user && session?.store?.name);

export const getOrderBackupDate = (now = new Date()) => {
    const date = new Date(now);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};

export const getOrderBackupState = () => states.get("order");
export const getPaymentBackupState = () => states.get("payment");
export const subscribeOrderBackup = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const setState = (type, state) => {
    states.set(type, state);
    listeners.forEach(listener => listener());
};

const writeBackup = async (session, date, records, type) => {
    const backup = backupTypes[type];
    const isCurrentSession = () => {
        const current = authStore.getUser();
        return current?.token === session.token && current?.user?.user_id === session.user?.user_id
            && current?.user?.username === session.user?.username
            && current?.store?.name === session.store.name;
    };
    if (!isCurrentSession()) return;
    if (!records.length) {
        setState(type, { date, message: `Cache ${backup.label} kosong. Backup sebelumnya tetap disimpan.` });
        return;
    }

    setState(type, { date, message: `Memperbarui backup ${backup.label}...` });
    try {
        const excel = await import("./excelService");
        const buffer = await excel[backup.create]({ [backup.key]: records, store: session.store, date });
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = () => reject(new Error("File backup tidak dapat dibuat."));
            reader.readAsDataURL(new Blob([buffer]));
        });
        if (!isCurrentSession()) return;
        const saved = await backup.save({ date, base64Data });
        if (!saved?.success) throw new Error(saved?.message || `Backup ${backup.label} gagal disimpan.`);
        if (isCurrentSession()) {
            setState(type, {
                date,
                directory: saved.directory,
                success: true,
                message: `Backup ${backup.label} diperbarui ${new Date().toLocaleTimeString("id-ID")}.`
            });
        }
    } catch (error) {
        if (isCurrentSession()) setState(type, { date, success: false, message: `Backup ${backup.label} gagal: ${error.message}` });
        console.error(`Backup ${backup.label}:`, error);
    }
};

const runBackup = (session, cachedRecords, type) => {
    if (!canBackupOrders(session)) return Promise.resolve();
    const date = getOrderBackupDate();
    const key = `${type}_${date}`;
    const records = cachedRecords ?? backupTypes[type].load(date);
    // Snapshot yang menunggu penulisan dapat melewati pergantian hari.
    const snapshot = { session, records: records.filter(order => typeof order?.date === "string" && order.date.slice(0, 10) === date) };
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
            await writeBackup(next.session, date, next.records, type);
        }
    }).finally(() => pending.delete(key));
    return job.promise;
};

export const runOrderBackup = (session, orders) => runBackup(session, orders, "order");
export const runPaymentBackup = (session, payments) => runBackup(session, payments, "payment");
