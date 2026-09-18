import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

const TabsContext = createContext(null);

export function TabsProvider({ children, initialPath = "/orders", initialTitle = "Orders" }) {
    const idRef = useRef(0);
    const nextId = () => `tab-${++idRef.current}`;

    const [tabs, setTabs] = useState(() => [
        { id: nextId(), path: initialPath, title: initialTitle }
    ]);
    const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);

    const tabsRef = useRef(tabs);
    useEffect(() => {
        tabsRef.current = tabs;
    }, [tabs]);

    const openTab = useCallback((path, title = "Tab baru") => {
        const id = nextId();
        setTabs((prev) => [...prev, { id, path, title }]);
        setActiveTabId(id);
    }, []);

    const closeTab = useCallback((tabId) => {
        setTabs((prev) => {
            if (prev.length <= 1) return prev;
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

    useEffect(() => {
        function handleKeyDown(e) {
            if (!e.ctrlKey) return;

            if (e.key === "Tab") {
                e.preventDefault();
                const currentTabs = tabsRef.current;
                setActiveTabId((currentActiveId) => {
                    const idx = currentTabs.findIndex((t) => t.id === currentActiveId);
                    if (idx === -1) return currentActiveId;
                    const dir = e.shiftKey ? -1 : 1;
                    const nextIdx = (idx + dir + currentTabs.length) % currentTabs.length;
                    return currentTabs[nextIdx].id;
                });
                return;
            }

            if (e.key.toLowerCase() === "w") {
                e.preventDefault();
                closeTab(activeTabId);
                return;
            }

            if (e.key.toLowerCase() === "t") {
                e.preventDefault();
                openTab("/orders", "Orders");
                return;
            }

            if (/^[1-9]$/.test(e.key)) {
                e.preventDefault();
                const currentTabs = tabsRef.current;
                const idx = e.key === "9" ? currentTabs.length - 1 : Number(e.key) - 1;
                if (currentTabs[idx]) setActiveTabId(currentTabs[idx].id);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTabId, closeTab, openTab]);

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