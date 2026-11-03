import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import type { Customer, Measurement, Order, OrderStatus } from '@shared/types'
import { ORDER_STATUSES } from '@shared/measurementFields'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { formatDate, formatMoney, STATUS_META } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, Spinner } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { Pagination, PageSizeMenu } from '@/components/ui/Pagination'
import { MeasurementForm } from '@/components/MeasurementForm'
import { OrderForm } from '@/components/OrderForm'
import { CustomerFormModal } from '@/components/CustomerFormModal'

const ORDERS_PAGE_SIZE = 25

const STATUS_CHEVRON =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`

export function CustomerDetail() {
  const { id } = useParams()
  const customerId = Number(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [measurement, setMeasurement] = useState<Measurement | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(ORDERS_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null)
  const [printingId, setPrintingId] = useState<number | null>(null)

  const load = useCallback(
    async (p: number, ps: number) => {
      try {
        const [c, m, o] = await Promise.all([
          api.customers.get(customerId),
          api.measurements.get(customerId),
          api.orders.list({ customerId, page: p, pageSize: ps })
        ])
        setCustomer(c)
        setMeasurement(m)
        setOrders(o.rows)
        setTotal(o.total)
      } catch (err) {
        toast(errMsg(err), 'error')
        navigate('/customers')
      } finally {
        setLoading(false)
      }
    },
    [customerId]
  )

  useEffect(() => {
    load(page, pageSize)
  }, [load, page, pageSize])

  const remove = async () => {
    try {
      await api.customers.delete(customerId)
      toast('Customer deleted')
      navigate('/customers')
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  const previewSlip = async () => {
    try {
      await api.print.slip(customerId, { preview: true })
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  const setStatus = async (order: Order, status: OrderStatus) => {
    if (status === order.status) return
    try {
      await api.orders.updateStatus(order.id, status)
      toast(`Order #${order.id} moved to ${STATUS_META[status].label}`)
      await load(page, pageSize)
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  const removeOrder = async () => {
    if (!deletingOrder) return
    try {
      await api.orders.delete(deletingOrder.id)
      toast('Order deleted')
      setDeletingOrder(null)
      if (orders.length === 1 && page > 1) setPage(page - 1)
      else load(page, pageSize)
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

  if (loading || !customer) return <Spinner />

  return (
    <div className="p-8">
      <Button variant="secondary" className="mb-5" onClick={() => navigate('/customers')}>
        <ArrowLeft size={16} /> Back to Customers
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{customer.fullName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {customer.phone} · Serial #{customer.serialNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={16} /> Edit
          </Button>
          <Button variant="secondary" onClick={previewSlip}>
            Preview Slip
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Measurements</h2>
        <MeasurementForm customerId={customerId} existing={measurement} />
      </section>

      <hr className="my-8 border-slate-400" />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Orders ({total})</h2>
          <div className="flex items-center gap-3">
            <PageSizeMenu
              pageSize={pageSize}
              onChange={(n) => {
                setPageSize(n)
                setPage(1)
              }}
            />
            <Button onClick={() => setOrderModalOpen(true)}>
              <Plus size={16} /> New Order
            </Button>
          </div>
        </div>

        {total === 0 ? (
          <EmptyState message="No orders for this customer yet." />
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">#</th>
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
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">#{o.id}</td>
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
                    <td className="px-4 py-3 font-medium">{formatMoney(o.balance)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(o.deliveryDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Edit order"
                          onClick={() => {
                            setEditingOrder(o)
                            setOrderModalOpen(true)
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
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
          </div>
        )}
      </section>

      <CustomerFormModal
        open={editOpen}
        customer={customer}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false)
          load(page, pageSize)
        }}
      />

      <Modal
        title={editingOrder ? `Edit Order #${editingOrder.id}` : 'New Order'}
        open={orderModalOpen}
        onClose={() => {
          setOrderModalOpen(false)
          setEditingOrder(null)
        }}
        wide
      >
        <OrderForm
          order={editingOrder}
          fixedCustomerId={customerId}
          onDone={() => {
            setOrderModalOpen(false)
            const wasEdit = !!editingOrder
            setEditingOrder(null)
            if (wasEdit) load(page, pageSize)
            else if (page !== 1) setPage(1)
            else load(1, pageSize)
          }}
          onCancel={() => {
            setOrderModalOpen(false)
            setEditingOrder(null)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deletingOrder}
        title="Delete order"
        message={`Delete Order #${deletingOrder?.id}? This cannot be undone.`}
        onConfirm={removeOrder}
        onCancel={() => setDeletingOrder(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete customer"
        message={`Delete "${customer.fullName}"? Their measurements and all orders will also be permanently deleted.`}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
