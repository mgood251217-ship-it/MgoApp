import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../../api/axios";
import Modal from "../Modal/Modal";
import Table from "../Table/Table";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import Select from "../Select/Select";
import Form from "../Form/Form";
import { formatRupiah } from "../../services/helpers";
import { FOLDER_STATUS_LABEL, formatUkuran } from "../../services/folderHelper";
import useOrderFolderStatus from "../../hooks/useOrderFolderStatus";
import ChangeFolderIconModal from "../ChangeFolderIconModal/ChangeFolderIconModal";

export default function OrderDetailModal({ open, onClose, viewOrderDetails, viewOrderData, setAlertConfig }) {
    const folder = useOrderFolderStatus(setAlertConfig);
    const [stores, setStores] = useState([]);

    const [maklunModalOpen, setMaklunModalOpen] = useState(false);
    const [maklunData, setMaklunData] = useState({
        order_item_id: "",
        store_id: ""
    });

    useEffect(() => {
        if (!open) return;
        if (!folder.settingsLoaded) return;
        if (!viewOrderDetails || !viewOrderData?.items) return;
        folder.checkFolders(viewOrderDetails, viewOrderData.items);
    }, [open, folder.settingsLoaded, viewOrderDetails, viewOrderData]);

    const loadStores = useCallback(async () => {
        try {
            const res = await api.get("", { params: { action: "store_names" } });
            setStores(res.data?.data || []);
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
            payload.append("order_item_id", maklunData.order_item_id);
            payload.append("store_id", maklunData.store_id);
            await api.post("", payload, { params: { action: "update_maklun" } });
            setMaklunModalOpen(false);
            setAlertConfig({ type: "success", message: "Maklun berhasil diperbarui" });
            loadStores();
        } catch (err) {
            setAlertConfig({ type: "error", message: "Gagal memperbarui maklun" });
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
                <div style={{ display: "flex", gap: "8px", marginBottom: 16, flexWrap: "nowrap" }}>
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={<Icon name="content_copy" />}
                        style={{ whiteSpace: "nowrap" }}
                        onClick={() => viewOrderDetails && folder.handleCopyFolderName(viewOrderDetails)}
                    >
                        {viewOrderDetails && folder.copyFeedbackId === viewOrderDetails.order_id ? "Tersalin!" : "Salin Nama Folder"}
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
                                        borderRadius: 8,
                                        border: folder.dragOverCat === cat ? "2px dashed var(--primary)" : "1px solid var(--border)"
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                                        <div style={{ fontWeight: "bold" }}>{cat}</div>
                                        {info.status === "ada" ? (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                icon={<Icon name="folder" />}
                                                style={{ whiteSpace: "nowrap" }}
                                                onClick={() => folder.handleOpenIconModalForCategory(cat, info.path, viewOrderDetails)}
                                            >
                                                Ganti Icon
                                            </Button>
                                        ) : (
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
                                        )}
                                    </div>

                                    <div style={{ fontSize: 12, color: "var(--secondary)", marginBottom: 8 }}>
                                        Seret file JPG/PNG/PDF/TIFF ke sini untuk memindahkan ke folder ini.
                                    </div>

                                    {info.status === "tidak-ada" ? (
                                        <div style={{ fontSize: 13, color: "var(--secondary)", wordBreak: "break-all" }}>
                                            Folder belum dibuat. Kalau dibuat, lokasinya: <strong style={{ color: "var(--text)" }}>{info.createPath}</strong>
                                        </div>
                                    ) : isLoading ? (
                                        <div style={{ color: "var(--secondary)", fontSize: 13 }}>Membaca isi folder...</div>
                                    ) : files.length === 0 ? (
                                        <div style={{ color: "var(--secondary)", fontSize: 13 }}>Tidak ada file JPG/PNG/PDF/TIFF di folder ini.</div>
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
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {files.map((f, idx) => (
                                                        <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                                                            <td style={{ padding: "4px 8px", wordBreak: "break-all" }}>{f.nama}</td>
                                                            <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>{formatUkuran(f)}</td>
                                                            <td style={{ padding: "4px 8px" }}>{f.quantity}</td>
                                                            <td style={{ padding: "4px 8px" }}>{f.colorMode}</td>
                                                            <td style={{ padding: "4px 8px" }}>{f.totalLuas != null ? f.totalLuas : "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div style={{ textAlign: "right", marginTop: 8, fontWeight: "bold", fontSize: 13 }}>
                                                Total {cat}: {totalSemua.toFixed(2)} m²
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, padding: "16px", backgroundColor: "var(--bg-content)", borderRadius: "8px", border: "1px solid var(--border)"}}>
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
                        }))} 
                        placeholder="Pilih Store"
                        required
                    />
                    <Button type="submit" size="full-lg" variant="info" icon={<Icon name="save" />}>
                        Simpan Maklun
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