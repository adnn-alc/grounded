import { useState, useEffect } from 'react'
import { Backdrop } from './ui.tsx'
import Ico, { type IconName } from './Ico.tsx'
import DataSettings from './DataSettings.tsx'
import type { DataSettingsProps } from './DataSettings.tsx'
import { DESIGNS, EXTRACTION_FONT_IDS, FONT_ROLES, FONT_OPTIONS, fontStack, lookFrom } from '../data/fonts.ts'
import { RPM_OPTIONS } from '../data/grinderRpm.ts'
import type { Design, DialinDefaults, EspressoDefaults, ExtractionLook, FilterDefaults, Fonts, Units } from '../types.ts'

interface ThemeSwatch { id: string; name: string; tag: string; bg: string; sb: string; card: string; accent: string; txt: string }

export const THEMES: ThemeSwatch[] = [
  { id: 'moody',     name: 'Moody',     tag: 'dark brown',     bg: '#15110e', sb: '#1c1612', card: '#231d19', accent: '#e8b46a', txt: '#f4ede3' },
  { id: 'midnight',  name: 'Midnight',  tag: 'dark blue',      bg: '#10141f', sb: '#141a28', card: '#1b2233', accent: '#e8b866', txt: '#eef0f8' },
  { id: 'terminal',  name: 'Terminal',  tag: 'green on black', bg: '#08110d', sb: '#0c1712', card: '#12201a', accent: '#7be38f', txt: '#b8f0c8' },
  { id: 'parchment', name: 'Parchment', tag: 'warm light',     bg: '#f3ead8', sb: '#e9dfca', card: '#fbf6ea', accent: '#9a5a2c', txt: '#2e2518' },
  { id: 'oat',       name: 'Oat',       tag: 'gray light',     bg: '#e9e6e0', sb: '#dedad2', card: '#f6f4f0', accent: '#8a5a2b', txt: '#2a2622' },
  { id: 'ember',     name: 'Ember',     tag: 'oxblood',        bg: '#1d0f0e', sb: '#251412', card: '#2e1a17', accent: '#e0a35a', txt: '#f6e7df' },
]

// Extraction's themes, previewed as a little Home: the last shot in big numbers
interface XSwatch { id: string; name: string; tag: string; bg: string; card: string; txt: string; muted: string; crema: string; cherry: string; arrow: string }

const XTHEMES: XSwatch[] = [
  { id: 'roast', name: 'Roast', tag: 'Oxblood, crema and cherry', bg: '#1c100e', card: '#2e1a16', txt: '#fbefe6', muted: '#a88f81', crema: '#f2b35a', cherry: '#e2483d', arrow: '#6d4a3f' },
  { id: 'mocha', name: 'Mocha', tag: 'Cocoa brown, softer dark',  bg: '#2e211b', card: '#493730', txt: '#fbf2ea', muted: '#c1ab9c', crema: '#f4bc68', cherry: '#ef5e50', arrow: '#7f5d4e' },
  { id: 'latte', name: 'Latte', tag: 'Milky beige, softer light', bg: '#d8cbbb', card: '#cab9a7', txt: '#2c2019', muted: '#725d4e', crema: '#985b16', cherry: '#ae352b', arrow: '#a08a75' },
  { id: 'crema', name: 'Crema', tag: 'Warm light, same accents',  bg: '#f6ece0', card: '#ead9c6', txt: '#2a160f', muted: '#8a6a58', crema: '#b8741f', cherry: '#c7362b', arrow: '#c9ad95' },
]

const ESP_FALLBACK: EspressoDefaults = { dose: '18', yield: '36', temp: '92', grind: '3', preinf: '0', waterRecipe: 'Light and Bright', grinderRpm: '800' }
const FIL_FALLBACK: FilterDefaults = { dose: '15', water: '250', temp: '92', grind: '10', numPours: '3', waterRecipe: 'Light and Bright', grinderRpm: '800' }
const SAVE_DELAY_MS = 500
const ICON = 16

type Section = 'appearance' | 'units' | 'defaults' | 'water' | 'modes' | 'data' | 'about'
const SECTIONS: { id: Section; label: string; icon: IconName }[] = [
  { id: 'appearance', label: 'Appearance',            icon: 'sliders' },
  { id: 'units',      label: 'Units',                 icon: 'scale' },
  { id: 'defaults',   label: 'Dial-in defaults',      icon: 'timer' },
  { id: 'water',      label: 'Water recipes',         icon: 'droplet' },
  { id: 'modes',      label: 'Brew modes',            icon: 'machine' },
  { id: 'data',       label: 'Backup and data',       icon: 'download' },
  { id: 'about',      label: 'About',                 icon: 'book' },
]

