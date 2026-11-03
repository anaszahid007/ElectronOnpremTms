import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardPlus, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { Customer } from '@shared/types'
import { DEFAULT_PAGE_SIZE } from '@shared/constants'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ClearSearch } from '@/components/ui/ClearSearch'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import { IconBtn } from '@/components/ui/IconButton'
import { Pagination, PageSizeMenu } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { CustomerFormModal } from '@/components/CustomerFormModal'
import { OrderForm } from '@/components/OrderForm'

export function Customers() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [ordering, setOrdering] = useState<Customer | null>(null)
  const [orderModalOpen, setOrderModalOpen] = useState(false)

  const load = (q: string, p: number, ps: number) =>
    api.customers.list({ search: q || undefined, page: p, pageSize: ps, sort: 'newest' }).then((res) => {
      setCustomers(res.rows)
      setTotal(res.total)
      setLoaded(true)
    })

  useEffect(() => {
    const t = setTimeout(() => load(search, page, pageSize), 200)
    return () => clearTimeout(t)
  }, [search, page, pageSize])

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const remove = async () => {
    if (!deleting) return
    try {
      await api.customers.delete(deleting.id)
      toast('Customer deleted')
      setDeleting(null)
      if (customers.length === 1 && page > 1) setPage(page - 1)
      else await load(search, page, pageSize)
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">{total} customers on record</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> New Customer
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search size={16} className="absolute top-3 left-3 text-slate-400" />
          <Input
            placeholder="Search by name, phone or serial…"
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
        <PageSizeMenu
          pageSize={pageSize}
          onChange={(n) => {
            setPageSize(n)
            setPage(1)
          }}
        />
      </div>

      {!loaded ? (
        <Spinner />
      ) : customers.length === 0 ? (
        <EmptyState
          message={search ? 'No customers match your search.' : 'No customers yet. Add your first customer to get started.'}
          action={
            !search && (
              <Button onClick={openNew}>
                <Plus size={16} /> Add Customer
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Serial #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="odd:bg-slate-50 hover:bg-slate-100">
                  <td className="px-4 py-3 text-slate-600">{c.serialNumber}</td>
                  <td className="px-4 py-3">
                    <Link to={`/customers/${c.id}`} className="font-semibold text-slate-900 hover:underline">
                      {c.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-500">{c.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
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
                          setOrderModalOpen(true)
                        }}
                      >
                        <ClipboardPlus size={16} />
                      </IconBtn>
                      <IconBtn title="Delete" danger onClick={() => setDeleting(c)}>
                        <Trash2 size={16} />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </div>
      )}

      <CustomerFormModal
        open={formOpen}
        customer={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => {
          setFormOpen(false)
          if (!editing) navigate(`/customers/${id}`)
          else load(search, page, pageSize)
        }}
      />

      <Modal
        title={ordering ? `New Order — ${ordering.fullName}` : 'New Order'}
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        wide
      >
        <OrderForm
          fixedCustomerId={ordering?.id}
          onDone={() => setOrderModalOpen(false)}
          onCancel={() => setOrderModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete customer"
        message={`Delete "${deleting?.fullName}"? Their measurements and all orders will also be permanently deleted.`}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
