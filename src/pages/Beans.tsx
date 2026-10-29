import { useState, type FormEvent } from 'react'
import { Meta } from '../components/ui.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { BeanDosesModal } from '../components/BeanDoses.tsx'
import type { Bean, BeanInput, Gear, Units } from '../types.ts'

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
  units:         Units
  onSaveBean:    (bean: BeanInput) => Promise<Bean>
  onUpdateBean:  (id: string, data: BeanInput) => Promise<Bean>
  onArchiveBean: (id: string) => Promise<Bean>
}

export function Beans({ beans, gear = [], units, onSaveBean, onUpdateBean, onArchiveBean }: BeansProps) {
  const U = useUnits(units)
  const stockColor: Record<string, string> = { good: 'var(--good)', low: 'var(--sweet)', critical: 'var(--bitter)' }
  const basketOpts = gear.filter(g => /basket/i.test(g.kind) && g.status !== 'Retired').map(g => g.name)
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
    if (!confirm('Archive this bean? It will move to the bean archive.')) return
    await onArchiveBean(id)
  }

  const isEditing = !!editing
  const showModal = adding || isEditing

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Beans.</h1>
        <span className="page-sub">{beans.length} active</span>
        <button className="primary-btn" style={{ marginLeft: 'auto' }} onClick={openAdd}>
          <Ico name="plus" size={13} /> Add bean
        </button>
      </div>

      <div className="grid grid-2">
        {beans.map(b => {
          const pct = (b.remaining / b.weight) * 100
          return (
            <div key={b.id} className="bean-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, lineHeight: 1 }}>{b.name}</div>
                  <div className="text-muted mono" style={{ fontSize: 10, marginTop: 4, letterSpacing: '0.08em' }}>
                    {b.roaster.toUpperCase()} · {b.origin.toUpperCase()}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: b.doses?.length ? 'var(--crema)' : undefined }}
                    onClick={() => setDosesFor(b)} title="Basket doses">
                    <Ico name="scale" size={11} />
                  </button>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent' }}
                    onClick={() => openEdit(b)} title="Edit bean">
                    <Ico name="pencil" size={11} />
                  </button>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: 'oklch(0.70 0.16 55)' }}
                    onClick={() => handleArchive(b.id)} title="Archive bean">
                    <Ico name="download" size={11} />
                  </button>
                </div>
              </div>

              <div className="grid grid-3" style={{ gap: 4 }}>
                <Meta k="Process"  v={b.process} />
                <Meta k="Roast"    v={b.roast} />
                <Meta k="Variety"  v={b.variety} />
                <Meta k="Altitude" v={b.altitude} />
                <Meta k="Roasted"  v={b.roast_date} />
                <Meta k="Price"    v={b.price ? `€${b.price % 1 === 0 ? b.price : b.price.toFixed(2)}` : null} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div className="micro">Remaining</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {U.m(b.remaining)}{U.mU()} / {U.m(b.weight)}{U.mU()}
                  </div>
                </div>
                <div className="bean-stock-bar">
                  <div className="bean-stock-fill" style={{ width: `${pct.toFixed(1)}%`, background: stockColor[b.stock] || 'var(--crema)' }} />
                </div>
              </div>

              <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                {b.notes.map(n => <span key={n} className="badge">{n}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
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
        </div>
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
