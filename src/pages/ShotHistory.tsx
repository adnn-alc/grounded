import { useState, useEffect, type FormEvent } from 'react'
import { Meta, ShotCard } from '../components/ui.tsx'
import { FlavorRadar, FlavSliders } from '../components/charts.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.ts'
import { RPM_OPTIONS } from '../data/grinderRpm.ts'
import type { Bean, Gear, Shot, ShotInput, Taste, Units, Verdict } from '../types.ts'
import { beanLabel } from '../data/beans.ts'

// ── SHOT HISTORY ─────────────────────────────────────────────────────
interface ShotHistoryProps {
  shots:              Shot[]
  beans?:             Bean[]
  gear?:              Gear[]
  units:              Units
  waterRecipes?:      string[]
  brewModes?:         string[]
  onDelete?:          (id: string) => Promise<void>
  onUpdateShot?:      (id: string, data: ShotInput) => Promise<Shot>
  initialSelectedId?: string | null
  onReplicate?:       (shot: Shot) => void
  onFavorite?:        (id: string, val: boolean) => Promise<Shot>
}

/** The edit form keeps numbers as the inputs' strings until saved */
interface ShotEditForm {
  dose: string; yield: string; time: string; preinf: string; temp: string; grind: string
  water_recipe: string; grinder_rpm: string; basket: string; brew_mode: string
  bean_id: string; machine: string; grinder_model: string   // bean_id '' = the shot's bean isn't linked
  taste: Taste
  notes: string
  verdict: string
}

