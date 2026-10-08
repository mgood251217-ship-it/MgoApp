import { useState, useEffect, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login/Login";
import Boot from "../pages/Boot/Boot";
import MainLayout from "../layouts/MainLayout";
import { authStore } from "../services/session";

export default function AppRouter() {
    const [authenticated, setAuthenticated] = useState(Boolean(authStore.getUser()));
    const [bootComplete, setBootComplete] = useState(false);
    const handleBootComplete = useCallback(() => setBootComplete(true), []);

    useEffect(() => {
        const unsubscribe = authStore.subscribe((user) => {
            setAuthenticated(Boolean(user));
        });

        return unsubscribe;
    }, []);

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