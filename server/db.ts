import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Settings, SettingRow } from '../src/types.ts'
import { fillFromVerdictsSql } from './taste.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/grounded.db')

// Ensure data dir exists
import fs from 'fs'
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ──────────────────────────────────────────────────────────
// The full current schema, so a fresh database is complete straight away.
// Existing databases are brought up to date by the migrations below.
const isNewDatabase = !db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'shots'`).get()

db.exec(`
  CREATE TABLE IF NOT EXISTS beans (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    roaster     TEXT NOT NULL,
    origin      TEXT,
    process     TEXT,
    variety     TEXT,
    roast_date  TEXT,
    roast       TEXT,
    altitude    TEXT,
    notes       TEXT,          -- JSON array of flavor notes
    price       REAL,
    weight      REAL,
    remaining   REAL,
    stock       TEXT DEFAULT 'good',
    doses       TEXT,          -- JSON array of { basket, dose, grind? }
    archived    INTEGER DEFAULT 0,
    archived_at TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shots (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    bean_id     TEXT,          -- beans.id (no foreign key, so history survives a deleted bean)
    bean        TEXT,          -- bean name, kept in sync by PUT /api/beans/:id
    roaster     TEXT,
    dose        REAL,
    yield       REAL,
    time        INTEGER,
    preinf      INTEGER,
    temp        REAL,
    grind       REAL,
    rating      REAL,
    -- taste stored as individual columns for easy querying
    taste_acidity    REAL,
    taste_sweetness  REAL,
    taste_body       REAL,
    taste_bitterness REAL,
    taste_balance    REAL,
    taste_aftertaste REAL,
    notes       TEXT,
    verdict     TEXT,          -- worked out from landed/bad (server/taste.ts), for older versions
    landed      INTEGER,       -- 0 sour … 50 balanced … 100 bitter; NULL = not placed
    bad         INTEGER DEFAULT 0,
    machine       TEXT,
    grinder_model TEXT,
    grinder_rpm   TEXT,
    water_recipe  TEXT,
    basket        TEXT,
    brew_mode     TEXT,
    favorited     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gear (
    id        TEXT PRIMARY KEY,
    kind      TEXT NOT NULL,
    name      TEXT NOT NULL,
    owned     TEXT,
    status    TEXT,
    meta      TEXT,
    price     REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    type    TEXT,
    time    TEXT,
    dose    REAL,
    water   REAL,
    ratio   TEXT,
    temp    REAL,
    grind   TEXT,
    author  TEXT,
    tags    TEXT,   -- JSON array
    steps   TEXT,   -- JSON array
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tips (
    id         TEXT PRIMARY KEY,
    section    TEXT NOT NULL,
    category   TEXT NOT NULL,
    body       TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS brews (
    id           TEXT PRIMARY KEY,
    date         TEXT NOT NULL,
    bean_id      TEXT,
    bean         TEXT,
    roaster      TEXT,
    dripper      TEXT,
    grinder_model TEXT,
    dose         REAL,
    water        REAL,
    temp         REAL,
    grind        REAL,
    bloom_time   INTEGER,
    num_pours    INTEGER,
    pours        TEXT,    -- JSON array of pour amounts in grams
    time         INTEGER,
    rating       REAL,
    taste_acidity    REAL,
    taste_sweetness  REAL,
    taste_body       REAL,
    taste_bitterness REAL,
    taste_balance    REAL,
    taste_aftertaste REAL,
    notes        TEXT,
    verdict      TEXT,
    landed       INTEGER,
    bad          INTEGER DEFAULT 0,
    grinder_rpm  TEXT,
    water_recipe TEXT,
    favorited    INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  -- App-wide preferences (theme, fonts, units, water recipes, dial-in defaults, brew modes)
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,   -- JSON
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)

// ── Migrations ──────────────────────────────────────────────────────
// Numbered: PRAGMA user_version stores how many have run. Each pending one runs
// once, in order, in its own transaction. If one fails, startup stops with the
// error instead of carrying on with a half-updated database.
// Never edit or reorder a released migration; append a new one.

const hasColumn = (table: string, column: string): boolean =>
  !!db.prepare('SELECT 1 FROM pragma_table_info(?) WHERE name = ?').get(table, column)

const addColumn = (table: string, column: string, definition: string): void => {
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

const renameColumn = (table: string, from: string, to: string): void => {
  if (hasColumn(table, from) && !hasColumn(table, to)) db.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`)
}

const MIGRATIONS: readonly { name: string, up: () => void }[] = [
  {
    // Databases from before numbered migrations can have any subset of these.
    // Each step checks first, so it's safe on all of them.
    name: 'columns added before numbered migrations',
    up: () => {
      renameColumn('tips', 'category', 'section')
      renameColumn('tips', 'title', 'category')
      addColumn('beans', 'archived', 'INTEGER DEFAULT 0')
      addColumn('beans', 'archived_at', 'TEXT')
      addColumn('beans', 'doses', 'TEXT')
      addColumn('gear', 'price', 'REAL')
      for (const t of ['shots', 'brews']) {
        addColumn(t, 'grinder_model', 'TEXT')
        addColumn(t, 'grinder_rpm', 'TEXT')
        addColumn(t, 'water_recipe', 'TEXT')
        addColumn(t, 'favorited', 'INTEGER DEFAULT 0')
      }
      addColumn('shots', 'machine', 'TEXT')
      addColumn('shots', 'basket', 'TEXT')
      addColumn('shots', 'brew_mode', 'TEXT')
      // Retire legacy verdicts (great/sour/bitter) in favour of good/under/over/bad
      for (const t of ['shots', 'brews']) {
        db.exec(`UPDATE ${t} SET verdict = CASE verdict WHEN 'great' THEN 'good' WHEN 'sour' THEN 'under' WHEN 'bitter' THEN 'over' END
                 WHERE verdict IN ('great', 'sour', 'bitter')`)
      }
    },
  },
  {
    // Shots and brews used to point at their bean by name only. Match each one to
    // a bean with that name, preferring the same roaster and a bag roasted before it.
    name: 'link shots and brews to beans by id',
    up: () => {
      for (const t of ['shots', 'brews']) {
        addColumn(t, 'bean_id', 'TEXT')
        db.exec(`
          UPDATE ${t} SET bean_id = (
            SELECT b.id FROM beans b WHERE b.name = ${t}.bean
            ORDER BY (b.roaster = ${t}.roaster) DESC, (b.roast_date <= substr(${t}.date, 1, 10)) DESC, b.roast_date DESC
            LIMIT 1
          )
          WHERE bean_id IS NULL AND bean IS NOT NULL AND bean != ''
        `)
        db.exec(`CREATE INDEX IF NOT EXISTS idx_${t}_bean_id ON ${t}(bean_id)`)
      }
    },
  },
  {
    // Brew modes used to be hard-coded for one machine. The ones already used in
    // shots become the starting list; a new install starts with none (field hidden).
    name: 'brew modes become a setting',
    up: () => {
      const used = db.prepare<[], { brew_mode: string }>(`
        SELECT brew_mode FROM shots WHERE brew_mode IS NOT NULL AND brew_mode != ''
        GROUP BY brew_mode ORDER BY MIN(date)
      `).all().map(r => r.brew_mode)
      if (used.length) {
        db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('brewModes', ?)`).run(JSON.stringify(used))
      }
    },
  },
  {
    // The Sour/Good/Bitter/Bad buttons became a sour-to-bitter slider plus a "bad" checkbox.
    // Old verdicts are placed on the slider; verdict itself stays for older versions.
    name: 'taste slider and bad flag',
    up: () => {
      for (const t of ['shots', 'brews'] as const) {
        addColumn(t, 'landed', 'INTEGER')
        addColumn(t, 'bad', 'INTEGER DEFAULT 0')
        db.exec(fillFromVerdictsSql(t))
      }
    },
  },
]

/** The schema version this code creates and upgrades to (PRAGMA user_version) */
export const SCHEMA_VERSION = MIGRATIONS.length

/**
 * Safety copy of the whole database next to it, as grounded.db.backup-<label>-<time>.
 * VACUUM INTO writes a consistent snapshot even while the app is running.
 * Returns the file name.
 */
export function snapshotDatabase(label: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)   // 20261030-140501
  const file = unusedName(`${DB_PATH}.backup-${label}-${stamp}`)
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
  return path.basename(file)
}

