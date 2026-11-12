import { useState } from 'react'
import { Meta } from '../components/ui.tsx'
import { PageHead } from '../components/Shell.tsx'
import { longDate } from '../data/dates.ts'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import type { Bean, Route, Units } from '../types.ts'

// ── FINISHED BAGS ─────────────────────────────────────────────────────
const PAGE_SIZES = [10, 20, 50]   // even numbers fill the two-column grid
const DEFAULT_PAGE_SIZE = 10
const CENTS = 2
const ICON = 14

interface ArchivedBeansProps {
  beans:       Bean[]
  openCount:   number
  units:       Units
  goTo:        (route: Route) => void
  onUnarchive: (id: string) => Promise<Bean>
  onDelete:    (id: string) => Promise<void>
}

export function ArchivedBeans({ beans, openCount, units, goTo, onUnarchive, onDelete }: ArchivedBeansProps) {
  const U = useUnits(units)
  const [perPage, setPerPage] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(beans.length / perPage))
  // Restoring or deleting the last bean on the last page shouldn't leave an empty page
  const current = Math.min(page, totalPages - 1)
  const shown = beans.slice(current * perPage, (current + 1) * perPage)
  const changePerPage = (n: number) => { setPerPage(n); setPage(0) }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bag for good? Its shots and brews stay, but this can’t be undone.')) return
    await onDelete(id)
  }

  return (
    <div className="stack">
      <PageHead title="Finished bags." sub={`${beans.length} ${beans.length === 1 ? 'bag' : 'bags'}`}>
        <div className="seg">
          <button onClick={() => goTo('beans')}>Open {openCount}</button>
          <button className="on">Finished {beans.length}</button>
        </div>
        {beans.length > PAGE_SIZES[0]! && (
          <select className="select page-size" value={perPage} onChange={e => changePerPage(Number(e.target.value))} aria-label="Bags per page">
            {PAGE_SIZES.map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        )}
      </PageHead>

      {beans.length === 0 && (
        <div className="card"><div className="empty">No finished bags yet. When a bag runs out, mark it finished on the Beans page and it moves here.</div></div>
      )}

      <div className="done-grid">
        {shown.map(b => (
          <div key={b.id} className="card done-bag">
            <div>
              <div className="nm">{b.name}</div>
              {(b.roaster || b.origin) && <div className="rs">{[b.roaster, b.origin].filter(Boolean).join(', ')}</div>}
            </div>

            <div className="done-meta">
              <Meta k="Process"  v={b.process || '–'} />
              <Meta k="Roast"    v={b.roast || '–'} />
              <Meta k="Variety"  v={b.variety || '–'} />
              <Meta k="Altitude" v={b.altitude || '–'} />
              <Meta k="Roasted"  v={b.roast_date ? longDate(b.roast_date) : '–'} />
              <Meta k="Price"    v={b.price ? `${U.cur()}${b.price % 1 === 0 ? b.price : b.price.toFixed(CENTS)}` : '–'} />
            </div>

            {b.notes?.length > 0 && (
              <div className="tags">{b.notes.map(n => <span key={n} className="badge">{n}</span>)}</div>
            )}

            <div className="done-foot">
              <span>
                {b.archived_at ? `Finished ${longDate(b.archived_at)}` : 'Finished'}
                {b.weight > 0 && `, ${U.m(b.weight)} ${U.mU()} bag`}
              </span>
              <button className="ghost-btn" onClick={() => onUnarchive(b.id)} title="Move back to open bags">
                <Ico name="arrowUp" size={ICON} /> Restore
              </button>
              <button className="ghost-btn danger" onClick={() => handleDelete(b.id)} aria-label="Delete bag" title="Delete bag">
                <Ico name="trash" size={ICON} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pager">
          <button className="ghost-btn" onClick={() => setPage(current - 1)} disabled={current === 0}>Previous</button>
          <span>{current + 1} of {totalPages}</span>
          <button className="ghost-btn" onClick={() => setPage(current + 1)} disabled={current >= totalPages - 1}>Next</button>
        </div>
      )}
    </div>
  )
}
