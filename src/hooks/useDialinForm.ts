// The Dial-in form state, shared by both designs: Refined's cards (Dialin.tsx) and Extraction's
// columns (ExtractionDialin.tsx) render the same fields and save the same shot or brew.
import { useEffect, useState } from 'react'
import { activeGear, BASKET_KIND, DRIPPER_KIND, GRINDER_KIND, MACHINE_KIND } from '../data/gear.ts'
import { parseMmss, tasteAverage } from '../data/taste.ts'
import type { Bean, Brew, BrewInput, DialinDefaults, Gear, Shot, ShotInput, Taste } from '../types.ts'

const MID = 5   // middle of the 1–10 taste scale
export const DEFAULT_TASTE: Taste = { acidity: MID, sweetness: MID, body: MID, bitterness: MID, balance: MID, aftertaste: MID }

export const MAX_POURS      = 8
const BLOOM_PER_GRAM        = 3     // a first guess at the bloom: 3 g of water per gram of coffee
export const ROUND_POUR_TO  = 5
const DEFAULT_POURS         = 3
const RECENT_COUNT          = 5     // the last few shots/brews on a bag, marked on the time dial

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
const primaryOf = (list: Gear[], fallback: string) => (list.find(g => g.status === 'Primary') || list[0])?.name || fallback

// Bean of a preset (a past shot/brew loaded via Re-pull): by id, or by name for very old entries
function presetBeanId(beans: Bean[], ref: { bean_id: string | null, bean: string }): string | undefined {
  if (ref.bean_id && beans.some(b => b.id === ref.bean_id)) return ref.bean_id
  return beans.find(b => b.name === ref.bean)?.id
}

const firstBean = (beans: Bean[], startBeanId?: string) => (startBeanId && beans.some(b => b.id === startBeanId) ? startBeanId : beans[0]?.id) || ''

const nowStamp = () => {
  const now = new Date()
  return now.toISOString().slice(0, 'YYYY-MM-DD'.length) + ' ' + now.toTimeString().slice(0, 'HH:MM'.length)
}

// Bag notes ("Did you taste these?") are added to the notes as comma-separated words, and removed again
const noteParts = (notes: string): string[] => notes.split(',').map(p => p.trim()).filter(Boolean)
const sameNote = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
export const hasNote = (notes: string, note: string): boolean => noteParts(notes).some(p => sameNote(p, note))
export const toggleNote = (notes: string, note: string): string => {
  const parts = noteParts(notes)
  return (hasNote(notes, note) ? parts.filter(p => !sameNote(p, note)) : [...parts, note]).join(', ')
}

/** Taste, where it landed, notes and the rating: the same for shots and brews */
function useTasting() {
  const [taste,  setTaste]  = useState<Taste>({ ...DEFAULT_TASTE })
  const [landed, setLanded] = useState<number | null>(null)
  const [bad,    setBad]    = useState(false)
  const [notes,  setNotes]  = useState('')
  const [rating, setRating] = useState<number | null>(null)   // null: follows the taste average
  const shownRating = rating ?? tasteAverage(taste)
  return { taste, setTaste, landed, setLanded, bad, setBad, notes, setNotes, setRating, shownRating }
}

// ── Espresso ──────────────────────────────────────────────────────────
interface ShotFormArgs {
  shots:          Shot[]
  beans:          Bean[]
  gear:           Gear[]
  waterRecipes:   string[]
  dialinDefaults: DialinDefaults
  brewModes:      string[]
  preset:         Shot | null
  startBeanId?:   string
  onSaveShot:     (shot: ShotInput) => void
}

