// Types shared by the API (server/) and the UI (src/). Type-only: the server
// imports this with `import type`, which Node strips, so it isn't needed at runtime.
//
// SQLite allows NULL in most columns; these types describe what Grounded itself
// writes, with `| null` where the app stores or expects a missing value.

// ── Shots & brews ───────────────────────────────────────────────────

/** Older Sour/Good/Bitter/Bad buttons. Still stored (worked out from landed/bad) for older versions. */
export type Verdict = 'good' | 'under' | 'over' | 'bad'

export type TasteAxis = 'acidity' | 'sweetness' | 'body' | 'bitterness' | 'balance' | 'aftertaste'

/** Six-axis taste rating, each 1–10 */
export type Taste = Record<TasteAxis, number>

export interface Shot {
  id:            string
  date:          string   // 'YYYY-MM-DD HH:MM', local time
  bean_id:       string | null   // Bean.id; null for shots whose bean was deleted or never matched
  bean:          string   // bean name, kept in sync with the bean (also shown if the bean is gone)
  roaster:       string
  dose:          number
  yield:         number
  time:          number   // seconds
  preinf:        number   // seconds
  temp:          number   // °C
  grind:         number
  rating:        number | null   // average of the taste axes; null = a quick shot, not tasted yet (taste then holds the middle values)
  taste:         Taste
  notes:         string
  verdict:       Verdict | ''
  landed:        number | null   // 0 sour … 50 balanced … 100 bitter; null = not placed (or bad)
  bad:           boolean         // went wrong (channelled, gushed); not placed on the slider
  machine:       string | null
  grinder_model: string | null
  grinder_rpm:   string | null   // '800', … or 'manual'
  water_recipe:  string | null
  basket:        string | null
  brew_mode:     string | null
  favorited:     boolean
}

/**
 * Body of POST /api/shots and PUT /api/shots/:id (the server makes up an id if none is sent).
 * The server fills bean/roaster from bean_id, and adjusts that bean's remaining stock.
 */
export type ShotInput = Omit<Shot, 'id' | 'favorited' | 'bean_id' | 'verdict'> & { id?: string; favorited?: boolean; bean_id?: string | null; verdict?: Verdict | '' }

/** Older brews stored pours as objects; new ones are plain gram amounts */
export type Pour = number | { water: number }

export interface Brew {
  id:            string
  date:          string
  bean_id:       string | null
  bean:          string
  roaster:       string
  dripper:       string
  grinder_model: string | null
  dose:          number
  water:         number
  temp:          number
  grind:         number
  bloom_time:    number
  num_pours:     number
  pours:         Pour[]
  time:          number   // seconds
  rating:        number
  taste:         Taste
  notes:         string
  verdict:       Verdict | ''
  landed:        number | null
  bad:           boolean
  grinder_rpm:   string | null
  water_recipe:  string | null
  favorited:     boolean
}

export type BrewInput = Omit<Brew, 'id' | 'favorited' | 'bean_id' | 'verdict'> & { id?: string; favorited?: boolean; bean_id?: string | null; verdict?: Verdict | '' }

// ── Beans ───────────────────────────────────────────────────────────

export type StockLevel = 'good' | 'low' | 'critical'

/** The dose measured for one basket, and optionally the grind setting it was measured at */
export interface BeanDose {
  basket: string
  dose:   number
  grind?: number
}

export interface Bean {
  id:          string
  name:        string
  roaster:     string
  origin:      string   // 'Country · Region'
  process:     string
  variety:     string
  roast_date:  string   // 'YYYY-MM-DD'
  roast:       string
  altitude:    string
  notes:       string[] // flavor notes
  price:       number
  weight:      number   // grams in a full bag
  remaining:   number   // grams left
  stock:       StockLevel
  doses:       BeanDose[]
  archived:    number | null   // 0/1 as stored in SQLite
  archived_at: string | null
  frozen_at:   string | null   // 'YYYY-MM-DD' it went into the freezer; null = not frozen
  frozen_days: number | null   // days spent frozen before (earlier stays)
  created_at:  string
}

/**
 * Body of POST /api/beans and PUT /api/beans/:id. On PUT, doses are only
 * replaced when sent, and `archived` decides whether the bean is archived.
 */
export type BeanInput = Omit<Bean, 'id' | 'doses' | 'archived' | 'archived_at' | 'frozen_at' | 'frozen_days' | 'created_at'> & {
  id?:          string
  doses?:       BeanDose[]
  archived?:    boolean | number | null
  archived_at?: string | null
  frozen_at?:   string | null   // left as it is when not sent
  frozen_days?: number | null
  created_at?:  string
}