/** Adds -2, -3, … when two snapshots are taken within the same second */
const unusedName = (file: string, n = 1): string => {
  const candidate = n === 1 ? file : `${file}-${n}`
  return fs.existsSync(candidate) ? unusedName(file, n + 1) : candidate
}

/** Deletes a snapshot that turned out not to be needed (by the file name snapshotDatabase returned) */
export function deleteSnapshot(name: string): void {
  fs.rmSync(path.join(path.dirname(DB_PATH), path.basename(name)), { force: true })
}

function runMigrations(): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > MIGRATIONS.length) {
    console.warn(`  ! Database is from a newer Grounded (schema v${current}, this version knows v${MIGRATIONS.length})`)
    return
  }
  if (current === MIGRATIONS.length) return

  // A brand-new database already has the full schema: just record the version
  if (isNewDatabase) {
    db.pragma(`user_version = ${MIGRATIONS.length}`)
    return
  }

  const backup = snapshotDatabase(`v${current}`)
  console.log(`  ✓ Backed up the database to ${backup} before updating it`)

  for (let i = current; i < MIGRATIONS.length; i++) {
    const m = MIGRATIONS[i]!
    db.transaction(() => {
      m.up()
      db.pragma(`user_version = ${i + 1}`)
    })()
    console.log(`  ✓ Migration ${i + 1}: ${m.name}`)
  }
}

