// Shots and brews are dated 'YYYY-MM-DD HH:MM' in local time.
const MS_PER_DAY = 86_400_000
const DAYS_IN_WEEK = 7
const DATE_LEN = 'YYYY-MM-DD'.length
const TIME_FROM = 'YYYY-MM-DD '.length
const HALF = 2
const TWO_DIGITS = 2

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Local date of a 'YYYY-MM-DD…' string, at midday so DST shifts can't move it to another day */
const MIDDAY = 'T12:00:00'
export const dayOf = (date: string): Date => new Date(date.slice(0, DATE_LEN) + MIDDAY)
export const timeOf = (date: string): string => date.slice(TIME_FROM)
export const dayKey = (date: string): string => date.slice(0, DATE_LEN)

/** Whole days between that date and today (0 = today) */
export const daysAgo = (date: string, now: Date = new Date()): number =>
  Math.round((startOfDay(now) - startOfDay(dayOf(date))) / MS_PER_DAY)

/** 'Today', 'Yesterday', 'Wednesday' within the week, else '28 October' */
export function dayName(date: string, now: Date = new Date()): string {
  const ago = daysAgo(date, now)
  if (ago === 0) return 'Today'
  if (ago === 1) return 'Yesterday'
  if (ago > 1 && ago < DAYS_IN_WEEK) return dayOf(date).toLocaleDateString('en-GB', { weekday: 'long' })
  return longDate(date, now)
}

/** 'Friday 30 October', with the year when it isn't this year */
export function longDate(date: string, now: Date = new Date()): string {
  const d = dayOf(date)
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** 'today at 08:14', 'yesterday at 08:14', '28 October at 08:14' */
export function whenText(date: string, now: Date = new Date()): string {
  const name = dayName(date, now)
  const day = name === 'Today' || name === 'Yesterday' ? name.toLowerCase() : name
  return timeOf(date) ? `${day} at ${timeOf(date)}` : day
}

/** The date `days` days before today, as 'YYYY-MM-DD' (local) */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(startOfDay(now) - days * MS_PER_DAY + MS_PER_DAY / HALF)
  const two = (n: number) => String(n).padStart(TWO_DIGITS, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}
