import { useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Ico from '../components/Ico.tsx'
import { FlavorRadar, FlavSliders } from '../components/charts.tsx'
import { LandedSlider, MiniLanded } from '../components/Landed.tsx'
import { NumField, Readout, TimeField } from '../components/Fields.tsx'
import { BasketChips } from '../components/BeanDoses.tsx'
import { PageHead } from '../components/Shell.tsx'
import { useUnits, type UnitHelpers } from '../hooks/useUnits.ts'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.ts'
import { RPM_OPTIONS } from '../data/grinderRpm.ts'
import { beanLabel, daysOffRoast } from '../data/beans.ts'
import { activeGear, BASKET_KIND, DRIPPER_KIND, GRINDER_KIND, MACHINE_KIND, withCurrent } from '../data/gear.ts'
import { clampRating, landedLabel, mmss, parseMmss, RATING_STEP, ratioText, tasteAverage } from '../data/taste.ts'
import type { Bean, BeanInput, Brew, BrewInput, DialinDefaults, DialinPreset, DialinStart, Gear, Shot, ShotInput, Taste, Units } from '../types.ts'

const MID = 5   // middle of the 1–10 taste scale
const DEFAULT_TASTE: Taste = { acidity: MID, sweetness: MID, body: MID, bitterness: MID, balance: MID, aftertaste: MID }

const SHOT_SLIDER_MAX   = 60    // seconds; typing more is fine
const BREW_SLIDER_MAX   = 180   // 3 min; typing more is fine
const BREW_TIME_STEP    = 5
const MAX_POURS         = 8
const BLOOM_PER_GRAM    = 3     // a first guess at the bloom: 3 g of water per gram of coffee
const ROUND_POUR_TO     = 5
const RADAR_SIZE        = 150
const DEFAULT_POURS     = 3
const PERCENT           = 100
const ICON_SM           = 15
const ICON_XS           = 12

// Dial-in default from Settings (stored in the database), or the built-in fallback
function dd(defaults: DialinDefaults, mode: 'espresso' | 'filter', key: string, fallback: string): string {
  const v = (defaults?.[mode] as Record<string, string | undefined> | undefined)?.[key]
  return v != null && v !== '' ? String(v) : fallback
}

const DRIPPERS           = ['V60', 'Chemex', 'Kalita Wave', 'AeroPress', 'Clever Dripper', 'Origami', 'Melitta']
const ESPRESSO_MACHINES  = ['Bianca', 'Lelit Mara X', 'ECM Synchronika', 'Rocket Appartamento', 'La Marzocco Linea Mini', 'Gaggia Classic', 'Breville Barista Express']
const ESPRESSO_GRINDERS  = ['DF64 Gen 2', 'Niche Zero', 'Lagom P64', 'Fellow Ode', 'Baratza Vario', 'Comandante C40']

// A grinder whose details say "manual" (as a word) has no RPM: "Manual, 48 mm" matches, "Manually tuned" doesn't:
// https://regex101.com/?regex=%5Cbmanual%5Cb&flags=i&testString=Manual%2C%2048%20mm
const MANUAL_WORD = /\bmanual\b/i

const isManualGrinder = (g: Gear | undefined) => Boolean(g?.meta && MANUAL_WORD.test(g.meta))

// Bean of a preset (a past shot/brew loaded via Re-pull): by id, or by name for very old entries
function presetBeanId(beans: Bean[], ref: { bean_id: string | null, bean: string }): string | undefined {
  if (ref.bean_id && beans.some(b => b.id === ref.bean_id)) return ref.bean_id
  return beans.find(b => b.name === ref.bean)?.id
}

const nowStamp = () => {
  const now = new Date()
  return now.toISOString().slice(0, 'YYYY-MM-DD'.length) + ' ' + now.toTimeString().slice(0, 'HH:MM'.length)
}

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
  const [picking, setPicking] = useState(false)
  const days = bean ? daysOffRoast(bean) : null
  if (!beans.length) {
    return <div className="card"><div className="empty">No open bags. Add one in Beans to link your shots to it.</div></div>
  }
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Bag</span>
        <button className="link-btn" onClick={() => setPicking(p => !p)}>{picking ? 'Done' : 'Change bag'}</button>
      </div>
      {picking && (
        <select className="select" style={{ marginBottom: '12px' }} value={bean?.id ?? ''} aria-label="Bag"
          onChange={e => { onPick(e.target.value); setPicking(false) }}>
          {beans.map(b => <option key={b.id} value={b.id}>{beanLabel(b, beans)}</option>)}
        </select>
      )}
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
  // Bag notes are added to the notes as comma-separated words, and removed again
  const parts = notes.split(',').map(p => p.trim()).filter(Boolean)
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const has = (n: string) => parts.some(p => same(p, n))
  const toggleNote = (n: string) => setNotes((has(n) ? parts.filter(p => !same(p, n)) : [...parts, n]).join(', '))
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
              <button key={n} type="button" className={`tag-chip${has(n) ? ' on' : ''}`} onClick={() => toggleNote(n)}>{n}</button>
            ))}
          </div>
        </div>
      )}
      <textarea placeholder={placeholder} value={notes} onChange={e => setNotes(e.target.value)} rows={2} aria-label="Notes" />
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

