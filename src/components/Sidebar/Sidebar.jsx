import "./Sidebar.css";
import { MdOutlineSettings } from "react-icons/md";
import { RiStore2Line } from "react-icons/ri";
import { LuPackage } from "react-icons/lu";
import { FiShoppingBag, FiFileText } from "react-icons/fi";
import { FaBoxes } from "react-icons/fa";
import { TbRulerMeasure } from "react-icons/tb";
import { MdOutlineErrorOutline } from "react-icons/md";
import { NavLink } from "react-router-dom";
import { LiaWindowRestore } from "react-icons/lia";
import { authStore } from "../../store/auth.store";
import config from "../../services/config";

const menus = [
    { title: "Store", path: "/store", icon: <RiStore2Line /> },
    { title: "Orders", path: "/orders", icon: <LuPackage /> },
    { title: "Products", path: "/products", icon: <FiShoppingBag /> },
    { title: "Global Stocks", path: "/global-stocks", icon: <FaBoxes /> },
    { title: "Meteran", path: "/meteran", icon: <TbRulerMeasure /> },
    { title: "Failure", path: "/failure", icon: <MdOutlineErrorOutline /> },
    { title: "Maklun", path: "/maklun", icon: <LiaWindowRestore /> },
    { title: "Report", path: "/report", icon: <FiFileText /> },
    { title: "Settings", path: "/settings", icon: <MdOutlineSettings /> }
];

export default function Sidebar() {
    const session = authStore.getUser();
    const role = session?.user?.role ?? "guest";
    const name = session?.user?.name ?? "Guest";
    const subtitle = session?.user?.initial ?? role;
    const baseUrl = config.serverUrl;
    const avatar = session?.user?.foto
    ? session.user.foto.startsWith("http")
        ? session.user.foto
        : `${baseUrl}/assets/img/user/${session.user.foto}`
    : "...";
    return (
        <aside className="sidebar">
            <div className="sidebar-profile">
                <img
                    src={avatar}
                    alt="Profile"
                />

                <div className="sidebar-user">
                    <h4>{name}</h4>
                    <span>{subtitle}</span>
                </div>
            </div>

            <nav className="sidebar-menu">
                {menus.map((menu) => (
                    <NavLink
                        key={menu.path}
                        to={menu.path}
                        className={({ isActive }) =>
                            isActive ? "sidebar-item active" : "sidebar-item"
                        }
                    >
                        <div className="sidebar-icon">
                            {menu.icon}
                        </div>

                        <span>
                            {menu.title}
                        </span>
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
