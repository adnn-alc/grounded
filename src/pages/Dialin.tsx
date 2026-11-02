import { useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Ico from '../components/Ico.tsx'
import { FlavorRadar, FlavSliders } from '../components/charts.tsx'
import { LandedSlider, MiniLanded } from '../components/Landed.tsx'
import { NumField, Readout, TimeField } from '../components/Fields.tsx'
import { BasketChips } from '../components/BeanDoses.tsx'
import { BagPicker, PageHead } from '../components/Shell.tsx'
import { ExtractionEspresso, ExtractionFilter } from './ExtractionDialin.tsx'
import { useUnits, type UnitHelpers } from '../hooks/useUnits.ts'
import { hasNote, MAX_POURS, ROUND_POUR_TO, toAmounts, toggleNote, useBrewForm, useShotForm } from '../hooks/useDialinForm.ts'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.ts'
import { RPM_OPTIONS, rpmLabel } from '../data/grinderRpm.ts'
import { daysOffRoast } from '../data/beans.ts'
import { withCurrent } from '../data/gear.ts'
import { clampRating, landedLabel, mmss, RATING_STEP, ratioText } from '../data/taste.ts'
import type { Bean, BeanInput, Brew, BrewInput, Design, DialinDefaults, DialinPreset, DialinStart, Gear, Shot, ShotInput, Taste, Units } from '../types.ts'

const SHOT_SLIDER_MAX   = 60    // seconds; typing more is fine
const BREW_SLIDER_MAX   = 180   // 3 min; typing more is fine
const BREW_TIME_STEP    = 5
const RADAR_SIZE        = 150
const PERCENT           = 100
const ICON_SM           = 15
const ICON_XS           = 12

// ── Cards used by both modes ──────────────────────────────────────────
interface BagCardProps {
  beans:       Bean[]
  bean:        Bean | undefined
  onPick:      (id: string) => void
  U:           UnitHelpers
  lastLine?:   ReactNode
  onUseLast?:  () => void
  children?:   ReactNode
}

function BagCard({ beans, bean, onPick, U, lastLine, onUseLast, children }: BagCardProps) {
  const days = bean ? daysOffRoast(bean) : null
  if (!beans.length) {
    return <div className="card"><div className="empty">No open bags. Add one in Beans to link your shots to it.</div></div>
  }
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Bag</span>
        {beans.length > 1 && <BagPicker beans={beans} bean={bean} onPick={onPick} className="link-btn" />}
      </div>
      {bean && (
        <div className="row bag-head" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="bag-name">{bean.name}</div>
            <div className="bag-sub">{[bean.roaster, bean.origin?.split('·')[0]?.trim()].filter(Boolean).join(', ')}</div>
          </div>
          {days != null && <span className="pill">day {days}</span>}
          <span className="pill">{U.m(bean.remaining)} {U.mU()} left</span>
        </div>
      )}
      {children && <div className="split">{children}</div>}
      {lastLine && (
        <div className="split last-line">
          <span>Last time</span> {lastLine}
          {onUseLast && <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={onUseLast}>Start from this</button>}
        </div>
      )}
    </div>
  )
}

interface TasteCardProps {
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
}

function TasteCard({ taste, setTaste, landed, setLanded, bad, setBad, badLabel, notes, setNotes, bagNotes, placeholder }: TasteCardProps) {
  return (
    <div className="card stack" style={{ gap: '18px' }}>
      <div>
        <div className="card-head"><span className="card-title">Taste</span><span>drag to adjust</span></div>
        <div className="taste-wrap">
          <FlavSliders taste={taste} onChange={setTaste} />
          <div className="desk-only"><FlavorRadar taste={taste} size={RADAR_SIZE} /></div>
        </div>
      </div>
      <LandedSlider landed={landed} bad={bad} onChange={setLanded} onBadChange={setBad} badLabel={badLabel} />
      {bagNotes.length > 0 && (
        <div>
          <div className="card-head" style={{ marginBottom: '8px' }}><span className="card-title">Did you taste these?</span><span>from the bag</span></div>
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            {bagNotes.map(n => (
              <button key={n} type="button" className={`tag-chip${hasNote(notes, n) ? ' on' : ''}`} onClick={() => setNotes(toggleNote(notes, n))}>{n}</button>
            ))}
          </div>
        </div>
      )}
      <textarea placeholder={placeholder} value={notes} onChange={e => setNotes(e.target.value)} rows={4} aria-label="Notes" />
    </div>
  )
}

