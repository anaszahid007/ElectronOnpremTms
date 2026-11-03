import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Printer } from 'lucide-react'
import type { Order } from '@shared/types'
import { GARMENT_TYPES } from '@shared/measurementFields'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { todayIso } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { Dropdown } from '@/components/ui/Dropdown'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'

interface Props {
  order?: Order | null
  fixedCustomerId?: number
  onDone: () => void
  onCancel: () => void
}

const CUSTOMER_SEARCH_PAGE_SIZE = 20

export function OrderForm({ order, fixedCustomerId, onDone, onCancel }: Props) {
  const toast = useToast()
  const [customerId, setCustomerId] = useState(order?.customerId ?? fixedCustomerId ?? 0)
  const [garmentType, setGarmentType] = useState(order?.garmentType ?? GARMENT_TYPES[0])
  const [quantity, setQuantity] = useState(String(order?.quantity ?? 1))
  const [urgent, setUrgent] = useState(order?.urgent ?? false)
  const [totalAmount, setTotalAmount] = useState(order ? String(order.totalAmount) : '')
  const [advancePaid, setAdvancePaid] = useState(order ? String(order.advancePaid) : '')
  const [orderDate, setOrderDate] = useState(order?.orderDate?.slice(0, 10) ?? todayIso())
  const [deliveryDate, setDeliveryDate] = useState(order?.deliveryDate?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [busy, setBusy] = useState(false)
  // Set by the "Create Order and Print Slip" button (type=button), read in
  // submit. Keeps Enter/implicit submission on the plain Create button so a
  // stray Enter never fires a surprise print job.
  const wantPrint = useRef(false)

  useEffect(() => {
    if (!order && fixedCustomerId) setCustomerId(fixedCustomerId)
  }, [order, fixedCustomerId])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!customerId) {
      toast('Select a customer first', 'error')
      return
    }
    const printAfter = wantPrint.current || (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-print') === '1'
    wantPrint.current = false
    setBusy(true)
    try {
      const data = {
        customerId,
        garmentType,
        quantity: Number(quantity),
        urgent,
        totalAmount: Number(totalAmount),
        advancePaid: Number(advancePaid),
        orderDate,
        deliveryDate: deliveryDate || null,
        notes: notes || null
      }
      if (order) {
        await api.orders.update({ id: order.id, ...data })
        toast('Order updated')
      } else {
        const id = await api.orders.create(data)
        toast('Order created')
        if (printAfter) {
          try {
            const res = await api.print.slip(customerId, { orderId: id })
            if (res === 'printed') toast(`Slip printed for order #${id}`)
            else if (res === 'canceled') toast('Print canceled')
          } catch (err) {
            toast(errMsg(err), 'error')
          }
        }
      }
      onDone()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const balance = (Number(totalAmount) || 0) - (Number(advancePaid) || 0)

  return (
    <form onSubmit={submit} className="space-y-4">
      {!fixedCustomerId && (
        <Field label="Customer">
          <Dropdown
            value={customerId}
            onChange={(v) => setCustomerId(Number(v))}
            onSearch={async (q) => {
              const res = await api.customers.list({
                search: q || undefined,
                page: 1,
                pageSize: CUSTOMER_SEARCH_PAGE_SIZE
              })
              return res.rows.map((c) => ({ value: c.id, label: c.fullName, hint: c.phone }))
            }}
            selectedHint={
              order ? { value: order.customerId, label: order.customerName, hint: order.customerPhone } : undefined
            }
            searchable
            placeholder="Search customer by name or phone…"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Garment Type">
          <Dropdown
            value={garmentType}
            options={GARMENT_TYPES.map((g) => ({ value: g, label: g }))}
            onChange={(v) => setGarmentType(String(v))}
          />
        </Field>
        <Field label="Quantity">
          <Input type="number" min={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Total Amount (Rs)">
          <Input type="number" min={0} required value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
        </Field>
        <Field label="Advance Paid (Rs)">
          <Input type="number" min={0} value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} />
        </Field>
        <Field label="Order Date">
          <Input type="date" required value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </Field>
        <Field label="Delivery Date">
          <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </Field>
        <Field label="Urgent Order">
          <SegmentedToggle
            value={urgent}
            options={[
              { value: false, label: 'No' },
              { value: true, label: 'Yes' }
            ]}
            onChange={setUrgent}
          />
        </Field>
      </div>

      <div className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
        Remaining balance: <span className="font-bold">{balance < 0 ? '—' : `Rs ${balance}`}</span>
      </div>

      <Field label="Notes" hint="Fabric color, design, customer instructions…">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {!order && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={(e) => {
              wantPrint.current = true
              e.currentTarget.form?.requestSubmit()
            }}
          >
            <Printer size={16} /> Create Order and Print Slip
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : order ? 'Save Changes' : 'Create Order'}
        </Button>
      </div>
    </form>
  )
}
