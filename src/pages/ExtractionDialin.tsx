// Extraction's Dial-in: the same form as Refined (useDialinForm), laid out in three columns:
// the bag and recipe on the left, the time dial in the middle, taste and Save on the right.
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Ico from '../components/Ico.tsx'
import { FlavSliders } from '../components/charts.tsx'
import { LandedSlider } from '../components/Landed.tsx'
import { stepValue, TimeDial } from '../components/Fields.tsx'
import { BasketChips } from '../components/BeanDoses.tsx'
import { BagPicker } from '../components/Shell.tsx'
import { PourBar } from '../components/ExtractionInspector.tsx'
import { useUnits, wholeMass, type UnitHelpers } from '../hooks/useUnits.ts'
import { hasNote, MAX_POURS, ROUND_POUR_TO, toggleNote, useBrewForm, useShotForm } from '../hooks/useDialinForm.ts'
import { RPM_OPTIONS, rpmLabel } from '../data/grinderRpm.ts'
import { daysOffRoast } from '../data/beans.ts'
import { withCurrent } from '../data/gear.ts'
import { clampRating, mmss, RATING_STEP, ratioText } from '../data/taste.ts'
import type { Bean, Taste } from '../types.ts'
import type { EspressoDialinProps, FilterDialinProps } from './Dialin.tsx'

const SHOT_DIAL_MAX  = 60    // seconds; typing more is fine
const BREW_DIAL_MAX  = 180   // 3 min
const BREW_STEP      = 5
// A small tick every 5 s (shot) or 15 s (brew), a number every 10 s or minute
const SHOT_TICK  = 5
const SHOT_MAJOR = 10
const BREW_TICK  = 15
const BREW_MAJOR = 60
const SHOT_DIAL = { tick: SHOT_TICK, major: SHOT_MAJOR }
const BREW_DIAL = { tick: BREW_TICK, major: BREW_MAJOR }
const PERCENT   = 100
const ICON_SM   = 15
const ICON_XS   = 12

// ── Pieces ────────────────────────────────────────────────────────────
interface TopProps {
  beans:      Bean[]
  bean:       Bean | undefined
  onPick:     (id: string) => void
  U:          UnitHelpers
  modeSwitch: ReactNode
  onBack:     () => void
}

/** The bag's name as the title, Change bag, and the Espresso / Filter switch */
function Top({ beans, bean, onPick, U, modeSwitch, onBack }: TopProps) {
  const days = bean ? daysOffRoast(bean) : null
  const facts = bean ? [bean.roaster, days != null && `day ${days}`, `${wholeMass(U, bean.remaining)} ${U.mU()} left`].filter(Boolean) : []
  return (
    <div className="xd-top">
      <button className="back-btn" aria-label="Back" onClick={onBack}><Ico name="back" size={22} /></button>
      <div className="xd-bag">
        <h1 className="xd-bean">{bean?.name ?? 'Dial-in'}</h1>
        {bean
          ? <div className="xd-facts">{facts.map(t => <span key={String(t)}>{t}</span>)}</div>
          : <div className="xd-sub">No open bags. Add one in Beans to link your shots to it.</div>}
      </div>
      {beans.length > 1 && <BagPicker beans={beans} bean={bean} onPick={onPick} className="xd-change" />}
      <div className="xd-mode">{modeSwitch}</div>
    </div>
  )
}

interface BigNumProps {
  label:     string
  value:     string
  onChange:  (value: string) => void
  step:      number
  unit?:     string
  min?:      number
  max?:      number
  fallback?: string
  less?:     string    // what − does, for the button's label ("Finer")
  more?:     string
  className?: string
}

