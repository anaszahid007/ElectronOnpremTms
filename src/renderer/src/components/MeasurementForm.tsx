import { useState, type FormEvent } from 'react'
import { MEASUREMENT_SECTIONS } from '@shared/measurementFields'
import type { Measurement, MeasurementValues } from '@shared/types'
import { api, errMsg } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'

export function MeasurementForm({ customerId, existing }: { customerId: number; existing: Measurement | null }) {
  const toast = useToast()
  const [values, setValues] = useState<MeasurementValues>(() => ({ ...existing?.values }))
  const [busy, setBusy] = useState(false)

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.measurements.save({ customerId, values, specialNotes: existing?.specialNotes ?? null })
      toast('Measurements saved')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save}>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...MEASUREMENT_SECTIONS].reverse().map((section) => (
          <div key={section.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3
              dir="rtl"
              className="mb-3 font-urdu text-right text-base font-bold leading-[2] text-slate-900"
            >
              {section.formTitle}
            </h3>
            <div dir="rtl" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {section.fields.map((f) =>
                f.checkbox ? (
                  <label key={f.key} className="urdu-field flex h-full cursor-pointer items-center gap-2">
                    <span>{f.urdu}</span>
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 cursor-pointer accent-slate-900"
                      checked={values[f.key] === '✓'}
                      onChange={(e) => set(f.key, e.target.checked ? '✓' : '')}
                    />
                  </label>
                ) : (
                  <Field key={f.key} label={f.urdu} className="urdu-field">
                    <Input
                      value={values[f.key] ?? ''}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder="—"
                    />
                  </Field>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {existing ? `Last saved: ${existing.updatedAt}` : 'Not saved yet'}
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Update Measurements' : 'Save Measurements'}
        </Button>
      </div>
    </form>
  )
}
