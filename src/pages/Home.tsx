import { useLayoutEffect, useRef, useState } from 'react'
import { FlavorRadar } from '../components/charts.tsx'
import { MiniLanded } from '../components/Landed.tsx'
import { PageHead } from '../components/Shell.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import { SampleDataBanner } from '../components/SampleDataBanner.tsx'
import { bagStatus, daysOffRoast, usualDose } from '../data/beans.ts'
import { dayKey, dayOf, isoDaysAgo, timeOf, whenText } from '../data/dates.ts'
import { LANDED_BALANCED, landedLabel, mmss, ratioText } from '../data/taste.ts'
import type { Bean, Brew, DialinStart, Route, Shot, Units } from '../types.ts'

const TREND_DAYS   = 14
const RECENT_DAYS  = 3      // bars drawn brighter
const RECENT_ITEMS = 3
const FAVORITES_PER_PAGE = 4
const RADAR_SIZE   = 190
const NOON = 12
const EVENING = 17
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const GREETINGS: readonly [number, string][] = [[NOON, 'Good morning.'], [EVENING, 'Good afternoon.']]
const FALLBACK_DOSE = 18
const RATING_DECIMALS = 1
const PERCENT = 100
const HALF = 2

export interface HomeProps {
  shots: Shot[]
  brews: Brew[]
  beans: Bean[]
  units: Units
  goTo:  (route: Route, id?: string) => void
  onRepull:      (shot: Shot) => void
  onStartDialin: (start: DialinStart) => void
  onAddBag:      () => void     // Beans with the new-bag form open
  showSampleBanner?: boolean
  onRemoveSampleData?: () => Promise<void>
  onKeepSampleData?:   () => void
}

/** The landed label, centered under the bar's mark but never past either end of the bar */
function MarkLabel({ at, text }: { at: number; text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const bar = el?.parentElement
    if (!el || !bar) return
    const place = () => {
      const w = el.offsetWidth
      const room = bar.clientWidth - w
      el.style.left = `${Math.min(room, Math.max(0, (at / PERCENT) * bar.clientWidth - w / HALF))}px`
    }
    place()
    document.fonts?.ready.then(place)   // the label gets a little wider or narrower once the font loads
  }, [at, text])
  return <div ref={ref} className="lbl">{text}</div>
}

const avg = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const fmt1 = (n: number | null): string => n == null ? '–' : n.toFixed(RATING_DECIMALS)

type Item = (Shot & { kind: 'shot' }) | (Brew & { kind: 'brew' })

