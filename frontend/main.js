const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
    const window = new BrowserWindow({
        width: 1000,
        height: 800
    });

    window.loadFile(path.join(__dirname, "public", "login.html"));
}

app.whenReady().then(() => {
    createWindow();
});