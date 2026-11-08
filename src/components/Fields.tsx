import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import Ico from './Ico.tsx'
import { mmss, parseMmss } from '../data/taste.ts'

const HALF = 2
const PERCENT = 100
const MIN_CHARS = 2      // number inputs size to their value, at least this wide
const CARET_ROOM = 0.5

/** Range inputs paint their filled part from this custom property */
const fillStyle = (value: number, max: number): CSSProperties =>
  ({ '--p': `${max > 0 ? Math.min(PERCENT, (value / max) * PERCENT) : 0}%` }) as CSSProperties

const decimalsOf = (step: number): number => (String(step).split('.')[1] ?? '').length

/** The value one step up or down, kept within min–max and written with the step's decimals */
export function stepValue(value: string, dir: 1 | -1, step: number, min = 0, max = Infinity): string {
  return Math.min(max, Math.max(min, (parseFloat(value) || 0) + dir * step)).toFixed(decimalsOf(step))
}

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
  const nudge = (dir: 1 | -1) => onChange(stepValue(value, dir, step, min, max))
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

// ── Extraction: the time on a dial ──────────────────────────────────────
// A 270° arc that opens at the bottom: 0 at the lower left, the slider's max at the lower right.
const DIAL_SIZE   = 300
const DIAL_R      = 112
const DIAL_STROKE = 18
const DIAL_START  = 135          // degrees, clockwise from 3 o'clock
const DIAL_SWEEP  = 270
const FULL_TURN   = 360
const HALF_TURN   = 180
const GAP_MIDDLE  = DIAL_SWEEP + (FULL_TURN - DIAL_SWEEP) / HALF   // past this angle the pointer is nearer 0 than the max
const TICK_IN     = 8
const TICK_MINOR  = 7
const TICK_MAJOR  = 13
const LABEL_IN    = 34
const LAST_OUT    = 12
const LAST_R      = 4
const MINOR_W     = 1.2
const MAJOR_W     = 2
const DEG         = Math.PI / HALF_TURN
const PAD         = 1
const DIAL_ICON   = 18
const WHEEL_NOTCH = 40         // pixels of trackpad scroll per step
const WHEEL_CLICK = 50         // a scroll this big at once is from a mouse wheel, not a trackpad
const CLICK_PIXELS = 100       // one wheel click, in pixels (Chrome, Safari)
const CLICK_LINES  = 3         // one wheel click, in lines (Firefox)
const GRAB_BAND   = 34         // a press grabs the dial this far either side of the ring (dial units, the ring's radius is DIAL_R)
const END_GRACE   = 10         // degrees past either end of the ring that still grab it, so the knob at 0 or the max can be picked up

const C = DIAL_SIZE / HALF
const polar = (r: number, deg: number): [number, number] => [C + r * Math.cos(deg * DEG), C + r * Math.sin(deg * DEG)]
const fmt = (n: number): string => n.toFixed(PAD)

/** Arc from 0 to `frac` of the sweep, as an SVG path */
function arcPath(frac: number): string {
  const sweep = Math.max(0, Math.min(1, frac)) * DIAL_SWEEP
  const [x0, y0] = polar(DIAL_R, DIAL_START)
  const [x1, y1] = polar(DIAL_R, DIAL_START + sweep)
  return `M${fmt(x0)} ${fmt(y0)}A${DIAL_R} ${DIAL_R} 0 ${sweep > HALF_TURN ? 1 : 0} 1 ${fmt(x1)} ${fmt(y1)}`
}

interface TimeDialProps extends TimeFieldProps {
  tick:    number                 // seconds between small ticks
  major:   number                 // seconds between labeled ticks
  recent?: number[]               // the last few times on this bag, each marked with a dot (instead of only `last`)
}

