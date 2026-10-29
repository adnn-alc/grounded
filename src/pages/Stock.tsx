import { StatCard } from '../components/ui.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import type { Bean, BeanInput, StockLevel, Units } from '../types.ts'

// ── STOCK ─────────────────────────────────────────────────────────────
interface StockProps {
  beans:         Bean[]
  units:         Units
  onUpdateBean?: (id: string, data: BeanInput) => Promise<Bean>   // passed by App, not used yet
}

export function Stock({ beans, units }: StockProps) {
  const U = useUnits(units)
  const totalG   = beans.reduce((a, b) => a + b.remaining, 0)
  const shotEst  = Math.round(totalG / 18)
  const stockColor: Record<StockLevel, string> = { good: 'var(--good)', low: 'var(--sweet)', critical: 'var(--bitter)' }
  const stockBadge: Record<StockLevel, string> = { good: 'good', low: 'warn', critical: 'bad' }

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
