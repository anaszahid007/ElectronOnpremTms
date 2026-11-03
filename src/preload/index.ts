import { contextBridge, ipcRenderer } from 'electron'
import type {
  BackupResult,
  Customer,
  DashboardStats,
  LoginResult,
  Measurement,
  Order,
  OrderInput,
  OrderStatus,
  Paginated,
  ShopSettings,
  User
} from '../shared/types'

const api = {
  auth: {
    login: (username: string, password: string): Promise<LoginResult> =>
      ipcRenderer.invoke('auth:login', username, password),
    logout: (): Promise<void> => ipcRenderer.invoke('auth:logout'),
    session: (): Promise<User | null> => ipcRenderer.invoke('auth:session'),
    changePassword: (oldPassword: string, newPassword: string): Promise<{ error?: string }> =>
      ipcRenderer.invoke('auth:changePassword', oldPassword, newPassword)
  },
  customers: {
    list: (opts?: { search?: string; page?: number; pageSize?: number; sort?: 'name' | 'newest' }): Promise<
      Paginated<Customer>
    > => ipcRenderer.invoke('customers:list', opts),
    get: (id: number): Promise<Customer> => ipcRenderer.invoke('customers:get', id),
    create: (data: Partial<Customer>): Promise<number> => ipcRenderer.invoke('customers:create', data),
    update: (data: Partial<Customer> & { id: number }): Promise<void> =>
      ipcRenderer.invoke('customers:update', data),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('customers:delete', id)
  },
  measurements: {
    get: (customerId: number): Promise<Measurement | null> => ipcRenderer.invoke('measurements:get', customerId),
    save: (data: {
      customerId: number
      values: Record<string, string | null>
      specialNotes: string | null
    }): Promise<void> => ipcRenderer.invoke('measurements:save', data)
  },
  orders: {
    list: (filter?: {
      status?: OrderStatus | 'all'
      customerId?: number
      search?: string
      page?: number
      pageSize?: number
      skipCount?: boolean
    }): Promise<Paginated<Order>> => ipcRenderer.invoke('orders:list', filter),
    get: (id: number): Promise<Order> => ipcRenderer.invoke('orders:get', id),
    create: (data: Partial<OrderInput>): Promise<number> => ipcRenderer.invoke('orders:create', data),
    update: (data: Partial<OrderInput> & { id: number }): Promise<void> => ipcRenderer.invoke('orders:update', data),
    updateStatus: (id: number, status: OrderStatus): Promise<void> =>
      ipcRenderer.invoke('orders:updateStatus', id, status),
    bulkUpdateStatus: (ids: number[], status: OrderStatus): Promise<number> =>
      ipcRenderer.invoke('orders:bulkUpdateStatus', ids, status),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('orders:delete', id)
  },
  dashboard: {
    stats: (): Promise<DashboardStats> => ipcRenderer.invoke('dashboard:stats')
  },
  settings: {
    get: (): Promise<ShopSettings> => ipcRenderer.invoke('settings:get'),
    update: (data: Partial<ShopSettings>): Promise<void> => ipcRenderer.invoke('settings:update', data)
  },
  backup: {
    export: (): Promise<BackupResult> => ipcRenderer.invoke('backup:export'),
    import: (): Promise<BackupResult> => ipcRenderer.invoke('backup:import')
  },
  print: {
    slip: (customerId: number, opts?: { preview?: boolean; orderId?: number }): Promise<
      'printed' | 'canceled' | 'preview'
    > => ipcRenderer.invoke('print:slip', customerId, opts),
    listPrinters: (): Promise<string[]> => ipcRenderer.invoke('print:listPrinters'),
    slipReady: (slipNumber: number): Promise<void> => ipcRenderer.invoke('print:slipReady', slipNumber)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