/** Extraction's take on TimeField: drag around the dial, type in the middle, or nudge with − / + */
export function TimeDial({ value, onChange, minutes = false, max, step, last, help, tick, major, recent }: TimeDialProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const secs = parseMmss(value) ?? 0
  const show = (s: number): string => minutes ? mmss(s) : String(s)
  const nudge = (dir: 1 | -1) => onChange(show(Math.max(0, secs + dir * step)))
  const at = (s: number) => DIAL_START + (Math.min(s, max) / max) * DIAL_SWEEP

  // Scrolling over the dial nudges the time: up for more, down for less. The listener isn't passive,
  // so it can keep the page from scrolling. A mouse wheel moves one step a click; a trackpad's
  // small deltas add up to a step at a time.
  // It keeps its own running time, so quick scrolls don't lose steps between renders.
  const faceRef = useRef<HTMLDivElement>(null)
  const latest = useRef({ secs, set: (s: number) => onChange(show(s)), step })
  useEffect(() => { latest.current = { secs, set: (s: number) => onChange(show(s)), step } })
  useEffect(() => {
    const face = faceRef.current
    if (!face) return
    let pending = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      let notches: number
      if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(e.deltaY) >= WHEEL_CLICK) {
        const perClick = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? CLICK_PIXELS : CLICK_LINES
        notches = Math.sign(e.deltaY) * Math.max(1, Math.round(Math.abs(e.deltaY) / perClick))
        pending = 0
      } else {
        pending += e.deltaY
        notches = Math.trunc(pending / WHEEL_NOTCH)
        pending -= notches * WHEEL_NOTCH
      }
      if (!notches) return
      const now = latest.current
      now.secs = Math.max(0, now.secs - notches * now.step)
      now.set(now.secs)
    }
    face.addEventListener('wheel', onWheel, { passive: false })
    return () => face.removeEventListener('wheel', onWheel)
  }, [])

  // Where a pointer is on the dial: its distance from the center and its angle along the ring (0 = the start)
  const locate = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    const scale = DIAL_SIZE / rect.width
    const dx = (clientX - rect.left) * scale - C
    const dy = (clientY - rect.top) * scale - C
    const deg = Math.atan2(dy, dx) / DEG
    return { r: Math.hypot(dx, dy), rel: (deg - DIAL_START + FULL_TURN * HALF) % FULL_TURN }
  }
  const place = (clientX: number, clientY: number) => {
    const spot = locate(clientX, clientY)
    if (!spot) return
    const frac = spot.rel <= DIAL_SWEEP ? spot.rel / DIAL_SWEEP : Number(spot.rel < GAP_MIDDLE)
    onChange(show(Math.round((frac * max) / step) * step))
  }
  // Only a press on the ring grabs the dial. One in the middle, a corner or the open bottom (around
  // the − / + buttons) does nothing, so a near miss on a button can't throw the time to 0 or the max.
  // Once grabbed, the drag follows the pointer anywhere.
  const dragging = useRef(false)
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const spot = locate(e.clientX, e.clientY)
    const onRing = spot != null && Math.abs(spot.r - DIAL_R) <= GRAB_BAND
      && (spot.rel <= DIAL_SWEEP + END_GRACE || spot.rel >= FULL_TURN - END_GRACE)
    dragging.current = onRing
    if (!onRing) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    place(e.clientX, e.clientY)
  }

  const ticks = Array.from({ length: Math.floor(max / tick) + 1 }, (_, i) => i * tick)
  const [kx, ky] = polar(DIAL_R, at(secs))
  const marked = [...new Set(recent ?? (last != null ? [last] : []))].filter(t => t <= max)

  return (
    <div className="tdial">
      <div className="tdial-face" ref={faceRef}>
        <svg ref={svgRef} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} role="img" aria-label={`${minutes ? 'Total' : 'Shot'} time, drag to set`}
          onPointerDown={onPointerDown} onPointerMove={e => { if (e.buttons && dragging.current) place(e.clientX, e.clientY) }}
          onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}>
          <path className="tdial-track" d={arcPath(1)} strokeWidth={DIAL_STROKE} />
          {secs > 0 && <path className="tdial-fill" d={arcPath(secs / max)} strokeWidth={DIAL_STROKE} />}
          {ticks.map(t => {
            const big = t % major === 0
            const [x1, y1] = polar(DIAL_R - DIAL_STROKE / HALF - TICK_IN, at(t))
            const [x2, y2] = polar(DIAL_R - DIAL_STROKE / HALF - (big ? TICK_MAJOR : TICK_MINOR), at(t))
            return <path key={t} className="tdial-tick" d={`M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`} strokeWidth={big ? MAJOR_W : MINOR_W} />
          })}
          {ticks.filter(t => t % major === 0).map(t => {
            const [x, y] = polar(DIAL_R - LABEL_IN, at(t))
            return <text key={t} className="tdial-label" x={fmt(x)} y={fmt(y)} textAnchor="middle" dominantBaseline="central">{show(t)}</text>
          })}
          {marked.map(t => {
            const [x, y] = polar(DIAL_R + DIAL_STROKE / HALF + LAST_OUT, at(t))
            return <circle key={t} className="tdial-last" cx={fmt(x)} cy={fmt(y)} r={LAST_R}><title>{recent ? 'Recent' : 'Last'} time: {show(t)}</title></circle>
          })}
          <circle className="tdial-knob" cx={fmt(kx)} cy={fmt(ky)} r={DIAL_STROKE / HALF + LAST_R} />
        </svg>
        <div className="tdial-center">
          <input className={minutes ? 'mmss' : ''} inputMode={minutes ? 'text' : 'numeric'} value={value} placeholder={minutes ? '0:00' : '0'}
            aria-label={minutes ? 'Total time' : 'Shot time'} onChange={e => onChange(e.target.value)} />
          <span>{minutes ? 'total time' : 'seconds'}</span>
        </div>
      </div>
      <div className="tdial-steps">
        <button type="button" className="icon-btn" aria-label="Less time" onClick={() => nudge(-1)}><Ico name="minus" size={DIAL_ICON} /></button>
        <span>{help}</span>
        <button type="button" className="icon-btn" aria-label="More time" onClick={() => nudge(1)}><Ico name="plus" size={DIAL_ICON} /></button>
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
