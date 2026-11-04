// Settings → Data: download a backup, restore one (add missing or replace
// everything, with a preview first), and export shots/brews for spreadsheets.
import { useRef, useState } from 'react'
import type { ChangeEvent, ReactElement } from 'react'
import Ico from './Ico.tsx'
import { EXPORT_URLS } from '../api/client.ts'
import { showError } from './Toast.tsx'
import type { Backup, BackupTable, ImportMode, ImportResult, TableCounts } from '../types.ts'

export interface DataSettingsProps {
  onPreview: (backup: Backup, mode: ImportMode) => Promise<ImportResult>
  onRestore: (backup: Backup, mode: ImportMode) => Promise<ImportResult>
}

interface ChosenFile { name: string, backup: Backup }

// How each table is named in sentences: [one, many]
const TABLE_WORDS: Record<BackupTable, readonly [string, string]> = {
  beans:   ['bean', 'beans'],
  shots:   ['shot', 'shots'],
  brews:   ['brew', 'brews'],
  gear:    ['gear item', 'gear items'],
  recipes: ['recipe', 'recipes'],
  tips:    ['note', 'notes'],
  care_tasks: ['care task', 'care tasks'],
  care_log:   ['care log entry', 'care log entries'],
}
const TABLES = Object.keys(TABLE_WORDS) as BackupTable[]

const MODES: readonly { id: ImportMode, label: string, desc: string }[] = [
  { id: 'merge',   label: 'Add missing',        desc: 'Keeps everything here and adds what the backup has that this install doesn\'t. Nothing is overwritten.' },
  { id: 'replace', label: 'Replace everything', desc: 'Deletes what\'s here now and loads the backup instead, settings included.' },
]

const CONFIRM: Record<ImportMode, string> = {
  merge:   'Add the missing items from this backup?\n\nNothing you have now is changed. A copy of the current database is saved first.',
  replace: 'Replace everything with this backup?\n\nAll beans, shots, brews, gear, recipes, notes and settings here now are deleted and replaced. A copy of the current database is saved first.',
}

/** "12 shots, 3 beans and 1 recipe"; empty when every count is zero */
function describeCounts(counts: TableCounts): string {
  const parts = TABLES.filter(t => counts[t] > 0).map(t => `${counts[t]} ${TABLE_WORDS[t][counts[t] === 1 ? 0 : 1]}`)
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join('')
}

const total = (counts: TableCounts): number => TABLES.reduce((sum, t) => sum + counts[t], 0)

const tableSizes = (backup: Backup): TableCounts =>
  Object.fromEntries(TABLES.map(t => [t, backup.tables[t]?.length ?? 0])) as TableCounts

function previewText(result: ImportResult): string {
  if (result.mode === 'replace') {
    const here = describeCounts(result.removed)
    return `Deletes what's here now${here ? ` (${here})` : ''} and loads ${describeCounts(result.added) || 'an empty backup'}.`
  }
  const added = describeCounts(result.added)
  const skipped = total(result.skipped)
  if (!added) return 'Everything in this backup is already here, so nothing would change.'
  return `Adds ${added}.${skipped ? ` ${skipped} item${skipped === 1 ? ' is' : 's are'} already here and stay as they are.` : ''}`
}

/** Reads the chosen file and checks it looks like a Grounded backup (the server checks it properly) */
async function readBackup(file: File): Promise<Backup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error(`${file.name} isn't a valid backup file`)
  }
  const b = parsed as Partial<Backup> | null
  if (b?.app !== 'grounded' || typeof b.tables !== 'object') throw new Error(`${file.name} isn't a Grounded backup`)
  return b as Backup
}

