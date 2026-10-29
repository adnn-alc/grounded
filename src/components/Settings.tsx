import { useState, useEffect } from 'react'
import Ico from './Ico.tsx'
import { FONT_ROLES, FONT_OPTIONS, fontStack } from '../data/fonts.ts'
import { RPM_OPTIONS } from '../data/grinderRpm.ts'
import type { DialinDefaults, EspressoDefaults, FilterDefaults, FontRole, Fonts, Units } from '../types.ts'

const FONT_SAMPLES: Record<FontRole, string> = { sans: 'Bright, sweet, clean finish', mono: '18.0g → 36.4g · 28s', serif: 'Dial-in' }

const THEMES = [
  { id: 'moody',     name: 'Moody',     tag: 'espresso bar', bg: '#2a2420', sb: '#1f1a17', accent: '#d1a16a', txt: '#efe6d9', card: '#332a24' },
  { id: 'midnight',  name: 'Midnight',  tag: 'cool inky',    bg: '#1a2035', sb: '#141a2b', accent: '#e3b366', txt: '#e8eaf5', card: '#252b45' },
  { id: 'terminal',  name: 'Terminal',  tag: 'self-hosted',  bg: '#0c1612', sb: '#0a120f', accent: '#6ee88a', txt: '#b8e0c2', card: '#13201a' },
  { id: 'parchment', name: 'Parchment', tag: 'editorial',    bg: '#efe7d4', sb: '#e5dcc6', accent: '#9a5a2c', txt: '#2e2518', card: '#f7f1e0' },
]

const ESP_FALLBACK: EspressoDefaults = { dose: '18', yield: '36', temp: '92', grind: '3', preinf: '0', waterRecipe: 'Light and Bright', grinderRpm: '800' }
const FIL_FALLBACK: FilterDefaults = { dose: '15', water: '250', temp: '92', grind: '10', numPours: '3', waterRecipe: 'Light and Bright', grinderRpm: '800' }

interface SettingsProps {
  open:              boolean
  onClose:           () => void
  theme:             string
  setTheme:          (theme: string) => void
  fonts:             Fonts
  setFonts:          (fonts: Fonts) => void
  units:             Units
  setUnits:          (units: Units) => void
  waterRecipes:      string[]
  setWaterRecipes:   (recipes: string[]) => void
  dialinDefaults:    DialinDefaults
  setDialinDefaults: (defaults: DialinDefaults) => void
  brewModes:         string[]
  setBrewModes:      (modes: string[]) => void
}

