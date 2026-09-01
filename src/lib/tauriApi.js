
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(",")[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export const tauriApi = {
    version: () => "1.0.8",

    analisisFolderOrder: (folderPath) => invoke("analisis_folder_order", { folderPath }),
    buatFolderOrder: (args) => invoke("buat_folder_order", { args }),
    pindahFileKeFolder: (args) => invoke("pindah_file_ke_folder", { args }),
    renameFileOrder: (args) => invoke("rename_file_order", { args }),
    deleteFileOrder: (filePath) => invoke("delete_file_order", { filePath }),
    setIconFolderOrder: (args) => invoke("set_icon_folder_order", args),
    cekFolderOrder: (folderPath) => invoke("cek_folder_order", { folderPath }),
    cariFolderOrder: (args) => invoke("cari_folder_order", { args }),

    pilihFolder: () => invoke("pilih_folder"),
    pilihFileOrder: () => invoke("pilih_file_order"),
    bukaLinkEksternal: (url) => invoke("buka_link_eksternal", { url }),

    downloadUpdate: (url) => invoke("download_update", { url }),
    jalankanInstaller: (filePath) => invoke("jalankan_installer", { filePath }),
    onDownloadProgress: (callback) => {
        let unlisten = () => {};
        listen("download-update-progress", (event) => callback(event.payload)).then((fn) => {
            unlisten = fn;
        });
        return () => unlisten();
    },

    getSettings: () => invoke("get_settings"),
    saveSettings: (newSettings) => invoke("save_settings", { newSettings }),
    restartApp: () => invoke("restart_app"),

    savePdfData: (args) => invoke("save_pdf_data", { args }),

    simpanFile: async (blob, defaultFileName, filters = null) => {
        const base64Data = await blobToBase64(blob);
        return invoke("simpan_file_dialog", {
            args: { base64Data, defaultFileName, filters },
        });
    },

};

if (typeof window !== "undefined") {
    window.electron = tauriApi;
}
