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
import { authStore, useSession } from "../../services/session";
import { useTabs } from "../../context/TabsContext";

const menus = [
    { title: "Store", path: "/store", icon: <RiStore2Line />, restrict: true },
    { title: "Orders", path: "/orders", icon: <LuPackage /> },
    { title: "Products", path: "/products", icon: <FiShoppingBag /> },
    { title: "G Stocks", path: "/global-stocks", icon: <FaBoxes /> },
    { title: "Meteran", path: "/meteran", icon: <TbRulerMeasure />, restrict: true },
    { title: "Failures", path: "/failure", icon: <MdOutlineErrorOutline /> },
    { title: "Maklun", path: "/maklun", icon: <LiaWindowRestore /> },
    { title: "Reports", path: "/report", icon: <FiFileText />, restrict: true },
    { title: "Settings", path: "/settings", icon: <MdOutlineSettings /> }
];

export default function Sidebar() {
    const session = useSession();
    const { openTab } = useTabs();
    
    const role = (session?.user?.role || "GUEST").toUpperCase();
    const name = session?.user?.name ?? "Guest";
    const subtitle = session?.user?.initial ?? role;
    const avatar = session?.user?.foto_link;

    const hasPrivilegeAccess = role === "ADMIN" || role === "MANAGER";

    const filteredMenus = menus.filter(menu => {
        if (menu.restrict) {
            return hasPrivilegeAccess; 
        }
        return true; 
    });

    const handleMenuClick = (e, menu) => {
        const isMiddleClick = e.type === "auxclick" && e.button === 1;
        const isCtrlOrCmdClick = e.type === "click" && (e.ctrlKey || e.metaKey);

        if (isMiddleClick || isCtrlOrCmdClick) {
            e.preventDefault();
            openTab(menu.path, menu.title);
        }
    };

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
                {filteredMenus.map((menu) => (
                    <NavLink
                        key={menu.path}
                        to={menu.path}
                        title="Ctrl+Klik atau klik tengah untuk buka di tab baru"
                        className={({ isActive }) =>
                            isActive ? "sidebar-item active" : "sidebar-item"
                        }
                        onClick={(e) => handleMenuClick(e, menu)}
                        onAuxClick={(e) => handleMenuClick(e, menu)}
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