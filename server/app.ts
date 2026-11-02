// The Express app: middleware and every API route. server/index.ts starts it;
// the tests in server/*.test.ts import it directly.
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import db, { SAMPLE_IDS, readSettings } from './db.ts'
import { tasteResult } from './taste.ts'
import { createBackup, restoreBackup, shotsCsv, brewsCsv, today } from './backup.ts'
import { HttpError, NOT_FOUND, FORBIDDEN, CONFLICT, errorHandler, found } from './errors.ts'
import {
  parseBody, shotSchema, brewSchema, beanSchema, gearSchema, recipeSchema, tipSchema,
  favoriteSchema, settingsSchema,
} from './validation.ts'
import type {
  Shot, ShotRow, Brew, BrewRow, Bean, BeanRow, GearRow, Recipe, RecipeRow, TipRow,
  StockLevel,
} from '../src/types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const app = express()
const CREATED = 201
const DATE_LENGTH = 'YYYY-MM-DD'.length

// ── Security basics ──────────────────────────────────────────────────
app.disable('x-powered-by')
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff')   // browsers must not guess file types
  res.set('Referrer-Policy', 'same-origin')      // don't send page addresses to other sites
  // No X-Frame-Options / frame-ancestors on purpose: Grounded may be embedded in a home dashboard
  next()
})

// Optional DNS-rebinding protection: with ALLOWED_HOSTS set (comma-separated host
// names or IPs, no ports), requests for any other Host are refused. Off when unset.
// localhost and 127.0.0.1 always work, for the Docker health check.
const allowedHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
const ALWAYS_ALLOWED = ['localhost', '127.0.0.1', '::1']
if (allowedHosts.length) {
  const allowed = new Set([...allowedHosts, ...ALWAYS_ALLOWED])
  app.use((req, res, next) => {
    if (allowed.has(req.hostname.toLowerCase())) { next(); return }
    next(new HttpError(FORBIDDEN, `Host "${req.hostname}" is not in ALLOWED_HOSTS`))
  })
}

// Backups can be several MB; every other request stays under the default 100 KB.
// (The route-specific parser runs first, and the general one then skips that body.)
const IMPORT_LIMIT = '50mb'
app.use('/api/import', express.json({ limit: IMPORT_LIMIT }))
app.use(express.json())

// ── Helper: map a DB shot row → API shape ───────────────────────────
function rowToShot(row: ShotRow): Shot {
  return {
    id:      row.id,
    date:    row.date,
    bean_id: row.bean_id ?? null,
    bean:    row.bean,
    roaster: row.roaster,
    dose:    row.dose,
    yield:   row.yield,
    time:    row.time,
    preinf:  row.preinf,
    temp:    row.temp,
    grind:   row.grind,
    rating:  row.rating,
    taste: {
      acidity:    row.taste_acidity,
      sweetness:  row.taste_sweetness,
      body:       row.taste_body,
      bitterness: row.taste_bitterness,
      balance:    row.taste_balance,
      aftertaste: row.taste_aftertaste,
    },
    notes:         row.notes,
    verdict:       row.verdict,
    landed:        row.landed ?? null,
    bad:           Boolean(row.bad),
    machine:       row.machine,
    grinder_model: row.grinder_model,
    grinder_rpm:   row.grinder_rpm,
    water_recipe:  row.water_recipe,
    basket:        row.basket,
    brew_mode:     row.brew_mode,
    favorited:     Boolean(row.favorited),
  }
}

function rowToBrew(row: BrewRow): Brew {
  return {
    id:          row.id,
    date:        row.date,
    bean_id:     row.bean_id ?? null,
    bean:        row.bean,
    roaster:     row.roaster,
    dripper:       row.dripper,
    grinder_model: row.grinder_model,
    dose:        row.dose,
    water:       row.water,
    temp:        row.temp,
    grind:       row.grind,
    bloom_time:  row.bloom_time,
    num_pours:   row.num_pours,
    pours:       JSON.parse(row.pours || '[]'),
    time:        row.time,
    rating:      row.rating,
    taste: {
      acidity:    row.taste_acidity,
      sweetness:  row.taste_sweetness,
      body:       row.taste_body,
      bitterness: row.taste_bitterness,
      balance:    row.taste_balance,
      aftertaste: row.taste_aftertaste,
    },
    notes:        row.notes,
    verdict:      row.verdict,
    landed:       row.landed ?? null,
    bad:          Boolean(row.bad),
    grinder_rpm:  row.grinder_rpm,
    water_recipe: row.water_recipe,
    favorited:    Boolean(row.favorited),
  }
}

