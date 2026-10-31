// Backups: a full JSON export of every table and the settings, restoring one
// (replace everything, or only add what's missing), and CSV exports of shots
// and brews for spreadsheets. The routes are in app.ts.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Statement } from 'better-sqlite3'
import db, { SCHEMA_VERSION, snapshotDatabase, deleteSnapshot, readSettings } from './db.ts'
import { HttpError, BAD_REQUEST } from './errors.ts'
import { parseBody, importSchema, settingsSchema } from './validation.ts'
import { fillFromVerdictsSql } from './taste.ts'
import type {
  Backup, BackupRow, BackupTable, ImportMode, ImportResult, Settings, TableCounts,
} from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_VERSION: string = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')).version

const BACKUP_TABLES: readonly BackupTable[] = ['beans', 'shots', 'brews', 'gear', 'recipes', 'tips']

// Only set by a brand-new install; never exported or restored, so a restored
// database doesn't offer to remove sample data it may not have
const INSTALL_ONLY_SETTINGS = new Set(['sampleData'])

const zeroCounts = (): TableCounts =>
  Object.fromEntries(BACKUP_TABLES.map(t => [t, 0])) as TableCounts

/** YYYY-MM-DD for file names */
export const today = (): string => new Date().toISOString().slice(0, 'YYYY-MM-DD'.length)

// ── Export ───────────────────────────────────────────────────────────

export function createBackup(): Backup {
  const tables = Object.fromEntries(
    BACKUP_TABLES.map(t => [t, db.prepare<[], BackupRow>(`SELECT * FROM ${t} ORDER BY rowid`).all()])
  ) as Backup['tables']
  const settings = Object.fromEntries(
    Object.entries(readSettings()).filter(([key]) => !INSTALL_ONLY_SETTINGS.has(key))
  ) as Settings
  return {
    app: 'grounded',
    format: 1,
    version: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    settings,
  }
}

// ── Import ───────────────────────────────────────────────────────────

const columnsOf = (table: string): Set<string> =>
  new Set(db.prepare<[string], { name: string }>('SELECT name FROM pragma_table_info(?)').all(table).map(c => c.name))