export default function DataSettings({ onPreview, onRestore }: DataSettingsProps): ReactElement {
  const input = useRef<HTMLInputElement>(null)
  const [chosen, setChosen]   = useState<ChosenFile | null>(null)
  const [mode, setMode]       = useState<ImportMode>('merge')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [done, setDone]       = useState<ImportResult | null>(null)
  const [busy, setBusy]       = useState(false)

  const runPreview = async (file: ChosenFile, m: ImportMode): Promise<void> => {
    setPreview(null)
    setBusy(true)
    try {
      setPreview(await onPreview(file.backup, m))
    } catch {
      setChosen(null)   // the toast says why (e.g. a backup from a newer version)
    } finally {
      setBusy(false)
    }
  }

  const choose = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (input.current) input.current.value = ''   // so choosing the same file again still fires onChange
    if (!file) return
    setDone(null)
    try {
      const next = { name: file.name, backup: await readBackup(file) }
      setChosen(next)
      await runPreview(next, mode)
    } catch (err) {
      setChosen(null)
      showError((err as Error).message)
    }
  }

  const pickMode = (m: ImportMode): void => {
    if (m === mode) return
    setMode(m)
    if (chosen) void runPreview(chosen, m)
  }

  const restore = async (): Promise<void> => {
    if (!chosen || !confirm(CONFIRM[mode])) return
    setBusy(true)
    try {
      setDone(await onRestore(chosen.backup, mode))
      setChosen(null)
      setPreview(null)
    } catch {
      // the toast says why; the file stays chosen so it can be tried again
    } finally {
      setBusy(false)
    }
  }

  const exported = chosen?.backup.exportedAt ? new Date(chosen.backup.exportedAt) : null

  return (
    <>
      <div className="settings-section">
        <h4>Backup</h4>
        <div className="settings-row">
          <div>
            <div className="label">Download a backup</div>
            <div className="desc">
              Everything in one file: beans (archived too), shots, brews, gear, recipes, notes and settings.
              Keep a copy somewhere other than this server.
            </div>
          </div>
          <a className="ghost-btn" href={EXPORT_URLS.backup} download>
            <Ico name="download" size={12} /> Download
          </a>
        </div>
      </div>

      <div className="settings-section">
        <h4>Restore from a backup</h4>
        <div className="settings-row">
          <div>
            <div className="label">{chosen ? chosen.name : 'Backup file'}</div>
            <div className="desc">
              {chosen
                ? `From Grounded ${chosen.backup.version ?? '?'}${exported ? `, exported ${exported.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''}: ${describeCounts(tableSizes(chosen.backup)) || 'empty'}`
                : 'A .json file downloaded from Grounded. You see what it would change before anything happens.'}
            </div>
          </div>
          <button className="ghost-btn" onClick={() => input.current?.click()} disabled={busy}>
            {chosen ? 'Choose another…' : 'Choose file…'}
          </button>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={choose} />
        </div>

        {chosen && (
          <>
            <div className="settings-row">
              <div>
                <div className="label">How to restore</div>
                <div className="desc">{MODES.find(m => m.id === mode)!.desc}</div>
              </div>
              <div className="unit-toggle">
                {MODES.map(m => (
                  <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => pickMode(m.id)} disabled={busy}>{m.label}</button>
                ))}
              </div>
            </div>
            <div className="restore-preview">
              <span>{preview ? previewText(preview) : 'Checking the backup…'}</span>
              <button className={mode === 'replace' ? 'ghost-btn danger' : 'primary-btn'} onClick={restore}
                disabled={busy || !preview || (mode === 'merge' && total(preview.added) === 0)}>
                {busy && preview ? 'Restoring…' : MODES.find(m => m.id === mode)!.label}
              </button>
            </div>
          </>
        )}

        {done && (
          <div className="restore-preview">
            <span>
              <Ico name="check" size={12} /> Restored: {describeCounts(done.added) || 'nothing new'}{done.mode === 'replace' ? ' loaded' : ' added'}.
              A copy of the previous database was saved next to it as <code>{done.snapshot}</code>.
            </span>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h4>Spreadsheet export</h4>
        <div className="settings-row">
          <div>
            <div className="label">Shots</div>
            <div className="desc">One row per shot as CSV, for Excel, Numbers or Google Sheets.</div>
          </div>
          <a className="ghost-btn" href={EXPORT_URLS.shotsCsv} download><Ico name="download" size={12} /> CSV</a>
        </div>
        <div className="settings-row">
          <div>
            <div className="label">Brews</div>
            <div className="desc">One row per filter brew as CSV.</div>
          </div>
          <a className="ghost-btn" href={EXPORT_URLS.brewsCsv} download><Ico name="download" size={12} /> CSV</a>
        </div>
      </div>
    </>
  )
}
