import { useState, useRef, useEffect } from 'react'

const RPM_OPTIONS = ['manual', '500', '600', '700', '800', '900', '1000', '1100', '1200', '1300', '1400', '1500', '1600']
import { Meta, ShotCard, BrewCard } from '../components/ui.jsx'
import { FlavorRadar, FlavSliders, BarChart } from '../components/charts.jsx'
import { StatCard } from '../components/ui.jsx'
import { useUnits } from '../hooks/useUnits.js'
import Ico from '../components/Ico.jsx'
import CoffeeMap from '../components/CoffeeMap.jsx'
import { BeanDosesModal } from '../components/BeanDoses.jsx'
import { BREW_MODES } from '../data/brewModes.js'
import { DEFAULT_WATER_RECIPES } from '../data/waterRecipes.js'

// ── SHOT HISTORY ─────────────────────────────────────────────────────
export function ShotHistory({ shots, beans = [], gear = [], units, waterRecipes = DEFAULT_WATER_RECIPES, onDelete, onUpdateShot, initialSelectedId, onReplicate, onFavorite }) {
  const U = useUnits(units)
  const gearOpts = (re) => gear.filter(g => re.test(g.kind) && g.status !== 'Retired').map(g => g.name)
  const machineOpts = gearOpts(/machine/i)
  const grinderOpts = gearOpts(/grinder/i)
  const basketOpts  = gearOpts(/basket/i)
  const beanOpts    = beans.map(b => b.name)
  // Keep the shot's saved value selectable even if that bean/gear is archived or retired
  const withCurrent = (opts, cur) => cur && !opts.includes(cur) ? [cur, ...opts] : opts
  const [selectedShot, setSelectedShot] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(0)
  const [beanFilter, setBeanFilter] = useState('')

  const filtered = beanFilter ? shots.filter(s => s.bean === beanFilter) : shots
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = filtered.slice(page * perPage, (page + 1) * perPage)

  const changePerPage = (n) => { setPerPage(n); setPage(0); setSelectedShot(null) }
  const changeBeanFilter = (b) => { setBeanFilter(b); setPage(0); setSelectedShot(null) }

  useEffect(() => {
    if (initialSelectedId) {
      const idx = shots.findIndex(s => s.id === initialSelectedId)
      if (idx !== -1) {
        setSelectedShot(shots[idx])
        setPage(Math.floor(idx / perPage))
      }
    }
  }, [initialSelectedId])

  const handleDelete = async (id) => {
    if (!confirm('Delete this shot?')) return
    await onDelete(id)
    setSelectedShot(null)
  }

  const openEdit = (shot) => {
    setEditing(shot)
    setEditForm({
      dose: String(shot.dose), yield: String(shot.yield),
      time: String(shot.time), preinf: String(shot.preinf || 0),
      temp: String(shot.temp), grind: String(shot.grind),
      water_recipe: shot.water_recipe || waterRecipes[0],
      grinder_rpm: shot.grinder_rpm || 'manual',
      basket: shot.basket || '',
      brew_mode: shot.brew_mode || '',
      bean: shot.bean || '',
      machine: shot.machine || '',
      grinder_model: shot.grinder_model || '',
      taste: { ...shot.taste },
      notes: shot.notes || '',
      verdict: shot.verdict || '',
    })
  }

  const handleShotEdit = async (e) => {
    e.preventDefault()
    const tasteVals = Object.values(editForm.taste)
    const updated = await onUpdateShot(editing.id, {
      ...editing,
      bean: editForm.bean,
      roaster: editForm.bean === editing.bean ? editing.roaster : (beans.find(b => b.name === editForm.bean)?.roaster || ''),
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
      verdict: editForm.verdict,
    })
    setSelectedShot(updated)
    setEditing(null)
  }

  const setEditVerdict = (v) => setEditForm(f => ({ ...f, verdict: f.verdict === v ? '' : v }))

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
              <Meta k="Brew mode" v={selectedShot.brew_mode || '–'} />
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
                  <input type="number" step="0.1" value={editForm.dose} onChange={e => setEditForm(f => ({ ...f, dose: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Yield ({U.mU()})</label>
                  <input type="number" step="0.1" value={editForm.yield} onChange={e => setEditForm(f => ({ ...f, yield: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Time (s)</label>
                  <input type="number" step="1" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Pre-inf (s)</label>
                  <input type="number" step="1" value={editForm.preinf} onChange={e => setEditForm(f => ({ ...f, preinf: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Temp ({U.tU()})</label>
                  <input type="number" step="1" value={editForm.temp} onChange={e => setEditForm(f => ({ ...f, temp: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Grind</label>
                  <input type="number" step="0.1" value={editForm.grind} onChange={e => setEditForm(f => ({ ...f, grind: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Beans</label>
                  <select value={editForm.bean} onChange={e => setEditForm(f => ({ ...f, bean: e.target.value }))}>
                    {withCurrent(beanOpts, editForm.bean).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Water recipe</label>
                  <select value={editForm.water_recipe} onChange={e => setEditForm(f => ({ ...f, water_recipe: e.target.value }))}>
                    {withCurrent(waterRecipes, editForm.water_recipe).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Machine</label>
                  <select value={editForm.machine} onChange={e => setEditForm(f => ({ ...f, machine: e.target.value }))}>
                    <option value="">–</option>
                    {withCurrent(machineOpts, editForm.machine).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Basket</label>
                  <select value={editForm.basket} onChange={e => setEditForm(f => ({ ...f, basket: e.target.value }))}>
                    <option value="">–</option>
                    {withCurrent(basketOpts, editForm.basket).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Grinder</label>
                  <select value={editForm.grinder_model} onChange={e => setEditForm(f => ({ ...f, grinder_model: e.target.value }))}>
                    <option value="">–</option>
                    {withCurrent(grinderOpts, editForm.grinder_model).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Grinder RPM</label>
                  <select value={editForm.grinder_rpm} onChange={e => setEditForm(f => ({ ...f, grinder_rpm: e.target.value }))}>
                    {withCurrent(RPM_OPTIONS, editForm.grinder_rpm).map(r => <option key={r} value={r}>{r === 'manual' ? 'Manual' : `${r} RPM`}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Brew mode</label>
                  <select value={editForm.brew_mode} onChange={e => setEditForm(f => ({ ...f, brew_mode: e.target.value }))}>
                    <option value="">–</option>
                    {withCurrent(BREW_MODES, editForm.brew_mode).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="dial-input">
                <label>Taste</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'start', marginTop: 6 }}>
                  <FlavSliders taste={editForm.taste} onChange={t => setEditForm(f => ({ ...f, taste: t }))} />
                  <FlavorRadar taste={editForm.taste} size={140} />
                </div>
              </div>
              <div className="dial-input">
                <label>Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={{ height: 60 }} />
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

// ── BREW HISTORY ──────────────────────────────────────────────────────
export function BrewHistory({ brews = [], beans = [], units, waterRecipes = DEFAULT_WATER_RECIPES, onDeleteBrew, onUpdateBrew, initialSelectedId, onReplicate, onFavorite }) {
  const U = useUnits(units)
  const [selectedBrew, setSelectedBrew] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(0)
  const [beanFilter, setBeanFilter] = useState('')

  const filtered = beanFilter ? brews.filter(b => b.bean === beanFilter) : brews
  const totalPages = Math.ceil(filtered.length / perPage)
  const paginated  = filtered.slice(page * perPage, (page + 1) * perPage)

  const changePerPage = (n) => { setPerPage(n); setPage(0); setSelectedBrew(null) }
  const changeBeanFilter = (b) => { setBeanFilter(b); setPage(0); setSelectedBrew(null) }

  useEffect(() => {
    if (initialSelectedId) {
      const idx = brews.findIndex(b => b.id === initialSelectedId)
      if (idx !== -1) {
        setSelectedBrew(brews[idx])
        setPage(Math.floor(idx / perPage))
      }
    }
  }, [initialSelectedId])

  const handleDelete = async (id) => {
    if (!confirm('Delete this brew?')) return
    await onDeleteBrew(id)
    setSelectedBrew(null)
  }

  const openEdit = (brew) => {
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

  const handleBrewEdit = async (e) => {
    e.preventDefault()
    const pourObjects = editForm.pours.map((w, i) => {
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
      verdict: editForm.verdict,
      pours: pourObjects,
      num_pours: pourObjects.length,
    })
    setSelectedBrew(updated)
    setEditing(null)
  }

  const setEditVerdict = (v) => setEditForm(f => ({ ...f, verdict: f.verdict === v ? '' : v }))

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
                        {U.m(p)}{U.mU()}
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
                  <input type="number" step="0.1" value={editForm.dose} onChange={e => setEditForm(f => ({ ...f, dose: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Brew ({U.mU()})</label>
                  <input type="number" step="1" value={editForm.water} onChange={e => setEditForm(f => ({ ...f, water: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Temp ({U.tU()})</label>
                  <input type="number" step="1" value={editForm.temp} onChange={e => setEditForm(f => ({ ...f, temp: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Grind</label>
                  <input type="number" step="0.1" value={editForm.grind} onChange={e => setEditForm(f => ({ ...f, grind: e.target.value }))} />
                </div>
                <div className="dial-input">
                  <label>Bloom (s)</label>
                  <input type="number" step="1" value={editForm.bloom_time} onChange={e => setEditForm(f => ({ ...f, bloom_time: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div className="dial-input">
                  <label>Water recipe</label>
                  <select value={editForm.water_recipe} onChange={e => setEditForm(f => ({ ...f, water_recipe: e.target.value }))}>
                    {waterRecipes.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="dial-input">
                  <label>Grinder RPM</label>
                  <select value={editForm.grinder_rpm} onChange={e => setEditForm(f => ({ ...f, grinder_rpm: e.target.value }))}>
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
                            const pours = [...f.pours]
                            pours[i] = e.target.value
                            return { ...f, pours }
                          })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="dial-input">
                <label>Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={{ height: 60 }} />
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

// ── BEANS ─────────────────────────────────────────────────────────────
const EMPTY_BEAN = {
  name: '', roaster: '', origin: '', process: '', variety: '',
  roast_date: '', roast: '', altitude: '', notes: '', weight: '', remaining: '', price: '',
}

export function Beans({ beans, gear = [], units, onSaveBean, onUpdateBean, onArchiveBean }) {
  const U = useUnits(units)
  const stockColor = { good: 'var(--good)', low: 'var(--sweet)', critical: 'var(--bitter)' }
  const basketOpts = gear.filter(g => /basket/i.test(g.kind) && g.status !== 'Retired').map(g => g.name)
  const [adding, setAdding]   = useState(false)
  const [editing, setEditing] = useState(null)  // bean being edited
  const [dosesFor, setDosesFor] = useState(null) // bean whose basket doses are open
  const [form, setForm]       = useState(EMPTY_BEAN)
  const [saving, setSaving]   = useState(false)

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // When correcting a bag's weight, keep what's already been used deducted: remaining = new weight − used
  const setWeight = (v) => setForm(f => {
    if (!editing) return { ...f, weight: v }
    const used = Math.max(0, (editing.weight || 0) - (editing.remaining || 0))
    const w = parseFloat(v)
    return { ...f, weight: v, remaining: w > 0 ? String(Math.max(0, +(w - used).toFixed(1))) : f.remaining }
  })

  const openAdd = () => { setForm(EMPTY_BEAN); setAdding(true) }

  const openEdit = (b) => {
    setForm({
      name:      b.name,
      roaster:   b.roaster,
      origin:    b.origin,
      process:   b.process,
      variety:   b.variety,
      roast_date: b.roast_date || '',
      roast:     b.roast,
      altitude:  b.altitude,
      notes:     Array.isArray(b.notes) ? b.notes.join(', ') : b.notes,
      weight:    b.weight,
      remaining: b.remaining,
      price:     b.price || '',
    })
    setEditing(b)
  }

  const closeModal = () => { setAdding(false); setEditing(null); setForm(EMPTY_BEAN) }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSaveBean({
        id: 'bean-' + Date.now(),
        name:       form.name.trim(),
        roaster:    form.roaster.trim(),
        origin:     form.origin.trim(),
        process:    form.process.trim(),
        variety:    form.variety.trim(),
        roast_date: form.roast_date.trim(),
        roast:      form.roast.trim(),
        altitude:   form.altitude.trim(),
        notes:      form.notes.split(',').map(n => n.trim()).filter(Boolean),
        weight:     parseFloat(form.weight)    || 0,
        remaining:  parseFloat(form.weight)    || 0,
        price:      parseFloat(form.price)     || 0,
        stock:      'good',
      })
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const weight    = parseFloat(form.weight) || 0
    const remaining = Math.min(weight || Infinity, Math.max(0, parseFloat(form.remaining) || 0))
    const pct       = weight > 0 ? remaining / weight : 1
    setSaving(true)
    try {
      await onUpdateBean(editing.id, {
        ...editing,
        name:       form.name.trim(),
        roaster:    form.roaster.trim(),
        origin:     form.origin.trim(),
        process:    form.process.trim(),
        variety:    form.variety.trim(),
        roast_date: form.roast_date.trim(),
        roast:      form.roast.trim(),
        altitude:   form.altitude.trim(),
        notes:      form.notes.split(',').map(n => n.trim()).filter(Boolean),
        weight,
        remaining,
        stock:      pct > 0.25 ? 'good' : pct > 0.1 ? 'low' : 'critical',
        price:      parseFloat(form.price)     || 0,
      })
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (id) => {
    if (!confirm('Archive this bean? It will move to the bean archive.')) return
    await onArchiveBean(id)
  }

  const isEditing = !!editing
  const showModal = adding || isEditing

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Beans.</h1>
        <span className="page-sub">{beans.length} active</span>
        <button className="primary-btn" style={{ marginLeft: 'auto' }} onClick={openAdd}>
          <Ico name="plus" size={13} /> Add bean
        </button>
      </div>

      <div className="grid grid-2">
        {beans.map(b => {
          const pct = (b.remaining / b.weight) * 100
          return (
            <div key={b.id} className="bean-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, lineHeight: 1 }}>{b.name}</div>
                  <div className="text-muted mono" style={{ fontSize: 10, marginTop: 4, letterSpacing: '0.08em' }}>
                    {b.roaster.toUpperCase()} · {b.origin.toUpperCase()}
                  </div>
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: b.doses?.length ? 'var(--crema)' : undefined }}
                    onClick={() => setDosesFor(b)} title="Basket doses">
                    <Ico name="scale" size={11} />
                  </button>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent' }}
                    onClick={() => openEdit(b)} title="Edit bean">
                    <Ico name="pencil" size={11} />
                  </button>
                  <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: 'oklch(0.70 0.16 55)' }}
                    onClick={() => handleArchive(b.id)} title="Archive bean">
                    <Ico name="download" size={11} />
                  </button>
                </div>
              </div>

              <div className="grid grid-3" style={{ gap: 4 }}>
                <Meta k="Process"  v={b.process} />
                <Meta k="Roast"    v={b.roast} />
                <Meta k="Variety"  v={b.variety} />
                <Meta k="Altitude" v={b.altitude} />
                <Meta k="Roasted"  v={b.roast_date} />
                <Meta k="Price"    v={b.price ? `€${b.price % 1 === 0 ? b.price : b.price.toFixed(2)}` : null} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div className="micro">Remaining</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {U.m(b.remaining)}{U.mU()} / {U.m(b.weight)}{U.mU()}
                  </div>
                </div>
                <div className="bean-stock-bar">
                  <div className="bean-stock-fill" style={{ width: `${pct.toFixed(1)}%`, background: stockColor[b.stock] || 'var(--crema)' }} />
                </div>
              </div>

              <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                {b.notes.map(n => <span key={n} className="badge">{n}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{isEditing ? 'Edit bean' : 'Add bean'}</h2>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={closeModal}>
                <Ico name="x" size={14} />
              </button>
            </div>
            <form className="modal-body scroll" onSubmit={isEditing ? handleEdit : handleAdd}>
              <div className="stack" style={{ gap: 18 }}>
                <div className="grid grid-2" style={{ gap: 12 }}>
                  <div className="dial-input" style={{ gridColumn: '1 / -1' }}>
                    <label>Bean name</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Idido"
                      value={form.name} onChange={e => setField('name', e.target.value)} required />
                  </div>
                  <div className="dial-input">
                    <label>Roaster</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Tim Wendelboe"
                      value={form.roaster} onChange={e => setField('roaster', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Origin</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Ethiopia · Yirgacheffe"
                      value={form.origin} onChange={e => setField('origin', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Process</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Washed"
                      value={form.process} onChange={e => setField('process', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Variety</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Heirloom"
                      value={form.variety} onChange={e => setField('variety', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Roast level</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Light"
                      value={form.roast} onChange={e => setField('roast', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Roast date</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. 2026-04-10"
                      value={form.roast_date} onChange={e => setField('roast_date', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Altitude</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. 2100m"
                      value={form.altitude} onChange={e => setField('altitude', e.target.value)} />
                  </div>
                  <div className="dial-input">
                    <label>Weight (g)</label>
                    <input type="number" step="1" style={{ fontSize: 14, width: '100%' }} placeholder="250"
                      value={form.weight} onChange={e => setWeight(e.target.value)} />
                  </div>
                  {isEditing && (
                    <div className="dial-input">
                      <label>Remaining (g)</label>
                      <input type="number" step="1" style={{ fontSize: 14, width: '100%' }}
                        value={form.remaining} onChange={e => setField('remaining', e.target.value)} />
                    </div>
                  )}
                  <div className="dial-input">
                    <label>Price (€)</label>
                    <input type="number" step="0.01" style={{ fontSize: 14, width: '100%' }} placeholder="24.00"
                      value={form.price} onChange={e => setField('price', e.target.value)} />
                  </div>
                  <div className="dial-input" style={{ gridColumn: '1 / -1' }}>
                    <label>Flavor notes (comma-separated)</label>
                    <input style={{ fontSize: 14, width: '100%' }} placeholder="e.g. Bergamot, Jasmine, Lemon curd"
                      value={form.notes} onChange={e => setField('notes', e.target.value)} />
                  </div>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="ghost-btn" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add bean'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {dosesFor && (
        <BeanDosesModal
          bean={dosesFor}
          basketOpts={basketOpts}
          onSave={doses => onUpdateBean(dosesFor.id, { ...dosesFor, doses })}
          onClose={() => setDosesFor(null)}
        />
      )}
    </div>
  )
}

// ── ARCHIVED BEANS ────────────────────────────────────────────────────
export function ArchivedBeans({ beans, units, onUnarchive, onDelete }) {
  const U = useUnits(units)

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this bean? This cannot be undone.')) return
    await onDelete(id)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Archive.</h1>
        <span className="page-sub">{beans.length} past beans</span>
      </div>

      {beans.length === 0 && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            No archived beans yet.<br />Archive a bean from the Beans page when it's finished.
          </div>
        </div>
      )}

      <div className="grid grid-2">
        {beans.map(b => (
          <div key={b.id} className="bean-card" style={{ opacity: 0.85 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, lineHeight: 1 }}>{b.name}</div>
                <div className="text-muted mono" style={{ fontSize: 10, marginTop: 4, letterSpacing: '0.08em' }}>
                  {b.roaster?.toUpperCase()} · {b.origin?.toUpperCase()}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => onUnarchive(b.id)} title="Restore to active">
                  <Ico name="arrowUp" size={11} /> Restore
                </button>
                <button className="icon-btn" style={{ width: 24, height: 24, borderColor: 'transparent', color: 'oklch(0.70 0.16 55)' }}
                  onClick={() => handleDelete(b.id)} title="Delete permanently">
                  <Ico name="trash" size={11} />
                </button>
              </div>
            </div>

            <div className="grid grid-3" style={{ gap: 4 }}>
              <Meta k="Process"  v={b.process} />
              <Meta k="Roast"    v={b.roast} />
              <Meta k="Variety"  v={b.variety} />
              <Meta k="Altitude" v={b.altitude} />
              <Meta k="Roasted"  v={b.roast_date} />
              <Meta k="Price"    v={b.price ? `€${b.price % 1 === 0 ? b.price : b.price.toFixed(2)}` : null} />
            </div>

            {b.notes?.length > 0 && (
              <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                {b.notes.map(n => <span key={n} className="badge">{n}</span>)}
              </div>
            )}

            {b.archived_at && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>Archived {b.archived_at}</span>
                {b.weight > 0 && <span style={{ color: 'var(--text-3)' }}>{U.m(b.weight)}{U.mU()}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── RECIPES ───────────────────────────────────────────────────────────
const EMPTY_RECIPE = {
  name: '', type: '', dose: '', water: '', ratio: '', temp: '', time: '', grind: '', tags: '',
  steps: [{ t: '', name: '', desc: '', water: '' }],
}

export function RecipesPage({ recipes = [], units, onSaveRecipe, onUpdateRecipe, onDeleteRecipe }) {
  const U = useUnits(units)
  const [activeTimer, setActiveTimer] = useState(null)
  const [timerEl, setTimerEl]         = useState(0)
  const timerRef = useRef(null)
  const [adding,   setAdding]  = useState(false)
  const [editing,  setEditing] = useState(null)
  const [form, setForm]        = useState(EMPTY_RECIPE)
  const [saving, setSaving]    = useState(false)

  const startTimer = (id) => {
    clearInterval(timerRef.current)
    setActiveTimer(id); setTimerEl(0)
    timerRef.current = setInterval(() => setTimerEl(e => e + 1), 1000)
  }
  const stopTimer = () => { clearInterval(timerRef.current); setActiveTimer(null); setTimerEl(0) }
  useEffect(() => () => clearInterval(timerRef.current), [])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setStep  = (i, k, v) => setForm(f => {
    const steps = [...f.steps]
    steps[i] = { ...steps[i], [k]: v }
    return { ...f, steps }
  })
  const addStep    = () => setForm(f => ({ ...f, steps: [...f.steps, { t: '', name: '', desc: '', water: '' }] }))
  const removeStep = (i) => setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))

  const recipePayload = () => {
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

  const handleAdd = async (e) => {
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

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onUpdateRecipe(editing.id, recipePayload())
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (r) => {
    setForm({
      name:  r.name,
      type:  r.type  || '',
      dose:  r.dose  || '',
      water: r.water || '',
      ratio: r.ratio || '',
      temp:  r.temp  || '',
      time:  r.time  || '',
      grind: r.grind || '',
      tags:  (r.tags || []).join(', '),
      steps: r.steps?.length ? r.steps : [{ t: '', name: '', desc: '', water: '' }],
    })
    setEditing(r)
  }

  const handleDelete = async (id) => {
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

// ── GEAR ──────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['Primary', 'In use', 'Active', 'Travel', 'Retired']
const ACTIVE_STATUSES = new Set(['Primary', 'In use', 'Active'])

const EMPTY_FORM = { kind: '', name: '', meta: '', status: 'Active', owned: '', price: '' }

export function GearPage({ gear = [], onSaveGear, onUpdateGear, onDeleteGear }) {
  const [adding,  setAdding]  = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)

  const kinds = [...new Set(gear.map(g => g.kind))].sort()

  const openEdit = (g) => {
    setEditing(g)
    setForm({ kind: g.kind, name: g.name, meta: g.meta || '', status: g.status || 'Active', owned: g.owned || '', price: g.price != null ? String(g.price) : '' })
  }

  const handleAdd = async (e) => {
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

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!form.kind.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      await onUpdateGear(editing.id, { ...form, price: parseFloat(form.price) || null })
      setEditing(null)
      setForm(EMPTY_FORM)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
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
                  {g.price > 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>€{g.price % 1 === 0 ? g.price : g.price.toFixed(2)}</div>}
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

// ── STATS ─────────────────────────────────────────────────────────────

function verdictColor(v) {
  if (v === 'good')  return 'var(--good)'
  if (v === 'under') return 'var(--under)'
  if (v === 'over')  return 'var(--over)'
  if (v === 'bad')   return 'var(--bad)'
  return 'var(--text-2)'
}

function avgTasteFrom(items) {
  if (!items.length) return null
  const taste = {}
  ;['acidity', 'sweetness', 'body', 'bitterness', 'balance', 'aftertaste'].forEach(k => {
    taste[k] = items.reduce((a, s) => a + (s.taste[k] || 0), 0) / items.length
  })
  return taste
}

function StatsPanel({ label, items, U, doseLabel = 'Avg dose', yieldLabel = 'Avg yield' }) {
  if (!items.length) {
    return (
      <div className="card">
        <div className="card-head"><span className="card-title">{label}</span></div>
        <div className="text-muted" style={{ fontSize: 13, padding: '8px 0' }}>No data yet.</div>
      </div>
    )
  }
  const avgRating = (items.reduce((a, s) => a + s.rating, 0) / items.length).toFixed(1)
  const avgDose   = (items.reduce((a, s) => a + s.dose, 0) / items.length).toFixed(1)
  const avgYield  = yieldLabel ? (items.reduce((a, s) => a + (s.yield ?? s.water ?? 0), 0) / items.length).toFixed(1) : null
  const avgTime   = Math.round(items.reduce((a, s) => a + s.time, 0) / items.length)
  const taste     = avgTasteFrom(items)
  const verdicts  = {}
  items.forEach(s => { verdicts[s.verdict] = (verdicts[s.verdict] || 0) + 1 })

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{label}</span>
        <span className="card-more">{items.length} logged</span>
      </div>

      {/* top row: key numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderBottom: '1px solid var(--border)', paddingBottom: 20, marginBottom: 20 }}>
        <div>
          <div className="micro" style={{ marginBottom: 6 }}>Avg rating</div>
          <div className="mono" style={{ fontSize: 32, color: 'var(--crema)' }}>{avgRating}</div>
        </div>
        <div>
          <div className="micro" style={{ marginBottom: 6 }}>{doseLabel}</div>
          <div className="mono" style={{ fontSize: 32 }}>{U.m(avgDose)}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 2 }}>{U.mU()}</span></div>
        </div>
        {avgYield !== null && (
          <div>
            <div className="micro" style={{ marginBottom: 6 }}>{yieldLabel}</div>
            <div className="mono" style={{ fontSize: 32 }}>{U.m(avgYield)}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 2 }}>{U.mU()}</span></div>
          </div>
        )}
        <div>
          <div className="micro" style={{ marginBottom: 6 }}>Avg time</div>
          <div className="mono" style={{ fontSize: 32 }}>{avgTime}<span style={{ fontSize: 14, color: 'var(--text-3)', marginLeft: 2 }}>s</span></div>
        </div>
      </div>

      {/* bottom: radar left, verdicts right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
        {taste && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <FlavorRadar taste={taste} size={180} />
          </div>
        )}
        <div>
          <div className="micro" style={{ marginBottom: 16 }}>Verdicts</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
            {['good', 'bad', 'under', 'over'].map(v => (
              <div key={v}>
                <div className="mono" style={{ fontSize: 36, lineHeight: 1, color: verdictColor(v) }}>{verdicts[v] || 0}</div>
                <div className="micro" style={{ marginTop: 4 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BasketStats({ shots, U }) {
  const groups = {}
  shots.forEach(s => {
    if (!s.basket) return
    if (!groups[s.basket]) groups[s.basket] = []
    groups[s.basket].push(s)
  })
  const rows = Object.entries(groups).map(([name, items]) => {
    const avg = (f) => items.reduce((a, s) => a + (f(s) || 0), 0) / items.length
    return {
      name,
      count:  items.length,
      rating: avg(s => s.rating),
      dose:   avg(s => s.dose),
      yield:  avg(s => s.yield),
      time:   avg(s => s.time),
      good:   items.filter(s => s.verdict === 'good').length / items.length,
    }
  }).sort((a, b) => b.count - a.count)
  if (!rows.length) return null

  const unassigned = shots.length - rows.reduce((a, r) => a + r.count, 0)
  const best = rows.reduce((a, r) => r.rating > a.rating ? r : a)
  const cols = { display: 'grid', gridTemplateColumns: '2fr repeat(6, 1fr)', gap: 12, alignItems: 'baseline' }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Espresso by basket</span>
        {unassigned > 0 && <span className="card-more">{unassigned} shots without basket</span>}
      </div>
      <div className="scroll" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          <div className="micro" style={{ ...cols, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <div>Basket</div><div>Shots</div><div>Avg rating</div><div>Dose → yield</div><div>Ratio</div><div>Avg time</div><div>Good</div>
          </div>
          {rows.map(r => (
            <div key={r.name} className="mono" style={{ ...cols, fontSize: 13, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18 }}>{r.name}</div>
              <div>{r.count}</div>
              <div style={{ color: r === best && rows.length > 1 ? 'var(--crema)' : undefined }}>{r.rating.toFixed(1)}</div>
              <div>{U.m(r.dose)} → {U.m(r.yield)}{U.mU()}</div>
              <div>1:{(r.yield / r.dose).toFixed(2)}</div>
              <div>{Math.round(r.time)}s</div>
              <div style={{ color: 'var(--good)' }}>{Math.round(r.good * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Stats({ shots, brews = [], beans = [], gear = [], units }) {
  const U = useUnits(units)
  const hasData = shots.length || brews.length
  if (!hasData) return <div className="page-head"><h1 className="page-title">Stats.</h1></div>

  // price stats
  const beansWithPrice = beans.filter(b => b.price > 0)
  const totalBeanSpend = beansWithPrice.reduce((a, b) => a + b.price, 0)
  const avgBeanPrice   = beansWithPrice.length ? totalBeanSpend / beansWithPrice.length : 0
  const mostExpBean    = beansWithPrice.length ? beansWithPrice.reduce((a, b) => b.price > a.price ? b : a) : null
  const totalGearSpend = gear.filter(g => g.price > 0).reduce((a, g) => a + g.price, 0)

  // consumed coffee — sum weight of all archived bags
  const totalConsumedG = beans.filter(b => b.archived && b.weight > 0).reduce((a, b) => a + b.weight, 0)
  const consumedDisplay = totalConsumedG >= 1000
    ? `${(totalConsumedG / 1000).toFixed(2).replace(/\.?0+$/, '')} kg`
    : `${totalConsumedG} g`


  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Stats.</h1>
        <span className="page-sub">{shots.length} espresso · {brews.length} filter</span>
      </div>

      <div className="grid grid-2">
        <StatsPanel label="Espresso" items={shots} U={U} doseLabel="Avg dose" yieldLabel="Avg yield" />
        <StatsPanel label="Filter" items={brews} U={U} doseLabel="Avg dose" yieldLabel="Avg water" />
      </div>

      <BasketStats shots={shots} U={U} />

      {beansWithPrice.length > 0 && (
        <div className="card">
          <div className="card-head"><span className="card-title">Spending</span></div>
          <div className="grid grid-4" style={{ gap: 8, marginBottom: mostExpBean ? 16 : 0 }}>
            <div>
              <div className="mono" style={{ fontSize: 26, color: 'var(--crema)' }}>€{totalBeanSpend.toFixed(2)}</div>
              <div className="micro" style={{ marginTop: 4 }}>total on beans</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 26, color: 'var(--crema)' }}>€{avgBeanPrice.toFixed(2)}</div>
              <div className="micro" style={{ marginTop: 4 }}>avg per bag</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 26, color: 'var(--crema)' }}>{beansWithPrice.length}</div>
              <div className="micro" style={{ marginTop: 4 }}>bags tracked</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 26, color: 'var(--crema)' }}>
                {totalGearSpend > 0 ? `€${totalGearSpend.toFixed(2)}` : '—'}
              </div>
              <div className="micro" style={{ marginTop: 4 }}>total on gear</div>
            </div>
          </div>
          {(mostExpBean || totalConsumedG > 0) && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {mostExpBean ? (
                <div>
                  <div className="micro" style={{ marginBottom: 6 }}>most expensive bag</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20 }}>{mostExpBean.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{mostExpBean.roaster}</div>
                    <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--crema)' }}>€{mostExpBean.price.toFixed(2)}</div>
                  </div>
                </div>
              ) : <div />}
              {totalConsumedG > 0 && (
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16 }}>
                  <div className="micro" style={{ marginBottom: 6 }}>beans consumed</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div className="mono" style={{ fontSize: 26, color: 'var(--crema)' }}>{consumedDisplay}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>from {beans.filter(b => b.archived && b.weight > 0).length} bags</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {beans.some(b => b.origin?.trim()) && (
        <div className="card">
          <div className="card-head"><span className="card-title">Bean origins</span></div>
          <CoffeeMap beans={beans} />
        </div>
      )}
    </div>
  )
}

// ── STOCK ─────────────────────────────────────────────────────────────
export function Stock({ beans, units }) {
  const U = useUnits(units)
  const totalG   = beans.reduce((a, b) => a + b.remaining, 0)
  const shotEst  = Math.round(totalG / 18)
  const stockColor = { good: 'var(--good)', low: 'var(--sweet)', critical: 'var(--bitter)' }
  const stockBadge = { good: 'good', low: 'warn', critical: 'bad' }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Inventory.</h1>
        <span className="page-sub">bean stock</span>
      </div>
      <div className="grid grid-4">
        <StatCard label="Varieties"      value={`${beans.length}`}        sub="active bags" />
        <StatCard label="Low stock"      value={`${beans.filter(b => b.stock !== 'good').length}`} sub="need reorder" warn />
        <StatCard label="Total remaining" value={U.m(totalG)} delta={U.mU()} sub="across all bags" />
        <StatCard label="Est. shots"     value={`${shotEst}`}              sub="at 18g dose" />
      </div>
      {beans.map(b => {
        const pct     = Math.round((b.remaining / b.weight) * 100)
        const shots   = Math.round(b.remaining / 18)
        const days    = Math.round(b.remaining / 18 * 1.5)
        const sc      = stockColor[b.stock]
        return (
          <div key={b.id} className="card">
            <div style={{ display: 'flex', alignItems: 'start', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 26 }}>{b.name}</div>
                  <span className={`badge ${stockBadge[b.stock] || ''}`}>{b.stock}</span>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>{b.roaster} · {b.origin}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="stat stat-sm" style={{ color: sc }}>{U.m(b.remaining)}{U.mU()}</div>
                <div className="micro" style={{ marginTop: 4 }}>of {U.m(b.weight)}{U.mU()}</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="bean-stock-bar" style={{ height: 6 }}>
                <div className="bean-stock-fill" style={{ width: `${pct}%`, background: sc }} />
              </div>
              <div className="row" style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-4)' }}>
                <span>{pct}% remaining</span><span>·</span><span>~{shots} shots</span><span>·</span><span>~{days} days</span>
              </div>
            </div>
            {b.stock !== 'good' && (
              <div style={{ marginTop: 10 }}>
                <button className="primary-btn" style={{ fontSize: 11, padding: '5px 10px' }}>
                  <Ico name="plus" size={11} /> Reorder {b.name}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── TIPS PAGE ─────────────────────────────────────────────────────────
const EMPTY_TIP = { category: '', body: '' }

function TipsColumn({ section, label, tips, onAdd, onEdit, onDelete }) {
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

export function TipsPage({ tips = [], onSaveTip, onUpdateTip, onDeleteTip }) {
  const [modal, setModal]   = useState(null) // null | { mode: 'add'|'edit', section, tip? }
  const [form, setForm]     = useState(EMPTY_TIP)
  const [saving, setSaving] = useState(false)

  const espressoTips = tips.filter(t => t.section === 'espresso')
  const filterTips   = tips.filter(t => t.section === 'filter')
  const allCategories = (section) => [...new Set(tips.filter(t => t.section === section).map(t => t.category))].sort()

  const openAdd = (section) => {
    setForm(EMPTY_TIP)
    setModal({ mode: 'add', section })
  }

  const openEdit = (tip) => {
    setForm({ category: tip.category, body: tip.body || '' })
    setModal({ mode: 'edit', section: tip.section, tip })
  }

  const closeModal = () => { setModal(null); setForm(EMPTY_TIP) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category.trim()) return
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

  const handleDelete = async (id) => {
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
