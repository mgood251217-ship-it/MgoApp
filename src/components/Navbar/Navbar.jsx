import "./Navbar.css";
import { FiBell, FiLogOut, FiMoon } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { authStore } from "../../store/auth.store";

export default function Navbar() {
    const navigate = useNavigate();

    function handleLogout() {
        authStore.logout();
        navigate("/login", { replace: true });
    }

    return (
        <header className="navbar">
            <div className="navbar-left">
                <img
                    src="https://placehold.co/36x36"
                    alt="Logo"
                    className="navbar-logo"
                />

                <div className="navbar-store">
                    <h3>MGO Desktop</h3>
                    <span>MGO Store</span>
                </div>
            </div>

            <div className="navbar-right">
                <button className="navbar-button">
                    <FiMoon />
                </button>

                <button className="navbar-button">
                    <FiBell />
                    <span className="navbar-badge">3</span>
                </button>

                <button
                    className="navbar-logout"
                    onClick={handleLogout}
                >
                    <FiLogOut />
                    <span>Logout</span>
                </button>
            </div>
        </header>
    );
}