runMigrations()

// ── Seed (only if tables are empty) ─────────────────────────────────
const seedIfEmpty = (table: string, seedFn: () => void) => {
  const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c
  if (count === 0) seedFn()
}

seedIfEmpty('beans', () => {
  const insert = db.prepare(`
    INSERT INTO beans (id, name, roaster, origin, process, variety, roast_date, roast, altitude, notes, price, weight, remaining, stock)
    VALUES (@id, @name, @roaster, @origin, @process, @variety, @roast_date, @roast, @altitude, @notes, @price, @weight, @remaining, @stock)
  `)
  const beans = [
    { id:'b-idido',  name:'Idido',                 roaster:'Tim Wendelboe', origin:'Ethiopia · Yirgacheffe', process:'Washed',   variety:'Heirloom',           roast_date:'2026-04-08', roast:'Light',        altitude:'2100m', notes:JSON.stringify(['Bergamot','Jasmine','Lemon curd','Honey']),         price:24, weight:250, remaining:138, stock:'good'     },
    { id:'b-finca',  name:'Finca Tamana',           roaster:'Square Mile',   origin:'Colombia · Huila',       process:'Washed',   variety:'Caturra, Colombia',  roast_date:'2026-04-11', roast:'Light-medium', altitude:'1750m', notes:JSON.stringify(['Red apple','Caramel','Brown sugar','Plum']),       price:19, weight:350, remaining:244, stock:'good'     },
    { id:'b-suke',   name:'Suke Quto',              roaster:'Onyx',          origin:'Ethiopia · Guji',        process:'Natural',  variety:'Kurume, Welicho',    roast_date:'2026-04-02', roast:'Light',        altitude:'1900m', notes:JSON.stringify(['Blueberry','Dark chocolate','Wine']),             price:22, weight:250, remaining:42,  stock:'low'      },
    { id:'b-geisha', name:'Hacienda La Esmeralda',  roaster:'April',         origin:'Panama · Boquete',       process:'Washed',   variety:'Geisha',             roast_date:'2026-03-28', roast:'Light',        altitude:'1650m', notes:JSON.stringify(['Jasmine','Peach','Earl grey']),                   price:48, weight:100, remaining:11,  stock:'critical' },
  ]
  beans.forEach(b => insert.run(b))
  console.log('  ✓ Seeded beans')
})

