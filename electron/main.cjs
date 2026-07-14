const { app, globalShortcut, BrowserWindow, ipcMain, dialog } = require("electron");
const createWindow = require("./window.cjs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");
const sharp = require("sharp");

const execAsync = promisify(exec);

process.on("uncaughtException", (err) => {
    dialog.showErrorBox("Uncaught Exception", err.stack || String(err));
});

process.on("unhandledRejection", (reason) => {
    dialog.showErrorBox("Unhandled Rejection", reason instanceof Error ? (reason.stack || reason.message) : String(reason));
});

function getIconBasePath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, "icons");
    }
    return path.join(__dirname, "../src/assets/icons");
}

const ICON_BASE = getIconBasePath();
const ICONS = {
    selesai: path.join(ICON_BASE, "folder-hijau.ico"),
    proses: path.join(ICON_BASE, "folder-kuning.ico"),
    belum: path.join(ICON_BASE, "folder-merah.ico"),
};

async function getColorMode(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const rasterExt = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".psd"];
    if (!rasterExt.includes(ext)) return "unknown";
    try {
        const metadata = await sharp(filePath).metadata();
        if (metadata.space === "cmyk") return "CMYK";
        if (metadata.space === "srgb" || metadata.space === "rgb") return "RGB";
        return metadata.space || "unknown";
    } catch (err) {
        return "unknown";
    }
}

async function notifyShellUpdate(folderPath) {
    const tempDir = app.getPath("temp");
    const dllPath = path.join(tempDir, "mgo-shell-notify.dll");
    const scriptPath = path.join(tempDir, "mgo-shell-notify.ps1");

    const psScript = `
$dllPath = "${dllPath.replace(/\\/g, "\\\\")}"
if (Test-Path $dllPath) {
    Add-Type -Path $dllPath
} else {
    Add-Type -OutputAssembly $dllPath -OutputType Library -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellNotify {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
}
"@
    Add-Type -Path $dllPath
}
$path = [System.Runtime.InteropServices.Marshal]::StringToHGlobalUni("${folderPath.replace(/'/g, "''")}")
[ShellNotify]::SHChangeNotify(0x2000, 0x0005, $path, [IntPtr]::Zero)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($path)
`;
    await fs.writeFile(scriptPath, psScript, "utf-8");
    await execAsync(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`);
}

ipcMain.handle("pilih-folder", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle("cek-folder-order", async (event, folderPath) => {
    try {
        await fs.access(folderPath);
        return { exists: true };
    } catch (err) {
        return { exists: false };
    }
});

const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");

async function readSettings() {
    try {
        const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        return {};
    }
}

ipcMain.handle("get-settings", async () => {
    return await readSettings();
});

ipcMain.handle("save-settings", async (event, newSettings) => {
    try {
        const current = await readSettings();
        const merged = { ...current, ...newSettings };
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf-8");
        return { success: true, data: merged };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

ipcMain.handle("analisis-folder-order", async (event, folderPath) => {
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const hasil = await Promise.all(
            entries.filter((entry) => entry.isFile()).map(async (entry) => {
                const fullPath = path.join(folderPath, entry.name);
                const stat = await fs.stat(fullPath);
                const colorMode = await getColorMode(fullPath);
                return { nama: entry.name, ukuran: stat.size, colorMode };
            })
        );
        return { success: true, data: hasil };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

ipcMain.handle("set-icon-folder-order", async (event, { folderPath, status }) => {
    if (process.platform !== "win32") {
        return { success: false, message: "Fitur ini hanya didukung di Windows." };
    }
    const iconPath = ICONS[status];
    if (!iconPath) {
        return { success: false, message: `Status '${status}' tidak dikenal.` };
    }
    const desktopIniPath = path.join(folderPath, "desktop.ini");
    const content =
        `[.ShellClassInfo]\r\n` +
        `IconResource=${iconPath},0\r\n` +
        `[ViewState]\r\n` +
        `Mode=\r\n` +
        `Vid=\r\n` +
        `FolderType=Generic\r\n`;
    try {
        await fs.mkdir(folderPath, { recursive: true });
        await execAsync(`attrib -r -s -h "${folderPath}"`).catch(() => {});
        await execAsync(`attrib -r -s -h "${desktopIniPath}"`).catch(() => {});
        await fs.writeFile(desktopIniPath, content, "utf-8");
        await execAsync(`attrib +h +s "${desktopIniPath}"`);
        await execAsync(`attrib +r "${folderPath}"`);
        await notifyShellUpdate(folderPath);
        return { success: true };
    } catch (err) {
        return { success: false, message: err.message };
    }
});

app.whenReady().then(async () => {
    await createWindow();

    globalShortcut.register("F12", () => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return;
        win.webContents.isDevToolsOpened() ? win.webContents.closeDevTools() : win.webContents.openDevTools();
    });

    globalShortcut.register("CommandOrControl+Shift+I", () => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return;
        win.webContents.isDevToolsOpened() ? win.webContents.closeDevTools() : win.webContents.openDevTools();
    });
}).catch((err) => {
    dialog.showErrorBox("Gagal menjalankan aplikasi", err.stack || String(err));
});
