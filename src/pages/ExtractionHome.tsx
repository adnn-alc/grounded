import { useState, type CSSProperties } from 'react'
import Ico from '../components/Ico.tsx'
import { SampleDataBanner } from '../components/SampleDataBanner.tsx'
import { CareReminder } from '../components/Care.tsx'
import { Frost } from '../components/Frost.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import { bagColor, daysOffRoast, usualDose } from '../data/beans.ts'
import { LandedGauge, MiniLanded } from '../components/Landed.tsx'
import { dayKey, dayOf, isoDaysAgo, shortDay, timeOf, whenText } from '../data/dates.ts'
import { mmss, ratingsOf, ratingText, ratioText } from '../data/taste.ts'
import type { Bean, Brew, Shot } from '../types.ts'
import type { HomeProps } from './Home.tsx'

// Extraction's Home: the last shot in big numbers with where it landed, its
// rating and the last 10 days beside it, this week as a strip of four numbers,
// then the open bags as a shelf filled to what's left, next to your favorites.

const WEEK = 7
const NOON = 12
const EVENING = 17
const FALLBACK_DOSE = 18
const RATING_DECIMALS = 1
const PERCENT = 100
const FEW_SHOTS = 3
const ICON_SM = 15
const FAVORITES_PER_PAGE = 4
const TREND_DAYS = 10
const RECENT_DAYS = 3      // bars drawn brighter
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const PARTS_OF_DAY: readonly [number, string][] = [[NOON, 'morning'], [EVENING, 'afternoon']]

const avg = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

type Item = (Shot & { kind: 'shot' }) | (Brew & { kind: 'brew' })

/** '18 → 53 g, 31 s' for a shot, '15 → 250 g, 3:05' for a brew */
function itemNums(it: Item, U: ReturnType<typeof useUnits>): string {
  const out = it.kind === 'shot' ? it.yield : it.water
  const time = it.kind === 'shot' ? `${it.time} s` : mmss(it.time)
  return `${parseFloat(U.m(it.dose))} → ${parseFloat(U.m(out))} ${U.mU()}, ${time}`
}

/** Coffees per day for the last 10 days, today brightest, Sundays marked in red */
function Activity({ items, now }: { items: { date: string }[]; now: Date }) {
  const days = Array.from({ length: TREND_DAYS }, (_, i) => {
    const day = isoDaysAgo(TREND_DAYS - 1 - i, now)
    const weekday = dayOf(day).getDay()
    return { day, letter: DAY_LETTERS[weekday]!, sunday: weekday === 0, count: items.filter(x => dayKey(x.date) === day).length }
  })
  const max = Math.max(1, ...days.map(d => d.count))
  const total = days.reduce((a, d) => a + d.count, 0)
  const barClass = (i: number): string => {
    if (i === TREND_DAYS - 1) return 'today'
    return i >= TREND_DAYS - RECENT_DAYS ? 'recent' : ''
  }
  return (
    <div className="xact">
      <div className="xlbl"><b>Last {TREND_DAYS} days</b>, {plural(total, 'coffee', 'coffees')}</div>
      <div className="xact-bars">
        {days.map((d, i) => <i key={d.day} className={barClass(i)} style={{ height: `${(d.count / max) * PERCENT}%` }} title={`${d.day}: ${d.count}`} />)}
      </div>
      <div className="xact-days">{days.map(d => <span key={d.day} className={d.sunday ? 'sun' : undefined}>{d.letter}</span>)}</div>
    </div>
  )
}

/** Under a bag: how many shots when it's nearly gone, 'frozen' in the freezer, else how many days off roast */
function shelfFoot(left: number, days: number | null, frozen: boolean): string {
  if (left < 1) return 'too little'
  if (left < FEW_SHOTS) return plural(left, 'shot', 'shots')
  if (frozen) return 'frozen'
  return days == null ? '' : `day ${days}`
}

function BagOnShelf({ bean, dose, U, onPick }: { bean: Bean; dose: number; U: ReturnType<typeof useUnits>; onPick: () => void }) {
  const pct = bean.weight > 0 ? Math.min(PERCENT, (bean.remaining / bean.weight) * PERCENT) : 0
  const days = daysOffRoast(bean)
  const left = dose > 0 ? Math.floor(bean.remaining / dose) : 0
  const low = bean.stock !== 'good' || left < FEW_SHOTS
  const foot = shelfFoot(left, days, !!bean.frozen_at)
  return (
    <button className={`xbag${low ? ' low' : ''}${bean.frozen_at ? ' frozen' : ''}`} title="Dial in with this bag" onClick={onPick}
      style={{ '--bag': bagColor(bean.id) } as CSSProperties}>
      <span className="xbag-fill" style={{ height: `${pct}%` }} />
      <Frost bean={bean} />
      <span className="xbag-lab">
        <b>{bean.name}</b>
        <span>{bean.roaster}</span>
      </span>
      <span className="xbag-g">{Math.round(parseFloat(U.m(bean.remaining)))} {U.mU()}</span>
      <span className="xbag-d">{foot}</span>
    </button>
  )
}

