import { useState, type FormEvent } from 'react'
import Ico from '../components/Ico.tsx'
import type { Tip, TipInput, TipSection } from '../types.ts'

// ── TIPS PAGE ─────────────────────────────────────────────────────────
const EMPTY_TIP = { category: '', body: '' }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-2)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>{tips.length}</span>
        <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', marginLeft: 'auto' }} onClick={() => onAdd(section)} title={`Add ${label} note`}>
          <Ico name="plus" size={11} />
        </button>
      </div>

      {tips.length === 0 && (
        <div className="card" style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          No notes yet — add your first one
        </div>
      )}

      {categories.map(cat => (
        <div key={cat} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 18px',
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-3)', fontWeight: 500 }}>{cat}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>{tips.filter(t => t.category === cat).length}</span>
          </div>
          <div style={{ padding: '0 18px' }}>
            {tips.filter(t => t.category === cat).map((tip, i, arr) => (
              <div key={tip.id} style={{
                padding: '12px 0',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {tip.body || <span style={{ color: 'var(--text-4)', fontStyle: 'italic' }}>No notes</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent' }}
                    onClick={() => onEdit(tip)} title="Edit">
                    <Ico name="pencil" size={11} />
                  </button>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: 'oklch(0.60 0.18 20)' }}
                    onClick={() => onDelete(tip.id)} title="Delete">
                    <Ico name="trash" size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
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
    if (!confirm('Delete this note?')) return
    await onDeleteTip(id)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Tips.</h1>
        <span className="page-sub">{tips.length} notes</span>
      </div>

      <div className="grid grid-2" style={{ gap: 28, alignItems: 'start' }}>
        <TipsColumn
          section="espresso" label="Espresso"
          tips={espressoTips}
          onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete}
        />
        <TipsColumn
          section="filter" label="Filter"
          tips={filterTips}
          onAdd={openAdd} onEdit={openEdit} onDelete={handleDelete}
        />
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{modal.mode === 'add' ? 'Add' : 'Edit'} {modal.section} note</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={closeModal}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body stack" onSubmit={handleSubmit}>
              <div className="dial-input">
                <label>Category</label>
                <input
                  style={{ fontSize: 14, width: '100%' }}
                  placeholder="e.g. Water, Grind, Temperature"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  list={`tip-cats-${modal.section}`}
                  required
                  autoFocus
                />
                <datalist id={`tip-cats-${modal.section}`}>
                  {allCategories(modal.section).map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="dial-input">
                <label>Notes</label>
                <textarea
                  style={{ fontSize: 13, width: '100%', minHeight: 100, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
                  placeholder="Your hack, value, reasoning…"
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" className="ghost-btn" onClick={closeModal}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? 'Saving…' : modal.mode === 'add' ? 'Add note' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
