import { useState, type FormEvent } from 'react'
import Ico from '../components/Ico.tsx'
import type { Gear, GearInput } from '../types.ts'

// ── GEAR ──────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['Primary', 'In use', 'Active', 'Travel', 'Retired']
const ACTIVE_STATUSES = new Set(['Primary', 'In use', 'Active'])

/** Form fields are the inputs' strings until saved */
interface GearForm {
  kind: string; name: string; meta: string; status: string; owned: string; price: string
}

const EMPTY_FORM: GearForm = { kind: '', name: '', meta: '', status: 'Active', owned: '', price: '' }

interface GearPageProps {
  gear?:        Gear[]
  onSaveGear:   (g: GearInput) => Promise<Gear>
  onUpdateGear: (id: string, g: GearInput) => Promise<Gear>
  onDeleteGear: (id: string) => Promise<void>
}

export function GearPage({ gear = [], onSaveGear, onUpdateGear, onDeleteGear }: GearPageProps) {
  const [adding,  setAdding]  = useState(false)
  const [editing, setEditing] = useState<Gear | null>(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  const kinds = [...new Set(gear.map(g => g.kind))].sort()

  const openEdit = (g: Gear) => {
    setEditing(g)
    setForm({ kind: g.kind, name: g.name, meta: g.meta || '', status: g.status || 'Active', owned: g.owned || '', price: g.price != null ? String(g.price) : '' })
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.kind.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      await onSaveGear({ ...form, price: parseFloat(form.price) || null, id: 'gear-' + Date.now() })
      setForm(EMPTY_FORM)
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !form.kind.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      await onUpdateGear(editing.id, { ...form, price: parseFloat(form.price) || null })
      setEditing(null)
      setForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this item?')) return
    await onDeleteGear(id)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Gear.</h1>
        <span className="page-sub">{gear.length} items</span>
        <button className="primary-btn" style={{ marginLeft: 'auto' }} onClick={() => setAdding(true)}>
          <Ico name="plus" size={13} /> Add item
        </button>
      </div>

      {kinds.map(kind => (
        <div key={kind} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 18px',
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-3)', fontWeight: 500 }}>{kind}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>{gear.filter(g => g.kind === kind).length}</span>
          </div>
          <div style={{ padding: '0 18px' }}>
            {gear.filter(g => g.kind === kind).map((g, i, arr) => (
              <div key={g.id} className="gear-row" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                  {g.meta && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{g.meta.split(',').map(s => s.trim()).filter(Boolean).join(' · ')}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                  <span className={`badge ${ACTIVE_STATUSES.has(g.status) ? 'good' : ''}`}>{g.status}</span>
                  {g.price != null && g.price > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>€{g.price % 1 === 0 ? g.price : g.price.toFixed(2)}</div>}
                  {g.owned && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>{g.owned}</div>}
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent' }}
                    onClick={() => openEdit(g)} title="Edit">
                    <Ico name="pencil" size={11} />
                  </button>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: 'oklch(0.60 0.18 20)' }}
                    onClick={() => handleDelete(g.id)} title="Remove">
                    <Ico name="trash" size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {adding && (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Add gear</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setAdding(false)}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body stack" onSubmit={handleAdd}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Category</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. Grinder"
                    value={form.kind}
                    onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                    list="gear-kinds"
                    required
                  />
                  <datalist id="gear-kinds">
                    {kinds.map(k => <option key={k} value={k} />)}
                  </datalist>
                </div>
                <div className="dial-input">
                  <label>Name</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. DF64 Gen 2"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="dial-input">
                  <label>Details</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. SSP MP · 64mm flat"
                    value={form.meta}
                    onChange={e => setForm(f => ({ ...f, meta: e.target.value }))}
                  />
                </div>
                <div className="dial-input">
                  <label>Price (€)</label>
                  <input
                    type="number"
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. 299"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>
                <div className="dial-input">
                  <label>Status</label>
                  <select
                    style={{ fontSize: 14, background: 'none', padding: 0, color: 'var(--text)' }}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Owned since</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. 2024-03"
                    value={form.owned}
                    onChange={e => setForm(f => ({ ...f, owned: e.target.value }))}
                  />
                </div>
              </div>
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="ghost-btn" onClick={() => setAdding(false)}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Add item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit gear</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body stack" onSubmit={handleEdit}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Category</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. Grinder"
                    value={form.kind}
                    onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                    list="gear-kinds"
                    required
                  />
                  <datalist id="gear-kinds">
                    {kinds.map(k => <option key={k} value={k} />)}
                  </datalist>
                </div>
                <div className="dial-input">
                  <label>Name</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. DF64 Gen 2"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="dial-input">
                  <label>Details</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. SSP MP · 64mm flat"
                    value={form.meta}
                    onChange={e => setForm(f => ({ ...f, meta: e.target.value }))}
                  />
                </div>
                <div className="dial-input">
                  <label>Price (€)</label>
                  <input
                    type="number"
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. 299"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  />
                </div>
                <div className="dial-input">
                  <label>Status</label>
                  <select
                    style={{ fontSize: 14, background: 'none', padding: 0, color: 'var(--text)' }}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Owned since</label>
                  <input
                    style={{ fontSize: 14, width: '100%' }}
                    placeholder="e.g. 2024-03"
                    value={form.owned}
                    onChange={e => setForm(f => ({ ...f, owned: e.target.value }))}
                  />
                </div>
              </div>
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="ghost-btn" onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
