import Modal from "../Modal/Modal";
import "./ShortcutHelp.css";

const SHORTCUT_GROUPS = [
    {
        title: "Global",
        items: [
            { keys: "F1", desc: "Buka panduan shortcut" },
            { keys: "Ctrl + T", desc: "Membuat tab baru" },
            { keys: "Ctrl + Tab", desc: "Beralih ke tab berikutnya" },
            { keys: "Ctrl + Shift + Tab", desc: "Beralih ke tab sebelumnya" },
            { keys: "Ctrl + W", desc: "Tutup tab saat ini" },
            { keys: "Ctrl + R", desc: "Refresh tab saat ini" },
        ],
    },
    {
        title: "Halaman Daftar Order",
        items: [
            { keys: "Ctrl + N", desc: "Membuat order baru" }
        ],
    },
    {
        title: "Menu Filter",
        items: [
            { keys: "Ctrl + K", desc: "Auto Focus Search" }
        ],
    },
    {
        title: "Navigasi Form Order",
        items: [
            { keys: "Ctrl + B", desc: "Kembali ke daftar order" },
            { keys: "Alt + 1 ... Alt + 0", desc: "Pilih baris item ke-1 sampai ke-10 di tabel" },
            { keys: "Alt + Delete", desc: "Hapus item yang sedang terpilih (atau yang sedang diedit di form)" },
            { keys: "Alt + M", desc: "Buka Maklun untuk item yang sedang terpilih" },
        ],
    },
    {
        title: "Form Item",
        items: [
            { keys: "Alt + K", desc: "Fokus & buka pilihan Kategori" },
            { keys: "Alt + P", desc: "Fokus & buka pilihan Produk" },
            { keys: "Alt + D", desc: "Fokus ke field Diskon" },
            { keys: "Ctrl + Enter", desc: "Simpan / Update item" },
            { keys: "Escape", desc: "Batalkan mode edit item" },
        ],
    },
    {
        title: "Dropdown (Kategori, Produk, dll)",
        items: [
            { keys: "↓ / ↑", desc: "Buka dropdown & navigasi opsi" },
            { keys: "Enter", desc: "Pilih opsi yang sedang disorot" },
            { keys: "Ketik huruf", desc: "Lompat ke opsi yang cocok (bisa ketik cepat 2+ huruf)" },
            { keys: "Escape", desc: "Tutup dropdown" },
        ],
    },
    {
        title: "Finishing",
        items: [
            { keys: "1 - 9, 0", desc: "Toggle centang finishing sesuai nomor urut" },
            { keys: "← → / ↑ ↓", desc: "Pindah antar checkbox finishing" },
        ],
    },
];

export default function ShortcutHelp({ open, onClose }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Panduan Keyboard Shortcut"
            size="md"
            headerColor="info"
        >
            <div className="shortcut-help">
                {SHORTCUT_GROUPS.map((group) => (
                    <div key={group.title} className="shortcut-help-group">
                        <h4 className="shortcut-help-group-title">{group.title}</h4>
                        <div className="shortcut-help-list">
                            {group.items.map((item) => (
                                <div key={item.keys} className="shortcut-help-row">
                                    <kbd className="shortcut-help-keys">{item.keys}</kbd>
                                    <span className="shortcut-help-desc">{item.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}