import { useState, type FormEvent } from 'react'
import { Backdrop } from '../components/ui.tsx'
import Ico from '../components/Ico.tsx'
import { Field } from '../components/Fields.tsx'
import { PageHead } from '../components/Shell.tsx'
import type { Tip, TipInput, TipSection } from '../types.ts'

// ── TIPS PAGE ─────────────────────────────────────────────────────────
const EMPTY_TIP = { category: '', body: '' }

const ICON = 14

interface TipsColumnProps {
  section:  TipSection
  label:    string
  tips:     Tip[]
  onAdd:    (section: TipSection) => void
  onEdit:   (tip: Tip) => void
  onDelete: (id: string) => void
}

function TipsColumn({ section, label, tips, onAdd, onEdit, onDelete }: TipsColumnProps) {
  const categories = [...new Set(tips.map(t => t.category))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  return (
    <div className={`card tips-${section}`}>
      <div className="card-head">
        <span className="card-title">{label}</span><span>{tips.length}</span>
        <button className="link-btn" onClick={() => onAdd(section)}>+ Add a note</button>
      </div>

      {tips.length === 0 && <div className="empty">No {label.toLowerCase()} notes yet. Keep what works for you here: water, grind, temperature, anything.</div>}

      {categories.map(cat => {
        const inCat = tips.filter(t => t.category === cat)
        return (
          <div key={cat} className="tip-group">
            <div className="tip-cat">{cat}<span>{inCat.length}</span></div>
            {inCat.map(tip => (
              <div key={tip.id} className="tip-item">
                <div className="tip-body">{tip.body || <span className="tip-none">No text</span>}</div>
                <button className="icon-btn plain sm" aria-label="Edit note" title="Edit" onClick={() => onEdit(tip)}><Ico name="pencil" size={ICON} /></button>
                <button className="icon-btn plain sm danger" aria-label="Delete note" title="Delete" onClick={() => onDelete(tip.id)}><Ico name="trash" size={ICON} /></button>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

interface TipsPageProps {
  tips?:       Tip[]
  onSaveTip:   (tip: TipInput) => Promise<Tip>
  onUpdateTip: (id: string, data: TipInput) => Promise<Tip>
  onDeleteTip: (id: string) => Promise<void>
}

type TipModal =
  | { mode: 'add';  section: TipSection }
  | { mode: 'edit'; section: TipSection; tip: Tip }

export function TipsPage({ tips = [], onSaveTip, onUpdateTip, onDeleteTip }: TipsPageProps) {
  const [modal, setModal]   = useState<TipModal | null>(null)
  const [form, setForm]     = useState(EMPTY_TIP)
  const [saving, setSaving] = useState(false)
  const [shown, setShown]   = useState<TipSection>('espresso')   // Extraction on a phone shows one column at a time

  const espressoTips = tips.filter(t => t.section === 'espresso')
  const filterTips   = tips.filter(t => t.section === 'filter')
  const allCategories = (section: TipSection) => [...new Set(tips.filter(t => t.section === section).map(t => t.category))].sort()

  const openAdd = (section: TipSection) => {
    setForm(EMPTY_TIP)
    setModal({ mode: 'add', section })
  }

  const openEdit = (tip: Tip) => {
    setForm({ category: tip.category, body: tip.body || '' })
    setModal({ mode: 'edit', section: tip.section, tip })
  }

  const closeModal = () => { setModal(null); setForm(EMPTY_TIP) }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal || !form.category.trim()) return
    setSaving(true)
    try {
      if (modal.mode === 'add') {
        await onSaveTip({ ...form, section: modal.section, id: 'tip-' + Date.now() })
      } else {
        await onUpdateTip(modal.tip.id, { ...modal.tip, ...form })
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note? This can’t be undone.')) return
    await onDeleteTip(id)
  }

  const isAdd = modal?.mode === 'add'
  const saveLabel = isAdd ? 'Add note' : 'Save changes'

  return (
    <div className="stack tips-page">
      <PageHead title="Tips." sub={`${tips.length} ${tips.length === 1 ? 'note' : 'notes'}`} />

      <div className="seg tips-seg">
        <button className={shown === 'espresso' ? 'on' : ''} onClick={() => setShown('espresso')}>Espresso {espressoTips.length}</button>
        <button className={shown === 'filter' ? 'on' : ''} onClick={() => setShown('filter')}>Filter {filterTips.length}</button>
      </div>

      <div className={`tips-cols shows-${shown}`}>
        <TipsColumn section="espresso" label="Espresso" tips={espressoTips} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />
        <TipsColumn section="filter" label="Filter" tips={filterTips} onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete} />
      </div>

      {modal && (
        <Backdrop onClose={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{isAdd ? 'Add' : 'Edit'} {modal.section} note</h2>
              <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Close" onClick={closeModal}><Ico name="x" size={ICON} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body form-grid">
                <Field label="Category" wide>
                  <input className="text-input" placeholder="Water, grind, temperature…" required autoFocus
                    list={`tip-cats-${modal.section}`}
                    value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                  <datalist id={`tip-cats-${modal.section}`}>
                    {allCategories(modal.section).map(c => <option key={c} value={c} />)}
                  </datalist>
                </Field>
                <Field label="Note" wide>
                  <textarea rows={5} placeholder="What you do and why…"
                    value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
                </Field>
              </div>
              <div className="modal-foot">
                <button type="button" className="ghost-btn lg" onClick={closeModal}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
              </div>
            </form>
          </div>
        </Backdrop>
      )}
    </div>
  )
}
