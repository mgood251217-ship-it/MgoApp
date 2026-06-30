import { app, globalShortcut, BrowserWindow } from "electron";
import createWindow from "./window.js";

app.whenReady().then(() => {

    createWindow();

    globalShortcut.register("F12", () => {
        const win = BrowserWindow.getFocusedWindow();

        if (!win) return;

        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools();
        }
    });

    globalShortcut.register("CommandOrControl+Shift+I", () => {

        const win = BrowserWindow.getFocusedWindow();

        if (!win) return;

        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools();
        }

    });

});