// ── Gear, recipes, tips ─────────────────────────────────────────────

export interface Gear {
  id:         string
  kind:       string   // 'Grinder', 'Basket', 'Espresso machine', …
  name:       string
  owned:      string   // 'YYYY-MM'
  status:     string   // 'Primary', 'In use', 'Active', 'Travel' or 'Retired'
  meta:       string
  price:      number | null
  created_at: string
}

export type GearInput = Omit<Gear, 'id' | 'created_at'> & { id?: string }

export interface RecipeStep {
  t:      string   // '0:45'
  name:   string
  desc?:  string
  water?: string   // '120g'
}

export interface Recipe {
  id:         string
  name:       string
  type:       string   // 'V60', 'AeroPress', …
  time:       string   // '3:30'
  dose:       number
  water:      number
  ratio:      string   // '1:15'
  temp:       number
  grind:      string
  author:     string
  tags:       string[]
  steps:      RecipeStep[]
  created_at: string
}

export type RecipeInput = Omit<Recipe, 'id' | 'created_at'> & { id?: string }

export type TipSection = 'espresso' | 'filter'

export interface Tip {
  id:         string
  section:    TipSection
  category:   string
  body:       string
  sort_order: number
  created_at: string
}

export type TipInput = Pick<Tip, 'section' | 'category'> & Partial<Pick<Tip, 'id' | 'body' | 'sort_order' | 'created_at'>>

// ── Care (maintenance) ──────────────────────────────────────────────

/** What a care task counts: shots and brews made with the gear, days, or grams of coffee through it */
export type CareUnit = 'shots' | 'days' | 'grams'

export interface CareTask {
  id:            string
  gear_id:       string
  name:          string    // 'Backflush with detergent'
  every:         number    // how often, in `unit`
  unit:          CareUnit
  since:         string    // 'YYYY-MM-DD HH:MM' the count runs from: when it was last done, or added
  snoozed_until: string | null   // 'YYYY-MM-DD': Home doesn't remind about it before then
  created_at:    string
}

/** Body of POST /api/care-tasks and PUT /api/care-tasks/:id. On PUT, since and snoozed_until stay as they are when not sent. */
export type CareTaskInput = Pick<CareTask, 'gear_id' | 'name' | 'every' | 'unit'> & {
  id?:            string
  since?:         string
  snoozed_until?: string | null
}

/** One time a task was done, with what had built up since the time before */
export interface CareLogEntry {
  id:         string
  task_id:    string | null
  gear_id:    string | null
  task:       string          // names at the time, so the log still reads right after a rename or delete
  gear:       string | null
  started:    string          // when the count it ended started (the task's since before)
  done_at:    string          // 'YYYY-MM-DD HH:MM'
  shots:      number | null   // shots and brews made with it since the time before
  grams:      number | null   // coffee through it since the time before
  days:       number | null
  created_at: string
}

/** Body of POST /api/care-tasks/:id/done: the counts are worked out by the UI, which has the shots */
export interface CareDoneInput {
  done_at: string
  shots?:  number | null
  grams?:  number | null
  days?:   number | null
}

/** Response of POST /api/care-tasks/:id/done and DELETE /api/care-log/:id (task: null when it was deleted) */
export interface CareChange {
  task:   CareTask | null
  entry:  CareLogEntry
}

// ── Settings ────────────────────────────────────────────────────────

export type FontRole = 'sans' | 'mono' | 'serif'

/** Font id per role, e.g. { sans: 'inter', mono: 'jetbrains-mono', serif: 'instrument-serif' } */
export type Fonts = Record<FontRole, string>

/** The two looks: Refined (sidebar, serif titles, mono numbers) or Extraction (icon rail, big numbers, time dial) */
export type Design = 'refined' | 'extraction'

/** Extraction keeps its own theme and fonts, so switching designs back and forth loses nothing */
export interface ExtractionLook {
  theme?: string                              // 'roast', 'mocha', 'latte' or 'crema'
  fonts?: Partial<Record<'sans' | 'serif', string>>   // text, and numbers and headings
}

export interface Units {
  mass: 'g' | 'oz'
  temp: 'C' | 'F'
}

/** Values are kept as typed in the Settings form */
export interface EspressoDefaults {
  dose: string; yield: string; temp: string; grind: string; preinf: string
  waterRecipe: string; grinderRpm: string
}

export interface FilterDefaults {
  dose: string; water: string; temp: string; grind: string; numPours: string
  waterRecipe: string; grinderRpm: string
}

export interface DialinDefaults {
  espresso?: Partial<EspressoDefaults>
  filter?:   Partial<FilterDefaults>
}

