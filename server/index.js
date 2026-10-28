import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(cors({ origin: 'http://localhost:5173' })) // dev only; prod serves from same origin

// ── Helper: map a DB shot row → API shape ───────────────────────────
function rowToShot(row) {
  return {
    id:      row.id,
    date:    row.date,
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
    machine:       row.machine,
    grinder_model: row.grinder_model,
    grinder_rpm:   row.grinder_rpm,
    water_recipe:  row.water_recipe,
    basket:        row.basket,
    brew_mode:     row.brew_mode,
    favorited:     Boolean(row.favorited),
  }
}

function rowToBrew(row) {
  return {
    id:          row.id,
    date:        row.date,
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
    grinder_rpm:  row.grinder_rpm,
    water_recipe: row.water_recipe,
    favorited:    Boolean(row.favorited),
  }
}

function rowToBean(row) {
  return { ...row, notes: JSON.parse(row.notes || '[]'), doses: JSON.parse(row.doses || '[]') }
}

function rowToRecipe(row) {
  return { ...row, tags: JSON.parse(row.tags || '[]'), steps: JSON.parse(row.steps || '[]') }
}

// ── SHOTS ────────────────────────────────────────────────────────────
app.get('/api/shots', (req, res) => {
  const rows = db.prepare('SELECT * FROM shots ORDER BY date DESC').all()
  res.json(rows.map(rowToShot))
})

app.post('/api/shots', (req, res) => {
  const s = req.body
  const id = s.id || 'shot-' + Date.now()
  db.prepare(`
    INSERT INTO shots (id, date, bean, roaster, dose, yield, time, preinf, temp, grind, rating,
      taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
      notes, verdict, machine, grinder_model, grinder_rpm, water_recipe, basket, brew_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, s.date, s.bean, s.roaster, s.dose, s.yield, s.time, s.preinf, s.temp, s.grind, s.rating,
    s.taste?.acidity, s.taste?.sweetness, s.taste?.body, s.taste?.bitterness, s.taste?.balance, s.taste?.aftertaste,
    s.notes, s.verdict, s.machine, s.grinder_model, s.grinder_rpm ?? null, s.water_recipe ?? null, s.basket ?? null,
    s.brew_mode ?? null
  )
  const row = db.prepare('SELECT * FROM shots WHERE id = ?').get(id)
  res.status(201).json(rowToShot(row))
})

app.put('/api/shots/:id', (req, res) => {
  const s = req.body
  db.prepare(`
    UPDATE shots SET
      date=?, bean=?, roaster=?, dose=?, yield=?, time=?, preinf=?, temp=?, grind=?, rating=?,
      taste_acidity=?, taste_sweetness=?, taste_body=?, taste_bitterness=?, taste_balance=?, taste_aftertaste=?,
      notes=?, verdict=?, machine=?, grinder_model=?, grinder_rpm=?, water_recipe=?, basket=?, brew_mode=?
    WHERE id=?
  `).run(
    s.date, s.bean, s.roaster, s.dose, s.yield, s.time, s.preinf, s.temp, s.grind, s.rating,
    s.taste?.acidity, s.taste?.sweetness, s.taste?.body, s.taste?.bitterness, s.taste?.balance, s.taste?.aftertaste,
    s.notes, s.verdict, s.machine, s.grinder_model, s.grinder_rpm ?? null, s.water_recipe ?? null, s.basket ?? null,
    s.brew_mode ?? null, req.params.id
  )
  res.json(rowToShot(db.prepare('SELECT * FROM shots WHERE id = ?').get(req.params.id)))
})

app.delete('/api/shots/:id', (req, res) => {
  db.prepare('DELETE FROM shots WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.patch('/api/shots/:id/favorite', (req, res) => {
  db.prepare('UPDATE shots SET favorited = ? WHERE id = ?').run(req.body.favorited ? 1 : 0, req.params.id)
  res.json(rowToShot(db.prepare('SELECT * FROM shots WHERE id = ?').get(req.params.id)))
})

// ── BREWS ────────────────────────────────────────────────────────────
app.get('/api/brews', (req, res) => {
  const rows = db.prepare('SELECT * FROM brews ORDER BY date DESC').all()
  res.json(rows.map(rowToBrew))
})

app.post('/api/brews', (req, res) => {
  const b = req.body
  const id = b.id || 'brew-' + Date.now()
  db.prepare(`
    INSERT INTO brews (id, date, bean, roaster, dripper, grinder_model, dose, water, temp, grind,
      bloom_time, num_pours, pours, time, rating,
      taste_acidity, taste_sweetness, taste_body, taste_bitterness, taste_balance, taste_aftertaste,
      notes, verdict, grinder_rpm, water_recipe)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, b.date, b.bean, b.roaster, b.dripper, b.grinder_model, b.dose, b.water, b.temp, b.grind,
    b.bloom_time, b.num_pours, JSON.stringify(b.pours || []), b.time, b.rating,
    b.taste?.acidity, b.taste?.sweetness, b.taste?.body, b.taste?.bitterness, b.taste?.balance, b.taste?.aftertaste,
    b.notes, b.verdict, b.grinder_rpm ?? null, b.water_recipe ?? null
  )
  res.status(201).json(rowToBrew(db.prepare('SELECT * FROM brews WHERE id = ?').get(id)))
})

