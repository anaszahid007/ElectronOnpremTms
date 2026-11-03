import { ipcMain } from 'electron'
import type { Customer, Paginated } from '@shared/types'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@shared/constants'
import { getDb } from '../db'
import { requireString, requireNumber, getSetting, setSetting } from './helpers'

interface CustomerRow {
  id: number
  full_name: string
  phone: string
  serial_number: number
  created_at: string
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    serialNumber: row.serial_number,
    fullName: row.full_name,
    phone: row.phone,
    createdAt: row.created_at
  }
}

function nextSerialNumber(): number {
  const db = getDb()
  const maxRow = db.prepare('SELECT MAX(serial_number) as m FROM customers').get() as { m: number | null }
  const currentSetting = Number(getSetting('serial_counter') ?? '0')
  const next = Math.max(currentSetting, maxRow?.m ?? 0) + 1
  setSetting('serial_counter', String(next))
  return next
}

/** Builds a safe FTS5 query with quoted prefix tokens to avoid any syntax errors with hyphens, quotes, or boolean keywords. */
function buildFtsQuery(q: string): string | null {
  const tokens = q.match(/[\p{L}\p{N}]+/gu)
  if (!tokens || tokens.length === 0) return null
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ')
}

export function registerCustomerHandlers(): void {
  ipcMain.handle(
    'customers:list',
    (_e, opts?: { search?: string; page?: number; pageSize?: number; sort?: 'name' | 'newest' }): Paginated<Customer> => {
      const db = getDb()
      const rawSearch = (opts?.search ?? '').trim()
      const hasSearch = !!rawSearch
      const page = Math.max(1, opts?.page ?? 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts?.pageSize ?? DEFAULT_PAGE_SIZE))
      const orderBy = opts?.sort === 'newest' ? 'c.created_at DESC, c.id DESC' : 'c.full_name COLLATE NOCASE'

      let total: number = 0
      let rows: CustomerRow[] = []

      if (hasSearch) {
        const ftsQuery = buildFtsQuery(rawSearch)
        if (!ftsQuery) {
          // If search is just non-word characters (like "---"), return empty result cleanly
          return { rows: [], total: 0 }
        }

        try {
          const where = `WHERE customers_fts MATCH ?`
          const params = [ftsQuery]

          total = (
            db.prepare(`SELECT COUNT(*) AS n FROM customers_fts ${where}`).get(...params) as unknown as { n: number }
          ).n

          rows = db
            .prepare(`
              SELECT c.id, c.full_name, c.phone, c.serial_number, c.created_at
              FROM customers c
              JOIN customers_fts f ON f.rowid = c.id
              ${where}
              ORDER BY ${orderBy}
              LIMIT ? OFFSET ?
            `)
            .all(...params, pageSize, (page - 1) * pageSize) as unknown as CustomerRow[]
        } catch {
          // Fallback to safe LIKE search if FTS ever encounters an issue
          const qParam = `%${rawSearch}%`
          const likeWhere = `WHERE c.full_name LIKE ? OR c.phone LIKE ? OR CAST(c.serial_number AS TEXT) LIKE ?`
          total = (
            db.prepare(`SELECT COUNT(*) AS n FROM customers c ${likeWhere}`).get(qParam, qParam, qParam) as unknown as { n: number }
          ).n

          rows = db
            .prepare(`
              SELECT c.id, c.full_name, c.phone, c.serial_number, c.created_at
              FROM customers c
              ${likeWhere}
              ORDER BY ${orderBy}
              LIMIT ? OFFSET ?
            `)
            .all(qParam, qParam, qParam, pageSize, (page - 1) * pageSize) as unknown as CustomerRow[]
        }
      } else {
        total = (db.prepare('SELECT COUNT(*) AS n FROM customers').get() as unknown as { n: number }).n

        rows = db
          .prepare(`SELECT c.id, c.full_name, c.phone, c.serial_number, c.created_at FROM customers c ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
          .all(pageSize, (page - 1) * pageSize) as unknown as CustomerRow[]
      }

      return { rows: rows.map(toCustomer), total }
    }
  )

  ipcMain.handle('customers:get', (_e, id: number) => {
    const row = getDb()
      .prepare('SELECT id, full_name, phone, serial_number, created_at FROM customers WHERE id = ?')
      .get(id) as CustomerRow | undefined
    if (!row) throw new Error('Customer not found')
    return toCustomer(row)
  })

  ipcMain.handle('customers:create', (_e, data: Partial<Customer>) => {
    const fullName = requireString(data.fullName, 'Full name')
    const phone = requireString(data.phone, 'Phone')
    const serialNumber = nextSerialNumber()
    const result = getDb()
      .prepare('INSERT INTO customers (full_name, phone, serial_number) VALUES (?, ?, ?)')
      .run(fullName, phone, serialNumber)
    return Number(result.lastInsertRowid)
  })

  ipcMain.handle('customers:update', (_e, data: Partial<Customer> & { id: number }) => {
    const id = requireNumber(data.id, 'Customer id')
    const fullName = requireString(data.fullName, 'Full name')
    const phone = requireString(data.phone, 'Phone')
    const result = getDb()
      .prepare(
        `UPDATE customers SET full_name = ?, phone = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(fullName, phone, id)
    if (result.changes === 0) throw new Error('Customer not found')
  })

  ipcMain.handle('customers:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM customers WHERE id = ?').run(id)
  })
}