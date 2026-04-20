const path = require("path");
const fs   = require("fs");

let db = null;
let currentDbPath = null;
const clients = {};

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
      codigo        TEXT    UNIQUE,
      costo         REAL,
      precioFinal   REAL,
      stockInicial  INTEGER NOT NULL DEFAULT 0,
      stock         INTEGER NOT NULL DEFAULT 0,
      talles        TEXT    NOT NULL DEFAULT '',
      talleStock    TEXT    NOT NULL DEFAULT '{}',
      colores       TEXT    NOT NULL DEFAULT '',
      createdAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      updatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
      deletedAt     TEXT
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS Venta (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      productoId  INTEGER,
      marca       TEXT    NOT NULL,
      tipo        TEXT    NOT NULL,
      codigo      TEXT,
      talle       TEXT,
      cantidad    INTEGER NOT NULL DEFAULT 1,
      precioVenta REAL,
      fecha       TEXT    NOT NULL DEFAULT (date('now')),
      notas       TEXT,
      createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // columnas opcionales para DBs viejas
  for (const sql of [
    `ALTER TABLE Producto ADD COLUMN talleStock   TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE Producto ADD COLUMN colores      TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE Producto ADD COLUMN stockInicial INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try { database.run(sql); } catch (_) {}
  }
}

async function initDb(dbPath) {
  if (clients[dbPath]) {
    db = clients[dbPath];
    currentDbPath = dbPath;
    return db;
  }

  const initSqlJs = require("sql.js");
  const SQL = await initSqlJs();

  let fileBuffer;
  if (fs.existsSync(dbPath)) {
    fileBuffer = fs.readFileSync(dbPath);
  }

  const database = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Guardar en disco después de cada operación
  function persist() {
    const data = database.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  // Wrapper para run que persiste
  const originalRun = database.run.bind(database);
  database.run = function(...args) {
    const result = originalRun(...args);
    persist();
    return result;
  };

  runMigrations(database);

  clients[dbPath] = database;
  db = database;
  currentDbPath = dbPath;
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
}

module.exports = { initDb, getDb, switchDb, closeDb };