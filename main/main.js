const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const fs   = require("fs");
const { autoUpdater } = require("electron-updater");

// Capturar errores no manejados
process.on("uncaughtException", (err) => {
  dialog.showErrorBox("Error inesperado", err?.message || String(err));
  app.quit();
});

async function resolveDbPath() {
  const userDir     = app.getPath("userData");
  const pointerFile = path.join(userDir, "db-path.json");
  fs.mkdirSync(userDir, { recursive: true });

  if (fs.existsSync(pointerFile)) {
    try {
      const { dbPath } = JSON.parse(fs.readFileSync(pointerFile, "utf8"));
      if (dbPath && fs.existsSync(dbPath)) return dbPath;
    } catch { /* corrupto, pedimos de nuevo */ }
  }

  const { response } = await dialog.showMessageBox({
    type:      "question",
    title:     "KAIA — Base de datos",
    message:   "¿Cómo querés configurar la base de datos?",
    detail:    "Si ya tenés una base de datos en otra PC, seleccionala.\nSi es la primera vez, creá una nueva.",
    buttons:   ["Seleccionar existente", "Crear nueva"],
    defaultId: 0,
    cancelId:  1,
  });

  let dbPath;

  if (response === 0) {
    const result = await dialog.showOpenDialog({
      title:      "Seleccioná la base de datos",
      filters:    [{ name: "SQLite Database", extensions: ["db","sqlite","sqlite3"] }],
      properties: ["openFile"],
    });
    if (result.canceled || !result.filePaths?.[0])
      throw new Error("No se seleccionó ninguna base de datos.");
    dbPath = result.filePaths[0];
  } else {
    dbPath = path.join(userDir, "invierno26.db");
  }

  fs.writeFileSync(pointerFile, JSON.stringify({ dbPath }), "utf8");
  return dbPath;
}

let win;

async function createWindow() {
  // 1) Resolver DB primero — antes de crear la ventana
  const dbPath = await resolveDbPath();
  const dbDir  = path.dirname(dbPath);

  // 2) Inicializar DB
  const { initDb }              = require("./db");
  const { registerIpcHandlers } = require("./ipc");

  await initDb(dbPath);
  registerIpcHandlers(dbDir);

  // 3) Crear ventana
  win = new BrowserWindow({
    width:  1280,
    height: 860,
    show:   false, // no mostrar hasta que cargue
    webPreferences: {
      preload:          path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  // Mostrar cuando esté listo para evitar pantalla blanca
  win.once("ready-to-show", () => win.show());

  // Capturar errores del renderer
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    dialog.showErrorBox("Error cargando la app", `${desc}\n${url}`);
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.join(__dirname, "..", "renderer", "dist", "index.html");
    if (!fs.existsSync(indexPath)) {
      throw new Error(`No se encontró el archivo: ${indexPath}`);
    }
    await win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow()
    .then(() => setupAutoUpdater())
    .catch((err) => {
      dialog.showErrorBox("Error al iniciar", err?.message || String(err));
      app.quit();
    });
});

app.on("window-all-closed", () => {
  try { require("./db").closeDb(); } catch (_) {}
  if (process.platform !== "darwin") app.quit();
});

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", () => {
    dialog.showMessageBox(win, {
      type: "info",
      title: "Actualización disponible",
      message: "Hay una nueva versión disponible. Se descargará en segundo plano.",
    });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog.showMessageBox(win, {
      type: "info",
      title: "Actualización lista",
      message: "La actualización fue descargada. La app se reiniciará para instalarla.",
      buttons: ["Reiniciar ahora", "Más tarde"],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("AutoUpdater error:", err);
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(() => {});
});