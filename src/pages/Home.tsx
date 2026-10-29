import { useState, useRef, useLayoutEffect } from 'react'
import { StatCard } from '../components/ui.tsx'
import { WeekTrend } from '../components/charts.tsx'
import { useUnits } from '../hooks/useUnits.ts'
import Ico from '../components/Ico.tsx'
import type { Bean, Brew, Route, Shot, Units } from '../types.ts'

const FAV_GAP = 8          // matches the favorites stack gap
const FAV_MIN_PER_PAGE = 3 // keep paging usable when there are only one or two open bags

interface HomeProps {
  shots: Shot[]
  brews: Brew[]
  beans: Bean[]
  units: Units
  goTo:  (route: Route, id?: string) => void
}

export default function Home({ shots, brews, beans, units, goTo }: HomeProps) {
  const U = useUnits(units)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.'
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  // "this week" = Mon 00:00 to now; "last week" = the Mon–Sun before that
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)

  const weekShots = shots.filter(s => new Date(s.date) >= weekStart)
  const prevWeekShots = shots.filter(s => {
    const d = new Date(s.date)
    return d >= prevWeekStart && d < weekStart
  })

  const weekBrews = brews.filter(b => new Date(b.date) >= weekStart)
  const prevWeekBrews = brews.filter(b => {
    const d = new Date(b.date)
    return d >= prevWeekStart && d < weekStart
  })

  const avgShotRatingWeek = weekShots.length
    ? (weekShots.reduce((a, s) => a + s.rating, 0) / weekShots.length).toFixed(1)
    : null
  const avgShotRatingPrev = prevWeekShots.length
    ? (prevWeekShots.reduce((a, s) => a + s.rating, 0) / prevWeekShots.length).toFixed(1)
    : null
  const shotRatingDelta = avgShotRatingWeek && avgShotRatingPrev
    ? (parseFloat(avgShotRatingWeek) - parseFloat(avgShotRatingPrev)).toFixed(1)
    : null

  const avgBrewRatingWeek = weekBrews.length
    ? (weekBrews.reduce((a, b) => a + b.rating, 0) / weekBrews.length).toFixed(1)
    : null
  const avgBrewRatingPrev = prevWeekBrews.length
    ? (prevWeekBrews.reduce((a, b) => a + b.rating, 0) / prevWeekBrews.length).toFixed(1)
    : null
  const brewRatingDelta = avgBrewRatingWeek && avgBrewRatingPrev
    ? (parseFloat(avgBrewRatingWeek) - parseFloat(avgBrewRatingPrev)).toFixed(1)
    : null

  // today's shots and brews combined
  const todayStr = now.toISOString().slice(0, 10)
  const todayShots = shots.filter(s => s.date.slice(0, 10) === todayStr)
  const todayBrews = brews.filter(b => b.date.slice(0, 10) === todayStr)
  const todayAll = [
    ...todayShots.map(s => ({ ...s, _type: 'shot' as const })),
    ...todayBrews.map(b => ({ ...b, _type: 'brew' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  // 14-day trend: shots + brews combined, count per day
  const TREND_DAYS = 14
  const trendDays = Array.from({ length: TREND_DAYS }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (TREND_DAYS - 1 - i))
    return d.toISOString().slice(0, 10)
  })
  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const trendLabels  = trendDays.map(d => DAY_LETTERS[new Date(d + 'T12:00:00').getDay()])
  const trendSundays = trendDays.map(d => new Date(d + 'T12:00:00').getDay() === 0)
  const trendCounts = trendDays.map(day => {
    const c = shots.filter(s => s.date.slice(0, 10) === day).length
            + brews.filter(b => b.date.slice(0, 10) === day).length
    return c > 0 ? c : null
  })
  const hasTrendData = trendCounts.some(r => r !== null)
  const maxCount = Math.max(1, ...trendCounts.filter((c): c is number => Boolean(c)))
  // round up to next even number above the max (4-5→6, 6-7→8, etc.), minimum 4
  const trendMax = Math.max(4, Math.ceil((maxCount + 1) / 2) * 2)

  // favorites
  const favorites = [
    ...shots.filter(s => s.favorited).map(s => ({ ...s, _type: 'shot' as const })),
    ...brews.filter(b => b.favorited).map(b => ({ ...b, _type: 'brew' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  // Favorites page size: as many rows as fit in the height of the Open bags content.
  // Measures the bags body (not the card) so the grid's equal-height stretch can't feed back into it.
  const [favPage, setFavPage]       = useState(0)
  const [favPerPage, setFavPerPage] = useState(FAV_MIN_PER_PAGE)
  const favListRef  = useRef<HTMLDivElement>(null)
  const bagsBodyRef = useRef<HTMLDivElement>(null)
  const hasFavorites = favorites.length > 0

  useLayoutEffect(() => {
    const list = favListRef.current, bags = bagsBodyRef.current
    if (!list || !bags) return
    const measure = () => {
      const row = list.firstElementChild as HTMLElement | null
      if (!row) return
      const avail = bags.offsetTop + bags.offsetHeight - list.offsetTop
      const fit = Math.floor((avail + FAV_GAP) / (row.offsetHeight + FAV_GAP))
      setFavPerPage(Math.max(FAV_MIN_PER_PAGE, fit))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(bags)
    return () => ro.disconnect()
  }, [hasFavorites])

  const favPageCount = Math.max(1, Math.ceil(favorites.length / favPerPage))
  const favPageIdx   = Math.min(favPage, favPageCount - 1)
  const favVisible   = favorites.slice(favPageIdx * favPerPage, (favPageIdx + 1) * favPerPage)

  // open beans freshness tracker — sort by days post-roast ascending
  const openBeans = [...beans].filter(b => {
    if (!b.roast_date || b.roast_date.trim() === '') return false
    return !isNaN(new Date(b.roast_date).getTime())
  }).sort((a, b) => {
    const da = a.roast_date ? Math.floor((now.getTime() - new Date(a.roast_date).getTime()) / 86400000) : 9999
    const db = b.roast_date ? Math.floor((now.getTime() - new Date(b.roast_date).getTime()) / 86400000) : 9999
    return da - db
  })

  function freshnessInfo(days: number | null) {
    if (days === null) return { label: '—', color: 'var(--text-4)', cls: '' }
    if (days < 7)  return { label: 'too fresh', color: 'var(--text-3)', cls: '' }
    if (days <= 28) return { label: 'in window', color: 'var(--crema)', cls: 'text-crema' }
    if (days <= 42) return { label: 'aging',    color: 'var(--crema-dim)', cls: '' }
    return { label: 'past peak', color: 'var(--bitter)', cls: 'text-bitter' }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="page-title">{greeting}</h1>
        <span className="page-sub">{dateStr}</span>
      </div>

      <div className="grid grid-4">
        <StatCard
          label="Shots this week"
          value={weekShots.length.toString()}
          delta={prevWeekShots.length ? `${weekShots.length - prevWeekShots.length >= 0 ? '+' : ''}${weekShots.length - prevWeekShots.length}` : undefined}
          sub="vs last week"
        />
        <StatCard
          label="Avg shot rating"
          value={avgShotRatingWeek ?? '—'}
          delta={shotRatingDelta ? `${parseFloat(shotRatingDelta) >= 0 ? '+' : ''}${shotRatingDelta}` : undefined}
          sub="this week"
        />
        <StatCard
          label="Brews this week"
          value={weekBrews.length.toString()}
          delta={prevWeekBrews.length ? `${weekBrews.length - prevWeekBrews.length >= 0 ? '+' : ''}${weekBrews.length - prevWeekBrews.length}` : undefined}
          sub="vs last week"
        />
        <StatCard
          label="Avg brew rating"
          value={avgBrewRatingWeek ?? '—'}
          delta={brewRatingDelta ? `${parseFloat(brewRatingDelta) >= 0 ? '+' : ''}${brewRatingDelta}` : undefined}
          sub="this week"
        />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Today</span>
            <span className="card-more">{todayAll.length} {todayAll.length === 1 ? 'coffee' : 'coffees'}</span>
          </div>
          {todayAll.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13, padding: '8px 0' }}>No coffee logged today.</div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {todayAll.map((item) => (
                <div key={item.id} className="shot-card" onClick={() => goTo(item._type === 'shot' ? 'shot-history' : 'brew-history', item.id)}>
                  <div className="num">{item._type === 'shot' ? 'ESP' : 'FLT'}</div>
                  <div>
                    <div className="title">{item.bean} · <span className="text-muted">{item.roaster}</span></div>
                    {item._type === 'shot' ? (
                      <div className="sub">{U.m(item.dose)}{U.mU()} → {U.m(item.yield)}{U.mU()} in {item.time}s · 1:{(item.yield / item.dose).toFixed(2)}</div>
                    ) : (
                      <div className="sub">{U.m(item.dose)}{U.mU()} → {U.m(item.water)}{U.mU()} in {item.time}s · {item.dripper}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="stat stat-sm text-crema">{item.rating.toFixed(1)}</div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge ${item.verdict}`}>{item.verdict}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">14-day trend</span>
          </div>
          {hasTrendData ? (
            <div style={{ marginTop: 10 }}>
              <WeekTrend ratings={trendCounts} labels={trendLabels} max={trendMax} sundays={trendSundays} />
            </div>
          ) : (
            <div className="text-muted" style={{ fontSize: 13, padding: '8px 0' }}>No coffee logged in the past 14 days.</div>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        {/* Favorites */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Favorites</span>
            {hasFavorites && <span className="card-more">{favorites.length}</span>}
            {favPageCount > 1 && (
              <div className="row" style={{ marginLeft: 8, gap: 2 }}>
                <button className="icon-btn" style={{ width: 24, height: 24 }} title="Previous page"
                  disabled={favPageIdx === 0} onClick={() => setFavPage(favPageIdx - 1)}>
                  <Ico name="arrow" size={11} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <span className="mono" style={{ fontSize: 11, minWidth: 34, textAlign: 'center', color: 'var(--text-3)' }}>
                  {favPageIdx + 1}/{favPageCount}
                </span>
                <button className="icon-btn" style={{ width: 24, height: 24 }} title="Next page"
                  disabled={favPageIdx >= favPageCount - 1} onClick={() => setFavPage(favPageIdx + 1)}>
                  <Ico name="arrow" size={11} />
                </button>
              </div>
            )}
          </div>
          {!hasFavorites ? (
            <div className="text-muted" style={{ fontSize: 13, padding: '8px 0' }}>
              No favorites yet. Open a shot or brew in history and tap ★ to pin it here.
            </div>
          ) : (
            <div ref={favListRef} className="stack" style={{ gap: FAV_GAP }}>
              {favVisible.map(item => (
                <div key={item.id} className="shot-card" onClick={() => goTo(item._type === 'shot' ? 'shot-history' : 'brew-history', item.id)}>
                  <div className="num">{item._type === 'shot' ? 'ESP' : 'FLT'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="title">{item.bean} · <span className="text-muted">{item.roaster}</span></div>
                    {item._type === 'shot' ? (
                      <div className="sub">{U.m(item.dose)}{U.mU()} → {U.m(item.yield)}{U.mU()} in {item.time}s · grind {item.grind}</div>
                    ) : (
                      <div className="sub">{U.m(item.dose)}{U.mU()} → {U.m(item.water)}{U.mU()} in {item.time}s · {item.dripper}</div>
                    )}
                    <div className="sub" style={{ color: 'var(--text-4)', marginTop: 2 }}>{item.date.slice(0, 10)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="stat stat-sm text-crema">{item.rating.toFixed(1)}</div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`badge ${item.verdict}`}>{item.verdict}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open bags / freshness tracker */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Open bags</span>
            <span className="card-more">{openBeans.length} {openBeans.length === 1 ? 'bag' : 'bags'}</span>
          </div>
          <div ref={bagsBodyRef}>
          {openBeans.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 13, padding: '8px 0' }}>No beans in stock.</div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {openBeans.map(bean => {
                const days = bean.roast_date
                  ? Math.floor((now.getTime() - new Date(bean.roast_date).getTime()) / 86400000)
                  : null
                const pct = bean.weight > 0 ? Math.min(100, Math.round((bean.remaining / bean.weight) * 100)) : 0
                const { label: freshnessLabel, color: freshnessColor } = freshnessInfo(days)
                return (
                  <div key={bean.id}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {bean.name}
                        </span>
                        <span className="text-muted" style={{ fontSize: 11 }}>{bean.roaster}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {days !== null && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: freshnessColor }}>
                            {days}d · {freshnessLabel}
                          </span>
                        )}
                        <span className="text-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, display: 'block' }}>
                          {U.m(bean.remaining)}{U.mU()} left
                        </span>
                      </div>
                    </div>
                    {bean.weight > 0 && (
                      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: freshnessColor, borderRadius: 2, opacity: 0.6, transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
