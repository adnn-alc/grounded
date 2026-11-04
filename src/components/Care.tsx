// Care: Gear's second tab (each machine and grinder with its maintenance tasks, a Done
// button per task, and the log of what was done), the form to add or change a task, and
// Home's reminder when one is due.
import { useState, type FormEvent } from 'react'
import { Backdrop } from './ui.tsx'
import Ico from './Ico.tsx'
import { Field } from './Fields.tsx'
import {
  amountText, bigUnit, careGear, everyText, inUnit, madeWith, nowStamp, reminderText, suggestionsFor, usedWith,
  type CareStatus, type CareSuggestion,
} from '../data/care.ts'
import { dayOf, isoDaysAgo, shortDay } from '../data/dates.ts'
import type { Brew, CareDoneInput, CareLogEntry, CareTask, CareTaskInput, CareUnit, Gear, Shot, Units } from '../types.ts'

const ICON = 14
const PERCENT = 100
const LOG_SHOWN = 8
const TOMORROW = -1     // isoDaysAgo(-1) is tomorrow
const SMALL_STEP = 0.1
const STAMP_DATE = 'YYYY-MM-DD'.length

/** The counts a Done logs: everything that built up since the time before, whatever the task counts */
export const doneInput = (s: CareStatus): CareDoneInput => ({ done_at: nowStamp(), shots: s.shots, grams: Math.round(s.grams), days: s.days })

/** Put off until tomorrow: Home leaves it alone until then (Gear still shows it as due) */
export const snoozed = (task: CareTask): CareTaskInput => ({ ...task, snoozed_until: isoDaysAgo(TOMORROW) })

