const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  switchDb:         (payload) => ipcRenderer.invoke("db:switch",           payload),
  clearAll:         ()        => ipcRenderer.invoke("db:clearAll"),
  listMarcas:       ()        => ipcRenderer.invoke("marcas:list"),
  createMarca:      (payload) => ipcRenderer.invoke("marcas:create",       payload),
  listTipos:        ()        => ipcRenderer.invoke("tipos:list"),
  createTipo:       (payload) => ipcRenderer.invoke("tipos:create",        payload),

  // ── Modelo viejo (compatibilidad) ──
  listFrames:       ()        => ipcRenderer.invoke("frames:list"),
  getFrameByBarcode:(payload) => ipcRenderer.invoke("frames:getByBarcode", payload),
  createFrame:      (payload) => ipcRenderer.invoke("frames:create",       payload),
  updateFrame:      (payload) => ipcRenderer.invoke("frames:update",       payload),
  updateFrameStock: (payload) => ipcRenderer.invoke("frames:updateStock",  payload),
  deleteFrame:      (payload) => ipcRenderer.invoke("frames:delete",       payload),

  // ── Nuevo modelo: Producto + Barcodes ──
  createProducto:         (payload) => ipcRenderer.invoke("producto:create",           payload),
  listProductosWithBarcodes: (payload) => ipcRenderer.invoke("producto:listWithBarcodes", payload),
  updateProducto:         (payload) => ipcRenderer.invoke("producto:update",           payload),
  deleteProducto:         (payload) => ipcRenderer.invoke("producto:delete",           payload),

  getBarcodeByCode:       (payload) => ipcRenderer.invoke("barcode:getByCode",        payload),
  addOrIncrementBarcode:  (payload) => ipcRenderer.invoke("barcode:addOrIncrement",   payload),
  listBarcodesByProducto: (payload) => ipcRenderer.invoke("barcode:listByProducto",   payload),
  updateBarcode:          (payload) => ipcRenderer.invoke("barcode:update",           payload),
  updateBarcodeCantidad:  (payload) => ipcRenderer.invoke("barcode:updateCantidad",   payload),
  deleteBarcode:          (payload) => ipcRenderer.invoke("barcode:delete",           payload),

  // ── Lotes de Venta ──
  createLote:       ()        => ipcRenderer.invoke("lote:create"),
  getLoteAbierto:   ()        => ipcRenderer.invoke("lote:getAbierto"),
  getLoteById:      (payload) => ipcRenderer.invoke("lote:getById",        payload),
  addVentaLote:     (payload) => ipcRenderer.invoke("lote:addVenta",       payload),
  removeVentaLote:  (payload) => ipcRenderer.invoke("lote:removeVenta",    payload),
  updateCliente:    (payload) => ipcRenderer.invoke("lote:updateCliente",  payload),
  updateMetodoPago: (payload) => ipcRenderer.invoke("lote:updateMetodoPago", payload),
  updatePrecioVenta:(payload) => ipcRenderer.invoke("venta:updatePrecio",  payload),
  closeLote:        (payload) => ipcRenderer.invoke("lote:close",          payload),
  deleteLote:       (payload) => ipcRenderer.invoke("lote:delete",         payload),
  listLotes:        ()        => ipcRenderer.invoke("lote:list"),

  // ── Ventas ──
  listVentas:       ()        => ipcRenderer.invoke("ventas:list"),
  createVenta:      (payload) => ipcRenderer.invoke("ventas:create",       payload),
  deleteVenta:      (payload) => ipcRenderer.invoke("ventas:delete",       payload),
});