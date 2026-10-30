import { useState } from 'react'
import { Meta } from '../components/ui.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import type { Bean, Units } from '../types.ts'

// ── ARCHIVED BEANS ────────────────────────────────────────────────────
const PAGE_SIZES = [10, 20, 50]   // even numbers fill the two-column grid
const DEFAULT_PAGE_SIZE = 10

interface ArchivedBeansProps {
  beans:       Bean[]
  units:       Units
  onUnarchive: (id: string) => Promise<Bean>
  onDelete:    (id: string) => Promise<void>
}

export function ArchivedBeans({ beans, units, onUnarchive, onDelete }: ArchivedBeansProps) {
  const U = useUnits(units)
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(beans.length / perPage))
  // Restoring or deleting the last bean on the last page shouldn't leave an empty page
  const current = Math.min(page, totalPages - 1)
  const shown = beans.slice(current * perPage, (current + 1) * perPage)
  const changePerPage = (n: number) => { setPerPage(n); setPage(0) }

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this bean? This cannot be undone.')) return
    await onDelete(id)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">Archive.</h1>
        <span className="page-sub">{beans.length} past beans</span>
        {beans.length > PAGE_SIZES[0]! && (
          <select value={perPage} onChange={e => changePerPage(Number(e.target.value))}
            style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
      </div>

      {beans.length === 0 && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
          <div style={{ textAlign: 'center', color: 'var(--text-4)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            No archived beans yet.<br />Archive a bean from the Beans page when it's finished.
          </div>
        </div>
      )}

      <div className="grid grid-2">
        {shown.map(b => (
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

      {totalPages > 1 && (
        <div className="row" style={{ justifyContent: 'center', gap: 8, paddingTop: 4 }}>
          <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => setPage(current - 1)} disabled={current === 0}>← Prev</button>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'center' }}>{current + 1} / {totalPages}</span>
          <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => setPage(current + 1)} disabled={current >= totalPages - 1}>Next →</button>
        </div>
      )}
    </div>
  )
}
