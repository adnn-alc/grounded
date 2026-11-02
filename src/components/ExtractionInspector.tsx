import type { CSSProperties, ReactNode } from 'react'
import Ico from './Ico.tsx'
import { FlavorRadar } from './charts.tsx'
import { LandedGauge } from './Landed.tsx'
import type { HistoryItem, RowNumbers } from './History.tsx'
import { toAmounts } from '../hooks/useDialinForm.ts'
import { wholeMass, type UnitHelpers } from '../hooks/useUnits.ts'
import { whenText } from '../data/dates.ts'
import type { Taste } from '../types.ts'

// Extraction's panel for one shot or brew in History: the recipe in big numbers,
// where it landed, the numbers and gear, then the rating, notes and taste.

const PERCENT = 100
const RADAR_SIZE = 168
const RATING_DECIMALS = 1
const ICON = 14
const STAR = 18

/** One labeled value; rows without a value are left out */
export interface InspectorFact {
  k:      string
  v:      string | null | undefined
  u?:     string     // unit, smaller
  extra?: string     // after the value, muted: '1200 rpm' next to the grinder
}

interface ExtractionInspectorProps {
  kind:        'shot' | 'brew'
  number:      number
  item:        HistoryItem & { taste: Taste }
  record:      RowNumbers
  pills:       string[]          // origin, process, day off roast
  facts:       InspectorFact[]   // the numbers row: ratio, grind, temp…
  gear:        InspectorFact[]   // machine, grinder, water…
  children?:   ReactNode         // under where it landed: a brew's pours
  onClose:     () => void
  onFavorite?: () => void
  onAgain?:    () => void
  onEdit?:     () => void
  onDelete?:   () => void
}

export function ExtractionInspector({ kind, number, item, record, pills, facts, gear, children, onClose, onFavorite, onAgain, onEdit, onDelete }: ExtractionInspectorProps) {
  const word = kind === 'shot' ? 'Shot' : 'Brew'
  const shownFacts = facts.filter(f => f.v)
  const shownGear = gear.filter(f => f.v)
  return (
    <section className="inspector xins">
      <div className="ins-head">
        <button className="icon-btn plain ins-close" aria-label="Back to the list" onClick={onClose}><Ico name="back" size={STAR} /></button>
        <span><b>{word} {number}</b>, {whenText(item.date)}</span>
        {onFavorite && (
          <button className={`icon-btn plain xins-star${item.favorited ? ' on' : ''}`}
            title={item.favorited ? 'Remove from favorites' : 'Add to favorites'} onClick={onFavorite}>
            <Ico name="star" size={STAR} style={item.favorited ? { fill: 'currentColor' } : {}} />
          </button>
        )}
      </div>

      <div className="xins-rec">
        <span className="xnum">{record.dose}</span><span className="xu">{record.unit}</span>
        <span className="xarr">→</span>
        <span className="xnum">{record.out}</span><span className="xu">{record.unit}</span>
        <span className="xnum t">{record.time}</span>{record.timeUnit && <span className="xu">{record.timeUnit}</span>}
      </div>

      <div>
        <div className="xins-name">{item.bean || (kind === 'shot' ? 'Espresso' : 'Filter')}{item.roaster && `, ${item.roaster}`}</div>
        {pills.length > 0 && <div className="xd-facts">{pills.map(p => <span key={p}>{p}</span>)}</div>}
      </div>

      <LandedGauge landed={item.landed} bad={item.bad} badLabel={`Bad ${kind}`} />
      {children}

      {shownFacts.length > 0 && (
        <dl className="xins-spec">
          {shownFacts.map(f => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}{f.u && <small> {f.u}</small>}</dd></div>)}
        </dl>
      )}

      <div className="xins-taste">
        <div className="xins-score">
          <div className={`xscore${item.bad ? ' low' : ''}`}><span className="xnum">{item.rating.toFixed(RATING_DECIMALS)}</span><span>/ 10</span></div>
          {item.notes && <p className="xins-note">{item.notes}</p>}
        </div>
        <FlavorRadar taste={item.taste} size={RADAR_SIZE} />
      </div>

      {shownGear.length > 0 && (
        <dl className="xgear xins-gear">
          {shownGear.map(f => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}{f.extra && <small>{f.extra}</small>}</dd></div>)}
        </dl>
      )}

      <div className="xacts">
        {onAgain && <button className="primary-btn" onClick={onAgain}><Ico name="history" size={ICON} /> {kind === 'shot' ? 'Pull again' : 'Brew again'}</button>}
        {onEdit && <button className="ghost-btn lg" onClick={onEdit}><Ico name="pencil" size={ICON} /> Edit</button>}
        {onDelete && <button className="ghost-btn lg danger" onClick={onDelete}><Ico name="trash" size={ICON} /> Delete</button>}
      </div>
    </section>
  )
}

/** A brew's pours as one bar, a segment per pour sized by its water and labeled with the scale total */
export function PourBar({ totals, full, U }: { totals: number[]; full: number; U: UnitHelpers }) {
  const amounts = toAmounts(totals)
  const steps = Math.max(1, amounts.length - 1)
  return (
    <div className="xpour-bar">
      {amounts.map((a, i) => (
        <i key={i} style={{ width: `${full > 0 ? (a / full) * PERCENT : 0}%`, '--k': String(i / steps) } as CSSProperties}
          title={`${i === 0 ? 'Bloom' : `Pour ${i + 1}`}: to ${wholeMass(U, totals[i] ?? 0)} ${U.mU()}`}>
          <span>{wholeMass(U, totals[i] ?? 0)}{i === amounts.length - 1 && ` ${U.mU()}`}</span>
        </i>
      ))}
    </div>
  )
}