/** A recipe row: the label, a big number to type in, and − / + */
function BigNum({ label, value, onChange, step, unit, min = 0, max = Infinity, fallback, less = 'Less', more = 'More', className = '' }: BigNumProps) {
  const nudge = (dir: 1 | -1) => onChange(stepValue(value, dir, step, min, max))
  return (
    <div className={`xfr ${className}`}>
      <span className="xfr-l">{label}</span>
      <label className="xfr-v">
        {/* The hidden copy of the value sizes the input to its text, so the unit sits right after it */}
        {/* The unit hangs off the right, so the numbers themselves line up down the middle */}
        <span className="xfr-num">
          <span className="xfr-fit" data-value={value || '0'}>
            <input type="number" inputMode="decimal" value={value} step={step} min={min} max={Number.isFinite(max) ? max : undefined}
              aria-label={label} onChange={e => onChange(e.target.value)}
              onBlur={e => { if (fallback != null && !e.target.value.trim()) onChange(fallback) }} />
          </span>
          {unit && <small>{unit}</small>}
        </span>
      </label>
      <button type="button" className="xcb" aria-label={`${less}: ${label.toLowerCase()}`} onClick={() => nudge(-1)}><Ico name="minus" size={ICON_SM} /></button>
      <button type="button" className="xcb" aria-label={`${more}: ${label.toLowerCase()}`} onClick={() => nudge(1)}><Ico name="plus" size={ICON_SM} /></button>
    </div>
  )
}

/** Coffee in against what comes out, as two bars sized by weight, with the ratio between them */
function RatioBars({ dose, out, inLabel, outLabel, kind }: { dose: number; out: number; inLabel: string; outLabel: string; kind: 'espresso' | 'filter' }) {
  const total = dose + out
  const inPct = total > 0 ? (dose / total) * PERCENT : PERCENT / (1 + 1)
  return (
    <div className="xratio" title={`${dose} g of coffee, ${out} g out`}>
      <div className="xratio-bars">
        <i className="in" style={{ width: `${inPct}%` }} />
        <i className="out" />
      </div>
      <div className="xratio-l"><span>{inLabel}</span><b>{ratioText(dose, out, kind)}</b><span>{outLabel}</span></div>
    </div>
  )
}

interface GearItem {
  label:    string
  value:    string
  options:  string[]
  onChange: (value: string) => void
  render?:  (option: string) => string
}