/** GET /api/settings: only the keys that have been saved. PUT takes any subset. */
export interface Settings {
  design?:         Design   // missing = 'refined'
  theme?:          string   // Refined: 'moody', 'midnight', 'terminal', 'parchment', 'oat' or 'ember'
  fonts?:          Partial<Fonts>   // Refined's fonts
  extraction?:     ExtractionLook
  units?:          Partial<Units>
  waterRecipes?:   string[]
  dialinDefaults?: DialinDefaults
  brewModes?:      string[]   // espresso machine buttons/programs; empty or missing = field hidden
  careHidden?:     string[]   // gear ids left out of Gear → Care (machines and grinders show there by default)
  sampleData?:     SampleDataState
}

/** Only set on installs that started with sample data: 'present' until removed ('cleared') or kept ('dismissed') */
export type SampleDataState = 'present' | 'cleared' | 'dismissed'

/** Response of POST /api/sample-data/clear: rows removed per table */
export interface ClearSampleDataResponse {
  removed: Record<'beans' | 'shots' | 'brews' | 'gear', number>
}

export type SettingKey = keyof Settings

// ── Backups ─────────────────────────────────────────────────────────

/** The tables a backup holds, besides the settings */
export type BackupTable = 'beans' | 'shots' | 'brews' | 'gear' | 'recipes' | 'tips' | 'care_tasks' | 'care_log'

/** One database row as stored (taste as flat columns, lists as JSON strings) */
export type BackupRow = { id: string } & Record<string, string | number | null>

/** GET /api/export: the backup file. Rows are raw database rows, so nothing is lost. */
export interface Backup {
  app:           'grounded'
  format:        1
  version:       string   // Grounded version that wrote it
  schemaVersion: number   // database schema (PRAGMA user_version) the rows are in
  exportedAt:    string   // ISO timestamp
  tables:        Record<BackupTable, BackupRow[]>
  settings:      Settings
}

/** replace: wipe and load the backup. merge: keep everything, add rows whose id isn't here yet. */
export type ImportMode = 'replace' | 'merge'

/** POST /api/import. With dryRun the server works out the result without changing anything. */
export interface ImportRequest {
  mode:    ImportMode
  dryRun?: boolean
  backup:  Backup
}

export type TableCounts = Record<BackupTable, number>

export interface ImportResult {
  mode:     ImportMode
  dryRun:   boolean
  removed:  TableCounts      // rows that were here before (replace only)
  added:    TableCounts
  skipped:  TableCounts      // already here (merge only)
  snapshot: string | null    // file name of the safety copy written first (not on a dry run)
}

// ── Database rows (server only) ─────────────────────────────────────
// What `SELECT *` returns before the rowTo*() helpers in server/app.ts
// turn JSON strings into arrays and taste columns into a nested object.

type TasteColumns = { [K in TasteAxis as `taste_${K}`]: number }

export type ShotRow = Omit<Shot, 'taste' | 'favorited' | 'bad'> & TasteColumns & {
  favorited:  number   // 0/1
  bad:        number   // 0/1
  created_at: string
}

export type BrewRow = Omit<Brew, 'taste' | 'favorited' | 'pours' | 'bad'> & TasteColumns & {
  pours:      string   // JSON array
  favorited:  number
  bad:        number
  created_at: string
}

export type BeanRow = Omit<Bean, 'notes' | 'doses'> & {
  notes: string          // JSON array
  doses: string | null   // JSON array
}

export type GearRow = Gear

export type RecipeRow = Omit<Recipe, 'tags' | 'steps'> & {
  tags:  string   // JSON array
  steps: string   // JSON array
}

export type TipRow = Tip

export type CareTaskRow = CareTask
export type CareLogRow = CareLogEntry

export interface SettingRow {
  key:        string
  value:      string   // JSON
  updated_at: string
}

/** Response of the DELETE routes */
export interface OkResponse {
  ok: true
}

// ── UI ──────────────────────────────────────────────────────────────

/** Hash routes (#/route) */
export type Route =
  | 'home' | 'dialin' | 'shot-history' | 'brew-history' | 'beans' | 'archived-beans'
  | 'recipes' | 'gear' | 'stats' | 'stock' | 'tips' | 'bean'

/** How Dial-in opens from a button elsewhere ("Pull a shot", "Brew filter", a bag's "Dial in") */
export interface DialinStart {
  mode:    'espresso' | 'filter'
  beanId?: string
}

/** A past shot or brew loaded into Dial-in as the starting point ("Re-pull" / "Re-brew") */
export type DialinPreset = (Shot & { type: 'espresso' }) | (Brew & { type: 'filter' })
