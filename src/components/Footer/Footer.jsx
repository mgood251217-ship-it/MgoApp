import './Footer.css';
import { FiPlus, FiX } from 'react-icons/fi';
import { useTabs } from '../../context/TabsContext';

export default function Footer() {
    const { tabs, activeTabId, switchTab, closeTab, openTab } = useTabs();

    return (
        <div className="footer">
            <div className="footer-tabs">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={tab.id === activeTabId ? "footer-tab active" : "footer-tab"}
                        onClick={() => switchTab(tab.id)}
                    >
                        <span className="footer-tab-title">{tab.title}</span>
                        {tabs.length > 1 && (
                            <button
                                type="button"
                                className="footer-tab-close"
                                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                            >
                                <FiX />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    type="button"
                    className="footer-tab-add"
                    onClick={() => openTab("/orders", "Orders")}
                    title="Buka tab baru"
                >
                    <FiPlus />
                </button>
            </div>

            <div className="footer-copyright">© 2026 Mgo. All rights reserved.</div>
        </div>
    );
}