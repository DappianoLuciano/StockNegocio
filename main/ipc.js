console.log("🔧 ipc.js SE ESTÁ CARGANDO...");
const { ipcMain } = require("electron");
const { getDb, switchDb, persist, getCurrentDbPath } = require("./db");
const path = require("path");
console.log("🔧 ipc.js CARGADO EXITOSAMENTE");

function all(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();

  // Persistir cambios
  persist();

  // Obtener el último ID insertado usando una forma más robusta
  let lastId = null;
  try {
    const idStmt = db.prepare("SELECT last_insert_rowid() as id");
    if (idStmt.step()) {
      lastId = idStmt.getAsObject().id;
    }
    idStmt.free();
  } catch (e) {
    console.error("Error obteniendo lastInsertRowid:", e);
  }

  console.log("💾 [RUN] SQL ejecutado, lastInsertRowid:", lastId);
  return { lastInsertRowid: lastId };
}

function calcStockFromTalleStock(talleStockStr) {
  try {
    const obj = JSON.parse(talleStockStr || "{}");
    return Object.values(obj).reduce((sum, n) => sum + Math.max(0, Math.floor(Number(n) || 0)), 0);
  } catch { return 0; }
}

function normalizeFloat(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? NaN : n;
}

function normalizeCodigo(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function normalizeTalles(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(",");
  return String(v ?? "").trim();
}

function normalizeTalleStock(v) {
  if (!v || typeof v !== "object") return "{}";
  try { return JSON.stringify(v); } catch { return "{}"; }
}

function normalizeColores(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(",");
  return String(v ?? "").trim();
}

function getIdFromPayload(p) {
  return p?.productoId ?? p?.armazonId ?? p?.id;
}

let dbDir = null;

function registerIpcHandlers(dir) {
  dbDir = dir;

  // ── TEMPORADAS ─────────────────────────────────────────────────
  // Ya no se cambia de DB, solo se usa una única base de datos
  ipcMain.handle("db:switch", async (_e, { season }) => {
    // Mantener handler por compatibilidad pero no hace nada
    console.log("ℹ️ [DB:SWITCH] Ya no se cambia de DB, usando DB única. Temporada seleccionada:", season);
    return { ok: true, season };
  });

  // ── MARCAS ─────────────────────────────────────────────────────
  ipcMain.handle("marcas:list", async () => {
    return all("SELECT * FROM Marca ORDER BY nombre ASC");
  });

  ipcMain.handle("marcas:create", async (_e, payload) => {
    const nombre = String(payload?.nombre ?? "").trim();
    if (!nombre) throw new Error("Nombre de marca obligatorio");
    try {
      const r = run("INSERT INTO Marca (nombre) VALUES (?)", [nombre]);
      return get("SELECT * FROM Marca WHERE id = ?", [r.lastInsertRowid]);
    } catch (err) {
      if (String(err?.message || "").toLowerCase().includes("unique"))
        throw new Error("Ya existe una marca con ese nombre");
      throw err;
    }
  });

  // ── TIPOS ──────────────────────────────────────────────────────
  ipcMain.handle("tipos:list", async () => {
    return all("SELECT * FROM TipoPrenda ORDER BY nombre ASC");
  });

  ipcMain.handle("tipos:create", async (_e, payload) => {
    const nombre = String(payload?.nombre ?? "").trim();
    const curva  = ["letras","numericos","none"].includes(payload?.curva) ? payload.curva : "none";
    if (!nombre) throw new Error("Nombre de tipo obligatorio");
    try {
      const r = run("INSERT INTO TipoPrenda (nombre, curva) VALUES (?, ?)", [nombre, curva]);
      return get("SELECT * FROM TipoPrenda WHERE id = ?", [r.lastInsertRowid]);
    } catch (err) {
      if (String(err?.message || "").toLowerCase().includes("unique"))
        throw new Error("Ya existe un tipo con ese nombre");
      throw err;
    }
  });

  // ── PRODUCTOS ──────────────────────────────────────────────────
  ipcMain.handle("frames:list", async () => {
    return all("SELECT * FROM Producto WHERE deletedAt IS NULL ORDER BY createdAt DESC");
  });

  ipcMain.handle("frames:getByBarcode", async (_e, { barcode }) => {
    console.log("🔍 [IPC] Buscando barcode:", barcode);
    if (!barcode) throw new Error("Código de barras requerido");
    const producto = get("SELECT * FROM Producto WHERE barcode = ? AND deletedAt IS NULL", [String(barcode).trim()]);
    console.log("🔍 [IPC] Resultado:", producto);
    return producto || null;
  });

  ipcMain.handle("frames:create", async (_e, payload) => {
    console.log("💾 [IPC] Recibido payload:", payload);
    const marca       = String(payload?.marca ?? "").trim();
    const tipo        = String(payload?.tipo  ?? "").trim();
    const codigo      = normalizeCodigo(payload?.codigo);
    const barcodeInput = payload?.barcode ? String(payload.barcode).trim() : null;
    console.log("💾 [IPC] Barcode input:", barcodeInput);
    const costo       = normalizeFloat(payload?.costo);
    const precioFinal = normalizeFloat(payload?.precioFinal);
    const talles      = normalizeTalles(payload?.talles);
    const talleStock  = normalizeTalleStock(payload?.talleStock);
    const colores     = normalizeColores(payload?.colores);

    if (!marca) throw new Error("Marca obligatoria");
    if (!tipo)  throw new Error("Tipo de prenda obligatorio");
    if (costo !== null && Number.isNaN(costo)) throw new Error("Costo inválido");
    if (precioFinal !== null && Number.isNaN(precioFinal)) throw new Error("Precio final inválido");
    if (costo !== null && costo < 0) throw new Error("El costo no puede ser negativo");
    if (precioFinal !== null && precioFinal < 0) throw new Error("El precio final no puede ser negativo");

    const tsObj = JSON.parse(talleStock);
    const stock = Object.keys(tsObj).length > 0
      ? calcStockFromTalleStock(talleStock)
      : Math.max(0, Math.floor(Number(payload?.stock) || 0));

    try {
      // Generar un barcode temporal único si no se proporciona uno
      const tempBarcode = barcodeInput || `TEMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log("💾 [IPC] Usando barcode temporal:", tempBarcode);

      // Insertar producto CON barcode temporal
      const r = run(
        `INSERT INTO Producto (marca,tipo,codigo,barcode,costo,precioFinal,stock,stockInicial,talles,talleStock,colores,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
        [marca, tipo, codigo, tempBarcode, costo, precioFinal, stock, stock, talles, talleStock, colores]
      );

      const newId = r.lastInsertRowid;
      console.log("💾 [IPC] Producto creado con ID:", newId);

      // Si era temporal, reemplazar con barcode basado en ID
      if (!barcodeInput) {
        const barcode = String(newId).padStart(7, '0');
        console.log("💾 [IPC] Actualizando barcode temporal a:", barcode);
        run("UPDATE Producto SET barcode = ? WHERE id = ?", [barcode, newId]);
      }

      const result = get("SELECT * FROM Producto WHERE id = ?", [newId]);
      console.log("✅ [IPC] Producto guardado:", result);
      return result;
    } catch (err) {
      console.error("❌ [IPC] Error creando producto:", err);
      const errMsg = String(err?.message || "").toLowerCase();
      if (errMsg.includes("unique")) {
        if (errMsg.includes("barcode") || errMsg.includes("idx_producto_barcode")) {
          throw new Error("Ya existe un producto con ese código de barras");
        } else if (errMsg.includes("codigo")) {
          throw new Error("Ya existe un producto con ese código de modelo");
        }
        throw new Error("Ya existe un producto con ese código o código de barras");
      }
      throw err;
    }
  });

  ipcMain.handle("frames:update", async (_e, payload) => {
    const id = getIdFromPayload(payload);
    if (!id) throw new Error("ID inválido");

    const marca       = String(payload?.marca ?? "").trim();
    const tipo        = String(payload?.tipo  ?? "").trim();
    const codigo      = normalizeCodigo(payload?.codigo);
    const barcode     = payload?.barcode ? String(payload.barcode).trim() : undefined;
    const costo       = normalizeFloat(payload?.costo);
    const precioFinal = normalizeFloat(payload?.precioFinal);
    const talles      = normalizeTalles(payload?.talles);
    const talleStock  = normalizeTalleStock(payload?.talleStock);
    const colores     = normalizeColores(payload?.colores);

    if (!marca) throw new Error("Marca obligatoria");
    if (!tipo)  throw new Error("Tipo de prenda obligatorio");
    if (costo !== null && Number.isNaN(costo)) throw new Error("Costo inválido");
    if (precioFinal !== null && Number.isNaN(precioFinal)) throw new Error("Precio final inválido");
    if (costo !== null && costo < 0) throw new Error("El costo no puede ser negativo");
    if (precioFinal !== null && precioFinal < 0) throw new Error("El precio final no puede ser negativo");

    const tsObj = JSON.parse(talleStock);
    const stockCalc = Object.keys(tsObj).length > 0 ? calcStockFromTalleStock(talleStock) : null;

    const stockSql = stockCalc !== null ? ", stock = ?" : "";
    const barcodeSql = barcode !== undefined ? ", barcode = ?" : "";
    const params = [marca, tipo, codigo, costo, precioFinal, talles, talleStock, colores];
    if (stockCalc !== null) params.push(stockCalc);
    if (barcode !== undefined) params.push(barcode);
    params.push(Number(id));

    try {
      run(
        `UPDATE Producto SET marca=?,tipo=?,codigo=?,costo=?,precioFinal=?,talles=?,talleStock=?,colores=?,updatedAt=datetime('now')${stockSql}${barcodeSql} WHERE id=?`,
        params
      );
      return get("SELECT * FROM Producto WHERE id = ?", [Number(id)]);
    } catch (err) {
      if (String(err?.message || "").toLowerCase().includes("unique"))
        throw new Error("Ya existe un producto con ese código o código de barras");
      throw err;
    }
  });

  ipcMain.handle("frames:updateStock", async (_e, payload) => {
    const id    = getIdFromPayload(payload);
    const delta = Number(payload?.delta ?? 0);
    const talle = payload?.talle ?? null;

    if (!id) throw new Error("ID inválido");
    if (!Number.isFinite(delta)) throw new Error("Delta inválido");

    const row = get("SELECT * FROM Producto WHERE id = ? AND deletedAt IS NULL", [Number(id)]);
    if (!row) throw new Error("Producto no encontrado");

    if (talle) {
      let tsObj = {};
      try { tsObj = JSON.parse(row.talleStock || "{}"); } catch { tsObj = {}; }
      tsObj[talle] = Math.max(0, (Number(tsObj[talle]) || 0) + Math.trunc(delta));
      const newStock = Object.values(tsObj).reduce((s, n) => s + Math.max(0, n), 0);
      run(
        `UPDATE Producto SET talleStock=?, stock=?, updatedAt=datetime('now') WHERE id=?`,
        [JSON.stringify(tsObj), newStock, Number(id)]
      );
    } else {
      const newStock = Math.max(0, (row.stock ?? 0) + Math.trunc(delta));
      run(`UPDATE Producto SET stock=?, updatedAt=datetime('now') WHERE id=?`, [newStock, Number(id)]);
    }

    return get("SELECT * FROM Producto WHERE id = ?", [Number(id)]);
  });

  ipcMain.handle("frames:delete", async (_e, payload) => {
    const id = getIdFromPayload(payload);
    if (!id) throw new Error("ID inválido");
    run(`UPDATE Producto SET deletedAt=datetime('now') WHERE id=?`, [Number(id)]);
    return { ok: true };
  });

  // ── LOTES DE VENTA ─────────────────────────────────────────────

  // Crear nuevo lote (ticket de venta)
  ipcMain.handle("lote:create", async () => {
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      console.log("📝 [LOTE:CREATE] Creando nuevo lote con fecha:", fecha);

      // Ver lotes antes de crear
      const lotesBefore = all("SELECT id, estado FROM Lote ORDER BY id DESC LIMIT 5");
      console.log("📝 [LOTE:CREATE] Lotes existentes antes:", lotesBefore);

      const r = run(
        `INSERT INTO Lote (fecha, total, estado, createdAt) VALUES (?, 0, 'abierto', datetime('now'))`,
        [fecha]
      );

      console.log("📝 [LOTE:CREATE] Result de run:", r);
      console.log("📝 [LOTE:CREATE] lastInsertRowid:", r.lastInsertRowid);

      // Ver lotes después de crear
      const lotesAfter = all("SELECT id, estado FROM Lote ORDER BY id DESC LIMIT 5");
      console.log("📝 [LOTE:CREATE] Lotes después de crear:", lotesAfter);

      // Si lastInsertRowid es null, intentar obtener el último lote abierto
      let loteId = r.lastInsertRowid;
      if (!loteId) {
        console.warn("📝 [LOTE:CREATE] lastInsertRowid es null, buscando último lote...");
        const ultimoLote = get("SELECT id FROM Lote ORDER BY id DESC LIMIT 1");
        loteId = ultimoLote?.id;
        console.log("📝 [LOTE:CREATE] Último lote encontrado ID:", loteId);
      }

      if (!loteId) {
        throw new Error("No se pudo obtener el ID del lote creado");
      }

      const lote = get("SELECT * FROM Lote WHERE id = ?", [loteId]);
      console.log("📝 [LOTE:CREATE] Lote recuperado:", lote);

      if (!lote) {
        throw new Error(`Error al recuperar el lote con ID ${loteId}`);
      }

      return lote;
    } catch (err) {
      console.error("❌ [LOTE:CREATE] Error:", err);
      throw err;
    }
  });

  // Obtener lote abierto (si existe) con sus items
  ipcMain.handle("lote:getAbierto", async () => {
    try {
      console.log("🔍 [LOTE:GET_ABIERTO] Buscando lote abierto...");
      const lote = get("SELECT * FROM Lote WHERE estado = 'abierto' ORDER BY createdAt DESC LIMIT 1");
      console.log("🔍 [LOTE:GET_ABIERTO] Resultado:", lote ? `ID ${lote.id}` : "No hay lote abierto");

      if (!lote) return null;

      // Obtener ventas del lote con información completa
      const ventas = all(`
        SELECT v.*,
               pb.barcode, pb.talle, pb.color, pb.cantidad as stockActual,
               p.marca, p.tipo, p.codigo, p.precioFinal
        FROM Venta v
        LEFT JOIN ProductoBarcode pb ON v.barcodeId = pb.id
        LEFT JOIN Producto p ON v.productoId = p.id
        WHERE v.loteId = ?
        ORDER BY v.createdAt ASC
      `, [lote.id]);

      // Transformar ventas para el frontend
      const items = ventas.map(v => ({
        id: v.id,
        loteId: v.loteId,
        barcodeId: v.barcodeId,
        precioVenta: v.precioVenta,
        cantidad: v.cantidad,
        createdAt: v.createdAt,
        barcode: {
          id: v.barcodeId,
          barcode: v.barcode,
          talle: v.talle,
          color: v.color,
          cantidad: v.stockActual,
        },
        producto: {
          id: v.productoId,
          marca: v.marca,
          tipo: v.tipo,
          codigo: v.codigo,
          precioFinal: v.precioFinal,
        },
      }));

      return { ...lote, items };
    } catch (err) {
      console.error("❌ [LOTE:GET_ABIERTO] Error:", err);
      throw err;
    }
  });

  // Obtener lote por ID con sus ventas
  ipcMain.handle("lote:getById", async (_e, { id }) => {
    const lote = get("SELECT * FROM Lote WHERE id = ?", [Number(id)]);
    if (!lote) return null;

    const ventas = all("SELECT * FROM Venta WHERE loteId = ? ORDER BY createdAt ASC", [Number(id)]);
    return { ...lote, ventas };
  });

  // Agregar venta al lote
  ipcMain.handle("lote:addVenta", async (_e, payload) => {
    const loteId      = Number(payload?.loteId);
    const barcodeId   = Number(payload?.barcodeId);
    const cantidad    = Math.max(1, Math.floor(Number(payload?.cantidad) || 1));
    const precioVenta = normalizeFloat(payload?.precioVenta);

    if (!loteId) throw new Error("Lote ID obligatorio");
    if (!barcodeId) throw new Error("Código de barras obligatorio");

    console.log("🛒 [LOTE:ADD_VENTA] Agregando producto, barcodeId:", barcodeId, "cantidad:", cantidad);

    // Verificar que el lote existe y está abierto
    const lote = get("SELECT * FROM Lote WHERE id = ? AND estado = 'abierto'", [loteId]);
    if (!lote) throw new Error("Lote no encontrado o ya cerrado");

    // Obtener información del código de barras
    const barcode = get("SELECT * FROM ProductoBarcode WHERE id = ?", [barcodeId]);
    if (!barcode) throw new Error("Código de barras no encontrado");

    console.log("🛒 [LOTE:ADD_VENTA] Stock disponible en barcode:", barcode.cantidad);

    // Verificar cuántos de este barcode ya están en el lote actual
    const ventasExistentes = all(
      "SELECT SUM(cantidad) as total FROM Venta WHERE loteId = ? AND barcodeId = ?",
      [loteId, barcodeId]
    );
    const cantidadEnLote = ventasExistentes[0]?.total || 0;
    console.log("🛒 [LOTE:ADD_VENTA] Cantidad ya en el lote:", cantidadEnLote);

    // Verificar stock disponible considerando lo que ya está en el lote
    const stockDisponible = barcode.cantidad - cantidadEnLote;
    console.log("🛒 [LOTE:ADD_VENTA] Stock disponible después de restar lote:", stockDisponible);

    if (stockDisponible < cantidad) {
      throw new Error(
        stockDisponible === 0
          ? "No hay stock disponible de este producto"
          : `Solo quedan ${stockDisponible} unidades disponibles`
      );
    }

    // Obtener información del producto
    const producto = get("SELECT * FROM Producto WHERE id = ?", [barcode.productoId]);
    if (!producto) throw new Error("Producto no encontrado");

    // Usar precio del producto si no se especifica
    const precio = precioVenta !== null ? precioVenta : (producto.precioFinal || 0);

    // Crear venta
    const r = run(
      `INSERT INTO Venta (loteId, productoId, barcodeId, marca, tipo, codigo, talle, color, cantidad, precioVenta, fecha, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), datetime('now'))`,
      [loteId, producto.id, barcodeId, producto.marca, producto.tipo, producto.codigo,
       barcode.talle, barcode.color, cantidad, precio]
    );

    console.log("🛒 [LOTE:ADD_VENTA] Venta agregada exitosamente");

    // Actualizar total del lote
    const nuevoTotal = lote.total + (precio * cantidad);
    run(`UPDATE Lote SET total = ? WHERE id = ?`, [nuevoTotal, loteId]);

    return get("SELECT * FROM Venta WHERE id = ?", [r.lastInsertRowid]);
  });

  // Cerrar lote y descontar stock
  ipcMain.handle("lote:close", async (_e, { id, metodoPago, total }) => {
    const loteId = Number(id);
    if (!loteId) throw new Error("Lote ID obligatorio");

    console.log("🔒 [LOTE:CLOSE] Cerrando lote ID:", loteId);

    const lote = get("SELECT * FROM Lote WHERE id = ? AND estado = 'abierto'", [loteId]);
    if (!lote) throw new Error("Lote no encontrado o ya cerrado");

    // Obtener todas las ventas del lote
    const ventas = all("SELECT * FROM Venta WHERE loteId = ?", [loteId]);
    console.log("🔒 [LOTE:CLOSE] Ventas en lote:", ventas.length);

    // Descontar stock de cada venta
    for (const venta of ventas) {
      if (venta.barcodeId) {
        const barcode = get("SELECT * FROM ProductoBarcode WHERE id = ?", [venta.barcodeId]);
        if (barcode) {
          console.log(`🔒 [LOTE:CLOSE] Barcode ${venta.barcodeId}: stock antes=${barcode.cantidad}, descontar=${venta.cantidad}`);
          const nuevaCantidad = Math.max(0, barcode.cantidad - venta.cantidad);
          run(
            `UPDATE ProductoBarcode SET cantidad = ?, updatedAt = datetime('now') WHERE id = ?`,
            [nuevaCantidad, venta.barcodeId]
          );
          console.log(`🔒 [LOTE:CLOSE] Barcode ${venta.barcodeId}: stock después=${nuevaCantidad}`);
        }
      }
    }

    // Calcular total si no se proporciona
    let totalFinal = total;
    if (totalFinal === undefined || totalFinal === null) {
      totalFinal = ventas.reduce((sum, v) => sum + (v.precioVenta * v.cantidad), 0);
      console.log("🔒 [LOTE:CLOSE] Total calculado:", totalFinal);
    } else {
      console.log("🔒 [LOTE:CLOSE] Total proporcionado:", totalFinal);
    }

    // Cerrar lote con método de pago y total
    run(
      `UPDATE Lote SET estado = 'cerrado', metodoPago = ?, total = ?, closedAt = datetime('now') WHERE id = ?`,
      [metodoPago || null, totalFinal, loteId]
    );

    // Forzar persistencia explícita
    persist();
    console.log("🔒 [LOTE:CLOSE] Lote cerrado y DB persistida");

    const loteCerrado = get("SELECT * FROM Lote WHERE id = ?", [loteId]);
    console.log("🔒 [LOTE:CLOSE] Lote recuperado:", loteCerrado);

    if (!loteCerrado) {
      throw new Error("Error al recuperar el lote después de cerrarlo");
    }

    return loteCerrado;
  });

  // Actualizar cliente del lote
  ipcMain.handle("lote:updateCliente", async (_e, { id, cliente }) => {
    const loteId = Number(id);
    if (!loteId) throw new Error("Lote ID obligatorio");

    run(`UPDATE Lote SET cliente = ? WHERE id = ?`, [cliente || null, loteId]);
    return get("SELECT * FROM Lote WHERE id = ?", [loteId]);
  });

  // Actualizar método de pago del lote
  ipcMain.handle("lote:updateMetodoPago", async (_e, { id, metodoPago }) => {
    const loteId = Number(id);
    if (!loteId) throw new Error("Lote ID obligatorio");

    run(`UPDATE Lote SET metodoPago = ? WHERE id = ?`, [metodoPago || null, loteId]);
    return get("SELECT * FROM Lote WHERE id = ?", [loteId]);
  });

  // Actualizar precio de una venta
  ipcMain.handle("venta:updatePrecio", async (_e, { id, precioVenta }) => {
    const ventaId = Number(id);
    if (!ventaId) throw new Error("Venta ID obligatorio");

    const precio = normalizeFloat(precioVenta);
    if (precio === null || Number.isNaN(precio) || precio < 0) {
      throw new Error("Precio inválido");
    }

    // Actualizar precio de la venta
    run(`UPDATE Venta SET precioVenta = ? WHERE id = ?`, [precio, ventaId]);

    // Recalcular total del lote
    const venta = get("SELECT * FROM Venta WHERE id = ?", [ventaId]);
    if (venta && venta.loteId) {
      const ventas = all("SELECT * FROM Venta WHERE loteId = ?", [venta.loteId]);
      const nuevoTotal = ventas.reduce((sum, v) => sum + (v.precioVenta * v.cantidad), 0);
      run(`UPDATE Lote SET total = ? WHERE id = ?`, [nuevoTotal, venta.loteId]);
    }

    return get("SELECT * FROM Venta WHERE id = ?", [ventaId]);
  });

  // Eliminar venta de un lote
  ipcMain.handle("lote:removeVenta", async (_e, { id }) => {
    const ventaId = Number(id);
    if (!ventaId) throw new Error("Venta ID obligatorio");

    console.log("🗑️ [LOTE:REMOVE_VENTA] Eliminando venta ID:", ventaId);

    // Obtener la venta antes de eliminar
    const venta = get("SELECT * FROM Venta WHERE id = ?", [ventaId]);
    if (!venta) throw new Error("Venta no encontrada");

    // Verificar que pertenece a un lote abierto
    if (venta.loteId) {
      const lote = get("SELECT * FROM Lote WHERE id = ? AND estado = 'abierto'", [venta.loteId]);
      if (!lote) throw new Error("No se puede eliminar ventas de un lote cerrado");
    }

    // Eliminar la venta
    run("DELETE FROM Venta WHERE id = ?", [ventaId]);

    // Recalcular total del lote
    if (venta.loteId) {
      const ventas = all("SELECT * FROM Venta WHERE loteId = ?", [venta.loteId]);
      const nuevoTotal = ventas.reduce((sum, v) => sum + (v.precioVenta * v.cantidad), 0);
      run(`UPDATE Lote SET total = ? WHERE id = ?`, [nuevoTotal, venta.loteId]);
      console.log("🗑️ [LOTE:REMOVE_VENTA] Total recalculado:", nuevoTotal);
    }

    console.log("🗑️ [LOTE:REMOVE_VENTA] Venta eliminada correctamente");
    return { ok: true };
  });

  // Listar lotes cerrados con sus items
  ipcMain.handle("lote:list", async () => {
    const lotes = all("SELECT * FROM Lote WHERE estado = 'cerrado' ORDER BY closedAt DESC");

    // Para cada lote, obtener sus items
    return lotes.map(lote => {
      const ventas = all(`
        SELECT v.*,
               pb.barcode, pb.talle, pb.color,
               p.marca, p.tipo, p.codigo, p.precioFinal
        FROM Venta v
        LEFT JOIN ProductoBarcode pb ON v.barcodeId = pb.id
        LEFT JOIN Producto p ON v.productoId = p.id
        WHERE v.loteId = ?
        ORDER BY v.createdAt ASC
      `, [lote.id]);

      const items = ventas.map(v => ({
        id: v.id,
        loteId: v.loteId,
        barcodeId: v.barcodeId,
        precioVenta: v.precioVenta,
        cantidad: v.cantidad,
        createdAt: v.createdAt,
        barcode: {
          id: v.barcodeId,
          barcode: v.barcode,
          talle: v.talle,
          color: v.color,
        },
        producto: {
          id: v.productoId,
          marca: v.marca,
          tipo: v.tipo,
          codigo: v.codigo,
          precioFinal: v.precioFinal,
        },
      }));

      return { ...lote, items };
    });
  });

  // Eliminar lote cerrado y devolver stock
  ipcMain.handle("lote:delete", async (_e, { id }) => {
    const loteId = Number(id);
    if (!loteId) throw new Error("Lote ID obligatorio");

    console.log("🗑️ [LOTE:DELETE] Eliminando lote ID:", loteId);

    const lote = get("SELECT * FROM Lote WHERE id = ?", [loteId]);
    if (!lote) throw new Error("Lote no encontrado");

    // Verificar que el lote esté cerrado
    if (lote.estado !== 'cerrado') {
      throw new Error("Solo se pueden eliminar lotes cerrados");
    }

    // Obtener todas las ventas del lote
    const ventas = all("SELECT * FROM Venta WHERE loteId = ?", [loteId]);
    console.log("🗑️ [LOTE:DELETE] Ventas a revertir:", ventas.length);

    // Devolver stock de cada venta
    for (const venta of ventas) {
      if (venta.barcodeId) {
        const barcode = get("SELECT * FROM ProductoBarcode WHERE id = ?", [venta.barcodeId]);
        if (barcode) {
          console.log(`🗑️ [LOTE:DELETE] Barcode ${venta.barcodeId}: stock antes=${barcode.cantidad}, devolver=${venta.cantidad}`);
          const nuevaCantidad = barcode.cantidad + venta.cantidad;
          run(
            `UPDATE ProductoBarcode SET cantidad = ?, updatedAt = datetime('now') WHERE id = ?`,
            [nuevaCantidad, venta.barcodeId]
          );
          console.log(`🗑️ [LOTE:DELETE] Barcode ${venta.barcodeId}: stock después=${nuevaCantidad}`);
        } else {
          console.warn(`🗑️ [LOTE:DELETE] Barcode ${venta.barcodeId} no encontrado, no se puede devolver stock`);
        }
      }
    }

    // Eliminar ventas del lote
    run("DELETE FROM Venta WHERE loteId = ?", [loteId]);
    console.log("🗑️ [LOTE:DELETE] Ventas eliminadas");

    // Eliminar lote
    run("DELETE FROM Lote WHERE id = ?", [loteId]);
    console.log("🗑️ [LOTE:DELETE] Lote eliminado");

    // Forzar persistencia explícita
    persist();
    console.log("🗑️ [LOTE:DELETE] DB persistida");

    return { ok: true };
  });

  // ── VENTAS ─────────────────────────────────────────────────────
  ipcMain.handle("ventas:list", async () => {
    return all("SELECT * FROM Venta ORDER BY fecha DESC, createdAt DESC");
  });

  ipcMain.handle("ventas:create", async (_e, payload) => {
    const productoId  = payload?.productoId ? Number(payload.productoId) : null;
    const marca       = String(payload?.marca ?? "").trim();
    const tipo        = String(payload?.tipo  ?? "").trim();
    const codigo      = normalizeCodigo(payload?.codigo);
    const talle       = payload?.talle ? String(payload.talle).trim() : null;
    const cantidad    = Math.max(1, Math.floor(Number(payload?.cantidad) || 1));
    const precioVenta = normalizeFloat(payload?.precioVenta);
    const fecha       = String(payload?.fecha ?? "").trim() || new Date().toISOString().slice(0, 10);
    const notas       = String(payload?.notas ?? "").trim() || null;

    if (!marca) throw new Error("Marca obligatoria");
    if (!tipo)  throw new Error("Tipo de prenda obligatorio");
    if (precioVenta !== null && Number.isNaN(precioVenta)) throw new Error("Precio de venta inválido");
    if (precioVenta !== null && precioVenta < 0) throw new Error("El precio de venta no puede ser negativo");

    if (productoId) {
      const producto = get("SELECT * FROM Producto WHERE id = ? AND deletedAt IS NULL", [productoId]);
      if (!producto) throw new Error("Producto no encontrado");

      if (talle) {
        let tsObj = {};
        try { tsObj = JSON.parse(producto.talleStock || "{}"); } catch { tsObj = {}; }
        const currentQty = Math.max(0, Number(tsObj[talle]) || 0);
        if (currentQty < cantidad) throw new Error(`Stock insuficiente para talle ${talle} (disponible: ${currentQty})`);
        tsObj[talle] = currentQty - cantidad;
        const newStock = Object.values(tsObj).reduce((s, n) => s + Math.max(0, Number(n) || 0), 0);
        run(`UPDATE Producto SET talleStock=?, stock=?, updatedAt=datetime('now') WHERE id=?`,
          [JSON.stringify(tsObj), newStock, productoId]);
      } else {
        const currentStock = producto.stock ?? 0;
        if (currentStock < cantidad) throw new Error(`Stock insuficiente (disponible: ${currentStock})`);
        run(`UPDATE Producto SET stock=?, updatedAt=datetime('now') WHERE id=?`,
          [currentStock - cantidad, productoId]);
      }
    }

    const r = run(
      `INSERT INTO Venta (productoId,marca,tipo,codigo,talle,cantidad,precioVenta,fecha,notas,createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))`,
      [productoId, marca, tipo, codigo, talle, cantidad, precioVenta, fecha, notas]
    );
    return get("SELECT * FROM Venta WHERE id = ?", [r.lastInsertRowid]);
  });

  ipcMain.handle("ventas:delete", async (_e, payload) => {
    const id           = Number(payload?.id);
    const restoreStock = payload?.restoreStock !== false;
    if (!id) throw new Error("ID inválido");

    const venta = get("SELECT * FROM Venta WHERE id = ?", [id]);
    if (!venta) throw new Error("Venta no encontrada");

    if (restoreStock && venta.productoId) {
      const producto = get("SELECT * FROM Producto WHERE id = ? AND deletedAt IS NULL", [venta.productoId]);
      if (producto) {
        if (venta.talle) {
          let tsObj = {};
          try { tsObj = JSON.parse(producto.talleStock || "{}"); } catch { tsObj = {}; }
          tsObj[venta.talle] = (Math.max(0, Number(tsObj[venta.talle]) || 0)) + venta.cantidad;
          const newStock = Object.values(tsObj).reduce((s, n) => s + Math.max(0, Number(n) || 0), 0);
          run(`UPDATE Producto SET talleStock=?, stock=?, updatedAt=datetime('now') WHERE id=?`,
            [JSON.stringify(tsObj), newStock, venta.productoId]);
        } else {
          run(`UPDATE Producto SET stock=stock+?, updatedAt=datetime('now') WHERE id=?`,
            [venta.cantidad, venta.productoId]);
        }
      }
    }

    run("DELETE FROM Venta WHERE id = ?", [id]);
    return { ok: true };
  });

  // ── NUEVO MODELO: PRODUCTO + BARCODES ─────────────────────────

  // Crear producto maestro (sin barcodes)
  ipcMain.handle("producto:create", async (_e, payload) => {
    const marca       = String(payload?.marca ?? "").trim();
    const tipo        = String(payload?.tipo  ?? "").trim();
    const codigo      = normalizeCodigo(payload?.codigo);
    const costo       = normalizeFloat(payload?.costo);
    const precioFinal = normalizeFloat(payload?.precioFinal);
    const talles      = normalizeTalles(payload?.talles);
    const colores     = normalizeColores(payload?.colores);

    if (!marca) throw new Error("Marca obligatoria");
    if (!tipo)  throw new Error("Tipo de prenda obligatorio");
    if (!codigo) throw new Error("Código/Modelo obligatorio");
    if (costo !== null && Number.isNaN(costo)) throw new Error("Costo inválido");
    if (precioFinal !== null && Number.isNaN(precioFinal)) throw new Error("Precio final inválido");

    // Validar que no exista un producto con el mismo código
    const existente = get(
      "SELECT * FROM Producto WHERE codigo = ? AND deletedAt IS NULL",
      [codigo]
    );
    if (existente) {
      throw new Error(`Ya existe un producto con el código ${codigo}`);
    }

    try {
      // Ejecutar INSERT usando exec() con sql directo
      const db = getDb();
      const marcaEsc = marca.replace(/'/g, "''");
      const tipoEsc = tipo.replace(/'/g, "''");
      const codigoEsc = codigo ? codigo.replace(/'/g, "''") : null;
      const tallesEsc = talles.replace(/'/g, "''");
      const coloresEsc = colores.replace(/'/g, "''");

      db.exec(`
        INSERT INTO Producto (marca, tipo, codigo, costo, precioFinal, talles, colores, stock, stockInicial, talleStock, createdAt, updatedAt)
        VALUES ('${marcaEsc}', '${tipoEsc}', ${codigoEsc ? `'${codigoEsc}'` : 'NULL'}, ${costo || 'NULL'}, ${precioFinal || 'NULL'}, '${tallesEsc}', '${coloresEsc}', 0, 0, '{}', datetime('now'), datetime('now'))
      `);

      // Persistir
      persist();

      // Obtener el producto recién creado (el de mayor ID con esta marca y tipo)
      const producto = get(
        "SELECT * FROM Producto WHERE marca = ? AND tipo = ? ORDER BY id DESC LIMIT 1",
        [marca, tipo]
      );

      return producto;
    } catch (err) {
      throw new Error("Error creando producto: " + err.message);
    }
  });
  console.log("✅ Handler producto:create REGISTRADO");

  // Listar productos con sus barcodes y stock total
  ipcMain.handle("producto:listWithBarcodes", async () => {
    try {
      console.log("📦 [PRODUCTO:LIST] Iniciando carga de productos con barcodes...");
      console.log("📦 [PRODUCTO:LIST] DB actual:", getCurrentDbPath());

      // Obtener TODOS los productos sin filtrar
      const productos = all("SELECT * FROM Producto WHERE deletedAt IS NULL ORDER BY createdAt DESC");
      console.log("📦 [PRODUCTO:LIST] Productos encontrados:", productos.length);

      // Si no hay productos, retornar array vacío inmediatamente
      if (productos.length === 0) {
        console.log("📦 [PRODUCTO:LIST] No hay productos, retornando array vacío");
        return [];
      }

      // Obtener todos los barcodes de una sola vez (más eficiente)
      const productoIds = productos.map(p => p.id);
      console.log("📦 [PRODUCTO:LIST] IDs de productos:", productoIds);

      let todosLosBarcodes = [];
      if (productoIds.length > 0) {
        const placeholders = productoIds.map(() => '?').join(',');
        todosLosBarcodes = all(
          `SELECT * FROM ProductoBarcode WHERE productoId IN (${placeholders}) ORDER BY productoId, createdAt DESC`,
          productoIds
        );
      }
      console.log("📦 [PRODUCTO:LIST] Barcodes encontrados:", todosLosBarcodes.length);

      // Agrupar barcodes por productoId
      const barcodesPorProducto = {};
      todosLosBarcodes.forEach(barcode => {
        if (!barcodesPorProducto[barcode.productoId]) {
          barcodesPorProducto[barcode.productoId] = [];
        }
        barcodesPorProducto[barcode.productoId].push(barcode);
      });

      // Combinar productos con sus barcodes
      const resultado = productos.map(p => {
        const barcodes = barcodesPorProducto[p.id] || [];
        const stockTotal = barcodes.reduce((sum, b) => sum + (b.cantidad || 0), 0);
        return { ...p, barcodes, stock: stockTotal };
      });

      console.log("📦 [PRODUCTO:LIST] Carga completada exitosamente");
      return resultado;
    } catch (err) {
      console.error("❌ [PRODUCTO:LIST] Error:", err);
      throw err;
    }
  });

  // Actualizar producto maestro
  ipcMain.handle("producto:update", async (_e, payload) => {
    const id = getIdFromPayload(payload);
    if (!id) throw new Error("ID inválido");

    const marca       = String(payload?.marca ?? "").trim();
    const tipo        = String(payload?.tipo  ?? "").trim();
    const codigo      = normalizeCodigo(payload?.codigo);
    const costo       = normalizeFloat(payload?.costo);
    const precioFinal = normalizeFloat(payload?.precioFinal);
    const talles      = normalizeTalles(payload?.talles);
    const colores     = normalizeColores(payload?.colores);

    if (!marca) throw new Error("Marca obligatoria");
    if (!tipo)  throw new Error("Tipo de prenda obligatorio");
    if (!codigo) throw new Error("Código/Modelo obligatorio");

    // Validar que no exista otro producto con el mismo código
    const existente = get(
      "SELECT * FROM Producto WHERE codigo = ? AND id != ? AND deletedAt IS NULL",
      [codigo, Number(id)]
    );
    if (existente) {
      throw new Error(`Ya existe otro producto con el código ${codigo}`);
    }

    try {
      run(
        `UPDATE Producto SET marca=?, tipo=?, codigo=?, costo=?, precioFinal=?, talles=?, colores=?, updatedAt=datetime('now') WHERE id=?`,
        [marca, tipo, codigo, costo, precioFinal, talles, colores, Number(id)]
      );
      return get("SELECT * FROM Producto WHERE id = ?", [Number(id)]);
    } catch (err) {
      throw new Error("Error actualizando producto: " + err.message);
    }
  });

  // Eliminar producto maestro (y sus barcodes)
  ipcMain.handle("producto:delete", async (_e, payload) => {
    const id = getIdFromPayload(payload);
    if (!id) throw new Error("ID inválido");

    // Eliminar códigos de barras asociados
    run(`DELETE FROM ProductoBarcode WHERE productoId=?`, [Number(id)]);

    // Eliminar producto
    run(`DELETE FROM Producto WHERE id=?`, [Number(id)]);

    return { ok: true };
  });

  // ── BARCODES ───────────────────────────────────────────────────

  // Buscar barcode (devuelve barcode + producto)
  ipcMain.handle("barcode:getByCode", async (_e, { barcode }) => {
    if (!barcode) throw new Error("Código de barras requerido");
    const bc = get("SELECT * FROM ProductoBarcode WHERE barcode = ?", [String(barcode).trim()]);
    if (!bc) return null;

    const producto = get("SELECT * FROM Producto WHERE id = ? AND deletedAt IS NULL", [bc.productoId]);
    if (!producto) return null;

    return { ...bc, producto };
  });

  // Agregar o incrementar barcode
  ipcMain.handle("barcode:addOrIncrement", async (_e, payload) => {
    console.log("📥 [BARCODE:ADD] Payload recibido:", JSON.stringify(payload, null, 2));

    const productoId = Number(payload?.productoId);
    let barcode      = String(payload?.barcode ?? "").trim();
    const talle      = payload?.talle ? String(payload.talle).trim() : null;
    const color      = payload?.color ? String(payload.color).trim() : null;
    const cantidad   = Math.max(1, Math.floor(Number(payload?.cantidad) || 1));

    console.log("📥 [BARCODE:ADD] Valores procesados:", {
      productoId,
      barcode,
      talle,
      color,
      cantidad
    });

    if (!productoId) throw new Error("productoId obligatorio");

    // Si no hay barcode, generar uno automático basado en el código numérico más alto
    if (!barcode) {
      // Obtener todos los barcodes numéricos existentes
      const allBarcodes = all("SELECT barcode FROM ProductoBarcode");
      const numericBarcodes = allBarcodes
        .map(b => parseInt(b.barcode, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a); // Ordenar de mayor a menor

      let nextNum = 1;
      if (numericBarcodes.length > 0) {
        nextNum = numericBarcodes[0] + 1;
      }

      // Asegurar que el código generado no existe (por seguridad)
      let attempts = 0;
      while (attempts < 1000) {
        const testBarcode = String(nextNum).padStart(7, '0');
        const exists = get("SELECT id FROM ProductoBarcode WHERE barcode = ?", [testBarcode]);
        if (!exists) {
          barcode = testBarcode;
          console.log(`🔢 [BARCODE] Código generado: ${barcode}`);
          break;
        }
        nextNum++;
        attempts++;
      }

      if (!barcode) {
        throw new Error("No se pudo generar un código único después de 1000 intentos");
      }
    }

    // Verificar que el producto existe
    const producto = get("SELECT * FROM Producto WHERE id = ? AND deletedAt IS NULL", [productoId]);
    if (!producto) throw new Error("Producto no encontrado");

    // Validar que si el producto tiene talles/colores, el código también los tenga
    const productoTalles = (producto.talles || "").split(",").filter(Boolean);
    const productoColores = (producto.colores || "").split(",").filter(Boolean);

    if (productoTalles.length > 0 && !talle) {
      throw new Error("Este producto requiere talle");
    }
    if (productoColores.length > 0 && !color) {
      throw new Error("Este producto requiere color");
    }

    // Buscar si el barcode ya existe (un código = una prenda única)
    const existing = get("SELECT * FROM ProductoBarcode WHERE barcode = ?", [barcode]);
    console.log("🔍 [BARCODE:ADD] Buscando código existente:", barcode);
    console.log("🔍 [BARCODE:ADD] Resultado:", existing ? `Encontrado ID ${existing.id}` : "No encontrado");

    if (existing) {
      // El código ya existe
      if (existing.productoId !== productoId) {
        // Pertenece a otro producto → ERROR
        throw new Error("Este código ya está asociado a otro producto");
      }

      // Pertenece al mismo producto → incrementar cantidad
      const newCantidad = existing.cantidad + cantidad;
      run(
        `UPDATE ProductoBarcode SET cantidad=?, updatedAt=datetime('now') WHERE id=?`,
        [newCantidad, existing.id]
      );
      console.log(`📦 [BARCODE] Incrementado: ${barcode} → cantidad: ${existing.cantidad} → ${newCantidad}`);
      return get("SELECT * FROM ProductoBarcode WHERE id = ?", [existing.id]);
    } else {
      // Código nuevo → crear registro
      const r = run(
        `INSERT INTO ProductoBarcode (productoId, barcode, talle, color, cantidad, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [productoId, barcode, talle, color, cantidad]
      );
      console.log(`📦 [BARCODE] Creado: ${barcode} (${talle || 'sin talle'}/${color || 'sin color'}) → cantidad: ${cantidad}`);
      return get("SELECT * FROM ProductoBarcode WHERE id = ?", [r.lastInsertRowid]);
    }
  });

  // Listar barcodes de un producto
  ipcMain.handle("barcode:listByProducto", async (_e, { productoId }) => {
    return all("SELECT * FROM ProductoBarcode WHERE productoId = ? ORDER BY createdAt DESC", [Number(productoId)]);
  });

  // Actualizar cantidad de un barcode
  ipcMain.handle("barcode:updateCantidad", async (_e, payload) => {
    const id       = Number(payload?.id);
    const cantidad = Math.max(0, Math.floor(Number(payload?.cantidad) || 0));

    if (!id) throw new Error("ID inválido");

    run(`UPDATE ProductoBarcode SET cantidad=?, updatedAt=datetime('now') WHERE id=?`, [cantidad, id]);
    return get("SELECT * FROM ProductoBarcode WHERE id = ?", [id]);
  });

  // Actualizar talle y color de un barcode
  ipcMain.handle("barcode:update", async (_e, payload) => {
    const id     = Number(payload?.id);
    const talle  = payload?.talle ? String(payload.talle).trim() : null;
    const color  = payload?.color ? String(payload.color).trim() : null;

    if (!id) throw new Error("ID inválido");

    run(
      `UPDATE ProductoBarcode SET talle=?, color=?, updatedAt=datetime('now') WHERE id=?`,
      [talle, color, id]
    );
    return get("SELECT * FROM ProductoBarcode WHERE id = ?", [id]);
  });

  // Eliminar barcode
  ipcMain.handle("barcode:delete", async (_e, payload) => {
    const id = Number(payload?.id);
    if (!id) throw new Error("ID inválido");
    run("DELETE FROM ProductoBarcode WHERE id = ?", [id]);
    return { ok: true };
  });

  // Limpiar toda la base de datos (para pruebas)
  ipcMain.handle("db:clearAll", async () => {
    try {
      const db = getDb();
      db.exec("DELETE FROM ProductoBarcode");
      db.exec("DELETE FROM Producto");
      db.exec("DELETE FROM Venta");
      persist();
      return { ok: true };
    } catch (err) {
      throw new Error("Error limpiando base de datos: " + err.message);
    }
  });

  console.log("🎉 TODOS LOS HANDLERS REGISTRADOS EXITOSAMENTE");
}

module.exports = { registerIpcHandlers };