seedIfEmpty('shots', () => {
  const insert = db.prepare(`
    INSERT INTO shots (id, date, bean_id, bean, roaster, dose, yield, time, preinf, temp, grind, rating,
      taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
      notes, verdict)
    VALUES (@id, @date, (SELECT id FROM beans WHERE name = @bean), @bean, @roaster, @dose, @yield, @time, @preinf, @temp, @grind, @rating,
      @taste_acidity, @taste_sweetness, @taste_body, @taste_bitterness, @taste_balance, @taste_aftertaste,
      @notes, @verdict)
  `)
  const shots = [
    { id:'s-42', date:'2026-04-18 08:14', bean:'Idido',       roaster:'Tim Wendelboe', dose:18.0, yield:40.2, time:28, preinf:8,  temp:93.5, grind:2.4, rating:8.5, taste_acidity:7, taste_sweetness:8, taste_body:5, taste_bitterness:3, taste_balance:8, taste_aftertaste:7, notes:'Bright lemon, honey finish. Best shot this week.', verdict:'good'  },
    { id:'s-41', date:'2026-04-18 07:52', bean:'Idido',       roaster:'Tim Wendelboe', dose:18.0, yield:38.5, time:26, preinf:6,  temp:93.5, grind:2.4, rating:7.5, taste_acidity:8, taste_sweetness:6, taste_body:4, taste_bitterness:2, taste_balance:6, taste_aftertaste:6, notes:'A bit sharp on the front, needs more extraction.',  verdict:'under'   },
    { id:'s-40', date:'2026-04-17 19:32', bean:'Idido',       roaster:'Tim Wendelboe', dose:18.0, yield:41.0, time:22, preinf:6,  temp:93.0, grind:2.5, rating:5.0, taste_acidity:9, taste_sweetness:3, taste_body:2, taste_bitterness:2, taste_balance:3, taste_aftertaste:3, notes:'Gushed. Too coarse.',                                  verdict:'under'   },
    { id:'s-39', date:'2026-04-17 08:02', bean:'Finca Tamana',roaster:'Square Mile',   dose:18.5, yield:37.0, time:30, preinf:8,  temp:94.0, grind:3.1, rating:8.0, taste_acidity:5, taste_sweetness:8, taste_body:7, taste_bitterness:4, taste_balance:8, taste_aftertaste:7, notes:'Caramel-forward, chocolate finish.',                   verdict:'good'  },
    { id:'s-38', date:'2026-04-16 18:15', bean:'Finca Tamana',roaster:'Square Mile',   dose:18.5, yield:36.5, time:33, preinf:10, temp:94.0, grind:3.1, rating:7.0, taste_acidity:4, taste_sweetness:7, taste_body:8, taste_bitterness:6, taste_balance:6, taste_aftertaste:5, notes:'Slight bitterness at the back. Drop temp?',            verdict:'over' },
  ]
  shots.forEach(s => insert.run(s))
  db.exec(fillFromVerdictsSql('shots'))   // the sample rows are written with verdicts
  console.log('  ✓ Seeded shots')
})

