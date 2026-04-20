const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  switchDb:         (payload) => ipcRenderer.invoke("db:switch",           payload),
  listMarcas:       ()        => ipcRenderer.invoke("marcas:list"),
  createMarca:      (payload) => ipcRenderer.invoke("marcas:create",       payload),
  listTipos:        ()        => ipcRenderer.invoke("tipos:list"),
  createTipo:       (payload) => ipcRenderer.invoke("tipos:create",        payload),
  listFrames:       ()        => ipcRenderer.invoke("frames:list"),
  createFrame:      (payload) => ipcRenderer.invoke("frames:create",       payload),
  updateFrame:      (payload) => ipcRenderer.invoke("frames:update",       payload),
  updateFrameStock: (payload) => ipcRenderer.invoke("frames:updateStock",  payload),
  deleteFrame:      (payload) => ipcRenderer.invoke("frames:delete",       payload),
  listVentas:       ()        => ipcRenderer.invoke("ventas:list"),
  createVenta:      (payload) => ipcRenderer.invoke("ventas:create",       payload),
  deleteVenta:      (payload) => ipcRenderer.invoke("ventas:delete",       payload),
});