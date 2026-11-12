import { useState } from 'react'
import Ico from '../components/Ico.tsx'
import { PageHead } from '../components/Shell.tsx'
import { LandedGauge, LandedSlider, MiniLanded } from '../components/Landed.tsx'
import { FreezerSwitch, Frost } from '../components/Frost.tsx'
import { useUnits, type UnitHelpers } from '../hooks/useUnits.ts'
import { beanFreshness, daysOffRoast, FRESHNESS_TEXT, frozenSinceText, priceText, type Freshness } from '../data/beans.ts'
import { dayOf, shortDay, timeOf } from '../data/dates.ts'
import { mmss, ratingOrder, ratingText, ratioText } from '../data/taste.ts'
import type { Bean, Brew, Design, Route, Shot, Units } from '../types.ts'

// One bag on its own page: what it is and what's left, its best shot so far, how the grind
// moved across the bag, how the rating went with days off roast, and every coffee made with it.
// Opened from Beans (Refined: a click on the card; Extraction: a second click on the picked bag).

const ICON = 14
const PERCENT = 100
const RATING_MAX = 10
const ROWS_SHOWN = 20        // coffees in the table before "Show all"
const PEAK_MARGIN = 0.5      // days rated within this of the best day count as its best stretch
const SOUR_BELOW = 40        // the same split as the verdict (server/taste.ts)
const BITTER_ABOVE = 60
const GRIND_DECIMALS = 1
const FINE_DECIMALS = 2
const HALF = 2
const SQUARE = 2
const STAR_ICON = 12

// The grind chart, in SVG units (it scales with its column)
const CHART_W = 340
const CHART_H = 190
const PAD_L = 34
const PAD_R = 10
const PAD_T = 12
const PAD_B = 14
const DOT_R = 5
const BEST_DOT_R = 7.5
const LABEL_X = 0
const LABEL_DY = 4

type Coffee = (Shot & { kind: 'shot' }) | (Brew & { kind: 'brew' })

interface BeanPageProps {
  bean:       Bean | undefined
  shots:      Shot[]
  brews:      Brew[]
  units:      Units
  design:     Design
  goTo:       (route: Route, id?: string) => void
  onBack:     () => void
  onDialIn:   (bean: Bean) => void
  onEdit:     (bean: Bean) => void
  onFreeze:   (bean: Bean, frozen: boolean) => void
  onRepull:   (shot: Shot) => void
  onRebrew:   (brew: Brew) => void
}

/** Days off roast on the day a coffee was made */
const dayOfBag = (bean: Bean, c: Coffee): number | null => daysOffRoast(bean, dayOf(c.date))

/** Where it landed, as a color group for the chart's dots */
function tone(c: Coffee): string {
  if (c.bad) return 'bad'
  if (c.landed == null) return 'none'
  if (c.landed < SOUR_BELOW) return 'sour'
  return c.landed > BITTER_ABOVE ? 'bitter' : 'balanced'
}

const average = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/** Straight line through the points (least squares); null when every x is the same */
function trendLine(points: readonly { x: number; y: number }[]): { slope: number; at: (x: number) => number } | null {
  const mx = average(points.map(p => p.x))
  const my = average(points.map(p => p.y))
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** SQUARE, 0)
  if (sxx === 0) return null
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx
  return { slope, at: x => my + slope * (x - mx) }
}

/** 'today', 'yesterday', 'Saturday', '18 Apr': only the first two go lowercase after a comma */
function dayWord(date: string): string {
  const day = shortDay(date)
  return day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day
}

/** An axis label: one decimal, or two when the settings are close together (2.45 between 2.4 and 2.5) */
const grindLabel = (y: number, span: number): string => String(Number(y.toFixed(span < 1 ? FINE_DECIMALS : GRIND_DECIMALS)))

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