function rowToBean(row: BeanRow): Bean {
  return { ...row, notes: JSON.parse(row.notes || '[]'), doses: JSON.parse(row.doses || '[]') }
}

function rowToRecipe(row: RecipeRow): Recipe {
  return { ...row, tags: JSON.parse(row.tags || '[]'), steps: JSON.parse(row.steps || '[]') }
}

const getShot   = (id: string): ShotRow   => found(db.prepare<[string], ShotRow>('SELECT * FROM shots WHERE id = ?').get(id), 'Shot')
const getBrew   = (id: string): BrewRow   => found(db.prepare<[string], BrewRow>('SELECT * FROM brews WHERE id = ?').get(id), 'Brew')
const getBean   = (id: string): BeanRow   => found(db.prepare<[string], BeanRow>('SELECT * FROM beans WHERE id = ?').get(id), 'Bean')
const getGear   = (id: string): GearRow   => found(db.prepare<[string], GearRow>('SELECT * FROM gear WHERE id = ?').get(id), 'Gear')
const getRecipe = (id: string): RecipeRow => found(db.prepare<[string], RecipeRow>('SELECT * FROM recipes WHERE id = ?').get(id), 'Recipe')
const getTip    = (id: string): TipRow    => found(db.prepare<[string], TipRow>('SELECT * FROM tips WHERE id = ?').get(id), 'Tip')

const deleteById = (table: string, id: string, what: string): void => {
  if (db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes === 0) throw new HttpError(NOT_FOUND, `${what} not found`)
}

// ── Beans ↔ shots & brews ────────────────────────────────────────────
// Shots and brews point at their bean by id. The bean's name and roaster are also
// stored on them, so history still reads right if the bean is deleted.

const BEAN_LINKED_TABLES = ['shots', 'brews'] as const

interface BeanRef { bean_id: string | null, bean: string, roaster: string }

/** Fills bean name/roaster from bean_id; falls back to a lookup by name for older clients */
function resolveBean(input: { bean_id?: string | null, bean?: string | null, roaster?: string | null }): BeanRef {
  const byId = input.bean_id
    ? db.prepare<[string], Pick<BeanRow, 'id' | 'name' | 'roaster'>>('SELECT id, name, roaster FROM beans WHERE id = ?').get(input.bean_id)
    : undefined
  const bean = byId ?? (input.bean
    ? db.prepare<[string], Pick<BeanRow, 'id' | 'name' | 'roaster'>>(
        'SELECT id, name, roaster FROM beans WHERE name = ? ORDER BY archived ASC, roast_date DESC LIMIT 1').get(input.bean)
    : undefined)
  if (bean) return { bean_id: bean.id, bean: bean.name, roaster: bean.roaster }
  return { bean_id: null, bean: input.bean ?? '', roaster: input.roaster ?? '' }
}

const STOCK_LOW      = 0.25
const STOCK_CRITICAL = 0.1

function stockLevel(pctLeft: number): StockLevel {
  if (pctLeft > STOCK_LOW) return 'good'
  if (pctLeft > STOCK_CRITICAL) return 'low'
  return 'critical'
}

/** Adds `delta` grams to a bean's remaining stock (negative = coffee used) and updates its stock level */
function adjustStock(beanId: string | null | undefined, delta: number | null | undefined): void {
  if (!beanId || !delta) return
  const bean = db.prepare<[string], Pick<BeanRow, 'weight' | 'remaining'>>('SELECT weight, remaining FROM beans WHERE id = ?').get(beanId)
  if (!bean) return
  const weight = bean.weight || 0
  const remaining = Math.min(weight > 0 ? weight : Infinity, Math.max(0, (bean.remaining || 0) + delta))
  const pct = weight > 0 ? remaining / weight : 1
  db.prepare('UPDATE beans SET remaining = ?, stock = ? WHERE id = ?').run(remaining, stockLevel(pct), beanId)
}

/** Moves stock when a shot/brew changes bean or dose: give back the old dose, take the new one */
function restock(before: { bean_id: string | null, dose: number | null }, after: { bean_id: string | null, dose: number | null }): void {
  if (before.bean_id === after.bean_id && before.dose === after.dose) return
  adjustStock(before.bean_id, before.dose)
  adjustStock(after.bean_id, after.dose == null ? null : -after.dose)
}

