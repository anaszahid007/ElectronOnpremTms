import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { closeSync, copyFileSync, existsSync, openSync, readSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { BackupResult } from '@shared/types'
import { getDb, closeDb, DB_NAME } from '../db'

function dbPath(): string {
  return join(app.getPath('userData'), DB_NAME)
}

/** Quick sanity check: SQLite magic header + a users table we expect. */
function looksLikeOurDb(file: string): boolean {
  try {
    const fd = openSync(file, 'r')
    const buf = Buffer.alloc(16)
    readSync(fd, buf, 0, 16, 0)
    closeSync(fd)
    if (buf.toString('utf8', 0, 15) !== 'SQLite format 3') return false
    const test = new DatabaseSync(file, { readOnly: true })
    try {
      const row = test.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()
      return !!row
    } finally {
      test.close()
    }
  } catch {
    return false
  }
}

async function exportBackup(win: BrowserWindow | null): Promise<BackupResult> {
  const date = new Date().toISOString().slice(0, 10)
  const opts = {
    title: 'Backup Data',
    defaultPath: `tailor-backup-${date}.db`,
    filters: [{ name: 'Database Backup', extensions: ['db'] }]
  }
  const { canceled, filePath } = win
    ? await dialog.showSaveDialog(win, opts)
    : await dialog.showSaveDialog(opts)
  if (canceled || !filePath) return { ok: false, cancelled: true }

  try {
    // VACUUM INTO refuses to write to an existing file; the save dialog has
    // already asked the user to confirm the overwrite, so remove it first.
    if (existsSync(filePath)) rmSync(filePath)
    // VACUUM INTO writes a consistent snapshot of the live (WAL) database.
    getDb().exec(`VACUUM INTO '${filePath.replace(/'/g, "''")}'`)
    return { ok: true, path: filePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Backup failed' }
  }
}

async function importBackup(win: BrowserWindow | null): Promise<BackupResult> {
  const opts = {
    title: 'Restore from Backup',
    filters: [{ name: 'Database Backup', extensions: ['db'] }],
    properties: ['openFile' as const]
  }
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, opts)
    : await dialog.showOpenDialog(opts)
  if (canceled || filePaths.length === 0) return { ok: false, cancelled: true }
  const source = filePaths[0]

  if (!looksLikeOurDb(source)) {
    return { ok: false, error: 'That file is not a valid Tailor Manager backup.' }
  }

  const target = dbPath()
  const preimport = target + '.preimport'
  try {
    // Safety copy of the current DB so we can roll back if anything goes wrong.
    closeDb()
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(target + suffix)) {
        if (existsSync(preimport + suffix)) rmSync(preimport + suffix)
        copyFileSync(target + suffix, preimport + suffix)
      }
    }

    // Replace current DB with the backup.
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(target + suffix)) rmSync(target + suffix)
    }
    copyFileSync(source, target)

    // Reopen — existing migrations run automatically on older backups.
    getDb()

    // Success — clean up the rollback copy. A failure here must NOT trigger
    // the rollback path (the restore already succeeded), so isolate it.
    try {
      for (const suffix of ['', '-wal', '-shm']) {
        if (existsSync(preimport + suffix)) rmSync(preimport + suffix)
      }
    } catch {
      // leftover .preimport file is harmless
    }
    return { ok: true, path: source }
  } catch (err) {
    // Roll back to the pre-import database — but ONLY if the safety copy
    // actually exists. Deleting the live DB with no copy to restore is
    // permanent data loss.
    try {
      closeDb()
      if (existsSync(preimport)) {
        for (const suffix of ['', '-wal', '-shm']) {
          if (existsSync(preimport + suffix)) copyFileSync(preimport + suffix, target + suffix)
        }
        getDb()
      }
      // If no preimport copy exists, leave the current (partial) target as-is
      // rather than deleting it — at worst it is recoverable, at best it is fine.
    } catch {
      // rollback best-effort
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Restore failed' }
  }
}

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:export', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return exportBackup(win)
  })
  ipcMain.handle('backup:import', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return importBackup(win)
  })
}
