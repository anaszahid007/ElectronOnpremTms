import { ipcMain } from 'electron'
import type { Order, OrderInput, OrderStatus, Paginated } from '@shared/types'
import { ORDER_STATUSES } from '@shared/measurementFields'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@shared/constants'
import { getDb } from '../db'
import { optionalString, requireNumber, requireString, today } from './helpers'

interface OrderRow {
  id: number
  customer_id: number
  customer_name: string
  customer_phone: string
  garment_type: string
  quantity: number
  status: OrderStatus
  urgent: number
  total_amount: number
  advance_paid: number
  order_date: string
  delivery_date: string | null
  notes: string | null
}

const ORDER_SELECT = `
  SELECT o.*, c.full_name AS customer_name, c.phone AS customer_phone,
         (o.total_amount - o.advance_paid) AS balance
  FROM orders o JOIN customers c ON c.id = o.customer_id`

function toOrder(row: OrderRow & { balance: number }): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    garmentType: row.garment_type,
    quantity: row.quantity,
    status: row.status,
    urgent: row.urgent === 1,
    totalAmount: row.total_amount,
    advancePaid: row.advance_paid,
    balance: row.balance,
    orderDate: row.order_date,
    deliveryDate: row.delivery_date,
    notes: row.notes
  }
}

export function registerOrderHandlers(): void {
  ipcMain.handle(
    'orders:list',
    (
      _e,
      filter?: {
        status?: OrderStatus | 'all'
        customerId?: number
        search?: string
        page?: number
        pageSize?: number
        /** Skip the COUNT(*) when the caller only needs rows (e.g. dashboard recent orders). */
        skipCount?: boolean
      }
    ): Paginated<Order> => {
      const db = getDb()
      const conditions: string[] = []
      const params: (string | number)[] = []

      if (filter?.status && filter.status !== 'all') {
        if (!ORDER_STATUSES.includes(filter.status)) throw new Error('Invalid status')
        conditions.push('o.status = ?')
        params.push(filter.status)
      }
      if (filter?.customerId) {
        conditions.push('o.customer_id = ?')
        params.push(filter.customerId)
      }
      const search = filter?.search?.trim()
      const hasSearch = !!search
      if (search) {
        const clean = search.replace(/^#/, '')
        conditions.push(`(c.full_name LIKE ? OR c.phone LIKE ? OR CAST(c.serial_number AS TEXT) LIKE ? OR CAST(o.id AS TEXT) LIKE ?)`)
        const q = `%${clean}%`
        params.push(q, q, q, q)
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      // The customers JOIN is only needed to match on name/phone/serial — skip it when not
      // searching so the count can run as an index-only scan instead of a join over every row.
      const countFrom = hasSearch ? 'FROM orders o JOIN customers c ON c.id = o.customer_id' : 'FROM orders o'
      const total = filter?.skipCount
        ? 0
        : (
            db.prepare(`SELECT COUNT(*) AS n ${countFrom} ${where}`).get(...params) as unknown as { n: number }
          ).n

      const page = Math.max(1, filter?.page ?? 1)
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filter?.pageSize ?? DEFAULT_PAGE_SIZE))
      const rows = db
        .prepare(`${ORDER_SELECT} ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, (page - 1) * pageSize) as unknown as (OrderRow & { balance: number })[]

      return { rows: rows.map(toOrder), total }
    }
  )

  ipcMain.handle('orders:get', (_e, id: number) => {
    const row = getDb().prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id) as (OrderRow & { balance: number }) | undefined
    if (!row) throw new Error('Order not found')
    return toOrder(row)
  })

  ipcMain.handle('orders:create', (_e, data: Partial<OrderInput>) => {
    const customerId = requireNumber(data.customerId, 'Customer')
    const garmentType = requireString(data.garmentType, 'Garment type')
    const quantity = Math.max(1, Math.trunc(requireNumber(data.quantity ?? 1, 'Quantity')))
    const totalAmount = requireNumber(data.totalAmount ?? 0, 'Total amount')
    const advancePaid = requireNumber(data.advancePaid ?? 0, 'Advance')
    if (advancePaid > totalAmount) throw new Error('Advance cannot be more than total amount')

    const orderDate = optionalString(data.orderDate) ?? today()
    const deliveryDate = optionalString(data.deliveryDate)
    if (deliveryDate && deliveryDate < orderDate) {
      throw new Error('Delivery date cannot be before the order date')
    }
    const urgent = data.urgent ? 1 : 0

    const result = getDb()
      .prepare(
        `INSERT INTO orders (customer_id, garment_type, quantity, urgent, total_amount, advance_paid, order_date, delivery_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(customerId, garmentType, quantity, urgent, totalAmount, advancePaid, orderDate, deliveryDate, optionalString(data.notes))
    return Number(result.lastInsertRowid)
  })

  ipcMain.handle('orders:update', (_e, data: Partial<OrderInput> & { id: number }) => {
    const id = requireNumber(data.id, 'Order id')
    const garmentType = requireString(data.garmentType, 'Garment type')
    const quantity = Math.max(1, Math.trunc(requireNumber(data.quantity ?? 1, 'Quantity')))
    const totalAmount = requireNumber(data.totalAmount ?? 0, 'Total amount')
    const advancePaid = requireNumber(data.advancePaid ?? 0, 'Advance')
    if (advancePaid > totalAmount) throw new Error('Advance cannot be more than total amount')

    const orderDate = optionalString(data.orderDate) ?? today()
    const deliveryDate = optionalString(data.deliveryDate)
    if (deliveryDate && deliveryDate < orderDate) {
      throw new Error('Delivery date cannot be before the order date')
    }

    const result = getDb()
      .prepare(
        `UPDATE orders SET garment_type = ?, quantity = ?, urgent = ?, total_amount = ?, advance_paid = ?,
         order_date = ?, delivery_date = ?, notes = ? WHERE id = ?`
      )
      .run(
        garmentType,
        quantity,
        data.urgent ? 1 : 0,
        totalAmount,
        advancePaid,
        orderDate,
        deliveryDate,
        optionalString(data.notes),
        id
      )
    if (result.changes === 0) throw new Error('Order not found')
  })

  ipcMain.handle('orders:updateStatus', (_e, id: number, status: OrderStatus) => {
    if (!ORDER_STATUSES.includes(status)) throw new Error('Invalid status')
    const result = getDb().prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id)
    if (result.changes === 0) throw new Error('Order not found')
  })

  ipcMain.handle('orders:bulkUpdateStatus', (_e, ids: number[], status: OrderStatus) => {
    if (!ORDER_STATUSES.includes(status)) throw new Error('Invalid status')
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('No orders selected')
    const db = getDb()
    const placeholders = ids.map(() => '?').join(', ')
    db.exec('BEGIN')
    try {
      const result = db.prepare(`UPDATE orders SET status = ? WHERE id IN (${placeholders})`).run(status, ...ids)
      db.exec('COMMIT')
      return Number(result.changes)
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  })

  ipcMain.handle('orders:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM orders WHERE id = ?').run(id)
  })
}
