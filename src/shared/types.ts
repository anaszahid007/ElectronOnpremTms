export type OrderStatus = 'pending' | 'delivered'

export interface Paginated<T> {
  rows: T[]
  total: number
}

export interface User {
  id: number
  username: string
}

export interface Customer {
  id: number
  serialNumber: number
  fullName: string
  phone: string
  createdAt: string
}

export type MeasurementValues = Record<string, string | null>

export interface Measurement {
  id: number
  customerId: number
  values: MeasurementValues
  specialNotes: string | null
  updatedAt: string
}

export interface Order {
  id: number
  customerId: number
  customerName: string
  customerPhone: string
  garmentType: string
  quantity: number
  status: OrderStatus
  urgent: boolean
  totalAmount: number
  advancePaid: number
  balance: number
  orderDate: string
  deliveryDate: string | null
  notes: string | null
}

export interface OrderInput {
  customerId: number
  garmentType: string
  quantity: number
  urgent: boolean
  totalAmount: number
  advancePaid: number
  orderDate: string
  deliveryDate: string | null
  notes: string | null
}

export interface ShopSettings {
  shopName: string
  shopAddress: string
  shopPhone: string
  shopNameUrdu: string
  shopAddressUrdu: string
  printerName: string | null
  printDialog: boolean
  passwordChanged: boolean
}

export interface DashboardStats {
  totalCustomers: number
  pendingOrders: number
  deliveredOrders: number
}

export interface LoginResult {
  ok: boolean
  error?: string
}

export interface BackupResult {
  ok: boolean
  cancelled?: boolean
  path?: string
  error?: string
}
