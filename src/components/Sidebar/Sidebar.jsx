import "./Sidebar.css";
import { RiStore2Line } from "react-icons/ri";
import {LuPackage} from "react-icons/lu";
import {FiShoppingBag,FiFileText} from "react-icons/fi";
import {FaBoxes} from "react-icons/fa";
import {TbRulerMeasure} from "react-icons/tb";
import {MdOutlineErrorOutline} from "react-icons/md";
import {GiSewingMachine} from "react-icons/gi";
import { NavLink } from "react-router-dom";

const menus = [
    { title: "Store", path: "/store", icon: <RiStore2Line /> },
    { title: "Orders", path: "/orders", icon: <LuPackage /> },
    { title: "Products", path: "/products", icon: <FiShoppingBag /> },
    { title: "Global Stocks", path: "/global-stocks", icon: <FaBoxes /> },
    { title: "Meteran", path: "/meteran", icon: <TbRulerMeasure /> },
    { title: "Failure", path: "/failure", icon: <MdOutlineErrorOutline /> },
    { title: "Maklun", path: "/maklun", icon: <GiSewingMachine /> },
    { title: "Report", path: "/report", icon: <FiFileText /> }
];

export default function Sidebar() {
    return (
        <aside className="sidebar">
            <div className="sidebar-profile">
                <img
                    src="https://i.pravatar.cc/100"
                    alt="Profile"
                />

                <div className="sidebar-user">
                    <h4>Administrator</h4>
                    <span>Super Admin</span>
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