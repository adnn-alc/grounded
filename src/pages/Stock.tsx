import type { CSSProperties } from 'react'
import { PageHead } from '../components/Shell.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import { bagColor, daysOffRoast, shotsLeftText, usualDose } from '../data/beans.ts'
import type { Bean, BeanInput, Shot, StockLevel, Units } from '../types.ts'

// ── STOCK ─────────────────────────────────────────────────────────────
const FALLBACK_DOSE = 18
const PERCENT = 100

const LEVEL_TEXT: Record<StockLevel, string> = { good: 'Plenty', low: 'Running low', critical: 'Almost out' }

interface StockProps {
  beans:         Bean[]
  shots?:        Shot[]
  units:         Units
  onUpdateBean?: (id: string, data: BeanInput) => Promise<Bean>   // passed by App, not used yet
}

export function Stock({ beans, shots = [], units }: StockProps) {
  const U = useUnits(units)
  const fallbackDose = shots[0]?.dose || FALLBACK_DOSE
  const fraction = (b: Bean) => b.weight > 0 ? b.remaining / b.weight : 0
  // Emptiest bag first: that's the one to buy again
  const sorted = [...beans].sort((a, b) => fraction(a) - fraction(b))
  const totalLeft = beans.reduce((a, b) => a + b.remaining, 0)
  const shotsLeft = beans.reduce((a, b) => {
    const dose = usualDose(b, fallbackDose)
    return a + (dose > 0 ? Math.floor(b.remaining / dose) : 0)
  }, 0)
  const low = beans.filter(b => b.stock !== 'good').length

  return (
    <div className="stack stock-page">
      <PageHead title="Stock." sub={`${beans.length} open ${beans.length === 1 ? 'bag' : 'bags'}`} />

      <div className="card">
        <div className="num-row">
          <div className="kv"><span className="k">Coffee left</span><span className="v">{U.m(totalLeft)}<small>{U.mU()}</small></span></div>
          <div className="kv"><span className="k">Shots left</span><span className="v">{shotsLeft}</span></div>
          <div className="kv"><span className="k">Open bags</span><span className="v">{beans.length}</span></div>
          <div className="kv"><span className="k">Running low</span><span className={`v${low ? ' warn' : ''}`}>{low}</span></div>
        </div>
      </div>

      {beans.length === 0 && (
        <div className="card"><div className="empty">No open bags. Add one on the Beans page to track how much is left.</div></div>
      )}

      {sorted.length > 0 && (
        <div className="card">
          {sorted.map(b => {
            const days = daysOffRoast(b)
            const pct = Math.min(PERCENT, fraction(b) * PERCENT)
            return (
              <div key={b.id} className="stock-item" style={{ '--bag': bagColor(b.id) } as CSSProperties}>
                {/* Extraction only: the bag in its shelf color, filled to what's left */}
                <span className="si-bag"><i style={{ height: `${pct}%` }} /></span>
                <div className="si-main">
                  <div className="si-name">{b.name}</div>
                  <div className="si-sub">{[b.roaster, days != null && `day ${days}`].filter(Boolean).join(', ')}</div>
                </div>
                <div className="si-bar">
                  <div className="stock-bar"><i className={b.stock} style={{ width: `${pct}%` }} /></div>
                  <div className="si-left">
                    <span>{shotsLeftText(b, usualDose(b, fallbackDose), g => `${U.m(g)} ${U.mU()}`)}</span>
                    <b>{U.m(b.remaining)} <small>of {U.m(b.weight)} {U.mU()}</small></b>
                  </div>
                </div>
                <span className={`level-pill ${b.stock}`}>{LEVEL_TEXT[b.stock]}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
