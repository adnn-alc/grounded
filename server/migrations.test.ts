// Upgrading a database from before numbered migrations (Grounded 1.0 layout).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { createTempDatabase } from './test-helpers.ts'

const tmp = createTempDatabase()

// A 1.0-era database: no bean_id, no archive or favourite columns, tips with the old column names
const old = new Database(tmp.dbPath)
old.exec(`
  CREATE TABLE beans (id TEXT PRIMARY KEY, name TEXT NOT NULL, roaster TEXT NOT NULL, origin TEXT, process TEXT,
    variety TEXT, roast_date TEXT, roast TEXT, altitude TEXT, notes TEXT, price REAL, weight REAL, remaining REAL,
    stock TEXT DEFAULT 'good', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE shots (id TEXT PRIMARY KEY, date TEXT NOT NULL, bean TEXT, roaster TEXT, dose REAL, yield REAL,
    time INTEGER, preinf INTEGER, temp REAL, grind REAL, rating REAL, taste_acidity REAL, taste_sweetness REAL,
    taste_body REAL, taste_bitterness REAL, taste_balance REAL, taste_aftertaste REAL, notes TEXT, verdict TEXT,
    brew_mode TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE gear (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, owned TEXT, status TEXT, meta TEXT,
    created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE recipes (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT, time TEXT, dose REAL, water REAL,
    ratio TEXT, temp REAL, grind TEXT, author TEXT, tags TEXT, steps TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE tips (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT,
    sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE brews (id TEXT PRIMARY KEY, date TEXT NOT NULL, bean TEXT, roaster TEXT, dripper TEXT, dose REAL,
    water REAL, temp REAL, grind REAL, bloom_time INTEGER, num_pours INTEGER, pours TEXT, time INTEGER, rating REAL,
    taste_acidity REAL, taste_sweetness REAL, taste_body REAL, taste_bitterness REAL, taste_balance REAL,
    taste_aftertaste REAL, notes TEXT, verdict TEXT, created_at TEXT DEFAULT (datetime('now')));

  -- Two bags with the same name: shots should go to the one roasted before them
  INSERT INTO beans (id, name, roaster, roast_date) VALUES ('old-bag', 'Idido', 'Tim Wendelboe', '2026-01-01'),
                                                          ('new-bag', 'Idido', 'Tim Wendelboe', '2026-06-01');
  INSERT INTO shots (id, date, bean, roaster, dose, brew_mode, verdict) VALUES
    ('s-feb', '2026-02-10 08:00', 'Idido', 'Tim Wendelboe', 18, 'Paddle', 'great'),
    ('s-jul', '2026-07-10 08:00', 'Idido', 'Tim Wendelboe', 18, 'Button 1', 'sour'),
    ('s-gone', '2026-07-11 08:00', 'Long gone bean', 'X', 18, NULL, 'good');
  INSERT INTO tips (id, category, title, body) VALUES ('t1', 'espresso', 'Puck prep', 'WDT');
`)
old.close()

const { default: db } = await import('./db.ts')

after(() => {
  db.close()
  tmp.cleanup()
})

const LATEST_SCHEMA = 3
const columns = (table: string): string[] =>
  db.prepare<[string], { name: string }>('SELECT name FROM pragma_table_info(?)').all(table).map(c => c.name)

test('runs every migration and records the version', () => {
  assert.equal(db.pragma('user_version', { simple: true }), LATEST_SCHEMA)
  assert.ok(['archived', 'archived_at', 'doses'].every(c => columns('beans').includes(c)))
  assert.ok(['bean_id', 'favorited', 'machine', 'basket'].every(c => columns('shots').includes(c)))
  assert.ok(['bean_id', 'favorited'].every(c => columns('brews').includes(c)))
  assert.ok(columns('gear').includes('price'))
})

test('an existing database is never marked as having sample data', () => {
  assert.equal(db.prepare(`SELECT 1 FROM settings WHERE key = 'sampleData'`).get(), undefined)
})

test('saves a backup before changing the database', () => {
  assert.ok(readdirSync(tmp.dir).some(f => f.startsWith('grounded.db.backup-v0-')))
})

test('links old shots to the bag roasted before them', () => {
  const beanOf = (id: string): string | null =>
    db.prepare<[string], { bean_id: string | null }>('SELECT bean_id FROM shots WHERE id = ?').get(id)?.bean_id ?? null
  assert.equal(beanOf('s-feb'), 'old-bag')
  assert.equal(beanOf('s-jul'), 'new-bag')
  assert.equal(beanOf('s-gone'), null)
})

test('keeps used brew modes as a setting, renames tips columns, retires old verdicts', () => {
  const modes = db.prepare<[], { value: string }>(`SELECT value FROM settings WHERE key = 'brewModes'`).get()
  assert.deepEqual(JSON.parse(modes?.value ?? 'null'), ['Paddle', 'Button 1'])
  assert.deepEqual(db.prepare('SELECT section, category FROM tips WHERE id = ?').get('t1'), { section: 'espresso', category: 'Puck prep' })
  const verdicts = db.prepare<[], { verdict: string }>(`SELECT verdict FROM shots ORDER BY date`).all().map(r => r.verdict)
  assert.deepEqual(verdicts, ['good', 'under', 'good'])
})