interface SettingsProps {
  open:              boolean
  onClose:           () => void
  design:            Design
  setDesign:         (design: Design) => void
  extraction:        ExtractionLook
  setExtraction:     (look: ExtractionLook) => void
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
  onPreviewBackup:   DataSettingsProps['onPreview']
  onRestoreBackup:   DataSettingsProps['onRestore']
}

function ThemeCard({ t, on, onPick }: { t: ThemeSwatch; on: boolean; onPick: () => void }) {
  return (
    <button className={`theme-card${on ? ' on' : ''}`} onClick={onPick} aria-pressed={on}>
      <div className="theme-preview" style={{ background: t.bg, color: t.txt }}>
        <div className="sb" style={{ background: t.sb }}>
          <i style={{ background: t.accent, width: '70%' }} />
          <i style={{ background: t.txt, width: '50%' }} />
          <i style={{ background: t.txt, width: '80%' }} />
        </div>
        <div className="mn">
          <span className="tt">Dial-in.</span>
          <div className="cd" style={{ background: t.card }}><span>18 → 50</span><span style={{ color: t.accent }}>8.5</span></div>
        </div>
      </div>
      <div className="meta"><span className="name">{t.name}</span><span className="tag">{t.tag}</span></div>
    </button>
  )
}

function XThemeCard({ t, on, onPick }: { t: XSwatch; on: boolean; onPick: () => void }) {
  return (
    <button className={`xtheme-card${on ? ' on' : ''}`} onClick={onPick} aria-pressed={on}>
      <div className="xtheme-preview" style={{ background: t.bg, color: t.txt }}>
        <span className="xt-l" style={{ color: t.muted }}>Last shot</span>
        <span className="xt-n">18<i style={{ color: t.arrow }}>→</i>48.5<b style={{ color: t.cherry }}>14</b></span>
        <span className="xt-g" />
        <span className="xt-b"><em style={{ background: t.cherry }}>Pull again</em><em style={{ background: t.card }}>Details</em></span>
      </div>
      <div className="meta"><span className="name">{t.name}</span><span className="tag">{t.tag}</span></div>
    </button>
  )
}

function DefaultsField({ label, value, step, onChange }: { label: string; value: string; step: string; onChange: (v: string) => void }) {
  return (
    <div className="dial-input">
      <label>{label}</label>
      <input type="number" step={step} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function DefaultsSelect({ label, value, options, render = (o: string) => o, onChange }: { label: string; value: string; options: string[]; render?: (o: string) => string; onChange: (v: string) => void }) {
  return (
    <div className="dial-input">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{render(o)}</option>)}
      </select>
    </div>
  )
}

const rpmLabel = (r: string) => r === 'manual' ? 'Manual' : `${r} RPM`

