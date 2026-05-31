console.log("Starting minimal test...");

const electron = require("electron");
console.log("Electron loaded:", typeof electron);
console.log("Has app?:", !!electron.app);

const { app, BrowserWindow } = electron;
console.log("app:", typeof app);
console.log("BrowserWindow:", typeof BrowserWindow);

if (app) {
  app.whenReady().then(() => {
    console.log("App is ready!");
    const win = new BrowserWindow({ width: 800, height: 600 });
    win.loadURL("http://localhost:5173");
  });
} else {
  console.error("APP IS UNDEFINED!");
  process.exit(1);
}