/** Phone only: a row that opens a folded section (Taste and notes) */
function DrawerRow({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button type="button" className="card drawer-row" onClick={onToggle}>
      {title}
      <span className="r">{children}<Ico name={open ? 'chevronD' : 'chevronR'} size={ICON_SM} /></span>
    </button>
  )
}

/** The bar with the summary and Save. On a wider screen it sits below the scrolling page, so nothing hides behind it */
function SaveBar({ footer, children }: { footer: HTMLElement | null; children: ReactNode }) {
  const bar = <div className="savebar">{children}</div>
  return footer ? createPortal(bar, footer) : bar
}

function RatingStepper({ value, onChange }: { value: number; onChange: (r: number) => void }) {
  return (
    <div className="rating">
      Rating
      <button type="button" className="icon-btn" aria-label="Lower rating" onClick={() => onChange(clampRating(value - RATING_STEP))}>−</button>
      <output>{value.toFixed(1)}</output>
      <button type="button" className="icon-btn" aria-label="Higher rating" onClick={() => onChange(clampRating(value + RATING_STEP))}>+</button>
    </div>
  )
}

function SelectField({ label, value, onChange, options, render = (o: string) => o }: { label: string; value: string; onChange: (v: string) => void; options: string[]; render?: (o: string) => string }) {
  return (
    <label style={{ minWidth: 0 }}>
      <span className="field-label">{label}</span>
      <select className="select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{render(o)}</option>)}
      </select>
    </label>
  )
}

// ── Espresso ──────────────────────────────────────────────────────────
export interface EspressoDialinProps {
  shots:          Shot[]
  beans:          Bean[]
  gear:           Gear[]
  units:          Units
  waterRecipes:   string[]
  dialinDefaults: DialinDefaults
  brewModes:      string[]
  onSaveShot:     (shot: ShotInput) => void
  onUpdateBean:   (id: string, data: BeanInput) => Promise<Bean>
  preset:         Shot | null
  startBeanId?:   string
  modeSwitch:     ReactNode
  onBack:         () => void
  footer:         HTMLElement | null
}

