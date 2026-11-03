import { getDb } from '../db'

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string | null }
    | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function today(): string {
  // Local calendar date (not UTC) — between 00:00 and the UTC offset the
  // shop's "today" would otherwise be yesterday's date.
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  return value.trim()
}

export function optionalString(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim()
}

export function requireNumber(value: unknown, name: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a valid number`)
  return n
}
