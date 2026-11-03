import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { LoginResult, User } from '@shared/types'
import { getDb } from './db'

let sessionUser: User | null = null

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHash, 'hex')
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}

export function login(username: string, password: string): LoginResult {
  const row = getDb()
    .prepare('SELECT id, username, password_hash, salt FROM users WHERE username = ?')
    .get(username.trim()) as { id: number; username: string; password_hash: string; salt: string } | undefined

  if (!row || !verifyPassword(password, row.salt, row.password_hash)) {
    return { ok: false, error: 'Invalid username or password' }
  }

  sessionUser = { id: row.id, username: row.username }
  return { ok: true }
}

export function logout(): void {
  sessionUser = null
}

export function getSession(): User | null {
  return sessionUser
}

export function changePassword(oldPassword: string, newPassword: string): { error?: string } {
  if (!sessionUser) return { error: 'Not logged in' }
  if (newPassword.length < 4) return { error: 'New password must be at least 4 characters' }

  const db = getDb()
  const row = db
    .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
    .get(sessionUser.id) as { password_hash: string; salt: string } | undefined

  if (!row || !verifyPassword(oldPassword, row.salt, row.password_hash)) {
    return { error: 'Current password is incorrect' }
  }

  const { salt, hash } = hashPassword(newPassword)
  db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, sessionUser.id)
  db.prepare("UPDATE settings SET value = 'true' WHERE key = 'password_changed'").run()
  return {}
}
