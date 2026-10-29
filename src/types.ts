// Types shared by the API (server/) and the UI (src/). Type-only: the server
// imports this with `import type`, which Node strips, so it isn't needed at runtime.
//
// SQLite allows NULL in most columns; these types describe what Grounded itself
// writes, with `| null` where the app stores or expects a missing value.

// ── Shots & brews ───────────────────────────────────────────────────

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
  rating:        number   // average of the taste axes
  taste:         Taste
  notes:         string
  verdict:       Verdict | ''
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
export type ShotInput = Omit<Shot, 'id' | 'favorited' | 'bean_id'> & { id?: string; favorited?: boolean; bean_id?: string | null }

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
  grinder_rpm:   string | null
  water_recipe:  string | null
  favorited:     boolean
}

export type BrewInput = Omit<Brew, 'id' | 'favorited' | 'bean_id'> & { id?: string; favorited?: boolean; bean_id?: string | null }

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
  notes:       string[] // flavour notes
  price:       number
  weight:      number   // grams in a full bag
  remaining:   number   // grams left
  stock:       StockLevel
  doses:       BeanDose[]
  archived:    number | null   // 0/1 as stored in SQLite
  archived_at: string | null
  created_at:  string
}

/**
 * Body of POST /api/beans and PUT /api/beans/:id. On PUT, doses are only
 * replaced when sent, and `archived` decides whether the bean is archived.
 */
export type BeanInput = Omit<Bean, 'id' | 'doses' | 'archived' | 'archived_at' | 'created_at'> & {
  id?:          string
  doses?:       BeanDose[]
  archived?:    boolean | number | null
  archived_at?: string | null
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

// ── Settings ────────────────────────────────────────────────────────

export type FontRole = 'sans' | 'mono' | 'serif'

/** Font id per role, e.g. { sans: 'inter', mono: 'jetbrains-mono', serif: 'instrument-serif' } */
export type Fonts = Record<FontRole, string>

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
  theme?:          string   // 'moody', 'midnight', 'terminal' or 'parchment'
  fonts?:          Partial<Fonts>
  units?:          Partial<Units>
  waterRecipes?:   string[]
  dialinDefaults?: DialinDefaults
  brewModes?:      string[]   // espresso machine buttons/programs; empty or missing = field hidden
}

export type SettingKey = keyof Settings

// ── Database rows (server only) ─────────────────────────────────────
// What `SELECT *` returns before the rowTo*() helpers in server/index.ts
// turn JSON strings into arrays and taste columns into a nested object.

type TasteColumns = { [K in TasteAxis as `taste_${K}`]: number }

export type ShotRow = Omit<Shot, 'taste' | 'favorited'> & TasteColumns & {
  favorited:  number   // 0/1
  created_at: string
}

export type BrewRow = Omit<Brew, 'taste' | 'favorited' | 'pours'> & TasteColumns & {
  pours:      string   // JSON array
  favorited:  number
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
  | 'recipes' | 'gear' | 'stats' | 'stock' | 'tips'

/** A past shot or brew loaded into Dial-in as the starting point ("Re-pull" / "Re-brew") */
export type DialinPreset = (Shot & { type: 'espresso' }) | (Brew & { type: 'filter' })