export function BeanPage({ bean, shots, brews, units, design, goTo, onBack, onDialIn, onEdit, onFreeze, onRepull, onRebrew }: BeanPageProps) {
  const U = useUnits(units)
  const [showAll, setShowAll] = useState(false)

  if (!bean) {
    return (
      <div className="stack bag-page">
        <PageHead title="Bag not found." onBack={onBack} />
        <div className="card empty">This bag isn't here any more. It may have been deleted.</div>
      </div>
    )
  }

  const bagShots: Coffee[] = shots.filter(s => s.bean_id === bean.id).map(s => ({ ...s, kind: 'shot' as const }))
  const bagBrews: Coffee[] = brews.filter(b => b.bean_id === bean.id).map(b => ({ ...b, kind: 'brew' as const }))
  const all = [...bagShots, ...bagBrews].sort((a, b) => b.date.localeCompare(a.date))
  // The charts follow the shots; a bag only ever brewed as filter shows its brews instead
  const charted = bagShots.length ? bagShots : bagBrews
  const noun = bagShots.length || !bagBrews.length ? 'shot' : 'brew'

  const extraction = design === 'extraction'
  const archived = Boolean(bean.archived)
  const sub = [bean.roaster, bean.origin?.replace(' · ', ', '), bean.process?.toLowerCase(), bean.roast && `${bean.roast.toLowerCase()} roast`].filter(Boolean).join(', ')

  return (
    <div className="stack bag-page">
      <PageHead title={bean.name} sub={sub} onBack={onBack}>
        {!archived && <button className="primary-btn" onClick={() => onDialIn(bean)}>Dial in</button>}
        <button className="ghost-btn lg" onClick={() => onEdit(bean)}><Ico name="pencil" size={ICON} /> Edit</button>
      </PageHead>

      <BagPills bean={bean} shots={bagShots} brews={bagBrews} U={U} onFreeze={archived ? undefined : onFreeze} />

      <div className="bag-cols">
        <BestSoFar bean={bean} coffees={charted} noun={noun} U={U} extraction={extraction} onRepull={onRepull} onRebrew={onRebrew} />
        <GrindChart bean={bean} coffees={charted} noun={noun} />
        <RatingByDay bean={bean} coffees={charted} noun={noun} />
      </div>

      <section className="bag-sec bag-all">
        <div className="bag-lbl"><b>{all.length ? `All ${plural(all.length, 'coffee', 'coffees')} with ${bean.name}` : `Nothing made with ${bean.name} yet`}</b>{all.length > 0 && ', newest first'}</div>
        {all.length > 0 && (
          <div className="bag-table">
            <div className="bag-row head"><span>Day</span><span>When</span><span>Recipe</span><span>Time</span><span>Grind</span><span>Landed</span><span className="r">Rating</span></div>
            {(showAll ? all : all.slice(0, ROWS_SHOWN)).map(c => (
              <button key={`${c.kind}-${c.id}`} className="bag-row" onClick={() => goTo(c.kind === 'shot' ? 'shot-history' : 'brew-history', c.id)}>
                <span>{dayOfBag(bean, c) ?? '–'}</span>
                <span className="w">{shortDay(c.date)} <small>{timeOf(c.date)}</small>{c.favorited && <Ico name="star" size={STAR_ICON} style={{ fill: 'currentColor' }} />}</span>
                <b>{U.m(c.dose)} → {U.m(c.kind === 'shot' ? c.yield : c.water)}</b>
                <em>{c.kind === 'shot' ? `${c.time} s` : mmss(c.time)}</em>
                <span>{c.grind || '–'}</span>
                <span><MiniLanded landed={c.landed} bad={c.bad} badLabel={c.kind === 'shot' ? 'Bad shot' : 'Bad brew'} /></span>
                <span className="r">{c.rating == null ? <span className="quick-tag">Quick</span> : ratingText(c.rating)}</span>
              </button>
            ))}
          </div>
        )}
        {!showAll && all.length > ROWS_SHOWN && <button className="link-btn" onClick={() => setShowAll(true)}>Show all {all.length}</button>}
      </section>
    </div>
  )
}

// ── Pills: freshness, what's left, how much was made, price ──

const PILL_TONE: Record<Freshness, string> = { resting: '', window: 'ok', aging: '', past: '', frozen: 'ice' }

function BagPills({ bean, shots, brews, U, onFreeze }: { bean: Bean; shots: Coffee[]; brews: Coffee[]; U: UnitHelpers; onFreeze?: (bean: Bean, frozen: boolean) => void }) {
  const days = daysOffRoast(bean)
  const fresh = beanFreshness(bean)
  const whole = (g: number) => Math.round(parseFloat(U.m(g)))
  const freshText = bean.frozen_at ? `In the freezer, ${frozenSinceText(bean)}` : fresh && days != null && `Day ${days}, ${FRESHNESS_TEXT[fresh]}`
  const made = [shots.length && plural(shots.length, 'shot', 'shots'), brews.length && plural(brews.length, 'brew', 'brews')].filter(Boolean).join(', ')
  return (
    <div className={`bag-pills${bean.frozen_at ? ' frozen' : ''}`}>
      {bean.frozen_at && <Frost bean={bean} />}
      {bean.archived ? <span>Finished{bean.archived_at ? ` ${shortDay(bean.archived_at)}` : ''}</span> : null}
      {freshText && <span className={fresh ? PILL_TONE[fresh] : ''}>{freshText}</span>}
      {!bean.archived && <span>{whole(bean.remaining)} {U.mU()} left</span>}
      {made && <span>{made}</span>}
      {bean.price > 0 && <span>{priceText(bean.price, U.cur())}{bean.weight > 0 && ` for ${whole(bean.weight)} ${U.mU()}`}</span>}
      {onFreeze && <FreezerSwitch bean={bean} onChange={on => onFreeze(bean, on)} />}
    </div>
  )
}

