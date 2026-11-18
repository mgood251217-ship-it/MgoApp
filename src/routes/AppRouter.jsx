import { useState, useEffect, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login/Login";
import Boot from "../pages/Boot/Boot";
import MainLayout from "../layouts/MainLayout";
import { useSession } from "../services/session";
import { isDesktop } from "../services/platform";
import { getLocalOrdersForBackup, subscribeLocalOrdersCache } from "../services/apiCache";

export default function AppRouter() {
    const session = useSession();
    const authenticated = Boolean(session);
    const [bootComplete, setBootComplete] = useState(false);
    const handleBootComplete = useCallback(() => setBootComplete(true), []);

    useEffect(() => {
        if (!isDesktop || !session) return;
        let timer;
        const schedule = (delay = 150) => {
            clearTimeout(timer);
            const orders = getLocalOrdersForBackup();
            timer = setTimeout(() => {
                import("../services/orderBackup").then(({ runOrderBackup }) => runOrderBackup(session, orders));
            }, delay);
        };
        schedule(0);
        const unsubscribe = subscribeLocalOrdersCache(() => schedule());
        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, [session]);

    if (!bootComplete) {
        return <Boot onComplete={handleBootComplete} />;
    }

    if (authenticated) {
        return <MainLayout />;
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