seedIfEmpty('gear', () => {
  const insert = db.prepare(`INSERT INTO gear (id, kind, name, owned, status, meta) VALUES (@id, @kind, @name, @owned, @status, @meta)`)
  const gear = [
    { id:'g-lelit',      kind:'Espresso machine', name:'Lelit Bianca V3',     owned:'2024-02', status:'Primary', meta:'58mm · dual boiler · paddle' },
    { id:'g-df64',       kind:'Grinder',          name:'DF64 Gen 2',           owned:'2024-05', status:'Primary', meta:'SSP MP · 64mm flat'          },
    { id:'g-comandante', kind:'Hand grinder',     name:'Comandante C40 MK4',   owned:'2022-11', status:'Travel',  meta:'Red clix · steel burrs'      },
    { id:'g-v60',        kind:'Dripper',          name:'Hario V60 02',         owned:'2021-08', status:'Active',  meta:'ceramic · white'             },
    { id:'g-aero',       kind:'Dripper',          name:'AeroPress Original',   owned:'2020-04', status:'Active',  meta:'stock plunger'               },
    { id:'g-kettle',     kind:'Kettle',           name:'Fellow Stagg EKG',     owned:'2023-06', status:'Active',  meta:'matte black · 0.9L'          },
    { id:'g-acaia',      kind:'Scale',            name:'Acaia Lunar',          owned:'2023-09', status:'Primary', meta:'0.1g · flow tracking'        },
    { id:'g-basket',     kind:'Basket',           name:'IMS Competition 18g',  owned:'2024-06', status:'In use',  meta:'B702TH26 · nanoquartz'       },
  ]
  gear.forEach(g => insert.run(g))
  console.log('  ✓ Seeded gear')
})

seedIfEmpty('brews', () => {
  const insert = db.prepare(`
    INSERT INTO brews (id, date, bean_id, bean, roaster, dripper, dose, water, temp, grind,
      bloom_time, num_pours, pours, time, rating,
      taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
      notes, verdict)
    VALUES (@id, @date, (SELECT id FROM beans WHERE name = @bean), @bean, @roaster, @dripper, @dose, @water, @temp, @grind,
      @bloom_time, @num_pours, @pours, @time, @rating,
      @taste_acidity, @taste_sweetness, @taste_body, @taste_bitterness, @taste_balance, @taste_aftertaste,
      @notes, @verdict)
  `)
  const brews = [
    {
      id: 'brew-1', date: '2026-04-19 09:30', bean: 'Idido', roaster: 'Tim Wendelboe',
      dripper: 'V60',
      dose: 20, water: 300, temp: 92, grind: 18,
      bloom_time: 45, num_pours: 5, pours: JSON.stringify([60, 60, 60, 60, 60]),
      time: 215, rating: 8.8,
      taste_acidity: 8, taste_sweetness: 8, taste_body: 5, taste_bitterness: 2, taste_balance: 9, taste_aftertaste: 9,
      notes: 'Floral, bergamot, very clean cup. Tetsu 4:6 method.', verdict: 'good',
    },
    {
      id: 'brew-2', date: '2026-04-20 10:15', bean: 'Finca Tamana', roaster: 'Square Mile',
      dripper: 'AeroPress',
      dose: 15, water: 220, temp: 88, grind: 12,
      bloom_time: 30, num_pours: 2, pours: JSON.stringify([30, 190]),
      time: 135, rating: 7.8,
      taste_acidity: 5, taste_sweetness: 8, taste_body: 7, taste_bitterness: 3, taste_balance: 7, taste_aftertaste: 8,
      notes: 'Chocolatey and sweet. Inverted method.', verdict: 'good',
    },
  ]
  brews.forEach(b => insert.run(b))
  db.exec(fillFromVerdictsSql('brews'))   // the sample rows are written with verdicts
  console.log('  ✓ Seeded brews')
})

