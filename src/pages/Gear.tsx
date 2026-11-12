import { useEffect, useState, type FormEvent } from 'react'
import { Backdrop } from '../components/ui.tsx'
import Ico from '../components/Ico.tsx'
import { Field } from '../components/Fields.tsx'
import { PageHead } from '../components/Shell.tsx'
import { CarePanel, type CarePanelProps } from '../components/Care.tsx'
import { CURRENCY_SIGNS } from '../hooks/useUnits.ts'
import type { Gear, GearInput, Units } from '../types.ts'

// ── GEAR ──────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['Primary', 'In use', 'Active', 'Travel', 'Retired']
const ACTIVE_STATUSES = new Set(['Primary', 'In use', 'Active'])
const CENTS = 2
const ICON = 14

/** Form fields are the inputs' strings until saved */
interface GearForm {
  kind: string; name: string; meta: string; status: string; owned: string; price: string
}

const EMPTY_FORM: GearForm = { kind: '', name: '', meta: '', status: 'Active', owned: '', price: '' }

// Details are a list split on commas or middle dots: "SSP MP, 64mm flat" or "58mm · dual boiler"
// https://regex101.com/?regex=%5B%2C%C2%B7%5D
const DETAIL_SEPARATOR = /[,·]/

const money = (n: number): string => n % 1 === 0 ? String(n) : n.toFixed(CENTS)

interface GearPageProps {
  gear?:        Gear[]
  onSaveGear:   (g: GearInput) => Promise<Gear>
  onUpdateGear: (id: string, g: GearInput) => Promise<Gear>
  onDeleteGear: (id: string) => Promise<void>
  units:        Units
  care:         Omit<CarePanelProps, 'gear'>   // the Care tab
  startOnCare?: boolean                         // Home's reminder opens the Care tab
  onStartConsumed?: () => void
}

export function GearPage({ gear = [], units, onSaveGear, onUpdateGear, onDeleteGear, care, startOnCare = false, onStartConsumed }: GearPageProps) {
  const sign = CURRENCY_SIGNS[units.currency]
  const [tab, setTab] = useState<'gear' | 'care'>(startOnCare ? 'care' : 'gear')
  useEffect(() => { onStartConsumed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const anyDue = care.statuses.some(s => s.due && s.gear)
  // null: closed, 'new': adding, otherwise the item being edited
  const [open, setOpen]     = useState<Gear | 'new' | null>(null)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const kinds = [...new Set(gear.map(g => g.kind))].sort()
  const set = (k: keyof GearForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openAdd = () => { setForm(EMPTY_FORM); setOpen('new') }
  const openEdit = (g: Gear) => {
    setForm({ kind: g.kind, name: g.name, meta: g.meta || '', status: g.status || 'Active', owned: g.owned || '', price: g.price != null ? String(g.price) : '' })
    setOpen(g)
  }
  const close = () => setOpen(null)
  const isNew = open === 'new'
  const saveLabel = isNew ? 'Add gear' : 'Save changes'

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!open || !form.kind.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      const data = { ...form, price: parseFloat(form.price) || 0 }
      if (open === 'new') await onSaveGear({ ...data, id: 'gear-' + Date.now() })
      else await onUpdateGear(open.id, data)
      close()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (g: Gear) => {
    if (!confirm(`Remove ${g.name} from your gear? Shots that used it keep its name. Its care tasks are deleted; the care log stays.`)) return
    await onDeleteGear(g.id)
  }

  return (
    <div className="stack gear-page">
      <PageHead title="Gear." sub={`${gear.length} ${gear.length === 1 ? 'item' : 'items'}`}>
        <div className="seg">
          <button className={tab === 'gear' ? 'on' : ''} onClick={() => setTab('gear')}>Gear</button>
          <button className={tab === 'care' ? 'on' : ''} onClick={() => setTab('care')}>Care{anyDue && <span className="due-dot" aria-label="something is due" />}</button>
        </div>
        {/* On Care the button keeps its place (hidden), so the tabs don't move when switching */}
        <button className="primary-btn" style={tab === 'care' ? { visibility: 'hidden' } : undefined} aria-hidden={tab === 'care'} tabIndex={tab === 'care' ? -1 : undefined}
          onClick={openAdd}><Ico name="plus" size={ICON} /> Add gear</button>
      </PageHead>

      {tab === 'care' && <CarePanel gear={gear} {...care} />}

      {tab === 'gear' && gear.length === 0 && (
        <div className="card"><div className="empty">No gear yet. Add your machine, grinder and baskets, and Dial-in offers them when you log a shot.</div></div>
      )}

      {tab === 'gear' && <div className="gear-grid-page">
        {kinds.map(kind => {
          const items = gear.filter(g => g.kind === kind)
          return (
            <div key={kind} className="card">
              <div className="card-head"><span className="card-title">{kind}</span><span>{items.length}</span></div>
              {items.map(g => (
                <div key={g.id} className={`gear-item${g.status === 'Retired' ? ' retired' : ''}`}>
                  <div className="gi-main">
                    <div className="gi-name">{g.name}</div>
                    {g.meta && <div className="gi-meta">{g.meta.split(DETAIL_SEPARATOR).map(s => s.trim()).filter(Boolean).join(', ')}</div>}
                    {g.owned && <div className="gi-meta">Since {g.owned}</div>}
                  </div>
                  {/* No price means free or included with another item */}
                  <span className="gi-price">{sign}{money(g.price ?? 0)}</span>
                  <span className={`status-pill${ACTIVE_STATUSES.has(g.status) ? ' on' : ''}${g.status === 'Primary' ? ' primary' : ''}`}>{g.status}</span>
                  <button className="icon-btn plain sm" aria-label={`Edit ${g.name}`} title="Edit" onClick={() => openEdit(g)}><Ico name="pencil" size={ICON} /></button>
                  <button className="icon-btn plain sm danger" aria-label={`Remove ${g.name}`} title="Remove" onClick={() => handleDelete(g)}><Ico name="trash" size={ICON} /></button>
                </div>
              ))}
            </div>
          )
        })}
      </div>}

      {open && (
        <Backdrop onClose={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{isNew ? 'Add gear' : 'Edit gear'}</h2>
              <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={close}><Ico name="x" size={ICON} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body form-grid">
                <Field label="Category">
                  <input className="text-input" placeholder="Grinder" list="gear-kinds" required
                    value={form.kind} onChange={e => set('kind', e.target.value)} />
                  <datalist id="gear-kinds">{kinds.map(k => <option key={k} value={k} />)}</datalist>
                </Field>
                <Field label="Name">
                  <input className="text-input" placeholder="DF64 Gen 2" required value={form.name} onChange={e => set('name', e.target.value)} />
                </Field>
                <Field label="Details" wide>
                  <input className="text-input" placeholder="SSP MP burrs, 64 mm flat" value={form.meta} onChange={e => set('meta', e.target.value)} />
                </Field>
                <Field label="Status">
                  <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Owned since">
                  <input className="text-input" placeholder="2024-03" value={form.owned} onChange={e => set('owned', e.target.value)} />
                </Field>
                <Field label={`Price (${sign})`}>
                  <input className="text-input mono" type="number" min="0" step="0.01" placeholder="0" value={form.price} onChange={e => set('price', e.target.value)} />
                </Field>
              </div>
              <div className="modal-foot">
                <button type="button" className="ghost-btn lg" onClick={close}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}
    </div>
  )
}
