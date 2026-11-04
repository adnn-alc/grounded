// Care (maintenance): each task repeats every so many shots, days or grams of coffee
// through one gear item. How far along it is comes from the shots and brews you log:
// a shot or brew counts for a gear item when its machine, grinder, basket or dripper has that name.
import { dayOf, daysAgo, isoDaysAgo } from './dates.ts'
import { GRINDER_KIND, MACHINE_KIND } from './gear.ts'
import type { Brew, CareTask, CareUnit, Gear, Shot, Units } from '../types.ts'

const SOON = 0.8                // from 80% on a task is coming up
const KG = 1000
const LB = 453.592              // grams in a pound
const OZ = 28.3495
const OZ_PER_LB = 16
const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30
const MIN_MONTHS = 2            // 60 days reads as '2 months', 30 as '30 days'
const STAMP_LENGTH = 'YYYY-MM-DD HH:MM'.length
const TWO_DIGITS = 2
const ONE_DECIMAL = 1

type Coffee = Pick<Shot, 'date' | 'dose'>

/** Shots and brews made with this gear item, by its name */
export function usedWith(gear: Gear, shots: readonly Shot[], brews: readonly Brew[]): Coffee[] {
  return [
    ...shots.filter(s => [s.machine, s.grinder_model, s.basket].includes(gear.name)),
    ...brews.filter(b => [b.dripper, b.grinder_model].includes(gear.name)),
  ]
}

/** How many shots and how many brews were made with a gear item */
export const madeWith = (gear: Gear, shots: readonly Shot[], brews: readonly Brew[]): { shots: number; brews: number } => ({
  shots: shots.filter(x => [x.machine, x.grinder_model, x.basket].includes(gear.name)).length,
  brews: brews.filter(x => [x.dripper, x.grinder_model].includes(gear.name)).length,
})

/** Now as 'YYYY-MM-DD HH:MM', local time, the way shots are dated */
export function nowStamp(now: Date = new Date()): string {
  const two = (n: number) => String(n).padStart(TWO_DIGITS, '0')
  return `${isoDaysAgo(0, now)} ${two(now.getHours())}:${two(now.getMinutes())}`.slice(0, STAMP_LENGTH)
}

// ── Amounts and intervals as text ──

/** '640 g' or '3.2 kg'; '12 oz' or '2.7 lb' */
export function amountText(grams: number, units: Units): string {
  if (units.mass === 'oz') {
    const oz = grams / OZ
    return oz >= OZ_PER_LB ? `${(oz / OZ_PER_LB).toFixed(ONE_DECIMAL)} lb` : `${Math.round(oz)} oz`
  }
  return grams >= KG ? `${(grams / KG).toFixed(ONE_DECIMAL)} kg` : `${Math.round(grams)} g`
}

/** The big unit amounts of coffee are typed in: kg, or lb with ounces */
export const bigUnit = (units: Units): { label: string; grams: number } =>
  units.mass === 'oz' ? { label: 'lb', grams: LB } : { label: 'kg', grams: KG }

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** '12 days', '3 weeks' or '6 months' */
export function daysText(days: number): string {
  if (days >= DAYS_PER_MONTH * MIN_MONTHS && days % DAYS_PER_MONTH === 0) return plural(days / DAYS_PER_MONTH, 'month', 'months')
  if (days >= DAYS_PER_WEEK * MIN_MONTHS && days % DAYS_PER_WEEK === 0) return plural(days / DAYS_PER_WEEK, 'week', 'weeks')
  return plural(days, 'day', 'days')
}

/** An amount in a task's unit: '52 shots', '41 days', '3.2 kg' */
export function inUnit(amount: number, unit: CareUnit, units: Units): string {
  if (unit === 'shots') return plural(Math.round(amount), 'shot', 'shots')
  if (unit === 'days') return daysText(Math.round(amount))
  return amountText(amount, units)
}

export const everyText = (task: Pick<CareTask, 'every' | 'unit'>, units: Units): string => `every ${inUnit(task.every, task.unit, units)}`

// ── How far along a task is ──

export interface CareStatus {
  task:   CareTask
  gear:   Gear | undefined
  shots:  number    // shots and brews since it was last done
  grams:  number    // coffee through it since then
  days:   number    // days since then
  used:   number    // the one of the three the task counts
  share:  number    // used / every: 1 = due
  due:    boolean
  soon:   boolean   // 80% or more, not yet due
  usedText: string  // '52 shots'
  restText: string  // '2 shots over', '19 days to go' or 'due now'
  text:   string    // '52 shots, 2 shots over'
}

