// Where a shot or brew landed between sour and bitter (0–100, 50 = balanced), and
// the "bad" flag for one that went wrong (channelled, gushed) and isn't placed at all.
// The old verdict column is still written, worked out from these two, so an older
// Grounded reading the same database keeps showing something sensible.
import type { Verdict } from '../src/types.ts'

export const LANDED_MAX = 100
const BALANCED_FROM = 40   // below this a shot counts as under-extracted (sour)
const BALANCED_TO   = 60   // above this, over-extracted (bitter)

// Where an old verdict sits on the slider
const LANDED_UNDER = 25
const LANDED_GOOD  = 50
const LANDED_OVER  = 75

export interface TasteResult {
  landed:  number | null
  bad:     0 | 1
  verdict: Verdict | ''
}

interface TasteFields {
  landed?:  number | null
  bad?:     boolean | null
  verdict?: Verdict | '' | null
}

export function verdictFor(landed: number | null, bad: boolean): Verdict | '' {
  if (bad) return 'bad'
  if (landed == null) return ''
  if (landed < BALANCED_FROM) return 'under'
  if (landed > BALANCED_TO) return 'over'
  return 'good'
}

const LANDED_FROM_VERDICT: Record<Verdict, number | null> = { under: LANDED_UNDER, good: LANDED_GOOD, over: LANDED_OVER, bad: null }

/** The columns to store for a request body. Clients that only send a verdict (older ones) still work. */
export function tasteResult(body: TasteFields): TasteResult {
  const sendsNewFields = body.landed !== undefined || body.bad !== undefined
  if (!sendsNewFields && body.verdict) {
    const bad = body.verdict === 'bad'
    return { landed: LANDED_FROM_VERDICT[body.verdict], bad: bad ? 1 : 0, verdict: body.verdict }
  }
  const bad = Boolean(body.bad)
  const landed = bad || body.landed == null ? null : Math.round(body.landed)
  return { landed, bad: bad ? 1 : 0, verdict: verdictFor(landed, bad) }
}

/**
 * Fills landed/bad from the verdict on rows that only have a verdict: rows from
 * before the slider, and rows imported from an older backup. Rows this version
 * wrote never match (a verdict always comes with landed or bad set).
 */
export const fillFromVerdictsSql = (table: 'shots' | 'brews'): string => `
  UPDATE ${table} SET
    bad    = CASE WHEN verdict = 'bad' THEN 1 ELSE 0 END,
    landed = CASE verdict WHEN 'under' THEN ${LANDED_UNDER} WHEN 'good' THEN ${LANDED_GOOD} WHEN 'over' THEN ${LANDED_OVER} END
  WHERE landed IS NULL AND COALESCE(bad, 0) = 0 AND verdict IN ('good', 'under', 'over', 'bad')
`
