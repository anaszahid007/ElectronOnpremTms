import { ipcMain } from 'electron'
import type { Measurement } from '@shared/types'
import { ALL_MEASUREMENT_KEYS } from '@shared/measurementFields'
import { getDb } from '../db'
import { optionalString } from './helpers'

interface MeasurementRow {
  id: number
  customer_id: number
  special_notes: string | null
  updated_at: string
}

function toMeasurement(row: MeasurementRow): Measurement {
  const values: Record<string, string | null> = {}
  for (const key of ALL_MEASUREMENT_KEYS) {
    values[key] = (row as unknown as Record<string, string | null>)[key] ?? null
  }
  return {
    id: row.id,
    customerId: row.customer_id,
    values,
    specialNotes: row.special_notes,
    updatedAt: row.updated_at
  }
}

export function registerMeasurementHandlers(): void {
  ipcMain.handle('measurements:get', (_e, customerId: number) => {
    const row = getDb().prepare('SELECT * FROM measurements WHERE customer_id = ?').get(customerId) as
      | unknown
      | undefined
    return row ? toMeasurement(row as MeasurementRow) : null
  })

  ipcMain.handle(
    'measurements:save',
    (
      _e,
      data: {
        customerId: number
        values: Record<string, string | null>
        specialNotes: string | null
      }
    ) => {
      const db = getDb()
      const setClause = ALL_MEASUREMENT_KEYS.map((k) => `${k} = ?`).join(', ')
      const columnList = ALL_MEASUREMENT_KEYS.join(', ')
      const placeholders = ALL_MEASUREMENT_KEYS.map(() => '?').join(', ')
      const params = ALL_MEASUREMENT_KEYS.map((k) => optionalString(data.values?.[k]))

      const existing = db.prepare('SELECT id FROM measurements WHERE customer_id = ?').get(data.customerId)
      if (existing) {
        db.prepare(
          `UPDATE measurements SET ${setClause}, special_notes = ?,
          updated_at = datetime('now', 'localtime') WHERE customer_id = ?`
        ).run(...params, optionalString(data.specialNotes), data.customerId)
      } else {
        db.prepare(
          `INSERT INTO measurements (customer_id, ${columnList}, special_notes)
          VALUES (?, ${placeholders}, ?)`
        ).run(data.customerId, ...params, optionalString(data.specialNotes))
      }
    }
  )
}