// A new row's id when the client didn't send one: the time, plus a random part so two
// rows saved in the same millisecond don't collide ('shot-1730550000000-3f9c2a1b')
const ID_RANDOM_CHARS = 8
const newId = (prefix: string): string => `${prefix}-${Date.now()}-${randomUUID().slice(0, ID_RANDOM_CHARS)}`

// ── SHOTS ────────────────────────────────────────────────────────────
app.get('/api/shots', (req, res) => {
  const rows = db.prepare<[], ShotRow>('SELECT * FROM shots ORDER BY date DESC').all()
  res.json(rows.map(rowToShot))
})

app.post('/api/shots', (req, res) => {
  const s = parseBody(shotSchema, req.body)
  const id = s.id || newId('shot')
  const ref = resolveBean(s)
  const t = tasteResult(s)
  db.transaction(() => {
    db.prepare(`
      INSERT INTO shots (id, date, bean_id, bean, roaster, dose, yield, time, preinf, temp, grind, rating,
        taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
        notes, verdict, landed, bad, machine, grinder_model, grinder_rpm, water_recipe, basket, brew_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, s.date, ref.bean_id, ref.bean, ref.roaster, s.dose, s.yield, s.time, s.preinf, s.temp, s.grind, s.rating,
      s.taste?.acidity, s.taste?.sweetness, s.taste?.body, s.taste?.bitterness, s.taste?.balance, s.taste?.aftertaste,
      s.notes, t.verdict, t.landed, t.bad, s.machine, s.grinder_model, s.grinder_rpm == null ? null : String(s.grinder_rpm),
      s.water_recipe ?? null, s.basket ?? null, s.brew_mode ?? null
    )
    adjustStock(ref.bean_id, s.dose == null ? null : -s.dose)
  })()
  res.status(CREATED).json(rowToShot(getShot(id)))
})

app.put('/api/shots/:id', (req, res) => {
  const s = parseBody(shotSchema, req.body)
  const before = getShot(req.params.id)
  const ref = resolveBean(s)
  const t = tasteResult(s)
  db.transaction(() => {
    db.prepare(`
      UPDATE shots SET
        date=?, bean_id=?, bean=?, roaster=?, dose=?, yield=?, time=?, preinf=?, temp=?, grind=?, rating=?,
        taste_acidity=?, taste_sweetness=?, taste_body=?, taste_bitterness=?, taste_balance=?, taste_aftertaste=?,
        notes=?, verdict=?, landed=?, bad=?, machine=?, grinder_model=?, grinder_rpm=?, water_recipe=?, basket=?, brew_mode=?
      WHERE id=?
    `).run(
      s.date, ref.bean_id, ref.bean, ref.roaster, s.dose, s.yield, s.time, s.preinf, s.temp, s.grind, s.rating,
      s.taste?.acidity, s.taste?.sweetness, s.taste?.body, s.taste?.bitterness, s.taste?.balance, s.taste?.aftertaste,
      s.notes, t.verdict, t.landed, t.bad, s.machine, s.grinder_model, s.grinder_rpm == null ? null : String(s.grinder_rpm),
      s.water_recipe ?? null, s.basket ?? null, s.brew_mode ?? null, req.params.id
    )
    restock(before, { bean_id: ref.bean_id, dose: s.dose ?? null })
  })()
  res.json(rowToShot(getShot(req.params.id)))
})

app.delete('/api/shots/:id', (req, res) => {
  const before = getShot(req.params.id)
  db.transaction(() => {
    deleteById('shots', req.params.id, 'Shot')
    adjustStock(before.bean_id, before.dose)
  })()
  res.json({ ok: true })
})

app.patch('/api/shots/:id/favorite', (req, res) => {
  const { favorited } = parseBody(favoriteSchema, req.body)
  getShot(req.params.id)
  db.prepare('UPDATE shots SET favorited = ? WHERE id = ?').run(favorited ? 1 : 0, req.params.id)
  res.json(rowToShot(getShot(req.params.id)))
})

// ── BREWS ────────────────────────────────────────────────────────────
app.get('/api/brews', (req, res) => {
  const rows = db.prepare<[], BrewRow>('SELECT * FROM brews ORDER BY date DESC').all()
  res.json(rows.map(rowToBrew))
})

app.post('/api/brews', (req, res) => {
  const b = parseBody(brewSchema, req.body)
  const id = b.id || newId('brew')
  const ref = resolveBean(b)
  const t = tasteResult(b)
  db.transaction(() => {
    db.prepare(`
      INSERT INTO brews (id, date, bean_id, bean, roaster, dripper, grinder_model, dose, water, temp, grind,
        bloom_time, num_pours, pours, time, rating,
        taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
        notes, verdict, landed, bad, grinder_rpm, water_recipe)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, b.date, ref.bean_id, ref.bean, ref.roaster, b.dripper, b.grinder_model, b.dose, b.water, b.temp, b.grind,
      b.bloom_time, b.num_pours, JSON.stringify(b.pours || []), b.time, b.rating,
      b.taste?.acidity, b.taste?.sweetness, b.taste?.body, b.taste?.bitterness, b.taste?.balance, b.taste?.aftertaste,
      b.notes, t.verdict, t.landed, t.bad, b.grinder_rpm == null ? null : String(b.grinder_rpm), b.water_recipe ?? null
    )
    adjustStock(ref.bean_id, b.dose == null ? null : -b.dose)
  })()
  res.status(CREATED).json(rowToBrew(getBrew(id)))
})

