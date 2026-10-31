import { useState, type FormEvent } from 'react'
import { Backdrop } from '../components/ui.tsx'
import { Field } from '../components/Fields.tsx'
import { PageHead } from '../components/Shell.tsx'
import { ratioText } from '../data/taste.ts'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import type { Recipe, RecipeInput, RecipeStep, Units } from '../types.ts'

// ── RECIPES ───────────────────────────────────────────────────────────
const ICON = 14

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
  const [adding,   setAdding]  = useState(false)
  const [editing,  setEditing] = useState<Recipe | null>(null)
  const [form, setForm]        = useState(EMPTY_RECIPE)
  const [saving, setSaving]    = useState(false)

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
    ratio: dose && water ? ratioText(dose, water, 'filter') : '',
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

  const handleDelete = async (r: Recipe) => {
    if (!confirm(`Delete ${r.name}? This can’t be undone.`)) return
    await onDeleteRecipe(r.id)
  }

  const closeModal = () => { setAdding(false); setEditing(null); setForm(EMPTY_RECIPE) }

  const isEdit = editing != null
  const formRatio = ratioText(parseFloat(form.dose) || 0, parseFloat(form.water) || 0, 'filter')

  return (
    <div className="stack">
      <PageHead title="Recipes." sub={`${recipes.length} saved`}>
        <button className="primary-btn" onClick={() => setAdding(true)}><Ico name="plus" size={ICON} /> Add recipe</button>
      </PageHead>

      {recipes.length === 0 && (
        <div className="card"><div className="empty">No recipes yet. Save the ones you like to follow, step by step.</div></div>
      )}

      <div className="recipe-grid">
      {recipes.map(r => (
        <div key={r.id} className="card recipe">
          <div className="card-head">
            <span className="card-title">{r.type}</span>
            <div className="recipe-tags">{r.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}</div>
            <button className="icon-btn plain sm" aria-label={`Edit ${r.name}`} title="Edit recipe" onClick={() => openEdit(r)}><Ico name="pencil" size={ICON} /></button>
            <button className="icon-btn plain sm danger" aria-label={`Delete ${r.name}`} title="Delete recipe" onClick={() => handleDelete(r)}><Ico name="trash" size={ICON} /></button>
          </div>
          <div className="recipe-name">{r.name}</div>
          <div className="recipe-nums">
            <div className="kv"><span className="k">Dose</span><span className="v">{U.m(r.dose)}<small>{U.mU()}</small></span></div>
            <div className="kv"><span className="k">Water</span><span className="v">{U.m(r.water)}<small>{U.mU()}</small></span></div>
            <div className="kv"><span className="k">Ratio</span><span className="v">{r.ratio || '–'}</span></div>
            <div className="kv"><span className="k">Temp</span><span className="v">{U.t(r.temp)}<small>{U.tU()}</small></span></div>
            <div className="kv"><span className="k">Time</span><span className="v">{r.time || '–'}</span></div>
          </div>
          {r.grind && <div className="recipe-grind">Grind: {r.grind}</div>}
          <div className="recipe-steps">
            {r.steps.map((step, i) => (
              <div key={i} className="rstep">
                <span className="rs-t">{step.t}</span>
                <div className="rs-main">
                  <div className="rs-name">{step.name}</div>
                  {step.desc && <div className="rs-desc">{step.desc}</div>}
                </div>
                <span className="rs-w">{step.water || ''}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>

      {(adding || editing) && (
        <Backdrop onClose={closeModal}>
          <div className="modal recipe-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{isEdit ? 'Edit recipe' : 'New recipe'}</h2>
              <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={closeModal}><Ico name="x" size={ICON} /></button>
            </div>
            <form onSubmit={isEdit ? handleEdit : handleAdd}>
              <div className="modal-body scroll stack">
                <div className="form-grid">
                  <Field label="Name" wide>
                    <input className="text-input" placeholder="Tetsu 4:6, balanced" required value={form.name} onChange={e => setField('name', e.target.value)} />
                  </Field>
                  <Field label="Brewer">
                    <input className="text-input" placeholder="V60, AeroPress…" value={form.type} onChange={e => setField('type', e.target.value)} />
                  </Field>
                  <Field label="Tags, separated by commas">
                    <input className="text-input" placeholder="light roast, easy" value={form.tags} onChange={e => setField('tags', e.target.value)} />
                  </Field>
                </div>

                <div className="form-grid three">
                  <Field label="Dose (g)">
                    <input className="text-input mono" type="number" step="0.1" placeholder="20" value={form.dose} onChange={e => setField('dose', e.target.value)} />
                  </Field>
                  <Field label="Water (g)">
                    <input className="text-input mono" type="number" step="1" placeholder="300" value={form.water} onChange={e => setField('water', e.target.value)} />
                  </Field>
                  <Field label="Ratio">
                    <span className="text-input mono readonly-input">{formRatio}</span>
                  </Field>
                  <Field label="Temp (°C)">
                    <input className="text-input mono" type="number" step="0.5" placeholder="92" value={form.temp} onChange={e => setField('temp', e.target.value)} />
                  </Field>
                  <Field label="Total time">
                    <input className="text-input mono" placeholder="3:30" value={form.time} onChange={e => setField('time', e.target.value)} />
                  </Field>
                  <Field label="Grind">
                    <input className="text-input" placeholder="Medium-coarse" value={form.grind} onChange={e => setField('grind', e.target.value)} />
                  </Field>
                </div>

                <div>
                  <div className="step-form-row step-form-cols"><span>Time</span><span>Step</span><span>Note</span><span>Water</span><span /></div>
                  <div className="stack step-form">
                    {form.steps.map((step, i) => (
                      <div key={i} className="step-form-row">
                        <input className="text-input mono" placeholder="0:00" aria-label="Time" value={step.t} onChange={e => setStep(i, 't', e.target.value)} />
                        <input className="text-input" placeholder="Bloom" aria-label="Step" value={step.name} onChange={e => setStep(i, 'name', e.target.value)} />
                        <input className="text-input" placeholder="Optional" aria-label="Note" value={step.desc} onChange={e => setStep(i, 'desc', e.target.value)} />
                        <input className="text-input mono" placeholder="60g" aria-label="Water" value={step.water} onChange={e => setStep(i, 'water', e.target.value)} />
                        <button type="button" className="icon-btn plain sm" aria-label="Remove step" onClick={() => removeStep(i)} disabled={form.steps.length === 1}><Ico name="x" size={ICON} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="link-btn dmodal-add" onClick={addStep}>+ Add a step</button>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="ghost-btn lg" onClick={closeModal}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Save recipe'}</button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}
    </div>
  )
}
