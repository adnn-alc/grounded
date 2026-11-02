import { useState, type FormEvent } from 'react'
import { Backdrop } from './ui.tsx'
import Ico from './Ico.tsx'
import type { UnitHelpers } from '../hooks/useUnits.ts'
import type { Bean, BeanDose, BeanInput } from '../types.ts'

// A bean's doses are [{ basket, dose, grind? }] — one measured dose per basket and grind.
// grind is the grind setting the dose was measured at (optional), so one basket can have a
// dose for each grind. Adding a basket and grind that already have an entry replaces its dose.
const sameEntry = (d: BeanDose, basket: string, grind: number | undefined) => d.basket === basket && (d.grind || 0) === (grind || 0)

/** One basket and grind, as a React key */
export const doseKey = (d: BeanDose): string => `${d.basket}|${d.grind ?? ''}`

export function upsertDose(doses: BeanDose[] = [], basket: string, dose: number, grind: number): BeanDose[] {
  const entry: BeanDose = grind > 0 ? { basket, dose, grind } : { basket, dose }
  return [...doses.filter(d => !sameEntry(d, basket, entry.grind)), entry].sort((a, b) => a.dose - b.dose || (a.grind || 0) - (b.grind || 0))
}

const withCurrent = (opts: string[], cur: string) => cur && !opts.includes(cur) ? [cur, ...opts] : opts

// Compact chips next to saved doses only need a +
const addLabel = (compact: boolean, hasDoses: boolean): string => compact && hasDoses ? '+' : '+ Add basket'

// ── Dial-in: the selected bag's doses as chips ────────────────────────
// Tapping a chip uses that basket and dose. The basket is the same value as the
// one in the gear picker, so changing either updates both.
interface BasketChipsProps {
  bean:           Bean
  basketOpts:     string[]
  currentBasket:  string
  U:              UnitHelpers
  onUpdateBean:   (id: string, data: BeanInput) => Promise<Bean>
  onApply:        (dose: BeanDose) => void
  onSelectBasket: (basket: string) => void
  currentDose?:   string    // with two doses for one basket, the one matching these is marked
  currentGrind?:  string
  compact?:       boolean   // Extraction: no heading, and a small + to add one
}

