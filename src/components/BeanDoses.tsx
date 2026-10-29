import { useState, type FormEvent } from 'react'
import Ico from './Ico.tsx'
import type { UnitHelpers } from '../hooks/useUnits.ts'
import type { Bean, BeanDose, BeanInput } from '../types.ts'

// A bean's doses are [{ basket, dose, grind? }] — one measured dose per basket.
// grind is the reference grind setting the dose was measured at (optional).
// Adding a basket that already has an entry replaces its dose.
export function upsertDose(doses: BeanDose[] = [], basket: string, dose: number, grind: number): BeanDose[] {
  const entry: BeanDose = grind > 0 ? { basket, dose, grind } : { basket, dose }
  return [...doses.filter(d => d.basket !== basket), entry].sort((a, b) => a.dose - b.dose)
}

const withCurrent = (opts: string[], cur: string) => cur && !opts.includes(cur) ? [cur, ...opts] : opts

// ── Dial-in card: doses for the selected bean ─────────────────────────
// The basket picker here is the same value as the Gear card's basket, so changing either updates both.
interface BeanDosesCardProps {
  bean:           Bean | undefined
  basketOpts:     string[]
  currentBasket:  string
  U:              UnitHelpers
  onUpdateBean:   (id: string, data: BeanInput) => Promise<Bean>
  onApply:        (dose: BeanDose) => void
  onSelectBasket: (basket: string) => void
}

export function BeanDosesCard({ bean, basketOpts, currentBasket, U, onUpdateBean, onApply, onSelectBasket }: BeanDosesCardProps) {
  const doses = bean?.doses || []
  const newBasket = currentBasket
  const [newDose,   setNewDose]   = useState('')
  const [newGrind,  setNewGrind]  = useState('')
  const [saving,    setSaving]    = useState(false)

  const selectBasket = (b: string) => {
    const saved = doses.find(d => d.basket === b)
    saved ? onApply(saved) : onSelectBasket(b)
  }

  const save = async (next: BeanDose[]) => {
    setSaving(true)
    try { await onUpdateBean(bean!.id, { ...bean!, doses: next }) }
    finally { setSaving(false) }
  }

  const add = async () => {
    const dose = parseFloat(newDose)
    if (!bean || !newBasket || !(dose > 0)) return
    await save(upsertDose(doses, newBasket, dose, parseFloat(newGrind)))
    setNewDose('')
    setNewGrind('')
  }

  const inputStyle = { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%' }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Basket doses</span>
        {bean && <span className="card-more">{bean.name}</span>}
      </div>

      {!bean ? (
        <div className="text-dim" style={{ fontSize: 12 }}>Select a bean to see its doses.</div>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {doses.length === 0 && (
            <div className="text-dim" style={{ fontSize: 12, padding: '4px 0 6px' }}>
              No doses saved for this bean yet. Add one below.
            </div>
          )}
          {doses.map(d => {
            const active = d.basket === currentBasket
            return (
              <div key={d.basket}
                onClick={() => onApply(d)}
                title="Use this basket and dose"
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--bg-2)', border: `1px solid ${active ? 'var(--crema)' : 'var(--border)'}`,
                }}>
                <span style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text-2)' }}>{d.basket}</span>
                <span className="mono tnum" style={{ fontSize: 12, color: 'var(--text-3)' }} title="Grind setting this dose was measured at">
                  {d.grind ? `grind ${d.grind}` : ''}
                </span>
                <span className="mono tnum" style={{ fontSize: 20, color: 'var(--crema)' }}>
                  {U.m(d.dose)}<span className="unit" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 3 }}>{U.mU()}</span>
                </span>
                <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent' }}
                  disabled={saving} title="Remove"
                  onClick={e => { e.stopPropagation(); save(doses.filter(x => x.basket !== d.basket)) }}>
                  <Ico name="x" size={11} />
                </button>
              </div>
            )
          })}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px auto', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <select value={newBasket} onChange={e => selectBasket(e.target.value)}>
              {!basketOpts.length && !newBasket && <option value="">No baskets in gear</option>}
              {withCurrent(basketOpts, newBasket).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <input type="number" step="0.1" min="0" placeholder="dose" value={newDose}
              onChange={e => setNewDose(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              style={inputStyle} />
            <input type="number" step="0.1" min="0" placeholder="grind" value={newGrind}
              title="Grind setting this dose was measured at (optional)"
              onChange={e => setNewGrind(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              style={inputStyle} />
            <button className="ghost-btn" onClick={add} disabled={saving || !newBasket || !(parseFloat(newDose) > 0)}>
              <Ico name="plus" size={12} /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Beans page popup: edit all doses for one bean ─────────────────────
interface DoseRow {
  basket: string
  dose:   string
  grind:  string
}

interface BeanDosesModalProps {
  bean:       Bean
  basketOpts: string[]
  onSave:     (doses: BeanDose[]) => Promise<unknown>
  onClose:    () => void
}

export function BeanDosesModal({ bean, basketOpts, onSave, onClose }: BeanDosesModalProps) {
  const [rows,   setRows]   = useState<DoseRow[]>(() => (bean.doses || []).map(d => ({ basket: d.basket, dose: String(d.dose), grind: d.grind ? String(d.grind) : '' })))
  const [saving, setSaving] = useState(false)

  const setRow = (i: number, k: keyof DoseRow, v: string) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const addRow = () => {
    const unused = basketOpts.find(b => !rows.some(r => r.basket === b))
    setRows(rs => [...rs, { basket: unused || basketOpts[0] || '', dose: '', grind: '' }])
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    // Last row wins if the same basket is listed twice
    const doses = rows.reduce<BeanDose[]>((acc, r) => {
      const dose = parseFloat(r.dose)
      return r.basket && dose > 0 ? upsertDose(acc, r.basket, dose, parseFloat(r.grind)) : acc
    }, [])
    setSaving(true)
    try { await onSave(doses); onClose() }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Basket doses</h2>
          <span className="page-sub">{bean.name}</span>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <Ico name="x" size={14} />
          </button>
        </div>
        <form className="modal-body scroll" onSubmit={handleSave}>
          <div className="stack" style={{ gap: 12 }}>
            {rows.length === 0 && (
              <div className="text-dim" style={{ fontSize: 12 }}>No doses yet. Add the dose you measured for each basket.</div>
            )}
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px auto', gap: 10, alignItems: 'end' }}>
                <div className="dial-input">
                  <label>Basket</label>
                  <select value={r.basket} onChange={e => setRow(i, 'basket', e.target.value)} style={{ marginTop: 4 }}>
                    {!basketOpts.length && !r.basket && <option value="">No baskets in gear</option>}
                    {withCurrent(basketOpts, r.basket).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Dose (g)</label>
                  <input type="number" step="0.1" min="0" style={{ fontSize: 14, width: '100%' }} placeholder="18.0"
                    value={r.dose} onChange={e => setRow(i, 'dose', e.target.value)} />
                </div>
                <div className="dial-input">
                  <label>Grind</label>
                  <input type="number" step="0.1" min="0" style={{ fontSize: 14, width: '100%' }} placeholder="–"
                    title="Grind setting this dose was measured at (optional)"
                    value={r.grind} onChange={e => setRow(i, 'grind', e.target.value)} />
                </div>
                <button type="button" className="icon-btn" title="Remove" style={{ marginBottom: 10 }}
                  onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>
                  <Ico name="trash" size={13} />
                </button>
              </div>
            ))}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="ghost-btn" onClick={addRow}>
                <Ico name="plus" size={12} /> Add basket
              </button>
              <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
                <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