export default function Settings({ open, onClose, design, setDesign, extraction, setExtraction, theme, setTheme, fonts, setFonts, units, setUnits, waterRecipes, setWaterRecipes, dialinDefaults, setDialinDefaults, brewModes, setBrewModes, onPreviewBackup, onRestoreBackup }: SettingsProps) {
  const [section, setSection] = useState<Section>('appearance')
  const [defs, setDefs] = useState(dialinDefaults)
  const [newRecipe, setNewRecipe] = useState('')
  const [newMode, setNewMode] = useState('')

  // Typing in the number fields saves after a short pause, not on every keystroke
  useEffect(() => {
    if (defs === dialinDefaults) return
    const t = setTimeout(() => setDialinDefaults(defs), SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [defs]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateDef = (mode: 'espresso' | 'filter', key: keyof EspressoDefaults | keyof FilterDefaults, val: string) => setDefs(prev => ({ ...prev, [mode]: { ...prev[mode], [key]: val } }))

  const addWaterRecipe = () => {
    const name = newRecipe.trim()
    if (!name || waterRecipes.includes(name)) return
    setWaterRecipes([...waterRecipes, name])
    setNewRecipe('')
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
  const current = SECTIONS.find(s => s.id === section)!
  const xLook   = lookFrom({ design: 'extraction', extraction })

  return (
    <Backdrop onClose={onClose}>
      <div className="modal settings" role="dialog" aria-label="Settings" onClick={e => e.stopPropagation()}>
        <div className="settings-phone-head phone-only">
          <button className="icon-btn plain" aria-label="Back" onClick={onClose}><Ico name="back" size={20} /></button>
          <h2>Settings</h2>
        </div>
        <nav className="settings-nav">
          <h2>Settings</h2>
          {SECTIONS.map(s => (
            <button key={s.id} className={`nav-item${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
              <Ico name={s.icon} size={ICON} className="ico" /> {s.label}
            </button>
          ))}
          <div className="saved">Changes save as you go</div>
        </nav>

        <div className="settings-main">
          <div className="settings-head">
            <h3>{current.label}</h3>
            <button className="icon-btn" aria-label="Close settings" onClick={onClose}><Ico name="x" size={ICON} /></button>
          </div>

          <div className="settings-body scroll">
            {section === 'appearance' && (
              <>
                <div className="settings-section">
                  <div className="desc">Each design keeps its own theme and fonts. Every browser on this server sees the one you pick.</div>
                  <div className="design-grid">
                    {DESIGNS.map(d => (
                      <button key={d.id} className={`design-card ${d.id}${design === d.id ? ' on' : ''}`} aria-pressed={design === d.id} onClick={() => setDesign(d.id)}>
                        <span className="dc-mark">{d.id === 'refined' ? 'Aa' : '18'}</span>
                        <span><b>{d.name}</b><span>{d.desc}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
                {design === 'refined' ? (
                  <>
                    <div className="settings-section">
                      <h4>Themes</h4>
                      <div className="theme-grid">
                        {THEMES.map(t => <ThemeCard key={t.id} t={t} on={theme === t.id} onPick={() => setTheme(t.id)} />)}
                      </div>
                    </div>
                    <div className="settings-section">
                      <h4>Fonts</h4>
                      {FONT_ROLES.map(({ role, label, desc }) => (
                        <div key={role} className="font-row">
                          <div><div className="label">{label}</div><div className="desc">{desc}</div></div>
                          <div className="font-chips">
                            {FONT_OPTIONS[role].map(f => (
                              <button key={f.id} className={`font-chip${role === 'serif' ? ' serif' : ''}${fonts[role] === f.id ? ' on' : ''}`}
                                style={{ fontFamily: fontStack(role, f.id) }} onClick={() => setFonts({ ...fonts, [role]: f.id })}>
                                {f.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="settings-section">
                      <h4>Themes</h4>
                      <div className="xtheme-grid">
                        {XTHEMES.map(t => <XThemeCard key={t.id} t={t} on={xLook.theme === t.id} onPick={() => setExtraction({ ...extraction, theme: t.id })} />)}
                      </div>
                    </div>
                    <div className="settings-section">
                      <h4>Numbers and headings</h4>
                      <div className="xfont-grid">
                        {EXTRACTION_FONT_IDS.serif.map(id => (
                          <button key={id} className={`xfont-card${xLook.fonts.serif === id ? ' on' : ''}`}
                            onClick={() => setExtraction({ ...extraction, fonts: { ...extraction.fonts, serif: id } })}>
                            <span style={{ fontFamily: fontStack('serif', id) }}>15 s</span>
                            {FONT_OPTIONS.serif.find(f => f.id === id)?.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="settings-section">
                      <h4>Text</h4>
                      <div className="font-chips">
                        {EXTRACTION_FONT_IDS.sans.map(id => (
                          <button key={id} className={`font-chip${xLook.fonts.sans === id ? ' on' : ''}`} style={{ fontFamily: fontStack('sans', id) }}
                            onClick={() => setExtraction({ ...extraction, fonts: { ...extraction.fonts, sans: id } })}>
                            {FONT_OPTIONS.sans.find(f => f.id === id)?.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {section === 'units' && (
              <div className="settings-section">
                <div className="settings-row">
                  <div><div className="label">Weight</div><div className="desc">Dose, yield, water and what's left in a bag.</div></div>
                  <div className="unit-toggle">
                    <button className={units.mass === 'g'  ? 'on' : ''} onClick={() => setUnits({ ...units, mass: 'g' })}>Grams</button>
                    <button className={units.mass === 'oz' ? 'on' : ''} onClick={() => setUnits({ ...units, mass: 'oz' })}>Ounces</button>
                  </div>
                </div>
                <div className="settings-row">
                  <div><div className="label">Temperature</div><div className="desc">Brew and kettle temperature.</div></div>
                  <div className="unit-toggle">
                    <button className={units.temp === 'C' ? 'on' : ''} onClick={() => setUnits({ ...units, temp: 'C' })}>Celsius</button>
                    <button className={units.temp === 'F' ? 'on' : ''} onClick={() => setUnits({ ...units, temp: 'F' })}>Fahrenheit</button>
                  </div>
                </div>
                <div className="settings-row">
                  <div><div className="label">Currency</div><div className="desc">The sign shown with bean and gear prices. Amounts aren't converted.</div></div>
                  <div className="unit-toggle">
                    <button className={units.currency === 'EUR' ? 'on' : ''} onClick={() => setUnits({ ...units, currency: 'EUR' })}>€ Euro</button>
                    <button className={units.currency === 'USD' ? 'on' : ''} onClick={() => setUnits({ ...units, currency: 'USD' })}>$ Dollar</button>
                    <button className={units.currency === 'GBP' ? 'on' : ''} onClick={() => setUnits({ ...units, currency: 'GBP' })}>£ Pound</button>
                  </div>
                </div>
              </div>
            )}

            {section === 'defaults' && (
              <>
                <div className="settings-section">
                  <h4>Espresso: what Dial-in starts with</h4>
                  <div className="form-grid">
                    <DefaultsField label={`Dose (${mU})`} value={esp.dose} step="0.1" onChange={v => updateDef('espresso', 'dose', v)} />
                    <DefaultsField label={`Yield (${mU})`} value={esp.yield} step="0.1" onChange={v => updateDef('espresso', 'yield', v)} />
                    <DefaultsField label={`Temperature (${tU})`} value={esp.temp} step="1" onChange={v => updateDef('espresso', 'temp', v)} />
                    <DefaultsField label="Grind" value={esp.grind} step="0.1" onChange={v => updateDef('espresso', 'grind', v)} />
                    <DefaultsField label="Pre-infusion (s)" value={esp.preinf} step="1" onChange={v => updateDef('espresso', 'preinf', v)} />
                    <DefaultsSelect label="Grinder RPM" value={esp.grinderRpm} options={RPM_OPTIONS} render={rpmLabel} onChange={v => updateDef('espresso', 'grinderRpm', v)} />
                    <DefaultsSelect label="Water recipe" value={esp.waterRecipe} options={waterRecipes} onChange={v => updateDef('espresso', 'waterRecipe', v)} />
                  </div>
                </div>
                <div className="settings-section">
                  <h4>Filter</h4>
                  <div className="form-grid">
                    <DefaultsField label={`Dose (${mU})`} value={fil.dose} step="0.1" onChange={v => updateDef('filter', 'dose', v)} />
                    <DefaultsField label={`Water (${mU})`} value={fil.water} step="5" onChange={v => updateDef('filter', 'water', v)} />
                    <DefaultsField label={`Temperature (${tU})`} value={fil.temp} step="1" onChange={v => updateDef('filter', 'temp', v)} />
                    <DefaultsField label="Grind" value={fil.grind} step="0.1" onChange={v => updateDef('filter', 'grind', v)} />
                    <DefaultsField label="Number of pours" value={fil.numPours} step="1" onChange={v => updateDef('filter', 'numPours', v)} />
                    <DefaultsSelect label="Grinder RPM" value={fil.grinderRpm} options={RPM_OPTIONS} render={rpmLabel} onChange={v => updateDef('filter', 'grinderRpm', v)} />
                    <DefaultsSelect label="Water recipe" value={fil.waterRecipe} options={waterRecipes} onChange={v => updateDef('filter', 'waterRecipe', v)} />
                  </div>
                </div>
              </>
            )}

            {section === 'water' && (
              <div className="settings-section">
                <div className="desc">The choices Dial-in offers for water.</div>
                {waterRecipes.map(r => (
                  <div key={r} className="list-row">
                    <span>{r}</span>
                    <button className="icon-btn plain" aria-label={`Remove ${r}`} onClick={() => setWaterRecipes(waterRecipes.filter(x => x !== r))} disabled={waterRecipes.length <= 1}>
                      <Ico name="x" size={ICON} />
                    </button>
                  </div>
                ))}
                <div className="row" style={{ marginTop: '10px' }}>
                  <input className="text-input" type="text" placeholder="Add a water recipe" value={newRecipe}
                    onChange={e => setNewRecipe(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWaterRecipe() } }} />
                  <button className="ghost-btn lg" onClick={addWaterRecipe}>Add</button>
                </div>
              </div>
            )}

            {section === 'modes' && (
              <div className="settings-section">
                <div className="desc">Optional. Buttons or programs on your espresso machine, like “Button 1” or “Paddle”. Leave this empty and Dial-in won't ask.</div>
                {brewModes.map(m => (
                  <div key={m} className="list-row">
                    <span>{m}</span>
                    <button className="icon-btn plain" aria-label={`Remove ${m}`} onClick={() => setBrewModes(brewModes.filter(x => x !== m))}>
                      <Ico name="x" size={ICON} />
                    </button>
                  </div>
                ))}
                <div className="row" style={{ marginTop: '10px' }}>
                  <input className="text-input" type="text" placeholder="Add a brew mode" value={newMode}
                    onChange={e => setNewMode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBrewMode() } }} />
                  <button className="ghost-btn lg" onClick={addBrewMode}>Add</button>
                </div>
              </div>
            )}

            {section === 'data' && <DataSettings onPreview={onPreviewBackup} onRestore={onRestoreBackup} />}

            {section === 'about' && (
              <div className="settings-section">
                <div className="settings-row">
                  <div><div className="label">Grounded {__APP_VERSION__}</div><div className="desc">A self-hosted coffee tracker. Everything stays on this server.</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Backdrop>
  )
}
