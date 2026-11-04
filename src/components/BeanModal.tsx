import { useState, type FormEvent } from 'react'
import { Backdrop } from './ui.tsx'
import Ico from './Ico.tsx'
import { freezerFields } from '../data/beans.ts'
import { isoDaysAgo } from '../data/dates.ts'
import type { Bean, BeanInput, StockLevel } from '../types.ts'

// Adding a bag, or editing one (Beans, and a bag's own page)

const STOCK_LOW = 0.25
const STOCK_CRITICAL = 0.1

/** Form fields are the inputs' strings until saved */
interface BeanForm {
  name: string; roaster: string; origin: string; process: string; variety: string
  roast_date: string; roast: string; altitude: string; notes: string
  weight: string; remaining: string; price: string
  frozen_at: string   // '' = not in the freezer
}

const EMPTY_BEAN: BeanForm = {
  name: '', roaster: '', origin: '', process: '', variety: '',
  roast_date: '', roast: '', altitude: '', notes: '', weight: '', remaining: '', price: '', frozen_at: '',
}

const formOf = (b: Bean): BeanForm => ({
  name:       b.name,
  roaster:    b.roaster,
  origin:     b.origin,
  process:    b.process,
  variety:    b.variety,
  roast_date: b.roast_date || '',
  roast:      b.roast,
  altitude:   b.altitude,
  notes:      Array.isArray(b.notes) ? b.notes.join(', ') : b.notes,
  weight:     String(b.weight),
  remaining:  String(b.remaining),
  price:      String(b.price || ''),
  frozen_at:  b.frozen_at || '',
})

function stockOf(pctLeft: number): StockLevel {
  if (pctLeft > STOCK_LOW) return 'good'
  return pctLeft > STOCK_CRITICAL ? 'low' : 'critical'
}

interface BeanModalProps {
  bean:          Bean | null   // null: a new bag
  onSaveBean?:   (bean: BeanInput) => Promise<Bean>
  onUpdateBean:  (id: string, data: BeanInput) => Promise<Bean>
  onClose:       () => void
}

export function BeanModal({ bean, onSaveBean, onUpdateBean, onClose }: BeanModalProps) {
  const [form, setForm]     = useState<BeanForm>(() => bean ? formOf(bean) : EMPTY_BEAN)
  const [saving, setSaving] = useState(false)
  const isEditing = !!bean

  const setField = (k: keyof BeanForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  // When correcting a bag's weight, keep what's already been used deducted: remaining = new weight − used
  const setWeight = (v: string) => setForm(f => {
    if (!bean) return { ...f, weight: v }
    const used = Math.max(0, (bean.weight || 0) - (bean.remaining || 0))
    const w = parseFloat(v)
    return { ...f, weight: v, remaining: w > 0 ? String(Math.max(0, +(w - used).toFixed(1))) : f.remaining }
  })

  const common = () => ({
    name:       form.name.trim(),
    roaster:    form.roaster.trim(),
    origin:     form.origin.trim(),
    process:    form.process.trim(),
    variety:    form.variety.trim(),
    roast_date: form.roast_date.trim(),
    roast:      form.roast.trim(),
    altitude:   form.altitude.trim(),
    notes:      form.notes.split(',').map(n => n.trim()).filter(Boolean),
    price:      parseFloat(form.price) || 0,
  })

  const handleAdd = async () => {
    await onSaveBean?.({
      id: 'bean-' + Date.now(),
      ...common(),
      weight:     parseFloat(form.weight) || 0,
      remaining:  parseFloat(form.weight) || 0,
      stock:      'good',
      ...freezerFields(null, form.frozen_at || null),
    })
  }

  const handleEdit = async (editing: Bean) => {
    const weight    = parseFloat(form.weight) || 0
    const remaining = Math.min(weight || Infinity, Math.max(0, parseFloat(form.remaining) || 0))
    await onUpdateBean(editing.id, {
      ...editing,
      ...common(),
      weight,
      remaining,
      stock:      stockOf(weight > 0 ? remaining / weight : 1),
      ...freezerFields(editing, form.frozen_at || null),
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await (bean ? handleEdit(bean) : handleAdd())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="modal" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isEditing ? 'Edit bean' : 'Add bean'}</h2>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <Ico name="x" size={14} />
          </button>
        </div>
        <form className="modal-body scroll" onSubmit={handleSubmit}>
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
              <div className="freezer-field" style={{ gridColumn: '1 / -1' }}>
                <label className={`bad-check freeze-check${form.frozen_at ? ' on' : ''}`}>
                  In the freezer
                  <input type="checkbox" role="switch" checked={!!form.frozen_at}
                    onChange={e => setField('frozen_at', e.target.checked ? bean?.frozen_at || isoDaysAgo(0) : '')} />
                  <span className="switch" aria-hidden="true" />
                </label>
                {form.frozen_at && (
                  <div className="dial-input">
                    <label>Frozen on</label>
                    <input type="date" style={{ fontSize: 14 }} value={form.frozen_at}
                      onChange={e => setField('frozen_at', e.target.value)} />
                  </div>
                )}
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add bean'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Backdrop>
  )
}