export default function Home({ shots, brews, beans, units, goTo, onRepull, onStartDialin, onAddBag, showSampleBanner, onRemoveSampleData, onKeepSampleData }: HomeProps) {
  const U = useUnits(units)
  const now = new Date()
  const [page, setPage] = useState(0)
  const hour = now.getHours()
  const greeting = GREETINGS.find(([until]) => hour < until)?.[1] ?? 'Good evening.'
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const last = shots[0]
  const lastBean = last ? beans.find(b => b.id === last.bean_id) : undefined
  const lastDays = lastBean && last ? daysOffRoast(lastBean, dayOf(last.date)) : null

  // This week: Monday to now, compared with the week before
  const weekStart = isoDaysAgo(now.getDay() === 0 ? DAY_LETTERS.length - 1 : now.getDay() - 1, now)
  const prevStart = isoDaysAgo((now.getDay() === 0 ? DAY_LETTERS.length - 1 : now.getDay() - 1) + DAY_LETTERS.length, now)
  const inWeek = (d: string) => dayKey(d) >= weekStart
  const inPrev = (d: string) => dayKey(d) >= prevStart && dayKey(d) < weekStart
  const weekShots = shots.filter(s => inWeek(s.date))
  const weekBrews = brews.filter(b => inWeek(b.date))
  const shotAvg = avg(weekShots.map(s => s.rating))
  const prevShotAvg = avg(shots.filter(s => inPrev(s.date)).map(s => s.rating))
  const brewAvg = avg(weekBrews.map(b => b.rating))
  const delta = shotAvg != null && prevShotAvg != null ? shotAvg - prevShotAvg : null

  const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const day = isoDaysAgo(TREND_DAYS - 1 - i, now)
    return {
      day,
      letter: DAY_LETTERS[dayOf(day).getDay()]!,
      sunday: dayOf(day).getDay() === 0,
      count: shots.filter(s => dayKey(s.date) === day).length + brews.filter(b => dayKey(b.date) === day).length,
    }
  })
  const maxCount = Math.max(1, ...trend.map(t => t.count))
  const barClass = (i: number): string => {
    if (i === TREND_DAYS - 1) return 'today'
    return i >= TREND_DAYS - RECENT_DAYS ? 'recent' : ''
  }

  const recent: Item[] = [
    ...shots.slice(0, RECENT_ITEMS).map(s => ({ ...s, kind: 'shot' as const })),
    ...brews.slice(0, RECENT_ITEMS).map(b => ({ ...b, kind: 'brew' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_ITEMS)

  const favorites: Item[] = [
    ...shots.filter(s => s.favorited).map(s => ({ ...s, kind: 'shot' as const })),
    ...brews.filter(b => b.favorited).map(b => ({ ...b, kind: 'brew' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const pages = Math.max(1, Math.ceil(favorites.length / FAVORITES_PER_PAGE))
  const shownPage = Math.min(page, pages - 1)

  const openBags = [...beans].sort((a, b) => (daysOffRoast(a) ?? Infinity) - (daysOffRoast(b) ?? Infinity))
  const totalLeft = beans.reduce((a, b) => a + (b.remaining || 0), 0)
  const fallbackDose = last?.dose || FALLBACK_DOSE

  const itemLine = (it: Item) => it.kind === 'shot'
    ? `${it.bean || 'Espresso'} espresso, ${U.m(it.dose)} → ${U.m(it.yield)} ${U.mU()} in ${it.time} s`
    : `${it.bean || 'Filter'} ${it.dripper || 'filter'}, ${U.m(it.dose)} → ${U.m(it.water)} ${U.mU()} in ${mmss(it.time)}`
  const openItem = (it: Item) => goTo(it.kind === 'shot' ? 'shot-history' : 'brew-history', it.id)

  return (
    <div className="stack">
      <PageHead title={greeting} sub={dateStr}>
        <button className="ghost-btn lg" onClick={() => onStartDialin({ mode: 'filter' })}><Ico name="dripper" size={15} /> Brew filter</button>
      </PageHead>

      {showSampleBanner && onRemoveSampleData && onKeepSampleData && (
        <SampleDataBanner onRemove={onRemoveSampleData} onKeep={onKeepSampleData} />
      )}

      <div className="home-top">
        <div className="card">
          <div className="card-head"><span className="card-title">Last shot</span>{last && <span>{whenText(last.date, now)}</span>}</div>
          {!last ? (
            <div className="stack" style={{ gap: '14px', alignItems: 'flex-start' }}>
              <div className="empty">No shots yet. Pull one and it shows up here.</div>
              <button className="primary-btn" onClick={() => onStartDialin({ mode: 'espresso' })}><Ico name="plus" size={15} /> Pull a shot</button>
            </div>
          ) : (
            <div className="hero">
              <div style={{ minWidth: 0 }}>
                <div className="hero-name">{last.bean || 'Espresso'}</div>
                <div className="hero-sub">{[last.roaster, lastDays != null && `${lastDays} days off roast`].filter(Boolean).join(', ')}</div>
                <div className="hero-nums">
                  {U.m(last.dose)}<small>{U.mU()}</small><span className="arrow">→</span>{U.m(last.yield)}<small>{U.mU()} in</small>{last.time}<small>s</small>
                </div>
                <dl className="hero-facts">
                  <div><dt>Ratio</dt><dd className="accent">{ratioText(last.dose, last.yield)}</dd></div>
                  {last.basket && <div><dt>Basket</dt><dd>{last.basket}</dd></div>}
                  {last.temp > 0 && <div><dt>Temperature</dt><dd>{U.t(last.temp)} {U.tU()}</dd></div>}
                  {last.grind > 0 && <div><dt>Grind</dt><dd>{last.grind}</dd></div>}
                </dl>
                <div className="hero-land">
                  <span className="stat">{last.rating.toFixed(RATING_DECIMALS)}</span>
                  <div className="hero-land-bar">
                    <MiniLanded landed={last.landed} bad={last.bad} />
                    {!last.bad && <MarkLabel at={last.landed ?? LANDED_BALANCED} text={landedLabel(last.landed)} />}
                  </div>
                </div>
                {last.notes && <div className="hero-quote">“{last.notes}”</div>}
                <div className="hero-actions">
                  <button className="primary-btn" onClick={() => onRepull(last)}><Ico name="history" size={15} /> Pull again</button>
                  <button className="ghost-btn lg" onClick={() => goTo('shot-history', last.id)}>Open shot</button>
                </div>
              </div>
              <div className="radar"><FlavorRadar taste={last.taste} size={RADAR_SIZE} /></div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">This week</span></div>
          <div className="week-row">
            <span className="stat">{weekShots.length}</span>
            <span className="lbl">{weekShots.length === 1 ? 'shot' : 'shots'}{shotAvg != null && `, average ${fmt1(shotAvg)}`}</span>
            {delta != null && <span className={`delta${delta < 0 ? ' down' : ''}`}>{delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(RATING_DECIMALS)}</span>}
          </div>
          <div className="week-row" style={{ marginTop: '8px' }}>
            <span className="stat">{weekBrews.length}</span>
            <span className="lbl">{weekBrews.length === 1 ? 'brew' : 'brews'}{brewAvg != null && `, average ${fmt1(brewAvg)}`}</span>
          </div>
          <div className="week-bars" title="Coffees per day, last 14 days">
            {trend.map((t, i) => (
              <i key={t.day} className={barClass(i)}
                style={{ height: `${(t.count / maxCount) * PERCENT}%` }} title={`${t.day}: ${t.count}`} />
            ))}
          </div>
          <div className="week-days">{trend.map(t => <span key={t.day} className={t.sunday ? 'sun' : undefined}>{t.letter}</span>)}</div>
          {recent.length > 0 && (
            <div className="mini-list">
              {recent.map(it => (
                <button key={it.id} className="mini-item" onClick={() => openItem(it)}>
                  <span className="t">{timeOf(it.date)}</span>
                  <span className="d">{itemLine(it)}</span>
                  <span className="s">{it.rating.toFixed(RATING_DECIMALS)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open bags and favorites side by side, so Home fits a desktop window */}
      <div className={`home-low${favorites.length ? '' : ' solo'}`}>
      <div className="card">
        <div className="card-head">
          <span className="card-title">Open bags</span>
          <span>{beans.length} {beans.length === 1 ? 'bag' : 'bags'}, {Math.ceil(parseFloat(U.m(totalLeft)))} {U.mU()} in total</span>
        </div>
        <div className="bags-row">
          {openBags.map(b => {
            const pct = b.weight > 0 ? Math.min(PERCENT, (b.remaining / b.weight) * PERCENT) : 0
            return (
              <button key={b.id} className="bag-tile" title="Dial in with this bag" onClick={() => onStartDialin({ mode: 'espresso', beanId: b.id })}>
                <span className="nm">{b.name}</span>
                <span className="rs">{b.roaster}</span>
                <span className="stock-bar"><i className={b.stock} style={{ width: `${pct}%` }} /></span>
                <span className="ln"><span>{bagStatus(b, usualDose(b, fallbackDose), now)}</span><b>{Math.round(parseFloat(U.m(b.remaining)))} {U.mU()}</b></span>
              </button>
            )
          })}
          <button className="bag-tile add" onClick={onAddBag}>Add a bag</button>
        </div>
      </div>

      {favorites.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Favorites</span><span>{favorites.length}</span>
            {pages > 1 && (
              <div className="pager-sm">
                <button className="icon-btn sm" aria-label="Newer favorites" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}><Ico name="back" size={14} /></button>
                <span>{shownPage + 1} / {pages}</span>
                <button className="icon-btn sm flip" aria-label="Older favorites" disabled={shownPage === pages - 1} onClick={() => setPage(shownPage + 1)}><Ico name="back" size={14} /></button>
              </div>
            )}
          </div>
          <div className="mini-list" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}>
            {favorites.slice(shownPage * FAVORITES_PER_PAGE, (shownPage + 1) * FAVORITES_PER_PAGE).map(it => (
              <button key={it.id} className="mini-item" onClick={() => openItem(it)}>
                <span className="t">{dayKey(it.date).slice('YYYY-'.length)}</span>
                <span className="d">{itemLine(it)}</span>
                <span className="s">{it.rating.toFixed(RATING_DECIMALS)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
