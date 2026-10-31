import { useState, type FormEvent } from 'react'
import { Backdrop } from '../components/ui.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { PageHead } from '../components/Shell.tsx'
import { BeanDosesModal } from '../components/BeanDoses.tsx'
import { daysOffRoast, freshness, FRESHNESS_TEXT } from '../data/beans.ts'
import { activeGear, BASKET_KIND } from '../data/gear.ts'
import type { Bean, BeanInput, Gear, Route, Units } from '../types.ts'

const PERCENT = 100
const ICON = 14
const CENTS = 2

// ── BEANS ─────────────────────────────────────────────────────────────
/** Form fields are the inputs' strings until saved */
interface BeanForm {
  name: string; roaster: string; origin: string; process: string; variety: string
  roast_date: string; roast: string; altitude: string; notes: string
  weight: string; remaining: string; price: string
}

const EMPTY_BEAN: BeanForm = {
  name: '', roaster: '', origin: '', process: '', variety: '',
  roast_date: '', roast: '', altitude: '', notes: '', weight: '', remaining: '', price: '',
}

interface BeansProps {
  beans:         Bean[]
  gear?:         Gear[]
  archivedCount?: number
  goTo?:         (route: Route) => void
  onDialIn?:     (bean: Bean) => void
  units:         Units
  onSaveBean:    (bean: BeanInput) => Promise<Bean>
  onUpdateBean:  (id: string, data: BeanInput) => Promise<Bean>
  onArchiveBean: (id: string) => Promise<Bean>
}

