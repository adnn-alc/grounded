// Request body checks for the API. Deliberately lenient: they accept everything the
// UI sends today (numbers can be null when a form field was left empty) and only
// reject what can't be right: wrong types, missing names, absurd values, huge text.
// Unknown fields are dropped, so a client echoing back a whole row is fine.
import { z } from 'zod'
import { HttpError, BAD_REQUEST } from './errors.ts'

// ── Limits ──────────────────────────────────────────────────────────
const LEN_SHORT = 60       // ids of themes/fonts, dates, ratios, times like '3:30'
const LEN_NAME  = 200      // names, roasters, gear, water recipes, …
const LEN_LONG  = 1_000    // gear details
const LEN_NOTES = 20_000   // free-text notes and tip bodies
const LEN = { short: LEN_SHORT, name: LEN_NAME, long: LEN_LONG, notes: LEN_NOTES } as const

const MAX_ITEMS     = 100   // tags, notes, doses, pours, recipe steps, lists in settings
const MAX_TASTE     = 10
const MAX_DOSE_G    = 500
const MAX_YIELD_G   = 2_000
const MAX_WATER_G   = 100_000
const MAX_TEMP      = 250   // °C, generous
const MAX_SECONDS   = 36_000
const MAX_MONEY     = 10_000_000
const MAX_GRAMS     = 1_000_000
const GRIND_RANGE   = 100_000   // grind settings are whatever the grinder uses, ± this
const MAX_SORT      = 1_000_000
const SHOWN_ISSUES  = 5

// ── Building blocks ─────────────────────────────────────────────────
const text    = (max: number = LEN.name) => z.string().max(max)
const optText = (max: number = LEN.name) => z.string().max(max).nullish()
const optNum  = (max: number, min = 0) => z.number().min(min).max(max).nullish()
const optId   = z.string().min(1).max(LEN.name).optional()
const grind   = optNum(GRIND_RANGE, -GRIND_RANGE)

const verdict = z.enum(['good', 'under', 'over', 'bad', '']).nullish()
const taste = z.object({
  acidity:    optNum(MAX_TASTE),
  sweetness:  optNum(MAX_TASTE),
  body:       optNum(MAX_TASTE),
  bitterness: optNum(MAX_TASTE),
  balance:    optNum(MAX_TASTE),
  aftertaste: optNum(MAX_TASTE),
}).nullish()

// grinder_rpm is a string ('800', 'manual'); accept a bare number too
const rpm = z.union([z.string().max(LEN.short), z.number()]).nullish()

const shotOrBrewCommon = {
  id:            optId,
  date:          text(LEN.short).min(1),
  bean_id:       z.string().max(LEN.name).nullish(),
  bean:          optText(),
  roaster:       optText(),
  dose:          optNum(MAX_DOSE_G),
  temp:          optNum(MAX_TEMP),
  grind,
  time:          optNum(MAX_SECONDS),
  rating:        z.number().min(0).max(MAX_TASTE),   // the UI always sends it, and lists show it
  taste,
  notes:         optText(LEN.notes),
  verdict,
  grinder_model: optText(),
  grinder_rpm:   rpm,
  water_recipe:  optText(),
}

// ── Schemas ─────────────────────────────────────────────────────────
export const shotSchema = z.object({
  ...shotOrBrewCommon,
  yield:     optNum(MAX_YIELD_G),
  preinf:    optNum(MAX_SECONDS),
  machine:   optText(),
  basket:    optText(),
  brew_mode: optText(),
})

export const brewSchema = z.object({
  ...shotOrBrewCommon,
  dripper:    optText(),
  water:      optNum(MAX_WATER_G),
  bloom_time: optNum(MAX_SECONDS),
  num_pours:  optNum(MAX_ITEMS),
  // Plain gram amounts; older brews stored objects with a water field
  pours: z.array(z.union([z.number().nullable(), z.looseObject({ water: z.number().nullish() })])).max(MAX_ITEMS).nullish(),
})

