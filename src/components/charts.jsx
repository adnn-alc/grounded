import { useRef } from 'react'
import { flavColor } from '../hooks/useUnits.js'

export function FlavorRadar({ taste, size = 200, color = 'var(--crema)', compareTaste = null }) {
  const axes   = ['acidity', 'sweetness', 'body', 'bitterness', 'balance', 'aftertaste']
  const labels = ['Acid', 'Sweet', 'Body', 'Bitter', 'Balance', 'Finish']
  const cx = size / 2, cy = size / 2, r = size / 2 - 30
  const angle  = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / axes.length)
  const pt     = (val, i) => { const rr = (val / 10) * r; return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))] }
  const poly   = (t) => axes.map((k, i) => pt(t[k] || 0, i).join(',')).join(' ')

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {[2, 4, 6, 8, 10].map(v => (
        <polygon key={v}
          points={axes.map((_, i) => pt(v, i).join(',')).join(' ')}
          fill="none" stroke="var(--border)" strokeWidth="0.5" opacity={v === 10 ? 0.7 : 0.3}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(10, i)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
      })}
      {compareTaste && (
        <polygon points={poly(compareTaste)} fill="var(--text-3)" fillOpacity="0.08" stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" />
      )}
      <polygon points={poly(taste)} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" />
      {axes.map((k, i) => {
        const [x, y] = pt(taste[k] || 0, i)
        return <circle key={k} cx={x} cy={y} r="3" fill={color} />
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(12.5, i)
        return (
          <text key={l} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill="var(--text-4)" fontFamily="var(--font-mono)" fontSize="9"
            style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</text>
        )
      })}
    </svg>
  )
}

export function WeekTrend({ ratings, labels, max: maxProp, sundays }) {
  const lbs = labels || ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const vw = 600, h = 120, min = 0
  const max = maxProp ?? 10
  const LEFT = 24, RIGHT = 8, BOTTOM = 16, TOP = 8
  const px = (i) => LEFT + (i / (ratings.length - 1)) * (vw - LEFT - RIGHT)
  const py = (v) => h - BOTTOM - ((v - min) / (max - min)) * (h - BOTTOM - TOP)

  // Ticks at every 2 units up to max (max is always even)
  const ticks = Array.from({ length: max / 2 }, (_, i) => (i + 1) * 2)

  // Build segments of consecutive non-null values
  const segments = []
  let current = null
  ratings.forEach((v, i) => {
    if (v !== null) {
      if (!current) { current = []; segments.push(current) }
      current.push({ v, i })
    } else {
      current = null
    }
  })

  return (
    <svg viewBox={`0 0 ${vw} ${h}`} width="100%" height={h} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--crema)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--crema)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map(v => (
        <g key={v}>
          <line x1={LEFT} y1={py(v)} x2={vw - RIGHT} y2={py(v)} stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
          <text x={LEFT - 12} y={py(v) + 3.5} fill="var(--text-4)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end">{v}</text>
        </g>
      ))}
      {segments.map((seg, si) => {
        const linePath = 'M' + seg.map(({ v, i }) => `${px(i)},${py(v)}`).join(' L')
        const first = seg[0], last = seg[seg.length - 1]
        const areaPath = linePath + ` L${px(last.i)},${py(0)} L${px(first.i)},${py(0)} Z`
        return (
          <g key={si}>
            <path d={areaPath} fill="url(#trendGrad)" />
            <path d={linePath} fill="none" stroke="var(--crema)" strokeWidth="1.8" />
          </g>
        )
      })}
      {ratings.map((v, i) => v !== null ? (
        <circle key={i} cx={px(i)} cy={py(v)} r="3" fill="var(--crema)" />
      ) : null)}
      {lbs.map((l, i) => (
        <text key={i} x={px(i)} y={h - 1} fill={sundays?.[i] ? 'var(--bad)' : 'var(--text-4)'} fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">{l}</text>
      ))}
    </svg>
  )
}

