import { dayOf, daysAgo, isoDaysAgo } from './dates.ts'
import type { Bean } from '../types.ts'

/** Bean name for pickers; adds the roast date when two open bags share a name */
export function beanLabel(bean: Bean, beans: readonly Bean[]): string {
  const twin = beans.some(b => b.id !== bean.id && b.name === bean.name)
  return twin && bean.roast_date ? `${bean.name} · roasted ${bean.roast_date}` : bean.name
}

const MS_PER_DAY = 86_400_000
const TOO_FRESH_UNTIL = 7     // days off roast
const WINDOW_UNTIL    = 28
const AGING_UNTIL     = 42
const FEW_SHOTS       = 3     // "about 2 shots left" below this
const CENTS           = 2

// Extraction's shelves: each bag gets its own color, picked from its id so it stays the same
const BAG_COLORS = ['#c27a1c', '#b8452f', '#2f7d76', '#9e3d5f', '#4d5c9e', '#687f2e']
export const bagColor = (id: string): string =>
  BAG_COLORS[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % BAG_COLORS.length]!

/** 'Roasted 20 Oct', for the bag's tags */
export const roastedText = (date: string): string => `Roasted ${dayOf(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

/** '€24' or '€12.50' */
export const priceText = (price: number): string => `€${price % 1 === 0 ? price : price.toFixed(CENTS)}`

/** Whole days since the roast date, or null without a usable date */
export function daysOffRoast(bean: Bean, now: Date = new Date()): number | null {
  if (!bean.roast_date) return null
  const roasted = new Date(`${bean.roast_date}T00:00:00`).getTime()
  return isNaN(roasted) ? null : Math.max(0, Math.floor((now.getTime() - roasted) / MS_PER_DAY))
}

export type Freshness = 'resting' | 'window' | 'aging' | 'past' | 'frozen'
export const FRESHNESS_TEXT: Record<Freshness, string> = {
  resting: 'resting', window: 'in its window', aging: 'aging', past: 'past its best', frozen: 'in the freezer',
}

export function freshness(days: number): Freshness {
  if (days < TOO_FRESH_UNTIL) return 'resting'
  if (days <= WINDOW_UNTIL) return 'window'
  if (days <= AGING_UNTIL) return 'aging'
  return 'past'
}

// ── Freezer ──
// A frozen bag stops aging: its freshness goes by its days off roast without the days it spent frozen.

/** Days in the freezer: earlier stays plus the current one */
export const frozenDays = (bean: Bean, now: Date = new Date()): number => (bean.frozen_days ?? 0) + thisStay(bean, now)

/** 'frozen' while it's in the freezer, else its freshness by the days it has aged; null without a roast date */
export function beanFreshness(bean: Bean, now: Date = new Date()): Freshness | null {
  if (bean.frozen_at) return 'frozen'
  const days = daysOffRoast(bean, now)
  return days == null ? null : freshness(Math.max(0, days - frozenDays(bean, now)))
}

/**
 * The freezer fields to save when a bag goes in on `frozenAt` ('YYYY-MM-DD') or stays in,
 * or comes out (`frozenAt` null): then the stay that just ended is added to its frozen days.
 */
export function freezerFields(bean: Bean | null, frozenAt: string | null, now: Date = new Date()): Pick<Bean, 'frozen_at' | 'frozen_days'> {
  const before = bean?.frozen_days ?? 0
  if (frozenAt) return { frozen_at: frozenAt, frozen_days: before }
  return { frozen_at: null, frozen_days: before + (bean ? thisStay(bean, now) : 0) }
}

/** The bag with the freezer switched on (in today) or off (the stay that just ended is kept) */
export const withFreezer = (bean: Bean, frozen: boolean, now: Date = new Date()): Bean =>
  ({ ...bean, ...freezerFields(bean, frozen ? isoDaysAgo(0, now) : null, now) })

/** Whole days of the current stay in the freezer (0 when it isn't frozen) */
const thisStay = (bean: Bean, now: Date): number => bean.frozen_at ? Math.max(0, daysAgo(bean.frozen_at, now)) : 0

/** 'since today', 'since 2 Nov, 1 day' or 'since 20 Oct, 14 days': this stay in the freezer */
export function frozenSinceText(bean: Bean, now: Date = new Date()): string {
  if (!bean.frozen_at) return ''
  const days = thisStay(bean, now)
  if (days === 0) return 'since today'
  const since = dayOf(bean.frozen_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `since ${since}, ${days} ${days === 1 ? 'day' : 'days'}`
}

/** The dose to count shots with: the bag's smallest basket dose, else the given fallback */
export const usualDose = (bean: Bean, fallback: number): number => bean.doses?.[0]?.dose || fallback

/** 'Day 10, in its window' or, when it's nearly gone, 'Day 16, about 2 shots left' (Home's open bags) */
export function bagStatus(bean: Bean, dose: number, now: Date = new Date()): string {
  const days = daysOffRoast(bean, now)
  const left = dose > 0 ? Math.floor(bean.remaining / dose) : Infinity
  const day = days == null ? '' : `Day ${days}, `
  if (left < 1) return `${day}not enough for a shot`
  if (left < FEW_SHOTS) return `${day}about ${left} ${left === 1 ? 'shot' : 'shots'} left`
  const fresh = beanFreshness(bean, now)
  return fresh == null ? '' : `${day}${FRESHNESS_TEXT[fresh]}`
}

/** '7 shots at 18.0 g' / 'Less than one shot' */
export function shotsLeftText(bean: Bean, dose: number, unit: (g: number) => string): string {
  const left = dose > 0 ? Math.floor(bean.remaining / dose) : 0
  if (left < 1) return 'Less than one shot'
  return `${left} ${left === 1 ? 'shot' : 'shots'} at ${unit(dose)}`
}
