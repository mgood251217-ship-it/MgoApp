import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar/Sidebar";
import Navbar from "../components/Navbar/Navbar";
import Footer from "../components/Footer/Footer";

export default function MainLayout() {
    return (
        <div className="app">
            <div className="app">
                <Sidebar />

                <div className="main">
                    <Navbar />

                    <div className="content">
                        <Outlet />
                    </div>

                    <Footer />
                </div>
            </div>
        </div>
    );
}