seedIfEmpty('recipes', () => {
  const insert = db.prepare(`INSERT INTO recipes (id, name, type, time, dose, water, ratio, temp, grind, author, tags, steps) VALUES (@id, @name, @type, @time, @dose, @water, @ratio, @temp, @grind, @author, @tags, @steps)`)
  const recipes = [
    {
      id:'r-tetsu', name:'Tetsu 4:6 — Balanced', type:'V60', time:'3:30', dose:20, water:300, ratio:'1:15', temp:92,
      grind:'Medium-coarse · 18 clicks (C40)', author:'Grounded default',
      tags: JSON.stringify(['easy','single origin','light roast']),
      steps: JSON.stringify([
        { t:'0:00', name:'Bloom',  desc:'Pour in spirals, gentle agitation. Rest.',  water:'60g'  },
        { t:'0:45', name:'Pour 2', desc:'Sweetness control. Slow center pour.',       water:'120g' },
        { t:'1:30', name:'Pour 3', desc:'Strength. Pulse-pour, let drawdown.',        water:'180g' },
        { t:'2:15', name:'Pour 4', desc:'Rinse walls outward.',                       water:'240g' },
        { t:'2:45', name:'Pour 5', desc:'Final pulse to target.',                     water:'300g' },
      ]),
    },
    {
      id:'r-aero', name:'Inverted AeroPress', type:'AeroPress', time:'2:00', dose:15, water:220, ratio:'1:14.7', temp:88,
      grind:'Medium · 15 clicks (C40)', author:'Grounded default',
      tags: JSON.stringify(['travel','forgiving','omni-roast']),
      steps: JSON.stringify([
        { t:'0:00', name:'Bloom',      desc:'Add coffee, pour water. Stir 10x.', water:'30g'  },
        { t:'0:30', name:'Fill',       desc:'Pour remaining water steadily.',     water:'220g' },
        { t:'1:30', name:'Stir & cap', desc:'Stir 5x, attach filter, flip.'                   },
        { t:'1:45', name:'Press',      desc:'Press slowly over ~20s.'                         },
      ]),
    },
    {
      id:'r-hoffmann', name:'James Hoffmann Ultimate', type:'AeroPress', time:'2:00', dose:11, water:200, ratio:'1:18', temp:100,
      grind:'Fine-medium · 12 clicks (C40)', author:'James Hoffmann',
      tags: JSON.stringify(['refined','clarity','light roast']),
      steps: JSON.stringify([
        { t:'0:00', name:'Add coffee',   desc:'Standard orientation.'                              },
        { t:'0:00', name:'Add water',    desc:'Fill to top. Do not stir.',         water:'200g'   },
        { t:'0:00', name:'Swirl',        desc:'Gentle swirl to saturate grounds.'                 },
        { t:'2:00', name:'Flip & press', desc:'Flip onto cup, press gently over 30s.'             },
      ]),
    },
  ]
  recipes.forEach(r => insert.run(r))
  console.log('  ✓ Seeded recipes')
})

// ── Sample data ─────────────────────────────────────────────────────
// The rows a brand-new install is seeded with (keep in sync with the seeds above).
// POST /api/sample-data/clear removes exactly these and nothing else. The sample
// recipes aren't listed: they're real recipes and stay useful.
export const SAMPLE_IDS = {
  beans: ['b-idido', 'b-finca', 'b-suke', 'b-geisha'],
  shots: ['s-38', 's-39', 's-40', 's-41', 's-42'],
  brews: ['brew-1', 'brew-2'],
  gear:  ['g-lelit', 'g-df64', 'g-comandante', 'g-v60', 'g-aero', 'g-kettle', 'g-acaia', 'g-basket'],
} as const

// Only a brand-new install is marked, so only there does the UI offer to remove
// the samples. Existing databases never get this setting.
if (isNewDatabase) {
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('sampleData', '"present"')`).run()
}

/** All saved settings as one object (each row's value is JSON) */
export function readSettings(): Settings {
  const parse = (value: string): unknown => { try { return JSON.parse(value) } catch { return undefined } }
  return Object.fromEntries(
    db.prepare<[], Pick<SettingRow, 'key' | 'value'>>('SELECT key, value FROM settings').all()
      .map(row => [row.key, parse(row.value)])
      .filter(([, value]) => value !== undefined)
  )
}

export default db
