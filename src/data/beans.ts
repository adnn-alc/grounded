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

/** Whole days since the roast date, or null without a usable date */
export function daysOffRoast(bean: Bean, now: Date = new Date()): number | null {
  if (!bean.roast_date) return null
  const roasted = new Date(`${bean.roast_date}T00:00:00`).getTime()
  return isNaN(roasted) ? null : Math.max(0, Math.floor((now.getTime() - roasted) / MS_PER_DAY))
}

export type Freshness = 'resting' | 'window' | 'aging' | 'past'
export const FRESHNESS_TEXT: Record<Freshness, string> = { resting: 'resting', window: 'in its window', aging: 'aging', past: 'past its best' }

export function freshness(days: number): Freshness {
  if (days < TOO_FRESH_UNTIL) return 'resting'
  if (days <= WINDOW_UNTIL) return 'window'
  if (days <= AGING_UNTIL) return 'aging'
  return 'past'
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
  return days == null ? '' : `${day}${FRESHNESS_TEXT[freshness(days)]}`
}

/** '7 shots at 18.0 g' / 'Less than one shot' */
export function shotsLeftText(bean: Bean, dose: number, unit: (g: number) => string): string {
  const left = dose > 0 ? Math.floor(bean.remaining / dose) : 0
  if (left < 1) return 'Less than one shot'
  return `${left} ${left === 1 ? 'shot' : 'shots'} at ${unit(dose)}`
}
