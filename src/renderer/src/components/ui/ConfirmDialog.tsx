import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setBusy(false)
  }, [open])

  return (
    <Modal title={title} open={open} onClose={onCancel}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              onConfirm()
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