function EspressoDialin({ units, brewModes, onUpdateBean, modeSwitch, onBack, footer, ...args }: EspressoDialinProps) {
  const U = useUnits(units)
  const { beans, waterRecipes } = args
  const {
    machineOpts, grinderOpts, basketOpts, setSelectedBean, bean, lastShot,
    shotTime, setShotTime, dose, setDose, yieldG, setYieldG, grind, setGrind, temp, setTemp, preinf, setPreinf,
    machine, setMachine, grinderModel, pickGrinder, grinderRpm, setGrinderRpm, basket, setBasket,
    waterRecipe, setWaterRecipe, brewMode, setBrewMode,
    taste, setTaste, landed, setLanded, bad, setBad, notes, setNotes, setRating, shownRating,
    doseNum, yieldNum, timeNum, canSave, loadShot, saveShot,
  } = useShotForm({ ...args, brewModes })
  const [tasteOpen, setTasteOpen] = useState(false)

  return (
    <>
      <PageHead title="Dial-in." onBack={onBack}>{modeSwitch}</PageHead>
      <div className="dialin-cols" style={{ marginTop: '16px' }}>
        <div className="stack">
          <BagCard beans={beans} bean={bean} onPick={setSelectedBean} U={U}
            lastLine={lastShot && <><span className="mono">{U.m(lastShot.dose)} → {U.m(lastShot.yield)} {U.mU()} in {lastShot.time} s</span>, rated {lastShot.rating.toFixed(1)}</>}
            onUseLast={lastShot ? () => loadShot(lastShot) : undefined}>
            {bean && (
              <BasketChips bean={bean} basketOpts={basketOpts} currentBasket={basket} currentDose={dose} currentGrind={grind} U={U} onUpdateBean={onUpdateBean}
                onApply={d => { setDose(String(d.dose)); setBasket(d.basket); if (d.grind) setGrind(String(d.grind)) }}
                onSelectBasket={setBasket} />
            )}
          </BagCard>

          {/* On a phone the shot time comes right after the bag */}
          <div className="card phone-only">
            <div className="card-head"><span className="card-title">Shot time</span>{lastShot && <span className="card-more">last time {lastShot.time} s</span>}</div>
            <TimeField value={shotTime} onChange={setShotTime} max={SHOT_SLIDER_MAX} step={1} last={lastShot?.time} help="" />
          </div>

          <div className="card">
            <div className="card-head desk-only"><span className="card-title">Recipe</span></div>
            <div className="num-grid">
              <NumField label="Dose" value={dose} onChange={setDose} step={0.1} unit={U.mU()} fallback="18" />
              <NumField label="Yield" value={yieldG} onChange={setYieldG} step={0.5} unit={U.mU()} />
              <Readout label="Ratio" value={ratioText(doseNum, yieldNum)} />
              <NumField label="Grind" value={grind} onChange={setGrind} step={0.1} />
              <NumField label="Temperature" value={temp} onChange={setTemp} step={0.5} unit={U.tU()} fallback="93" />
              <NumField label="Pre-infusion" value={preinf} onChange={setPreinf} step={1} unit="s" fallback="0" />
            </div>
            <div className="ratio-line phone-only" style={{ marginTop: '12px' }}>Ratio {ratioText(doseNum, yieldNum)}, pre-infusion {preinf || 0} s</div>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">Gear</span></div>
            <div className="grid grid-2 gear-grid">
              <SelectField label="Machine" value={machine} onChange={setMachine} options={withCurrent(machineOpts, machine)} />
              <SelectField label="Basket" value={basket} onChange={setBasket} options={withCurrent(basketOpts, basket)} />
              <SelectField label="Grinder" value={grinderModel} onChange={pickGrinder} options={withCurrent(grinderOpts, grinderModel)} />
              <SelectField label="Grinder RPM" value={grinderRpm} onChange={setGrinderRpm} options={withCurrent(RPM_OPTIONS, grinderRpm)} render={rpmLabel} />
              <SelectField label="Water recipe" value={waterRecipe} onChange={setWaterRecipe} options={withCurrent(waterRecipes, waterRecipe)} />
              {brewModes.length > 0 && (
                <SelectField label="Brew mode" value={brewMode} onChange={setBrewMode} options={['', ...withCurrent(brewModes, brewMode)]} render={m => m || '–'} />
              )}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card desk-only">
            <div className="card-head"><span className="card-title">Shot time</span><span>from your scale or machine</span></div>
            <TimeField value={shotTime} onChange={setShotTime} max={SHOT_SLIDER_MAX} step={1} last={lastShot?.time}
              help="Type it, drag the slider or nudge it a second at a time." />
          </div>

          <DrawerRow title="Taste and notes" open={tasteOpen} onToggle={() => setTasteOpen(o => !o)}>
            <MiniLanded landed={landed} bad={bad} />
            <span>{bad ? 'Bad shot' : landedLabel(landed)}, {shownRating.toFixed(1)}</span>
          </DrawerRow>
          <div className={`fold${tasteOpen ? ' open' : ''}`}>
            <TasteCard taste={taste} setTaste={setTaste} landed={landed} setLanded={setLanded} bad={bad} setBad={setBad} badLabel="Bad shot"
              notes={notes} setNotes={setNotes} bagNotes={bean?.notes ?? []} placeholder="Bright lemon, honey finish…" />
          </div>
        </div>
      </div>

      <SaveBar footer={footer}>
        <div className="sum">
          <b>{bean?.name || 'Shot'}</b>
          {U.m(doseNum)} → {U.m(yieldNum)} {U.mU()}{timeNum > 0 && ` in ${timeNum} s`}{basket && <span>, {basket}</span>}
        </div>
        <RatingStepper value={shownRating} onChange={setRating} />
        <button className="primary-btn" onClick={saveShot} disabled={!canSave} title={canSave ? '' : 'Enter the shot time first'}>
          <Ico name="check" size={ICON_SM} /> Save shot
        </button>
      </SaveBar>
    </>
  )
}

// ── Filter ────────────────────────────────────────────────────────────
export interface FilterDialinProps {
  brews:          Brew[]
  beans:          Bean[]
  gear:           Gear[]
  units:          Units
  waterRecipes:   string[]
  dialinDefaults: DialinDefaults
  onSaveBrew:     (brew: BrewInput) => void
  preset:         Brew | null
  startBeanId?:   string
  modeSwitch:     ReactNode
  onBack:         () => void
  footer:         HTMLElement | null
}

