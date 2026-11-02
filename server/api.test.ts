// API tests against a fresh (seeded) database. Run with `npm test` (Node 24).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTempDatabase, startApi } from './test-helpers.ts'
import type { Bean, Settings, Shot } from '../src/types.ts'

const tmp = createTempDatabase()
const { app } = await import('./app.ts')
const { default: db } = await import('./db.ts')
const api = await startApi(app)

after(async () => {
  await api.close()
  db.close()
  tmp.cleanup()
})

const OK = 200
const CREATED = 201
const BAD_REQUEST = 400
const NOT_FOUND = 404
const CONFLICT = 409

const LATEST_SCHEMA = 4
const DOSE = 18
const NEW_DOSE = 20
const YIELD = 36
const SECONDS = 28
const MID = 5   // middle of the 1–10 taste scale
const BALANCED = 50       // the middle of the sour-to-bitter slider
const A_TOUCH_SOUR = 42
const SOUR = 20
const OLD_UNDER = 25      // where an old 'under' verdict lands

const taste = { acidity: MID, sweetness: MID, body: MID, bitterness: MID, balance: MID, aftertaste: MID }
const shotBody = (beanId: string, dose: number): Record<string, unknown> =>
  ({ date: '2026-10-30 08:00', bean_id: beanId, dose, yield: YIELD, time: SECONDS, rating: MID, taste, landed: BALANCED, bad: false })

const bean = async (id: string): Promise<Bean> => {
  const all = (await api.call<Bean[]>('GET', '/api/beans')).body
  const found = all.find(b => b.id === id)
  assert.ok(found, `bean ${id} exists`)
  return found
}

test('a fresh database is complete and every list endpoint answers', async () => {
  assert.equal(db.pragma('user_version', { simple: true }), LATEST_SCHEMA)
  const paths = ['health', 'shots', 'brews', 'beans', 'beans/archived', 'gear', 'recipes', 'tips', 'settings']
  const statuses = await Promise.all(paths.map(async p => [p, (await api.call('GET', `/api/${p}`)).status] as const))
  assert.deepEqual(statuses.filter(([, status]) => status !== OK), [], 'every GET answers 200')
  const shots = (await api.call<Shot[]>('GET', '/api/shots')).body
  assert.ok(shots.length > 0 && shots.every(s => s.bean_id), 'sample shots are linked to their beans')
})

test('saving a shot links its bean and takes the dose off that bean', async () => {
  const before = await bean('b-finca')
  const res = await api.call<Shot>('POST', '/api/shots', shotBody('b-finca', DOSE))
  assert.equal(res.status, CREATED)
  assert.equal(res.body.bean, 'Finca Tamana')
  assert.equal(res.body.roaster, 'Square Mile')
  assert.equal((await bean('b-finca')).remaining, before.remaining - DOSE)
})

test('a shot keeps where it landed, works out the old verdict, and a bad shot is not placed', async () => {
  const placed = await api.call<Shot>('POST', '/api/shots', { ...shotBody('b-finca', DOSE), landed: A_TOUCH_SOUR })
  assert.deepEqual([placed.body.landed, placed.body.bad, placed.body.verdict], [A_TOUCH_SOUR, false, 'good'])
  const bad = await api.call<Shot>('POST', '/api/shots', { ...shotBody('b-finca', DOSE), landed: SOUR, bad: true })
  assert.deepEqual([bad.body.landed, bad.body.bad, bad.body.verdict], [null, true, 'bad'])
  const { landed: _l, bad: _b, ...legacy } = shotBody('b-finca', DOSE)
  const old = await api.call<Shot>('POST', '/api/shots', { ...legacy, verdict: 'under' })
  assert.deepEqual([old.body.landed, old.body.bad, old.body.verdict], [OLD_UNDER, false, 'under'], 'an older client sending only a verdict')
  const fresh = (await api.call<Shot[]>('GET', '/api/shots')).body.filter(s => s.id.startsWith('s-'))
  assert.ok(fresh.every(s => s.landed !== null || s.bad), 'sample shots are placed on the slider')
})

test('editing a shot moves its dose from the old bean to the new one', async () => {
  const shot = (await api.call<Shot>('POST', '/api/shots', shotBody('b-finca', DOSE))).body
  const finca = await bean('b-finca')
  const idido = await bean('b-idido')

  const res = await api.call<Shot>('PUT', `/api/shots/${shot.id}`, shotBody('b-idido', NEW_DOSE))
  assert.equal(res.status, OK)
  assert.equal(res.body.bean, 'Idido')
  assert.equal((await bean('b-finca')).remaining, finca.remaining + DOSE)
  assert.equal((await bean('b-idido')).remaining, idido.remaining - NEW_DOSE)
})

