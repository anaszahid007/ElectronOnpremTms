import { app, BrowserWindow, screen, shell } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { closeDb } from './db'
import { registerIpcHandlers } from './ipc'
import { setMainWindow } from './print'

// One instance only — two processes sharing tailor_v2.db and the slip counter
// cause SQLite busy errors, racing writes, and duplicate slip numbers.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  let mainWindowRef: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (mainWindowRef) {
      if (mainWindowRef.isMinimized()) mainWindowRef.restore()
      mainWindowRef.focus()
    }
  })

// Dedicated data folder for this app (same in dev and packaged builds),
// so it never collides with other Electron apps that default to "Electron".
app.setPath('userData', join(app.getPath('appData'), 'Tailor Manager'))

const BOUNDS_PATH = join(app.getPath('userData'), 'window.json')

interface SavedBounds {
  x?: number
  y?: number
  width: number
  height: number
  maximized?: boolean
  fullscreen?: boolean
}

function loadBounds(): SavedBounds | null {
  try {
    if (!existsSync(BOUNDS_PATH)) return null
    const b = JSON.parse(readFileSync(BOUNDS_PATH, 'utf-8')) as SavedBounds
    if (typeof b.width === 'number' && typeof b.height === 'number' && b.width >= 1024 && b.height >= 480) {
      return b
    }
    return null
  } catch {
    return null
  }
}

function saveBounds(win: BrowserWindow): void {
  try {
    if (win.isMinimized()) return
    const maximized = win.isMaximized()
    const fullscreen = win.isFullScreen()
    // While maximized/fullscreen, persist the normal (restore) bounds so
    // un-maximizing later lands on the correct size/position.
    const b = maximized || fullscreen ? win.getNormalBounds() : win.getBounds()
    writeFileSync(
      BOUNDS_PATH,
      JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height, maximized, fullscreen })
    )
  } catch {
    // best-effort — never block app close on save failure
  }
}

function createMainWindow(): BrowserWindow {
  const saved = loadBounds()
  let width: number
  let height: number
  if (saved) {
    width = saved.width
    height = saved.height
  } else {
    // Fit the display work area (excludes taskbar) so the window never overflows the screen.
    const wa = screen.getPrimaryDisplay().workArea
    width = Math.min(1280, Math.round(wa.width * 0.9))
    height = Math.min(800, Math.round(wa.height * 0.85))
  }

  const win = new BrowserWindow({
    width,
    height,
    ...(saved?.x !== undefined && saved?.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 1024,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    title: 'Tailor Manager',
    backgroundColor: '#f8fafc',
    icon: join(app.getAppPath(), 'build', 'TMS_Logo.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      // Keep DevTools for debugging in dev; disable in the packaged build so
      // Ctrl+Shift+I on the login screen can't reach the data without a password.
      devTools: !app.isPackaged
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    // On Windows, DWM invisible borders can slightly expand the restored size.
    // Re-save the actual bounds so repeated launches don't drift larger each time.
    if (saved) saveBounds(win)
  })

  win.on('close', () => saveBounds(win))

  // Only ever open http(s)/mailto links externally; block file:, javascript:,
  // and custom protocol handlers (e.g. ms-msdt:) that can execute code on Windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url)
      if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') {
        void shell.openExternal(url)
      }
    } catch {
      // invalid URL — deny
    }
    return { action: 'deny' }
  })

  // Keep the app from being navigated away to an external site.
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    const own =
      (devUrl && url.startsWith(devUrl)) ||
      url.startsWith('file://') ||
      url.includes('#/')
    if (!own) event.preventDefault()
  })

  if (saved?.fullscreen) win.fullScreen = true
  else if (saved?.maximized) win.maximize()

  setMainWindow(win)
  mainWindowRef = win

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDb()
    app.quit()
  }
})
} // end gotSingleInstanceLock
