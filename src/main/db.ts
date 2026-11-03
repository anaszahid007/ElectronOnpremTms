import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { app } from 'electron'
import { join } from 'path'
import { ALL_MEASUREMENT_KEYS } from '@shared/measurementFields'
import { hashPassword } from './auth'

export const DB_NAME = 'tailor_v2.db'

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!db) {
    const dbPath = join(app.getPath('userData'), DB_NAME)
    mkdirSync(app.getPath('userData'), { recursive: true })
    const conn = new DatabaseSync(dbPath)
    conn.exec('PRAGMA journal_mode = WAL')
    conn.exec('PRAGMA foreign_keys = ON')
    try {
      initSchema(conn)
      ensureMeasurementColumns(conn)
    } catch (err) {
      conn.close()
      throw err
    }
    db = conn
  }
  return db
}

function initSchema(db: DatabaseSync): void {
  const initialized = !!db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'"
  ).get()
  if (initialized) return

  db.exec('BEGIN TRANSACTION')

  try {
    // 1. Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `)

    // 2. Customers table (clean v2 shape: serial_number, full_name, phone)
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_number INTEGER NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `)

    // 3. Measurements table (all 24 measurement keys)
    db.exec(`
      CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
        ${ALL_MEASUREMENT_KEYS.map((k) => `${k} TEXT`).join(',\n        ')},
        special_notes TEXT,
        measured_by TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `)

    // 4. Orders table (with urgent flag)
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        garment_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered')),
        urgent INTEGER NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        advance_paid REAL NOT NULL DEFAULT 0,
        order_date TEXT NOT NULL,
        delivery_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `)

    // 5. Settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `)

    // 6. FTS5 virtual table for fast prefix search
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS customers_fts USING fts5(
        full_name, phone, serial_number,
        content='customers', content_rowid='id'
      );
    `)

    // 7. FTS5 sync triggers
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS customers_fts_ai AFTER INSERT ON customers BEGIN
        INSERT INTO customers_fts(rowid, full_name, phone, serial_number)
        VALUES (new.id, new.full_name, new.phone, new.serial_number);
      END;

      CREATE TRIGGER IF NOT EXISTS customers_fts_ad AFTER DELETE ON customers BEGIN
        INSERT INTO customers_fts(customers_fts, rowid, full_name, phone, serial_number)
        VALUES ('delete', old.id, old.full_name, old.phone, old.serial_number);
      END;

      CREATE TRIGGER IF NOT EXISTS customers_fts_au AFTER UPDATE ON customers BEGIN
        INSERT INTO customers_fts(customers_fts, rowid, full_name, phone, serial_number)
        VALUES ('delete', old.id, old.full_name, old.phone, old.serial_number);
        INSERT INTO customers_fts(rowid, full_name, phone, serial_number)
        VALUES (new.id, new.full_name, new.phone, new.serial_number);
      END;
    `)

    // 8. Indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_serial ON customers(serial_number);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC, id DESC);
    `)

    // 9. Default settings
    const settings: Record<string, string> = {
      shop_name: 'Al-Saeed Tailors',
      shop_address: 'Main Bazar',
      shop_phone: '',
      shop_name_urdu: 'السعید ٹیلرز',
      shop_address_urdu: 'وشبود پنجگور',
      printer_name: '',
      print_dialog: '0',
      slip_counter: '0',
      password_changed: 'false',
      serial_counter: '0'
    }

    const insertSetting = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
    )
    for (const [key, value] of Object.entries(settings)) {
      insertSetting.run(key, value)
    }

    // 10. Default admin user
    const { salt, hash } = hashPassword('admin123')
    db.prepare('INSERT OR IGNORE INTO users (username, password_hash, salt) VALUES (?, ?, ?)').run(
      'admin', hash, salt
    )

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function closeDb(): void {
  db?.close()
  db = null
}

function ensureMeasurementColumns(db: DatabaseSync): void {
  const tableExists = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='measurements'").get()
  if (!tableExists) return
  const cols = new Set((db.prepare("PRAGMA table_info('measurements')").all() as { name: string }[]).map((c) => c.name))
  for (const k of ALL_MEASUREMENT_KEYS) {
    if (!cols.has(k)) {
      db.exec(`ALTER TABLE measurements ADD COLUMN ${k} TEXT`)
    }
  }
}
