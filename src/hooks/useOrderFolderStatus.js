import { useState, useEffect, useCallback, useMemo } from "react";
import { buildFolderName, checkFoldersForItems, listFilesForFolder } from "../services/folderHelper";

export default function useOrderFolderStatus(setAlertConfig) {
    const [appSettings, setAppSettings] = useState({});
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [itemFolderStatus, setItemFolderStatus] = useState({});
    const [folderFilesByPath, setFolderFilesByPath] = useState({});
    const [loadingFilesByPath, setLoadingFilesByPath] = useState({});
    const [creatingFolderFor, setCreatingFolderFor] = useState(null);
    const [dragOverCat, setDragOverCat] = useState(null);
    const [copyFeedbackId, setCopyFeedbackId] = useState(null);

    const [iconModalOpen, setIconModalOpen] = useState(false);
    const [iconModalOrder, setIconModalOrder] = useState(null);
    const [folderIconTarget, setFolderIconTarget] = useState(null);
    const [folderIconFound, setFolderIconFound] = useState(false);
    const [searchingFolder, setSearchingFolder] = useState(false);
    const [applyingIcon, setApplyingIcon] = useState(false);

    useEffect(() => {
        window.electron.getSettings()
            .then((data) => {
                setAppSettings(data || {});
                setSettingsLoaded(true);
            })
            .catch(() => setSettingsLoaded(true));
    }, []);

    const fetchFilesForPath = useCallback(async (folderPath) => {
        setLoadingFilesByPath(prev => ({ ...prev, [folderPath]: true }));
        const res = await listFilesForFolder(folderPath);
        setFolderFilesByPath(prev => ({ ...prev, [folderPath]: res.success ? res.data : [] }));
        setLoadingFilesByPath(prev => ({ ...prev, [folderPath]: false }));
    }, []);

    const checkFolders = useCallback(async (orderRow, itemsList) => {
        const categoriesInOrder = [...new Set((itemsList || []).map(i => i.category).filter(Boolean))];
        setFolderFilesByPath({});
        setLoadingFilesByPath({});

        if (categoriesInOrder.length === 0) {
            setItemFolderStatus({});
            return;
        }
        setItemFolderStatus(() => {
            const next = {};
            categoriesInOrder.forEach(cat => { next[cat] = { status: "checking", path: null }; });
            return next;
        });

        const results = await checkFoldersForItems(appSettings, orderRow, itemsList);
        setItemFolderStatus(results);

        const fetchedPaths = new Set();
        Object.values(results).forEach((info) => {
            if (info.status === "ada" && info.path && !fetchedPaths.has(info.path)) {
                fetchedPaths.add(info.path);
                fetchFilesForPath(info.path);
            }
        });
    }, [appSettings, fetchFilesForPath]);

    const resetFolders = useCallback(() => {
        setItemFolderStatus({});
        setFolderFilesByPath({});
        setLoadingFilesByPath({});
    }, []);

    const dedupedFolderEntries = useMemo(() => {
        const seen = new Map();
        Object.entries(itemFolderStatus)
            .filter(([, info]) => info.status === "ada" || info.status === "tidak-ada")
            .forEach(([cat, info]) => {
                const key = info.path || info.createPath;
                if (!key) return;
                const existing = seen.get(key);
                if (!existing || cat.length < existing.cat.length) {
                    seen.set(key, { cat, info });
                }
            });
        return [...seen.values()];
    }, [itemFolderStatus]);

    const handleCopyFolderName = useCallback(async (row) => {
        const folderName = buildFolderName(row);
        try {
            await navigator.clipboard.writeText(folderName);
            setCopyFeedbackId(row.order_id);
            setTimeout(() => setCopyFeedbackId(null), 1500);
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal menyalin nama folder ke clipboard." });
        }
    }, [setAlertConfig]);

    const handleBuatFolder = useCallback(async (category, createInfo, orderRow, itemsList) => {
        if (!createInfo) return;
        setCreatingFolderFor(category);
        try {
            const res = await window.electron.buatFolderOrder(createInfo);
            if (!res.success) {
                setAlertConfig({ show: true, type: "error", message: res.message || "Gagal membuat folder." });
            } else {
                setAlertConfig({ show: true, type: "success", message: "Folder berhasil dibuat." });
                if (orderRow) checkFolders(orderRow, itemsList || []);
            }
        } finally {
            setCreatingFolderFor(null);
        }
    }, [setAlertConfig, checkFolders]);

    const handleDropFile = useCallback(async (e, category, info, orderRow, itemsList) => {
        e.preventDefault();
        setDragOverCat(null);

        const filePaths = Array.from(e.dataTransfer.files).map(f => window.electron.getPathForFile(f)).filter(Boolean);
        if (filePaths.length === 0) return;

        try {
            let targetPath = info.path;
            if (!targetPath) {
                if (!info.createInfo) return;
                const createRes = await window.electron.buatFolderOrder(info.createInfo);
                if (!createRes.success) {
                    setAlertConfig({ show: true, type: "error", message: createRes.message || "Gagal membuat folder." });
                    return;
                }
                targetPath = createRes.path;
            }

            const res = await window.electron.pindahFileKeFolder({ filePaths, targetFolderPath: targetPath });
            const gagal = res?.results?.filter(r => !r.success) || [];
            if (gagal.length > 0) {
                setAlertConfig({ show: true, type: "error", message: `${gagal.length} file gagal dipindahkan.` });
            } else {
                setAlertConfig({ show: true, type: "success", message: `${filePaths.length} file berhasil dipindahkan.` });
            }
            if (orderRow) checkFolders(orderRow, itemsList || []);
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal memindahkan file." });
        }
    }, [setAlertConfig, checkFolders]);

    const handleOpenIconModalForCategory = useCallback((category, folderPath, orderRow) => {
        setIconModalOrder({ ...orderRow, kategori: category });
        setFolderIconTarget(folderPath);
        setFolderIconFound(true);
        setSearchingFolder(false);
        setIconModalOpen(true);
    }, []);

    const closeIconModal = useCallback(() => {
        setIconModalOpen(false);
        setFolderIconTarget(null);
        setFolderIconFound(false);
        setIconModalOrder(null);
    }, []);

    const handlePilihFolderManual = useCallback(async () => {
        try {
            const path = await window.electron.pilihFolder();
            if (!path) return;
            setFolderIconTarget(path);
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Gagal membuka dialog folder." });
        }
    }, [setAlertConfig]);

    const handleTerapkanIcon = useCallback(async (status) => {
        if (!folderIconTarget) return;
        setApplyingIcon(true);
        try {
            const res = await window.electron.setIconFolderOrder({ folderPath: folderIconTarget, status });
            if (!res.success) {
                setAlertConfig({ show: true, type: "error", message: res.message || "Gagal mengubah icon folder." });
            } else {
                setAlertConfig({ show: true, type: "success", message: "Icon folder berhasil diubah." });
                closeIconModal();
            }
        } catch (err) {
            setAlertConfig({ show: true, type: "error", message: "Terjadi kesalahan saat mengubah icon folder." });
        } finally {
            setApplyingIcon(false);
        }
    }, [folderIconTarget, setAlertConfig, closeIconModal]);

    return {
        settingsLoaded,
        itemFolderStatus,
        folderFilesByPath,
        loadingFilesByPath,
        dedupedFolderEntries,
        creatingFolderFor,
        dragOverCat,
        setDragOverCat,
        copyFeedbackId,
        checkFolders,
        resetFolders,
        handleCopyFolderName,
        handleBuatFolder,
        handleDropFile,
        iconModalOpen,
        iconModalOrder,
        folderIconTarget,
        folderIconFound,
        searchingFolder,
        applyingIcon,
        handleOpenIconModalForCategory,
        closeIconModal,
        handlePilihFolderManual,
        handleTerapkanIcon,
    };
}
