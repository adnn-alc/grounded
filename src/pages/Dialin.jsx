import { useState, useEffect, useRef } from 'react'
import Ico from '../components/Ico.jsx'
import { FlavorRadar, FlavSliders } from '../components/charts.jsx'
import { useUnits } from '../hooks/useUnits.js'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.js'
import { BeanDosesCard } from '../components/BeanDoses.jsx'
import { BREW_MODES } from '../data/brewModes.js'

const DEFAULT_TASTE = { acidity: 5, sweetness: 5, body: 5, bitterness: 5, balance: 5, aftertaste: 5 }

function dd(mode, key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem('grounded-dialin-defaults'))?.[mode]?.[key]
    return v != null ? String(v) : fallback
  } catch { return fallback }
}

const DRIPPERS           = ['V60', 'Chemex', 'Kalita Wave', 'AeroPress', 'Clever Dripper', 'Origami', 'Melitta']
const FILTER_TYPES       = ['Paper (bleached)', 'Paper (natural)', 'Metal', 'Cloth']
const ESPRESSO_MACHINES  = ['Bianca', 'Lelit Mara X', 'ECM Synchronika', 'Rocket Appartamento', 'La Marzocco Linea Mini', 'Gaggia Classic', 'Breville Barista Express']
const ESPRESSO_GRINDERS  = ['DF64 Gen 2', 'Niche Zero', 'Lagom P64', 'Fellow Ode', 'Baratza Vario', 'Comandante C40']

const activeGear = (gear, re) => gear.filter(g => re.test(g.kind) && g.status !== 'Retired')
// Keep a preset value selectable even if that gear was since retired or removed
const withCurrent = (opts, cur) => cur && !opts.includes(cur) ? [cur, ...opts] : opts