export function Beans({ beans, gear = [], archivedCount = 0, goTo, onDialIn, units, onSaveBean, onUpdateBean, onArchiveBean }: BeansProps) {
  const U = useUnits(units)
  const basketOpts = activeGear(gear, BASKET_KIND).map(g => g.name)
  const [adding, setAdding]   = useState(false)
  const [editing, setEditing] = useState<Bean | null>(null)  // bean being edited
  const [dosesFor, setDosesFor] = useState<Bean | null>(null) // bean whose basket doses are open
  const [form, setForm]       = useState(EMPTY_BEAN)
  const [saving, setSaving]   = useState(false)

  const setField = (k: keyof BeanForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  // When correcting a bag's weight, keep what's already been used deducted: remaining = new weight − used
  const setWeight = (v: string) => setForm(f => {
    if (!editing) return { ...f, weight: v }
    const used = Math.max(0, (editing.weight || 0) - (editing.remaining || 0))
    const w = parseFloat(v)
    return { ...f, weight: v, remaining: w > 0 ? String(Math.max(0, +(w - used).toFixed(1))) : f.remaining }
  })

  const openAdd = () => { setForm(EMPTY_BEAN); setAdding(true) }

  const openEdit = (b: Bean) => {
    setForm({
      name:      b.name,
      roaster:   b.roaster,
      origin:    b.origin,
      process:   b.process,
      variety:   b.variety,
      roast_date: b.roast_date || '',
      roast:     b.roast,
      altitude:  b.altitude,
      notes:     Array.isArray(b.notes) ? b.notes.join(', ') : b.notes,
      weight:    String(b.weight),
      remaining: String(b.remaining),
      price:     String(b.price || ''),
    })
    setEditing(b)
  }

  const closeModal = () => { setAdding(false); setEditing(null); setForm(EMPTY_BEAN) }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSaveBean({
        id: 'bean-' + Date.now(),
        name:       form.name.trim(),
        roaster:    form.roaster.trim(),
        origin:     form.origin.trim(),
        process:    form.process.trim(),
        variety:    form.variety.trim(),
        roast_date: form.roast_date.trim(),
        roast:      form.roast.trim(),
        altitude:   form.altitude.trim(),
        notes:      form.notes.split(',').map(n => n.trim()).filter(Boolean),
        weight:     parseFloat(form.weight)    || 0,
        remaining:  parseFloat(form.weight)    || 0,
        price:      parseFloat(form.price)     || 0,
        stock:      'good',
      })
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !form.name.trim()) return
    const weight    = parseFloat(form.weight) || 0
    const remaining = Math.min(weight || Infinity, Math.max(0, parseFloat(form.remaining) || 0))
    const pct       = weight > 0 ? remaining / weight : 1
    setSaving(true)
    try {
      await onUpdateBean(editing.id, {
        ...editing,
        name:       form.name.trim(),
        roaster:    form.roaster.trim(),
        origin:     form.origin.trim(),
        process:    form.process.trim(),
        variety:    form.variety.trim(),
        roast_date: form.roast_date.trim(),
        roast:      form.roast.trim(),
        altitude:   form.altitude.trim(),
        notes:      form.notes.split(',').map(n => n.trim()).filter(Boolean),
        weight,
        remaining,
        stock:      pct > 0.25 ? 'good' : pct > 0.1 ? 'low' : 'critical',
        price:      parseFloat(form.price)     || 0,
      })
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (id: string) => {
    if (!confirm('Move this bag to Finished bags?')) return
    await onArchiveBean(id)
  }

  const isEditing = !!editing
  const showModal = adding || isEditing
  const totalLeft = beans.reduce((a, b) => a + (b.remaining || 0), 0)
  const ages = beans.map(b => daysOffRoast(b)).filter((d): d is number => d != null)
  // Whole numbers in the chosen unit; the total rounds up, so a few grams never read as nothing
  const whole = (g: number) => Math.round(parseFloat(U.m(g)))
  const sub = `${Math.ceil(parseFloat(U.m(totalLeft)))} ${U.mU()} available${ages.length ? `, roasted ${Math.min(...ages)} to ${Math.max(...ages)} days ago` : ''}`

  return (
    <div className="stack">
      <PageHead title="Beans." sub={sub}>
        <div className="seg">
          <button className="on">Open {beans.length}</button>
          <button onClick={() => goTo?.('archived-beans')}>Finished {archivedCount}</button>
        </div>
        <button className="primary-btn" onClick={openAdd}><Ico name="plus" size={ICON} /> Add bean</button>
      </PageHead>

      {beans.length === 0 && <div className="card empty">No open bags. Add the one you're drinking now.</div>}

      <div className="bean-grid">
        {beans.map(b => {
          const pct = b.weight > 0 ? Math.min(PERCENT, (b.remaining / b.weight) * PERCENT) : 0
          const days = daysOffRoast(b)
          const tags = [b.process, b.roast, b.variety].filter(Boolean)
          return (
            <div key={b.id} className="card bean-card">
              <div style={{ minWidth: 0 }}>
                <div className="nm">{b.name}</div>
                <div className="rs">{[b.roaster, b.origin?.replace(' · ', ', ')].filter(Boolean).join(', ')}</div>
                {tags.length > 0 && <div className="tags">{tags.map(t => <span key={t} className="badge">{t}</span>)}</div>}
                {b.notes?.length > 0 && <div className="notes">{b.notes.join(', ')}</div>}
                <div className="dose-list">
                  {(b.doses || []).map(d => (
                    <div key={d.basket} className="dose-row">
                      <span>{d.basket}</span>
                      <span><b>{U.m(d.dose)} {U.mU()}</b></span>
                      <span className="g">{d.grind ? <>grind <b>{d.grind}</b></> : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bean-side">
                <div className="big">{whole(b.remaining)}<small>{U.mU()} of {whole(b.weight)}</small></div>
                <div className="stock-bar"><i className={b.stock} style={{ width: `${pct}%` }} /></div>
                <div className="bean-facts">
                  {days != null && (
                    <div className="kv">
                      <span className="k">Off roast</span>
                      <span className="v">{days}<small>{days === 1 ? 'day' : 'days'}</small></span>
                      <span className={`fresh ${freshness(days)}`}>{FRESHNESS_TEXT[freshness(days)]}</span>
                    </div>
                  )}
                  {b.price > 0 && (
                    <div className="kv">
                      <span className="k">Price</span>
                      <span className="v">€{b.price % 1 === 0 ? b.price : b.price.toFixed(CENTS)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="bean-foot">
                <button className="link-btn" onClick={() => setDosesFor(b)}>{b.doses?.length ? 'Edit basket doses' : '+ Add basket dose'}</button>
                <div className="acts">
                  {onDialIn && <button className="primary-btn" onClick={() => onDialIn(b)}>Dial in</button>}
                  <button className="ghost-btn lg" onClick={() => openEdit(b)}>Edit</button>
                  <button className="icon-btn lg" title="Move to Finished bags" aria-label="Move to Finished bags" onClick={() => handleArchive(b.id)}><Ico name="archive" size={ICON} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <Backdrop onClose={closeModal}>
          <div className="modal" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{isEditing ? 'Edit bean' : 'Add bean'}</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={closeModal}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body scroll" onSubmit={isEditing ? handleEdit : handleAdd}>
              <div className="stack" style={{ gap: 18 }}>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="dial-input" style={{ gridColumn: '1 / -1' }}>
                    <label>Bean name</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Idido"
                      value={form.name} onChange={e => setField('name', e.target.value)} required />
                  </div>
                  <div className="dial-input">
                    <label>Roaster</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Tim Wendelboe"
                      value={form.roaster} onChange={e => setField('roaster', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Origin</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Ethiopia · Yirgacheffe"
                      value={form.origin} onChange={e => setField('origin', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Process</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Washed"
                      value={form.process} onChange={e => setField('process', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Variety</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Heirloom"
                      value={form.variety} onChange={e => setField('variety', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Roast level</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Light"
                      value={form.roast} onChange={e => setField('roast', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Roast date</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. 2026-04-10"
                      value={form.roast_date} onChange={e => setField('roast_date', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Altitude</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. 2100m"
                      value={form.altitude} onChange={e => setField('altitude', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Weight (g)</label>
                    <input type="number" step="1" style={{ fontSize: 14, width: '100%' }} placeholder="250"
                      value={form.weight} onChange={e => setWeight(e.target.value)} />
                  </div>
                  {isEditing && (
                    <div className="dial-input">
                      <label>Remaining (g)</label>
                      <input type="number" step="1" style={{ fontSize: 14, width: '100%' }}
                        value={form.remaining} onChange={e => setField('remaining', e.target.value)} />
                    </div>
                  )}
                  <div className="dial-input">
                    <label>Price (€)</label>
                    <input type="number" step="0.01" style={{ fontSize: 14, width: '100%' }} placeholder="24.00"
                      value={form.price} onChange={e => setField('price', e.target.value)} />
                  </div>
                  <div className="dial-input" style={{ gridColumn: '1 / -1' }}>
                    <label>Flavor notes (comma-separated)</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Bergamot, Jasmine, Lemon curd"
                      value={form.notes} onChange={e => setField('notes', e.target.value)} />
                  </div>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="ghost-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add bean'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Backdrop>
      )}

      {dosesFor && (
        <BeanDosesModal
          bean={dosesFor}
          basketOpts={basketOpts}
          onSave={doses => onUpdateBean(dosesFor.id, { ...dosesFor, doses })}
          onClose={() => setDosesFor(null)}
        />
      )}
    </div>
  )
}