app.put('/api/brews/:id', (req, res) => {
  const b = parseBody(brewSchema, req.body)
  const before = getBrew(req.params.id)
  const ref = resolveBean(b)
  const t = tasteResult(b)
  db.transaction(() => {
    db.prepare(`
      UPDATE brews SET
        date=?, bean_id=?, bean=?, roaster=?, dripper=?, grinder_model=?, dose=?, water=?, temp=?, grind=?,
        bloom_time=?, num_pours=?, pours=?, time=?, rating=?,
        taste_acidity=?, taste_sweetness=?, taste_body=?, taste_bitterness=?, taste_balance=?, taste_aftertaste=?,
        notes=?, verdict=?, landed=?, bad=?, grinder_rpm=?, water_recipe=?
      WHERE id=?
    `).run(
      b.date, ref.bean_id, ref.bean, ref.roaster, b.dripper, b.grinder_model, b.dose, b.water, b.temp, b.grind,
      b.bloom_time, b.num_pours, JSON.stringify(b.pours || []), b.time, b.rating,
      b.taste?.acidity, b.taste?.sweetness, b.taste?.body, b.taste?.bitterness, b.taste?.balance, b.taste?.aftertaste,
      b.notes, t.verdict, t.landed, t.bad, b.grinder_rpm == null ? null : String(b.grinder_rpm), b.water_recipe ?? null, req.params.id
    )
    restock(before, { bean_id: ref.bean_id, dose: b.dose ?? null })
  })()
  res.json(rowToBrew(getBrew(req.params.id)))
})

app.delete('/api/brews/:id', (req, res) => {
  const before = getBrew(req.params.id)
  db.transaction(() => {
    deleteById('brews', req.params.id, 'Brew')
    adjustStock(before.bean_id, before.dose)
  })()
  res.json({ ok: true })
})

app.patch('/api/brews/:id/favorite', (req, res) => {
  const { favorited } = parseBody(favoriteSchema, req.body)
  getBrew(req.params.id)
  db.prepare('UPDATE brews SET favorited = ? WHERE id = ?').run(favorited ? 1 : 0, req.params.id)
  res.json(rowToBrew(getBrew(req.params.id)))
})

// ── BEANS ────────────────────────────────────────────────────────────
app.get('/api/beans', (req, res) => {
  res.json(db.prepare<[], BeanRow>('SELECT * FROM beans WHERE archived = 0 OR archived IS NULL ORDER BY roast_date DESC').all().map(rowToBean))
})

app.get('/api/beans/archived', (req, res) => {
  res.json(db.prepare<[], BeanRow>('SELECT * FROM beans WHERE archived = 1 ORDER BY archived_at DESC').all().map(rowToBean))
})

