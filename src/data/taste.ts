// Where a shot or brew landed between sour and bitter (0–100, 50 = balanced; see
// server/taste.ts), and the 1–10 rating. Shared by Dial-in, history, Home and Stats.
import type { Taste } from '../types.ts'

export const LANDED_MAX = 100
export const LANDED_BALANCED = 50
export const RATING_MAX = 10
export const RATING_STEP = 0.5

const ESPRESSO_RATIO_DECIMALS = 2
const FILTER_RATIO_DECIMALS = 1
/** '1:2.05' for espresso, '1:16.7' for filter; '–' until both numbers are there */
export const ratioText = (dose: number, out: number, kind: 'espresso' | 'filter' = 'espresso'): string =>
  dose > 0 && out > 0 ? `1:${(out / dose).toFixed(kind === 'espresso' ? ESPRESSO_RATIO_DECIMALS : FILTER_RATIO_DECIMALS)}` : '–'

// Upper bound (inclusive) of each label on the slider
const VERY_SOUR_TO = 12
const SOUR_TO = 30
const TOUCH_SOUR_TO = 44
const BALANCED_TO = 56
const TOUCH_BITTER_TO = 70
const BITTER_TO = 88
const LABELS: readonly [number, string][] = [
  [VERY_SOUR_TO, 'Very sour'],
  [SOUR_TO, 'Sour'],
  [TOUCH_SOUR_TO, 'A touch sour'],
  [BALANCED_TO, 'Balanced'],
  [TOUCH_BITTER_TO, 'A touch bitter'],
  [BITTER_TO, 'Bitter'],
  [LANDED_MAX, 'Very bitter'],
]

export function landedLabel(landed: number | null, bad = false): string {
  if (bad) return 'Bad'
  if (landed == null) return 'Not placed'
  return LABELS.find(([upTo]) => landed <= upTo)?.[1] ?? 'Very bitter'
}

const TENTHS = 10
const round1 = (n: number): number => Math.round(n * TENTHS) / TENTHS

/** Average of the six taste axes, one decimal */
export function tasteAverage(taste: Taste): number {
  const values = Object.values(taste)
  return values.length ? round1(values.reduce((a, b) => a + (b || 0), 0) / values.length) : 0
}

// A quick shot is saved without tasting it: its rating is null until taste is added
const ONE_DECIMAL = 1
const UNRATED_ORDER = -1

/** '8.5', or '–' for a quick shot that hasn't been tasted yet */
export const ratingText = (rating: number | null, decimals: number = ONE_DECIMAL): string =>
  rating == null ? '–' : rating.toFixed(decimals)

/** 'rated 8.5', or 'not tasted yet' for a quick shot */
export const ratedText = (rating: number | null): string => rating == null ? 'not tasted yet' : `rated ${ratingText(rating)}`

/** The ratings that were given, leaving out quick shots that have none yet */
export const ratingsOf = (list: readonly { rating: number | null }[]): number[] =>
  list.map(x => x.rating).filter((r): r is number => r != null)

/** For sorting best first: untasted ones go last */
export const ratingOrder = (rating: number | null): number => rating ?? UNRATED_ORDER

/** Ratings move in half points and stay within 0–10 */
export const clampRating = (r: number): number => Math.min(RATING_MAX, Math.max(0, Math.round(r / RATING_STEP) * RATING_STEP))

const SECONDS_PER_MINUTE = 60
const SECONDS_DIGITS = 2
const MIN_SEC_PARTS = 2   // '3:05'

/** 185 → '3:05' */
export const mmss = (secs: number): string =>
  `${Math.floor(secs / SECONDS_PER_MINUTE)}:${String(Math.round(secs) % SECONDS_PER_MINUTE).padStart(SECONDS_DIGITS, '0')}`

/** '3:05' → 185, '185' → 185; anything else → null */
export function parseMmss(text: string): number | null {
  const parts = text.trim().split(':')
  if (parts.length > MIN_SEC_PARTS || parts.some(p => p === '' || isNaN(Number(p)))) return null
  return parts.length === MIN_SEC_PARTS ? Number(parts[0]) * SECONDS_PER_MINUTE + Number(parts[1]) : Number(parts[0])
}