// ── Best so far ──

interface BestProps {
  bean:       Bean
  coffees:    Coffee[]
  noun:       string
  U:          UnitHelpers
  extraction: boolean
  onRepull:   (shot: Shot) => void
  onRebrew:   (brew: Brew) => void
}

function BestSoFar({ bean, coffees, noun, U, extraction, onRepull, onRebrew }: BestProps) {
  const best = coffees.filter(c => c.rating != null && !c.bad)
    .sort((a, b) => ratingOrder(b.rating) - ratingOrder(a.rating) || b.date.localeCompare(a.date))[0]
  if (!best) {
    return (
      <section className="bag-sec">
        <div className="bag-lbl"><b>Best so far</b></div>
        <p className="bag-cap">Rate a {noun} with this bag and the best one shows up here, ready to start from.</p>
      </section>
    )
  }
  const day = dayOfBag(bean, best)
  const out = best.kind === 'shot' ? best.yield : best.water
  const facts = [
    { k: 'Ratio', v: ratioText(best.dose, out, best.kind === 'shot' ? 'espresso' : 'filter') },
    { k: 'Grind', v: best.grind ? String(best.grind) : '' },
    { k: 'Temp', v: best.temp ? `${U.t(best.temp)} ${U.tU()}` : '' },
    { k: best.kind === 'shot' ? 'Basket' : 'Dripper', v: (best.kind === 'shot' ? best.basket : best.dripper) || '' },
  ].filter(f => f.v)
  const again = () => (best.kind === 'shot' ? onRepull(best) : onRebrew(best))
  return (
    <section className="bag-sec bag-best">
      <div className="bag-lbl"><b>Best so far</b>{day != null && `, day ${day}`}, {dayWord(best.date)}</div>
      <div className="bag-rec">
        <span className="bag-num">{U.m(best.dose)}</span><span className="u">{U.mU()}</span>
        <span className="arr">→</span>
        <span className="bag-num">{U.m(out)}</span><span className="u">{U.mU()}</span>
      </div>
      <div className="bag-tm">
        <span className="bag-num t">{best.kind === 'shot' ? best.time : mmss(best.time)}</span>{best.kind === 'shot' && <span className="u">s</span>}
        <span className="bag-score"><span className="bag-num">{ratingText(best.rating)}</span><span>/ {RATING_MAX}</span></span>
      </div>
      {extraction
        ? <LandedGauge landed={best.landed} bad={best.bad} />
        : <LandedSlider landed={best.landed} bad={best.bad} title="Landed" />}
      {facts.length > 0 && <dl className="bag-facts">{facts.map(f => <div key={f.k}><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>}
      <button className="primary-btn" onClick={again}><Ico name="history" size={ICON} /> Start from this {noun}</button>
    </section>
  )
}

// ── Grind across the bag ──

function GrindChart({ bean, coffees, noun }: { bean: Bean; coffees: Coffee[]; noun: string }) {
  const points = coffees
    .map(c => ({ c, x: dayOfBag(bean, c), y: c.grind }))
    .filter((p): p is { c: Coffee; x: number; y: number } => p.x != null && p.y > 0)
    .sort((a, b) => a.c.date.localeCompare(b.c.date))
  const title = <div className="bag-lbl"><b>Grind across the bag</b>, each dot a {noun}</div>
  if (points.length < HALF) {
    return (
      <section className="bag-sec">
        {title}
        <p className="bag-cap">{bean.roast_date ? `Log two ${noun}s with a grind setting and the chart starts.` : 'Add the roast date to the bag to see this by days off roast.'}</p>
      </section>
    )
  }
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const sx = (x: number) => PAD_L + ((x - minX) / spanX) * (CHART_W - PAD_L - PAD_R)
  // Higher settings at the top
  const sy = (y: number) => PAD_T + (1 - (y - minY) / spanY) * (CHART_H - PAD_T - PAD_B)
  const line = trendLine(points)
  const best = points.filter(p => p.c.rating != null && !p.c.bad)
    .sort((a, b) => ratingOrder(b.c.rating) - ratingOrder(a.c.rating))[0]
  const first = points[0]!
  const last = points[points.length - 1]!
  const balanced = points.filter(p => tone(p.c) === 'balanced')
  const lastBalanced = balanced[balanced.length - 1]
  const midY = (minY + maxY) / HALF
  const yLabels = [maxY, midY, minY]

  return (
    <section className="bag-sec">
      {title}
      <svg className="bag-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img"
        aria-label={`Grind setting per ${noun} by days off roast, from ${first.y} on day ${first.x} to ${last.y} on day ${last.x}`}>
        {yLabels.map(y => (
          <g key={y}>
            <path className="grid" d={`M${PAD_L} ${sy(y)}H${CHART_W - PAD_R}`} />
            <text x={LABEL_X} y={sy(y) + LABEL_DY}>{grindLabel(y, spanY)}</text>
          </g>
        ))}
        {line && <path className="trend" d={`M${sx(minX)} ${sy(line.at(minX))}L${sx(maxX)} ${sy(line.at(maxX))}`} />}
        {points.map(p => (
          <circle key={`${p.c.kind}-${p.c.id}`} className={`dot ${tone(p.c)}${p === best ? ' best' : ''}`}
            cx={sx(p.x)} cy={sy(p.y)} r={p === best ? BEST_DOT_R : DOT_R}>
            <title>{`Day ${p.x}: grind ${p.y}, ${p.c.rating == null ? 'not tasted' : `rated ${ratingText(p.c.rating)}`}`}</title>
          </circle>
        ))}
      </svg>
      <div className="bag-x"><span>day {minX}</span>{maxX - minX > 1 && <span>day {Math.round((minX + maxX) / HALF)}</span>}<span>day {maxX}</span></div>
      <div className="bag-legend"><span><i className="sour" />sour</span><span><i className="balanced" />balanced</span><span><i className="bitter" />bitter</span>{best && <span><i className="best" />best</span>}</div>
      <p className="bag-cap">
        {first.y === last.y ? <>Grind stayed at <b>{last.y}</b></> : <>Grind went from <b>{first.y}</b> on day {first.x} to <b>{last.y}</b> on day {last.x}</>}.
        {lastBalanced && <> Your last balanced {noun} was at <b>{lastBalanced.y}</b>.</>}
      </p>
    </section>
  )
}

// ── Rating by days off roast ──

function RatingByDay({ bean, coffees, noun }: { bean: Bean; coffees: Coffee[]; noun: string }) {
  const rated = coffees
    .map(c => ({ day: dayOfBag(bean, c), rating: c.bad ? null : c.rating }))
    .filter((r): r is { day: number; rating: number } => r.day != null && r.rating != null)
  const title = <div className="bag-lbl"><b>Rating by days off roast</b></div>
  const days = [...new Set(rated.map(r => r.day))].sort((a, b) => a - b)
  if (days.length < HALF) {
    return (
      <section className="bag-sec">
        {title}
        <p className="bag-cap">{bean.roast_date ? `Rate ${noun}s on two different days and you'll see when this bag tasted best.` : 'Add the roast date to the bag to see this.'}</p>
      </section>
    )
  }
  const first = days[0]!
  const lastDay = days[days.length - 1]!
  const span = Array.from({ length: lastDay - first + 1 }, (_, i) => first + i)
  const avgOn = (day: number): number | null => {
    const on = rated.filter(r => r.day === day).map(r => r.rating)
    return on.length ? average(on) : null
  }
  const bars = span.map(day => ({ day, avg: avgOn(day) }))
  const top = Math.max(...bars.map(b => b.avg ?? 0))
  const peak = bars.filter(b => b.avg != null && b.avg >= top - PEAK_MARGIN)
  const peakFrom = peak[0]!.day
  const peakTo = peak[peak.length - 1]!.day
  const peakAvg = average(rated.filter(r => r.day >= peakFrom && r.day <= peakTo).map(r => r.rating))
  const labels = [first, Math.round((first + lastDay) / HALF), lastDay].filter((d, i, a) => a.indexOf(d) === i)

  return (
    <section className="bag-sec">
      {title}
      <div className="bag-bars">
        {bars.map(b => (
          <i key={b.day} className={b.avg != null && b.day >= peakFrom && b.day <= peakTo ? 'pk' : ''}
            style={{ height: `${((b.avg ?? 0) / RATING_MAX) * PERCENT}%` }}
            title={b.avg == null ? `Day ${b.day}: nothing rated` : `Day ${b.day}: ${ratingText(b.avg)}`} />
        ))}
      </div>
      <div className="bag-x">{labels.map(d => <span key={d}>day {d}</span>)}</div>
      <p className="bag-cap">
        Best {peakFrom === peakTo ? <>on <b>day {peakFrom}</b></> : <>between <b>day {peakFrom} and {peakTo}</b></>}, average <b>{ratingText(peakAvg)}</b>.
      </p>
    </section>
  )
}
