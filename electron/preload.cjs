const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    version: () => "1.0.0",
    bacaFile: () => ipcRenderer.invoke('baca-file'),
    tulisFile: (data) => ipcRenderer.invoke('tulis-file', data),

    analisisFolderOrder: (folderPath) => ipcRenderer.invoke('analisis-folder-order', folderPath),
    setIconFolderOrder: (data) => ipcRenderer.invoke('set-icon-folder-order', data),
    pilihFolder: () => ipcRenderer.invoke('pilih-folder'),
    cekFolderOrder: (folderPath) => ipcRenderer.invoke('cek-folder-order', folderPath),
    cariFolderOrder: (data) => ipcRenderer.invoke('cari-folder-order', data),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
});
