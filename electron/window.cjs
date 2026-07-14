const { BrowserWindow, app } = require("electron");
const path = require("node:path");
const express = require("express");
const http = require("node:http");
const FIXED_PORT = 51730;

function startStaticServer(distPath) {
    return new Promise((resolve, reject) => {
        const server = express();
        server.use(express.static(distPath));
        server.use((req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });

        const httpServer = http.createServer(server);
        httpServer.listen(FIXED_PORT, "127.0.0.1", () => {
            resolve(FIXED_PORT);
        });
        httpServer.on("error", reject);
    });
}

module.exports = async function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        icon: path.join(__dirname, '../src/assets/mgo.ico'),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (app.isPackaged) {
        const distPath = path.join(__dirname, "../dist");
        const port = await startStaticServer(distPath);
        win.loadURL(`http://localhost:${port}`);
    } else {
        win.loadURL("http://localhost:5173");
    }
};