app.put('/api/brews/:id', (req, res) => {
  const b = req.body
  db.prepare(`
    UPDATE brews SET
      date=?, bean=?, roaster=?, dripper=?, grinder_model=?, dose=?, water=?, temp=?, grind=?,
      bloom_time=?, num_pours=?, pours=?, time=?, rating=?,
      taste_acidity=?, taste_sweetness=?, taste_body=?, taste_bitterness=?, taste_balance=?, taste_aftertaste=?,
      notes=?, verdict=?, grinder_rpm=?, water_recipe=?
    WHERE id=?
  `).run(
    b.date, b.bean, b.roaster, b.dripper, b.grinder_model, b.dose, b.water, b.temp, b.grind,
    b.bloom_time, b.num_pours, JSON.stringify(b.pours || []), b.time, b.rating,
    b.taste?.acidity, b.taste?.sweetness, b.taste?.body, b.taste?.bitterness, b.taste?.balance, b.taste?.aftertaste,
    b.notes, b.verdict, b.grinder_rpm ?? null, b.water_recipe ?? null, req.params.id
  )
  res.json(rowToBrew(db.prepare('SELECT * FROM brews WHERE id = ?').get(req.params.id)))
})

app.delete('/api/brews/:id', (req, res) => {
  db.prepare('DELETE FROM brews WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

app.patch('/api/brews/:id/favorite', (req, res) => {
  db.prepare('UPDATE brews SET favorited = ? WHERE id = ?').run(req.body.favorited ? 1 : 0, req.params.id)
  res.json(rowToBrew(db.prepare('SELECT * FROM brews WHERE id = ?').get(req.params.id)))
})

// ── BEANS ────────────────────────────────────────────────────────────
app.get('/api/beans', (req, res) => {
  res.json(db.prepare('SELECT * FROM beans WHERE archived = 0 OR archived IS NULL ORDER BY roast_date DESC').all().map(rowToBean))
})

app.get('/api/beans/archived', (req, res) => {
  res.json(db.prepare('SELECT * FROM beans WHERE archived = 1 ORDER BY archived_at DESC').all().map(rowToBean))
})

app.post('/api/beans', (req, res) => {
  const b = req.body
  const id = b.id || 'bean-' + Date.now()
  db.prepare(`
    INSERT INTO beans (id, name, roaster, origin, process, variety, roast_date, roast, altitude, notes, price, weight, remaining, stock, doses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, b.name, b.roaster, b.origin, b.process, b.variety, b.roast_date,
    b.roast, b.altitude, JSON.stringify(b.notes || []), b.price, b.weight, b.remaining, b.stock || 'good',
    JSON.stringify(b.doses || []))
  res.status(201).json(rowToBean(db.prepare('SELECT * FROM beans WHERE id = ?').get(id)))
})

app.put('/api/beans/:id', (req, res) => {
  const b = req.body
  db.prepare(`
    UPDATE beans SET name=?, roaster=?, origin=?, process=?, variety=?, roast_date=?, roast=?,
      altitude=?, notes=?, price=?, weight=?, remaining=?, stock=?, archived=?, archived_at=?,
      doses=COALESCE(?, doses)
    WHERE id=?
  `).run(b.name, b.roaster, b.origin, b.process, b.variety, b.roast_date,
    b.roast, b.altitude, JSON.stringify(b.notes || []), b.price, b.weight, b.remaining, b.stock,
    b.archived ? 1 : 0, b.archived ? (b.archived_at || new Date().toISOString().slice(0, 10)) : null,
    // Only overwrite doses when the client sends them, so other bean edits can't wipe them
    Array.isArray(b.doses) ? JSON.stringify(b.doses) : null,
    req.params.id)
  res.json(rowToBean(db.prepare('SELECT * FROM beans WHERE id = ?').get(req.params.id)))
})

app.delete('/api/beans/:id', (req, res) => {
  db.prepare('DELETE FROM beans WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── GEAR ─────────────────────────────────────────────────────────────
app.get('/api/gear', (req, res) => {
  res.json(db.prepare('SELECT * FROM gear ORDER BY kind, name').all())
})

app.post('/api/gear', (req, res) => {
  const g = req.body
  const id = g.id || 'gear-' + Date.now()
  db.prepare('INSERT INTO gear (id, kind, name, owned, status, meta, price) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, g.kind, g.name, g.owned, g.status, g.meta, g.price || null)
  res.status(201).json(db.prepare('SELECT * FROM gear WHERE id = ?').get(id))
})

app.put('/api/gear/:id', (req, res) => {
  const g = req.body
  if (g.status === 'Primary') {
    db.prepare("UPDATE gear SET status='Active' WHERE kind=? AND status='Primary' AND id != ?")
      .run(g.kind, req.params.id)
  }
  db.prepare('UPDATE gear SET kind=?, name=?, owned=?, status=?, meta=?, price=? WHERE id=?')
    .run(g.kind, g.name, g.owned, g.status, g.meta, g.price || null, req.params.id)
  res.json(db.prepare('SELECT * FROM gear WHERE id = ?').get(req.params.id))
})

app.delete('/api/gear/:id', (req, res) => {
  db.prepare('DELETE FROM gear WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── GRINDER LOG ──────────────────────────────────────────────────────
// ── RECIPES ──────────────────────────────────────────────────────────
app.get('/api/recipes', (req, res) => {
  res.json(db.prepare('SELECT * FROM recipes ORDER BY name').all().map(rowToRecipe))
})

app.post('/api/recipes', (req, res) => {
  const r = req.body
  const id = r.id || 'recipe-' + Date.now()
  db.prepare(`INSERT INTO recipes (id, name, type, time, dose, water, ratio, temp, grind, author, tags, steps)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, r.name, r.type, r.time, r.dose, r.water, r.ratio, r.temp, r.grind, r.author,
      JSON.stringify(r.tags || []), JSON.stringify(r.steps || []))
  res.status(201).json(rowToRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(id)))
})

app.put('/api/recipes/:id', (req, res) => {
  const r = req.body
  db.prepare(`UPDATE recipes SET name=?, type=?, time=?, dose=?, water=?, ratio=?, temp=?, grind=?, author=?, tags=?, steps=? WHERE id=?`)
    .run(r.name, r.type, r.time, r.dose, r.water, r.ratio, r.temp, r.grind, r.author,
      JSON.stringify(r.tags || []), JSON.stringify(r.steps || []), req.params.id)
  res.json(rowToRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id)))
})

app.delete('/api/recipes/:id', (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── TIPS ─────────────────────────────────────────────────────────────
app.get('/api/tips', (req, res) => {
  res.json(db.prepare('SELECT * FROM tips ORDER BY section, category, sort_order, created_at').all())
})

app.post('/api/tips', (req, res) => {
  const t = req.body
  const id = t.id || 'tip-' + Date.now()
  db.prepare('INSERT INTO tips (id, section, category, body, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(id, t.section, t.category, t.body || '', t.sort_order || 0)
  res.status(201).json(db.prepare('SELECT * FROM tips WHERE id = ?').get(id))
})

app.put('/api/tips/:id', (req, res) => {
  const t = req.body
  db.prepare('UPDATE tips SET section=?, category=?, body=?, sort_order=? WHERE id=?')
    .run(t.section, t.category, t.body || '', t.sort_order || 0, req.params.id)
  res.json(db.prepare('SELECT * FROM tips WHERE id = ?').get(req.params.id))
})

app.delete('/api/tips/:id', (req, res) => {
  db.prepare('DELETE FROM tips WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Serve built frontend in production ───────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`\n☕ Grounded API running on http://localhost:${PORT}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   UI dev server → http://localhost:5173`)
  }
})