// ── Espresso mode ─────────────────────────────────────────────────────
function EspressoDialin({ shots, beans, gear = [], units, waterRecipes, onSaveShot, onUpdateBean, preset, onPresetConsumed }) {
  const U = useUnits(units)

  const machineGear   = activeGear(gear, /machine/i)
  const grinderGear   = activeGear(gear, /grinder/i)
  const basketGear    = activeGear(gear, /basket/i)
  const machineOpts   = machineGear.length ? machineGear.map(g => g.name) : ESPRESSO_MACHINES
  const grinderOpts   = grinderGear.length ? grinderGear.map(g => g.name) : ESPRESSO_GRINDERS
  const basketOpts    = basketGear.map(g => g.name)
  const primaryMachine = (machineGear.find(g => g.status === 'Primary') || machineGear[0])?.name || machineOpts[0] || ''
  const primaryGrinder = (grinderGear.find(g => g.status === 'Primary') || grinderGear[0])?.name || grinderOpts[0] || ''
  const primaryBasket  = (basketGear.find(g => g.status === 'Primary') || basketGear[0])?.name || ''

  const [shotTime,     setShotTime]     = useState('')
  const [dose,        setDose]         = useState(() => dd('espresso', 'dose', '18'))
  const [yieldG,       setYieldG]       = useState(() => dd('espresso', 'yield', '36'))
  const [grind,        setGrind]        = useState(() => dd('espresso', 'grind', '3'))
  const [temp,         setTemp]         = useState(() => dd('espresso', 'temp', '92'))
  const [preinf,       setPreinf]       = useState(() => dd('espresso', 'preinf', '0'))
  const [selectedBean, setSelectedBean] = useState(beans[0]?.name || '')
  const [machine,      setMachine]      = useState(primaryMachine)
  const [grinderModel, setGrinderModel] = useState(primaryGrinder)
  const [grinderRpm,   setGrinderRpm]   = useState(() => dd('espresso', 'grinderRpm', '800'))
  const [basket,       setBasket]       = useState(primaryBasket)
  const [brewMode,     setBrewMode]     = useState(() => shots[0]?.brew_mode || '')  // carry over from the last shot
  const [waterRecipe,  setWaterRecipe]  = useState(() => dd('espresso', 'waterRecipe', waterRecipes[0]))

  const [taste,   setTaste]   = useState({ ...DEFAULT_TASTE })
  const [notes,   setNotes]   = useState('')
  const [verdict, setVerdict] = useState('')

  const doseNum   = parseFloat(dose)   || 18
  const grindNum  = parseFloat(grind)  || 2.4
  const tempNum   = parseFloat(temp)   || 93
  const preinfNum = parseInt(preinf, 10) || 0
  const timeNum   = parseInt(shotTime, 10) || 0
  const canSave   = timeNum > 0

  const ratio = yieldG > 0 ? (parseFloat(yieldG) / doseNum).toFixed(2) : '–'

  useEffect(() => {
    if (!preset) return
    setDose(String(preset.dose ?? 18))
    setYieldG(String(preset.yield ?? 36))
    setGrind(String(preset.grind ?? 3))
    setTemp(String(preset.temp ?? 92))
    setPreinf(String(preset.preinf ?? 0))
    if (preset.bean) setSelectedBean(preset.bean)
    if (preset.machine) setMachine(preset.machine)
    if (preset.grinder_model) setGrinderModel(preset.grinder_model)
    if (preset.grinder_rpm) setGrinderRpm(String(preset.grinder_rpm))
    if (preset.water_recipe) setWaterRecipe(preset.water_recipe)
    if (preset.basket) setBasket(preset.basket)
    if (preset.brew_mode) setBrewMode(preset.brew_mode)
    onPresetConsumed?.()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const grinder = grinderGear.find(g => g.name === grinderModel)
    if (grinder?.meta && /\bmanual\b/i.test(grinder.meta)) setGrinderRpm('manual')
  }, [grinderModel])

  const saveShot = () => {
    if (!canSave) return
    const now = new Date()
    const avgRating = parseFloat((Object.values(taste).reduce((a, b) => a + b, 0) / 6).toFixed(1))
    onSaveShot({
      id:      's-' + Date.now(),
      date:    now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5),
      bean:    selectedBean,
      roaster: beans.find(b => b.name === selectedBean)?.roaster || '',
      dose: doseNum, yield: parseFloat(yieldG) || doseNum * 2.2,
      time: timeNum, preinf: preinfNum, temp: tempNum, grind: grindNum,
      machine, grinder_model: grinderModel, grinder_rpm: grinderRpm,
      basket: basket || null,
      brew_mode: brewMode || null,
      water_recipe: waterRecipe,
      rating: avgRating,
      taste:   { ...taste },
      notes,
      verdict: verdict || 'good',
    })
  }

  return (
    <div className="grid grid-2" style={{ gap: 16 }}>
      {/* LEFT COLUMN */}
      <div className="stack">
        <div className="card">
          <div className="card-head"><span className="card-title">Shot</span></div>
          <div className="dial-pad" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="dial-input">
              <label>Shot time</label>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <input autoFocus type="number" inputMode="numeric" value={shotTime} step="1" min="0" max="120" placeholder="0"
                  onChange={e => setShotTime(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveShot() }} />
                <span className="unit">s</span>
              </div>
            </div>
            <div className="dial-input">
              <label>Pre-inf</label>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <input type="number" inputMode="numeric" value={preinf} step="1" min="0" max="20"
                  onChange={e => setPreinf(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setPreinf('0')} />
                <span className="unit">s</span>
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="primary-btn" onClick={saveShot} disabled={!canSave}>
              <Ico name="check" size={13} /> Save shot
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Parameters</span></div>
          <div className="dial-pad">
            <div className="dial-input">
              <label>Dose</label>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <input type="number" value={dose} step="1" min="10" max="25"
                  onChange={e => setDose(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setDose('18')} />
                <span className="unit">{U.mU()}</span>
              </div>
            </div>
            <div className="dial-input">
              <label>Yield</label>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <input type="number" value={yieldG} step="1" min="0" max="100" placeholder="0"
                  onChange={e => setYieldG(e.target.value)} />
                <span className="unit">{U.mU()}</span>
              </div>
              <div className="hint">ratio 1:{ratio}</div>
            </div>
            <div className="dial-input">
              <label>Temp</label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <input type="number" value={temp} step="1" min="80" max="100"
                  onChange={e => setTemp(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setTemp('93')} />
                <span className="unit">{U.tU()}</span>
              </div>
            </div>
            <div className="dial-input">
              <label>Grind</label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <input type="number" value={grind} step="0.1" min="0" max="10"
                  onChange={e => setGrind(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setGrind('2.4')} />
              </div>
            </div>
            <div className="dial-input">
              <label>Water recipe</label>
              <select value={waterRecipe} onChange={e => setWaterRecipe(e.target.value)} style={{ marginTop: 4 }}>
                {waterRecipes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="dial-input">
              <label>Beans</label>
              <select value={selectedBean} onChange={e => setSelectedBean(e.target.value)} style={{ marginTop: 4 }}>
                {beans.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Gear</span></div>
          <div className="dial-pad" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="dial-input">
              <label>Machine</label>
              <select value={machine} onChange={e => setMachine(e.target.value)} style={{ marginTop: 4 }}>
                {withCurrent(machineOpts, machine).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="dial-input">
              <label>Basket</label>
              <select value={basket} onChange={e => setBasket(e.target.value)} style={{ marginTop: 4 }}>
                {!basketOpts.length && !basket && <option value="">No baskets in gear</option>}
                {withCurrent(basketOpts, basket).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="dial-input">
              <label>Grinder</label>
              <select value={grinderModel} onChange={e => setGrinderModel(e.target.value)} style={{ marginTop: 4 }}>
                {withCurrent(grinderOpts, grinderModel).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="dial-input">
              <label>Grinder RPM</label>
              <select value={grinderRpm} onChange={e => setGrinderRpm(e.target.value)} style={{ marginTop: 4 }}>
                <option value="manual">Manual</option>
                {[500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600].map(r => (
                  <option key={r} value={String(r)}>{r} RPM</option>
                ))}
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN */}
      <div className="stack">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Tasting notes</span>
            <span className="card-more">drag to adjust</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start' }}>
            <FlavSliders taste={taste} onChange={setTaste} />
            <FlavorRadar taste={taste} size={180} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Notes</span></div>
          <textarea
            placeholder="Bright, syrupy, lemon zest…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ height: 80 }}
          />
          <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
            <div className="micro">Verdict</div>
            {[['good','--good'],['under','--under'],['over','--over'],['bad','--bad']].map(([v, cv]) => (
              <button key={v}
                className={`ghost-btn${verdict === v ? ' active' : ''}`}
                style={verdict === v ? { borderColor: `var(${cv})`, color: `var(${cv})` } : {}}
                onClick={() => setVerdict(p => p === v ? '' : v)}
              >{v}</button>
            ))}
          </div>
        </div>

        <BeanDosesCard
          bean={beans.find(b => b.name === selectedBean)}
          basketOpts={basketOpts}
          currentBasket={basket}
          U={U}
          onUpdateBean={onUpdateBean}
          onApply={d => { setDose(String(d.dose)); setBasket(d.basket) }}
          onSelectBasket={setBasket}
        />

        <div className="card">
          <div className="card-head">
            <span className="card-title">Brew mode</span>
            {machine && <span className="card-more">{machine}</span>}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {BREW_MODES.map(m => (
              <button key={m}
                className={`ghost-btn${brewMode === m ? ' active' : ''}`}
                onClick={() => setBrewMode(p => p === m ? '' : m)}
              >{m}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Filter mode ───────────────────────────────────────────────────────
function FilterDialin({ beans, gear = [], units, waterRecipes, onSaveBrew, preset, onPresetConsumed }) {
  const U = useUnits(units)

  const dripperGear    = activeGear(gear, /dripper|pour.?over|v60|chemex|aeropress|kalita|clever|origami|melitta/i)
  const filterGrinders = activeGear(gear, /grinder/i)
  const dripperOpts    = dripperGear.length    ? dripperGear.map(g => g.name)    : DRIPPERS
  const grinderOpts    = filterGrinders.length ? filterGrinders.map(g => g.name) : ESPRESSO_GRINDERS
  const primaryDripper = (dripperGear.find(g => g.status === 'Primary') || dripperGear[0])?.name || dripperOpts[0] || 'V60'
  const primaryGrinder = (filterGrinders.find(g => g.status === 'Primary') || filterGrinders[0])?.name || grinderOpts[0] || ''

  const [elapsed,    setElapsed]    = useState(0)
  const [running,    setRunning]    = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualM,    setManualM]    = useState('0')
  const [manualS,    setManualS]    = useState('0')
  const intervalRef = useRef(null)

  const [dose,         setDose]         = useState(() => dd('filter', 'dose', '15'))
  const [waterTarget,  setWaterTarget]  = useState(() => dd('filter', 'water', '250'))
  const [temp,         setTemp]         = useState(() => dd('filter', 'temp', '92'))
  const [grind,        setGrind]        = useState(() => dd('filter', 'grind', '10'))
  const numPoursNum    = parseInt(dd('filter', 'numPours', '3')) || 3
  const [waterRecipe,  setWaterRecipe]  = useState(() => dd('filter', 'waterRecipe', waterRecipes[0]))
  const [dripper,      setDripper]      = useState(primaryDripper)
  const [grinderModel, setGrinderModel] = useState(primaryGrinder)
  const [grinderRpm,   setGrinderRpm]   = useState(() => dd('filter', 'grinderRpm', '800'))
  const [selectedBean, setSelectedBean] = useState(beans[0]?.name || '')

  const doseNum        = parseFloat(dose)        || 15
  const waterTargetNum = parseFloat(waterTarget) || 250
  const tempNum        = parseFloat(temp)        || 92
  const grindNum       = parseFloat(grind)       || 18

  const initPours = () => Array.from({ length: numPoursNum }, (_, i) => i === 0 ? 50 : 100)
  const [pours, setPours] = useState(() => initPours())

  const totalPoured = pours.reduce((a, b) => a + (parseFloat(b) || 0), 0)
  const ratio = waterTargetNum > 0 && doseNum > 0 ? (waterTargetNum / doseNum).toFixed(1) : '–'

  const updatePour = (i, val) => setPours(prev => {
    const next = [...prev]
    next[i] = val
    return next
  })

  const addPour = () => {
    if (pours.length >= 8) return
    const remaining = Math.max(0, waterTargetNum - totalPoured)
    setPours(p => [...p, Math.round(remaining / 2) || 50])
  }

  const removePour = () => {
    if (pours.length <= 1) return
    setPours(p => p.slice(0, -1))
  }

  const start = () => {
    if (running) {
      clearInterval(intervalRef.current)
      setRunning(false)
      return
    }
    setRunning(true)
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  const reset = () => {
    clearInterval(intervalRef.current)
    setRunning(false); setElapsed(0)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  useEffect(() => {
    if (!preset) return
    setDose(String(preset.dose ?? 15))
    setWaterTarget(String(preset.water ?? 250))
    setTemp(String(preset.temp ?? 92))
    setGrind(String(preset.grind ?? 10))
    if (preset.bean) setSelectedBean(preset.bean)
    if (preset.dripper) setDripper(preset.dripper)
    if (preset.grinder_model) setGrinderModel(preset.grinder_model)
    if (preset.grinder_rpm) setGrinderRpm(String(preset.grinder_rpm))
    if (preset.water_recipe) setWaterRecipe(preset.water_recipe)
    if (preset.pours?.length) setPours(preset.pours.map(p => typeof p === 'object' ? (p.water ?? p) : p))
    onPresetConsumed?.()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const grinder = filterGrinders.find(g => g.name === grinderModel)
    if (grinder?.meta && /\bmanual\b/i.test(grinder.meta)) setGrinderRpm('manual')
  }, [grinderModel])

  const [taste,   setTaste]   = useState({ ...DEFAULT_TASTE })
  const [notes,   setNotes]   = useState('')
  const [verdict, setVerdict] = useState('')

  const saveBrew = () => {
    const now = new Date()
    const avgRating = parseFloat((Object.values(taste).reduce((a, b) => a + b, 0) / 6).toFixed(1))
    onSaveBrew({
      id:          'brew-' + Date.now(),
      date:        now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 5),
      bean:        selectedBean,
      roaster:     beans.find(b => b.name === selectedBean)?.roaster || '',
      dripper,
      grinder_model: grinderModel,
      grinder_rpm:   grinderRpm,
      dose:        doseNum,
      water_recipe: waterRecipe,
      water:       waterTargetNum,
      temp:        tempNum,
      grind:       grindNum,
      bloom_time:  0,
      num_pours:   pours.length,
      pours:       pours.map(p => parseFloat(p) || 0),
      time:        elapsed,
      rating:      avgRating,
      taste:       { ...taste },
      notes,
      verdict:     verdict || 'good',
    })
    reset()
    setTaste({ ...DEFAULT_TASTE })
    setNotes('')
    setVerdict([])
  }

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const secs = String(elapsed % 60).padStart(2, '0')
  const timerColor = running ? 'var(--crema)' : elapsed > 0 ? 'var(--good)' : 'var(--text)'

  return (
    <div className="grid grid-2" style={{ gap: 16 }}>
      {/* LEFT COLUMN */}
      <div className="stack">
        {/* Timer */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Timer</span>
            {running && <span className="card-more" style={{ color: 'var(--good)' }}>● live</span>}
          </div>
          {manualMode ? (
            <>
              <div className="shot-timer" style={{ color: 'var(--crema)', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <input autoFocus type="number" value={manualM} min="0" max="9" step="1"
                  onChange={e => setManualM(e.target.value)}
                  style={{ width: '2ch', background: 'none', border: 'none', borderBottom: '2px solid var(--crema)', outline: 'none', font: 'inherit', color: 'inherit', padding: '0 2px', textAlign: 'center' }}
                />
                <span>:</span>
                <select value={manualS} onChange={e => setManualS(e.target.value)}
                  style={{ background: 'none', border: 'none', borderBottom: '2px solid var(--crema)', outline: 'none', font: 'inherit', color: 'inherit', padding: '0 2px', textAlign: 'center', appearance: 'none', cursor: 'pointer' }}
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map(s => (
                    <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
              <div className="row" style={{ marginTop: 16, gap: 10 }}>
                <button className="primary-btn" style={{ background: 'var(--good)', borderColor: 'var(--good)' }} onClick={() => {
                  const total = (parseInt(manualM) || 0) * 60 + Math.min(59, parseInt(manualS) || 0)
                  setElapsed(total)
                  setManualMode(false)
                }}>
                  <Ico name="check" size={13} /> Confirm
                </button>
                <button className="ghost-btn" onClick={() => setManualMode(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="shot-timer" style={{ color: timerColor }}>{mins}:{secs}</div>
              <div className="row" style={{ marginTop: 16, gap: 10 }}>
                <button className="primary-btn" onClick={start}>
                  <Ico name={running ? 'pause' : 'play'} size={13} />
                  {running ? 'Pause' : 'Start'}
                </button>
                <button className="ghost-btn" onClick={reset}>
                  <Ico name="stop" size={13} /> Reset
                </button>
                {!running && (
                  <button className="ghost-btn" onClick={() => {
                    setManualM(String(Math.floor(elapsed / 60)))
                    setManualS(String(elapsed % 60))
                    setManualMode(true)
                  }}>
                    <Ico name="pencil" size={13} /> Manual
                  </button>
                )}
                {elapsed > 0 && !running && (
                  <button className="ghost-btn" style={{ color: 'var(--good)', borderColor: 'var(--good)' }} onClick={saveBrew}>
                    <Ico name="check" size={13} /> Save brew
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Parameters */}
        <div className="card">
          <div className="card-head"><span className="card-title">Parameters</span></div>
          <div className="dial-pad">
            <div className="dial-input">
              <label>Dose</label>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <input type="number" value={dose} step="1" min="5" max="50"
                  onChange={e => setDose(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setDose('20')} />
                <span className="unit">{U.mU()}</span>
              </div>
            </div>
            <div className="dial-input">
              <label>Water</label>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <input type="number" value={waterTarget} step="5" min="50" max="1500"
                  onChange={e => setWaterTarget(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setWaterTarget('300')} />
                <span className="unit">{U.mU()}</span>
              </div>
              <div className="hint">ratio 1:{ratio}</div>
            </div>
            <div className="dial-input">
              <label>Temp</label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <input type="number" value={temp} step="1" min="70" max="100"
                  onChange={e => setTemp(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setTemp('92')} />
                <span className="unit">{U.tU()}</span>
              </div>
            </div>
            <div className="dial-input">
              <label>Grind</label>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <input type="number" value={grind} step="0.1" min="0" max="50"
                  onChange={e => setGrind(e.target.value)}
                  onBlur={e => !e.target.value.trim() && setGrind('8.0')} />
              </div>
            </div>
            <div className="dial-input">
              <label>Water recipe</label>
              <select value={waterRecipe} onChange={e => setWaterRecipe(e.target.value)} style={{ marginTop: 4 }}>
                {waterRecipes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="dial-input">
              <label>Beans</label>
              <select value={selectedBean} onChange={e => setSelectedBean(e.target.value)} style={{ marginTop: 4 }}>
                {beans.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Gear</span></div>
          <div className="dial-pad">
            <div className="dial-input">
              <label>Dripper</label>
              <select value={dripper} onChange={e => setDripper(e.target.value)} style={{ marginTop: 4 }}>
                {withCurrent(dripperOpts, dripper).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="dial-input">
              <label>Grinder</label>
              <select value={grinderModel} onChange={e => setGrinderModel(e.target.value)} style={{ marginTop: 4 }}>
                {withCurrent(grinderOpts, grinderModel).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="dial-input">
              <label>Grinder RPM</label>
              <select value={grinderRpm} onChange={e => setGrinderRpm(e.target.value)} style={{ marginTop: 4 }}>
                <option value="manual">Manual</option>
                {[500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600].map(r => (
                  <option key={r} value={String(r)}>{r} RPM</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="stack">
        {/* Pours + Water target */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Pours</span>
            <span className="card-more" style={{ color: totalPoured > waterTargetNum ? 'var(--bitter)' : undefined }}>
              {U.m(totalPoured)}{U.mU()} / {U.m(waterTargetNum)}{U.mU()}
            </span>
            <div className="row" style={{ marginLeft: 8, gap: 2 }}>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={removePour} disabled={pours.length <= 1}>–</button>
              <span className="mono" style={{ fontSize: 12, width: 22, textAlign: 'center' }}>{pours.length}</span>
              <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={addPour} disabled={pours.length >= 8}>+</button>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 6, height: 6, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, waterTargetNum > 0 ? (totalPoured / waterTargetNum) * 100 : 0)}%`,
              background: totalPoured > waterTargetNum ? 'var(--bitter)' : 'var(--crema)',
              borderRadius: 6,
              transition: 'width 0.2s',
            }} />
          </div>

          <div className="stack" style={{ gap: 6 }}>
            {pours.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', width: 52, letterSpacing: '0.08em' }}>
                  {i === 0 ? 'Bloom' : `Pour ${i + 1}`}
                </div>
                <input type="number" value={p} step="5" min="0" max="500"
                  onChange={e => updatePour(i, e.target.value)}
                  style={{ width: 70 }} />
                <span className="unit">{U.mU()}</span>
                <div style={{ flex: 1, height: 4, background: 'var(--surface)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${Math.min(100, waterTargetNum > 0 ? ((parseFloat(p) || 0) / waterTargetNum) * 100 : 0)}%`,
                    background: i === 0 ? 'var(--sour)' : 'var(--crema)',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {totalPoured !== waterTargetNum && waterTargetNum > 0 && (
            <div style={{ marginTop: 10, fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: 'var(--text-4)' }}>
              {totalPoured > waterTargetNum
                ? `Over target by ${(totalPoured - waterTargetNum).toFixed(0)}${U.mU()}`
                : `${(waterTargetNum - totalPoured).toFixed(0)}${U.mU()} remaining to target`
              }
            </div>
          )}
        </div>

        {/* Tasting */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Tasting notes</span>
            <span className="card-more">drag to adjust</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start' }}>
            <FlavSliders taste={taste} onChange={setTaste} />
            <FlavorRadar taste={taste} size={180} />
          </div>
        </div>

        {/* Notes + verdict */}
        <div className="card">
          <div className="card-head"><span className="card-title">Notes</span></div>
          <textarea
            placeholder="Clean, floral, stone fruit…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ height: 80 }}
          />
          <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
            <div className="micro">Verdict</div>
            {[['good','--good'],['under','--under'],['over','--over'],['bad','--bad']].map(([v, cv]) => (
              <button key={v}
                className={`ghost-btn${verdict === v ? ' active' : ''}`}
                style={verdict === v ? { borderColor: `var(${cv})`, color: `var(${cv})` } : {}}
                onClick={() => setVerdict(p => p === v ? '' : v)}
              >{v}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Outer shell with mode tabs ────────────────────────────────────────
export default function Dialin({ shots, beans, gear = [], units, waterRecipes = DEFAULT_WATER_RECIPES, onSaveShot, onSaveBrew, onUpdateBean, preset, onPresetConsumed }) {
  const [mode, setMode] = useState(preset?.type === 'filter' ? 'filter' : 'espresso')

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Dial-in.</h1>
        <div className="row" style={{ gap: 4, marginLeft: 'auto' }}>
          {['espresso', 'filter'].map(m => (
            <button key={m}
              className={`ghost-btn${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}
              style={{ textTransform: 'capitalize', fontSize: 12 }}
            >{m}</button>
          ))}
        </div>
      </div>

      {mode === 'espresso'
        ? <EspressoDialin shots={shots} beans={beans} gear={gear} units={units} waterRecipes={waterRecipes} onSaveShot={onSaveShot} onUpdateBean={onUpdateBean} preset={preset?.type === 'espresso' ? preset : null} onPresetConsumed={onPresetConsumed} />
        : <FilterDialin   beans={beans} gear={gear} units={units} waterRecipes={waterRecipes} onSaveBrew={onSaveBrew} preset={preset?.type === 'filter' ? preset : null} onPresetConsumed={onPresetConsumed} />
      }
    </div>
  )
}
