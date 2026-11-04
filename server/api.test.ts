// API tests against a fresh (seeded) database. Run with `npm test` (Node 24).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTempDatabase, startApi } from './test-helpers.ts'
import type { Bean, CareChange, CareLogEntry, CareTask, Gear, Settings, Shot } from '../src/types.ts'

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

const LATEST_SCHEMA = 6
const DOSE = 18
const NEW_DOSE = 20
const YIELD = 36
const SECONDS = 28
const MID = 5   // middle of the 1–10 taste scale
const BALANCED = 50       // the middle of the sour-to-bitter slider
const A_TOUCH_SOUR = 42
const SOUR = 20
const OLD_UNDER = 25      // where an old 'under' verdict lands
const FROZEN_ON = '2026-10-20'
const DAYS_FROZEN = 14
const RATED = 8
const EVERY_SHOTS = 50
const SHOTS_SINCE = 52
const GRAMS_SINCE = 940
const DAYS_SINCE = 31
const CARE_SINCE = '2026-10-01 08:00'
const CARE_DONE = '2026-11-01 09:30'
const SNOOZED = '2026-11-02'

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
  const paths = ['health', 'shots', 'brews', 'beans', 'beans/archived', 'gear', 'recipes', 'tips', 'settings', 'care-tasks', 'care-log']
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

test('a bean can go into the freezer and out again', async () => {
  const idido = await bean('b-idido')
  assert.equal(idido.frozen_at, null)
  await api.call('PUT', '/api/beans/b-idido', { ...idido, frozen_at: FROZEN_ON })
  assert.equal((await bean('b-idido')).frozen_at, FROZEN_ON)

  // A client that doesn't send the freezer fields leaves them as they are
  const { frozen_at: _at, frozen_days: _days, ...rest } = await bean('b-idido')
  await api.call('PUT', '/api/beans/b-idido', { ...rest, price: NEW_DOSE })
  assert.equal((await bean('b-idido')).frozen_at, FROZEN_ON)

  await api.call('PUT', '/api/beans/b-idido', { ...rest, frozen_at: null, frozen_days: DAYS_FROZEN })
  const thawed = await bean('b-idido')
  assert.equal(thawed.frozen_at, null)
  assert.equal(thawed.frozen_days, DAYS_FROZEN)
})

test('a quick shot is saved without a rating, and taste can be added later', async () => {
  const res = await api.call<Shot>('POST', '/api/shots', { ...shotBody('b-finca', DOSE), rating: null })
  assert.equal(res.status, CREATED)
  assert.equal(res.body.rating, null)
  const tasted = await api.call<Shot>('PUT', `/api/shots/${res.body.id}`, { ...res.body, rating: RATED })
  assert.equal(tasted.body.rating, RATED)
})

test('care tasks count from when they were last done, and Undo puts the count back', async () => {
  const machine = (await api.call<Gear>('POST', '/api/gear', { kind: 'Espresso machine', name: 'Test machine' })).body
  const body = { gear_id: machine.id, name: 'Backflush', every: EVERY_SHOTS, unit: 'shots', since: CARE_SINCE }
  assert.equal((await api.call('POST', '/api/care-tasks', { ...body, unit: 'weeks' })).status, BAD_REQUEST)
  assert.equal((await api.call('POST', '/api/care-tasks', { ...body, gear_id: 'no-such-gear' })).status, NOT_FOUND)
  const created = await api.call<CareTask>('POST', '/api/care-tasks', body)
  assert.equal(created.status, CREATED)
  const task = created.body
  assert.equal(task.since, CARE_SINCE)

  // Put off until tomorrow; a PUT without it keeps it
  await api.call('PUT', `/api/care-tasks/${task.id}`, { ...body, snoozed_until: SNOOZED })
  assert.equal((await api.call<CareTask>('PUT', `/api/care-tasks/${task.id}`, body)).body.snoozed_until, SNOOZED)

  const done = await api.call<CareChange>('POST', `/api/care-tasks/${task.id}/done`, { done_at: CARE_DONE, shots: SHOTS_SINCE, grams: GRAMS_SINCE, days: DAYS_SINCE })
  assert.equal(done.status, CREATED)
  assert.equal(done.body.task?.since, CARE_DONE, 'the count starts again')
  assert.equal(done.body.task?.snoozed_until, null, '…and the snooze is over')
  assert.deepEqual([done.body.entry.started, done.body.entry.shots, done.body.entry.gear], [CARE_SINCE, SHOTS_SINCE, 'Test machine'])
  assert.ok((await api.call<CareLogEntry[]>('GET', '/api/care-log')).body.some(e => e.id === done.body.entry.id))

  const undone = await api.call<CareChange>('DELETE', `/api/care-log/${done.body.entry.id}`)
  assert.equal(undone.body.task?.since, CARE_SINCE, 'Undo puts the count back')
  assert.ok(!(await api.call<CareLogEntry[]>('GET', '/api/care-log')).body.some(e => e.id === done.body.entry.id))

  // Deleting the gear deletes its tasks, but what was logged stays
  const again = await api.call<CareChange>('POST', `/api/care-tasks/${task.id}/done`, { done_at: CARE_DONE })
  await api.call('DELETE', `/api/gear/${machine.id}`)
  assert.ok(!(await api.call<CareTask[]>('GET', '/api/care-tasks')).body.some(t => t.id === task.id))
  assert.ok((await api.call<CareLogEntry[]>('GET', '/api/care-log')).body.some(e => e.id === again.body.entry.id))
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
  const sampleTask = (await api.call<CareTask>('POST', '/api/care-tasks', { gear_id: 'g-df64', name: 'Clean the burrs', every: EVERY_SHOTS, unit: 'days' })).body

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
  assert.ok(!(await api.call<CareTask[]>('GET', '/api/care-tasks')).body.some(t => t.id === sampleTask.id), 'care tasks of sample gear go too')
  assert.equal((await api.call<Settings>('GET', '/api/settings')).body.sampleData, 'cleared')
  assert.equal((await api.call('POST', '/api/sample-data/clear')).status, CONFLICT, 'a second try is refused')
})
