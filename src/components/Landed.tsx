import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { LANDED_BALANCED, LANDED_MAX, landedLabel } from '../data/taste.ts'

interface LandedSliderProps {
  landed:       number | null
  bad:          boolean
  onChange?:    (landed: number) => void
  onBadChange?: (bad: boolean) => void
  title?:       string    // 'How did it land?' on Dial-in, 'Landed' in history
  badLabel?:    string    // 'Bad shot' / 'Bad brew'
  labelBelow?:  boolean   // Extraction: where it landed goes between Sour and Bitter, not in the heading
}

/**
 * The sour-to-bitter slider with a Bad switch next to it. Turning Bad on grays the
 * slider out: a channeled or gushing shot isn't placed anywhere. Without onChange
 * it only shows where a saved shot landed.
 */
export function LandedSlider({ landed, bad, onChange, onBadChange, title = 'How did it land?', badLabel = 'Bad shot', labelBelow = false }: LandedSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const editable = Boolean(onChange) && !bad

  const place = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !onChange) return
    onChange(Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * LANDED_MAX))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!editable) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    place(e.clientX)
  }

  const unplacedLabel = onChange ? 'drag the knob to where it landed' : 'not placed'
  const placedLabel = landed == null ? unplacedLabel : landedLabel(landed)
  const label = bad ? 'not placed' : placedLabel
  const cls = ['landed-track', bad && 'disabled', landed == null && 'unset', !onChange && 'readonly'].filter(Boolean).join(' ')

  return (
    <div>
      <div className="landed-head">
        <b>{title}</b>
        {!labelBelow && <em className={bad || landed == null ? 'off' : ''}>{label}</em>}
        {onBadChange && (
          <label className={`bad-check${bad ? ' on' : ''}`}>
            {badLabel}
            <input type="checkbox" role="switch" checked={bad} onChange={e => onBadChange(e.target.checked)} />
            <span className="switch" aria-hidden="true" />
          </label>
        )}
        {!onBadChange && bad && <span className="bad-pill" style={{ marginLeft: 'auto' }}>{badLabel}</span>}
      </div>
      <div ref={trackRef} className={cls}
        onPointerDown={onPointerDown}
        onPointerMove={e => { if (editable && e.buttons) place(e.clientX) }}>
        {landed != null && !bad && <div className="knob" style={{ left: `${landed}%` }} />}
        {/* Not placed yet: a hollow knob in the middle shows the slider can be dragged */}
        {landed == null && editable && <div className="knob ghost" style={{ left: `${LANDED_BALANCED}%` }} />}
      </div>
      <div className="landed-ends">
        <span>Sour</span>
        {labelBelow ? <b className={bad || landed == null ? 'off' : ''}>{label}</b> : <span>Balanced</span>}
        <span>Bitter</span>
      </div>
    </div>
  )
}

/** Small read-only bar for lists: a marker where it landed, or a "Bad" pill */
export function MiniLanded({ landed, bad, badLabel = 'Bad shot' }: { landed: number | null; bad: boolean; badLabel?: string }) {
  if (bad) return <span className="bad-pill">{badLabel}</span>
  return (
    <span className={`mini-landed${landed == null ? ' unset' : ''}`} title={landedLabel(landed)}>
      {landed != null && <i style={{ left: `${landed}%` }} />}
    </span>
  )
}

/** Extraction's read-only sour-to-bitter bar: a marker where it landed and the word for it under the middle (grayed out for a bad one) */
export function LandedGauge({ landed, bad, badLabel = 'Bad shot' }: { landed: number | null; bad: boolean; badLabel?: string }) {
  const placed = landed != null && !bad
  return (
    <div className="xg">
      <div className={`xg-bar${placed ? '' : ' off'}`}>{placed && <i style={{ left: `${landed}%` }} />}</div>
      <div className="xg-ends"><span>Sour</span><b className={bad ? 'bad' : ''}>{bad ? badLabel : landedLabel(landed)}</b><span>Bitter</span></div>
    </div>
  )
}