/** Inserts rows, keeping only the columns this database has (older backups lack some, which get their defaults) */
function insertRows(table: BackupTable, rows: readonly BackupRow[], skipExisting: boolean): { added: number, skipped: number } {
  const columns = columnsOf(table)
  const exists = db.prepare<[string]>(`SELECT 1 FROM ${table} WHERE id = ?`)
  const statements = new Map<string, Statement<unknown[]>>()
  let added = 0
  rows.forEach(row => {
    if (skipExisting && exists.get(row.id)) return
    // Column names come from the table itself, never from the file
    const keys = Object.keys(row).filter(k => columns.has(k))
    const sql = `INSERT INTO ${table} (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
    if (!statements.has(sql)) statements.set(sql, db.prepare<unknown[]>(sql))
    statements.get(sql)!.run(...keys.map(k => row[k]))
    added++
  })
  return { added, skipped: rows.length - added }
}

/** Settings from the backup that this version understands; anything else is skipped */
function validSettings(settings: Record<string, unknown> | undefined): [string, unknown][] {
  return Object.entries(settings ?? {}).filter(([key, value]) =>
    !INSTALL_ONLY_SETTINGS.has(key) && value !== undefined && settingsSchema.safeParse({ [key]: value }).success)
}

function applyBackup(backup: Pick<Backup, 'tables'> & { settings?: Record<string, unknown> }, mode: ImportMode): Omit<ImportResult, 'dryRun' | 'snapshot'> {
  const removed = zeroCounts()
  const added = zeroCounts()
  const skipped = zeroCounts()
  const replace = mode === 'replace'

  BACKUP_TABLES.forEach(t => {
    if (replace) removed[t] = db.prepare(`DELETE FROM ${t}`).run().changes
    const result = insertRows(t, backup.tables[t], !replace)
    added[t] = result.added
    skipped[t] = result.skipped
  })
  // Rows from a backup made before the taste slider only have a verdict
  db.exec(fillFromVerdictsSql('shots'))
  db.exec(fillFromVerdictsSql('brews'))

  // Replace takes the backup's settings; merge only fills in the ones not set here
  if (replace) db.prepare('DELETE FROM settings').run()
  const insertSetting = db.prepare(
    `INSERT ${replace ? '' : 'OR IGNORE '}INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`)
  validSettings(backup.settings).forEach(([key, value]) => insertSetting.run(key, JSON.stringify(value)))

  return { mode, removed, added, skipped }
}

// Thrown inside the transaction to undo a dry run
const ROLLBACK = Symbol('dry run')

/**
 * POST /api/import. Checks the file, saves a snapshot of the database, then
 * restores the backup in one transaction: a bad file changes nothing.
 * A dry run returns the same counts without writing anything.
 */
export function restoreBackup(body: unknown): ImportResult {
  const backup = (body as { backup?: { app?: unknown, schemaVersion?: unknown } } | null)?.backup
  if (backup?.app !== 'grounded') throw new HttpError(BAD_REQUEST, "This file isn't a Grounded backup")
  if (typeof backup.schemaVersion === 'number' && backup.schemaVersion > SCHEMA_VERSION) {
    throw new HttpError(BAD_REQUEST, 'This backup is from a newer version of Grounded. Update Grounded first, then restore it.')
  }
  const { mode, dryRun = false, backup: checked } = parseBody(importSchema, body)

  const snapshot = dryRun ? null : snapshotDatabase('import')
  let result: Omit<ImportResult, 'dryRun' | 'snapshot'> | undefined
  try {
    db.transaction(() => {
      result = applyBackup(checked, mode)
      if (dryRun) throw ROLLBACK
    })()
  } catch (e) {
    if (e === ROLLBACK) return { ...result!, dryRun, snapshot }
    // Nothing was changed, so the snapshot isn't needed
    if (snapshot) deleteSnapshot(snapshot)
    throw e
  }
  console.log(`  ✓ Restored a backup (${mode}); the previous database was saved as ${snapshot}`)
  return { ...result!, dryRun, snapshot }
}

// ── CSV ──────────────────────────────────────────────────────────────

const TASTE_COLUMNS = ['taste_acidity', 'taste_sweetness', 'taste_body', 'taste_bitterness', 'taste_balance', 'taste_aftertaste']

const SHOT_CSV_COLUMNS = [
  'date', 'bean', 'roaster', 'dose', 'yield', 'time', 'preinf', 'temp', 'grind', 'rating', ...TASTE_COLUMNS,
  'landed', 'bad', 'verdict', 'notes', 'machine', 'grinder_model', 'grinder_rpm', 'water_recipe', 'basket', 'brew_mode', 'favorited', 'id',
]

const BREW_CSV_COLUMNS = [
  'date', 'bean', 'roaster', 'dripper', 'grinder_model', 'dose', 'water', 'temp', 'grind', 'bloom_time', 'num_pours', 'pours',
  'time', 'rating', ...TASTE_COLUMNS, 'landed', 'bad', 'verdict', 'notes', 'grinder_rpm', 'water_recipe', 'favorited', 'id',
]

// Text starting with one of these would run as a formula when opened in a spreadsheet,
// so it gets a leading ' (e.g. "=SUM(A1)", "-too sour")
const FORMULA_START = ['=', '+', '-', '@', '\t', '\r']
// Fields with any of these must be quoted (RFC 4180)
const NEEDS_QUOTES = [',', '"', '\r', '\n']

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' && FORMULA_START.includes(value.charAt(0)) ? `'${value}` : String(value)
  return NEEDS_QUOTES.some(c => text.includes(c)) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Pours are stored as a JSON list of grams (older brews: objects with a water field); shown as "50 / 100 / 100" */
function poursText(json: unknown): string {
  try {
    const pours: unknown[] = JSON.parse(String(json ?? '[]'))
    return pours.map(p => (typeof p === 'object' && p !== null ? (p as { water?: unknown }).water : p) ?? '').join(' / ')
  } catch {
    return ''
  }
}

function toCsv(table: 'shots' | 'brews', columns: readonly string[]): string {
  const rows = db.prepare<[], Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY date`).all()
  const lines = [columns.join(','), ...rows.map(row => columns.map(c => csvCell(c === 'pours' ? poursText(row[c]) : row[c])).join(','))]
  // The byte-order mark makes Excel read the file as UTF-8 (accents, °)
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export const shotsCsv = (): string => toCsv('shots', SHOT_CSV_COLUMNS)
export const brewsCsv = (): string => toCsv('brews', BREW_CSV_COLUMNS)