export function useShotForm({ shots, beans, gear, waterRecipes, dialinDefaults, brewModes, preset, startBeanId, onSaveShot }: ShotFormArgs) {
  const machineGear    = activeGear(gear, MACHINE_KIND)
  const grinderGear    = activeGear(gear, GRINDER_KIND)
  const basketGear     = activeGear(gear, BASKET_KIND)
  const machineOpts    = machineGear.length ? machineGear.map(g => g.name) : ESPRESSO_MACHINES
  const grinderOpts    = grinderGear.length ? grinderGear.map(g => g.name) : ESPRESSO_GRINDERS
  const basketOpts     = basketGear.map(g => g.name)

  const [selectedBean, setSelectedBean] = useState(() => firstBean(beans, startBeanId))
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
  const tasting = useTasting()
  const { taste, landed, bad, notes, shownRating } = tasting

  const bean      = beans.find(b => b.id === selectedBean)
  const onBag     = shots.filter(s => s.bean_id === selectedBean)
  const lastShot  = onBag[0]
  const recentTimes = onBag.slice(0, RECENT_COUNT).map(s => s.time).filter(t => t > 0)
  const doseNum   = parseFloat(dose) || 0
  const yieldNum  = parseFloat(yieldG) || 0
  const timeNum   = parseMmss(shotTime) ?? 0
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

  return {
    ...tasting,
    machineOpts, grinderOpts, basketOpts,
    selectedBean, setSelectedBean, bean, lastShot, recentTimes,
    shotTime, setShotTime, dose, setDose, yieldG, setYieldG, grind, setGrind, temp, setTemp, preinf, setPreinf,
    machine, setMachine, grinderModel, pickGrinder, grinderRpm, setGrinderRpm, basket, setBasket,
    waterRecipe, setWaterRecipe, brewMode, setBrewMode,
    doseNum, yieldNum, timeNum, canSave, loadShot, saveShot,
  }
}

// ── Filter ────────────────────────────────────────────────────────────
// Pours are entered as scale totals ("to 150 g") and stored as the amount of each pour.
const toTotals = (amounts: number[]): number[] => amounts.reduce<number[]>((acc, a) => [...acc, (acc[acc.length - 1] ?? 0) + a], [])
export const toAmounts = (totals: number[]): number[] => totals.map((t, i) => Math.max(0, t - (i ? totals[i - 1]! : 0)))
const roundPour = (g: number) => Math.round(g / ROUND_POUR_TO) * ROUND_POUR_TO

/** Bloom of about 3× the dose, then even pours up to the water target */
function plannedTotals(count: number, dose: number, water: number): string[] {
  const bloom = Math.min(water, roundPour(dose * BLOOM_PER_GRAM))
  if (count <= 1) return [String(water)]
  return Array.from({ length: count }, (_, i) => String(i === 0 ? bloom : roundPour(bloom + ((water - bloom) * i) / (count - 1))))
}

interface BrewFormArgs {
  brews:          Brew[]
  beans:          Bean[]
  gear:           Gear[]
  waterRecipes:   string[]
  dialinDefaults: DialinDefaults
  preset:         Brew | null
  startBeanId?:   string
  onSaveBrew:     (brew: BrewInput) => void
}

export function useBrewForm({ brews, beans, gear, waterRecipes, dialinDefaults, preset, startBeanId, onSaveBrew }: BrewFormArgs) {
  const dripperGear    = activeGear(gear, DRIPPER_KIND)
  const filterGrinders = activeGear(gear, GRINDER_KIND)
  const dripperOpts    = dripperGear.length    ? dripperGear.map(g => g.name)    : DRIPPERS
  const grinderOpts    = filterGrinders.length ? filterGrinders.map(g => g.name) : ESPRESSO_GRINDERS

  const [selectedBean, setSelectedBean] = useState(() => firstBean(beans, startBeanId))
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
  const tasting = useTasting()
  const { taste, landed, bad, notes, shownRating } = tasting

  const bean     = beans.find(b => b.id === selectedBean)
  const onBag    = brews.filter(b => b.bean_id === selectedBean)
  const lastBrew = onBag[0]
  const recentTimes = onBag.slice(0, RECENT_COUNT).map(b => b.time).filter(t => t > 0)
  const doseNum  = parseFloat(dose) || 0
  const waterNum = parseFloat(water) || 0
  const timeNum  = parseMmss(totalTime) ?? 0
  const totals   = pours.map(p => parseFloat(p) || 0)
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
  const setPour = (i: number, value: string) => { setPoursEdited(true); setPours(ps => ps.map((x, j) => j === i ? value : x)) }
  const removePour = (i: number) => { setPoursEdited(true); setPours(ps => ps.filter((_, j) => j !== i)) }

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

  return {
    ...tasting,
    dripperOpts, grinderOpts,
    selectedBean, setSelectedBean, bean, lastBrew, recentTimes,
    dose, setDose, water, setWater, temp, setTemp, grind, setGrind,
    waterRecipe, setWaterRecipe, dripper, setDripper, grinderModel, pickGrinder, grinderRpm, setGrinderRpm,
    totalTime, setTotalTime, pours, totals, setPourCount, setPour, removePour,
    doseNum, waterNum, timeNum, canSave, loadBrew, saveBrew,
  }
}
