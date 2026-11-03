import { ipcMain } from 'electron'
import { changePassword, getSession, login, logout } from '../auth'
import { registerCustomerHandlers } from './customers'
import { registerMeasurementHandlers } from './measurements'
import { registerOrderHandlers } from './orders'
import { registerDashboardHandlers, registerSettingsHandlers } from './dashboard'
import { registerBackupHandlers } from './backup'
import { registerPrintHandlers } from '../print'

export function registerIpcHandlers(): void {
  ipcMain.handle('auth:login', (_e, username: string, password: string) => login(username, password))
  ipcMain.handle('auth:logout', () => logout())
  ipcMain.handle('auth:session', () => getSession())
  ipcMain.handle('auth:changePassword', (_e, oldPassword: string, newPassword: string) =>
    changePassword(oldPassword, newPassword)
  )

  registerCustomerHandlers()
  registerMeasurementHandlers()
  registerOrderHandlers()
  registerDashboardHandlers()
  registerSettingsHandlers()
  registerBackupHandlers()
  registerPrintHandlers()
}