function FilterDialin({ units, modeSwitch, onBack, footer, ...args }: FilterDialinProps) {
  const U = useUnits(units)
  const { beans, waterRecipes } = args
  const {
    dripperOpts, grinderOpts, setSelectedBean, bean, lastBrew,
    dose, setDose, water, setWater, temp, setTemp, grind, setGrind,
    waterRecipe, setWaterRecipe, dripper, setDripper, grinderModel, pickGrinder, grinderRpm, setGrinderRpm,
    totalTime, setTotalTime, pours, totals, setPourCount, setPour, removePour,
    taste, setTaste, landed, setLanded, bad, setBad, notes, setNotes, setRating, shownRating,
    doseNum, waterNum, timeNum, canSave, loadBrew, saveBrew,
  } = useBrewForm(args)
  const [tasteOpen, setTasteOpen] = useState(false)

  const lastTotal = totals[totals.length - 1] ?? 0

  return (
    <>
      <PageHead title="Dial-in." onBack={onBack}>{modeSwitch}</PageHead>
      <div className="dialin-cols" style={{ marginTop: '16px' }}>
        <div className="stack">
          <BagCard beans={beans} bean={bean} onPick={setSelectedBean} U={U}
            lastLine={lastBrew && <><span className="mono">{U.m(lastBrew.dose)} → {U.m(lastBrew.water)} {U.mU()} in {mmss(lastBrew.time)}</span>, rated {lastBrew.rating.toFixed(1)}</>}
            onUseLast={lastBrew ? () => loadBrew(lastBrew) : undefined} />

          <div className="card">
            <div className="card-head desk-only"><span className="card-title">Recipe</span></div>
            <div className="num-grid">
              <NumField label="Dose" value={dose} onChange={setDose} step={0.5} unit={U.mU()} fallback="15" />
              <NumField label="Water" value={water} onChange={setWater} step={5} unit={U.mU()} fallback="250" />
              <Readout label="Ratio" value={ratioText(doseNum, waterNum, 'filter')} />
              <NumField label="Grind" value={grind} onChange={setGrind} step={1} />
              <NumField label="Temperature" value={temp} onChange={setTemp} step={1} unit={U.tU()} fallback="92" />
              <NumField label="Pours" value={String(pours.length)} onChange={v => setPourCount(parseInt(v, 10) || 1)} step={1} min={1} max={MAX_POURS} />
            </div>
            <div className="ratio-line phone-only" style={{ marginTop: '12px' }}>Ratio {ratioText(doseNum, waterNum, 'filter')}</div>
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">Gear</span></div>
            <div className="grid grid-2 gear-grid">
              <SelectField label="Dripper" value={dripper} onChange={setDripper} options={withCurrent(dripperOpts, dripper)} />
              <SelectField label="Grinder" value={grinderModel} onChange={pickGrinder} options={withCurrent(grinderOpts, grinderModel)} />
              <SelectField label="Grinder RPM" value={grinderRpm} onChange={setGrinderRpm} options={withCurrent(RPM_OPTIONS, grinderRpm)} render={rpmLabel} />
              <SelectField label="Water recipe" value={waterRecipe} onChange={setWaterRecipe} options={withCurrent(waterRecipes, waterRecipe)} />
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Pours</span><span>amounts are the scale total</span>
              <span className="card-more" style={{ color: lastTotal > waterNum ? 'var(--bad)' : undefined }}>{U.m(lastTotal)} / {U.m(waterNum)} {U.mU()}</span>
            </div>
            <div className="pour-bar">
              {toAmounts(totals).map((a, i) => <i key={i} style={{ width: `${waterNum > 0 ? Math.min(PERCENT, (a / Math.max(waterNum, lastTotal)) * PERCENT) : 0}%` }} />)}
            </div>
            {pours.map((p, i) => (
              <div key={i} className="pour-row">
                <span className="n">{i + 1}</span>
                <span className="what">{i === 0 ? 'Bloom' : `Pour ${i + 1}`}</span>
                <label className="amt">{i > 0 && 'to'}
                  <input type="number" inputMode="numeric" step={ROUND_POUR_TO} min={0} value={p} aria-label={`${i === 0 ? 'Bloom' : `Pour ${i + 1}`} scale total`}
                    onChange={e => setPour(i, e.target.value)} />
                  {U.mU()}
                </label>
                <button type="button" className="icon-btn plain sm" aria-label="Remove pour" disabled={pours.length <= 1}
                  onClick={() => removePour(i)}><Ico name="x" size={ICON_XS} /></button>
              </div>
            ))}
            {pours.length < MAX_POURS && (
              <button className="link-btn" style={{ marginTop: '8px' }} onClick={() => setPourCount(pours.length + 1)}>+ Add a pour</button>
            )}
          </div>

          <div className="card">
            <div className="card-head"><span className="card-title">Total time</span><span>from your scale</span></div>
            <TimeField value={totalTime} onChange={setTotalTime} minutes max={BREW_SLIDER_MAX} step={BREW_TIME_STEP} last={lastBrew?.time}
              help="Type it, drag it or nudge 5 s at a time." />
          </div>

          <DrawerRow title="Taste and notes" open={tasteOpen} onToggle={() => setTasteOpen(o => !o)}>
            <MiniLanded landed={landed} bad={bad} badLabel="Bad brew" />
            <span>{bad ? 'Bad brew' : landedLabel(landed)}, {shownRating.toFixed(1)}</span>
          </DrawerRow>
          <div className={`fold${tasteOpen ? ' open' : ''}`}>
            <TasteCard taste={taste} setTaste={setTaste} landed={landed} setLanded={setLanded} bad={bad} setBad={setBad} badLabel="Bad brew"
              notes={notes} setNotes={setNotes} bagNotes={bean?.notes ?? []} placeholder="Juicy, red apple, clean finish…" />
          </div>
        </div>
      </div>

      <SaveBar footer={footer}>
        <div className="sum">
          <b>{bean?.name || 'Brew'}</b>
          {U.m(doseNum)} → {U.m(waterNum)} {U.mU()}{timeNum > 0 && ` in ${mmss(timeNum)}`}<span>, {dripper}</span>
        </div>
        <RatingStepper value={shownRating} onChange={setRating} />
        <button className="primary-btn" onClick={saveBrew} disabled={!canSave} title={canSave ? '' : 'Enter the total time first'}>
          <Ico name="check" size={ICON_SM} /> Save brew
        </button>
      </SaveBar>
    </>
  )
}

