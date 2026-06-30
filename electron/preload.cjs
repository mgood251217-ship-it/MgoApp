const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    version: () => "1.0.0"
});