import type { ReactNode } from 'react'
import { useUnits } from '../hooks/useUnits.ts'
import type { Brew, Shot, Units } from '../types.ts'

interface StatCardProps {
  label:  string
  value:  string
  delta?: string
  sub:    string
  warn?:  boolean
  serif?: boolean
}

export function StatCard({ label, value, delta, sub, warn, serif }: StatCardProps) {
  return (
    <div className="card">
      <div className="micro">{label}</div>
      <div className="row" style={{ marginTop: 8, alignItems: 'baseline', gap: 8 }}>
        {serif
          ? <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 36, lineHeight: 1 }}>{value}</div>
          : <div className="stat stat-lg">{value}</div>
        }
        {delta && (
          <span className="mono" style={{ fontSize: 11, color: warn ? 'var(--bitter)' : 'var(--good)' }}>{delta}</span>
        )}
      </div>
      <div className="text-dim mono" style={{ fontSize: 10, marginTop: 8 }}>{sub}</div>
    </div>
  )
}

export function Meta({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ padding: '5px 0' }}>
      <div className="micro">{k}</div>
      <div className="mono" style={{ fontSize: 12, marginTop: 2 }}>{v}</div>
    </div>
  )
}

interface CardProps {
  index:   number
  total:   number
  active:  boolean
  onClick: () => void
  units:   Units
}

export function ShotCard({ shot, index, total, active, onClick, units }: CardProps & { shot: Shot }) {
  const U = useUnits(units)
  return (
    <div className={`shot-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="num">{String(total - index).padStart(2, '0')}</div>
      <div>
        <div className="title">{shot.bean} · <span className="text-muted">{shot.roaster}</span></div>
        <div className="sub">{U.m(shot.dose)}{U.mU()} → {U.m(shot.yield)}{U.mU()} in {shot.time}s · {shot.date.slice(11)}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="stat stat-sm text-crema">{shot.rating.toFixed(1)}</div>
        <div style={{ marginTop: 4 }}><span className={`badge ${shot.verdict}`}>{shot.verdict}</span></div>
      </div>
    </div>
  )
}

export function BrewCard({ brew, index, total, active, onClick, units }: CardProps & { brew: Brew }) {
  const U = useUnits(units)
  const ratio = brew.water && brew.dose ? (brew.water / brew.dose).toFixed(1) : '–'
  const mins = brew.time ? `${Math.floor(brew.time / 60)}:${String(brew.time % 60).padStart(2, '0')}` : '–'
  return (
    <div className={`shot-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="num">{String(total - index).padStart(2, '0')}</div>
      <div>
        <div className="title">{brew.bean} · <span className="text-muted">{brew.dripper}</span></div>
        <div className="sub">{U.m(brew.dose)}{U.mU()} → {U.m(brew.water)}{U.mU()} · 1:{ratio} · {mins} · {brew.date.slice(11)}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="stat stat-sm text-crema">{brew.rating?.toFixed(1)}</div>
        <div style={{ marginTop: 4 }}><span className={`badge ${brew.verdict}`}>{brew.verdict}</span></div>
      </div>
    </div>
  )
}