export function BasketChips({ bean, basketOpts, currentBasket, U, onUpdateBean, onApply, onSelectBasket, currentDose, currentGrind, compact = false }: BasketChipsProps) {
  const doses = bean.doses || []
  const [editing,  setEditing]  = useState(false)
  const [newDose,  setNewDose]  = useState('')
  const [newGrind, setNewGrind] = useState('')
  const [saving,   setSaving]   = useState(false)

  const save = async (next: BeanDose[]) => {
    setSaving(true)
    try { await onUpdateBean(bean.id, { ...bean, doses: next }) }
    finally { setSaving(false) }
  }

  const add = async () => {
    const dose = parseFloat(newDose)
    if (!currentBasket || !(dose > 0)) return
    await save(upsertDose(doses, currentBasket, dose, parseFloat(newGrind)))
    setNewDose('')
    setNewGrind('')
    setEditing(false)
  }

  // The chip in use: its basket, and when that basket has more than one dose, also its dose and grind
  const isOn = (d: BeanDose) => {
    if (d.basket !== currentBasket) return false
    if (doses.filter(x => x.basket === d.basket).length === 1) return true
    return parseFloat(currentDose ?? '') === d.dose && (!d.grind || parseFloat(currentGrind ?? '') === d.grind)
  }

  const pickBasket = (b: string) => {
    const saved = doses.find(d => d.basket === b)
    if (saved) onApply(saved)
    else onSelectBasket(b)
  }

  return (
    <div>
      {!compact && (
        <div className="card-head" style={{ marginBottom: 8 }}>
          <span>Basket doses for this bag</span>
          <span className="card-more">{doses.length ? 'tap one to use it' : ''}</span>
        </div>
      )}
      <div className="chip-grid">
        {doses.map(d => (
          <div key={doseKey(d)} className={`chip${isOn(d) ? ' on' : ''}`} role="button" tabIndex={0}
            title={d.grind ? `Measured at grind ${d.grind}` : 'Use this basket and dose'}
            onClick={() => onApply(d)} onKeyDown={e => { if (e.key === 'Enter') onApply(d) }}>
            <span className="c-k">{d.basket}{editing && (
              <button type="button" aria-label={`Remove ${d.basket}`} disabled={saving} style={{ marginLeft: 6, color: 'var(--text-4)' }}
                onClick={e => { e.stopPropagation(); save(doses.filter(x => doseKey(x) !== doseKey(d))) }}>×</button>
            )}</span>
            <span className="c-row">
              <span className="c-v">{U.m(d.dose)} {U.mU()}</span>
              {d.grind != null && d.grind > 0 && <span className="c-g">grind {d.grind}</span>}
            </span>
          </div>
        ))}
        <button type="button" className="chip add" onClick={() => setEditing(e => !e)}
          aria-label={compact && !editing ? 'Add a basket dose' : undefined} title={compact && !editing ? 'Add a basket dose' : undefined}>
          {editing ? 'Done' : addLabel(compact, doses.length > 0)}
        </button>
      </div>
      {editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 80px 80px auto', gap: 8, marginTop: 10 }}>
          <select className="select" value={currentBasket} onChange={e => pickBasket(e.target.value)} aria-label="Basket">
            {!basketOpts.length && !currentBasket && <option value="">Add baskets in Gear first</option>}
            {withCurrent(basketOpts, currentBasket).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input className="text-input mono" type="number" step="0.1" min="0" placeholder="dose" value={newDose}
            onChange={e => setNewDose(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
          <input className="text-input mono" type="number" step="0.1" min="0" placeholder="grind" value={newGrind}
            title="Grind setting this dose was measured at (optional)"
            onChange={e => setNewGrind(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
          <button type="button" className="ghost-btn lg" onClick={add} disabled={saving || !currentBasket || !(parseFloat(newDose) > 0)}>Save</button>
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
    // Last row wins if the same basket and grind are listed twice
    const doses = rows.reduce<BeanDose[]>((acc, r) => {
      const dose = parseFloat(r.dose)
      return r.basket && dose > 0 ? upsertDose(acc, r.basket, dose, parseFloat(r.grind)) : acc
    }, [])
    setSaving(true)
    try { await onSave(doses); onClose() }
    finally { setSaving(false) }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="modal doses-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Basket doses</h2>
          <span className="page-sub">{bean.name}</span>
          <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={onClose}>
            <Ico name="x" size={14} />
          </button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body scroll">
            {rows.length === 0 ? (
              <div className="empty">No doses yet. Add the dose you measured for each basket, and the grind you used if you like.</div>
            ) : (
              <div className="dmodal-table">
                <div className="dmodal-row dmodal-cols"><span>Basket</span><span>Dose (g)</span><span>Grind</span><span /></div>
                {rows.map((r, i) => (
                  <div key={i} className="dmodal-row">
                    <select className="select" value={r.basket} onChange={e => setRow(i, 'basket', e.target.value)} aria-label="Basket">
                      {!basketOpts.length && !r.basket && <option value="">No baskets in Gear</option>}
                      {withCurrent(basketOpts, r.basket).map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <input className="text-input mono" type="number" inputMode="decimal" step="0.1" min="0" placeholder="18.0" aria-label="Dose"
                      value={r.dose} onChange={e => setRow(i, 'dose', e.target.value)} />
                    <input className="text-input mono" type="number" inputMode="decimal" step="0.1" min="0" placeholder="optional" aria-label="Grind"
                      title="Grind setting this dose was measured at (optional)"
                      value={r.grind} onChange={e => setRow(i, 'grind', e.target.value)} />
                    <button type="button" className="icon-btn plain" aria-label="Remove basket" title="Remove"
                      onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>
                      <Ico name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="link-btn dmodal-add" onClick={addRow}>+ Add basket</button>
          </div>
          <div className="modal-foot">
            <button type="button" className="ghost-btn lg" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </Backdrop>
  )
}