const rpmLabel = (r: string) => r === 'manual' ? 'Manual' : `${r} RPM`

// ── Espresso ──────────────────────────────────────────────────────────
interface EspressoDialinProps {
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

function EspressoDialin({ shots, beans, gear, units, waterRecipes, dialinDefaults, brewModes, onSaveShot, onUpdateBean, preset, startBeanId, modeSwitch, onBack, footer }: EspressoDialinProps) {
  const U = useUnits(units)

  const machineGear    = activeGear(gear, MACHINE_KIND)
  const grinderGear    = activeGear(gear, GRINDER_KIND)
  const basketGear     = activeGear(gear, BASKET_KIND)
  const machineOpts    = machineGear.length ? machineGear.map(g => g.name) : ESPRESSO_MACHINES
  const grinderOpts    = grinderGear.length ? grinderGear.map(g => g.name) : ESPRESSO_GRINDERS
  const basketOpts     = basketGear.map(g => g.name)
  const primaryOf = (list: Gear[], fallback: string) => (list.find(g => g.status === 'Primary') || list[0])?.name || fallback

  const [selectedBean, setSelectedBean] = useState(() => (startBeanId && beans.some(b => b.id === startBeanId) ? startBeanId : beans[0]?.id) || '')
  const [shotTime, setShotTime] = useState('')
  const [dose,     setDose]     = useState(() => dd(dialinDefaults, 'espresso', 'dose', '18'))
  const [yieldG,   setYieldG]   = useState(() => dd(dialinDefaults, 'espresso', 'yield', '36'))
  const [grind,    setGrind]    = useState(() => dd(dialinDefaults, 'espresso', 'grind', '3'))
  const [temp,     setTemp]     = useState(() => dd(dialinDefaults, 'espresso', 'temp', '92'))
  const [preinf,   setPreinf]   = useState(() => dd(dialinDefaults, 'espresso', 'preinf', '0'))
  const [machine,      setMachine]      = useState(() => primaryOf(machineGear, machineOpts[0] || ''))
  const [grinderModel, setGrinderModel] = useState(() => primaryOf(grinderGear, grinderOpts[0] || ''))
  const [grinderRpm,   setGrinderRpm]   = useState(() => dd(dialinDefaults, 'espresso', 'grinderRpm', '800'))
  const [basket,       setBasket]       = useState(() => primaryOf(basketGear, ''))
  const [waterRecipe,  setWaterRecipe]  = useState(() => dd(dialinDefaults, 'espresso', 'waterRecipe', waterRecipes[0]))
  // Carry over the last shot's brew mode, if it's still one of the configured modes
  const [brewMode, setBrewMode] = useState(() => {
    const last = shots[0]?.brew_mode
    return last && brewModes.includes(last) ? last : ''
  })

  const [taste,  setTaste]  = useState<Taste>({ ...DEFAULT_TASTE })
  const [landed, setLanded] = useState<number | null>(null)
  const [bad,    setBad]    = useState(false)
  const [notes,  setNotes]  = useState('')
  const [rating, setRating] = useState<number | null>(null)   // null: follows the taste average
  const [tasteOpen, setTasteOpen] = useState(false)

  const bean      = beans.find(b => b.id === selectedBean)
  const lastShot  = shots.find(s => s.bean_id === selectedBean)
  const doseNum   = parseFloat(dose) || 0
  const yieldNum  = parseFloat(yieldG) || 0
  const timeNum   = parseMmss(shotTime) ?? 0
  const shownRating = rating ?? tasteAverage(taste)
  const canSave   = timeNum > 0 && doseNum > 0

  const loadShot = (s: Shot) => {
    setDose(String(s.dose ?? dose))
    setYieldG(String(s.yield ?? yieldG))
    setGrind(String(s.grind ?? grind))
    setTemp(String(s.temp ?? temp))
    setPreinf(String(s.preinf ?? 0))
    if (s.machine) setMachine(s.machine)
    if (s.grinder_model) setGrinderModel(s.grinder_model)
    if (s.grinder_rpm) setGrinderRpm(String(s.grinder_rpm))
    if (s.water_recipe) setWaterRecipe(s.water_recipe)
    if (s.basket) setBasket(s.basket)
    if (s.brew_mode) setBrewMode(s.brew_mode)
  }

  useEffect(() => {
    if (!preset) return
    loadShot(preset)
    const presetBean = presetBeanId(beans, preset)
    if (presetBean) setSelectedBean(presetBean)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A grinder marked manual in Gear has no RPM
  const pickGrinder = (name: string) => {
    setGrinderModel(name)
    if (isManualGrinder(grinderGear.find(g => g.name === name))) setGrinderRpm('manual')
  }

  const saveShot = () => {
    if (!canSave) return
    onSaveShot({
      id:      's-' + Date.now(),
      date:    nowStamp(),
      bean_id: selectedBean || null,
      bean:    bean?.name || '',
      roaster: bean?.roaster || '',
      dose: doseNum, yield: yieldNum,
      time: timeNum, preinf: parseInt(preinf, 10) || 0, temp: parseFloat(temp) || 0, grind: parseFloat(grind) || 0,
      machine, grinder_model: grinderModel, grinder_rpm: grinderRpm,
      basket: basket || null,
      brew_mode: brewMode || null,
      water_recipe: waterRecipe,
      rating: shownRating,
      taste: { ...taste },
      notes,
      landed: bad ? null : landed,
      bad,
    })
  }

  return (
    <>
      <PageHead title="Dial-in." onBack={onBack}>{modeSwitch}</PageHead>
      <div className="dialin-cols" style={{ marginTop: '16px' }}>
        <div className="stack">
          <BagCard beans={beans} bean={bean} onPick={setSelectedBean} U={U}
            lastLine={lastShot && <><span className="mono">{U.m(lastShot.dose)} → {U.m(lastShot.yield)} {U.mU()} in {lastShot.time} s</span>, rated {lastShot.rating.toFixed(1)}</>}
            onUseLast={lastShot ? () => loadShot(lastShot) : undefined}>
            {bean && (
              <BasketChips bean={bean} basketOpts={basketOpts} currentBasket={basket} U={U} onUpdateBean={onUpdateBean}
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
// Pours are entered as scale totals ("to 150 g") and stored as the amount of each pour.
const toTotals = (amounts: number[]): number[] => amounts.reduce<number[]>((acc, a) => [...acc, (acc[acc.length - 1] ?? 0) + a], [])
const toAmounts = (totals: number[]): number[] => totals.map((t, i) => Math.max(0, t - (i ? totals[i - 1]! : 0)))
const roundPour = (g: number) => Math.round(g / ROUND_POUR_TO) * ROUND_POUR_TO

/** Bloom of about 3× the dose, then even pours up to the water target */
function plannedTotals(count: number, dose: number, water: number): string[] {
  const bloom = Math.min(water, roundPour(dose * BLOOM_PER_GRAM))
  if (count <= 1) return [String(water)]
  return Array.from({ length: count }, (_, i) => String(i === 0 ? bloom : roundPour(bloom + ((water - bloom) * i) / (count - 1))))
}

interface FilterDialinProps {
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

function FilterDialin({ brews, beans, gear, units, waterRecipes, dialinDefaults, onSaveBrew, preset, startBeanId, modeSwitch, onBack, footer }: FilterDialinProps) {
  const U = useUnits(units)

  const dripperGear    = activeGear(gear, DRIPPER_KIND)
  const filterGrinders = activeGear(gear, GRINDER_KIND)
  const dripperOpts    = dripperGear.length    ? dripperGear.map(g => g.name)    : DRIPPERS
  const grinderOpts    = filterGrinders.length ? filterGrinders.map(g => g.name) : ESPRESSO_GRINDERS
  const primaryOf = (list: Gear[], fallback: string) => (list.find(g => g.status === 'Primary') || list[0])?.name || fallback

  const [selectedBean, setSelectedBean] = useState(() => (startBeanId && beans.some(b => b.id === startBeanId) ? startBeanId : beans[0]?.id) || '')
  const [dose,        setDose]        = useState(() => dd(dialinDefaults, 'filter', 'dose', '15'))
  const [water,       setWater]       = useState(() => dd(dialinDefaults, 'filter', 'water', '250'))
  const [temp,        setTemp]        = useState(() => dd(dialinDefaults, 'filter', 'temp', '92'))
  const [grind,       setGrind]       = useState(() => dd(dialinDefaults, 'filter', 'grind', '10'))
  const [waterRecipe, setWaterRecipe] = useState(() => dd(dialinDefaults, 'filter', 'waterRecipe', waterRecipes[0]))
  const [dripper,     setDripper]     = useState(() => primaryOf(dripperGear, dripperOpts[0] || 'V60'))
  const [grinderModel, setGrinderModel] = useState(() => primaryOf(filterGrinders, grinderOpts[0] || ''))
  const [grinderRpm,  setGrinderRpm]  = useState(() => dd(dialinDefaults, 'filter', 'grinderRpm', '800'))
  const [totalTime,   setTotalTime]   = useState('')
  const [pours,       setPours]       = useState<string[]>(() => plannedTotals(parseInt(dd(dialinDefaults, 'filter', 'numPours', String(DEFAULT_POURS)), 10) || DEFAULT_POURS, parseFloat(dose) || 0, parseFloat(water) || 0))
  const [poursEdited, setPoursEdited] = useState(false)

  const [taste,  setTaste]  = useState<Taste>({ ...DEFAULT_TASTE })
  const [landed, setLanded] = useState<number | null>(null)
  const [bad,    setBad]    = useState(false)
  const [notes,  setNotes]  = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [tasteOpen, setTasteOpen] = useState(false)

  const bean     = beans.find(b => b.id === selectedBean)
  const lastBrew = brews.find(b => b.bean_id === selectedBean)
  const doseNum  = parseFloat(dose) || 0
  const waterNum = parseFloat(water) || 0
  const timeNum  = parseMmss(totalTime) ?? 0
  const totals   = pours.map(p => parseFloat(p) || 0)
  const shownRating = rating ?? tasteAverage(taste)
  const canSave  = timeNum > 0 && doseNum > 0

  // Until a pour is typed in, the plan follows the dose and water
  useEffect(() => {
    if (!poursEdited) setPours(plannedTotals(pours.length, doseNum, waterNum))
  }, [doseNum, waterNum]) // eslint-disable-line react-hooks/exhaustive-deps

  const setPourCount = (n: number) => {
    const count = Math.min(MAX_POURS, Math.max(1, n))
    if (poursEdited) {
      setPours(p => count > p.length ? [...p, ...Array.from({ length: count - p.length }, () => String(waterNum))] : p.slice(0, count))
    } else {
      setPours(plannedTotals(count, doseNum, waterNum))
    }
  }

  const loadBrew = (b: Brew) => {
    setDose(String(b.dose ?? dose))
    setWater(String(b.water ?? water))
    setTemp(String(b.temp ?? temp))
    setGrind(String(b.grind ?? grind))
    if (b.dripper) setDripper(b.dripper)
    if (b.grinder_model) setGrinderModel(b.grinder_model)
    if (b.grinder_rpm) setGrinderRpm(String(b.grinder_rpm))
    if (b.water_recipe) setWaterRecipe(b.water_recipe)
    if (b.pours?.length) {
      setPours(toTotals(b.pours.map(p => typeof p === 'object' ? p.water : p)).map(String))
      setPoursEdited(true)
    }
  }

  useEffect(() => {
    if (!preset) return
    loadBrew(preset)
    const presetBean = presetBeanId(beans, preset)
    if (presetBean) setSelectedBean(presetBean)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickGrinder = (name: string) => {
    setGrinderModel(name)
    if (isManualGrinder(filterGrinders.find(g => g.name === name))) setGrinderRpm('manual')
  }

  const saveBrew = () => {
    if (!canSave) return
    const amounts = toAmounts(totals)
    onSaveBrew({
      id:          'brew-' + Date.now(),
      date:        nowStamp(),
      bean_id:     selectedBean || null,
      bean:        bean?.name || '',
      roaster:     bean?.roaster || '',
      dripper,
      grinder_model: grinderModel,
      grinder_rpm:   grinderRpm,
      dose:        doseNum,
      water_recipe: waterRecipe,
      water:       waterNum,
      temp:        parseFloat(temp) || 0,
      grind:       parseFloat(grind) || 0,
      bloom_time:  0,
      num_pours:   amounts.length,
      pours:       amounts,
      time:        timeNum,
      rating:      shownRating,
      taste:       { ...taste },
      notes,
      landed:      bad ? null : landed,
      bad,
    })
  }

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
                    onChange={e => { setPoursEdited(true); setPours(ps => ps.map((x, j) => j === i ? e.target.value : x)) }} />
                  {U.mU()}
                </label>
                <button type="button" className="icon-btn plain sm" aria-label="Remove pour" disabled={pours.length <= 1}
                  onClick={() => { setPoursEdited(true); setPours(ps => ps.filter((_, j) => j !== i)) }}><Ico name="x" size={ICON_XS} /></button>
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

export default function Dialin({ shots, brews, beans, gear = [], units, waterRecipes = DEFAULT_WATER_RECIPES, dialinDefaults = {}, brewModes = [], onSaveShot, onSaveBrew, onUpdateBean, preset, onPresetConsumed, start, onStartConsumed, onBack, footer }: DialinProps) {
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

  return mode === 'espresso'
    ? <EspressoDialin {...common} key="espresso" shots={shots} brewModes={brewModes} onSaveShot={onSaveShot} onUpdateBean={onUpdateBean} preset={preset?.type === 'espresso' ? preset : null} />
    : <FilterDialin {...common} key="filter" brews={brews} onSaveBrew={onSaveBrew} preset={preset?.type === 'filter' ? preset : null} />
}

