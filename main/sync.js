// Sincronización del programa con la base central (web KAIA).
//
// El programa sigue trabajando sobre su SQLite local, con o sin internet.
// Triggers de SQLite anotan cada cambio en SyncOutbox; cada pocos segundos,
// si hay conexión, se manda la cola a la web (push) y se traen las
// novedades de la web (pull): stock vendido online, lotes web y lotes web
// anulados.
//
// - El stock viaja como movimientos (+/-), así una venta del local y una
//   de la web nunca se pisan.
// - Los registros se identifican con un uuid. Los que ya existían se
//   calculan igual que en la importación inicial (UUID v5 de
//   "<temporada>:<tabla>:<id>"), así coinciden con los de la nube.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Mismo namespace que scripts/import-stock-db.ts de la web. No cambiar.
const KAIA_NAMESPACE = "6f1c2a3e-8b4d-4e5f-9a7b-1c2d3e4f5a6b";
const DEFAULT_URL = "https://kaia-ecommerce.vercel.app";
const DEFAULT_TEMPORADA = "invierno26";
const INTERVAL_MS = 15000;
const PUSH_BATCH = 100;
const BASELINE_BATCH = 150;

function uuidv5(name, namespace = KAIA_NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = crypto.createHash("sha1").update(ns).update(name, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// UUID v4 generado dentro de SQLite (para filas nuevas creadas por triggers)
const SQL_UUID = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))))`;

const NOT_APPLYING = `(SELECT v FROM SyncState WHERE k = 'applying') IS NOT '1'`;

// Columnas que viajan a la nube por tabla. Las referencias a otras tablas
// se mandan como uuid.
const TABLES = {
  Marca: { cols: ["nombre", "createdAt"] },
  TipoPrenda: { cols: ["nombre", "curva", "createdAt"] },
  Producto: {
    cols: ["marca", "tipo", "codigo", "costo", "precioFinal", "talles", "colores", "temporada", "createdAt", "deletedAt"],
  },
  ProductoBarcode: {
    cols: ["barcode", "talle", "color", "cantidad", "createdAt"],
    refs: { productoUuid: ["Producto", "productoId"] },
  },
  Lote: {
    cols: ["fecha", "cliente", "metodoPago", "total", "estado", "createdAt", "closedAt"],
    skipWhen: (row) => `${row}.origen = 'web'`,
  },
  Venta: {
    cols: ["marca", "tipo", "codigo", "talle", "color", "cantidad", "precioVenta", "fecha", "notas", "createdAt"],
    refs: {
      loteUuid: ["Lote", "loteId"],
      productoUuid: ["Producto", "productoId"],
      barcodeUuid: ["ProductoBarcode", "barcodeId"],
    },
    skipWhen: (row) => `(SELECT origen FROM Lote WHERE id = ${row}.loteId) = 'web'`,
  },
};

function jsonSnapshot(tabla, row, uuidExpr) {
  const t = TABLES[tabla];
  const parts = [`'uuid', ${uuidExpr}`];
  for (const c of t.cols) parts.push(`'${c}', ${row}.${c}`);
  for (const [key, [refTable, refCol]] of Object.entries(t.refs || {})) {
    parts.push(`'${key}', (SELECT uuid FROM ${refTable} WHERE id = ${row}.${refCol})`);
  }
  return `json_object(${parts.join(", ")})`;
}

function triggerSql(tabla) {
  const t = TABLES[tabla];
  const skipNew = t.skipWhen ? ` AND NOT (${t.skipWhen("NEW")})` : "";
  const skipOld = t.skipWhen ? ` AND NOT (${t.skipWhen("OLD")})` : "";
  const lower = tabla.toLowerCase();
  const sql = [];

  // Alta: asignar uuid y encolar
  sql.push(`CREATE TRIGGER IF NOT EXISTS sync_${lower}_ins AFTER INSERT ON ${tabla}
    WHEN ${NOT_APPLYING}${skipNew}
    BEGIN
      UPDATE ${tabla} SET uuid = ${SQL_UUID} WHERE id = NEW.id AND uuid IS NULL;
      INSERT INTO SyncOutbox (tabla, op, data) VALUES ('${tabla}', 'upsert',
        ${jsonSnapshot(tabla, "NEW", `(SELECT uuid FROM ${tabla} WHERE id = NEW.id)`)});
    END`);

  if (tabla === "ProductoBarcode") {
    // Cambio de stock: movimiento
    sql.push(`CREATE TRIGGER IF NOT EXISTS sync_${lower}_mov AFTER UPDATE OF cantidad ON ${tabla}
      WHEN ${NOT_APPLYING} AND OLD.uuid IS NOT NULL AND NEW.cantidad IS NOT OLD.cantidad
      BEGIN
        INSERT INTO SyncOutbox (tabla, op, data) VALUES ('Movimiento', 'mov', json_object(
          'uuid', ${SQL_UUID}, 'barcodeUuid', NEW.uuid,
          'delta', NEW.cantidad - OLD.cantidad, 'motivo', 'local', 'createdAt', datetime('now')));
      END`);
    // Cambio de datos del código (no de stock)
    sql.push(`CREATE TRIGGER IF NOT EXISTS sync_${lower}_upd AFTER UPDATE ON ${tabla}
      WHEN ${NOT_APPLYING} AND OLD.uuid IS NOT NULL AND (NEW.talle IS NOT OLD.talle OR
        NEW.color IS NOT OLD.color OR NEW.barcode IS NOT OLD.barcode OR NEW.productoId IS NOT OLD.productoId)
      BEGIN
        INSERT INTO SyncOutbox (tabla, op, data) VALUES ('${tabla}', 'upsert', ${jsonSnapshot(tabla, "NEW", "NEW.uuid")});
      END`);
  } else {
    sql.push(`CREATE TRIGGER IF NOT EXISTS sync_${lower}_upd AFTER UPDATE ON ${tabla}
      WHEN ${NOT_APPLYING} AND OLD.uuid IS NOT NULL${skipNew}
      BEGIN
        INSERT INTO SyncOutbox (tabla, op, data) VALUES ('${tabla}', 'upsert', ${jsonSnapshot(tabla, "NEW", "NEW.uuid")});
      END`);
  }

  sql.push(`CREATE TRIGGER IF NOT EXISTS sync_${lower}_del AFTER DELETE ON ${tabla}
    WHEN ${NOT_APPLYING} AND OLD.uuid IS NOT NULL${skipOld}
    BEGIN
      INSERT INTO SyncOutbox (tabla, op, data) VALUES ('${tabla}', 'delete', json_object('uuid', OLD.uuid));
    END`);

  return sql;
}

function addColumn(db, tabla, def) {
  try {
    db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${def}`);
  } catch (_) {
    /* ya existe */
  }
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Ejecuta sin pasar por el wrapper de db.run (que guarda a disco en cada
// llamada); quien llama decide cuándo persistir.
function exec(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

function getState(db, k) {
  const r = queryAll(db, "SELECT v FROM SyncState WHERE k = ?", [k])[0];
  return r ? r.v : null;
}

function setState(db, k, v) {
  exec(db, "INSERT INTO SyncState (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", [k, v === null ? null : String(v)]);
}

// Prepara la base local para sincronizar. Idempotente.
function ensureSyncSchema(db, persist, temporada = DEFAULT_TEMPORADA) {
  db.exec(`CREATE TABLE IF NOT EXISTS SyncState (k TEXT PRIMARY KEY, v TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS SyncOutbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT NOT NULL,
    op TEXT NOT NULL,
    data TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS SyncLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tabla TEXT, op TEXT, data TEXT, error TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  for (const tabla of Object.keys(TABLES)) addColumn(db, tabla, "uuid TEXT");
  addColumn(db, "Producto", "temporada TEXT");
  addColumn(db, "Lote", "origen TEXT NOT NULL DEFAULT 'local'");

  if (getState(db, "temporada") === null) setState(db, "temporada", temporada);
  const temp = getState(db, "temporada");

  // uuid de las filas existentes: igual que en la importación a la nube
  let filled = 0;
  for (const tabla of Object.keys(TABLES)) {
    const rows = queryAll(db, `SELECT id, ${tabla === "Marca" || tabla === "TipoPrenda" ? "nombre" : "NULL AS nombre"} FROM ${tabla} WHERE uuid IS NULL`);
    for (const r of rows) {
      const name =
        tabla === "Marca" ? `marca:${r.nombre}` : tabla === "TipoPrenda" ? `tipo:${r.nombre}` : `${temp}:${tabla}:${r.id}`;
      exec(db, `UPDATE ${tabla} SET uuid = ? WHERE id = ?`, [uuidv5(name), r.id]);
      filled++;
    }
  }
  for (const tabla of Object.keys(TABLES)) {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${tabla.toLowerCase()}_uuid ON ${tabla}(uuid)`);
    for (const sql of triggerSql(tabla)) db.exec(sql);
  }
  if (filled) console.log(`🔄 [SYNC] uuid asignados a ${filled} registros existentes`);
  persist();
}

// ── Configuración ────────────────────────────────────────────────

function loadConfig(userDataDir) {
  const file = path.join(userDataDir, "sync.json");
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    /* sin configurar */
  }
  return {
    url: (process.env.KAIA_SYNC_URL || cfg.url || DEFAULT_URL).replace(/\/$/, ""),
    token: process.env.KAIA_SYNC_TOKEN || cfg.token || "",
    file,
  };
}