test('deleting a shot gives its dose back', async () => {
  const shot = (await api.call<Shot>('POST', '/api/shots', shotBody('b-finca', DOSE))).body
  const before = await bean('b-finca')
  assert.equal((await api.call('DELETE', `/api/shots/${shot.id}`)).status, OK)
  assert.equal((await bean('b-finca')).remaining, before.remaining + DOSE)
})

test('renaming a bean renames it on its shots', async () => {
  const suke = await bean('b-suke')
  await api.call<Shot>('POST', '/api/shots', shotBody('b-suke', DOSE))
  await api.call('PUT', '/api/beans/b-suke', { ...suke, name: 'Suke Quto Lot 2' })
  const shots = (await api.call<Shot[]>('GET', '/api/shots')).body.filter(s => s.bean_id === 'b-suke')
  assert.ok(shots.length > 0 && shots.every(s => s.bean === 'Suke Quto Lot 2'))
})

test('bad input, unknown ids and duplicates get a clear JSON error', async () => {
  const invalid = await api.call<{ error: string }>('POST', '/api/beans', { name: '' })
  assert.equal(invalid.status, BAD_REQUEST)
  assert.ok(invalid.body.error.toLowerCase().includes('name'), 'the error names the bad field')

  assert.equal((await api.call('POST', '/api/shots', { ...shotBody('b-finca', DOSE), dose: 'lots' })).status, BAD_REQUEST)
  assert.equal((await api.call('PUT', '/api/shots/nope', shotBody('b-finca', DOSE))).status, NOT_FOUND)
  assert.equal((await api.call('DELETE', '/api/gear/nope')).status, NOT_FOUND)
  assert.equal((await api.call('GET', '/api/nope')).status, NOT_FOUND)

  const gear = { id: 'g-dup-test', kind: 'Scale', name: 'Test scale' }
  assert.equal((await api.call('POST', '/api/gear', gear)).status, CREATED)
  assert.equal((await api.call('POST', '/api/gear', gear)).status, CONFLICT)
})

test('settings update only the keys sent and reject unknown ones', async () => {
  await api.call('PUT', '/api/settings', { units: { mass: 'oz', temp: 'F' } })
  const res = await api.call<Settings>('PUT', '/api/settings', { brewModes: ['Button 1'] })
  assert.deepEqual(res.body.units, { mass: 'oz', temp: 'F' })
  assert.deepEqual(res.body.brewModes, ['Button 1'])
  assert.equal((await api.call('PUT', '/api/settings', { bogus: true })).status, BAD_REQUEST)
})

test('settings keep the design, and Extraction keeps its own theme and fonts', async () => {
  const look = { theme: 'crema', fonts: { sans: 'geist', serif: 'fraunces' } }
  const res = await api.call<Settings>('PUT', '/api/settings', { design: 'extraction', extraction: look })
  assert.equal(res.body.design, 'extraction')
  assert.deepEqual(res.body.extraction, look)
  assert.equal((await api.call('PUT', '/api/settings', { design: 'flavor' })).status, BAD_REQUEST)
})

test('responses carry the security headers and hide Express', async () => {
  const res = await api.call('GET', '/api/health')
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('referrer-policy'), 'same-origin')
  assert.equal(res.headers.get('x-powered-by'), null)
  assert.equal(res.headers.get('x-frame-options'), null, 'embedding in a dashboard stays possible')
})

// Keep this last: it removes the sample beans the tests above use
test('removing sample data deletes only the samples, once', async () => {
  assert.equal((await api.call<Settings>('GET', '/api/settings')).body.sampleData, 'present')
  const mine = (await api.call<Shot>('POST', '/api/shots', shotBody('b-finca', DOSE))).body
  const recipesBefore = (await api.call<unknown[]>('GET', '/api/recipes')).body.length

  const res = await api.call<{ removed: Record<string, number> }>('POST', '/api/sample-data/clear')
  assert.equal(res.status, OK)
  assert.ok(res.body.removed.beans > 0 && res.body.removed.gear > 0)

  const shots = (await api.call<Shot[]>('GET', '/api/shots')).body
  const kept = shots.find(s => s.id === mine.id)
  assert.ok(kept, 'a shot you logged yourself stays')
  assert.equal(kept.bean, 'Finca Tamana', '…with its bean name')
  assert.equal(kept.bean_id, null, '…but no link to the removed sample bean')
  assert.ok(!shots.some(s => s.id === 's-42'), 'sample shots are gone')
  assert.equal((await api.call<unknown[]>('GET', '/api/recipes')).body.length, recipesBefore, 'recipes stay')
  assert.equal((await api.call<Settings>('GET', '/api/settings')).body.sampleData, 'cleared')
  assert.equal((await api.call('POST', '/api/sample-data/clear')).status, CONFLICT, 'a second try is refused')
})