export default function ExtractionHome({ shots, brews, beans, units, goTo, onRepull, onStartDialin, onAddBag, showSampleBanner, onRemoveSampleData, onKeepSampleData, care }: HomeProps) {
  const U = useUnits(units)
  const [now] = useState(() => new Date())
  const [page, setPage] = useState(0)
  const part = PARTS_OF_DAY.find(([until]) => now.getHours() < until)?.[1] ?? 'evening'
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })

  const today = isoDaysAgo(0, now)
  // This week: Monday to now, compared with the week before (as on Refined's Home)
  const sinceMonday = now.getDay() === 0 ? WEEK - 1 : now.getDay() - 1
  const weekStart = isoDaysAgo(sinceMonday, now)
  const prevStart = isoDaysAgo(sinceMonday + WEEK, now)
  const inWeek = (d: string) => dayKey(d) >= weekStart
  const inPrev = (d: string) => dayKey(d) >= prevStart && dayKey(d) < weekStart
  const weekShots = shots.filter(s => inWeek(s.date))
  const weekBrews = brews.filter(b => inWeek(b.date))
  const coffeesToday = [...shots, ...brews].filter(x => dayKey(x.date) === today).length
  const shotAvg = avg(ratingsOf(weekShots))
  const prevAvg = avg(ratingsOf(shots.filter(s => inPrev(s.date))))
  const brewAvg = avg(ratingsOf(weekBrews))
  const delta = shotAvg != null && prevAvg != null ? shotAvg - prevAvg : null

  const last = shots[0]
  const favorites: Item[] = [
    ...shots.filter(x => x.favorited).map(x => ({ ...x, kind: 'shot' as const })),
    ...brews.filter(x => x.favorited).map(x => ({ ...x, kind: 'brew' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const pages = Math.max(1, Math.ceil(favorites.length / FAVORITES_PER_PAGE))
  const shownPage = Math.min(page, pages - 1)
  const favPage = favorites.slice(shownPage * FAVORITES_PER_PAGE, (shownPage + 1) * FAVORITES_PER_PAGE)
  // Big numbers drop a trailing .0: 18 → 40.2
  const big = (g: number): string => String(parseFloat(U.m(g)))
  const shelf = [...beans].sort((a, b) => (daysOffRoast(a) ?? Infinity) - (daysOffRoast(b) ?? Infinity))
  const totalLeft = beans.reduce((a, b) => a + (b.remaining || 0), 0)
  const fallbackDose = last?.dose || FALLBACK_DOSE

  return (
    <div className="xhome">
      <div className="xhome-top">
        <b>{weekday} {part}</b>
        <span>{plural(coffeesToday, 'coffee', 'coffees')} today, {plural(weekShots.length, 'shot', 'shots')} this week</span>
        <button className="ghost-btn lg" onClick={() => onStartDialin({ mode: 'filter' })}><Ico name="dripper" size={ICON_SM} /> Brew filter</button>
      </div>

      {showSampleBanner && onRemoveSampleData && onKeepSampleData && (
        <SampleDataBanner onRemove={onRemoveSampleData} onKeep={onKeepSampleData} />
      )}

      {care && <CareReminder {...care} />}

      <div className="xhero">
      {!last ? (
        <div className="xhero-empty">
          <div className="xlbl"><b>No shots yet.</b> Pull one and it shows up here in big numbers.</div>
          <button className="primary-btn" onClick={() => onStartDialin({ mode: 'espresso' })}><Ico name="plus" size={ICON_SM} /> Pull a shot</button>
        </div>
      ) : (
        <>
          <div className="xhero-main">
            <div className="xlbl"><b>Last shot</b>, {whenText(last.date, now)}</div>
            <div className="xrecipe">
              <span className="xnum">{big(last.dose)}</span><span className="xu">{U.mU()}</span>
              <span className="xarr">→</span>
              <span className="xnum">{big(last.yield)}</span><span className="xu">{U.mU()}</span>
              <span className="xnum t">{last.time}</span><span className="xu">s</span>
            </div>
            <dl className="xfacts">
              <div><dt>Ratio</dt><dd className="accent">{ratioText(last.dose, last.yield)}</dd></div>
              {last.basket && <div><dt>Basket</dt><dd>{last.basket}</dd></div>}
              {last.temp > 0 && <div><dt>Temperature</dt><dd>{U.t(last.temp)} {U.tU()}</dd></div>}
              {last.grind > 0 && <div><dt>Grind</dt><dd>{last.grind}</dd></div>}
            </dl>
            <LandedGauge landed={last.landed} bad={Boolean(last.bad)} />
          </div>
          <div className="xhero-side">
            <div className="xscore"><span className="xnum">{ratingText(last.rating, RATING_DECIMALS)}</span><span>/ 10</span></div>
            <div className="xbean">{[last.bean || 'Espresso', last.roaster].filter(Boolean).join(', ')}</div>
            {last.notes && <div className="xnote">{last.notes}</div>}
            <div className="xacts">
              <button className="primary-btn" onClick={() => onRepull(last)}>Pull again</button>
              <button className="ghost-btn lg" onClick={() => goTo('shot-history', last.id)}>Details</button>
            </div>
          </div>
        </>
      )}
        <Activity items={[...shots, ...brews]} now={now} />
      </div>

      <div className="xstrip">
        <div><span className="xnum">{weekShots.length}</span><span className="l">{weekShots.length === 1 ? 'shot' : 'shots'} this week</span></div>
        <div>
          <span className="xnum">{shotAvg == null ? '–' : shotAvg.toFixed(RATING_DECIMALS)}{shotAvg != null && <small>avg</small>}</span>
          <span className="l">shot rating{delta != null && <>, <em className={delta < 0 ? 'down' : 'up'}>{delta < 0 ? 'down' : 'up'} {Math.abs(delta).toFixed(RATING_DECIMALS)}</em></>}</span>
        </div>
        <div><span className="xnum">{weekBrews.length}</span><span className="l">filter {weekBrews.length === 1 ? 'brew' : 'brews'} this week</span></div>
        <div>
          <span className="xnum">{brewAvg == null ? '–' : brewAvg.toFixed(RATING_DECIMALS)}{brewAvg != null && <small>avg</small>}</span>
          <span className="l">brew rating</span>
        </div>
      </div>

      <div className="xlow">
        <section>
          <div className="xsec-head">
            <div className="xlbl"><b>On the shelf</b>, {Math.ceil(parseFloat(U.m(totalLeft)))} {U.mU()} across {plural(beans.length, 'bag', 'bags')}</div>
          </div>
          <div className="xshelf">
            {shelf.map(b => <BagOnShelf key={b.id} bean={b} dose={usualDose(b, fallbackDose)} U={U} onPick={() => onStartDialin({ mode: 'espresso', beanId: b.id })} />)}
            <button className="xbag-add" onClick={onAddBag}>Add a bag</button>
          </div>
        </section>
        <section>
          <div className="xsec-head">
            <div className="xlbl"><b>Favorites</b>{favorites.length > 0 && `, ${favorites.length}`}</div>
            {pages > 1 && (
              <div className="xpager">
                <button className="icon-btn sm" aria-label="Newer favorites" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}><Ico name="back" size={ICON_SM} /></button>
                <span>{shownPage + 1} / {pages}</span>
                <button className="icon-btn sm flip" aria-label="Older favorites" disabled={shownPage === pages - 1} onClick={() => setPage(shownPage + 1)}><Ico name="back" size={ICON_SM} /></button>
              </div>
            )}
          </div>
          {favorites.length === 0 ? (
            <div className="xfav-empty">Star a shot or brew in History and it shows up here, ready to pull again.</div>
          ) : (
            <div className="xrecent">
              {favPage.map(it => (
                <button key={it.id} className="xrecent-row" onClick={() => goTo(it.kind === 'shot' ? 'shot-history' : 'brew-history', it.id)}>
                  <span className="when">{shortDay(it.date, now)}<small>{timeOf(it.date)}</small></span>
                  <span className="what">
                    <b>{it.bean || (it.kind === 'shot' ? 'Espresso' : 'Filter')}</b>
                    <span>{it.kind === 'brew' && `${it.dripper || 'Filter'}, `}{itemNums(it, U)}</span>
                  </span>
                  <MiniLanded landed={it.landed} bad={Boolean(it.bad)} badLabel={it.kind === 'shot' ? 'Bad shot' : 'Bad brew'} />
                  <span className="score">{ratingText(it.rating, RATING_DECIMALS)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