const shortDate = (date: string): string => dayOf(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// ── Gear → Care ──

export interface CarePanelProps {
  gear:     Gear[]
  tasks:    CareTask[]
  log:      CareLogEntry[]
  statuses: CareStatus[]
  shots:    Shot[]
  brews:    Brew[]
  units:    Units
  onSave:   (t: CareTaskInput) => Promise<CareTask>
  onUpdate: (id: string, t: CareTaskInput) => Promise<CareTask>
  onDelete: (id: string) => Promise<void>
  onDone:   (id: string, d: CareDoneInput) => Promise<CareLogEntry>
  onUndo:   (entryId: string) => Promise<void>
  hidden:   string[]                     // gear ids hidden from Care (the careHidden setting)
  onHiddenChange: (ids: string[]) => void
}

export function CarePanel({ gear, tasks, log, statuses, shots, brews, units, onSave, onUpdate, onDelete, onDone, onUndo, hidden, onHiddenChange }: CarePanelProps) {
  // null: closed; otherwise the gear the task is for, and the task when editing one
  const [editing, setEditing] = useState<{ gear: Gear; task: CareTask | null } | null>(null)
  const [otherId, setOtherId] = useState('')
  const [allLog, setAllLog] = useState(false)
  const shown = careGear(gear, tasks, hidden)
  const others = gear.filter(g => g.status !== 'Retired' && !shown.includes(g))

  const remove = async (task: CareTask) => {
    if (!confirm(`Delete "${task.name}"? What you logged for it stays in the log.`)) return
    await onDelete(task.id)
  }

  return (
    <div className="care">
      <p className="care-lead">Counted from the shots and brews you log with each machine and grinder. Press Done when you've done it, and the count starts again.</p>
      {shown.length === 0 && <div className="card empty">Add your espresso machine or grinder in Gear, and its care tasks go here.</div>}

      <div className="care-cols">
        {shown.map(g => {
          const grams = usedWith(g, shots, brews).reduce((sum, c) => sum + (c.dose || 0), 0)
          const made = madeWith(g, shots, brews)
          const mine = statuses.filter(s => s.task.gear_id === g.id).sort((a, b) => a.task.created_at.localeCompare(b.task.created_at))
          return (
            <section key={g.id} className="card care-unit">
              <div className="care-uh">
                <b>{g.name}</b><span>{g.kind.toLowerCase()}</span>
                <div className="care-cnt">
                  <span className="care-num">{made.shots}</span>
                  <small>{made.shots === 1 ? 'shot' : 'shots'}{made.brews > 0 && `, ${made.brews} ${made.brews === 1 ? 'brew' : 'brews'}`}, {amountText(grams, units)} of coffee</small>
                </div>
              </div>
              {mine.length === 0 && (
                <div className="care-none">No tasks yet.<button className="link-btn" onClick={() => onHiddenChange([...hidden, g.id])}>Hide {g.name} here</button></div>
              )}
              {mine.map(s => <TaskRow key={s.task.id} status={s} log={log} units={units}
                onDone={() => onDone(s.task.id, doneInput(s))} onEdit={() => setEditing({ gear: g, task: s.task })} onDelete={() => remove(s.task)} />)}
              <button className="link-btn care-add" onClick={() => setEditing({ gear: g, task: null })}><Ico name="plus" size={ICON} /> Add a task</button>
            </section>
          )
        })}
      </div>

      {others.length > 0 && (
        <div className="care-other">
          <span>Care for other gear:</span>
          <select className="select" value={otherId} onChange={e => setOtherId(e.target.value)} aria-label="Other gear">
            <option value="">Pick an item…</option>
            {others.map(g => <option key={g.id} value={g.id}>{g.name} ({g.kind.toLowerCase()})</option>)}
          </select>
          <button className="ghost-btn" disabled={!otherId} onClick={() => {
            const g = others.find(x => x.id === otherId)
            if (g) setEditing({ gear: g, task: null })
          }}>Add a task</button>
        </div>
      )}

      <section className="care-log">
        <div className="care-lbl"><b>Done lately</b>{log.length > 0 && `, ${log.length} in all`}</div>
        {log.length === 0 && <div className="care-none">Nothing logged yet. Each Done is kept here, with what had built up since the time before.</div>}
        {(allLog ? log : log.slice(0, LOG_SHOWN)).map(e => (
          <div key={e.id} className="care-entry">
            <span className="when">{shortDay(e.done_at)}</span>
            <span className="what"><b>{e.task}</b>{e.gear && <small>{e.gear}</small>}</span>
            <span className="after">{[e.shots != null && inUnit(e.shots, 'shots', units), e.grams ? amountText(e.grams, units) : null, e.days != null && inUnit(e.days, 'days', units)].filter(Boolean).join(', ')}</span>
            <button className="link-btn" title="Take this Done back" onClick={() => onUndo(e.id)}>Undo</button>
          </div>
        ))}
        {!allLog && log.length > LOG_SHOWN && <button className="link-btn" onClick={() => setAllLog(true)}>Show all {log.length}</button>}
      </section>

      {editing && (
        <TaskModal gear={editing.gear} task={editing.task} tasks={tasks} units={units}
          onSave={async t => {
            const saved = await (editing.task ? onUpdate(editing.task.id, t) : onSave(t))
            // A task for a hidden item shows it again
            if (hidden.includes(t.gear_id)) onHiddenChange(hidden.filter(id => id !== t.gear_id))
            return saved
          }} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

interface TaskRowProps {
  status:   CareStatus
  log:      CareLogEntry[]
  units:    Units
  onDone:   () => void
  onEdit:   () => void
  onDelete: () => void
}

function TaskRow({ status, log, units, onDone, onEdit, onDelete }: TaskRowProps) {
  const { task, due, soon, share, text } = status
  const done = log.filter(e => e.task_id === task.id)
  const times = done.length ? `, done ${done.length === 1 ? 'once' : `${done.length} times`}, last ${shortDate(done[0]!.done_at)}` : ''
  const tone = [due && 'due', soon && 'soon'].filter(Boolean).join(' ')
  return (
    <div className={`care-task ${tone}`}>
      <div className="n">{task.name}<small>{everyText(task, units)}{times}</small></div>
      <div className="m">
        <div className="care-meter"><i style={{ width: `${Math.min(PERCENT, share * PERCENT)}%` }} /></div>
        <div className="st">{text}</div>
      </div>
      <div className="a">
        <button className={due ? 'primary-btn' : 'ghost-btn'} onClick={onDone}>Done</button>
        <button className="icon-btn plain sm" aria-label={`Change ${task.name}`} title="Change" onClick={onEdit}><Ico name="pencil" size={ICON} /></button>
        <button className="icon-btn plain sm danger" aria-label={`Delete ${task.name}`} title="Delete" onClick={onDelete}><Ico name="trash" size={ICON} /></button>
      </div>
    </div>
  )
}

// ── Adding or changing a task ──

interface TaskForm { name: string; every: string; unit: CareUnit; since: string }

const UNIT_OPTIONS: { id: CareUnit; label: string }[] = [
  { id: 'shots', label: 'shots' },
  { id: 'days',  label: 'days' },
  { id: 'grams', label: 'of coffee' },
]

interface TaskModalProps {
  gear:    Gear
  task:    CareTask | null
  tasks:   CareTask[]
  units:   Units
  onSave:  (t: CareTaskInput) => Promise<CareTask>
  onClose: () => void
}

function TaskModal({ gear, task, tasks, units, onSave, onClose }: TaskModalProps) {
  const big = bigUnit(units)
  // Coffee is typed in kg (or lb) and stored in grams
  const shownEvery = (every: number, unit: CareUnit) => String(unit === 'grams' ? +(every / big.grams).toFixed(1) : every)
  const [form, setForm] = useState<TaskForm>(() => task
    ? { name: task.name, every: shownEvery(task.every, task.unit), unit: task.unit, since: task.since.slice(0, STAMP_DATE) }
    : { name: '', every: '', unit: 'shots', since: isoDaysAgo(0) })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof TaskForm>(k: K, v: TaskForm[K]) => setForm(f => ({ ...f, [k]: v }))
  const suggestions = task ? [] : suggestionsFor(gear, tasks)
  const saveLabel = task ? 'Save changes' : 'Add task'
  const pick = (s: CareSuggestion) => setForm(f => ({ ...f, name: s.name, unit: s.unit, every: shownEvery(s.every, s.unit) }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const every = parseFloat(form.every)
    if (!form.name.trim() || !(every > 0)) return
    setSaving(true)
    try {
      // Counting runs from that day; today means from now, so shots made earlier today don't count
      const today = form.since === isoDaysAgo(0)
      const since = today ? nowStamp() : `${form.since} 00:00`
      const unchanged = task && form.since === task.since.slice(0, STAMP_DATE)
      await onSave({
        gear_id: gear.id,
        name: form.name.trim(),
        every: form.unit === 'grams' ? Math.round(every * big.grams) : every,
        unit: form.unit,
        since: unchanged ? task.since : since,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{task ? 'Change task' : `Care for ${gear.name}`}</h2>
          <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={onClose}><Ico name="x" size={ICON} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body form-grid">
            {suggestions.length > 0 && (
              <div className="care-sugg" style={{ gridColumn: '1 / -1' }}>
                {suggestions.map(s => (
                  <button key={s.name} type="button" className={`tag-chip${form.name === s.name ? ' on' : ''}`} onClick={() => pick(s)}>
                    {s.name}<small>{everyText(s, units)}</small>
                  </button>
                ))}
              </div>
            )}
            <Field label="Task" wide>
              <input className="text-input" placeholder="Backflush" required value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>
            <Field label="Every">
              <div className="care-every">
                <input className="text-input mono" type="number" min="0" step={form.unit === 'grams' ? SMALL_STEP : 1} required placeholder="50"
                  value={form.every} onChange={e => set('every', e.target.value)} />
                <select className="select" value={form.unit} onChange={e => {
                  const unit = e.target.value as CareUnit
                  setForm(f => ({ ...f, unit, every: '' }))
                }}>
                  {UNIT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.id === 'grams' ? `${big.label} ${o.label}` : o.label}</option>)}
                </select>
              </div>
            </Field>
            <Field label={task ? 'Counting from' : 'Last done'}>
              <input className="text-input" type="date" max={isoDaysAgo(0)} value={form.since} onChange={e => set('since', e.target.value || isoDaysAgo(0))} />
            </Field>
            <p className="care-hint" style={{ gridColumn: '1 / -1' }}>
              {form.unit === 'shots' && `Shots and brews made with ${gear.name} count.`}
              {form.unit === 'days' && 'Counted in days, whether you make coffee or not.'}
              {form.unit === 'grams' && `The coffee you dose for shots and brews made with ${gear.name}.`}
            </p>
          </div>
          <div className="modal-foot">
            <button type="button" className="ghost-btn lg" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
          </div>
        </form>
      </div>
    </Backdrop>
  )
}

// ── Home: a reminder when a task is due ──

export interface CareReminderProps {
  due:      CareStatus[]
  onDone:   (s: CareStatus) => void
  onSnooze: (s: CareStatus) => void
  onOpen:   () => void
}

/** The most overdue task, with Done and Remind me tomorrow; the rest are a link to Gear → Care */
export function CareReminder({ due, onDone, onSnooze, onOpen }: CareReminderProps) {
  const first = due[0]
  if (!first) return null
  const more = due.length - 1
  return (
    <div className="care-remind">
      <span className="ic"><Ico name="wrench" size={20} /></span>
      <div className="t">
        <b>{first.task.name}{first.gear && <>, {first.gear.name}</>}</b>
        <span>{reminderText(first)}</span>
        <div className="a">
          <button className="primary-btn" onClick={() => onDone(first)}>Done</button>
          <button className="ghost-btn" onClick={() => onSnooze(first)}>Remind me tomorrow</button>
          {more > 0 && <button className="link-btn" onClick={onOpen}>{more} more due</button>}
        </div>
      </div>
    </div>
  )
}
