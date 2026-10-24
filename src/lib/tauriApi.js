import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";

export const tauriApi = {
    version: () => "2.0.8",

    analisisFolderOrder: (folderPath) => invoke("analisis_folder_order", { folderPath }),
    buatFolderOrder: (args) => invoke("buat_folder_order", { args }),
    pindahFileKeFolder: (args) => invoke("pindah_file_ke_folder", { args }),
    renameFileOrder: (args) => invoke("rename_file_order", { args }),
    deleteFileOrder: (filePath) => invoke("delete_file_order", { filePath }),
    setIconFolderOrder: (args) => invoke("set_icon_folder_order", args),
    cekFolderOrder: (folderPath) => invoke("cek_folder_order", { folderPath }),
    cariFolderOrder: (args) => invoke("cari_folder_order", { args }),
    openFolder: (folderPath) => invoke("buka_folder", { folderPath }),

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
    inspectFolderProtection: () => invoke("inspect_folder_protection"),
    activateFolderProtection: (path, label) => invoke("activate_folder_protection", { path, label }),
    planFolderProtection: (path) => invoke("plan_folder_protection", { path }),
    verifyFolderProtection: (rootId = null) => invoke("verify_folder_protection", { rootId }),
    saveSettings: (newSettings) => invoke("save_settings", { newSettings }),
    restartApp: () => invoke("restart_app"),

    savePdfData: (args) => invoke("save_pdf_data", { args }),
    simpanTempFile: (args) => invoke("simpan_temp_file", { args }),

    simpanFile: async (blob, defaultFileName, filters = null) => {
        const path = await save({
            defaultPath: defaultFileName,
            filters: filters?.map(([name, extensions]) => ({ name, extensions })),
        });

        if (!path) {
            return { success: false, cancelled: true };
        }

        const arrayBuffer = await blob.arrayBuffer();
        return invoke("save_file_at_path", { filePath: path, data: Array.from(new Uint8Array(arrayBuffer)) });
    },

    cetakStruk: () => invoke("print_window"),
};

if (typeof window !== "undefined") {
    window.electron = tauriApi;
}
