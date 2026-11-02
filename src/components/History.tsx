import { useState, type ReactNode } from 'react'
import Ico from './Ico.tsx'
import { MiniLanded } from './Landed.tsx'
import { PageHead } from './Shell.tsx'
import { shortNum } from '../hooks/useUnits.ts'
import { dayKey, dayName, daysAgo, longDate, timeOf } from '../data/dates.ts'
import type { Bean, Design, Route } from '../types.ts'

/** What the list needs from a shot or a brew */
export interface HistoryItem {
  id:        string
  date:      string
  bean:      string
  roaster:   string
  rating:    number
  landed:    number | null
  bad:       boolean
  favorited: boolean
  notes:     string
}

/** A row's numbers: 18.0 → 48.5 g in 14 s, or 15.0 → 250.0 g in 3:05 */
export interface RowNumbers {
  dose:      string
  out:       string    // yield or water
  unit:      string
  time:      string
  timeUnit?: string    // 's' for a shot; a brew's m:ss has none
}

const rowText = (n: RowNumbers): string => `${n.dose} → ${n.out} ${n.unit}, ${n.time}${n.timeUnit ? ` ${n.timeUnit}` : ''}`

type Period = '7' | '30' | '90' | 'all'
const PERIODS: { id: Period; label: string }[] = [
  { id: '7', label: 'Last 7 days' }, { id: '30', label: 'Last 30 days' }, { id: '90', label: 'Last 90 days' }, { id: 'all', label: 'All time' },
]
const DEFAULT_PERIOD: Period = '30'
const PAGE = 60          // rows shown before "Show more"
const RATING_DECIMALS = 1
const STAR_SIZE = 13

interface HistoryListProps<T extends HistoryItem> {
  kind:        'shot' | 'brew'
  design?:     Design
  items:       T[]
  beans:       Bean[]
  otherCount:  number                 // brews on the Shots page and the other way round
  goTo?:       (route: Route) => void
  selectedId:  string | null
  onSelect:    (item: T | null) => void
  rowNumbers:  (item: T) => RowNumbers
  inspector:   ReactNode              // the selected item's panel, or an empty state
}

const average = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0

/** Starts on the last 30 days, unless there's nothing in them (or the item to open is older) */
function initialPeriod(items: HistoryItem[], selectedId: string | null): Period {
  const selected = items.find(i => i.id === selectedId)
  if (selected && daysAgo(selected.date) > Number(DEFAULT_PERIOD)) return 'all'
  return items.some(i => daysAgo(i.date) <= Number(DEFAULT_PERIOD)) ? DEFAULT_PERIOD : 'all'
}

/**
 * Shots or brews grouped by day, newest first, with filters for the bag and
 * the period, and a search over the bean, roaster and notes. The selected one
 * opens in the panel on the right (full screen on a phone).
 */