/** Gear as labeled values, each one a picker */
function GearFacts({ items }: { items: GearItem[] }) {
  return (
    <dl className="xgear">
      {items.map(it => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd>
            <select value={it.value} aria-label={it.label} onChange={e => it.onChange(e.target.value)}>
              {withCurrent(it.options, it.value).map(o => <option key={o} value={o}>{it.render ? it.render(o) : o}</option>)}
            </select>
            <Ico name="chevronD" size={ICON_XS} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** "Your last shots on this bag: 12 to 16 s" */
function recentText(times: number[], show: (s: number) => string, noun: string): ReactNode {
  if (!times.length) return null
  const lo = Math.min(...times)
  const hi = Math.max(...times)
  const range = lo === hi ? show(lo) : `${show(lo)} to ${show(hi)}`
  return <>Your last {times.length > 1 ? `${noun}s` : noun} on this bag: <b>{range}</b></>
}

interface TastingProps {
  taste:       Taste
  setTaste:    (t: Taste) => void
  landed:      number | null
  setLanded:   (n: number) => void
  bad:         boolean
  setBad:      (b: boolean) => void
  badLabel:    string
  notes:       string
  setNotes:    (n: string) => void
  bagNotes:    string[]
  placeholder: string
  rating:      number
  setRating:   (r: number) => void
  saveLabel:   string
  canSave:     boolean
  needs:       string     // why Save is off
  onSave:      () => void
}

/** The right column: taste, where it landed, the rating, notes and Save */
function Tasting({ taste, setTaste, landed, setLanded, bad, setBad, badLabel, notes, setNotes, bagNotes, placeholder, rating, setRating, saveLabel, canSave, needs, onSave }: TastingProps) {
  return (
    <div className="xd-right">
      <div className="xd-h"><b>Taste</b></div>
      <FlavSliders taste={taste} onChange={setTaste} />
      <div className="xd-land">
        <LandedSlider landed={landed} bad={bad} onChange={setLanded} onBadChange={setBad} badLabel={badLabel} labelBelow />
      </div>
      <div className="xd-rate">
        <button type="button" className="xcb" aria-label="Lower rating" onClick={() => setRating(clampRating(rating - RATING_STEP))}><Ico name="minus" size={ICON_SM} /></button>
        <output aria-label="Rating">{rating.toFixed(1)}</output>
        <button type="button" className="xcb" aria-label="Higher rating" onClick={() => setRating(clampRating(rating + RATING_STEP))}><Ico name="plus" size={ICON_SM} /></button>
      </div>
      <div className="xd-note">
        {bagNotes.length > 0 && (
          <div className="xd-note-tags">
            <span>From the bag:</span>
            {bagNotes.map(n => (
              <button key={n} type="button" className={`tag-chip${hasNote(notes, n) ? ' on' : ''}`} onClick={() => setNotes(toggleNote(notes, n))}>{n}</button>
            ))}
          </div>
        )}
        <textarea placeholder={placeholder} value={notes} rows={5} aria-label="Notes" onChange={e => setNotes(e.target.value)} />
      </div>
      <button className="primary-btn xd-save" onClick={onSave} disabled={!canSave} title={canSave ? '' : needs}>
        <Ico name="check" size={ICON_SM} /> {saveLabel}
      </button>
    </div>
  )
}

/** Phone only: the summary and Save, in place of the tab bar */
function PhoneSave({ footer, title, summary, label, canSave, needs, onSave }: { footer: HTMLElement | null; title: string; summary: string; label: string; canSave: boolean; needs: string; onSave: () => void }) {
  const bar = (
    <div className="savebar xd-savebar">
      <div className="sum"><b>{title}</b>{summary}</div>
      <button className="primary-btn" onClick={onSave} disabled={!canSave} title={canSave ? '' : needs}>{label}</button>
    </div>
  )
  return footer ? createPortal(bar, footer) : bar
}

// ── Espresso ──────────────────────────────────────────────────────────
export function ExtractionEspresso({ units, brewModes, onUpdateBean, modeSwitch, onBack, footer, ...args }: EspressoDialinProps) {
  const U = useUnits(units)
  const { beans, waterRecipes } = args
  const f = useShotForm({ ...args, brewModes })
  const secs = (s: number) => `${s} s`
  const last = f.lastShot
  const gear: GearItem[] = [
    { label: 'Machine', value: f.machine, options: f.machineOpts, onChange: f.setMachine },
    { label: 'Grinder', value: f.grinderModel, options: f.grinderOpts, onChange: f.pickGrinder },
    { label: 'Speed', value: f.grinderRpm, options: RPM_OPTIONS, onChange: f.setGrinderRpm, render: rpmLabel },
    { label: 'Water', value: f.waterRecipe, options: waterRecipes, onChange: f.setWaterRecipe },
    ...(f.basketOpts.length ? [{ label: 'Basket', value: f.basket, options: f.basketOpts, onChange: f.setBasket }] : []),
    ...(brewModes.length ? [{ label: 'Brew mode', value: f.brewMode, options: ['', ...brewModes], onChange: f.setBrewMode, render: (m: string) => m || '–' }] : []),
  ]

  return (
    <div className="xdial">
      <Top beans={beans} bean={f.bean} onPick={f.setSelectedBean} U={U} modeSwitch={modeSwitch} onBack={onBack} />
      <div className="xd-cols">
        <div className="xd-left">
          <div className="xd-fields">
            <BigNum label="Dose" value={f.dose} onChange={f.setDose} step={0.1} unit={U.mU()} fallback="18" />
            <BigNum label="Yield" value={f.yieldG} onChange={f.setYieldG} step={0.5} unit={U.mU()} />
            <RatioBars dose={f.doseNum} out={f.yieldNum} inLabel="coffee in" outLabel="espresso out" kind="espresso" />
            <BigNum label="Grind" value={f.grind} onChange={f.setGrind} step={0.1} less="Finer" more="Coarser" />
            <BigNum label="Temp" value={f.temp} onChange={f.setTemp} step={0.5} unit={U.tU()} fallback="93" />
            <BigNum label="Pre-infusion" value={f.preinf} onChange={f.setPreinf} step={1} unit="s" fallback="0" />
          </div>
          {f.bean && (
            <div className="xd-baskets">
              <span className="xfr-l">Basket</span>
              <BasketChips bean={f.bean} basketOpts={f.basketOpts} currentBasket={f.basket} U={U} onUpdateBean={onUpdateBean} compact
                currentDose={f.dose} currentGrind={f.grind}
                onApply={d => { f.setDose(String(d.dose)); f.setBasket(d.basket); if (d.grind) f.setGrind(String(d.grind)) }}
                onSelectBasket={f.setBasket} />
            </div>
          )}
          <GearFacts items={gear} />
        </div>

        <div className="xd-mid">
          <TimeDial value={f.shotTime} onChange={f.setShotTime} max={SHOT_DIAL_MAX} step={1} last={last?.time} recent={f.recentTimes}
            help="drag the dial, type it or nudge it" {...SHOT_DIAL} />
          {f.recentTimes.length > 0 && <div className="xd-recent"><i />{recentText(f.recentTimes, secs, 'shot')}</div>}
          {last && (
            <div className="xd-last">
              Last time {U.m(last.dose)} → {U.m(last.yield)} {U.mU()}, grind {last.grind}, rated {last.rating.toFixed(1)}
              <button className="link-btn" onClick={() => f.loadShot(last)}>Start from it</button>
            </div>
          )}
        </div>

        <Tasting taste={f.taste} setTaste={f.setTaste} landed={f.landed} setLanded={f.setLanded} bad={f.bad} setBad={f.setBad} badLabel="Bad shot"
          notes={f.notes} setNotes={f.setNotes} bagNotes={f.bean?.notes ?? []} placeholder="Bright lemon, honey finish…"
          rating={f.shownRating} setRating={f.setRating} saveLabel="Save shot" canSave={f.canSave} needs="Enter the shot time first" onSave={f.saveShot} />
      </div>

      <PhoneSave footer={footer} title={f.bean?.name || 'Shot'} label="Save shot" canSave={f.canSave} needs="Enter the shot time first" onSave={f.saveShot}
        summary={`${U.m(f.doseNum)} → ${U.m(f.yieldNum)} ${U.mU()}${f.timeNum > 0 ? ` in ${f.timeNum} s` : ''}, rated ${f.shownRating.toFixed(1)}`} />
    </div>
  )
}

// ── Filter ────────────────────────────────────────────────────────────
/** The pours as one bar, each part sized by its water and labeled with the scale total; Edit opens the list */
function Pours({ f, U }: { f: ReturnType<typeof useBrewForm>; U: UnitHelpers }) {
  const [editing, setEditing] = useState(false)
  const lastTotal = f.totals[f.totals.length - 1] ?? 0
  const full = Math.max(f.waterNum, lastTotal)
  const over = lastTotal > f.waterNum
  return (
    <div className="xpours">
      <div className="xd-h">
        <b>Pours</b><span>scale totals</span>
        <button className="link-btn" onClick={() => setEditing(e => !e)}>{editing ? 'Done' : 'Edit pours'}</button>
      </div>
      <PourBar totals={f.totals} full={full} U={U} />
      {over && <div className="xpour-over">The pours go past the water target of {wholeMass(U, f.waterNum)} {U.mU()}.</div>}
      {editing && (
        <div className="xpour-edit">
          {f.pours.map((p, i) => (
            <div key={i} className="pour-row">
              <span className="n">{i + 1}</span>
              <span className="what">{i === 0 ? 'Bloom' : `Pour ${i + 1}`}</span>
              <label className="amt">{i > 0 && 'to'}
                <input type="number" inputMode="numeric" step={ROUND_POUR_TO} min={0} value={p} aria-label={`${i === 0 ? 'Bloom' : `Pour ${i + 1}`} scale total`}
                  onChange={e => f.setPour(i, e.target.value)} />
                {U.mU()}
              </label>
              <button type="button" className="icon-btn plain sm" aria-label="Remove pour" disabled={f.pours.length <= 1}
                onClick={() => f.removePour(i)}><Ico name="x" size={ICON_XS} /></button>
            </div>
          ))}
          {f.pours.length < MAX_POURS && (
            <button className="link-btn" onClick={() => f.setPourCount(f.pours.length + 1)}>+ Add a pour</button>
          )}
        </div>
      )}
    </div>
  )
}

export function ExtractionFilter({ units, modeSwitch, onBack, footer, ...args }: FilterDialinProps) {
  const U = useUnits(units)
  const { beans, waterRecipes } = args
  const f = useBrewForm(args)
  const last = f.lastBrew
  const gear: GearItem[] = [
    { label: 'Dripper', value: f.dripper, options: f.dripperOpts, onChange: f.setDripper },
    { label: 'Grinder', value: f.grinderModel, options: f.grinderOpts, onChange: f.pickGrinder },
    { label: 'Speed', value: f.grinderRpm, options: RPM_OPTIONS, onChange: f.setGrinderRpm, render: rpmLabel },
    { label: 'Water', value: f.waterRecipe, options: waterRecipes, onChange: f.setWaterRecipe },
  ]

  return (
    <div className="xdial filter">
      <Top beans={beans} bean={f.bean} onPick={f.setSelectedBean} U={U} modeSwitch={modeSwitch} onBack={onBack} />
      <div className="xd-cols">
        <div className="xd-left">
          <div className="xd-fields">
            <BigNum label="Dose" value={f.dose} onChange={f.setDose} step={0.5} unit={U.mU()} fallback="15" />
            <BigNum label="Water" value={f.water} onChange={f.setWater} step={5} unit={U.mU()} fallback="250" />
            <RatioBars dose={f.doseNum} out={f.waterNum} inLabel="coffee" outLabel="water" kind="filter" />
            <BigNum label="Grind" value={f.grind} onChange={f.setGrind} step={1} less="Finer" more="Coarser" />
            <BigNum label="Temp" value={f.temp} onChange={f.setTemp} step={1} unit={U.tU()} fallback="92" />
          </div>
          <GearFacts items={gear} />
        </div>

        <div className="xd-mid">
          <TimeDial value={f.totalTime} onChange={f.setTotalTime} minutes max={BREW_DIAL_MAX} step={BREW_STEP} last={last?.time} recent={f.recentTimes}
            help="drag, type or nudge 5 s" {...BREW_DIAL} />
          {f.recentTimes.length > 0 && <div className="xd-recent"><i />{recentText(f.recentTimes, mmss, 'brew')}</div>}
          {last && (
            <div className="xd-last">
              Last time {U.m(last.dose)} → {wholeMass(U, last.water)} {U.mU()}, grind {last.grind}, rated {last.rating.toFixed(1)}
              <button className="link-btn" onClick={() => f.loadBrew(last)}>Start from it</button>
            </div>
          )}
          <Pours f={f} U={U} />
        </div>

        <Tasting taste={f.taste} setTaste={f.setTaste} landed={f.landed} setLanded={f.setLanded} bad={f.bad} setBad={f.setBad} badLabel="Bad brew"
          notes={f.notes} setNotes={f.setNotes} bagNotes={f.bean?.notes ?? []} placeholder="Juicy, red apple, clean finish…"
          rating={f.shownRating} setRating={f.setRating} saveLabel="Save brew" canSave={f.canSave} needs="Enter the total time first" onSave={f.saveBrew} />
      </div>

      <PhoneSave footer={footer} title={f.bean?.name || 'Brew'} label="Save brew" canSave={f.canSave} needs="Enter the total time first" onSave={f.saveBrew}
        summary={`${U.m(f.doseNum)} → ${U.m(f.waterNum)} ${U.mU()}${f.timeNum > 0 ? ` in ${mmss(f.timeNum)}` : ''}, rated ${f.shownRating.toFixed(1)}`} />
    </div>
  )
}