export default function Settings({ open, onClose, theme, setTheme, fonts, setFonts, units, setUnits, waterRecipes, setWaterRecipes, dialinDefaults, setDialinDefaults, brewModes, setBrewModes }: SettingsProps) {
  const [tab, setTab]   = useState('preferences')
  const [defs, setDefs] = useState(dialinDefaults)
  const [newRecipe, setNewRecipe] = useState('')
  const [newMode, setNewMode] = useState('')

  // Typing in the number fields saves after a short pause, not on every keystroke
  useEffect(() => {
    if (defs === dialinDefaults) return
    const t = setTimeout(() => setDialinDefaults(defs), 500)
    return () => clearTimeout(t)
  }, [defs]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateDef = (mode: 'espresso' | 'filter', key: keyof EspressoDefaults | keyof FilterDefaults, val: string) => setDefs(prev => ({ ...prev, [mode]: { ...prev[mode], [key]: val } }))

  const addWaterRecipe = () => {
    const name = newRecipe.trim()
    if (!name || waterRecipes.includes(name)) return
    setWaterRecipes([...waterRecipes, name])
    setNewRecipe('')
  }

  const removeWaterRecipe = (name: string) => {
    if (waterRecipes.length <= 1) return
    setWaterRecipes(waterRecipes.filter(r => r !== name))
  }

  // Brew modes are optional: with none, Dial-in doesn't show the field at all
  const addBrewMode = () => {
    const name = newMode.trim()
    if (!name || brewModes.includes(name)) return
    setBrewModes([...brewModes, name])
    setNewMode('')
  }

  if (!open) return null

  const esp = { ...ESP_FALLBACK, ...defs.espresso }
  const fil = { ...FIL_FALLBACK, ...defs.filter }
  const mU  = units.mass === 'oz' ? 'oz' : 'g'
  const tU  = units.temp === 'F'  ? '°F' : '°C'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <Ico name="sliders" size={18} />
          <h2>Settings</h2>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
            <Ico name="x" size={14} />
          </button>
        </div>

        <div className="row" style={{ gap: 4, padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          {[['preferences', 'Preferences'], ['defaults', 'Dial-in defaults']].map(([t, label]) => (
            <button key={t}
              className={`ghost-btn${tab === t ? ' active' : ''}`}
              style={{ fontSize: 12, borderRadius: 0, borderBottom: tab === t ? '2px solid var(--crema)' : '2px solid transparent', marginBottom: -1 }}
              onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>

        <div className="modal-body scroll">
          {tab === 'preferences' ? (
            <>
              <div className="settings-section">
                <h3>Appearance · Theme</h3>
                <div className="theme-grid">
                  {THEMES.map(t => (
                    <button key={t.id}
                      className={`theme-card${theme === t.id ? ' on' : ''}`}
                      onClick={() => setTheme(t.id)}>
                      <div className="on-mark"><Ico name="check" size={10} /></div>
                      <div className="theme-preview">
                        <div className="sb" style={{ background: t.sb }}>
                          <div className="ln" style={{ background: t.accent, width: '70%' }} />
                          <div className="ln" style={{ background: t.txt, width: '50%', opacity: 0.4 }} />
                          <div className="ln" style={{ background: t.txt, width: '80%', opacity: 0.3 }} />
                          <div className="ln" style={{ background: t.txt, width: '60%', opacity: 0.3 }} />
                        </div>
                        <div className="mn" style={{ background: t.bg }}>
                          <div className="ttl" style={{ background: t.txt, opacity: 0.8 }} />
                          <div className="crd" style={{ background: t.card, border: `1px solid ${t.accent}33` }} />
                        </div>
                      </div>
                      <div className="meta">
                        <span className="name">{t.name}</span>
                        <span className="tag">{t.tag}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <h3>Appearance · Fonts</h3>
                {FONT_ROLES.map(({ role, label, desc }) => (
                  <div key={role} className="settings-row">
                    <div>
                      <div className="label">{label}</div>
                      <div className="desc">{desc}</div>
                      <div className={`font-sample${role === 'serif' ? ' serif' : ''}`} style={{ fontFamily: fontStack(role, fonts[role]) }}>
                        {FONT_SAMPLES[role]}
                      </div>
                    </div>
                    <select className="font-select" value={fonts[role]} onChange={e => setFonts({ ...fonts, [role]: e.target.value })}>
                      {FONT_OPTIONS[role].map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="settings-section">
                <h3>Units</h3>
                <div className="settings-row">
                  <div>
                    <div className="label">Mass</div>
                    <div className="desc">Used for dose, yield, stock, and all weights.</div>
                  </div>
                  <div className="unit-toggle">
                    <button className={units.mass === 'g'  ? 'on' : ''} onClick={() => setUnits({ ...units, mass: 'g' })}>grams</button>
                    <button className={units.mass === 'oz' ? 'on' : ''} onClick={() => setUnits({ ...units, mass: 'oz' })}>ounces</button>
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="label">Temperature</div>
                    <div className="desc">Group-head, kettle, and brew temp displays.</div>
                  </div>
                  <div className="unit-toggle">
                    <button className={units.temp === 'C' ? 'on' : ''} onClick={() => setUnits({ ...units, temp: 'C' })}>Celsius</button>
                    <button className={units.temp === 'F' ? 'on' : ''} onClick={() => setUnits({ ...units, temp: 'F' })}>Fahrenheit</button>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>About</h3>
                <div className="settings-row">
                  <div>
                    <div className="label">Grounded</div>
                    <div className="desc">Self-hosted coffee tracker · v{__APP_VERSION__}</div>
                  </div>
                  <div className="mono text-dim" style={{ fontSize: 11 }}>localhost</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="settings-section">
                <h3>Water recipes</h3>
                <div className="desc" style={{ marginBottom: 10 }}>Manage the water recipe options offered when dialing in.</div>
                <div className="stack" style={{ gap: 6, marginBottom: 10 }}>
                  {waterRecipes.map(r => (
                    <div key={r} className="settings-row" style={{ padding: '6px 0' }}>
                      <div className="label">{r}</div>
                      <button className="icon-btn" onClick={() => removeWaterRecipe(r)} disabled={waterRecipes.length <= 1}>
                        <Ico name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input type="text" placeholder="Add water recipe…" value={newRecipe}
                    onChange={e => setNewRecipe(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWaterRecipe() } }} />
                  <button className="ghost-btn" onClick={addWaterRecipe}>Add</button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Brew modes · optional</h3>
                <div className="desc" style={{ marginBottom: 10 }}>
                  Buttons or programs on your espresso machine (e.g. "Button 1", "Paddle") to pick from when dialing in. Leave empty to hide the field.
                </div>
                {brewModes.length > 0 && (
                  <div className="stack" style={{ gap: 6, marginBottom: 10 }}>
                    {brewModes.map(m => (
                      <div key={m} className="settings-row" style={{ padding: '6px 0' }}>
                        <div className="label">{m}</div>
                        <button className="icon-btn" aria-label={`Remove ${m}`} onClick={() => setBrewModes(brewModes.filter(x => x !== m))}>
                          <Ico name="x" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="row" style={{ gap: 8 }}>
                  <input type="text" placeholder="Add brew mode…" value={newMode}
                    onChange={e => setNewMode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBrewMode() } }} />
                  <button className="ghost-btn" onClick={addBrewMode}>Add</button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Espresso</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="dial-input">
                    <label>Dose ({mU})</label>
                    <input type="number" step="0.1" min="10" max="25" value={esp.dose}
                      onChange={e => updateDef('espresso', 'dose', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Yield ({mU})</label>
                    <input type="number" step="0.1" min="0" max="100" value={esp.yield}
                      onChange={e => updateDef('espresso', 'yield', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Temp ({tU})</label>
                    <input type="number" step="1" min="80" max="105" value={esp.temp}
                      onChange={e => updateDef('espresso', 'temp', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Grind</label>
                    <input type="number" step="0.1" min="0" max="10" value={esp.grind}
                      onChange={e => updateDef('espresso', 'grind', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Pre-infusion (s)</label>
                    <input type="number" step="1" min="0" max="20" value={esp.preinf}
                      onChange={e => updateDef('espresso', 'preinf', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Grinder RPM</label>
                    <select value={esp.grinderRpm} onChange={e => updateDef('espresso', 'grinderRpm', e.target.value)}>
                      {RPM_OPTIONS.map(r => <option key={r} value={r}>{r === 'manual' ? 'Manual' : `${r} RPM`}</option>)}
                    </select>
                  </div>
                  <div className="dial-input" style={{ gridColumn: '1 / -1' }}>
                    <label>Water recipe</label>
                    <select value={esp.waterRecipe} onChange={e => updateDef('espresso', 'waterRecipe', e.target.value)}>
                      {waterRecipes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Filter</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="dial-input">
                    <label>Dose ({mU})</label>
                    <input type="number" step="0.1" min="5" max="50" value={fil.dose}
                      onChange={e => updateDef('filter', 'dose', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Water ({mU})</label>
                    <input type="number" step="5" min="50" max="1500" value={fil.water}
                      onChange={e => updateDef('filter', 'water', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Temp ({tU})</label>
                    <input type="number" step="1" min="70" max="105" value={fil.temp}
                      onChange={e => updateDef('filter', 'temp', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Grind</label>
                    <input type="number" step="0.1" min="0" max="50" value={fil.grind}
                      onChange={e => updateDef('filter', 'grind', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Number of pours</label>
                    <input type="number" step="1" min="1" max="8" value={fil.numPours}
                      onChange={e => updateDef('filter', 'numPours', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Grinder RPM</label>
                    <select value={fil.grinderRpm} onChange={e => updateDef('filter', 'grinderRpm', e.target.value)}>
                      {RPM_OPTIONS.map(r => <option key={r} value={r}>{r === 'manual' ? 'Manual' : `${r} RPM`}</option>)}
                    </select>
                  </div>
                  <div className="dial-input" style={{ gridColumn: '1 / -1' }}>
                    <label>Water recipe</label>
                    <select value={fil.waterRecipe} onChange={e => updateDef('filter', 'waterRecipe', e.target.value)}>
                      {waterRecipes.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
