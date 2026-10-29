import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

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
// tips column renames (category→section, title→category)
try { db.exec(`ALTER TABLE tips RENAME COLUMN category TO section`) } catch {}
try { db.exec(`ALTER TABLE tips RENAME COLUMN title TO category`) } catch {}
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
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shots (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    bean        TEXT,
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
    verdict     TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gear (
    id        TEXT PRIMARY KEY,
    kind      TEXT NOT NULL,
    name      TEXT NOT NULL,
    owned     TEXT,
    status    TEXT,
    meta      TEXT,
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
    bean         TEXT,
    roaster      TEXT,
    dripper      TEXT,
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
    created_at   TEXT DEFAULT (datetime('now'))
  );

  -- App-wide preferences (theme, fonts, units, water recipes, dial-in defaults)
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,   -- JSON
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)

// Migrations — safe to run repeatedly. They must run after CREATE TABLE so they
// also apply to a fresh database (on an existing one they fail harmlessly).
try { db.exec(`ALTER TABLE beans ADD COLUMN archived INTEGER DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE beans ADD COLUMN archived_at TEXT`) } catch {}
try { db.exec(`ALTER TABLE gear ADD COLUMN price REAL`) } catch {}
try { db.exec(`ALTER TABLE brews ADD COLUMN grinder_model TEXT`) } catch {}
try { db.exec(`ALTER TABLE shots ADD COLUMN machine TEXT`) } catch {}
try { db.exec(`ALTER TABLE shots ADD COLUMN grinder_model TEXT`) } catch {}
try { db.exec(`ALTER TABLE shots ADD COLUMN grinder_rpm TEXT`) } catch {}
try { db.exec(`ALTER TABLE brews ADD COLUMN grinder_rpm TEXT`) } catch {}
try { db.exec(`ALTER TABLE shots ADD COLUMN water_recipe TEXT`) } catch {}
try { db.exec(`ALTER TABLE brews ADD COLUMN water_recipe TEXT`) } catch {}
try { db.exec(`ALTER TABLE shots ADD COLUMN favorited INTEGER DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE brews ADD COLUMN favorited INTEGER DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE shots ADD COLUMN basket TEXT`) } catch {}
try { db.exec(`ALTER TABLE beans ADD COLUMN doses TEXT`) } catch {}  // JSON array of { basket, dose }
try { db.exec(`ALTER TABLE shots ADD COLUMN brew_mode TEXT`) } catch {}  // Pagaia / Button 1 / Button 2

// Retire legacy verdicts (great/sour/bitter) in favour of good/under/over/bad
for (const t of ['shots', 'brews']) {
  db.exec(`UPDATE ${t} SET verdict = CASE verdict WHEN 'great' THEN 'good' WHEN 'sour' THEN 'under' WHEN 'bitter' THEN 'over' END
           WHERE verdict IN ('great', 'sour', 'bitter')`)
}

// ── Seed (only if tables are empty) ─────────────────────────────────
const seedIfEmpty = (table, seedFn) => {
  const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c
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
    INSERT INTO shots (id, date, bean, roaster, dose, yield, time, preinf, temp, grind, rating,
      taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
      notes, verdict)
    VALUES (@id, @date, @bean, @roaster, @dose, @yield, @time, @preinf, @temp, @grind, @rating,
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
    INSERT INTO brews (id, date, bean, roaster, dripper, dose, water, temp, grind,
      bloom_time, num_pours, pours, time, rating,
      taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
      notes, verdict)
    VALUES (@id, @date, @bean, @roaster, @dripper, @dose, @water, @temp, @grind,
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

export default db
