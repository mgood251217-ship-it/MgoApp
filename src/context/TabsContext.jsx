import { createContext, useContext, useState, useCallback, useRef } from "react";

const TabsContext = createContext(null);

export function TabsProvider({ children, initialPath = "/orders", initialTitle = "Orders" }) {
    const idRef = useRef(0);
    const nextId = () => `tab-${++idRef.current}`;

    const [tabs, setTabs] = useState(() => [
        { id: nextId(), path: initialPath, title: initialTitle }
    ]);
    const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);

    const openTab = useCallback((path, title = "Tab baru") => {
        const id = nextId();
        setTabs((prev) => [...prev, { id, path, title }]);
        setActiveTabId(id);
    }, []);

    const closeTab = useCallback((tabId) => {
        setTabs((prev) => {
            if (prev.length <= 1) return prev; // minimal 1 tab tetap terbuka
            const idx = prev.findIndex((t) => t.id === tabId);
            const next = prev.filter((t) => t.id !== tabId);
            setActiveTabId((curr) => {
                if (curr !== tabId) return curr;
                const fallback = next[idx] || next[idx - 1] || next[0];
                return fallback.id;
            });
            return next;
        });
    }, []);

    const switchTab = useCallback((tabId) => setActiveTabId(tabId), []);

    const setTabTitle = useCallback((tabId, title) => {
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, title } : t)));
    }, []);

    return (
        <TabsContext.Provider value={{ tabs, activeTabId, openTab, closeTab, switchTab, setTabTitle }}>
            {children}
        </TabsContext.Provider>
    );
}

export function useTabs() {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error("useTabs harus dipakai di dalam TabsProvider");
    return ctx;
}