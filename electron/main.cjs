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
    selesai: path.join(ICON_BASE, "folder-selesai.ico"),
    proses: path.join(ICON_BASE, "folder-proses.ico"),
    cancel: path.join(ICON_BASE, "folder-cancel.ico"),
};

async function getFileMeta(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const rasterExt = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".psd"];
    const isPdf = ext === ".pdf";

    const empty = { colorMode: "unknown", widthPx: null, heightPx: null, dpi: null, dpiDetected: false, panjangM: null, lebarM: null };

    if (!rasterExt.includes(ext) && !isPdf) return empty;

    try {
        const metadata = await sharp(filePath).metadata();

        let colorMode = "unknown";
        if (metadata.space === "cmyk") colorMode = "CMYK";
        else if (metadata.space === "srgb" || metadata.space === "rgb") colorMode = "RGB";
        else if (metadata.space === "b-w" || metadata.space === "grey16" || metadata.space === "grey") colorMode = "Grayscale";
        else if (metadata.channels === 4) colorMode = "CMYK";
        else if (metadata.channels === 3) colorMode = "RGB";
        else if (metadata.channels === 1) colorMode = "Grayscale";
        else if (metadata.space) colorMode = metadata.space;

        const widthPx = metadata.width || null;
        const heightPx = metadata.height || null;

        const dpiDetected = !!metadata.density;
        let dpi = metadata.density || null;
        if (!dpi) dpi = isPdf ? 72 : 96;

        let panjangM = null;
        let lebarM = null;
        if (widthPx && heightPx && dpi) {
            panjangM = Math.round((widthPx / dpi) * 0.0254 * 100) / 100;
            lebarM = Math.round((heightPx / dpi) * 0.0254 * 100) / 100;
        }

        return { colorMode, widthPx, heightPx, dpi, dpiDetected, panjangM, lebarM };
    } catch (err) {
        return empty;
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

function folderMatchesNomor(entryName, nomorator) {
    const escaped = String(nomorator).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[_\\-\\s])${escaped}$`, "i");
    return re.test(entryName);
}

async function findFolderRecursive(dir, nomorator, depth = 0, maxDepth = 12) {
    if (depth > maxDepth) return null;

    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
        return null;
    }

    for (const entry of entries) {
        if (entry.isDirectory() && folderMatchesNomor(entry.name, nomorator)) {
            return path.join(dir, entry.name);
        }
    }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            const found = await findFolderRecursive(path.join(dir, entry.name), nomorator, depth + 1, maxDepth);
            if (found) return found;
        }
    }

    return null;
}

ipcMain.handle("cari-folder-order", async (event, { basePath, dateSubPath, nomorator }) => {
    try {
        const rootDir = path.join(basePath, dateSubPath || "");
        try {
            await fs.access(rootDir);
        } catch (err) {
            return { found: false, searchedPath: rootDir };
        }

        const foundPath = await findFolderRecursive(rootDir, nomorator);
        return { found: !!foundPath, path: foundPath || null, searchedPath: rootDir };
    } catch (err) {
        return { found: false, message: err.message };
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
    const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".pdf", ".tif", ".tiff"];
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        const hasil = await Promise.all(
            entries
                .filter((entry) => entry.isFile() && ALLOWED_EXT.includes(path.extname(entry.name).toLowerCase()))
                .map(async (entry) => {
                    const fullPath = path.join(folderPath, entry.name);
                    const stat = await fs.stat(fullPath);
                    const meta = await getFileMeta(fullPath);
                    return { nama: entry.name, ukuranByte: stat.size, ...meta };
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
