const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    version: () => "1.0.0",
    bacaFile: () => ipcRenderer.invoke('baca-file'),
    tulisFile: (data) => ipcRenderer.invoke('tulis-file', data),

    analisisFolderOrder: (folderPath) => ipcRenderer.invoke('analisis-folder-order', folderPath),
    buatFolderOrder: (folderPath) => ipcRenderer.invoke('buat-folder-order', folderPath),
    pindahFileKeFolder: (data) => ipcRenderer.invoke('pindah-file-ke-folder', data),
    setIconFolderOrder: (data) => ipcRenderer.invoke('set-icon-folder-order', data),
    pilihFolder: () => ipcRenderer.invoke('pilih-folder'),
    cekFolderOrder: (folderPath) => ipcRenderer.invoke('cek-folder-order', folderPath),
    cariFolderOrder: (data) => ipcRenderer.invoke('cari-folder-order', data),
    getPathForFile: (file) => webUtils.getPathForFile(file),

    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
});
