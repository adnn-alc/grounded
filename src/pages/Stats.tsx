import { useState } from 'react'
import { useUnits, type UnitHelpers } from '../hooks/useUnits.ts'
import CoffeeMap from '../components/CoffeeMap.tsx'
import { PageHead } from '../components/Shell.tsx'
import { daysAgo } from '../data/dates.ts'
import { LANDED_MAX, landedLabel, mmss } from '../data/taste.ts'
import type { Bean, Brew, Gear, Shot, Units } from '../types.ts'

// ── STATS ─────────────────────────────────────────────────────────────
type Period = '30' | '90' | 'all'
const PERIODS: { id: Period; label: string }[] = [{ id: '30', label: '30 days' }, { id: '90', label: '90 days' }, { id: 'all', label: 'All time' }]

const HALF = 2
const CENTS = 2   // decimals for money
const BINS = 10
const HALF_BINS = BINS / HALF
const PERCENT = 100
const MIX_STEP = PERCENT / HALF_BINS
const DECIMALS = 1
const TOP_ROWS = 5
const MONTHS = 6          // months in the bean spending chart
const MONTH_DIGITS = 2
const KG = 1000
const LB = 453.592        // grams in a pound
const OZ_PER_LB = 16
const OZ = 28.3495        // grams in an ounce

/** What the summary cards read from a shot or a brew */
interface Entry { date: string; rating: number; dose: number; out: number; time: number; landed: number | null; bad: boolean }

/** '113' or '12.50' */
const money = (n: number): string => n % 1 === 0 ? String(n) : n.toFixed(CENTS)

/** '1.24 kg' or '640 g'; '2.7 lb' or '12.4 oz' */
function bigMass(grams: number, units: Units): string {
  if (units.mass === 'oz') {
    const oz = grams / OZ
    return oz >= OZ_PER_LB ? `${(oz / OZ_PER_LB).toFixed(DECIMALS)} lb` : `${oz.toFixed(DECIMALS)} oz`
  }
  return grams >= KG ? `${(grams / KG).toFixed(CENTS)} kg` : `${Math.round(grams)} g`
}

/** The most common values, most first */
function topCounts<T>(items: T[], pick: (item: T) => string | undefined): [string, number][] {
  const counts = new Map<string, number>()
  items.forEach(i => { const v = pick(i)?.trim(); if (v) counts.set(v, (counts.get(v) ?? 0) + 1) })
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_ROWS)
}

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(r => r[1]))
  return <>{rows.map(([label, n]) => (
    <div key={label} className="hbar-row"><span>{label}</span><i style={{ width: `${(n / max) * PERCENT}%` }} /><b>{n}</b></div>
  ))}</>
}

