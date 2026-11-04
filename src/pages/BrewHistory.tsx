import { useState, type FormEvent } from 'react'
import { Backdrop } from '../components/ui.tsx'
import { FlavorRadar } from '../components/charts.tsx'
import { LandedSlider } from '../components/Landed.tsx'
import { HistoryList, InspectorEmpty, type RowNumbers } from '../components/History.tsx'
import { ExtractionInspector, PourBar } from '../components/ExtractionInspector.tsx'
import { Input, Kv, Select, Setup, rpmText } from './ShotHistory.tsx'
import { shortNum, useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.ts'
import { RPM_OPTIONS } from '../data/grinderRpm.ts'
import { withCurrent } from '../data/gear.ts'
import { whenText } from '../data/dates.ts'
import { clampRating, mmss, parseMmss, ratioText } from '../data/taste.ts'
import type { Bean, Brew, BrewInput, Design, Pour, Route, Units } from '../types.ts'

const RADAR_SIZE = 160
const RATING_DECIMALS = 1
const ICON = 14

// ── BREW HISTORY ──────────────────────────────────────────────────────
interface BrewHistoryProps {
  design?:            Design
  brews?:             Brew[]
  shotCount?:         number
  goTo?:              (route: Route) => void
  beans?:             Bean[]
  units:              Units
  waterRecipes?:      string[]
  onDeleteBrew?:      (id: string) => Promise<void>
  onUpdateBrew?:      (id: string, data: BrewInput) => Promise<Brew>
  initialSelectedId?: string | null
  onReplicate?:       (brew: Brew) => void
  onFavorite?:        (id: string, val: boolean) => Promise<Brew>
}

/** The edit form keeps numbers as the inputs' strings until saved. Pours are scale totals, as on Dial-in. */
interface BrewEditForm {
  dose: string; water: string; temp: string; grind: string; time: string
  water_recipe: string; grinder_rpm: string
  notes: string
  landed: number | null
  bad: boolean
  rating: string
  pours: string[]
}

const pourGrams = (p: Pour): number => typeof p === 'object' ? p.water : p
const totalsOf = (pours: Pour[]): number[] => pours.reduce<number[]>((acc, p) => [...acc, (acc[acc.length - 1] ?? 0) + (pourGrams(p) || 0)], [])
const rpmLabel = (r: string) => r === 'manual' ? 'Manual' : `${r} RPM`

export function BrewHistory({ design, brews = [], shotCount = 0, goTo, beans = [], units, waterRecipes = DEFAULT_WATER_RECIPES, onDeleteBrew, onUpdateBrew, initialSelectedId, onReplicate, onFavorite }: BrewHistoryProps) {
  const U = useUnits(units)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
  const [editing, setEditing] = useState<Brew | null>(null)
  const [form, setForm] = useState<BrewEditForm | null>(null)
  const selected = brews.find(b => b.id === selectedId) ?? null
  const numbers = (b: Brew): RowNumbers => ({ dose: U.m(b.dose), out: U.m(b.water), unit: U.mU(), time: b.time ? mmss(b.time) : '–' })

  const set = <K extends keyof BrewEditForm>(k: K, v: BrewEditForm[K]) => setForm(f => f && ({ ...f, [k]: v }))

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brew? This can’t be undone.')) return
    await onDeleteBrew?.(id)
    setSelectedId(null)
  }

  const openEdit = (brew: Brew) => {
    setEditing(brew)
    setForm({
      dose: String(brew.dose), water: String(brew.water),
      temp: String(brew.temp), grind: String(brew.grind),
      time: brew.time ? mmss(brew.time) : '',
      water_recipe: brew.water_recipe || waterRecipes[0],
      grinder_rpm: brew.grinder_rpm || 'manual',
      notes: brew.notes || '',
      landed: brew.landed,
      bad: brew.bad,
      rating: String(brew.rating),
      pours: totalsOf(brew.pours || []).map(String),
    })
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !form || !onUpdateBrew) return
    const totals = form.pours.map(p => parseFloat(p) || 0)
    const amounts = totals.map((t, i) => Math.max(0, t - (i ? totals[i - 1]! : 0)))
    await onUpdateBrew(editing.id, {
      ...editing,
      dose: parseFloat(form.dose), water: parseFloat(form.water),
      temp: parseFloat(form.temp), grind: parseFloat(form.grind),
      time: parseMmss(form.time) ?? editing.time,
      water_recipe: form.water_recipe,
      grinder_rpm: form.grinder_rpm,
      notes: form.notes,
      landed: form.bad ? null : form.landed,
      bad: form.bad,
      rating: clampRating(parseFloat(form.rating) || 0),
      pours: amounts,
      num_pours: amounts.length,
    })
    setEditing(null)
  }

  const inspector = selected ? (() => {
    const number = brews.length - brews.indexOf(selected)
    const totals = totalsOf(selected.pours || [])
    if (design === 'extraction') {
      const n = numbers(selected)
      const bean = beans.find(b => b.id === selected.bean_id)
      return (
        <ExtractionInspector kind="brew" number={number} item={selected}
          record={{ ...n, dose: shortNum(n.dose), out: shortNum(n.out) }}
          pills={[bean?.origin?.split('·')[0]?.trim(), bean?.process].filter((p): p is string => Boolean(p))}
          facts={[
            { k: 'Ratio', v: ratioText(selected.dose, selected.water, 'filter') },
            { k: 'Grind', v: String(selected.grind) },
            { k: 'Temp', v: shortNum(U.t(selected.temp)), u: U.tU() },
          ]}
          gear={[
            { k: 'Dripper', v: selected.dripper },
            { k: 'Grinder', v: selected.grinder_model, extra: rpmText(selected.grinder_rpm) },
            { k: 'Water', v: selected.water_recipe },
          ]}
          onClose={() => setSelectedId(null)}
          onFavorite={onFavorite && (() => onFavorite(selected.id, !selected.favorited))}
          onAgain={onReplicate && (() => onReplicate(selected))}
          onEdit={onUpdateBrew && (() => openEdit(selected))}
          onDelete={onDeleteBrew && (() => handleDelete(selected.id))}>
          {totals.length > 0 && (
            <div className="xins-pours">
              <div className="xins-h">{totals.length === 1 ? '1 pour' : `${totals.length} pours`}</div>
              <PourBar totals={totals} full={Math.max(selected.water, totals[totals.length - 1] ?? 0)} U={U} />
            </div>
          )}
        </ExtractionInspector>
      )
    }
    return (
      <div className="card inspector">
        <div className="ins-head">
          <button className="icon-btn plain ins-close" aria-label="Back to the list" onClick={() => setSelectedId(null)}><Ico name="back" size={18} /></button>
          <b>Brew {number}</b> {whenText(selected.date)}
          {onFavorite && (
            <button className={`icon-btn plain${selected.favorited ? ' on' : ''}`} style={{ marginLeft: 'auto' }}
              title={selected.favorited ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => onFavorite(selected.id, !selected.favorited)}>
              <Ico name="star" size={16} style={selected.favorited ? { fill: 'currentColor' } : {}} />
            </button>
          )}
        </div>
        <div>
          <div className="ins-name">{selected.bean || 'Filter'}</div>
          {selected.roaster && <div className="ins-sub">{selected.roaster}</div>}
        </div>
        <div className="ins-grid">
          <Kv k="Dose" v={U.m(selected.dose)} u={U.mU()} />
          <Kv k="Water" v={U.m(selected.water)} u={U.mU()} />
          <Kv k="Ratio" v={ratioText(selected.dose, selected.water, 'filter')} />
          <Kv k="Time" v={selected.time ? mmss(selected.time) : '–'} />
          <Kv k="Grind" v={String(selected.grind)} />
          <Kv k="Temp" v={U.t(selected.temp)} u={U.tU()} />
          <Kv k="Pours" v={String(totals.length || '–')} />
        </div>
        {totals.length > 0 && (
          <div className="ins-gear mono">{totals.map(t => U.m(t)).join(' → ')} {U.mU()}</div>
        )}
        <LandedSlider landed={selected.landed} bad={selected.bad} title="Landed" badLabel="Bad brew" />
        <div className="ins-taste">
          <FlavorRadar taste={selected.taste} size={RADAR_SIZE} />
          <div>
            <div className="ins-rating">{selected.rating.toFixed(RATING_DECIMALS)}</div>
            <div className="micro">rating</div>
            {selected.notes && <div className="ins-quote">“{selected.notes}”</div>}
          </div>
        </div>
        <Setup rows={[
          { k: 'Dripper', v: selected.dripper },
          { k: 'Grinder', v: selected.grinder_model, extra: rpmText(selected.grinder_rpm) },
          { k: 'Water', v: selected.water_recipe },
        ]} />
        <div className="ins-actions">
          {onReplicate && <button className="primary-btn" onClick={() => onReplicate(selected)}><Ico name="history" size={ICON} /> Brew again</button>}
          {onUpdateBrew && <button className="ghost-btn lg" onClick={() => openEdit(selected)}><Ico name="pencil" size={ICON} /> Edit</button>}
          {onDeleteBrew && <button className="ghost-btn lg danger" aria-label="Delete brew" title="Delete brew" onClick={() => handleDelete(selected.id)}><Ico name="trash" size={ICON} /></button>}
        </div>
      </div>
    )
  })() : <InspectorEmpty kind="brew" />

  return (
    <>
      <HistoryList kind="brew" design={design} items={brews} beans={beans} otherCount={shotCount} goTo={goTo}
        selectedId={selectedId} onSelect={b => setSelectedId(b?.id ?? null)}
        rowNumbers={numbers}
        inspector={inspector} />

      {editing && form && (
        <Backdrop onClose={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit brew</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={() => setEditing(null)}><Ico name="x" size={ICON} /></button>
            </div>
            <form className="modal-body stack" onSubmit={handleEdit}>
              <div className="form-grid">
                <Input label={`Dose (${U.mU()})`} value={form.dose} step="0.1" onChange={v => set('dose', v)} />
                <Input label={`Water (${U.mU()})`} value={form.water} step="1" onChange={v => set('water', v)} />
                <Input label={`Temp (${U.tU()})`} value={form.temp} step="1" onChange={v => set('temp', v)} />
                <Input label="Grind" value={form.grind} step="0.1" onChange={v => set('grind', v)} />
                <div className="dial-input">
                  <label>Total time (m:ss)</label>
                  <input value={form.time} placeholder="3:05" onChange={e => set('time', e.target.value)} />
                </div>
                <Input label="Rating (0–10)" value={form.rating} step="0.5" onChange={v => set('rating', v)} />
                <Select label="Water recipe" value={form.water_recipe} options={withCurrent(waterRecipes, form.water_recipe)} onChange={v => set('water_recipe', v)} />
                <Select label="Grinder RPM" value={form.grinder_rpm} options={withCurrent(RPM_OPTIONS, form.grinder_rpm)} render={rpmLabel} onChange={v => set('grinder_rpm', v)} />
              </div>
              {form.pours.length > 0 && (
                <div>
                  <div className="field-label">Pours, as scale totals ({U.mU()})</div>
                  <div className="form-grid pours">
                    {form.pours.map((w, i) => (
                      <Input key={i} label={i === 0 ? 'Bloom' : `Pour ${i + 1}`} value={w} step="5"
                        onChange={v => set('pours', form.pours.map((x, j) => j === i ? v : x))} />
                    ))}
                  </div>
                </div>
              )}
              <LandedSlider landed={form.landed} bad={form.bad} onChange={n => set('landed', n)} onBadChange={b => set('bad', b)} badLabel="Bad brew" />
              <textarea className="edit-notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={5} placeholder="Notes" aria-label="Notes" />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="ghost-btn lg" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="primary-btn">Save changes</button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}
    </>
  )
}
