import {
    BrowserRouter,
    Routes,
    Route
} from "react-router-dom";

import Login from "../pages/Login/Login";
import Boot from "../pages/Boot/Boot";

import AuthGuard from "../guards/AuthGuard";
import MainLayout from "../layouts/MainLayout";

import Dashboard from "../pages/Dashboard";
import Store from "../pages/Store";
import Orders from "../pages/Orders";
import Products from "../pages/Products";
import GlobalStocks from "../pages/GlobalStocks";
import Meteran from "../pages/Meteran";
import Failure from "../pages/Failure";
import Maklun from "../pages/Maklun";
import Report from "../pages/Report";

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/"
                    element={<Boot />}
                />

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    element={
                        <AuthGuard>
                            <MainLayout />
                        </AuthGuard>
                    }
                >
                    <Route
                        path="/dashboard"
                        element={<Dashboard />}
                    />

                    <Route
                        path="/store"
                        element={<Store />}
                    />

                    <Route
                        path="/orders"
                        element={<Orders />}
                    />

                    <Route
                        path="/products"
                        element={<Products />}
                    />

                    <Route
                        path="/global-stocks"
                        element={<GlobalStocks />}
                    />

                    <Route
                        path="/meteran"
                        element={<Meteran />}
                    />

                    <Route
                        path="/failure"
                        element={<Failure />}
                    />

                    <Route
                        path="/maklun"
                        element={<Maklun />}
                    />

                    <Route
                        path="/report"
                        element={<Report />}
                    />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}