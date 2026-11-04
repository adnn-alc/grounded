// Backup export/import and CSV export, against a fresh (seeded) database.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { createTempDatabase, startApi } from './test-helpers.ts'
import type { Backup, ImportResult, Settings, Shot } from '../src/types.ts'

const tmp = createTempDatabase()
const { app } = await import('./app.ts')
const { default: db } = await import('./db.ts')
const api = await startApi(app)

after(async () => {
  await api.close()
  db.close()
  tmp.cleanup()
})

const OK = 200
const BAD_REQUEST = 400
const MID = 5
const DOSE = 18
const OVER_DEFAULT_LIMIT = 200_000   // express.json's default limit is 100 KB
const SNAPSHOT_PREFIX = 'grounded.db.backup-import-'

const snapshots = (): string[] => readdirSync(tmp.dir).filter(f => f.startsWith(SNAPSHOT_PREFIX))
const exportBackup = async (): Promise<Backup> => (await api.call<Backup>('GET', '/api/export')).body
const settings = async (): Promise<Settings> => (await api.call<Settings>('GET', '/api/settings')).body
const restore = (backup: unknown, mode: string, dryRun = false) =>
  api.call<ImportResult & { error?: string }>('POST', '/api/import', { mode, dryRun, backup })
const shotIds = async (): Promise<string[]> => (await api.call<Shot[]>('GET', '/api/shots')).body.map(s => s.id).sort()
const addShot = (id: string, notes = 'added later') => api.call('POST', '/api/shots', {
  id, date: '2026-10-30 09:00', bean_id: 'b-idido', dose: DOSE, rating: MID, notes,
})

test('the backup has a header, every table and the settings, but not the sample-data flag', async () => {
  const res = await api.call<Backup>('GET', '/api/export')
  assert.equal(res.status, OK)
  const disposition = res.headers.get('content-disposition') ?? ''
  assert.ok(disposition.startsWith('attachment; filename="grounded-backup-') && disposition.endsWith('.json"'), disposition)
  const b = res.body
  assert.equal(b.app, 'grounded')
  assert.equal(b.format, 1)
  assert.equal(b.schemaVersion, db.pragma('user_version', { simple: true }))
  assert.deepEqual(Object.keys(b.tables).sort(), ['beans', 'brews', 'care_log', 'care_tasks', 'gear', 'recipes', 'shots', 'tips'])
  assert.ok(b.tables.shots.length > 0 && 'taste_acidity' in b.tables.shots[0]!, 'rows are raw database rows')
  assert.equal(b.settings.sampleData, undefined)
})

test('a dry run reports what would change and changes nothing', async () => {
  const backup = await exportBackup()
  await addShot('dry-run-shot')
  const before = await shotIds()
  const res = await restore(backup, 'replace', true)
  assert.equal(res.status, OK)
  assert.equal(res.body.dryRun, true)
  assert.equal(res.body.snapshot, null)
  assert.equal(res.body.removed.shots, before.length)
  assert.equal(res.body.added.shots, backup.tables.shots.length)
  assert.deepEqual(await shotIds(), before)
  assert.deepEqual(snapshots(), [])
})

test('replace restores exactly what was exported, after saving a snapshot', async () => {
  await api.call('PUT', '/api/settings', { theme: 'moody' })
  const backup = await exportBackup()
  await addShot('replace-me')
  await api.call('DELETE', '/api/beans/b-suke')
  await api.call('PUT', '/api/settings', { theme: 'terminal' })

  const res = await restore(backup, 'replace')
  assert.equal(res.status, OK)
  assert.ok(res.body.snapshot?.startsWith(SNAPSHOT_PREFIX))
  assert.deepEqual(snapshots(), [res.body.snapshot])

  assert.deepEqual((await exportBackup()).tables, backup.tables)
  const now = await settings()
  assert.equal(now.theme, 'moody')
  assert.equal(now.sampleData, undefined, 'the sample-data banner is gone')
})

