import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import Footer from "../components/Footer/Footer";
import { TabsProvider, useTabs } from "../context/TabsContext";

const Store = lazy(() => import("../pages/Store"));
const Orders = lazy(() => import("../pages/Orders"));
const Order = lazy(() => import("../pages/Order"));
const Products = lazy(() => import("../pages/Products"));
const GlobalStocks = lazy(() => import("../pages/GlobalStocks"));
const Meteran = lazy(() => import("../pages/Meteran"));
const Failure = lazy(() => import("../pages/Failure"));
const Maklun = lazy(() => import("../pages/Maklun"));
const Report = lazy(() => import("../pages/Report"));
const Settings = lazy(() => import("../pages/Settings"));
const Guide = lazy(() => import("../pages/Guide"));

const TransaksiDetail = lazy(() => import("../pages/Reports/TransaksiDetail"));
const TransaksiHarian = lazy(() => import("../pages/Reports/TransaksiHarian"));
const TransaksiBulanan = lazy(() => import("../pages/Reports/TransaksiBulanan"));
const TransaksiPerItem = lazy(() => import("../pages/Reports/TransaksiPerItem"));
const TransaksiPerKonsumen = lazy(() => import("../pages/Reports/TransaksiPerKonsumen"));
const OmsetPerItem = lazy(() => import("../pages/Reports/OmsetPerItem"));
const PemakaianBahan = lazy(() => import("../pages/Reports/PemakaianBahan"));
const Piutang = lazy(() => import("../pages/Reports/Piutang"));
const Pelunasan = lazy(() => import("../pages/Reports/Pelunasan"));
const Keuangan = lazy(() => import("../pages/Reports/Keuangan"));
const StatistikKaryawan = lazy(() => import("../pages/Reports/StatistikKaryawan"));

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
    "/guide": "Guide"
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
        <Suspense fallback={<div role="status" style={{ padding: 16 }}>Memuat halaman...</div>}>
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
            <Route path="/guide" element={<Guide />} />

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

            <Route path="/settings" element={<Settings />} />
        </Routes>
        </Suspense>
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
    useEffect(() => {
        localStorage.removeItem("mgo_cache_activity");
        localStorage.removeItem("mgo_cache_orderArchive");
    }, []);

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