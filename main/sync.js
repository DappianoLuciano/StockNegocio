// Sincronización del programa con la base central (web KAIA). Funciona con
// una o varias PCs del local a la vez.
//
// El programa sigue trabajando sobre su SQLite local, con o sin internet.
// Triggers de SQLite anotan cada cambio en SyncOutbox; cada pocos segundos,
// si hay conexión, se manda la cola a la web (push) y se baja todo lo que
// cambió en la nube (pull): productos y códigos de las otras PCs, stock,
// ventas de las otras PCs y de la web, y bajas.
//
// - El stock viaja como movimientos (+/-), así las ventas de distintas PCs
//   y de la web nunca se pisan.
// - Los registros se identifican con un uuid. Los que ya existían se
//   calculan igual que en la importación inicial (UUID v5 de
//   "<temporada>:<tabla>:<id>"), así coinciden con los de la nube.
// - Primera vez de cada PC: "fusión". La web suma solo lo que cambió esta
//   PC desde la importación, y después se baja el estado completo.
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Mismo namespace que scripts/import-stock-db.ts de la web. No cambiar.
const KAIA_NAMESPACE = "6f1c2a3e-8b4d-4e5f-9a7b-1c2d3e4f5a6b";
const DEFAULT_URL = "https://kaia-ecommerce.vercel.app";
const DEFAULT_TEMPORADA = "invierno26";
const INTERVAL_MS = 15000;
const PUSH_BATCH = 100;
const MERGE_BATCH = 150;

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
// se mandan como uuid. Los lotes web no viajan (se manejan en el panel).
const TABLES = {
  Marca: { cols: ["nombre", "createdAt"] },
  TipoPrenda: { cols: ["nombre", "curva", "createdAt"] },
  Producto: {
    cols: ["marca", "tipo", "codigo", "costo", "precioFinal", "talles", "colores", "temporada", "createdAt", "updatedAt", "deletedAt"],
  },
  ProductoBarcode: {
    cols: ["barcode", "talle", "color", "cantidad", "createdAt", "updatedAt"],
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
  // local = creado en esta PC · otra-pc = bajado de otra PC · web = pedido web
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
    // Se recrean siempre, por si cambió su definición entre versiones
    for (const kind of ["ins", "mov", "upd", "del"]) db.exec(`DROP TRIGGER IF EXISTS sync_${tabla.toLowerCase()}_${kind}`);
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
    /* sin vincular */
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
      vinculado: !!loadConfig(userDataDir).token,
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

  // Id de esta PC: vive en la base (si se cambia de base, es otra PC)
  function deviceId() {
    const db = getDb();
    let id = getState(db, "deviceId");
    if (!id) {
      id = crypto.randomUUID();
      setState(db, "deviceId", id);
      persist();
    }
    return id;
  }

  async function api(cfg, method, route, body) {
    const res = await fetch(`${cfg.url}${route}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
        "x-kaia-device": deviceId(),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60000),
    });
    if (res.status === 401) {
      const b = await res.json().catch(() => ({}));
      throw Object.assign(new Error(b.error || "Clave de sincronización inválida"), { auth: true });
    }
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `La web respondió ${res.status}`);
    }
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

  function logError(db, tabla, op, data, error) {
    exec(db, "INSERT INTO SyncLog (tabla, op, data, error) VALUES (?, ?, ?, ?)", [tabla, op, typeof data === "string" ? data : JSON.stringify(data), error]);
  }

  // Primera vez de esta PC: fusión con la nube + bajada completa
  async function join(cfg, temporada) {
    const db = getDb();
    const maxSeq = queryAll(db, "SELECT COALESCE(MAX(seq), 0) AS m FROM SyncOutbox")[0].m;
    const productos = snapshotRows(db, "Producto");

    // ¿Esta base sale de la misma importación que la nube? Una base
    // distinta (de prueba, de otro lado) pisaría productos ajenos.
    const check = await api(cfg, "POST", "/api/sync/check", {
      temporada,
      productos: productos.filter((p) => !p.deletedAt).map((p) => ({ uuid: p.uuid, codigo: p.codigo ?? null })),
    });
    if (!check.ok) {
      throw new Error(
        `Esta base de datos no coincide con la de la web (${check.matched} de ${check.local} productos). ` +
          "No se sincronizó nada."
      );
    }

    const ops = [
      ...snapshotRows(db, "Marca").map((data) => ({ tabla: "Marca", data })),
      ...snapshotRows(db, "TipoPrenda").map((data) => ({ tabla: "TipoPrenda", data })),
      ...productos.map((data) => ({ tabla: "Producto", data })),
      ...snapshotRows(db, "ProductoBarcode").map((data) => ({ tabla: "ProductoBarcode", data })),
      ...snapshotRows(db, "Lote", "WHERE x.origen = 'local'").map((data) => ({ tabla: "Lote", data })),
      ...snapshotRows(db, "Venta", "WHERE (SELECT origen FROM Lote WHERE id = x.loteId) = 'local'").map((data) => ({
        tabla: "Venta",
        data,
      })),
    ].map((o, i) => ({ seq: i, op: "merge", ...o }));

    console.log(`🔄 [SYNC] Fusión: ${ops.length} registros`);
    for (let i = 0; i < ops.length; i += MERGE_BATCH) {
      emit({ estado: "sincronizando", mensaje: `Uniendo con la web (${Math.min(i + MERGE_BATCH, ops.length)}/${ops.length})` });
      const { results } = await api(cfg, "POST", "/api/sync/push", { temporada, ops: ops.slice(i, i + MERGE_BATCH) });
      for (const r of results.filter((x) => !x.ok)) logError(db, ops[r.seq].tabla, "merge", ops[r.seq].data, r.error);
    }
    // Lo encolado antes de la fusión ya está incluido en lo que se mandó
    exec(db, "DELETE FROM SyncOutbox WHERE seq <= ?", [maxSeq]);
    setState(db, "lastPull", null);
    persist();

    emit({ estado: "sincronizando", mensaje: "Bajando datos de la web..." });
    await pull(cfg);
    setState(db, "joinedAt", new Date().toISOString());
    persist();
    console.log("🔄 [SYNC] Fusión completa");
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
          logError(db, row.tabla, row.op, row.data, r.error);
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

  // Aplica lo que cambió en la nube. Corre con 'applying' = 1 para que los
  // triggers no vuelvan a encolarlo.
  async function pull(cfg) {
    const db = getDb();
    const since = getState(db, "lastPull");
    const data = await api(cfg, "GET", `/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`);

    setState(db, "applying", "1");
    let cambios = 0;
    try {
      for (const m of data.marcas) {
        exec(db, "INSERT OR IGNORE INTO Marca (nombre, uuid, createdAt) VALUES (?, ?, datetime('now'))", [m.nombre, uuidv5(`marca:${m.nombre}`)]);
      }
      for (const t of data.tipos) {
        exec(db, "INSERT OR IGNORE INTO TipoPrenda (nombre, curva, uuid, createdAt) VALUES (?, ?, ?, datetime('now'))", [t.nombre, t.curva, uuidv5(`tipo:${t.nombre}`)]);
        exec(db, "UPDATE TipoPrenda SET curva = ? WHERE nombre = ?", [t.curva, t.nombre]);
      }

      for (const p of data.productos) {
        const vals = [p.marca, p.tipo, p.codigo, p.costo, p.precioFinal, p.talles, p.colores, p.temporada, p.deletedAt];
        if (localId(db, "Producto", p.uuid)) {
          exec(db, `UPDATE Producto SET marca=?, tipo=?, codigo=?, costo=?, precioFinal=?, talles=?, colores=?, temporada=?,
                    deletedAt=?, updatedAt=datetime('now') WHERE uuid=?`, [...vals, p.uuid]);
        } else {
          exec(db, `INSERT INTO Producto (marca, tipo, codigo, costo, precioFinal, talles, colores, temporada, deletedAt, uuid, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`, [...vals, p.uuid, p.createdAt]);
        }
        cambios++;
      }

      for (const b of data.barcodes) {
        const productoId = localId(db, "Producto", b.productoUuid);
        if (!productoId) {
          logError(db, "ProductoBarcode", "pull", b, "Producto inexistente en esta PC");
          continue;
        }
        const clash = queryAll(db, "SELECT uuid FROM ProductoBarcode WHERE barcode = ? AND uuid IS NOT ?", [b.barcode, b.uuid])[0];
        if (clash) {
          logError(db, "ProductoBarcode", "pull", b, `El código ${b.barcode} ya existe en esta PC en otro producto`);
          continue;
        }
        const row = queryAll(db, "SELECT productoId, barcode, talle, color, cantidad FROM ProductoBarcode WHERE uuid = ?", [b.uuid])[0];
        if (row) {
          if (row.productoId !== productoId || row.barcode !== b.barcode || row.talle !== b.talle || row.color !== b.color || row.cantidad !== b.cantidad) {
            exec(db, `UPDATE ProductoBarcode SET productoId=?, barcode=?, talle=?, color=?, cantidad=?, updatedAt=datetime('now') WHERE uuid=?`,
              [productoId, b.barcode, b.talle, b.color, b.cantidad, b.uuid]);
            cambios++;
          }
        } else {
          exec(db, `INSERT INTO ProductoBarcode (productoId, barcode, talle, color, cantidad, uuid, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`, [productoId, b.barcode, b.talle, b.color, b.cantidad, b.uuid, b.createdAt]);
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            l.uuid, l.origen === "web" ? "web" : "otra-pc", l.fecha, l.cliente, l.metodoPago, l.total, l.estado, l.createdAt, l.closedAt,
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
        if (t.tabla === "lote") {
          const loteId = localId(db, "Lote", t.registroId);
          if (loteId) {
            exec(db, "DELETE FROM Venta WHERE loteId = ?", [loteId]);
            exec(db, "DELETE FROM Lote WHERE id = ?", [loteId]);
            cambios++;
          }
        } else if (t.tabla === "venta") {
          exec(db, "DELETE FROM Venta WHERE uuid = ?", [t.registroId]);
        } else if (t.tabla === "barcode") {
          exec(db, "DELETE FROM ProductoBarcode WHERE uuid = ?", [t.registroId]);
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
      if (!getState(db, "joinedAt")) await join(cfg, temporada);
      await push(cfg, temporada);
      // Solo se baja con la cola vacía: así nunca se pisa un cambio local
      // que todavía no llegó a la web
      let cambios = 0;
      if (queryAll(db, "SELECT COUNT(*) AS n FROM SyncOutbox")[0].n === 0) cambios = await pull(cfg);
      emit({ estado: "ok", ultimaSync: new Date().toISOString(), mensaje: null, cambiosWeb: cambios });
    } catch (err) {
      const offline = !err.auth && (err.name === "TimeoutError" || err.cause || /fetch failed/i.test(err.message));
      emit({ estado: offline ? "sin-conexion" : "error", mensaje: offline ? "Sin conexión con la web" : err.message });
      if (!offline) console.error("❌ [SYNC]", err.message);
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
    // Serie de esta PC para los códigos de barras automáticos (0-9)
    getSlot: () => Number(getState(getDb(), "slot") ?? 0),
    // Volver a bajar todo de la web (si algo quedó desfasado)
    async resync() {
      setState(getDb(), "lastPull", null);
      persist();
      await tick();
    },
    saveConfig({ url, token }) {
      fs.writeFileSync(loadConfig(userDataDir).file, JSON.stringify({ url: url || DEFAULT_URL, token }, null, 2), "utf8");
    },
    // Vincular con el usuario y contraseña del panel de la web
    async link({ email, password }) {
      const cfg = loadConfig(userDataDir);
      let res;
      try {
        res = await fetch(`${cfg.url}/api/sync/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, deviceId: deviceId(), nombre: os.hostname() }),
          signal: AbortSignal.timeout(30000),
        });
      } catch (_) {
        throw new Error("No hay conexión con la web. Probá de nuevo cuando haya internet.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || "No se pudo vincular");
      setState(getDb(), "slot", data.slot ?? 0);
      persist();
      this.saveConfig({ url: cfg.url === DEFAULT_URL ? undefined : cfg.url, token: data.token });
      await tick();
    },
    // Dejar de sincronizar esta PC. La base recuerda que ya se fusionó, así
    // que volver a vincularla no suma nada dos veces.
    unlink() {
      try {
        fs.unlinkSync(loadConfig(userDataDir).file);
      } catch (_) {
        /* ya no estaba */
      }
      emit({ estado: "sin-configurar", mensaje: "Falta vincular el programa con la web" });
    },
  };
}

module.exports = { ensureSyncSchema, createSync, uuidv5 };