export const beanSchema = z.object({
  id:          optId,
  name:        text().trim().min(1, 'Name is required'),
  roaster:     optText(),
  origin:      optText(),
  process:     optText(),
  variety:     optText(),
  roast_date:  optText(LEN.short),
  roast:       optText(),
  altitude:    optText(),
  notes:       z.array(text()).max(MAX_ITEMS).nullish(),
  price:       optNum(MAX_MONEY),
  weight:      optNum(MAX_GRAMS),
  remaining:   optNum(MAX_GRAMS),
  stock:       z.enum(['good', 'low', 'critical']).nullish(),
  doses:       z.array(z.looseObject({ basket: text(), dose: optNum(MAX_DOSE_G), grind })).max(MAX_ITEMS).nullish(),
  archived:    z.union([z.boolean(), z.number()]).nullish(),
  archived_at: optText(LEN.short),
})

export const gearSchema = z.object({
  id:     optId,
  kind:   text().trim().min(1, 'Kind is required'),
  name:   text().trim().min(1, 'Name is required'),
  owned:  optText(LEN.short),
  status: optText(LEN.short),
  meta:   optText(LEN.long),
  price:  optNum(MAX_MONEY),
})

export const recipeSchema = z.object({
  id:     optId,
  name:   text().trim().min(1, 'Name is required'),
  type:   optText(),
  time:   optText(LEN.short),
  dose:   optNum(MAX_GRAMS),
  water:  optNum(MAX_WATER_G),
  ratio:  optText(LEN.short),
  temp:   optNum(MAX_TEMP),
  grind:  optText(),
  author: optText(),
  tags:   z.array(text()).max(MAX_ITEMS).nullish(),
  steps:  z.array(z.looseObject({ t: optText(LEN.short), name: optText(), desc: optText(LEN.notes), water: optText(LEN.short) })).max(MAX_ITEMS).nullish(),
})

export const tipSchema = z.object({
  id:         optId,
  section:    text().min(1),
  category:   text().min(1),
  body:       optText(LEN.notes),
  sort_order: optNum(MAX_SORT, -MAX_SORT),
})

export const favoriteSchema = z.object({ favorited: z.boolean() })

const fontId = optText(LEN.short)
export const settingsSchema = z.strictObject({
  theme:          text(LEN.short).optional(),
  fonts:          z.object({ sans: fontId, mono: fontId, serif: fontId }).optional(),
  units:          z.object({ mass: z.enum(['g', 'oz']).optional(), temp: z.enum(['C', 'F']).optional() }).optional(),
  waterRecipes:   z.array(text().min(1)).max(MAX_ITEMS).optional(),
  dialinDefaults: z.record(z.string().max(LEN.short), z.record(z.string().max(LEN.short), z.union([z.string().max(LEN.name), z.number(), z.null()]))).optional(),
  brewModes:      z.array(text(LEN.short).trim().min(1)).max(MAX_ITEMS).optional(),
  sampleData:     z.enum(['present', 'cleared', 'dismissed']).optional(),
})

// A backup's rows are checked loosely here (an id, plain values only) because
// they're raw database rows; columns this version doesn't have are dropped on import
const LEN_CELL        = 1_000_000
const MAX_BACKUP_ROWS = 1_000_000
const backupCell = z.union([z.string().max(LEN_CELL), z.number(), z.null()])
const backupRows = z.array(z.object({ id: z.string().min(1).max(LEN.name) }).catchall(backupCell)).max(MAX_BACKUP_ROWS).default([])

export const importSchema = z.object({
  mode:   z.enum(['replace', 'merge']),
  dryRun: z.boolean().optional(),
  backup: z.object({
    app:           z.literal('grounded'),
    format:        z.literal(1),
    version:       z.string().max(LEN.short).optional(),
    schemaVersion: z.number().int().min(0),
    exportedAt:    z.string().max(LEN.short).optional(),
    tables: z.object({
      beans: backupRows, shots: backupRows, brews: backupRows, gear: backupRows, recipes: backupRows, tips: backupRows,
    }),
    // Checked key by key against settingsSchema on import; unknown or invalid keys are skipped
    settings: z.record(z.string(), z.unknown()).optional(),
  }),
})

/** Returns the parsed body, or throws a 400 that lists what's wrong */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (result.success) return result.data
  const problems = result.error.issues.slice(0, SHOWN_ISSUES)
    .map(i => (i.path.length ? `${i.path.join('.')}: ` : '') + i.message)
  throw new HttpError(BAD_REQUEST, `Invalid request: ${problems.join('; ')}`)
}
