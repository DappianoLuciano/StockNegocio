const { ipcMain } = require("electron");
const { getDb, switchDb } = require("./db");
const path = require("path");

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
  db.run(sql, params);
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] };
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
  ipcMain.handle("db:switch", async (_e, { season }) => {
    const fileMap = { invierno26: "invierno26.db", verano26: "verano26.db" };
    const fileName = fileMap[season];
    if (!fileName) throw new Error("Temporada inválida");
    await switchDb(path.join(dbDir, fileName));
    return { ok: true };
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

  ipcMain.handle("frames:create", async (_e, payload) => {
    const marca       = String(payload?.marca ?? "").trim();
    const tipo        = String(payload?.tipo  ?? "").trim();
    const codigo      = normalizeCodigo(payload?.codigo);
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
      const r = run(
        `INSERT INTO Producto (marca,tipo,codigo,costo,precioFinal,stock,stockInicial,talles,talleStock,colores,createdAt,updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
        [marca, tipo, codigo, costo, precioFinal, stock, stock, talles, talleStock, colores]
      );
      return get("SELECT * FROM Producto WHERE id = ?", [r.lastInsertRowid]);
    } catch (err) {
      if (String(err?.message || "").toLowerCase().includes("unique"))
        throw new Error("Ya existe un producto con ese código");
      throw err;
    }
  });

  ipcMain.handle("frames:update", async (_e, payload) => {
    const id = getIdFromPayload(payload);
    if (!id) throw new Error("ID inválido");

    const marca       = String(payload?.marca ?? "").trim();
    const tipo        = String(payload?.tipo  ?? "").trim();
    const codigo      = normalizeCodigo(payload?.codigo);
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
    const params = [marca, tipo, codigo, costo, precioFinal, talles, talleStock, colores];
    if (stockCalc !== null) params.push(stockCalc);
    params.push(Number(id));

    try {
      run(
        `UPDATE Producto SET marca=?,tipo=?,codigo=?,costo=?,precioFinal=?,talles=?,talleStock=?,colores=?,updatedAt=datetime('now')${stockSql} WHERE id=?`,
        params
      );
      return get("SELECT * FROM Producto WHERE id = ?", [Number(id)]);
    } catch (err) {
      if (String(err?.message || "").toLowerCase().includes("unique"))
        throw new Error("Ya existe un producto con ese código");
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
}

module.exports = { registerIpcHandlers };