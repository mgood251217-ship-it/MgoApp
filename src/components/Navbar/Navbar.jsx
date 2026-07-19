import "./Navbar.css";
import { useEffect, useState } from "react";
import { FiBell, FiLogOut, FiMoon, FiSun } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { authStore } from "../../store/auth.store";
import { logout as apiLogout } from "../../services/auth";
import { changeTheme } from "../../services/setting";
import config from "../../services/config";
import { getSession } from "../../services/session";

const THEME_KEY = "theme";

function normalizeTheme(mode) {
    return Number(mode) === 1 || mode === "dark" ? "dark" : "light";
}

function getSessionMode(session) {
    return session?.setting?.mode ?? session?.settings?.mode ?? session?.user?.mode ?? session?.mode;
}

function getInitialTheme(session) {
    const sessionMode = getSessionMode(session);

    if (sessionMode !== undefined && sessionMode !== null) {
        return normalizeTheme(sessionMode);
    }

    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark" || savedTheme === "light") {
        return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function Navbar() {
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [theme, setTheme] = useState(() => getInitialTheme(null));
    const [themeLoading, setThemeLoading] = useState(false);
    const storeName = session?.store?.name ?? "MGO Store";
    const userName = session?.user?.name ?? "Guest";
    const role = session?.user?.role ?? "";
    const userId = session?.user?.user_id ?? session?.user_id;
    const baseUrl = config.serverUrl;
    const avatar = session?.store?.logo
    ? session.store.logo.startsWith("http")
        ? session.store.logo
        : `${baseUrl}/assets/img/store/${session.store.logo}`
    : "...";

    useEffect(() => {
        let mounted = true;

        async function loadSession() {
            try {
                const response = await getSession();
                const nextSession = response?.success ? response.data : response?.data ?? response;

                if (mounted) {
                    setSession(nextSession ?? null);
                }
            } catch (error) {
                console.error("Gagal memuat session navbar:", error);

                if (mounted) {
                    setSession(null);
                }
            }
        }

        loadSession();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        setTheme(getInitialTheme(session));
    }, [session]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    async function handleLogout() {
        try { await apiLogout(); } catch (e) {}
        authStore.logout();
        navigate("/login", { replace: true });
    }

    async function handleTheme() {
        if (!userId || themeLoading) return;

        const currentTheme = theme;
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        const mode = nextTheme === "dark" ? 1 : 0;

        setTheme(nextTheme);
        setThemeLoading(true);

        try {
            const response = await changeTheme({ user_id: userId, mode });

            if (!response?.success) {
                throw new Error(response?.message || "Gagal menyimpan tema.");
            }
        } catch (error) {
            setTheme(currentTheme);
            console.log("Gagal mengubah tema:", error?.message || error);
        } finally {
            setThemeLoading(false);
        }
    }

    return (
        <header className="navbar">
            <div className="navbar-left">
                <img src={avatar} alt="Logo" className="navbar-logo" />
                <div className="navbar-store">
                    <h3>{storeName}</h3>
                    <span>{userName} {role ? `\u2022 ${role}` : ""}</span>
                </div>
            </div>

            <div className="navbar-right">
                <button
                    className="navbar-button"
                    onClick={handleTheme}
                    disabled={themeLoading || !userId}
                    aria-label={theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode"}
                    title={theme === "dark" ? "Light mode" : "Dark mode"}
                >
                    {theme === "dark" ? <FiSun /> : <FiMoon />}
                </button>
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