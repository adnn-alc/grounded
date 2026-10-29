import { useState, useRef, useEffect, type FormEvent } from 'react'
import { Meta } from '../components/ui.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import type { Recipe, RecipeInput, RecipeStep, Units } from '../types.ts'

// ── RECIPES ───────────────────────────────────────────────────────────
/** Form fields are the inputs' strings until saved */
interface RecipeForm {
  name: string; type: string; dose: string; water: string; ratio: string
  temp: string; time: string; grind: string; tags: string
  steps: RecipeStep[]
}

const EMPTY_RECIPE: RecipeForm = {
  name: '', type: '', dose: '', water: '', ratio: '', temp: '', time: '', grind: '', tags: '',
  steps: [{ t: '', name: '', desc: '', water: '' }],
}

interface RecipesPageProps {
  recipes?:       Recipe[]
  units:          Units
  onSaveRecipe:   (recipe: RecipeInput) => Promise<Recipe>
  onUpdateRecipe: (id: string, recipe: RecipeInput) => Promise<Recipe>
  onDeleteRecipe: (id: string) => Promise<void>
}

export function RecipesPage({ recipes = [], units, onSaveRecipe, onUpdateRecipe, onDeleteRecipe }: RecipesPageProps) {
  const U = useUnits(units)
  const [activeTimer, setActiveTimer] = useState<string | null>(null)
  const [timerEl, setTimerEl]         = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const [adding,   setAdding]  = useState(false)
  const [editing,  setEditing] = useState<Recipe | null>(null)
  const [form, setForm]        = useState(EMPTY_RECIPE)
  const [saving, setSaving]    = useState(false)

  const startTimer = (id: string) => {
    clearInterval(timerRef.current)
    setActiveTimer(id); setTimerEl(0)
    timerRef.current = setInterval(() => setTimerEl(e => e + 1), 1000)
  }
  const stopTimer = () => { clearInterval(timerRef.current); setActiveTimer(null); setTimerEl(0) }
  useEffect(() => () => clearInterval(timerRef.current), [])

  const setField = (k: keyof RecipeForm, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setStep  = (i: number, k: keyof RecipeStep, v: string) => setForm(f => {
    const steps = [...f.steps]
    steps[i] = { ...steps[i], [k]: v }
    return { ...f, steps }
  })
  const addStep    = () => setForm(f => ({ ...f, steps: [...f.steps, { t: '', name: '', desc: '', water: '' }] }))
  const removeStep = (i: number) => setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))

  const recipePayload = (): RecipeInput => {
    const dose  = parseFloat(form.dose)  || 0
    const water = parseFloat(form.water) || 0
    return {
    name:  form.name.trim(),
    type:  form.type.trim(),
    dose,
    water,
    ratio: dose && water ? `1:${(water / dose).toFixed(1)}` : '',
    temp:  parseFloat(form.temp)  || 0,
    time:  form.time.trim(),
    grind: form.grind.trim(),
    author: editing ? editing.author : 'Custom',
    tags:  form.tags.split(',').map(t => t.trim()).filter(Boolean),
    steps: form.steps.filter(s => s.name.trim()),
  }
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSaveRecipe({ id: 'recipe-' + Date.now(), ...recipePayload() })
      setForm(EMPTY_RECIPE)
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !form.name.trim()) return
    setSaving(true)
    try {
      await onUpdateRecipe(editing.id, recipePayload())
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (r: Recipe) => {
    setForm({
      name:  r.name,
      type:  r.type  || '',
      dose:  String(r.dose  || ''),
      water: String(r.water || ''),
      ratio: r.ratio || '',
      temp:  String(r.temp  || ''),
      time:  r.time  || '',
      grind: r.grind || '',
      tags:  (r.tags || []).join(', '),
      steps: r.steps?.length ? r.steps : [{ t: '', name: '', desc: '', water: '' }],
    })
    setEditing(r)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recipe?')) return
    await onDeleteRecipe(id)
  }

  const closeModal = () => { setAdding(false); setEditing(null); setForm(EMPTY_RECIPE) }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Recipes.</h1>
        <span className="page-sub">{recipes.length} saved</span>
        <button className="primary-btn" style={{ marginLeft: 'auto' }} onClick={() => setAdding(true)}>
          <Ico name="plus" size={13} /> Add recipe
        </button>
      </div>

      <div className="grid grid-2">
      {recipes.map(r => (
        <div key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <span className="card-title">{r.type}</span>
            <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
              {r.tags.map(t => <span key={t} className="badge">{t}</span>)}
              <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent' }}
                onClick={() => openEdit(r)} title="Edit recipe">
                <Ico name="pencil" size={11} />
              </button>
              <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: 'oklch(0.60 0.18 20)' }}
                onClick={() => handleDelete(r.id)} title="Delete recipe">
                <Ico name="trash" size={11} />
              </button>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 30, lineHeight: 1 }}>{r.name}</div>
          <div className="divider" />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginBottom: 14 }}>
            <Meta k="Dose"  v={`${U.m(r.dose)}${U.mU()}`} />
            <Meta k="Water" v={`${U.m(r.water)}${U.mU()}`} />
            <Meta k="Ratio" v={r.ratio} />
            <Meta k="Temp"  v={`${U.t(r.temp)}${U.tU()}`} />
            <Meta k="Time"  v={r.time} />
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Grind · {r.grind}
          </div>
          <div style={{ flex: 1 }}>
          {r.steps.map((step, i) => (
            <div key={i} className="step-row">
              <div className="step-num">{i + 1}</div>
              <div className="step-time">{step.t}</div>
              <div>
                <div style={{ fontSize: 13 }}>{step.name}</div>
                {step.desc && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{step.desc}</div>}
              </div>
              <div className="step-water">{step.water || ''}</div>
            </div>
          ))}
          </div>
          <div className="row" style={{ marginTop: 14, gap: 12 }}>
            {activeTimer === r.id ? (
              <>
                <div className="mono" style={{ fontSize: 26, color: 'var(--crema)', letterSpacing: '-0.03em' }}>
                  {String(Math.floor(timerEl / 60)).padStart(2, '0')}:{String(timerEl % 60).padStart(2, '0')}
                </div>
                <button className="ghost-btn" onClick={stopTimer}><Ico name="stop" size={13} /> Stop</button>
              </>
            ) : (
              <button className="primary-btn" onClick={() => startTimer(r.id)}>
                <Ico name="play" size={13} /> Start timer
              </button>
            )}
          </div>
        </div>
      ))}
      </div>

      {(adding || editing) && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" style={{ width: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? 'Edit recipe' : 'New recipe'}</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={closeModal}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body scroll" onSubmit={editing ? handleEdit : handleAdd}>
              <div className="stack" style={{ gap: 18 }}>

                {/* Basic info */}
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="dial-input" style={{ gridColumn: '1 / -1' }}>
                    <label>Recipe name</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Tetsu 4:6 — Balanced"
                      value={form.name} onChange={e => setField('name', e.target.value)} required />
                  </div>
                  <div className="dial-input">
                    <label>Type / method</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. V60, AeroPress"
                      value={form.type} onChange={e => setField('type', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Tags (comma-separated)</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. light roast, easy"
                      value={form.tags} onChange={e => setField('tags', e.target.value)} />
                  </div>
                </div>

                {/* Parameters */}
                <div>
                  <div className="micro" style={{ marginBottom: 10 }}>Parameters</div>
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div className="dial-input">
                      <label>Dose (g)</label>
                      <input type="number" step="0.1" style={{ fontSize: 14, width: '100%' }} placeholder="20"
                        value={form.dose} onChange={e => setField('dose', e.target.value)} />
                    </div>
                    <div className="dial-input">
                      <label>Water (g)</label>
                      <input type="number" step="1" style={{ fontSize: 14, width: '100%' }} placeholder="300"
                        value={form.water} onChange={e => setField('water', e.target.value)} />
                    </div>
                    <div className="dial-input" style={{ justifyContent: 'center' }}>
                      <label>Ratio</label>
                      <div style={{ fontSize: 14, color: parseFloat(form.dose) && parseFloat(form.water) ? 'var(--text-1)' : 'var(--text-4)' }}>
                        {parseFloat(form.dose) && parseFloat(form.water)
                          ? `1:${(parseFloat(form.water) / parseFloat(form.dose)).toFixed(1)}`
                          : '–'}
                      </div>
                    </div>
                    <div className="dial-input">
                      <label>Temp (°C)</label>
                      <input type="number" step="0.5" style={{ fontSize: 14, width: '100%' }} placeholder="92"
                        value={form.temp} onChange={e => setField('temp', e.target.value)} />
                    </div>
                    <div className="dial-input">
                      <label>Total time</label>
                      <input style={{ fontSize: 14, width: '100%' }} placeholder="3:30"
                        value={form.time} onChange={e => setField('time', e.target.value)} />
                    </div>
                    <div className="dial-input">
                      <label>Grind</label>
                      <input style={{ fontSize: 14, width: '100%' }} placeholder="Medium-coarse"
                        value={form.grind} onChange={e => setField('grind', e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Steps */}
                <div>
                  <div className="row" style={{ marginBottom: 10 }}>
                    <div className="micro">Steps</div>
                    <button type="button" className="ghost-btn" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={addStep}>
                      <Ico name="plus" size={11} /> Add step
                    </button>
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    {form.steps.map((step, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 70px 24px', gap: 8, alignItems: 'center' }}>
                        <div className="dial-input" style={{ padding: '8px 10px' }}>
                          <label>Time</label>
                          <input style={{ fontSize: 13, width: '100%' }} placeholder="0:00"
                            value={step.t} onChange={e => setStep(i, 't', e.target.value)} />
                        </div>
                        <div className="dial-input" style={{ padding: '8px 10px' }}>
                          <label>Step name</label>
                          <input style={{ fontSize: 13, width: '100%' }} placeholder="Bloom"
                            value={step.name} onChange={e => setStep(i, 'name', e.target.value)} />
                        </div>
                        <div className="dial-input" style={{ padding: '8px 10px' }}>
                          <label>Description</label>
                          <input style={{ fontSize: 13, width: '100%' }} placeholder="Optional note"
                            value={step.desc} onChange={e => setStep(i, 'desc', e.target.value)} />
                        </div>
                        <div className="dial-input" style={{ padding: '8px 10px' }}>
                          <label>Water</label>
                          <input style={{ fontSize: 13, width: '100%' }} placeholder="60g"
                            value={step.water} onChange={e => setStep(i, 'water', e.target.value)} />
                        </div>
                        <button type="button" className="icon-btn"
                          style={{ width: 24, height: 24, borderColor: 'transparent', color: 'var(--text-4)', alignSelf: 'center' }}
                          onClick={() => removeStep(i)} disabled={form.steps.length === 1}>
                          <Ico name="x" size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="ghost-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? 'Saving…' : editing ? 'Update recipe' : 'Save recipe'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
