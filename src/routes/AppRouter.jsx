import { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login/Login";
import Boot from "../pages/Boot/Boot";
import MainLayout from "../layouts/MainLayout";
import { authStore } from "../services/session";

function AuthFlow() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Boot />} />
                <Route path="/login" element={<Login />} />
            </Routes>
        </HashRouter>
    );
}

export default function AppRouter() {
    const [authenticated, setAuthenticated] = useState(Boolean(authStore.getUser()));

    useEffect(() => {
        const unsubscribe = authStore.subscribe((user) => {
            setAuthenticated(Boolean(user));
        });
        return unsubscribe;
    }, []);

    if (authenticated) {
        return <MainLayout />;
    }

    return <AuthFlow />;
}