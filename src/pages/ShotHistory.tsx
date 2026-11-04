import { useState, type FormEvent } from 'react'
import { Backdrop } from '../components/ui.tsx'
import { FlavorRadar, FlavSliders } from '../components/charts.tsx'
import { LandedSlider } from '../components/Landed.tsx'
import { HistoryList, InspectorEmpty, type RowNumbers } from '../components/History.tsx'
import { ExtractionInspector, Untasted } from '../components/ExtractionInspector.tsx'
import { shortNum, useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.ts'
import { RPM_OPTIONS } from '../data/grinderRpm.ts'
import { activeGear, BASKET_KIND, GRINDER_KIND, MACHINE_KIND, withCurrent } from '../data/gear.ts'
import { beanLabel, daysOffRoast } from '../data/beans.ts'
import { dayOf, whenText } from '../data/dates.ts'
import { clampRating, ratioText, tasteAverage } from '../data/taste.ts'
import type { Bean, Design, Gear, Route, Shot, ShotInput, Taste, Units } from '../types.ts'

const RADAR_SIZE = 160
const EDIT_RADAR_SIZE = 140
const RATING_DECIMALS = 1
const ICON = 14

// ── SHOT HISTORY ─────────────────────────────────────────────────────
interface ShotHistoryProps {
  design?:            Design
  shots:              Shot[]
  brewCount?:         number
  goTo?:              (route: Route) => void
  beans?:             Bean[]
  gear?:              Gear[]
  units:              Units
  waterRecipes?:      string[]
  brewModes?:         string[]
  onDelete?:          (id: string) => Promise<void>
  onUpdateShot?:      (id: string, data: ShotInput) => Promise<Shot>
  initialSelectedId?: string | null
  onReplicate?:       (shot: Shot) => void
  onFavorite?:        (id: string, val: boolean) => Promise<Shot>
}

/** The edit form keeps numbers as the inputs' strings until saved */
interface ShotEditForm {
  dose: string; yield: string; time: string; preinf: string; temp: string; grind: string
  water_recipe: string; grinder_rpm: string; basket: string; brew_mode: string
  bean_id: string; machine: string; grinder_model: string   // bean_id '' = the shot's bean isn't linked
  taste: Taste
  notes: string
  landed: number | null
  bad: boolean
  rating: string    // '' on a quick shot: stays untasted unless the taste is changed
  tasted: boolean   // the taste sliders were moved
}

/** The typed rating; left empty, the taste average once the sliders were moved, else none (still a quick shot) */
function editedRating(form: ShotEditForm): number | null {
  if (form.rating.trim()) return clampRating(parseFloat(form.rating) || 0)
  return form.tasted ? tasteAverage(form.taste) : null
}

const rpmLabel = (r: string) => r === 'manual' ? 'Manual' : `${r} RPM`

export function ShotHistory({ design, shots, brewCount = 0, goTo, beans = [], gear = [], units, waterRecipes = DEFAULT_WATER_RECIPES, brewModes = [], onDelete, onUpdateShot, initialSelectedId, onReplicate, onFavorite }: ShotHistoryProps) {
  const U = useUnits(units)
  const gearOpts = (re: RegExp) => activeGear(gear, re).map(g => g.name)
  const machineOpts = gearOpts(MACHINE_KIND)
  const grinderOpts = gearOpts(GRINDER_KIND)
  const basketOpts  = gearOpts(BASKET_KIND)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
  const [editing, setEditing] = useState<Shot | null>(null)
  const [form, setForm] = useState<ShotEditForm | null>(null)
  const selected = shots.find(s => s.id === selectedId) ?? null
  const numbers = (s: Shot): RowNumbers => ({ dose: U.m(s.dose), out: U.m(s.yield), unit: U.mU(), time: String(s.time), timeUnit: 's' })

  const set = <K extends keyof ShotEditForm>(k: K, v: ShotEditForm[K]) => setForm(f => f && ({ ...f, [k]: v }))

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shot? This can’t be undone.')) return
    await onDelete?.(id)
    setSelectedId(null)
  }

  const openEdit = (shot: Shot) => {
    setEditing(shot)
    setForm({
      dose: String(shot.dose), yield: String(shot.yield),
      time: String(shot.time), preinf: String(shot.preinf || 0),
      temp: String(shot.temp), grind: String(shot.grind),
      water_recipe: shot.water_recipe || waterRecipes[0],
      grinder_rpm: shot.grinder_rpm || 'manual',
      basket: shot.basket || '',
      brew_mode: shot.brew_mode || '',
      bean_id: shot.bean_id ?? '',
      machine: shot.machine || '',
      grinder_model: shot.grinder_model || '',
      taste: { ...shot.taste },
      notes: shot.notes || '',
      landed: shot.landed,
      bad: shot.bad,
      rating: shot.rating == null ? '' : String(shot.rating),
      tasted: false,
    })
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !form || !onUpdateShot) return
    await onUpdateShot(editing.id, {
      ...editing,
      // The server fills in the bean's name and roaster from bean_id
      bean_id: form.bean_id || null,
      machine: form.machine || null,
      grinder_model: form.grinder_model || null,
      taste: form.taste,
      rating: editedRating(form),
      dose: parseFloat(form.dose), yield: parseFloat(form.yield),
      time: parseInt(form.time, 10), preinf: parseInt(form.preinf, 10),
      temp: parseFloat(form.temp), grind: parseFloat(form.grind),
      water_recipe: form.water_recipe,
      grinder_rpm: form.grinder_rpm,
      basket: form.basket || null,
      brew_mode: form.brew_mode || null,
      notes: form.notes,
      landed: form.bad ? null : form.landed,
      bad: form.bad,
    })
    setEditing(null)
  }

  const inspector = selected ? (() => {
    const bean = beans.find(b => b.id === selected.bean_id)
    const days = bean ? daysOffRoast(bean, dayOf(selected.date)) : null
    const number = shots.length - shots.indexOf(selected)
    const origin = bean?.origin?.split('·')[0]?.trim()
    const sub = [selected.roaster, origin, bean?.process?.toLowerCase(), days != null && `day ${days}`].filter(Boolean).join(', ')
    if (design === 'extraction') {
      const n = numbers(selected)
      return (
        <ExtractionInspector kind="shot" number={number} item={selected}
          record={{ ...n, dose: shortNum(n.dose), out: shortNum(n.out) }}
          pills={[origin, bean?.process, days != null ? `day ${days}` : null].filter((p): p is string => Boolean(p))}
          facts={[
            { k: 'Ratio', v: ratioText(selected.dose, selected.yield) },
            { k: 'Grind', v: String(selected.grind) },
            { k: 'Temp', v: shortNum(U.t(selected.temp)), u: U.tU() },
            { k: 'Pre-infusion', v: String(selected.preinf ?? 0), u: 's' },
          ]}
          gear={[
            { k: 'Machine', v: selected.machine },
            { k: 'Grinder', v: selected.grinder_model, extra: rpmText(selected.grinder_rpm) },
            { k: 'Basket', v: selected.basket },
            { k: 'Water', v: selected.water_recipe },
            { k: 'Brew mode', v: selected.brew_mode },
          ]}
          onClose={() => setSelectedId(null)}
          onFavorite={onFavorite && (() => onFavorite(selected.id, !selected.favorited))}
          onAgain={onReplicate && (() => onReplicate(selected))}
          onEdit={onUpdateShot && (() => openEdit(selected))}
          onDelete={onDelete && (() => handleDelete(selected.id))} />
      )
    }
    return (
      <div className="card inspector">
        <div className="ins-head">
          <button className="icon-btn plain ins-close" aria-label="Back to the list" onClick={() => setSelectedId(null)}><Ico name="back" size={18} /></button>
          <b>Shot {number}</b> {whenText(selected.date)}
          {onFavorite && (
            <button className={`icon-btn plain${selected.favorited ? ' on' : ''}`} style={{ marginLeft: 'auto' }}
              title={selected.favorited ? 'Remove from favorites' : 'Add to favorites'}
              onClick={() => onFavorite(selected.id, !selected.favorited)}>
              <Ico name="star" size={16} style={selected.favorited ? { fill: 'currentColor' } : {}} />
            </button>
          )}
        </div>
        <div>
          <div className="ins-name">{selected.bean || 'Espresso'}</div>
          {sub && <div className="ins-sub">{sub}</div>}
        </div>
        <div className="ins-grid">
          <Kv k="Dose" v={U.m(selected.dose)} u={U.mU()} />
          <Kv k="Yield" v={U.m(selected.yield)} u={U.mU()} />
          <Kv k="Ratio" v={ratioText(selected.dose, selected.yield)} />
          <Kv k="Time" v={String(selected.time)} u="s" />
          <Kv k="Grind" v={String(selected.grind)} />
          <Kv k="Temp" v={U.t(selected.temp)} u={U.tU()} />
          <Kv k="Pre-inf" v={String(selected.preinf ?? 0)} u="s" />
        </div>
        <LandedSlider landed={selected.landed} bad={selected.bad} title="Landed" />
        {selected.rating == null ? (
          <div className="ins-taste untasted-row">
            <Untasted onEdit={onUpdateShot && (() => openEdit(selected))} />
            {selected.notes && <div className="ins-quote">“{selected.notes}”</div>}
          </div>
        ) : (
          <div className="ins-taste">
            <FlavorRadar taste={selected.taste} size={RADAR_SIZE} />
            <div>
              <div className="ins-rating">{selected.rating.toFixed(RATING_DECIMALS)}</div>
              <div className="micro">rating</div>
              {selected.notes && <div className="ins-quote">“{selected.notes}”</div>}
            </div>
          </div>
        )}
        <Setup rows={[
          { k: 'Machine', v: selected.machine },
          { k: 'Grinder', v: selected.grinder_model, extra: rpmText(selected.grinder_rpm) },
          { k: 'Basket', v: selected.basket },
          { k: 'Water', v: selected.water_recipe },
          { k: 'Brew mode', v: selected.brew_mode },
        ]} />
        <div className="ins-actions">
          {onReplicate && <button className="primary-btn" onClick={() => onReplicate(selected)}><Ico name="history" size={ICON} /> Pull again</button>}
          {onUpdateShot && <button className="ghost-btn lg" onClick={() => openEdit(selected)}><Ico name="pencil" size={ICON} /> Edit</button>}
          {onDelete && <button className="ghost-btn lg danger" aria-label="Delete shot" title="Delete shot" onClick={() => handleDelete(selected.id)}><Ico name="trash" size={ICON} /></button>}
        </div>
      </div>
    )
  })() : <InspectorEmpty kind="shot" />

  return (
    <>
      <HistoryList kind="shot" design={design} items={shots} beans={beans} otherCount={brewCount} goTo={goTo}
        selectedId={selectedId} onSelect={s => setSelectedId(s?.id ?? null)}
        rowNumbers={numbers}
        inspector={inspector} />

      {editing && form && (
        <Backdrop onClose={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit shot</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={() => setEditing(null)}><Ico name="x" size={ICON} /></button>
            </div>
            <form className="modal-body stack" onSubmit={handleEdit}>
              <div className="form-grid">
                <Input label={`Dose (${U.mU()})`} value={form.dose} step="0.1" onChange={v => set('dose', v)} />
                <Input label={`Yield (${U.mU()})`} value={form.yield} step="0.1" onChange={v => set('yield', v)} />
                <Input label="Time (s)" value={form.time} step="1" onChange={v => set('time', v)} />
                <Input label="Pre-infusion (s)" value={form.preinf} step="1" onChange={v => set('preinf', v)} />
                <Input label={`Temp (${U.tU()})`} value={form.temp} step="0.5" onChange={v => set('temp', v)} />
                <Input label="Grind" value={form.grind} step="0.1" onChange={v => set('grind', v)} />
              </div>
              <div className="form-grid">
                <div className="dial-input">
                  <label>Beans</label>
                  <select value={form.bean_id} onChange={e => set('bean_id', e.target.value)}>
                    {/* Keep the shot's own bean selectable even if it's finished, deleted or not linked */}
                    {!beans.some(b => b.id === form.bean_id) && <option value={form.bean_id}>{editing.bean || '–'}</option>}
                    {beans.map(b => <option key={b.id} value={b.id}>{beanLabel(b, beans)}</option>)}
                  </select>
                </div>
                <Select label="Water recipe" value={form.water_recipe} options={withCurrent(waterRecipes, form.water_recipe)} onChange={v => set('water_recipe', v)} />
                <Select label="Machine" value={form.machine} options={['', ...withCurrent(machineOpts, form.machine)]} onChange={v => set('machine', v)} />
                <Select label="Basket" value={form.basket} options={['', ...withCurrent(basketOpts, form.basket)]} onChange={v => set('basket', v)} />
                <Select label="Grinder" value={form.grinder_model} options={['', ...withCurrent(grinderOpts, form.grinder_model)]} onChange={v => set('grinder_model', v)} />
                <Select label="Grinder RPM" value={form.grinder_rpm} options={withCurrent(RPM_OPTIONS, form.grinder_rpm)} render={rpmLabel} onChange={v => set('grinder_rpm', v)} />
                {(brewModes.length > 0 || form.brew_mode) && (
                  <Select label="Brew mode" value={form.brew_mode} options={['', ...withCurrent(brewModes, form.brew_mode)]} onChange={v => set('brew_mode', v)} />
                )}
              </div>
              <div className="taste-wrap">
                <FlavSliders taste={form.taste} onChange={t => { set('taste', t); set('tasted', true) }} />
                <div className="desk-only"><FlavorRadar taste={form.taste} size={EDIT_RADAR_SIZE} /></div>
              </div>
              <LandedSlider landed={form.landed} bad={form.bad} onChange={n => set('landed', n)} onBadChange={b => set('bad', b)} />
              <div className="form-grid">
                <Input label="Rating (0–10)" value={form.rating} step="0.5" placeholder={form.tasted ? String(tasteAverage(form.taste)) : 'not tasted'} onChange={v => set('rating', v)} />
              </div>
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

/** "1200 rpm" next to the grinder, nothing for a manual one */
export const rpmText = (rpm: string | null | undefined): string | undefined => rpm && rpm !== 'manual' ? `${rpm} rpm` : undefined

/** The gear a shot or brew was made with, one labeled row each; empty rows are left out */
export function Setup({ rows }: { rows: { k: string; v: string | null | undefined; extra?: string }[] }) {
  const shown = rows.filter(r => r.v)
  if (!shown.length) return null
  return (
    <dl className="ins-setup">
      {shown.map(r => <div key={r.k}><dt>{r.k}</dt><dd>{r.v}{r.extra && <small>{r.extra}</small>}</dd></div>)}
    </dl>
  )
}

export function Kv({ k, v, u }: { k: string; v: string; u?: string }) {
  return <div className="kv"><span className="k">{k}</span><span className="v">{v}{u && <small>{u}</small>}</span></div>
}

export function Input({ label, value, step, placeholder, onChange }: { label: string; value: string; step: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="dial-input">
      <label>{label}</label>
      <input type="number" step={step} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

export function Select({ label, value, options, onChange, render = (o: string) => o || '–' }: { label: string; value: string; options: string[]; onChange: (v: string) => void; render?: (o: string) => string }) {
  return (
    <div className="dial-input">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{render(o)}</option>)}
      </select>
    </div>
  )
}