export function careStatus(task: CareTask, gear: Gear | undefined, shots: readonly Shot[], brews: readonly Brew[], units: Units, now: Date = new Date()): CareStatus {
  const since = gear ? usedWith(gear, shots, brews).filter(c => c.date > task.since) : []
  const counts = {
    shots: since.length,
    grams: since.reduce((sum, c) => sum + (c.dose || 0), 0),
    days:  Math.max(0, daysAgo(task.since, now)),
  }
  const used = counts[task.unit]
  const share = task.every > 0 ? used / task.every : 0
  const due = share >= 1
  const rest = Math.abs(task.every - used)
  const usedText = inUnit(used, task.unit, units)
  const restText = restWords(rest, due, task.unit, units)
  return { task, gear, ...counts, used, share, due, soon: !due && share >= SOON, usedText, restText, text: `${usedText}, ${restText}` }
}

function restWords(rest: number, due: boolean, unit: CareUnit, units: Units): string {
  if (due && rest === 0) return 'due now'
  return due ? `${inUnit(rest, unit, units)} over` : `${inUnit(rest, unit, units)} to go`
}

/** Every task's status, the most overdue first */
export const careStatuses = (tasks: readonly CareTask[], gear: readonly Gear[], shots: readonly Shot[], brews: readonly Brew[], units: Units, now: Date = new Date()): CareStatus[] =>
  tasks.map(t => careStatus(t, gear.find(g => g.id === t.gear_id), shots, brews, units, now)).sort((a, b) => b.share - a.share)

/** What Home reminds about: due, and not put off until a later day */
export const homeReminders = (statuses: readonly CareStatus[], now: Date = new Date()): CareStatus[] =>
  statuses.filter(s => s.due && s.gear && (!s.task.snoozed_until || s.task.snoozed_until <= isoDaysAgo(0, now)))

/** '52 shots since 12 Oct, 2 shots over': since it was last done, or added */
export const reminderText = (s: CareStatus): string =>
  `${s.usedText} since ${dayOf(s.task.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${s.restText}`

// ── Suggestions when adding a task ──

export interface CareSuggestion { name: string; every: number; unit: CareUnit }

// Usual intervals; the defaults are a starting point, every machine's manual differs
const BACKFLUSH_SHOTS   = 50
const FILTER_DAYS       = 60
const DESCALE_DAYS      = 180
const GASKET_DAYS       = 14
const BURR_CLEAN_GRAMS  = 5_000
const ZERO_CHECK_DAYS   = 90
const DEEP_CLEAN_DAYS   = 30

const MACHINE_TASKS: CareSuggestion[] = [
  { name: 'Backflush', every: BACKFLUSH_SHOTS, unit: 'shots' },
  { name: 'Change the water filter', every: FILTER_DAYS, unit: 'days' },
  { name: 'Descale', every: DESCALE_DAYS, unit: 'days' },
  { name: 'Inspect group head and gasket', every: GASKET_DAYS, unit: 'days' },
]
const GRINDER_TASKS: CareSuggestion[] = [
  { name: 'Clean burrs', every: BURR_CLEAN_GRAMS, unit: 'grams' },
  { name: 'Check zero', every: ZERO_CHECK_DAYS, unit: 'days' },
]
const OTHER_TASKS: CareSuggestion[] = [
  { name: 'Deep clean', every: DEEP_CLEAN_DAYS, unit: 'days' },
]

/** A few usual tasks for this kind of gear, leaving out the ones it already has */
export function suggestionsFor(gear: Gear, tasks: readonly CareTask[]): CareSuggestion[] {
  const has = new Set(tasks.filter(t => t.gear_id === gear.id).map(t => t.name.toLowerCase()))
  const list = [
    { re: MACHINE_KIND, tasks: MACHINE_TASKS },
    { re: GRINDER_KIND, tasks: GRINDER_TASKS },
  ].find(k => k.re.test(gear.kind))?.tasks ?? OTHER_TASKS
  return list.filter(s => !has.has(s.name.toLowerCase()))
}

/**
 * Gear with a Care section: anything that has tasks, and machines and grinders in use
 * unless you hid them (the careHidden setting). Hidden ones can still get a task from the
 * "Care for other gear" picker, which shows them again.
 */
export const careGear = (gear: readonly Gear[], tasks: readonly CareTask[], hidden: readonly string[]): Gear[] =>
  gear.filter(g => tasks.some(t => t.gear_id === g.id)
    || (!hidden.includes(g.id) && g.status !== 'Retired' && (MACHINE_KIND.test(g.kind) || GRINDER_KIND.test(g.kind))))
