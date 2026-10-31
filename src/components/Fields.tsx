import type { CSSProperties, ReactNode } from 'react'
import { mmss, parseMmss } from '../data/taste.ts'

const HALF = 2
const PERCENT = 100
const MIN_CHARS = 2      // number inputs size to their value, at least this wide
const CARET_ROOM = 0.5

/** Range inputs paint their filled part from this custom property */
const fillStyle = (value: number, max: number): CSSProperties =>
  ({ '--p': `${max > 0 ? Math.min(PERCENT, (value / max) * PERCENT) : 0}%` }) as CSSProperties

const decimalsOf = (step: number): number => (String(step).split('.')[1] ?? '').length

interface NumFieldProps {
  label:     string
  value:     string               // as typed
  onChange:  (value: string) => void
  step:      number
  unit?:     string
  min?:      number
  max?:      number
  fallback?: string               // put back when the field is left empty
}

/** A number with − and + buttons that nudge it by one step */
export function NumField({ label, value, onChange, step, unit, min = 0, max = Infinity, fallback }: NumFieldProps) {
  const nudge = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, (parseFloat(value) || 0) + dir * step))
    onChange(next.toFixed(decimalsOf(step)))
  }
  return (
    <div className="num-field">
      <label>{label}</label>
      <div className="nf-row">
        <input type="number" inputMode="decimal" value={value} step={step} min={min} max={Number.isFinite(max) ? max : undefined}
          style={{ width: `${Math.max(MIN_CHARS, value.length) + CARET_ROOM}ch` }}
          onChange={e => onChange(e.target.value)}
          onBlur={e => { if (fallback != null && !e.target.value.trim()) onChange(fallback) }} />
        {unit && <span className="unit">{unit}</span>}
        <button type="button" className="step" aria-label={`Less ${label.toLowerCase()}`} onClick={() => nudge(-1)}>−</button>
        <button type="button" className="step" aria-label={`More ${label.toLowerCase()}`} onClick={() => nudge(1)}>+</button>
      </div>
    </div>
  )
}

/** A value worked out from the others (ratio), shown where a field would be */
export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="num-field readout">
      <label>{label}</label>
      <div className="val">{value}</div>
    </div>
  )
}

interface TimeFieldProps {
  value:    string                 // '15' (seconds) or '3:05' (minutes)
  onChange: (value: string) => void
  minutes?: boolean                // show and type it as m:ss
  max:      number                 // end of the slider, in seconds
  step:     number                 // − / + and slider step, in seconds
  last?:    number | null          // previous time with this bean, marked on the slider
  help:     string
}

/**
 * Time is entered by hand (no timer): typed, dragged on the slider, or nudged
 * with − / +. Typing past the slider's end is fine; the slider just stays full.
 */
export function TimeField({ value, onChange, minutes = false, max, step, last, help }: TimeFieldProps) {
  const secs = parseMmss(value) ?? 0
  const show = (s: number): string => minutes ? mmss(s) : String(s)
  const nudge = (dir: 1 | -1) => onChange(show(Math.max(0, secs + dir * step)))
  const lastPct = last != null && last <= max ? (last / max) * PERCENT : null

  return (
    <div>
      <div className="time-row">
        <div className="time-box">
          <input className={minutes ? 'mmss' : ''} inputMode={minutes ? 'text' : 'numeric'} value={value} placeholder={minutes ? '0:00' : '0'}
            aria-label={minutes ? 'Total time' : 'Shot time'}
            onChange={e => onChange(e.target.value)} />
          {!minutes && <span className="unit">s</span>}
        </div>
        <div className="time-help">{help}</div>
        <div className="time-steps">
          <button type="button" className="icon-btn" aria-label="Less time" onClick={() => nudge(-1)}>−</button>
          <button type="button" className="icon-btn" aria-label="More time" onClick={() => nudge(1)}>+</button>
        </div>
      </div>
      <div className="time-slider">
        <input type="range" min={0} max={max} step={step} value={Math.min(secs, max)} style={fillStyle(secs, max)}
          aria-label="Time" onChange={e => onChange(show(Number(e.target.value)))} />
        {lastPct != null && <span className="time-last" style={{ left: `${lastPct}%` }}>last {show(last!)}</span>}
        <div className="time-scale">
          <span>{minutes ? mmss(0) : '0 s'}</span>
          <span>{show(max / HALF)}</span>
          <span>{minutes ? mmss(max) : `${max} s`}</span>
        </div>
      </div>
    </div>
  )
}

/** A form field: the label above any input, select or textarea */
export function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
