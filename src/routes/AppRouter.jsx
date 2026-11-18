import { useState, useEffect, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login/Login";
import Boot from "../pages/Boot/Boot";
import MainLayout from "../layouts/MainLayout";
import { useSession } from "../services/session";
import { isDesktop } from "../services/platform";
import { getLocalOrdersForBackup, subscribeLocalOrdersCache, getLocalPaymentsForBackup, subscribeLocalPaymentsCache } from "../services/apiCache";

export default function AppRouter() {
    const session = useSession();
    const authenticated = Boolean(session);
    const [bootComplete, setBootComplete] = useState(false);
    const handleBootComplete = useCallback(() => setBootComplete(true), []);

    useEffect(() => {
        if (!isDesktop || !session) return;
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