import "./Navbar.css";
import { FiBell, FiLogOut, FiMoon } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { authStore } from "../../store/auth.store";
import { logout as apiLogout } from "../../services/auth";
import config from "../../services/config";

export default function Navbar() {
    const navigate = useNavigate();
    const session = authStore.getUser();
    const storeName = session?.store?.name ?? "MGO Store";
    const userName = session?.user?.name ?? "Guest";
    const role = session?.user?.role ?? "";
    const baseUrl = config.serverUrl;
    const avatar = session?.store?.logo
    ? session.store.logo.startsWith("http")
        ? session.store.logo
        : `${baseUrl}/assets/img/store/${session.store.logo}`
    : "...";

    async function handleLogout() {
        try { await apiLogout(); } catch (e) {}
        authStore.logout();
        navigate("/login", { replace: true });
    }

    return (
        <header className="navbar">
            <div className="navbar-left">
                <img src={avatar} alt="Logo" className="navbar-logo" />
                <div className="navbar-store">
                    <h3>{storeName}</h3>
                    <span>{userName} {role ? `• ${role}` : ""}</span>
                </div>
            </div>

            <div className="navbar-right">
                <button className="navbar-button"><FiMoon /></button>
                <button className="navbar-button">
                    <FiBell />
                    <span className="navbar-badge">3</span>
                </button>
                <button className="navbar-logout" onClick={handleLogout}>
                    <FiLogOut />
                    <span>Logout</span>
                </button>
            </div>
        </header>
    );
}