test('merge adds only what is missing and keeps everything else', async () => {
  const backup = await exportBackup()
  await api.call('DELETE', '/api/shots/s-42')
  await addShot('mine-since')
  await api.call('PUT', '/api/settings', { theme: 'parchment' })

  const res = await restore(backup, 'merge')
  assert.equal(res.status, OK)
  assert.equal(res.body.added.shots, 1)
  assert.equal(res.body.skipped.shots, backup.tables.shots.length - 1)
  const ids = await shotIds()
  assert.ok(ids.includes('s-42') && ids.includes('mine-since'))
  assert.equal((await settings()).theme, 'parchment', 'existing settings are kept')
})

test('a backup from an older version without some columns still imports', async () => {
  const backup = await exportBackup()
  const old = {
    ...backup,
    schemaVersion: 1,
    tables: { ...backup.tables, shots: backup.tables.shots.map(({ bean_id: _id, brew_mode: _mode, landed: _l, bad: _b, ...rest }) => rest) },
  }
  const res = await restore(old, 'replace')
  assert.equal(res.status, OK)
  const shots = (await api.call<Shot[]>('GET', '/api/shots')).body
  assert.equal(shots.length, backup.tables.shots.length)
  assert.ok(shots.every(s => s.bean_id === null), 'missing columns get their defaults')
  assert.ok(shots.filter(s => s.verdict && s.verdict !== 'bad').every(s => s.landed !== null), 'old verdicts are placed on the slider')
})

test('large backups are accepted', async () => {
  await addShot('long-notes', 'x'.repeat(OVER_DEFAULT_LIMIT))
  assert.equal((await restore(await exportBackup(), 'replace')).status, OK)
})

test('wrong, newer or broken files are refused and change nothing', async () => {
  const backup = await exportBackup()
  const before = await shotIds()
  const snapshotsBefore = snapshots()

  const notOurs = await restore({ hello: 'world' }, 'replace')
  assert.equal(notOurs.status, BAD_REQUEST)
  assert.ok(notOurs.body.error?.includes("isn't a Grounded backup"), notOurs.body.error)

  const newer = await restore({ ...backup, schemaVersion: backup.schemaVersion + 1 }, 'replace')
  assert.equal(newer.status, BAD_REQUEST)
  assert.ok(newer.body.error?.includes('newer version'), newer.body.error)

  // The second shot has no date (NOT NULL): the whole import is rolled back
  const shots = [backup.tables.shots[0]!, { ...backup.tables.shots[1]!, date: null }]
  const broken = await restore({ ...backup, tables: { ...backup.tables, shots } }, 'replace')
  assert.equal(broken.status, BAD_REQUEST)
  assert.deepEqual(await shotIds(), before)
  assert.deepEqual(snapshots(), snapshotsBefore, 'no snapshot is left behind')
})

test('shots export as CSV that spreadsheets read safely', async () => {
  await addShot('csv-shot', '=HYPERLINK("x"), with a comma')
  const res = await fetch(`${api.base}/api/export/shots.csv`)
  assert.equal(res.status, OK)
  assert.ok(res.headers.get('content-type')?.startsWith('text/csv'))
  const text = await res.text()
  const lines = text.replace('﻿', '').split('\r\n')
  assert.ok(lines[0]!.startsWith('date,bean,roaster,dose'))
  const row = lines.find(l => l.endsWith(',csv-shot'))
  assert.ok(row?.includes(`"'=HYPERLINK(""x""), with a comma"`), 'formula is defused and the cell quoted')
})

test('brews export as CSV with pours in one column', async () => {
  const res = await fetch(`${api.base}/api/export/brews.csv`)
  assert.equal(res.status, OK)
  const [header, ...rows] = (await res.text()).split('\r\n').filter(Boolean)
  assert.ok(header!.includes(',pours,'))
  assert.ok(rows.length > 0, 'the sample brews are in it')
})
