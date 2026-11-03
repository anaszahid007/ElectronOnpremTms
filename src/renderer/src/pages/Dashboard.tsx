import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardPlus, Eye, PackageCheck, Pencil, Printer, Search, Trash2, Users, Wrench } from 'lucide-react'
import type { Customer, DashboardStats, Order } from '@shared/types'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { formatDate, formatMoney, STATUS_META } from '@/lib/format'
import { Badge, EmptyState, Spinner } from '@/components/ui/Feedback'
import { IconBtn } from '@/components/ui/IconButton'
import { ClearSearch } from '@/components/ui/ClearSearch'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CustomerFormModal } from '@/components/CustomerFormModal'
import { OrderForm } from '@/components/OrderForm'

const cards = [
  { key: 'totalCustomers', label: 'Total Customers', icon: Users, color: 'bg-slate-900' },
  { key: 'pendingOrders', label: 'Pending', icon: Wrench, color: 'bg-amber-500' },
  { key: 'deliveredOrders', label: 'Delivered', icon: PackageCheck, color: 'bg-emerald-500' }
] as const

const RECENT_ORDERS_LIMIT = 10
const SEARCH_LIMIT = 10

export function Dashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])

  const [custSearch, setCustSearch] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [ordering, setOrdering] = useState<Customer | null>(null)
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null)
  const [printingId, setPrintingId] = useState<number | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  // Monotonic id so an in-flight response for an old query never overwrites
  // a newer one (or reopens the dropdown after the user cleared the search).
  const searchSeq = useRef(0)

  useEffect(() => {
    api.dashboard.stats().then(setStats)
    api.orders.list({ pageSize: RECENT_ORDERS_LIMIT, skipCount: true }).then((res) => setRecentOrders(res.rows))
  }, [])

  // Debounced customer search (top 10 matches)
  useEffect(() => {
    const q = custSearch.trim()
    const seq = ++searchSeq.current
    if (!q) {
      setResults([])
      setSearchOpen(false)
      return
    }
    const t = setTimeout(() => {
      api.customers
        .list({ search: q, page: 1, pageSize: SEARCH_LIMIT })
        .then((res) => {
          if (seq !== searchSeq.current) return // stale — a newer search or clear happened
          setResults(res.rows)
          setSearchOpen(true)
        })
        .catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [custSearch])

  // Close dropdown on click outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const refreshSearch = () => {
    const q = custSearch.trim()
    if (!q) return
    const seq = ++searchSeq.current
    api.customers
      .list({ search: q, page: 1, pageSize: SEARCH_LIMIT })
      .then((res) => {
        if (seq !== searchSeq.current) return
        setResults(res.rows)
      })
      .catch(() => {})
  }

  const refreshOrders = () => {
    api.dashboard.stats().then(setStats)
    api.orders.list({ pageSize: RECENT_ORDERS_LIMIT, skipCount: true }).then((res) => setRecentOrders(res.rows))
  }

  const openEditOrder = (o: Order) => {
    setOrdering(null)
    setEditingOrder(o)
    setOrderModalOpen(true)
  }

  const removeOrder = async () => {
    if (!deletingOrder) return
    try {
      await api.orders.delete(deletingOrder.id)
      toast('Order deleted')
      setDeletingOrder(null)
      refreshOrders()
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  const printOrder = async (order: Order) => {
    setPrintingId(order.id)
    try {
      const res = await api.print.slip(order.customerId, { orderId: order.id })
      if (res === 'printed') toast(`Slip printed for order #${order.id}`)
      else if (res === 'canceled') toast('Print canceled')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setPrintingId(null)
    }
  }

  const closeOrderModal = () => {
    setOrderModalOpen(false)
    setEditingOrder(null)
  }

  if (!stats) return <Spinner />

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Shop overview at a glance</p>
        </div>

        <div ref={searchRef} className="relative w-md max-w-full shrink">
          <Search size={16} className="absolute top-3 left-3 z-10 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer name, phone or serial…"
            value={custSearch}
            onChange={(e) => setCustSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCustSearch('')
                setResults([])
                setSearchOpen(false)
              }
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-9 pl-9 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          {custSearch && (
            <ClearSearch
              onClear={() => {
                setCustSearch('')
                setResults([])
                setSearchOpen(false)
              }}
            />
          )}

          {searchOpen && (
            <div className="absolute top-full left-0 z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
              {results.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">No customers match your search.</p>
              ) : (
                <>
                  <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {results.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50">
                        <button
                          onClick={() => navigate(`/customers/${c.id}`)}
                          className="min-w-0 cursor-pointer text-left"
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">{c.fullName}</p>
                          <p className="truncate text-xs text-slate-500">
                            {c.phone}
                          </p>
                        </button>
                        <div className="flex shrink-0">
                          <IconBtn title="Open" onClick={() => navigate(`/customers/${c.id}`)}>
                            <Eye size={16} />
                          </IconBtn>
                          <IconBtn
                            title="Edit"
                            onClick={() => {
                              setEditing(c)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil size={16} />
                          </IconBtn>
                          <IconBtn
                            title="New Order"
                            onClick={() => {
                              setOrdering(c)
                              setEditingOrder(null)
                              setSearchOpen(false)
                              setOrderModalOpen(true)
                            }}
                          >
                            <ClipboardPlus size={16} />
                          </IconBtn>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-slate-100 px-4 py-2 text-right">
                    <Link
                      to={`/customers?q=${encodeURIComponent(custSearch.trim())}`}
                      onClick={() => setSearchOpen(false)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                    >
                      View all results →
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-1 justify-end">
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + New Customer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="rounded-xl bg-white p-5 shadow-sm">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg text-white ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats[key]}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
          <Link to="/orders" className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:underline">
            View all orders →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <EmptyState message="No orders yet. Create your first order from the Orders page." />
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Garment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((o, i) => (
                  <tr key={o.id} className={i % 2 === 1 ? 'bg-slate-50 hover:bg-slate-100' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-semibold text-slate-900">#{o.id}</td>
                    <td className="px-4 py-3">
                      <Link to={`/customers/${o.customerId}`} className="font-medium text-slate-800 hover:underline">
                        {o.customerName}
                      </Link>
                      <p className="text-xs text-slate-500">{o.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      {o.garmentType} × {o.quantity}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <Badge className={STATUS_META[o.status].className}>{STATUS_META[o.status].label}</Badge>
                        {o.urgent && <Badge className="bg-red-100 text-red-700">Urgent</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatMoney(o.totalAmount)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(o.balance)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(o.deliveryDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Edit order"
                          onClick={() => openEditOrder(o)}
                          className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Print slip"
                          disabled={printingId === o.id}
                          onClick={() => {
                            void printOrder(o)
                          }}
                          className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          title="Delete order"
                          onClick={() => setDeletingOrder(o)}
                          className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerFormModal
        open={formOpen}
        customer={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => {
          setFormOpen(false)
          if (!editing) navigate(`/customers/${id}`)
          else refreshSearch()
        }}
      />

      <Modal
        title={
          editingOrder
            ? `Edit Order #${editingOrder.id}`
            : ordering
              ? `New Order — ${ordering.fullName}`
              : 'New Order'
        }
        open={orderModalOpen}
        onClose={closeOrderModal}
        wide
      >
        <OrderForm
          order={editingOrder}
          fixedCustomerId={editingOrder ? undefined : ordering?.id}
          onDone={() => {
            closeOrderModal()
            refreshOrders()
          }}
          onCancel={closeOrderModal}
        />
      </Modal>

      <ConfirmDialog
        open={!!deletingOrder}
        title="Delete order"
        message={`Delete Order #${deletingOrder?.id} for ${deletingOrder?.customerName}? This cannot be undone.`}
        onConfirm={removeOrder}
        onCancel={() => setDeletingOrder(null)}
      />
    </div>
  )
}