/** Bean spending per month for the last few months, by when each bag was added */
function MonthBars({ beans }: { beans: Bean[] }) {
  const [now] = useState(() => new Date())
  const months = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(MONTH_DIGITS, '0')}`
    const total = beans.filter(b => b.created_at?.startsWith(key)).reduce((a, b) => a + (b.price || 0), 0)
    return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), total }
  })
  const max = Math.max(1, ...months.map(m => m.total))
  return (
    <div className="month-bars">
      {months.map(m => (
        <div key={m.key} className="mb-col" title={`€${money(m.total)}`}>
          <span className="mb-v">{m.total > 0 ? `€${Math.round(m.total)}` : ''}</span>
          <i style={{ height: `${(m.total / max) * PERCENT}%` }} />
          <span className="mb-l">{m.label}</span>
        </div>
      ))}
    </div>
  )
}

const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** Histogram color along the sour → balanced → bitter gauge */
const binColor = (i: number): string => i < HALF_BINS
  ? `color-mix(in srgb, var(--sour) ${PERCENT - i * MIX_STEP}%, var(--crema))`
  : `color-mix(in srgb, var(--bitter) ${(i - HALF_BINS + 1) * MIX_STEP}%, var(--crema))`

function LandedHistogram({ entries, noun }: { entries: Entry[]; noun: string }) {
  const placed = entries.filter(e => !e.bad && e.landed != null)
  const bad = entries.filter(e => e.bad).length
  const bins = Array.from({ length: BINS }, () => 0)
  placed.forEach(e => { bins[Math.min(BINS - 1, Math.floor((e.landed! / LANDED_MAX) * BINS))]! += 1 })
  const max = Math.max(1, bad, ...bins)
  const modeBin = bins.indexOf(Math.max(...bins))
  const modeLabel = landedLabel(((modeBin + 1 / HALF) / BINS) * LANDED_MAX).toLowerCase()
  return (
    <>
      <div className="hist">
        <div className="bars">
          {bins.map((n, i) => <i key={i} title={`${n}`} style={{ height: `${(n / max) * PERCENT}%`, background: binColor(i) }} />)}
        </div>
        <div className="badbar" title={`${bad} bad`}>
          <i style={{ height: `${(bad / max) * PERCENT}%` }} />
        </div>
      </div>
      <div className="hist-ends"><span>Sour</span><span>Balanced</span><span>Bitter</span></div>
      <div className="stats-note">
        {placed.length
          ? `Where your ${noun} landed. Most were ${modeLabel}${bad ? `, and ${bad} went wrong` : ''}.`
          : `Place your ${noun} on the sour-to-bitter slider when you save them, and they show up here.`}
      </div>
    </>
  )
}

function SummaryCard({ title, entries, noun, U, outLabel, timeText }: { title: string; entries: Entry[]; noun: string; U: UnitHelpers; outLabel: string; timeText: (s: number) => string }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">{title}</span><span>{entries.length} {noun}</span></div>
      {entries.length === 0 ? <div className="empty">Nothing logged in this period.</div> : (
        <>
          <div className="num-row fit">
            <div className="kv"><span className="k">Avg rating</span><span className="v accent">{avg(entries.map(e => e.rating)).toFixed(DECIMALS)}</span></div>
            <div className="kv"><span className="k">Avg dose</span><span className="v">{U.m(avg(entries.map(e => e.dose)))}<small>{U.mU()}</small></span></div>
            <div className="kv"><span className="k">{outLabel}</span><span className="v">{U.m(avg(entries.map(e => e.out)))}<small>{U.mU()}</small></span></div>
            <div className="kv"><span className="k">Avg time</span><span className="v">{timeText(Math.round(avg(entries.map(e => e.time))))}</span></div>
          </div>
          <LandedHistogram entries={entries} noun={noun} />
        </>
      )}
    </div>
  )
}

interface StatsProps {
  shots:  Shot[]
  brews?: Brew[]
  beans?: Bean[]   // open and finished
  gear?:  Gear[]
  units:  Units
}

export function Stats({ shots, brews = [], beans = [], gear = [], units }: StatsProps) {
  const U = useUnits(units)
  const [period, setPeriod] = useState<Period>('30')
  const inPeriod = (date: string | null | undefined) => period === 'all' || (date ? daysAgo(date) <= Number(period) : false)

  const pShots = shots.filter(s => inPeriod(s.date))
  const pBrews = brews.filter(b => inPeriod(b.date))
  const shotEntries: Entry[] = pShots.map(s => ({ date: s.date, rating: s.rating, dose: s.dose, out: s.yield, time: s.time, landed: s.landed, bad: s.bad }))
  const brewEntries: Entry[] = pBrews.map(b => ({ date: b.date, rating: b.rating, dose: b.dose, out: b.water, time: b.time, landed: b.landed, bad: b.bad }))

  const bags = beans.filter(b => inPeriod(b.created_at))
  const countries = topCounts(bags, b => b.origin?.split('·')[0])
  const processes = topCounts(bags, b => b.process)
  const roasters  = topCounts(bags, b => b.roaster)
  const periodText = period === 'all' ? 'in all' : `in ${period} days`

  const priced    = bags.filter(b => b.price > 0)
  const beanSpend = Math.round(priced.reduce((a, b) => a + b.price, 0) * PERCENT) / PERCENT   // no float dust like 113.00000001
  const perBag    = priced.length ? beanSpend / priced.length : 0
  const weighed   = priced.filter(b => b.weight > 0)
  const perMass   = units.mass === 'oz' ? { label: 'Per lb', grams: LB } : { label: 'Per kg', grams: KG }
  const perMassPrice = weighed.length ? weighed.reduce((a, b) => a + b.price, 0) / weighed.reduce((a, b) => a + b.weight, 0) * perMass.grams : 0
  const priciest  = priced.length ? priced.reduce((a, b) => b.price > a.price ? b : a) : null
  const used      = [...pShots, ...pBrews].reduce((a, x) => a + (x.dose || 0), 0)
  const usedCount = pShots.length + pBrews.length
  const pricedGear = gear.filter(g => (g.price ?? 0) > 0)
  const gearSpend = pricedGear.reduce((a, g) => a + (g.price ?? 0), 0)
  const openBags  = beans.filter(b => !b.archived)
  const left      = openBags.reduce((a, b) => a + (b.remaining || 0), 0)

  const originsCard = (
    <div className="card">
      <div className="card-head"><span className="card-title">Origins</span><span>{bags.length} {bags.length === 1 ? 'bag' : 'bags'} {periodText}</span></div>
      {countries.length === 0 ? <div className="empty">No bags with an origin {periodText}.</div> : <Bars rows={countries} />}
      {processes.length > 0 && (
        <div className="stats-sub">
          <div className="stats-sub-k">Process</div>
          <Bars rows={processes} />
        </div>
      )}
      {roasters.length > 0 && (
        <div className="stats-sub">
          <div className="stats-sub-k">Roasters</div>
          <Bars rows={roasters} />
        </div>
      )}
    </div>
  )
  const spendingCard = (
    <div className="card">
      <div className="card-head"><span className="card-title">Spending</span><span>bags {periodText}</span></div>
      {priced.length === 0 ? <div className="empty">No bags with a price {periodText}.</div> : (
        <>
          <div className="num-row fit">
            <div className="kv"><span className="k">On beans</span><span className="v accent">€{money(beanSpend)}</span></div>
            <div className="kv"><span className="k">Bags</span><span className="v">{priced.length}</span></div>
            <div className="kv"><span className="k">Per bag</span><span className="v">€{perBag.toFixed(CENTS)}</span></div>
            <div className="kv"><span className="k">{perMass.label}</span><span className="v">{perMassPrice > 0 ? `€${Math.round(perMassPrice)}` : '–'}</span></div>
          </div>
          {priciest && (
            <div className="stats-sub">
              <div className="stats-sub-k">Most expensive bag</div>
              <div className="priciest">
                <div className="pr-main">
                  <div className="pr-name">{priciest.name}</div>
                  <div className="pr-sub">{[priciest.roaster, priciest.weight > 0 && `${U.m(priciest.weight)} ${U.mU()}`].filter(Boolean).join(', ')}</div>
                </div>
                <span className="pr-price">€{money(priciest.price)}</span>
              </div>
            </div>
          )}
        </>
      )}
      <div className="stats-sub">
        <div className="stats-sub-k">Beans, last {MONTHS} months</div>
        <MonthBars beans={beans} />
      </div>
      <div className="stats-sub spend-foot">
        <div className="kv"><span className="k">On gear</span><span className="v">{gearSpend > 0 ? `€${money(gearSpend)}` : '–'}</span><span className="kv-note">{pricedGear.length} {pricedGear.length === 1 ? 'item' : 'items'}, all time</span></div>
        <div className="kv"><span className="k">Coffee used</span><span className="v">{bigMass(used, units)}</span><span className="kv-note">{usedCount} {usedCount === 1 ? 'shot or brew' : 'shots and brews'}</span></div>
        <div className="kv"><span className="k">Coffee left</span><span className="v">{bigMass(left, units)}</span><span className="kv-note">{openBags.length} open {openBags.length === 1 ? 'bag' : 'bags'}</span></div>
      </div>
    </div>
  )

  return (
    <div className="stack">
      <PageHead title="Stats." sub={`${shots.length} shots and ${brews.length} brews`}>
        <div className="seg">
          {PERIODS.map(p => <button key={p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
      </PageHead>

      {/* Filter only gets its half once there are brews at all */}
      <div className={brews.length > 0 ? 'stats-low' : ''}>
        <SummaryCard title="Espresso" entries={shotEntries} noun="shots" U={U} outLabel="Avg yield" timeText={s => `${s} s`} />
        {brews.length > 0 && <SummaryCard title="Filter" entries={brewEntries} noun="brews" U={U} outLabel="Avg water" timeText={mmss} />}
      </div>

      <div className="stats-low">{originsCard}{spendingCard}</div>

      {beans.some(b => b.origin?.trim()) && (
        <div className="card">
          <div className="card-head"><span className="card-title">Where your coffee comes from</span><span>all bags</span></div>
          <CoffeeMap beans={beans} />
        </div>
      )}
    </div>
  )
}
