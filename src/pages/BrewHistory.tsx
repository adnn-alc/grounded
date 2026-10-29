import { useState, useEffect, type FormEvent } from 'react'
import { Meta, BrewCard } from '../components/ui.tsx'
import { FlavorRadar } from '../components/charts.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.ts'
import { RPM_OPTIONS } from '../data/grinderRpm.ts'
import type { Bean, Brew, BrewInput, Pour, Units, Verdict } from '../types.ts'

// ── BREW HISTORY ──────────────────────────────────────────────────────
interface BrewHistoryProps {
  brews?:             Brew[]
  beans?:             Bean[]
  units:              Units
  waterRecipes?:      string[]
  onDeleteBrew?:      (id: string) => Promise<void>
  onUpdateBrew?:      (id: string, data: BrewInput) => Promise<Brew>
  initialSelectedId?: string | null
  onReplicate?:       (brew: Brew) => void
  onFavorite?:        (id: string, val: boolean) => Promise<Brew>
}

/** The edit form keeps numbers as the inputs' strings until saved */
interface BrewEditForm {
  dose: string; water: string; temp: string; grind: string; bloom_time: string
  water_recipe: string; grinder_rpm: string
  notes: string
  verdict: string
  pours: string[]
}

export function BrewHistory({ brews = [], beans = [], units, waterRecipes = DEFAULT_WATER_RECIPES, onDeleteBrew, onUpdateBrew, initialSelectedId, onReplicate, onFavorite }: BrewHistoryProps) {
  const U = useUnits(units)
  const [selectedBrew, setSelectedBrew] = useState<Brew | null>(null)
  const [editing, setEditing] = useState<Brew | null>(null)
  const [editForm, setEditForm] = useState<BrewEditForm | null>(null)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(0)
  const [beanFilter, setBeanFilter] = useState('')

  const filtered = beanFilter ? brews.filter(b => b.bean === beanFilter) : brews
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = filtered.slice(page * perPage, (page + 1) * perPage)

  const changePerPage = (n: number) => { setPerPage(n); setPage(0); setSelectedBrew(null) }
  const changeBeanFilter = (b: string) => { setBeanFilter(b); setPage(0); setSelectedBrew(null) }

  useEffect(() => {
    if (initialSelectedId) {
      const idx = brews.findIndex(b => b.id === initialSelectedId)
      if (idx !== -1) {
        setSelectedBrew(brews[idx])
        setPage(Math.floor(idx / perPage))
      }
    }
  }, [initialSelectedId])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this brew?')) return
    await onDeleteBrew?.(id)
    setSelectedBrew(null)
  }

  const openEdit = (brew: Brew) => {
    setEditing(brew)
    setEditForm({
      dose: String(brew.dose), water: String(brew.water),
      temp: String(brew.temp), grind: String(brew.grind),
      bloom_time: String(brew.bloom_time || 0),
      water_recipe: brew.water_recipe || waterRecipes[0],
      grinder_rpm: brew.grinder_rpm || 'manual',
      notes: brew.notes || '',
      verdict: brew.verdict || '',
      pours: (brew.pours || []).map(p => String(typeof p === 'object' ? p.water : p)),
    })
  }

  const handleBrewEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !editForm || !onUpdateBrew) return
    const pourObjects = editForm.pours.map((w, i): Pour => {
      const orig = (editing.pours || [])[i]
      return typeof orig === 'object' ? { ...orig, water: parseFloat(w) || 0 } : parseFloat(w) || 0
    })
    const updated = await onUpdateBrew(editing.id, {
      ...editing,
      dose: parseFloat(editForm.dose), water: parseFloat(editForm.water),
      temp: parseFloat(editForm.temp), grind: parseFloat(editForm.grind),
      bloom_time: parseInt(editForm.bloom_time),
      water_recipe: editForm.water_recipe,
      grinder_rpm: editForm.grinder_rpm,
      notes: editForm.notes,
      verdict: editForm.verdict as Verdict | '',
      pours: pourObjects,
      num_pours: pourObjects.length,
    })
    setSelectedBrew(updated)
    setEditing(null)
  }

  const setEditVerdict = (v: string) => setEditForm(f => ({ ...f!, verdict: f!.verdict === v ? '' : v }))

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Brew history.</h1>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 'auto' }}>
          {beanFilter ? `${filtered.length} / ${brews.length}` : brews.length}
        </span>
        {beans.length > 0 && (
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 12 }}>
            <select value={beanFilter} onChange={e => changeBeanFilter(e.target.value)}
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', width: 148, paddingRight: 18, appearance: 'none', WebkitAppearance: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <option value=''>All beans</option>
              {beans.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 6, pointerEvents: 'none', fontSize: 9, color: 'var(--text-3)', lineHeight: 1 }}>▾</span>
          </div>
        )}
        <select value={perPage} onChange={e => changePerPage(Number(e.target.value))}
          style={{ marginLeft: 12, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 8 }}>
          {filtered.length === 0 ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {beanFilter ? `No brews found for ${beanFilter}.` : <><span>No brews logged yet.</span><br /><span>Switch to Filter in Dial-in to record one.</span></>}
              </div>
            </div>
          ) : paginated.map((b, i) => (
            <BrewCard key={b.id} brew={b} index={page * perPage + i} total={filtered.length}
              active={selectedBrew === b} onClick={() => setSelectedBrew(b === selectedBrew ? null : b)} units={units} />
          ))}
          {totalPages > 1 && (
            <div className="row" style={{ justifyContent: 'center', gap: 8, paddingTop: 4 }}>
              <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prev</button>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center' }}>{page + 1} / {totalPages}</span>
              <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next →</button>
            </div>
          )}
        </div>

        {selectedBrew ? (
          <div className="card" style={{ position: 'sticky', top: 0 }}>
            <div className="card-head">
              <span className="card-title">Brew #{brews.length - brews.indexOf(selectedBrew)}</span>
              <span className="card-more">{selectedBrew.date}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 30, lineHeight: 1 }}>{selectedBrew.bean}</div>
            <div className="text-muted mono" style={{ fontSize: 10, marginTop: 4 }}>{selectedBrew.roaster?.toUpperCase()}</div>
            <div className="divider" />
            <div className="grid grid-2" style={{ gap: 4 }}>
              <Meta k="Dose"         v={`${U.m(selectedBrew.dose)}${U.mU()}`} />
              <Meta k="Brew"         v={`${U.m(selectedBrew.water)}${U.mU()}`} />
              <Meta k="Time"         v={selectedBrew.time ? `${Math.floor(selectedBrew.time / 60)}:${String(selectedBrew.time % 60).padStart(2, '0')}` : '–'} />
              <Meta k="Bloom"        v={`${selectedBrew.bloom_time}s`} />
              <Meta k="Ratio"        v={`1:${selectedBrew.water && selectedBrew.dose ? (selectedBrew.water / selectedBrew.dose).toFixed(1) : '–'}`} />
              <Meta k="Grind"        v={Number.isInteger(selectedBrew.grind) ? `${selectedBrew.grind}.0` : selectedBrew.grind} />
              <Meta k="Temp"         v={`${U.t(selectedBrew.temp)}${U.tU()}`} />
              <Meta k="Water recipe" v={selectedBrew.water_recipe || '–'} />
              <Meta k="Dripper"      v={selectedBrew.dripper || '–'} />
              <Meta k="Grinder"      v={selectedBrew.grinder_model || '–'} />
              <Meta k="RPM"          v={selectedBrew.grinder_rpm || '–'} />
            </div>
            {selectedBrew.pours?.length > 0 && (
              <>
                <div className="divider" />
                <div className="micro" style={{ marginBottom: 8 }}>Pour breakdown</div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {selectedBrew.pours.map((p, i) => (
                    <div key={i} style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 1 }}>
                        {i === 0 ? 'Bloom' : `Pour ${i + 1}`}
                      </div>
                      <div className="mono" style={{ fontSize: 13, color: i === 0 ? 'var(--sour)' : 'var(--crema)' }}>
                        {U.m(p as number)}{U.mU()}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
              <FlavorRadar taste={selectedBrew.taste} size={200} />
            </div>
            {selectedBrew.notes && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>
                "{selectedBrew.notes}"
              </div>
            )}
            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {['good','under','over','bad'].includes(selectedBrew.verdict) && (
                  <span className={`badge ${selectedBrew.verdict}`}>{selectedBrew.verdict}</span>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {onUpdateBrew && (
                  <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => openEdit(selectedBrew)}>
                    <Ico name="pencil" size={12} /> Edit
                  </button>
                )}
                {onReplicate && (
                  <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => onReplicate(selectedBrew)}>
                    <Ico name="history" size={12} /> Re-brew
                  </button>
                )}
                {onFavorite && (
                  <button className="ghost-btn"
                    style={{ fontSize: 11, ...(selectedBrew.favorited ? { color: 'var(--crema)', borderColor: 'var(--crema)' } : {}) }}
                    title={selectedBrew.favorited ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={async () => { const u = await onFavorite(selectedBrew.id, !selectedBrew.favorited); setSelectedBrew(u) }}>
                    <Ico name="star" size={12} style={selectedBrew.favorited ? { fill: 'currentColor' } : {}} />
                  </button>
                )}
                {onDeleteBrew && (
                  <button className="ghost-btn" style={{ color: 'var(--bitter)', borderColor: 'var(--bitter)', fontSize: 11 }}
                    onClick={() => handleDelete(selectedBrew.id)}>
                    <Ico name="trash" size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div style={{ textAlign: 'center', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              Select a brew to inspect
            </div>
          </div>
        )}
      </div>

      {editing && editForm && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit brew</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setEditing(null)}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body stack" onSubmit={handleBrewEdit}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Dose ({U.mU()})</label>
                  <input type="number" step="0.1" value={editForm.dose} onChange={e => setEditForm(f => ({ ...f!, dose: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Brew ({U.mU()})</label>
                  <input type="number" step="1" value={editForm.water} onChange={e => setEditForm(f => ({ ...f!, water: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Temp ({U.tU()})</label>
                  <input type="number" step="1" value={editForm.temp} onChange={e => setEditForm(f => ({ ...f!, temp: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Grind</label>
                  <input type="number" step="0.1" value={editForm.grind} onChange={e => setEditForm(f => ({ ...f!, grind: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Bloom (s)</label>
                  <input type="number" step="1" value={editForm.bloom_time} onChange={e => setEditForm(f => ({ ...f!, bloom_time: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Water recipe</label>
                  <select value={editForm.water_recipe} onChange={e => setEditForm(f => ({ ...f!, water_recipe: e.target.value }))}>
                    {waterRecipes.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Grinder RPM</label>
                  <select value={editForm.grinder_rpm} onChange={e => setEditForm(f => ({ ...f!, grinder_rpm: e.target.value }))}>
                    {RPM_OPTIONS.map(r => <option key={r} value={r}>{r === 'manual' ? 'Manual' : `${r} RPM`}</option>)}
                  </select>
                </div>
              </div>
              {editForm.pours.length > 0 && (
                <div>
                  <div className="micro" style={{ marginBottom: 6 }}>Pours ({U.mU()})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${editForm.pours.length}, 1fr)`, gap: 8 }}>
                    {editForm.pours.map((w, i) => (
                      <div key={i} className="dial-input" style={{ minWidth: 0 }}>
                        <label style={{ fontSize: 10 }}>{i === 0 ? 'Bloom' : `Pour ${i + 1}`}</label>
                        <input type="number" step="5" value={w}
                          onChange={e => setEditForm(f => {
                            const pours = [...f!.pours]
                            pours[i] = e.target.value
                            return { ...f!, pours }
                          })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="dial-input">
                <label>Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f!, notes: e.target.value }))} style={{ height: 60 }} />
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <div className="micro">Verdict</div>
                {[['good','--good'],['under','--under'],['over','--over'],['bad','--bad']].map(([v, cv]) => (
                  <button type="button" key={v}
                    className={`ghost-btn${editForm.verdict === v ? ' active' : ''}`}
                    style={editForm.verdict === v ? { borderColor: `var(${cv})`, color: `var(${cv})` } : {}}
                    onClick={() => setEditVerdict(v)}
                  >{v}</button>
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="ghost-btn" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="primary-btn">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