// ── Motor ────────────────────────────────────────────────────────

function createSync({ getDb, persist, userDataDir, onStatus }) {
  let busy = false;
  let timer = null;
  let status = { estado: "iniciando", pendientes: 0, ultimaSync: null, stockNegativo: 0, errores: 0, mensaje: null };

  function emit(changes) {
    const db = getDb();
    status = {
      ...status,
      ...changes,
      pendientes: queryAll(db, "SELECT COUNT(*) AS n FROM SyncOutbox")[0].n,
      stockNegativo: queryAll(db, "SELECT COUNT(*) AS n FROM ProductoBarcode WHERE cantidad < 0")[0].n,
      errores: queryAll(db, "SELECT COUNT(*) AS n FROM SyncLog")[0].n,
    };
    try {
      onStatus?.(status);
    } catch (_) {
      /* ventana cerrada */
    }
  }

  async function api(cfg, method, route, body) {
    const res = await fetch(`${cfg.url}${route}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    if (res.status === 401) throw Object.assign(new Error("Clave de sincronización inválida"), { auth: true });
    if (!res.ok) throw new Error(`La web respondió ${res.status}`);
    return res.json();
  }

  function snapshotRows(db, tabla, where = "") {
    const t = TABLES[tabla];
    const refCols = Object.entries(t.refs || {}).map(
      ([key, [refTable, refCol]]) => `(SELECT uuid FROM ${refTable} WHERE id = x.${refCol}) AS ${key}`
    );
    const cols = ["x.uuid AS uuid", ...t.cols.map((c) => `x.${c} AS ${c}`), ...refCols].join(", ");
    return queryAll(db, `SELECT ${cols} FROM ${tabla} x ${where}`);
  }

  // Primera sincronización: se manda el estado completo (stock absoluto)
  async function baseline(cfg, temporada) {
    const db = getDb();
    const maxSeq = queryAll(db, "SELECT COALESCE(MAX(seq), 0) AS m FROM SyncOutbox")[0].m;
    const productos = snapshotRows(db, "Producto");
    const barcodes = snapshotRows(db, "ProductoBarcode");
    const lotes = snapshotRows(db, "Lote", "WHERE x.origen IS NOT 'web'");
    const ventas = snapshotRows(db, "Venta", "WHERE (SELECT origen FROM Lote WHERE id = x.loteId) IS NOT 'web'");
    const ops = [
      ...snapshotRows(db, "Marca").map((data) => ({ tabla: "Marca", data })),
      ...snapshotRows(db, "TipoPrenda").map((data) => ({ tabla: "TipoPrenda", data })),
      ...productos.map((data) => ({ tabla: "Producto", data })),
      ...barcodes.map((data) => ({ tabla: "ProductoBarcode", data })),
      ...lotes.map((data) => ({ tabla: "Lote", data })),
      ...ventas.map((data) => ({ tabla: "Venta", data })),
    ].map((o, i) => ({ seq: i, op: "baseline", ...o }));

    console.log(`🔄 [SYNC] Baseline: ${ops.length} registros`);
    let failed = 0;
    for (let i = 0; i < ops.length; i += BASELINE_BATCH) {
      emit({ estado: "sincronizando", mensaje: `Subiendo inventario (${Math.min(i + BASELINE_BATCH, ops.length)}/${ops.length})` });
      const { results } = await api(cfg, "POST", "/api/sync/push", { temporada, ops: ops.slice(i, i + BASELINE_BATCH) });
      for (const r of results.filter((x) => !x.ok)) {
        const op = ops[r.seq];
        exec(db, "INSERT INTO SyncLog (tabla, op, data, error) VALUES (?, ?, ?, ?)", [op.tabla, op.op, JSON.stringify(op.data), r.error]);
        failed++;
      }
    }
    await api(cfg, "POST", "/api/sync/baseline", {
      temporada,
      productos: productos.map((p) => p.uuid),
      barcodes: barcodes.map((b) => b.uuid),
      lotes: lotes.map((l) => l.uuid),
      ventas: ventas.map((v) => v.uuid),
    });
    // Lo encolado antes del snapshot ya está incluido en el estado mandado
    exec(db, "DELETE FROM SyncOutbox WHERE seq <= ?", [maxSeq]);
    setState(db, "baselineDone", new Date().toISOString());
    persist();
    console.log(`🔄 [SYNC] Baseline completo (${failed} con error)`);
  }

  async function push(cfg, temporada) {
    const db = getDb();
    for (;;) {
      const rows = queryAll(db, "SELECT seq, tabla, op, data FROM SyncOutbox ORDER BY seq LIMIT ?", [PUSH_BATCH]);
      if (rows.length === 0) return;
      const ops = rows.map((r) => ({ seq: r.seq, tabla: r.tabla, op: r.op, data: JSON.parse(r.data) }));
      const { results } = await api(cfg, "POST", "/api/sync/push", { temporada, ops });
      for (const r of results) {
        if (!r.ok) {
          const row = rows.find((x) => x.seq === r.seq);
          exec(db, "INSERT INTO SyncLog (tabla, op, data, error) VALUES (?, ?, ?, ?)", [row.tabla, row.op, row.data, r.error]);
        }
        exec(db, "DELETE FROM SyncOutbox WHERE seq = ?", [r.seq]);
      }
      persist();
    }
  }

  function localId(db, tabla, uuid) {
    if (!uuid) return null;
    const r = queryAll(db, `SELECT id FROM ${tabla} WHERE uuid = ?`, [uuid])[0];
    return r ? r.id : null;
  }

  async function pull(cfg) {
    const db = getDb();
    const since = getState(db, "lastPull");
    const data = await api(cfg, "GET", `/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`);

    // Códigos con cambios locales todavía sin mandar: no pisarlos
    const pending = new Set(
      queryAll(
        db,
        `SELECT json_extract(data, '$.barcodeUuid') AS u FROM SyncOutbox WHERE tabla = 'Movimiento'
         UNION SELECT json_extract(data, '$.uuid') FROM SyncOutbox WHERE tabla = 'ProductoBarcode'`
      ).map((r) => r.u)
    );

    setState(db, "applying", "1");
    let cambios = 0;
    try {
      for (const b of data.barcodes) {
        if (pending.has(b.id)) continue;
        const row = queryAll(db, "SELECT cantidad FROM ProductoBarcode WHERE uuid = ?", [b.id])[0];
        if (row && row.cantidad !== b.cantidad) {
          exec(db, "UPDATE ProductoBarcode SET cantidad = ?, updatedAt = datetime('now') WHERE uuid = ?", [b.cantidad, b.id]);
          cambios++;
        }
      }

      for (const l of data.lotes) {
        let loteId = localId(db, "Lote", l.uuid);
        if (loteId) {
          exec(db, "UPDATE Lote SET fecha=?, cliente=?, metodoPago=?, total=?, estado=?, closedAt=? WHERE id=?", [
            l.fecha, l.cliente, l.metodoPago, l.total, l.estado, l.closedAt, loteId,
          ]);
          exec(db, "DELETE FROM Venta WHERE loteId = ?", [loteId]);
        } else {
          exec(db, `INSERT INTO Lote (uuid, origen, fecha, cliente, metodoPago, total, estado, createdAt, closedAt)
                    VALUES (?, 'web', ?, ?, ?, ?, ?, ?, ?)`, [
            l.uuid, l.fecha, l.cliente, l.metodoPago, l.total, l.estado, l.createdAt, l.closedAt,
          ]);
          loteId = queryAll(db, "SELECT last_insert_rowid() AS id")[0].id;
        }
        for (const v of l.ventas) {
          exec(db, `INSERT INTO Venta (uuid, loteId, productoId, barcodeId, marca, tipo, codigo, talle, color, cantidad, precioVenta, fecha, notas, createdAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            v.uuid, loteId, localId(db, "Producto", v.productoUuid), localId(db, "ProductoBarcode", v.barcodeUuid),
            v.marca, v.tipo, v.codigo, v.talle, v.color, v.cantidad, v.precioVenta, v.fecha, v.notas, v.createdAt,
          ]);
        }
        cambios++;
      }

      for (const t of data.tombstones) {
        if (t.tabla !== "lote") continue;
        const loteId = queryAll(db, "SELECT id FROM Lote WHERE uuid = ? AND origen = 'web'", [t.registroId])[0]?.id;
        if (loteId) {
          exec(db, "DELETE FROM Venta WHERE loteId = ?", [loteId]);
          exec(db, "DELETE FROM Lote WHERE id = ?", [loteId]);
          cambios++;
        }
      }
      setState(db, "lastPull", data.now);
    } finally {
      setState(db, "applying", "0");
      persist();
    }
    return cambios;
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const cfg = loadConfig(userDataDir);
      if (!cfg.token) {
        emit({ estado: "sin-configurar", mensaje: "Falta vincular el programa con la web" });
        return;
      }
      const db = getDb();
      const temporada = getState(db, "temporada") || DEFAULT_TEMPORADA;
      emit({ estado: "sincronizando", mensaje: null });
      if (!getState(db, "baselineDone")) await baseline(cfg, temporada);
      await push(cfg, temporada);
      const cambios = await pull(cfg);
      emit({ estado: "ok", ultimaSync: new Date().toISOString(), mensaje: null, cambiosWeb: cambios });
    } catch (err) {
      const offline = !err.auth && (err.name === "TimeoutError" || err.cause || /fetch failed/i.test(err.message));
      emit({ estado: offline ? "sin-conexion" : "error", mensaje: offline ? "Sin conexión con la web" : err.message });
      if (!offline) console.error("❌ [SYNC]", err);
    } finally {
      busy = false;
    }
  }

  return {
    start() {
      if (timer) return;
      setTimeout(tick, 3000);
      timer = setInterval(tick, INTERVAL_MS);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    syncNow: tick,
    getStatus: () => status,
    // Volver a mandar todo el inventario (si algo quedó desfasado)
    async resync() {
      setState(getDb(), "baselineDone", null);
      persist();
      await tick();
    },
    saveConfig({ url, token }) {
      const cfg = loadConfig(userDataDir);
      fs.writeFileSync(cfg.file, JSON.stringify({ url: url || DEFAULT_URL, token }, null, 2), "utf8");
    },
    // Vincular con el usuario y contraseña del panel de la web
    async link({ email, password }) {
      const cfg = loadConfig(userDataDir);
      let res;
      try {
        res = await fetch(`${cfg.url}/api/sync/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(30000),
        });
      } catch (_) {
        throw new Error("No hay conexión con la web. Probá de nuevo cuando haya internet.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || "No se pudo vincular");
      this.saveConfig({ url: cfg.url === DEFAULT_URL ? undefined : cfg.url, token: data.token });
      await tick();
    },
  };
}

module.exports = { ensureSyncSchema, createSync, uuidv5 };