export function FlowGraph({ points, live, dose }) {
  const W = 400, H = 160
  const target = (dose || 18) * 2.2
  const maxT = Math.max(40, ...points.map(p => p.t))
  const maxM = Math.max(target + 6, ...points.map(p => p.mass))
  const px  = (t) => 28 + (t / maxT) * (W - 40)
  const py  = (m) => H - 22 - (m / maxM) * (H - 42)
  const pyF = (f) => H - 22 - (f / 5) * (H - 42)

  const massPath = points.length ? 'M' + points.map(p => `${px(p.t)},${py(p.mass)}`).join(' L') : ''
  const flowPath = points.length ? 'M' + points.map(p => `${px(p.t)},${pyF(p.flow)}`).join(' L') : ''
  const massArea = massPath
    ? massPath + ` L${px(points[points.length - 1].t)},${H - 22} L${px(0)},${H - 22} Z`
    : ''
  const last = points[points.length - 1]

  return (
    <svg width={W} height={H}>
      <defs>
        <linearGradient id="massGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--crema)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--crema)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 10, 20, 30, 40].map(t => (
        <g key={t}>
          <line x1={px(t)} y1={12} x2={px(t)} y2={H - 22} stroke="var(--border)" strokeWidth="0.5" opacity="0.4" />
          <text x={px(t)} y={H - 6} fill="var(--text-4)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">{t}s</text>
        </g>
      ))}
      <line x1="28" y1={py(target)} x2={W - 12} y2={py(target)} stroke="var(--crema)" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7" />
      <text x={W - 14} y={py(target) - 4} fill="var(--crema)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="end" opacity="0.8">target {target.toFixed(1)}g</text>
      {massArea && <path d={massArea} fill="url(#massGrad)" />}
      {massPath
        ? <path d={massPath} fill="none" stroke="var(--crema)" strokeWidth="2" />
        : <text x={W / 2} y={H / 2} fill="var(--text-4)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">Start timer to record flow</text>
      }
      {flowPath && <path d={flowPath} fill="none" stroke="var(--sour)" strokeWidth="1.2" opacity="0.8" strokeDasharray="1 2" />}
      {last && (
        <>
          <circle cx={px(last.t)} cy={py(last.mass)} r="4" fill="var(--crema)" />
          {live && (
            <circle cx={px(last.t)} cy={py(last.mass)} r="10" fill="var(--crema)" opacity="0.25">
              <animate attributeName="r" from="4" to="14" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="1.2s" repeatCount="indefinite" />
            </circle>
          )}
        </>
      )}
      {/* Pre-infusion shading */}
      {points.length > 0 && (() => {
        const preinfIdx = points.findIndex(p => p.mass > 0.2)
        const preinfX   = preinfIdx > 0 ? px(points[preinfIdx].t) : px(8)
        return (
          <>
            <rect x={px(0)} y={12} width={preinfX - px(0)} height={H - 34} fill="var(--sour)" opacity="0.06" />
            <text x={px(0) + 4} y={22} fill="var(--sour)" fontSize="8" fontFamily="var(--font-mono)" opacity="0.7" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>pre-inf</text>
          </>
        )
      })()}
      {/* Legend */}
      <g transform={`translate(${W - 130}, 10)`}>
        <rect x="0" y="0" width="122" height="30" fill="var(--bg-2)" stroke="var(--border)" rx="4" />
        <line x1="8" y1="9"  x2="20" y2="9"  stroke="var(--crema)" strokeWidth="2" />
        <text x="24" y="12" fill="var(--text-3)" fontSize="9" fontFamily="var(--font-mono)">yield (g)</text>
        <line x1="8" y1="22" x2="20" y2="22" stroke="var(--sour)" strokeWidth="1.2" strokeDasharray="1 2" />
        <text x="24" y="25" fill="var(--text-3)" fontSize="9" fontFamily="var(--font-mono)">flow (g/s)</text>
      </g>
    </svg>
  )
}

export function Sparkline({ values, width = 80, height = 24, color = 'var(--crema)' }) {
  const max  = Math.max(...values, 1)
  const min  = Math.min(...values, 0)
  const span = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * (width - 4) + 2
    const y = height - 2 - ((v - min) / span) * (height - 4)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

export function BarChart({ data }) {
  const W = 360, H = 140
  const max = Math.max(...data.map(d => d.value), 1)
  const bw  = (W - 40) / data.length

  return (
    <svg width={W} height={H}>
      {data.map((d, i) => {
        const h = (d.value / max) * (H - 44)
        const x = 32 + i * bw
        const y = H - 22 - h
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw - 6} height={h} fill="var(--crema)" fillOpacity="0.85" rx="2" />
            <text x={x + (bw - 6) / 2} y={H - 8} fill="var(--text-4)" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">{d.label}</text>
            {d.value > 0 && <text x={x + (bw - 6) / 2} y={y - 4} fill="var(--text-3)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">{d.value}</text>}
          </g>
        )
      })}
    </svg>
  )
}

export function FlavSliders({ taste, onChange }) {
  const axes = ['acidity', 'sweetness', 'body', 'bitterness', 'balance', 'aftertaste']
  const tasteRef = useRef(taste)
  tasteRef.current = taste

  const handlePointerDown = (k, e) => {
    e.preventDefault()
    const bar = e.currentTarget
    const update = (clientX) => {
      const rect = bar.getBoundingClientRect()
      const v = Math.max(1, Math.min(10, Math.round(((clientX - rect.left) / rect.width) * 10)))
      onChange({ ...tasteRef.current, [k]: v })
    }
    update(e.clientX)
    const onMove = (ev) => update(ev.clientX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="flav-sliders">
      {axes.map(k => (
        <div key={k} className="flav-row">
          <div className="name">{k}</div>
          <div className="flav-bar" onPointerDown={(e) => handlePointerDown(k, e)}>
            <div className="flav-bar-fill" style={{ transform: `scaleX(${(taste[k] || 0) / 10})`, background: flavColor(k) }} />
            <div className="flav-thumb" style={{ left: `calc(${(taste[k] || 0) * 10}% - 6px)`, background: flavColor(k) }} />
          </div>
          <div className="v">{taste[k]}</div>
        </div>
      ))}
    </div>
  )
}
