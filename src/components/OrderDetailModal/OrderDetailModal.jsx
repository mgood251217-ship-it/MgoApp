import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../../api/axios";
import Modal from "../Modal/Modal";
import Table from "../Table/Table";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import Select from "../Select/Select";
import Input from "../Input/Input";
import Form from "../Form/Form";
import { formatRupiah, formatTime } from "../../services/helpers";
import { FOLDER_STATUS_LABEL, formatUkuran, buildRenamedFilenameWithQuantity } from "../../services/folderHelper";
import useOrderFolderStatus from "../../hooks/useOrderFolderStatus";
import ChangeFolderIconModal from "../ChangeFolderIconModal/ChangeFolderIconModal";
import { getCachedStoreNames } from "../../services/apiCache";

export default function OrderDetailModal({ open, onClose, viewOrderDetails, viewOrderData, setAlertConfig, onRefresh, operatorOptions = [], onProcessed }) {
    const folder = useOrderFolderStatus(setAlertConfig);
    const [stores, setStores] = useState([]);

    const [maklunModalOpen, setMaklunModalOpen] = useState(false);
    const [maklunData, setMaklunData] = useState({
        order_item_id: "",
        store_id: ""
    });

    const [processModalOpen, setProcessModalOpen] = useState(false);
    const [processOrderData, setProcessOrderData] = useState({
        order_id: "",
        status: "",
        customStatus: "",
        user_id: ""
    });

    const [renamingPath, setRenamingPath] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [editingQtyPath, setEditingQtyPath] = useState(null);
    const [qtyValue, setQtyValue] = useState("");
    const [processingFile, setProcessingFile] = useState(null);

    useEffect(() => {
        if (!open) return;
        if (!folder.settingsLoaded) return;
        if (!viewOrderDetails || !viewOrderData?.items) return;
        folder.checkFolders(viewOrderDetails, viewOrderData.items);
    }, [open, folder.settingsLoaded, viewOrderDetails, viewOrderData]);

    const loadStores = useCallback(async () => {
        try {
            const res = await getCachedStoreNames();
            setStores(res);
        } catch (err) {
            setAlertConfig({ type: "error", message: "Gagal memuat data store" });
        }
    }, [setAlertConfig]);

    useEffect(() => {
        if (maklunModalOpen) {
            loadStores();
        }
    }, [maklunModalOpen, loadStores]);

    const viewTableColumns = useMemo(() => [
        { key: "product_name", title: "Nama" },
        { key: "size", title: "Ukuran" },
        { key: "finishing_names", title: "Finishing" },
        { key: "quantity", title: "Qty" },
        { key: "formatted_amount", title: "Jumlah" },
        { key: "maklun_store", title: "Maklun" },
        { key: "folder_status", title: "Folder" }
    ], []);

    const handleOpenMaklun = (row) => {
        setMaklunData({
            order_item_id: row.order_item_id,
            store_id: row.store_id || ""
        });
        setMaklunModalOpen(true);
    };

    const handleOpenProcess = () => {
        setProcessOrderData({
            order_id: viewOrderDetails?.order_id || "",
            status: "",
            customStatus: "",
            user_id: ""
        });
        setProcessModalOpen(true);
    };

    const handleProcessSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", processOrderData.order_id);

            const finalStatus = processOrderData.status === "LAINYA" ? processOrderData.customStatus : processOrderData.status;
            payload.append("status", finalStatus);

            if (processOrderData.status === "DIAMBIL") {
                payload.append("user_id", processOrderData.user_id);
            } else {
                payload.append("user_id", "");
            }

            await api.post("", payload, { params: { action: "update_project" } });
            setProcessModalOpen(false);
            onProcessed?.();
            onRefresh?.();
        } catch (err) {}
    };

    const viewItemsMapped = (viewOrderData?.items || []).map(item => {
        const isMaklun = !!(item.maklun_store && String(item.maklun_store).trim() !== "");
        return {
            ...item,
            formatted_amount: formatRupiah(item.amount),
            folder_status: isMaklun ? "🤝 Maklun" : (FOLDER_STATUS_LABEL[folder.itemFolderStatus[item.category]?.status] || "-"),
            maklun_store: (
                <Button 
                    size="sm" 
                    variant={isMaklun ? "secondary" : "primary"} 
                    onClick={() => handleOpenMaklun(item)}
                >
                    {isMaklun ? item.maklun_store : "Set Maklun"}
                </Button>
            )
        };
    });

    const handleClose = () => {
        folder.resetFolders();
        onClose();
    };

    const handleMaklunSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = new FormData();
            payload.append("order_id", viewOrderData.order.order_id);
            payload.append("order_item_id", maklunData.order_item_id);
            payload.append("store_id", maklunData.store_id);
            const res = await api.post("", payload, { params: { action: "update_maklun" } });
            if (res.data?.success) {
                setMaklunModalOpen(false);
                setAlertConfig({ type: "success", message: res.data?.message || "Maklun berhasil diperbarui" });
            }else{
                setAlertConfig({ type: "error", message: res.data?.message || "Gagal memperbarui maklun" });
                return;
            }
            onRefresh?.();
        } catch (err) {
            setAlertConfig({ type: "error", message: "Gagal memperbarui maklun" });
        }
    };

    const refreshFolders = () => {
        if (viewOrderDetails && viewOrderData?.items) {
            folder.checkFolders(viewOrderDetails, viewOrderData.items);
        }
    };

    const handleOpenFolder = (folderPath) => {
        if (window.electron?.openFolder) {
            window.electron.openFolder(folderPath);
        } else if (folder.handleOpenFolder) {
            folder.handleOpenFolder(folderPath);
        }
    };

    const handleStartRename = (file, folderPath) => {
        setRenamingPath(`${folderPath}\\${file.nama}`);
        setRenameValue(file.nama);
    };

    const handleConfirmRename = async (oldFullPath, folderPath) => {
        const oldName = oldFullPath.split("\\").pop();
        if (!renameValue || renameValue === oldName) {
            setRenamingPath(null);
            return;
        }
        setProcessingFile(oldFullPath);
        const newFullPath = `${folderPath}\\${renameValue}`;
        const res = await window.electron.renameFileOrder({ oldPath: oldFullPath, newPath: newFullPath });
        setProcessingFile(null);
        setRenamingPath(null);
        if (!res.success) {
            setAlertConfig({ show: true, type: "error", message: res.message || "Gagal mengganti nama file." });
        } else {
            setAlertConfig({ show: true, type: "success", message: "Nama file berhasil diubah." });
            refreshFolders();
        }
    };

    const handleStartEditQty = (file, folderPath) => {
        setEditingQtyPath(`${folderPath}\\${file.nama}`);
        setQtyValue(String(file.quantity));
    };

    const handleConfirmQty = async (file, folderPath) => {
        const newQty = parseInt(qtyValue, 10);
        setEditingQtyPath(null);
        if (!newQty || newQty === file.quantity) return;

        const oldFullPath = `${folderPath}\\${file.nama}`;
        const newName = buildRenamedFilenameWithQuantity(file.nama, newQty);
        const newFullPath = `${folderPath}\\${newName}`;

        setProcessingFile(oldFullPath);
        const res = await window.electron.renameFileOrder({ oldPath: oldFullPath, newPath: newFullPath });
        setProcessingFile(null);
        if (!res.success) {
            setAlertConfig({ show: true, type: "error", message: res.message || "Gagal mengubah quantity." });
        } else {
            setAlertConfig({ show: true, type: "success", message: "Quantity berhasil diubah." });
            refreshFolders();
        }
    };

    const handleDeleteFile = async (file, folderPath) => {
        const ok = window.confirm(`Hapus file "${file.nama}"? Tindakan ini tidak bisa dibatalkan.`);
        if (!ok) return;

        const fullPath = `${folderPath}\\${file.nama}`;
        setProcessingFile(fullPath);
        const res = await window.electron.deleteFileOrder(fullPath);
        setProcessingFile(null);
        if (!res.success) {
            setAlertConfig({ show: true, type: "error", message: res.message || "Gagal menghapus file." });
        } else {
            setAlertConfig({ show: true, type: "success", message: "File berhasil dihapus." });
            refreshFolders();
        }
    };

    return (
        <>
            <Modal
                open={open}
                onClose={handleClose}
                title={`Detail Order - ${viewOrderDetails?.nomorator || ""}`}
                size="lg"
                headerColor="info"
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--secondary)" }}>
                        Dibuat: {viewOrderData?.order?.date ? formatTime(viewOrderData.order.date) : "-"}
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={<Icon name="engineering" />}
                        disabled={viewOrderDetails?.project_initial !== ""}
                        onClick={handleOpenProcess}
                    >
                        Proses Order
                    </Button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <Table
                        id="tableViewItems"
                        showNumber
                        size="sm"
                        rowKey="order_item_id"
                        rowDataKey="order_item_id"
                        columns={viewTableColumns}
                        rows={viewItemsMapped}
                    />
                </div>

                {folder.dedupedFolderEntries.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 12 }}>Isi Folder (untuk dibandingkan dengan nota)</h4>
                        {folder.dedupedFolderEntries.map(({ cat, info }) => {
                            const folderPath = info.path;
                            const files = folderPath ? (folder.folderFilesByPath[folderPath] || []) : [];
                            const isLoading = folderPath ? folder.loadingFilesByPath[folderPath] : false;
                            const totalSemua = files.reduce((sum, f) => sum + (f.totalLuas || 0), 0);

                            const groupKey = info.path || info.createPath;
                            const groupCategories = Object.entries(folder.itemFolderStatus)
                                .filter(([, i]) => (i.path || i.createPath) === groupKey)
                                .map(([c]) => c);
                            const parseSizeArea = (sizeStr) => {
                                const match = String(sizeStr || "").match(/(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)/);
                                if (!match) return 0;
                                const a = parseFloat(match[1].replace(",", "."));
                                const b = parseFloat(match[2].replace(",", "."));
                                return a * b;
                            };
                            const orderMeterTotal = (viewOrderData?.items || [])
                                .filter(i => groupCategories.includes(i.category) && !i.maklun_store)
                                .reduce((sum, i) => sum + (parseSizeArea(i.size) * (Number(i.quantity) || 0)), 0);
                            const meterDiff = Math.round((totalSemua - orderMeterTotal) * 100) / 100;

                            return (
                                <div
                                    key={info.path || info.createPath}
                                    onDragOver={(e) => { e.preventDefault(); folder.setDragOverCat(cat); }}
                                    onDragLeave={() => folder.setDragOverCat(null)}
                                    onDrop={(e) => folder.handleDropFile(e, cat, info, viewOrderDetails, viewOrderData.items)}
                                    style={{
                                        marginBottom: 16,
                                        padding: 12,
                                        backgroundColor: "var(--bg-body)",
                                        borderRadius: "var(--radius)",
                                        border: folder.dragOverCat === cat ? "2px dashed var(--primary)" : "1px solid var(--border)"
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                                        <div style={{ fontWeight: "bold" }}>{cat}</div>
                                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                icon={<Icon name="content_copy" />}
                                                style={{ whiteSpace: "nowrap" }}
                                                onClick={() => viewOrderDetails && folder.handleCopyFolderName(viewOrderDetails)}
                                            >
                                                {viewOrderDetails && folder.copyFeedbackId === viewOrderDetails.order_id ? "Tersalin!" : "Salin Nama Folder"}
                                            </Button>
                                            {info.status === "ada" ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={<Icon name="folder_open" />}
                                                        style={{ whiteSpace: "nowrap" }}
                                                        onClick={() => handleOpenFolder(info.path)}
                                                    >
                                                        Buka Folder
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={<Icon name="folder" />}
                                                        style={{ whiteSpace: "nowrap" }}
                                                        onClick={() => folder.handleOpenIconModalForCategory(cat, info.path, viewOrderDetails)}
                                                    >
                                                        Ganti Icon
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        icon={<Icon name="upload_file" />}
                                                        style={{ whiteSpace: "nowrap" }}
                                                        onClick={() => folder.handlePilihFile(cat, info, viewOrderDetails, viewOrderData.items)}
                                                    >
                                                        Pilih File
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="info"
                                                        icon={<Icon name="receipt_long" />}
                                                        style={{ whiteSpace: "nowrap" }}
                                                        disabled={folder.uploadingNotaFor === cat}
                                                        onClick={() => folder.handleUploadNota(cat, info, viewOrderDetails, viewOrderData.items)}
                                                    >
                                                        {folder.uploadingNotaFor === cat ? "Mengupload..." : "Upload Nota"}
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        icon={<Icon name="create_new_folder" />}
                                                        style={{ whiteSpace: "nowrap" }}
                                                        disabled={folder.creatingFolderFor === cat}
                                                        onClick={() => folder.handleBuatFolder(cat, info.createInfo, viewOrderDetails, viewOrderData.items)}
                                                    >
                                                        {folder.creatingFolderFor === cat ? "Membuat..." : "Buat Folder"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={<Icon name="upload_file" />}
                                                        style={{ whiteSpace: "nowrap" }}
                                                        onClick={() => folder.handlePilihFile(cat, info, viewOrderDetails, viewOrderData.items)}
                                                    >
                                                        Pilih File
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ fontSize: 12, color: "var(--secondary)", marginBottom: 8 }}>
                                        Seret file JPG/PNG/PDF/TIFF/CDR ke sini, atau klik "Pilih File" untuk memindahkan ke folder ini.
                                    </div>

                                    {info.status === "tidak-ada" ? (
                                        <div style={{ fontSize: 13, color: "var(--secondary)", wordBreak: "break-all" }}>
                                            Folder belum dibuat. Kalau dibuat, lokasinya:
                                            <br />
                                            <strong style={{ color: "var(--text)" }}>{info.createPath}</strong>
                                        </div>
                                    ) : isLoading ? (
                                        <div style={{ color: "var(--secondary)", fontSize: 13 }}>Membaca isi folder...</div>
                                    ) : files.length === 0 ? (
                                        <div style={{ color: "var(--secondary)", fontSize: 13 }}>Tidak ada file JPG/PNG/PDF/TIFF/CDR di folder ini.</div>
                                    ) : (
                                        <>
                                            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                                                        <th style={{ padding: "4px 8px" }}>Nama File</th>
                                                        <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Ukuran</th>
                                                        <th style={{ padding: "4px 8px" }}>Qty</th>
                                                        <th style={{ padding: "4px 8px" }}>Warna</th>
                                                        <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Total (m²)</th>
                                                        <th style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {files.map((f, idx) => {
                                                        const fullPath = `${folderPath}\\${f.nama}`;
                                                        const isRenaming = renamingPath === fullPath;
                                                        const isEditingQty = editingQtyPath === fullPath;
                                                        const isProcessing = processingFile === fullPath;

                                                        return (
                                                            <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                                                <td style={{ padding: "4px 8px", wordBreak: "break-all" }}>
                                                                    {isRenaming ? (
                                                                        <input
                                                                            autoFocus
                                                                            value={renameValue}
                                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                                            onBlur={() => handleConfirmRename(fullPath, folderPath)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === "Enter") handleConfirmRename(fullPath, folderPath);
                                                                                if (e.key === "Escape") setRenamingPath(null);
                                                                            }}
                                                                            style={{ width: "100%", fontSize: 13 }}
                                                                        />
                                                                    ) : f.nama}
                                                                </td>
                                                                <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{formatUkuran(f)}</td>
                                                                <td style={{ padding: "4px 8px" }}>
                                                                    {isEditingQty ? (
                                                                        <input
                                                                            autoFocus
                                                                            type="number"
                                                                            min="1"
                                                                            value={qtyValue}
                                                                            onChange={(e) => setQtyValue(e.target.value)}
                                                                            onBlur={() => handleConfirmQty(f, folderPath)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === "Enter") handleConfirmQty(f, folderPath);
                                                                                if (e.key === "Escape") setEditingQtyPath(null);
                                                                            }}
                                                                            style={{ width: 50, fontSize: 13 }}
                                                                        />
                                                                    ) : (
                                                                        <span
                                                                            style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                                                                            onClick={() => handleStartEditQty(f, folderPath)}
                                                                            title="Klik untuk ubah quantity"
                                                                        >
                                                                            {f.quantity}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: "4px 8px" }}>{f.colorMode}</td>
                                                                <td style={{ padding: "4px 8px" }}>{f.totalLuas != null ? f.totalLuas : "-"}</td>
                                                                <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                                                                    <div style={{ display: "flex", gap: 4 }}>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            icon={<Icon name="edit" />}
                                                                            disabled={isProcessing}
                                                                            onClick={() => handleStartRename(f, folderPath)}
                                                                        />
                                                                        <Button
                                                                            size="sm"
                                                                            variant="danger"
                                                                            icon={<Icon name="delete" />}
                                                                            disabled={isProcessing}
                                                                            onClick={() => handleDeleteFile(f, folderPath)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            <div style={{ textAlign: "right", marginTop: 8, fontWeight: "bold", fontSize: 13 }}>
                                                Total {cat}: {totalSemua.toFixed(2)} m²
                                                {orderMeterTotal > 0 && (
                                                    <span style={{
                                                        marginLeft: 8,
                                                        color: meterDiff === 0 ? "var(--success)" : "var(--danger)"
                                                    }}>
                                                        ({meterDiff === 0
                                                            ? "sesuai"
                                                            : meterDiff < 0
                                                                ? `kurang ${Math.abs(meterDiff).toFixed(2)} m²`
                                                                : `lebih ${meterDiff.toFixed(2)} m²`})
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, padding: "16px", backgroundColor: "var(--bg-content)", borderRadius: "var(--radius)", border: "1px solid var(--border)"}}>
                    <div>
                        <h5 style={{ margin: "0 0 8px 0" }}>Diskon Produk:</h5>
                        {Object.keys(viewOrderData?.diskon_per_produk || {}).length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text)" }}>
                                {Object.entries(viewOrderData.diskon_per_produk).map(([nama, diskon]) => (
                                    <li key={nama}>
                                        {nama}: {formatRupiah(diskon)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <span style={{ color: "var(--secondary)" }}>Tidak ada diskon</span>
                        )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <h4 style={{ margin: 0 }}>Total Bayar</h4>
                        <h2 style={{ margin: "4px 0 0 0", color: "var(--success)" }}>
                            {formatRupiah(viewOrderData?.total || 0)}
                        </h2>
                    </div>
                </div>
            </Modal>

            <Modal
                open={maklunModalOpen}
                onClose={() => setMaklunModalOpen(false)}
                title="Pilih Maklun Store"
                size="sm"
                headerColor="info"
            >
                <Form id="formMaklun" onSubmit={handleMaklunSubmit}>
                    <Select
                        labelPosition="top"
                        name="store_id"
                        label="Store Maklun"
                        value={maklunData.store_id}
                        onChange={(e) => setMaklunData(prev => ({ ...prev, store_id: e.target.value }))}
                        options={stores.map(store => ({
                            value: store.id || store.store_id,
                            label: store.name || store.store_name
                        })).concat([{ value: "0", label: "Batalkan Maklun" }])}
                        placeholder="Pilih Store"
                        required
                    />
                    <Button type="submit" size="full-lg" variant="info" icon={<Icon name="save" />}>
                        Simpan Maklun
                    </Button>
                </Form>
            </Modal>

            <Modal
                open={processModalOpen}
                onClose={() => setProcessModalOpen(false)}
                title="Proses Order"
                size="sm"
                variant="secondary"
            >
                <Form id="formProcessOrder" onSubmit={handleProcessSubmit}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                        {["BELUM DIPROSES", "DIPROSES", "DIAMBIL", "LAINYA"].map((statusItem) => (
                            <Button
                                key={statusItem}
                                type="button"
                                variant={processOrderData.status === statusItem ? "primary" : "secondary"}
                                onClick={() => setProcessOrderData(prev => ({ ...prev, status: statusItem }))}
                                size="md"
                            >
                                {statusItem}
                            </Button>
                        ))}
                    </div>

                    {processOrderData.status === "LAINYA" && (
                        <div style={{ marginBottom: "16px" }}>
                            <Input
                                labelPosition="left"
                                labelWidth={130}
                                name="customStatus"
                                value={processOrderData.customStatus}
                                onChange={(e) => setProcessOrderData(prev => ({ ...prev, customStatus: e.target.value }))}
                                label="Status Lainnya"
                                placeholder="Ketik status manual..."
                                required
                            />
                        </div>
                    )}

                    {processOrderData.status === "DIAMBIL" && (
                        <div style={{ marginBottom: "16px" }}>
                            <Select
                                labelPosition="left"
                                labelWidth={130}
                                name="user_id"
                                label="Operator"
                                value={processOrderData.user_id}
                                onChange={(e) => setProcessOrderData(prev => ({ ...prev, user_id: e.target.value }))}
                                options={operatorOptions}
                                placeholder="Pilih Operator"
                                required
                            />
                        </div>
                    )}

                    <Button
                        type="submit"
                        size="full-lg"
                        variant="primary"
                        icon={<Icon name="save" />}
                        disabled={!processOrderData.status}
                    >
                        Update Proses
                    </Button>
                </Form>
            </Modal>

            <ChangeFolderIconModal
                open={folder.iconModalOpen}
                onClose={folder.closeIconModal}
                orderInfo={folder.iconModalOrder}
                folderPath={folder.folderIconTarget}
                found={folder.folderIconFound}
                searching={folder.searchingFolder}
                applying={folder.applyingIcon}
                onPilihManual={folder.handlePilihFolderManual}
                onTerapkan={folder.handleTerapkanIcon}
            />
        </>
    );
}