app.post('/api/beans', (req, res) => {
  const b = parseBody(beanSchema, req.body)
  const id = b.id || newId('bean')
  db.prepare(`
    INSERT INTO beans (id, name, roaster, origin, process, variety, roast_date, roast, altitude, notes, price, weight, remaining, stock, doses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.name, b.roaster ?? '', b.origin, b.process, b.variety, b.roast_date,
    b.roast, b.altitude, JSON.stringify(b.notes || []), b.price, b.weight, b.remaining, b.stock || 'good',
    JSON.stringify(b.doses || []))
  res.status(CREATED).json(rowToBean(getBean(id)))
})

app.put('/api/beans/:id', (req, res) => {
  const b = parseBody(beanSchema, req.body)
  getBean(req.params.id)
  db.transaction(() => {
    db.prepare(`
      UPDATE beans SET name=?, roaster=?, origin=?, process=?, variety=?, roast_date=?, roast=?,
        altitude=?, notes=?, price=?, weight=?, remaining=?, stock=?, archived=?, archived_at=?,
        doses=COALESCE(?, doses)
      WHERE id=?
    `).run(b.name, b.roaster ?? '', b.origin, b.process, b.variety, b.roast_date,
      b.roast, b.altitude, JSON.stringify(b.notes || []), b.price, b.weight, b.remaining, b.stock,
      b.archived ? 1 : 0, b.archived ? (b.archived_at || new Date().toISOString().slice(0, DATE_LENGTH)) : null,
      // Only overwrite doses when the client sends them, so other bean edits can't wipe them
      Array.isArray(b.doses) ? JSON.stringify(b.doses) : null,
      req.params.id)
    // Keep the name shown on this bean's shots and brews in step with a rename
    BEAN_LINKED_TABLES.forEach(t => {
      db.prepare(`UPDATE ${t} SET bean = ?, roaster = ? WHERE bean_id = ?`).run(b.name, b.roaster ?? '', req.params.id)
    })
  })()
  res.json(rowToBean(getBean(req.params.id)))
})

app.delete('/api/beans/:id', (req, res) => {
  db.transaction(() => {
    deleteById('beans', req.params.id, 'Bean')
    // History keeps the bean's name; it just no longer links to a bean
    BEAN_LINKED_TABLES.forEach(t => db.prepare(`UPDATE ${t} SET bean_id = NULL WHERE bean_id = ?`).run(req.params.id))
  })()
  res.json({ ok: true })
})

// ── GEAR ─────────────────────────────────────────────────────────────
app.get('/api/gear', (req, res) => {
  res.json(db.prepare<[], GearRow>('SELECT * FROM gear ORDER BY kind, name').all())
})

app.post('/api/gear', (req, res) => {
  const g = parseBody(gearSchema, req.body)
  const id = g.id || newId('gear')
  db.prepare('INSERT INTO gear (id, kind, name, owned, status, meta, price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, g.kind, g.name, g.owned, g.status, g.meta, g.price || null)
  res.status(CREATED).json(getGear(id))
})

app.put('/api/gear/:id', (req, res) => {
  const g = parseBody(gearSchema, req.body)
  getGear(req.params.id)
  db.transaction(() => {
    if (g.status === 'Primary') {
      db.prepare("UPDATE gear SET status='Active' WHERE kind=? AND status='Primary' AND id != ?")
        .run(g.kind, req.params.id)
    }
    db.prepare('UPDATE gear SET kind=?, name=?, owned=?, status=?, meta=?, price=? WHERE id=?')
      .run(g.kind, g.name, g.owned, g.status, g.meta, g.price || null, req.params.id)
  })()
  res.json(getGear(req.params.id))
})

app.delete('/api/gear/:id', (req, res) => {
  deleteById('gear', req.params.id, 'Gear')
  res.json({ ok: true })
})

// ── RECIPES ──────────────────────────────────────────────────────────
app.get('/api/recipes', (req, res) => {
  res.json(db.prepare<[], RecipeRow>('SELECT * FROM recipes ORDER BY name').all().map(rowToRecipe))
})

app.post('/api/recipes', (req, res) => {
  const r = parseBody(recipeSchema, req.body)
  const id = r.id || newId('recipe')
  db.prepare(`INSERT INTO recipes (id, name, type, time, dose, water, ratio, temp, grind, author, tags, steps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, r.name, r.type, r.time, r.dose, r.water, r.ratio, r.temp, r.grind, r.author,
      JSON.stringify(r.tags || []), JSON.stringify(r.steps || []))
  res.status(CREATED).json(rowToRecipe(getRecipe(id)))
})

app.put('/api/recipes/:id', (req, res) => {
  const r = parseBody(recipeSchema, req.body)
  getRecipe(req.params.id)
  db.prepare(`UPDATE recipes SET name=?, type=?, time=?, dose=?, water=?, ratio=?, temp=?, grind=?, author=?, tags=?, steps=? WHERE id=?`)
    .run(r.name, r.type, r.time, r.dose, r.water, r.ratio, r.temp, r.grind, r.author,
      JSON.stringify(r.tags || []), JSON.stringify(r.steps || []), req.params.id)
  res.json(rowToRecipe(getRecipe(req.params.id)))
})

app.delete('/api/recipes/:id', (req, res) => {
  deleteById('recipes', req.params.id, 'Recipe')
  res.json({ ok: true })
})

// ── TIPS ─────────────────────────────────────────────────────────────
app.get('/api/tips', (req, res) => {
  res.json(db.prepare<[], TipRow>('SELECT * FROM tips ORDER BY section, category, sort_order, created_at').all())
})

app.post('/api/tips', (req, res) => {
  const t = parseBody(tipSchema, req.body)
  const id = t.id || newId('tip')
  db.prepare('INSERT INTO tips (id, section, category, body, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(id, t.section, t.category, t.body || '', t.sort_order || 0)
  res.status(CREATED).json(getTip(id))
})

app.put('/api/tips/:id', (req, res) => {
  const t = parseBody(tipSchema, req.body)
  getTip(req.params.id)
  db.prepare('UPDATE tips SET section=?, category=?, body=?, sort_order=? WHERE id=?')
    .run(t.section, t.category, t.body || '', t.sort_order || 0, req.params.id)
  res.json(getTip(req.params.id))
})

app.delete('/api/tips/:id', (req, res) => {
  deleteById('tips', req.params.id, 'Tip')
  res.json({ ok: true })
})

// ── SETTINGS ─────────────────────────────────────────────────────────
// Stored as one row per key with a JSON value, returned as a single object

app.get('/api/settings', (req, res) => {
  res.json(readSettings())
})

// Partial update: only the keys sent are changed; unknown keys are rejected
app.put('/api/settings', (req, res) => {
  const body = parseBody(settingsSchema, req.body)
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `)
  db.transaction(() => {
    Object.entries(body)
      .filter(([, value]) => value !== undefined)
      .forEach(([key, value]) => upsert.run(key, JSON.stringify(value)))
  })()
  res.json(readSettings())
})

// ── SAMPLE DATA ──────────────────────────────────────────────────────
// Removes the sample beans, shots, brews and gear a new install starts with.
// Only works once, and only on an install marked as having sample data, so it
// can never touch a database that started out without them.
app.post('/api/sample-data/clear', (req, res) => {
  if (readSettings().sampleData !== 'present') {
    throw new HttpError(CONFLICT, 'There is no sample data to remove on this install')
  }
  const removed = db.transaction(() => {
    const counts = Object.fromEntries(Object.entries(SAMPLE_IDS).map(([table, ids]) => [
      table,
      ids.reduce((sum, id) => sum + db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes, 0),
    ]))
    // Shots you logged against a sample bean keep its name, just not the link
    const marks = SAMPLE_IDS.beans.map(() => '?').join(', ')
    BEAN_LINKED_TABLES.forEach(t => db.prepare(`UPDATE ${t} SET bean_id = NULL WHERE bean_id IN (${marks})`).run(...SAMPLE_IDS.beans))
    db.prepare(`UPDATE settings SET value = '"cleared"', updated_at = datetime('now') WHERE key = 'sampleData'`).run()
    return counts
  })()
  res.json({ removed })
})

// ── BACKUP & EXPORT ──────────────────────────────────────────────────
// Downloads: a full JSON backup, and shots/brews as CSV for spreadsheets.
// Restoring is in backup.ts (with a database snapshot first).
const JSON_INDENT = 2

app.get('/api/export', (req, res) => {
  res.attachment(`grounded-backup-${today()}.json`)
  res.send(JSON.stringify(createBackup(), null, JSON_INDENT))
})

app.get('/api/export/shots.csv', (req, res) => {
  res.attachment(`grounded-shots-${today()}.csv`)
  res.send(shotsCsv())
})

app.get('/api/export/brews.csv', (req, res) => {
  res.attachment(`grounded-brews-${today()}.csv`)
  res.send(brewsCsv())
})

app.post('/api/import', (req, res) => {
  res.json(restoreBackup(req.body))
})

// ── HEALTH ───────────────────────────────────────────────────────────
// Used by the Docker HEALTHCHECK and CI; also confirms the DB is readable
app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get()
  res.json({ ok: true })
})

// Anything else under /api is a mistake: answer JSON, not the SPA's index.html
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  next(new HttpError(NOT_FOUND, `No such endpoint: ${req.method} ${req.originalUrl}`))
})

// ── Serve built frontend in production ───────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')))
}

app.use(errorHandler)
