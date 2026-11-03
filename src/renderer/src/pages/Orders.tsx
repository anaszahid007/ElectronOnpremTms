import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import type { Order, OrderStatus } from '@shared/types'
import { ORDER_STATUSES } from '@shared/measurementFields'
import { DEFAULT_PAGE_SIZE } from '@shared/constants'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { formatDate, formatMoney, todayIso, STATUS_META } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, Spinner } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Pagination, PageSizeMenu } from '@/components/ui/Pagination'
import { OrderForm } from '@/components/OrderForm'
import { ClearSearch } from '@/components/ui/ClearSearch'

const STATUS_CHEVRON =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`

const filters: (OrderStatus | 'all')[] = ['all', ...ORDER_STATUSES]

export function Orders() {
  const toast = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loaded, setLoaded] = useState(false)
  const [hasCustomers, setHasCustomers] = useState(false)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState<Order | null>(null)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [bulkPick, setBulkPick] = useState<string | number>('')
  const [printingId, setPrintingId] = useState<number | null>(null)

  const load = useCallback(
    (status: OrderStatus | 'all', q: string, p: number, ps: number) =>
      api
        .orders.list({ status, search: q.trim() || undefined, page: p, pageSize: ps })
        .then((res) => {
          // If filters/status changed emptied this page (e.g. last row delivered
          // while filtered), clamp back to the last real page instead of
          // showing "No orders found" while orders still exist.
          const maxPage = Math.max(1, Math.ceil(res.total / ps))
          if (p > maxPage) {
            setPage(maxPage)
            return
          }
          setOrders(res.rows)
          setTotal(res.total)
          setLoaded(true)
        }),
    []
  )

  useEffect(() => {
    api.customers.list({ page: 1, pageSize: 1 }).then((res) => setHasCustomers(res.total > 0))
  }, [])

  useEffect(() => {
    setSelection(new Set())
    const t = setTimeout(() => load(statusFilter, search, page, pageSize), 200)
    return () => clearTimeout(t)
  }, [statusFilter, search, page, pageSize, load])

  const setStatus = async (order: Order, status: OrderStatus) => {
    if (status === order.status) return
    try {
      await api.orders.updateStatus(order.id, status)
      toast(`Order #${order.id} moved to ${STATUS_META[status].label}`)
      await load(statusFilter, search, page, pageSize)
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  const bulkSetStatus = async (status: OrderStatus) => {
    const ids = [...selection]
    try {
      const n = await api.orders.bulkUpdateStatus(ids, status)
      toast(`${n} order${n === 1 ? '' : 's'} set to ${STATUS_META[status].label}`)
      setSelection(new Set())
      setBulkPick('')
      await load(statusFilter, search, page, pageSize)
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  const allOnPageSelected = orders.length > 0 && orders.every((o) => selection.has(o.id))
  const someOnPageSelected = orders.some((o) => selection.has(o.id))

  const remove = async () => {
    if (!deleting) return
    try {
      await api.orders.delete(deleting.id)
      toast('Order deleted')
      setDeleting(null)
      if (orders.length === 1 && page > 1) setPage(page - 1)
      else await load(statusFilter, search, page, pageSize)
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

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">Track stitching from entry to delivery</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setModalOpen(true)
          }}
          disabled={!hasCustomers}
        >
          <Plus size={16} /> New Order
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => {
                setStatusFilter(f)
                setPage(1)
              }}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                statusFilter === f ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_META[f].label}
            </button>
          ))}
        </div>
        <div className="relative w-72">
          <Search size={16} className="absolute top-3 left-3 text-slate-400" />
          <Input
            placeholder="Search customer or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pr-9 pl-9"
          />
          {search && (
            <ClearSearch
              onClear={() => {
                setSearch('')
                setPage(1)
              }}
            />
          )}
        </div>
        <div className="ml-auto">
          <PageSizeMenu
            pageSize={pageSize}
            onChange={(n) => {
              setPageSize(n)
              setPage(1)
            }}
          />
        </div>
      </div>

      {selection.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-slate-700">
            {selection.size} order{selection.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Set status:</span>
            <select
              value={bulkPick}
              onChange={(e) => setBulkPick(e.target.value)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-500"
            >
              <option value="" disabled>
                Select status…
              </option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <Button disabled={bulkPick === ''} onClick={() => bulkSetStatus(bulkPick as OrderStatus)}>
              Confirm
            </Button>
          </div>
          <Button variant="ghost" className="ml-auto" onClick={() => { setSelection(new Set()); setBulkPick('') }}>
            Clear
          </Button>
        </div>
      )}

      {!loaded ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <EmptyState
          message={!hasCustomers ? 'Add a customer first, then create orders.' : 'No orders found.'}
          action={
            !hasCustomers ? (
              <Link to="/customers" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                Go to Customers
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected
                    }}
                    onChange={(e) =>
                      setSelection(e.target.checked ? new Set(orders.map((o) => o.id)) : new Set())
                    }
                    className="h-4 w-4 cursor-pointer accent-slate-900"
                    aria-label="Select all orders on this page"
                  />
                </th>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Garment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Advance</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const overdue = o.status !== 'delivered' && o.deliveryDate && o.deliveryDate < todayIso()
                return (
                  <tr
                    key={o.id}
                    className={`${selection.has(o.id) ? 'bg-blue-50' : 'odd:bg-slate-50'} hover:bg-slate-100`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selection.has(o.id)}
                        onChange={(e) => {
                          const next = new Set(selection)
                          if (e.target.checked) next.add(o.id)
                          else next.delete(o.id)
                          setSelection(next)
                        }}
                        className="h-4 w-4 cursor-pointer accent-slate-900"
                        aria-label={`Select order #${o.id}`}
                      />
                    </td>
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
                        <select
                          value={o.status}
                          onChange={(e) => setStatus(o, e.target.value as OrderStatus)}
                          className={`cursor-pointer appearance-none rounded-lg border-0 py-1 pr-7 pl-2.5 text-xs font-semibold outline-none ${STATUS_META[o.status].className}`}
                          style={{
                            backgroundImage: STATUS_CHEVRON,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 8px center',
                            backgroundSize: '12px'
                          }}
                          aria-label={`Status of order #${o.id}`}
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_META[s].label}
                            </option>
                          ))}
                        </select>
                        {o.urgent && <Badge className="bg-red-100 text-red-700">Urgent</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatMoney(o.totalAmount)}</td>
                    <td className="px-4 py-3">{formatMoney(o.advancePaid)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(o.balance)}</td>
                    <td className={`px-4 py-3 ${overdue ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                      {formatDate(o.deliveryDate)}
                      {overdue && ' ⚠'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Edit order"
                          onClick={() => {
                            setEditing(o)
                            setModalOpen(true)
                          }}
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
                          onClick={() => setDeleting(o)}
                          className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      )}

      <Modal title={editing ? `Edit Order #${editing.id}` : 'New Order'} open={modalOpen} onClose={() => setModalOpen(false)} wide>
        <OrderForm
          order={editing}
          onDone={() => {
            setModalOpen(false)
            load(statusFilter, search, page, pageSize)
          }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete order"
        message={`Delete order #${deleting?.id} for ${deleting?.customerName}? This cannot be undone.`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
