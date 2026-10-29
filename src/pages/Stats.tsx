import { FlavorRadar } from '../components/charts.tsx'
import { useUnits, type UnitHelpers } from '../hooks/useUnits.ts'
import CoffeeMap from '../components/CoffeeMap.tsx'
import type { Bean, Brew, Gear, Shot, Taste, TasteAxis, Units } from '../types.ts'

// ── STATS ─────────────────────────────────────────────────────────────

/** What the espresso and filter panels read from a shot or brew */
type StatItem = Pick<Shot, 'rating' | 'dose' | 'time' | 'verdict' | 'taste'> & { yield?: number; water?: number }

function verdictColor(v: string) {
  if (v === 'good')  return 'var(--good)'
  if (v === 'under') return 'var(--under)'
  if (v === 'over')  return 'var(--over)'
  if (v === 'bad')   return 'var(--bad)'
  return 'var(--text-2)'
}

function avgTasteFrom(items: StatItem[]): Taste | null {
  if (!items.length) return null
  const taste = {} as Taste
  ;(['acidity', 'sweetness', 'body', 'bitterness', 'balance', 'aftertaste'] as TasteAxis[]).forEach(k => {
    taste[k] = items.reduce((a, s) => a + (s.taste[k] || 0), 0) / items.length
  })
  return taste
}

interface StatsPanelProps {
  label:       string
  items:       StatItem[]
  U:           UnitHelpers
  doseLabel?:  string
  yieldLabel?: string
}

function StatsPanel({ label, items, U, doseLabel = 'Avg dose', yieldLabel = 'Avg yield' }: StatsPanelProps) {
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
  const verdicts: Record<string, number> = {}
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

function BasketStats({ shots, U }: { shots: Shot[]; U: UnitHelpers }) {
  const groups: Record<string, Shot[]> = {}
  shots.forEach(s => {
    if (!s.basket) return
    if (!groups[s.basket]) groups[s.basket] = []
    groups[s.basket].push(s)
  })
  const rows = Object.entries(groups).map(([name, items]) => {
    const avg = (f: (s: Shot) => number) => items.reduce((a, s) => a + (f(s) || 0), 0) / items.length
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

interface StatsProps {
  shots:  Shot[]
  brews?: Brew[]
  beans?: Bean[]   // active and archived
  gear?:  Gear[]
  units:  Units
}

export function Stats({ shots, brews = [], beans = [], gear = [], units }: StatsProps) {
  const U = useUnits(units)
  const hasData = shots.length || brews.length
  if (!hasData) return <div className="page-head"><h1 className="page-title">Stats.</h1></div>

  // price stats
  const beansWithPrice = beans.filter(b => b.price > 0)
  const totalBeanSpend = beansWithPrice.reduce((a, b) => a + b.price, 0)
  const avgBeanPrice   = beansWithPrice.length ? totalBeanSpend / beansWithPrice.length : 0
  const mostExpBean    = beansWithPrice.length ? beansWithPrice.reduce((a, b) => b.price > a.price ? b : a) : null
  const totalGearSpend = gear.filter(g => (g.price ?? 0) > 0).reduce((a, g) => a + (g.price ?? 0), 0)

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
