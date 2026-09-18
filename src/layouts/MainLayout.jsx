import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import Footer from "../components/Footer/Footer";
import { TabsProvider, useTabs } from "../context/TabsContext";

import Store from "../pages/Store";
import Orders from "../pages/Orders";
import Order from "../pages/Order";
import Products from "../pages/Products";
import GlobalStocks from "../pages/GlobalStocks";
import Meteran from "../pages/Meteran";
import Failure from "../pages/Failure";
import Maklun from "../pages/Maklun";
import Report from "../pages/Report";
import Settings from "../pages/Settings";

import TransaksiDetail from "../pages/Reports/TransaksiDetail";
import TransaksiHarian from "../pages/Reports/TransaksiHarian";
import TransaksiBulanan from "../pages/Reports/TransaksiBulanan";
import TransaksiPerItem from "../pages/Reports/TransaksiPerItem";
import TransaksiPerKonsumen from "../pages/Reports/TransaksiPerKonsumen";
import OmsetPerItem from "../pages/Reports/OmsetPerItem";
import PemakaianBahan from "../pages/Reports/PemakaianBahan";
import Piutang from "../pages/Reports/Piutang";
import Pelunasan from "../pages/Reports/Pelunasan";
import Keuangan from "../pages/Reports/Keuangan";
import StatistikKaryawan from "../pages/Reports/StatistikKaryawan";
import Aktivitas from "../pages/Reports/Aktivitas";

const TITLE_BY_PATH = {
    "/store": "Store",
    "/orders": "Orders",
    "/products": "Products",
    "/global-stocks": "G Stocks",
    "/meteran": "Meteran",
    "/failure": "Failures",
    "/maklun": "Maklun",
    "/report": "Reports",
    "/settings": "Settings",
};

function resolveTitleFromPath(pathname) {
    if (TITLE_BY_PATH[pathname]) return TITLE_BY_PATH[pathname];
    if (pathname.startsWith("/order/")) return "Order";
    if (pathname.startsWith("/reports/")) return "Reports";
    return "Tab";
}

function TabRouteSync({ tabId }) {
    const location = useLocation();
    const { setTabTitle } = useTabs();

    useEffect(() => {
        setTabTitle(tabId, resolveTitleFromPath(location.pathname));
    }, [location.pathname, tabId, setTabTitle]);

    return null;
}

function TabMainRoutes() {
    return (
        <Routes>
            <Route path="/store" element={<Store />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/order/:order_id" element={<Order />} />
            <Route path="/products" element={<Products />} />
            <Route path="/global-stocks" element={<GlobalStocks />} />
            <Route path="/meteran" element={<Meteran />} />
            <Route path="/failure" element={<Failure />} />
            <Route path="/maklun" element={<Maklun />} />
            <Route path="/report" element={<Report />} />

            <Route path="/reports/transaksi-detail" element={<TransaksiDetail />} />
            <Route path="/reports/transaksi-harian" element={<TransaksiHarian />} />
            <Route path="/reports/transaksi-bulanan" element={<TransaksiBulanan />} />
            <Route path="/reports/transaksi-per-item" element={<TransaksiPerItem />} />
            <Route path="/reports/transaksi-per-konsumen" element={<TransaksiPerKonsumen />} />
            <Route path="/reports/omset-per-item" element={<OmsetPerItem />} />
            <Route path="/reports/pemakaian-bahan" element={<PemakaianBahan />} />
            <Route path="/reports/piutang" element={<Piutang />} />
            <Route path="/reports/pelunasan" element={<Pelunasan />} />
            <Route path="/reports/keuangan" element={<Keuangan />} />
            <Route path="/reports/statistik-karyawan" element={<StatistikKaryawan />} />
            <Route path="/reports/aktivitas" element={<Aktivitas />} />

            <Route path="/settings" element={<Settings />} />
        </Routes>
    );
}

function TabPanels() {
    const { tabs, activeTabId } = useTabs();

    return (
        <div className="tab-panels">
            {tabs.map((tab) => (
                <div
                    key={tab.id}
                    className="app"
                    style={{ display: tab.id === activeTabId ? "block" : "none" }}
                >
                    <MemoryRouter initialEntries={[tab.path]}>
                        <TabRouteSync tabId={tab.id} />
                        <Sidebar />
                        <div className="main">
                            <div className="content">
                                <TabMainRoutes />
                            </div>
                        </div>
                    </MemoryRouter>
                </div>
            ))}
        </div>
    );
}

export default function MainLayout() {
    return (
        <TabsProvider initialPath="/orders" initialTitle="Orders">
            <div className="app-shell">
                <Navbar />
                <TabPanels />
                <Footer />
            </div>
        </TabsProvider>
    );
}