export function ShotHistory({ shots, beans = [], gear = [], units, waterRecipes = DEFAULT_WATER_RECIPES, brewModes = [], onDelete, onUpdateShot, initialSelectedId, onReplicate, onFavorite }: ShotHistoryProps) {
  const U = useUnits(units)
  const gearOpts = (re: RegExp) => gear.filter(g => re.test(g.kind) && g.status !== 'Retired').map(g => g.name)
  const machineOpts = gearOpts(/machine/i)
  const grinderOpts = gearOpts(/grinder/i)
  const basketOpts  = gearOpts(/basket/i)
  // Keep the shot's saved value selectable even if that bean/gear is archived or retired
  const withCurrent = (opts: string[], cur: string) => cur && !opts.includes(cur) ? [cur, ...opts] : opts
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null)
  const [editing, setEditing] = useState<Shot | null>(null)
  const [editForm, setEditForm] = useState<ShotEditForm | null>(null)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(0)
  const [beanFilter, setBeanFilter] = useState('')

  const filtered = beanFilter ? shots.filter(s => s.bean === beanFilter) : shots
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = filtered.slice(page * perPage, (page + 1) * perPage)

  const changePerPage = (n: number) => { setPerPage(n); setPage(0); setSelectedShot(null) }
  const changeBeanFilter = (b: string) => { setBeanFilter(b); setPage(0); setSelectedShot(null) }

  useEffect(() => {
    if (initialSelectedId) {
      const idx = shots.findIndex(s => s.id === initialSelectedId)
      if (idx !== -1) {
        setSelectedShot(shots[idx])
        setPage(Math.floor(idx / perPage))
      }
    }
  }, [initialSelectedId])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shot?')) return
    await onDelete?.(id)
    setSelectedShot(null)
  }

  const openEdit = (shot: Shot) => {
    setEditing(shot)
    setEditForm({
      dose: String(shot.dose), yield: String(shot.yield),
      time: String(shot.time), preinf: String(shot.preinf || 0),
      temp: String(shot.temp), grind: String(shot.grind),
      water_recipe: shot.water_recipe || waterRecipes[0],
      grinder_rpm: shot.grinder_rpm || 'manual',
      basket: shot.basket || '',
      brew_mode: shot.brew_mode || '',
      bean_id: shot.bean_id ?? '',
      machine: shot.machine || '',
      grinder_model: shot.grinder_model || '',
      taste: { ...shot.taste },
      notes: shot.notes || '',
      verdict: shot.verdict || '',
    })
  }

  const handleShotEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !editForm || !onUpdateShot) return
    const tasteVals = Object.values(editForm.taste)
    const updated = await onUpdateShot(editing.id, {
      ...editing,
      // The server fills in the bean's name and roaster from bean_id
      bean_id: editForm.bean_id || null,
      machine: editForm.machine || null,
      grinder_model: editForm.grinder_model || null,
      taste: editForm.taste,
      rating: parseFloat((tasteVals.reduce((a, b) => a + (b || 0), 0) / tasteVals.length).toFixed(1)),
      dose: parseFloat(editForm.dose), yield: parseFloat(editForm.yield),
      time: parseInt(editForm.time), preinf: parseInt(editForm.preinf),
      temp: parseFloat(editForm.temp), grind: parseFloat(editForm.grind),
      water_recipe: editForm.water_recipe,
      grinder_rpm: editForm.grinder_rpm,
      basket: editForm.basket || null,
      brew_mode: editForm.brew_mode || null,
      notes: editForm.notes,
      verdict: editForm.verdict as Verdict | '',
    })
    setSelectedShot(updated)
    setEditing(null)
  }

  const setEditVerdict = (v: string) => setEditForm(f => ({ ...f!, verdict: f!.verdict === v ? '' : v }))

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Shot history.</h1>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 'auto' }}>
          {beanFilter ? `${filtered.length} / ${shots.length}` : shots.length}
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
                {beanFilter ? `No shots found for ${beanFilter}.` : 'No shots logged yet.'}
              </div>
            </div>
          ) : paginated.map((s, i) => (
            <ShotCard key={s.id} shot={s} index={page * perPage + i} total={filtered.length}
              active={selectedShot === s} onClick={() => setSelectedShot(s === selectedShot ? null : s)} units={units} />
          ))}
          {totalPages > 1 && (
            <div className="row" style={{ justifyContent: 'center', gap: 8, paddingTop: 4 }}>
              <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Prev</button>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center' }}>{page + 1} / {totalPages}</span>
              <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next →</button>
            </div>
          )}
        </div>

        {selectedShot ? (
          <div className="card" style={{ position: 'sticky', top: 0 }}>
            <div className="card-head">
              <span className="card-title">Shot #{shots.length - shots.indexOf(selectedShot)}</span>
              <span className="card-more">{selectedShot.date}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 30, lineHeight: 1 }}>{selectedShot.bean}</div>
            <div className="text-muted mono" style={{ fontSize: 10, marginTop: 4 }}>{selectedShot.roaster?.toUpperCase()}</div>
            <div className="divider" />
            <div className="grid grid-2" style={{ gap: 4 }}>
              <Meta k="Dose"    v={`${U.m(selectedShot.dose)}${U.mU()}`} />
              <Meta k="Yield"   v={`${U.m(selectedShot.yield)}${U.mU()}`} />
              <Meta k="Time"    v={`${selectedShot.time}s`} />
              <Meta k="Pre-inf" v={selectedShot.preinf != null ? `${selectedShot.preinf}s` : '–'} />
              <Meta k="Ratio"   v={`1:${(selectedShot.yield / selectedShot.dose).toFixed(2)}`} />
              <Meta k="Grind"   v={Number.isInteger(selectedShot.grind) ? `${selectedShot.grind}.0` : selectedShot.grind} />
              <Meta k="Temp"    v={`${U.t(selectedShot.temp)}${U.tU()}`} />
              <Meta k="Water recipe" v={selectedShot.water_recipe || '–'} />
              <Meta k="Machine" v={selectedShot.machine || '–'} />
              <Meta k="Basket"  v={selectedShot.basket || '–'} />
              <Meta k="Grinder" v={selectedShot.grinder_model || '–'} />
              <Meta k="RPM"     v={selectedShot.grinder_rpm || '–'} />
              {selectedShot.brew_mode && <Meta k="Brew mode" v={selectedShot.brew_mode} />}
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
              <FlavorRadar taste={selectedShot.taste} size={200} />
            </div>
            {selectedShot.notes && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>
                "{selectedShot.notes}"
              </div>
            )}
            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {['good','under','over','bad'].includes(selectedShot.verdict) && (
                  <span className={`badge ${selectedShot.verdict}`}>{selectedShot.verdict}</span>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {onUpdateShot && (
                  <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => openEdit(selectedShot)}>
                    <Ico name="pencil" size={12} /> Edit
                  </button>
                )}
                {onReplicate && (
                  <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => onReplicate(selectedShot)}>
                    <Ico name="history" size={12} /> Re-pull
                  </button>
                )}
                {onFavorite && (
                  <button className="ghost-btn"
                    style={{ fontSize: 11, ...(selectedShot.favorited ? { color: 'var(--crema)', borderColor: 'var(--crema)' } : {}) }}
                    title={selectedShot.favorited ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={async () => { const u = await onFavorite(selectedShot.id, !selectedShot.favorited); setSelectedShot(u) }}>
                    <Ico name="star" size={12} style={selectedShot.favorited ? { fill: 'currentColor' } : {}} />
                  </button>
                )}
                {onDelete && (
                  <button className="ghost-btn" style={{ color: 'var(--bitter)', borderColor: 'var(--bitter)', fontSize: 11 }}
                    onClick={() => handleDelete(selectedShot.id)}>
                    <Ico name="trash" size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
            <div style={{ textAlign: 'center', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              Select a shot to inspect
            </div>
          </div>
        )}
      </div>

      {editing && editForm && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Edit shot</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setEditing(null)}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body stack" onSubmit={handleShotEdit}>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Dose ({U.mU()})</label>
                  <input type="number" step="0.1" value={editForm.dose} onChange={e => setEditForm(f => ({ ...f!, dose: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Yield ({U.mU()})</label>
                  <input type="number" step="0.1" value={editForm.yield} onChange={e => setEditForm(f => ({ ...f!, yield: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Time (s)</label>
                  <input type="number" step="1" value={editForm.time} onChange={e => setEditForm(f => ({ ...f!, time: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Pre-inf (s)</label>
                  <input type="number" step="1" value={editForm.preinf} onChange={e => setEditForm(f => ({ ...f!, preinf: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Temp ({U.tU()})</label>
                  <input type="number" step="1" value={editForm.temp} onChange={e => setEditForm(f => ({ ...f!, temp: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Grind</label>
                  <input type="number" step="0.1" value={editForm.grind} onChange={e => setEditForm(f => ({ ...f!, grind: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Beans</label>
                  <select value={editForm.bean_id} onChange={e => setEditForm(f => ({ ...f!, bean_id: e.target.value }))}>
                    {/* Keep the shot's own bean selectable even if it's archived, deleted or not linked */}
                    {editing && !beans.some(b => b.id === editForm.bean_id) && (
                      <option value={editForm.bean_id}>{editing.bean || '–'}</option>
                    )}
                    {beans.map(b => <option key={b.id} value={b.id}>{beanLabel(b, beans)}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Water recipe</label>
                  <select value={editForm.water_recipe} onChange={e => setEditForm(f => ({ ...f!, water_recipe: e.target.value }))}>
                    {withCurrent(waterRecipes, editForm.water_recipe).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Machine</label>
                  <select value={editForm.machine} onChange={e => setEditForm(f => ({ ...f!, machine: e.target.value }))}>
                    <option value="">–</option>
                    {withCurrent(machineOpts, editForm.machine).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Basket</label>
                  <select value={editForm.basket} onChange={e => setEditForm(f => ({ ...f!, basket: e.target.value }))}>
                    <option value="">–</option>
                    {withCurrent(basketOpts, editForm.basket).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Grinder</label>
                  <select value={editForm.grinder_model} onChange={e => setEditForm(f => ({ ...f!, grinder_model: e.target.value }))}>
                    <option value="">–</option>
                    {withCurrent(grinderOpts, editForm.grinder_model).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Grinder RPM</label>
                  <select value={editForm.grinder_rpm} onChange={e => setEditForm(f => ({ ...f!, grinder_rpm: e.target.value }))}>
                    {withCurrent(RPM_OPTIONS, editForm.grinder_rpm).map(r => <option key={r} value={r}>{r === 'manual' ? 'Manual' : `${r} RPM`}</option>)}
                  </select>
                </div>
                {(brewModes.length > 0 || editForm.brew_mode) && (
                  <div className="dial-input">
                    <label>Brew mode</label>
                    <select value={editForm.brew_mode} onChange={e => setEditForm(f => ({ ...f!, brew_mode: e.target.value }))}>
                      <option value="">–</option>
                      {withCurrent(brewModes, editForm.brew_mode).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="dial-input">
                <label>Taste</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start', marginTop: 6 }}>
                  <FlavSliders taste={editForm.taste} onChange={t => setEditForm(f => ({ ...f!, taste: t }))} />
                  <FlavorRadar taste={editForm.taste} size={140} />
                </div>
              </div>
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
