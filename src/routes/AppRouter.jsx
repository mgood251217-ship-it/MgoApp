import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login/Login";
import Boot from "../pages/Boot/Boot";
import MainLayout from "../layouts/MainLayout";
import { authStore } from "../services/session";

export default function AppRouter() {
    const [authenticated, setAuthenticated] = useState(Boolean(authStore.getUser()));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = authStore.subscribe((user) => {
            setAuthenticated(Boolean(user));
        });

        async function verifySession() {
            await authStore.checkSession();
            setLoading(false);
        }

        verifySession();

        return unsubscribe;
    }, []);

    if (loading) {
        return (
            <HashRouter>
                <Boot />
            </HashRouter>
        );
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