// ── Page: Espresso / Filter switch ────────────────────────────────────
interface DialinProps {
  design:           Design
  shots:            Shot[]
  brews:            Brew[]
  beans:            Bean[]
  gear?:            Gear[]
  units:            Units
  waterRecipes?:    string[]
  dialinDefaults?:  DialinDefaults
  brewModes?:       string[]
  onSaveShot:       (shot: ShotInput) => void
  onSaveBrew:       (brew: BrewInput) => void
  onUpdateBean:     (id: string, data: BeanInput) => Promise<Bean>
  preset:           DialinPreset | null
  onPresetConsumed?: () => void
  start:            DialinStart | null
  onStartConsumed?: () => void
  onBack:           () => void
  footer:           HTMLElement | null   // where the save bar goes, below the scrolling page
}

export default function Dialin({ design, shots, brews, beans, gear = [], units, waterRecipes = DEFAULT_WATER_RECIPES, dialinDefaults = {}, brewModes = [], onSaveShot, onSaveBrew, onUpdateBean, preset, onPresetConsumed, start, onStartConsumed, onBack, footer }: DialinProps) {
  const [mode, setMode] = useState<'espresso' | 'filter'>(preset?.type ?? start?.mode ?? 'espresso')
  // Read once: Re-pull / Dial in buttons set these before opening the page
  const [startBeanId] = useState(start?.beanId)
  useEffect(() => { onPresetConsumed?.(); onStartConsumed?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const modeSwitch = (
    <div className="seg">
      {(['espresso', 'filter'] as const).map(m => (
        <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'espresso' ? 'Espresso' : 'Filter'}</button>
      ))}
    </div>
  )
  const common = { beans, gear, units, waterRecipes, dialinDefaults, startBeanId, modeSwitch, onBack, footer }
  // Extraction lays the same form out in three columns around its time dial
  const Espresso = design === 'extraction' ? ExtractionEspresso : EspressoDialin
  const Filter   = design === 'extraction' ? ExtractionFilter : FilterDialin

  return mode === 'espresso'
    ? <Espresso {...common} key="espresso" shots={shots} brewModes={brewModes} onSaveShot={onSaveShot} onUpdateBean={onUpdateBean} preset={preset?.type === 'espresso' ? preset : null} />
    : <Filter {...common} key="filter" brews={brews} onSaveBrew={onSaveBrew} preset={preset?.type === 'filter' ? preset : null} />
}

