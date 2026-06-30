import { BrowserWindow, app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (app.isPackaged) {
        win.loadFile(path.join(__dirname, "../dist/index.html"));
    } else {
        win.loadURL("http://localhost:5173");
        // win.webContents.openDevTools();
    }
}