import { ipcMain } from 'electron'
import type { DashboardStats, ShopSettings } from '@shared/types'
import { getDb } from '../db'
import { setSetting } from './helpers'

export function registerDashboardHandlers(): void {
  ipcMain.handle('dashboard:stats', (): DashboardStats => {
    const db = getDb()
    const scalar = (sql: string): number => {
      const row = db.prepare(sql).get() as Record<string, number>
      return Object.values(row)[0] ?? 0
    }

    return {
      totalCustomers: scalar('SELECT COUNT(*) AS n FROM customers'),
      pendingOrders: scalar("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
      deliveredOrders: scalar("SELECT COUNT(*) AS n FROM orders WHERE status = 'delivered'")
    }
  })
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (): ShopSettings => {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string | null }[]
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']))
    return {
      shopName: map.shop_name || 'My Tailors',
      shopAddress: map.shop_address || '',
      shopPhone: map.shop_phone || '',
      shopNameUrdu: 'shop_name_urdu' in map ? map.shop_name_urdu : 'السعید ٹیلرز',
      shopAddressUrdu: 'shop_address_urdu' in map ? map.shop_address_urdu : 'وشود پنجگڑ',
      printerName: map.printer_name || null,
      printDialog: map.print_dialog === '1',
      passwordChanged: map.password_changed === 'true'
    }
  })

  ipcMain.handle('settings:update', (_e, data: Partial<ShopSettings>) => {
    if (typeof data.shopName === 'string') setSetting('shop_name', data.shopName.trim())
    if (typeof data.shopAddress === 'string') setSetting('shop_address', data.shopAddress.trim())
    if (typeof data.shopPhone === 'string') setSetting('shop_phone', data.shopPhone.trim())
    if (typeof data.shopNameUrdu === 'string') setSetting('shop_name_urdu', data.shopNameUrdu.trim())
    if (typeof data.shopAddressUrdu === 'string') setSetting('shop_address_urdu', data.shopAddressUrdu.trim())
    if (typeof data.printerName === 'string') setSetting('printer_name', data.printerName.trim())
    if (typeof data.printDialog === 'boolean') setSetting('print_dialog', data.printDialog ? '1' : '0')
  })
}
