const { contextBridge, ipcRenderer  } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    version: () => "1.0.0",
    bacaFile: () => ipcRenderer.invoke('baca-file'),
    tulisFile: (data) => ipcRenderer.invoke('tulis-file', data)
});