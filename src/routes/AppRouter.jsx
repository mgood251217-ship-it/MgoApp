import { useState, useEffect, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login/Login";
import Boot from "../pages/Boot/Boot";
import MainLayout from "../layouts/MainLayout";
import { useSession } from "../services/session";
import { isDesktop } from "../services/platform";
import { getLocalOrdersForBackup, subscribeLocalOrdersCache, getLocalPaymentsForBackup, subscribeLocalPaymentsCache, clearAllCache } from "../services/apiCache";
import { authStore } from "../services/session";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { isTauri } from "@tauri-apps/api/core";
import api from "../api/axios";
import Splash from "../components/Splash/Splash";
import Swal from "sweetalert2";

export default function AppRouter() {
    const session = useSession();
    const authenticated = Boolean(session);
    const [bootComplete, setBootComplete] = useState(false);
    const [openingStore, setOpeningStore] = useState(isDesktop && isTauri());
    const [sessionVersion, setSessionVersion] = useState(0);
    const handleBootComplete = useCallback(() => setBootComplete(true), []);

    useEffect(() => {
        if (!isDesktop || !isTauri() || !bootComplete) return;
        let active = true;
        let unlisten;
        let queue = Promise.resolve();
        let pending = 0;
        const seen = new Set();
        const acceptUrls = (urls) => {
            for (const raw of urls || []) {
                let url;
                try { url = new URL(raw); } catch { continue; }
                if (url.protocol !== "mgodesktop:" || url.hostname !== "login" || !["", "/"].includes(url.pathname)) continue;
                const ticket = url.searchParams.get("ticket") || "";
                if (!/^[a-f0-9]{64}$/.test(ticket) || seen.has(ticket)) continue;
                seen.add(ticket);
                pending++;
                setOpeningStore(true);
                queue = queue.then(async () => {
                    if (!active) return;
                    setOpeningStore(true);
                    try {
                        const body = new FormData();
                        body.append("ticket", ticket);
                        const { data } = await api.post("/?action=desktop_login", body);
                        if (!data.success || !data.data?.user || !data.data?.store) throw new Error(data.message || "Sesi toko tidak valid.");
                        clearAllCache();
                        localStorage.setItem("last_store_name", data.data.store.name);
                        authStore.setSession(data.data);
                        setSessionVersion(version => version + 1);
                    } catch (error) {
                        // Respons terputus bisa terjadi setelah cookie server sudah berganti.
                        clearAllCache();
                        authStore.logout();
                        await Swal.fire({ icon: "error", title: "Gagal membuka toko", text: error.response?.data?.message || error.message || "Klik Kelola kembali dari Center." });
                    } finally {
                        pending--;
                        if (active && pending === 0) setOpeningStore(false);
                    }
                });
            }
        };
        const start = async () => {
            try {
                unlisten = await onOpenUrl(acceptUrls);
                if (!active) { unlisten(); return; }
                acceptUrls(await getCurrent());
                await queue;
            } catch {
                if (active) await Swal.fire({ icon: "error", title: "Tautan aplikasi belum tersedia", text: "Pasang ulang MgoDesktop versi terbaru untuk membuka toko dari Center." });
            } finally {
                if (active && pending === 0) setOpeningStore(false);
            }
        };
        start();
        return () => { active = false; unlisten?.(); };
    }, [bootComplete]);

    useEffect(() => {
        if (!isDesktop || !session || !bootComplete || openingStore) return;
        let orderTimer;
        let paymentTimer;
        const scheduleOrder = (delay = 150) => {
            clearTimeout(orderTimer);
            const orders = getLocalOrdersForBackup();
            orderTimer = setTimeout(() => {
                import("../services/orderBackup").then(({ runOrderBackup }) => runOrderBackup(session, orders));
            }, delay);
        };
        const schedulePayment = (delay = 150) => {
            clearTimeout(paymentTimer);
            const payments = getLocalPaymentsForBackup();
            paymentTimer = setTimeout(() => {
                import("../services/orderBackup").then(({ runPaymentBackup }) => runPaymentBackup(session, payments));
            }, delay);
        };
        scheduleOrder(0);
        schedulePayment(0);
        const unsubscribeOrder = subscribeLocalOrdersCache(() => scheduleOrder());
        const unsubscribePayment = subscribeLocalPaymentsCache(() => schedulePayment());
        return () => {
            clearTimeout(orderTimer);
            clearTimeout(paymentTimer);
            unsubscribeOrder();
            unsubscribePayment();
        };
    }, [session, bootComplete, openingStore]);

    if (!bootComplete) {
        return <Boot onComplete={handleBootComplete} />;
    }

    if (openingStore) return <Splash message="Membuka sesi toko..." />;

    if (authenticated) {
        return <MainLayout key={sessionVersion} />;
    }

    return (
        <HashRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
        </HashRouter>
    );
}
