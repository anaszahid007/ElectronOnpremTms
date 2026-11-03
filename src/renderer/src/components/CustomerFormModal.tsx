import { useEffect, useState, type FormEvent } from 'react'
import type { Customer } from '@shared/types'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface Props {
  open: boolean
  /** null = new customer */
  customer: Customer | null
  onClose: () => void
  /** Called after successful save with the customer id (new or existing). */
  onSaved: (customerId: number) => void
}

const emptyForm = { fullName: '', phone: '' }

export function CustomerFormModal({ open, customer, onClose, onSaved }: Props) {
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(
      customer
        ? { fullName: customer.fullName, phone: customer.phone }
        : emptyForm
    )
  }, [open, customer])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const id = customer
        ? (await api.customers.update({ id: customer.id, ...form }), customer.id)
        : await api.customers.create(form)
      toast(customer ? 'Customer updated' : 'Customer added')
      onSaved(id)
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={customer ? 'Edit Customer' : 'New Customer'} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {customer && (
          <Field label="Serial #">
            <Input value={String(customer.serialNumber)} readOnly />
          </Field>
        )}
        <Field label="Full Name">
          <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <Field label="Phone Number">
          <Input
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="03XXXXXXXXX"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : customer ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
