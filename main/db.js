const path = require("path");
const fs   = require("fs");

let db = null;
let currentDbPath = null;
const clients = {};
let persistFunc = null;

function getDb() {
  if (!db) throw new Error("DB no inicializada");
  return db;
}

function runMigrations(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS Marca (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT    NOT NULL UNIQUE,
      createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS TipoPrenda (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre    TEXT    NOT NULL UNIQUE,
      curva     TEXT    NOT NULL DEFAULT 'none',
      createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS Producto (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      marca         TEXT    NOT NULL,
      tipo          TEXT    NOT NULL,
      codigo        TEXT,
      costo         REAL,
      precioFinal   REAL,
      talles        TEXT    NOT NULL DEFAULT '',
      colores       TEXT    NOT NULL DEFAULT '',
      createdAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      deletedAt     TEXT
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS ProductoBarcode (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      productoId  INTEGER NOT NULL,
      barcode     TEXT    NOT NULL UNIQUE,
      talle       TEXT,
      color       TEXT,
      cantidad    INTEGER NOT NULL DEFAULT 0,
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (productoId) REFERENCES Producto(id) ON DELETE CASCADE
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS Lote (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha       TEXT    NOT NULL DEFAULT (date('now')),
      cliente     TEXT,
      metodoPago  TEXT,
      total       REAL    NOT NULL DEFAULT 0,
      estado      TEXT    NOT NULL DEFAULT 'abierto',
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      closedAt    TEXT
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS Venta (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      loteId      INTEGER,
      productoId  INTEGER,
      barcodeId   INTEGER,
      marca       TEXT    NOT NULL,
      tipo        TEXT    NOT NULL,
      codigo      TEXT,
      talle       TEXT,
      color       TEXT,
      cantidad    INTEGER NOT NULL DEFAULT 1,
      precioVenta REAL,
      fecha       TEXT    NOT NULL DEFAULT (date('now')),
      notas       TEXT,
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (loteId) REFERENCES Lote(id) ON DELETE CASCADE
    )
  `);
  // Migración: columnas viejas para compatibilidad
  for (const sql of [
    `ALTER TABLE Producto ADD COLUMN talleStock   TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE Producto ADD COLUMN colores      TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE Producto ADD COLUMN stockInicial INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE Producto ADD COLUMN barcode      TEXT DEFAULT ''`,
    `ALTER TABLE Producto ADD COLUMN stock        INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try { database.run(sql); } catch (_) {}
  }

  // Migración: agregar columnas nuevas a Venta
  for (const sql of [
    `ALTER TABLE Venta ADD COLUMN loteId INTEGER`,
    `ALTER TABLE Venta ADD COLUMN barcodeId INTEGER`,
    `ALTER TABLE Venta ADD COLUMN color TEXT`,
  ]) {
    try { database.run(sql); } catch (_) {}
  }

  // Migración de temporada eliminada - ya no se usa

  // Migración: agregar columnas cliente y metodoPago a Lote
  try { database.run(`ALTER TABLE Lote ADD COLUMN cliente TEXT`); } catch (_) {}
  try { database.run(`ALTER TABLE Lote ADD COLUMN metodoPago TEXT`); } catch (_) {}

  // Migración: mover datos de Producto viejo al nuevo modelo
  try {
    // Verificar si hay productos con barcode que no se hayan migrado
    const productosViejos = database.exec(`
      SELECT p.id, p.barcode, p.talleStock, p.stock
      FROM Producto p
      WHERE p.barcode IS NOT NULL
        AND p.barcode != ''
        AND NOT EXISTS (
          SELECT 1 FROM ProductoBarcode pb WHERE pb.productoId = p.id
        )
    `);

    if (productosViejos.length > 0 && productosViejos[0].values) {
      for (const row of productosViejos[0].values) {
        const [productoId, barcode, talleStockStr, stock] = row;

        // Parsear talleStock
        let talleStock = {};
        try { talleStock = JSON.parse(talleStockStr || "{}"); } catch (_) {}

        // Si tiene talleStock, crear un barcode por cada talle
        if (Object.keys(talleStock).length > 0) {
          for (const [talle, cantidad] of Object.entries(talleStock)) {
            if (cantidad > 0) {
              // Generar barcode único para este talle
              const talleSuffix = talle.replace(/\s/g, '');
              const newBarcode = `${barcode}_${talleSuffix}`;
              database.run(
                `INSERT OR IGNORE INTO ProductoBarcode (productoId, barcode, talle, cantidad, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [productoId, newBarcode, talle, cantidad]
              );
            }
          }
        } else if (stock > 0) {
          // Sin talles, crear un solo barcode con el stock total
          database.run(
            `INSERT OR IGNORE INTO ProductoBarcode (productoId, barcode, cantidad, createdAt, updatedAt)
             VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
            [productoId, barcode, stock]
          );
        }
      }
    }
  } catch (err) {
    console.error("Error migrando productos viejos:", err);
  }

  // Migración: Eliminar restricción UNIQUE de Producto.barcode
  try {
    // Verificar si necesitamos migrar
    const tableInfo = database.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='Producto'");
    const needsMigration = tableInfo.length > 0 && tableInfo[0].values[0][0].includes('UNIQUE');

    if (needsMigration || true) { // Siempre intentar por si acaso
      // Crear tabla temporal sin UNIQUE en barcode
      database.run(`
        CREATE TABLE IF NOT EXISTS Producto_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          marca         TEXT    NOT NULL,
          tipo          TEXT    NOT NULL,
          codigo        TEXT,
          costo         REAL,
          precioFinal   REAL,
          talles        TEXT    NOT NULL DEFAULT '',
          colores       TEXT    NOT NULL DEFAULT '',
          talleStock    TEXT    NOT NULL DEFAULT '{}',
          stockInicial  INTEGER NOT NULL DEFAULT 0,
          barcode       TEXT,
          stock         INTEGER NOT NULL DEFAULT 0,
          createdAt     TEXT    NOT NULL DEFAULT (datetime('now')),
          updatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
          deletedAt     TEXT
        )
      `);

      // Copiar datos
      database.run(`
        INSERT OR IGNORE INTO Producto_new
        SELECT id, marca, tipo, codigo, costo, precioFinal, talles, colores,
               COALESCE(talleStock, '{}'), COALESCE(stockInicial, 0),
               barcode, COALESCE(stock, 0), createdAt, updatedAt, deletedAt
        FROM Producto
      `);

      // Eliminar tabla vieja y renombrar
      database.run("DROP TABLE IF EXISTS Producto");
      database.run("ALTER TABLE Producto_new RENAME TO Producto");
    }
  } catch (err) {
    console.error("Error en migración de Producto:", err);
  }

  // Migración: Asegurar que barcode sea UNIQUE (un código = una prenda)
  try {
    console.log("🔄 [DB] Verificando estructura de ProductoBarcode...");

    // Recrear tabla con barcode UNIQUE
    database.run(`
      CREATE TABLE IF NOT EXISTS ProductoBarcode_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        productoId  INTEGER NOT NULL,
        barcode     TEXT    NOT NULL UNIQUE,
        talle       TEXT,
        color       TEXT,
        cantidad    INTEGER NOT NULL DEFAULT 0,
        createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
        updatedAt   TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (productoId) REFERENCES Producto(id) ON DELETE CASCADE
      )
    `);

    // Copiar datos, eliminando duplicados (mantener solo el primero)
    // Esto limpiará los códigos duplicados que se crearon por error
    database.run(`
      INSERT OR IGNORE INTO ProductoBarcode_new
      SELECT id, productoId, barcode, talle, color, cantidad, createdAt, updatedAt
      FROM ProductoBarcode
      ORDER BY id ASC
    `);

    // Eliminar tabla vieja y renombrar
    database.run("DROP TABLE IF EXISTS ProductoBarcode");
    database.run("ALTER TABLE ProductoBarcode_new RENAME TO ProductoBarcode");

    console.log("✅ [DB] Migración de ProductoBarcode completada (barcode UNIQUE)");
  } catch (err) {
    console.error("❌ [DB] Error en migración de ProductoBarcode:", err);
  }

  // Crear índices en ProductoBarcode
  try {
    database.run("CREATE INDEX IF NOT EXISTS idx_producto_barcode_producto ON ProductoBarcode(productoId)");
    database.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_barcode_barcode ON ProductoBarcode(barcode)");
  } catch (err) {
    console.error("Error creando índices:", err);
  }
}

async function initDb(dbPath) {
  console.log(`🔧 [DB] Inicializando DB única en: ${dbPath}`);

  // Si ya existe una DB inicializada, usarla (solo una DB para todo)
  if (db && currentDbPath === dbPath) {
    console.log(`🔧 [DB] Usando DB existente`);
    return db;
  }

  if (clients[dbPath]) {
    console.log(`🔧 [DB] Usando DB existente en cache`);
    db = clients[dbPath];
    currentDbPath = dbPath;
    return db;
  }

  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  let fileBuffer;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
    console.log(`🔧 [DB] Archivo encontrado, tamaño: ${fileBuffer.length} bytes`);
  } else {
    console.log(`🔧 [DB] Creando nueva base de datos`);
  }

  const database = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Guardar en disco después de cada operación
  function persist() {
    const data = database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log(`💾 [DB] Persistido a: ${dbPath} (${buffer.length} bytes)`);
  }

  // Wrapper para run que persiste
  const originalRun = database.run.bind(database);
  database.run = function(...args) {
    const result = originalRun(...args);
    persist();
    console.log("💾 [DB] Auto-persist después de run()");
    return result;
  };

  runMigrations(database);

  clients[dbPath] = database;
  db = database;
  currentDbPath = dbPath;
  persistFunc = persist;
  return db;
}

async function switchDb(dbPath) {
  return initDb(dbPath);
}

function closeDb() {
  Object.values(clients).forEach((c) => { try { c.close(); } catch (_) {} });
  Object.keys(clients).forEach((k) => delete clients[k]);
  db = null;
  currentDbPath = null;
  persistFunc = null;
}

function persist() {
  if (persistFunc) persistFunc();
}

function getCurrentDbPath() {
  return currentDbPath;
}

module.exports = { initDb, getDb, switchDb, closeDb, persist, getCurrentDbPath };
