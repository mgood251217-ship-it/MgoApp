import Modal from "../Modal/Modal";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";

export default function ChangeFolderIconModal({ open, onClose, orderInfo, folderPath, found, searching, applying, onPilihManual, onTerapkan }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Ganti Icon Folder - ${orderInfo?.kategori || ""} - ${orderInfo?.nomorator || ""}`}
            size="sm"
            headerColor="secondary"
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {searching ? (
                    <div style={{ fontSize: "13px", color: "var(--secondary)" }}>
                        🔍 Mencari folder di dalam struktur tanggal order...
                    </div>
                ) : (
                    <div style={{ fontSize: "13px", color: "var(--secondary)", wordBreak: "break-all" }}>
                        {found ? "✅ Folder ditemukan:" : "⚠️ Belum ditemukan, akan dibuat baru di:"}{" "}
                        <strong style={{ color: "var(--text)" }}>{folderPath}</strong>
                    </div>
                )}
                <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="folder_open" />}
                    style={{ whiteSpace: "nowrap" }}
                    disabled={searching}
                    onClick={onPilihManual}
                >
                    Pilih Folder Manual (kalau path di atas salah)
                </Button>
                <div style={{ fontSize: "14px", fontWeight: "bold" }}>Pilih status order:</div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <Button size="md" variant="success" disabled={applying || searching} icon={<Icon name="folder" />} onClick={() => onTerapkan("selesai")}>
                        Selesai
                    </Button>
                    <Button size="md" variant="primary" disabled={applying || searching} icon={<Icon name="folder" />} onClick={() => onTerapkan("proses")}>
                        Proses
                    </Button>
                    <Button size="md" variant="danger" disabled={applying || searching} icon={<Icon name="folder" />} onClick={() => onTerapkan("cancel")}>
                        Batal
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
