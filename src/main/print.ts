import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import type { Measurement } from '@shared/types'
import { getDb } from './db'
import { getSetting, setSetting } from './ipc/helpers'
import { isDialogOnlyPrinter } from '@shared/constants'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export async function listPrinters(): Promise<string[]> {
  if (!mainWindow) return []
  const printers = await mainWindow.webContents.getPrintersAsync()
  return printers.map((p) => p.name)
}

export function registerPrintHandlers(): void {
  ipcMain.handle('print:slip', async (_e, customerId: number, options?: { preview?: boolean; orderId?: number }) => {
    return await printSlip(customerId, options?.preview === true, options?.orderId)
  })
  ipcMain.handle('print:listPrinters', () => listPrinters())
  ipcMain.handle('print:slipReady', (_e, slipNumber: number) => {
    pendingPrints.get(slipNumber)?.(slipNumber)
    pendingPrints.delete(slipNumber)
  })
}

// One resolver per in-flight slip (keyed by slip number) so concurrent prints
// cannot cross-resolve each other's ready signals.
const pendingPrints = new Map<number, (slipNumber: number) => void>()

async function printSlip(customerId: number, preview: boolean, orderId?: number): Promise<'printed' | 'canceled' | 'preview'> {
  const db = getDb()
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId)
  if (!customer) throw new Error('Customer not found')
  const measurement = db.prepare('SELECT * FROM measurements WHERE customer_id = ?').get(customerId) as
    | Measurement
    | undefined

  if (!measurement) {
    throw new Error('No measurements saved for this customer yet. Save measurements first, then print the slip.')
  }

  const slipNumber = nextSlipNumber()

  const win = new BrowserWindow({
    show: false,
    width: 850,
    height: 1160,
    autoHideMenuBar: !preview,
    title: `Slip #${slipNumber}`,
    icon: join(app.getAppPath(), 'build', 'TMS_Logo.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  const readyPromise = new Promise<number>((resolve) => {
    pendingPrints.set(slipNumber, resolve)
  })

  const query = `slip=${slipNumber}${orderId ? `&order=${orderId}` : ''}`
  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  try {
    if (rendererUrl) {
      await win.loadURL(`${rendererUrl}/#/print/slip/${customerId}?${query}`)
    } else {
      await win.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: `/print/slip/${customerId}?${query}`
      })
    }
  } catch (err) {
    // Never leave a hidden window behind on a failed load (zombie process).
    pendingPrints.delete(slipNumber)
    win.destroy()
    throw err
  }

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
  await Promise.race([readyPromise, timeout])
  pendingPrints.delete(slipNumber)

  if (preview) {
    win.show()
    return 'preview'
  }

  // Silent print when a printer is connected; otherwise fall back to the system
  // print dialog, which offers Save as PDF / Microsoft Print to PDF as destinations.
  const printers = await win.webContents.getPrintersAsync()
  const configured = getSetting('printer_name') || undefined
  const askEveryTime = getSetting('print_dialog') === '1'
  let silent = true
  let deviceName: string | undefined
  if (askEveryTime || printers.length === 0) {
    silent = false
    deviceName = undefined
  } else if (configured && printers.some((p) => p.name === configured)) {
    deviceName = configured
  } else {
    const fallback = printers.find((p) => (p as { isDefault?: boolean }).isDefault) ?? printers[0]
    deviceName = fallback.name
  }

  // Fax / OneNote / XPS cannot print silently — their driver UI only works
  // through the Windows print dialog (silent attempts fail with
  // "Invalid printer settings" or produce stray .oxps files).
  if (deviceName && isDialogOnlyPrinter(deviceName)) {
    silent = false
    deviceName = undefined
  }

  if (!silent) {
    // The Windows print dialog (and the driver's Save-as window) is parented to
    // this window — it must be visible or the dialog never appears on screen.
    win.show()
    win.focus()
  }

  const result = await new Promise<string>((resolve) => {
    win.webContents.print(
      { silent, deviceName, printBackground: true, margins: { marginType: 'default' } },
      (success, failureReason) => resolve(success ? '' : failureReason || 'Unknown error')
    )
  })

  win.close()

  if (!result) return 'printed'

  if (/cancel/i.test(result)) {
    // User canceled (e.g. dismissed the Save-as dialog when no printer is connected).
    // Deliberately do NOT roll the counter back — rewinding races a concurrent
    // print and hands the same slip number to two customers. Skipped numbers
    // are harmless; duplicates corrupt the ledger.
    return 'canceled'
  }

  throw new Error(
    `Could not print the slip (${result}). Check the selected printer in Settings, or turn on "Ask before printing" to choose a printer each time.`
  )
}

function nextSlipNumber(): number {
  const current = Number(getSetting('slip_counter') ?? '0') + 1
  setSetting('slip_counter', String(current))
  return current
}