export function HistoryList<T extends HistoryItem>({ kind, design, items, beans, otherCount, goTo, selectedId, onSelect, rowNumbers, inspector }: HistoryListProps<T>) {
  const [beanFilter, setBeanFilter] = useState('')
  const [period, setPeriod] = useState<Period>(() => initialPeriod(items, selectedId))
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE)

  const plural = kind === 'shot' ? 'shots' : 'brews'
  const extraction = design === 'extraction'
  // Extraction has one History in the rail; Refined names the page after what's in it
  const refinedTitle = kind === 'shot' ? 'Shots.' : 'Brews.'
  const title = extraction ? 'History' : refinedTitle
  const q = search.trim().toLowerCase()
  const filtered = items.filter(i =>
    (!beanFilter || i.bean === beanFilter) &&
    (period === 'all' || daysAgo(i.date) <= Number(period)) &&
    (!q || [i.notes, i.bean, i.roaster].some(text => text?.toLowerCase().includes(q))))
  const visible = filtered.slice(0, shown)
  const thisWeek = items.filter(i => daysAgo(i.date) < Number(PERIODS[0]!.id)).length

  const days: { key: string; items: T[] }[] = []
  visible.forEach(i => {
    const key = dayKey(i.date)
    const group = days[days.length - 1]
    if (group?.key === key) group.items.push(i)
    else days.push({ key, items: [i] })
  })

  // Open bags first; anything else in the history is a finished (or deleted) bag
  const openNames = [...new Set(beans.map(b => b.name))]
  const finishedNames = [...new Set(items.map(i => i.bean).filter(n => n && !openNames.includes(n)))].sort((a, b) => a.localeCompare(b))
  const now = new Date()
  const dateNote = (date: string) => {
    const name = dayName(date, now)
    const long = longDate(date, now)
    return long.startsWith(name) ? long.slice(name.length).trim() : long
  }

  return (
    <div className="stack">
      <PageHead title={title} sub={`${items.length} ${plural}, ${thisWeek} this week`}>
        {goTo && (
          <div className="seg hist-switch">
            {/* The other tab shows how many it has */}
            <button className={kind === 'shot' ? 'on' : ''} onClick={() => goTo('shot-history')}>Shots {kind === 'brew' && otherCount > 0 ? otherCount : ''}</button>
            <button className={kind === 'brew' ? 'on' : ''} onClick={() => goTo('brew-history')}>Brews {kind === 'shot' && otherCount > 0 ? otherCount : ''}</button>
          </div>
        )}
        <select className="fchip" value={beanFilter} onChange={e => { setBeanFilter(e.target.value); setShown(PAGE) }} aria-label="Bag">
          <option value="">All beans</option>
          <optgroup label="Open bags">
            {openNames.map(n => <option key={n} value={n}>{n}</option>)}
          </optgroup>
          {finishedNames.length > 0 && (
            <optgroup label="Finished bags">
              {finishedNames.map(n => <option key={n} value={n}>{n}</option>)}
            </optgroup>
          )}
        </select>
        <select className="fchip" value={period} onChange={e => { setPeriod(e.target.value as Period); setShown(PAGE) }} aria-label="Period">
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input className="search" type="search" placeholder="Search beans and notes" value={search} onChange={e => setSearch(e.target.value)} />
      </PageHead>

      <div className={`hist-cols${extraction ? ' xhist' : ''}`}>
        <div>
          {filtered.length === 0 && (
            <div className="card empty">
              {items.length === 0 ? `No ${plural} logged yet.` : `No ${plural} match these filters.`}
              {items.length > 0 && period !== 'all' && (
                <> <button className="link-btn" onClick={() => setPeriod('all')}>Show all time</button></>
              )}
            </div>
          )}
          {days.map(day => (
            <div key={day.key}>
              <div className="day-head">
                <b>{dayName(day.items[0]!.date, now)}</b> {dateNote(day.items[0]!.date)}
                <span>{day.items.length} {day.items.length === 1 ? kind : plural}, avg {average(day.items.filter(i => !i.bad).map(i => i.rating)).toFixed(RATING_DECIMALS)}</span>
              </div>
              {day.items.map(i => {
                const n = rowNumbers(i)
                return (
                <button key={i.id} className={`hist-row${i.id === selectedId ? ' active' : ''}`}
                  onClick={() => onSelect(i.id === selectedId ? null : i)}>
                  <span className="t">{timeOf(i.date)}</span>
                  <span className="b"><span>{i.bean || '–'}</span>{i.favorited && <Ico name="star" size={STAR_SIZE} style={{ fill: 'currentColor' }} />}</span>
                  {extraction ? (
                    <>
                      <span className="r">{shortNum(n.dose)} → {shortNum(n.out)}<small> {n.unit}</small></span>
                      <span className="tm">{n.time}{n.timeUnit && <small> {n.timeUnit}</small>}</span>
                    </>
                  ) : <span className="r">{rowText(n)}</span>}
                  <span className="ml-cell"><MiniLanded landed={i.landed} bad={i.bad} badLabel={kind === 'shot' ? 'Bad shot' : 'Bad brew'} /></span>
                  <span className={`s${i.bad ? ' low' : ''}`}>{i.rating.toFixed(RATING_DECIMALS)}</span>
                </button>
                )
              })}
            </div>
          ))}
          {filtered.length > shown && (
            <div className="more-row"><button className="ghost-btn" onClick={() => setShown(n => n + PAGE)}>Show more</button></div>
          )}
        </div>
        {inspector}
      </div>
    </div>
  )
}

/** Shown in the panel when nothing is selected (desktop only) */
export function InspectorEmpty({ kind }: { kind: 'shot' | 'brew' }) {
  return <div className="card empty desk-only">Pick a {kind} to see it here.</div>
}
