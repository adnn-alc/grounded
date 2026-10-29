// The optional ALLOWED_HOSTS check (DNS-rebinding protection).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createTempDatabase } from './test-helpers.ts'

const tmp = createTempDatabase()
process.env.ALLOWED_HOSTS = 'grounded.example, LegoNAS'
const { app } = await import('./app.ts')
const { default: db } = await import('./db.ts')
const server = await new Promise<http.Server>(resolve => { const s = app.listen(0, () => resolve(s)) })
const port = (server.address() as AddressInfo).port

after(() => {
  server.close()
  db.close()
  tmp.cleanup()
})

const OK = 200
const FORBIDDEN = 403

// fetch() can't set the Host header, so use node:http directly
const statusFor = (host: string): Promise<number> => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: '/api/health', headers: { Host: `${host}:${port}` } }, res => {
    res.resume()
    resolve(res.statusCode ?? 0)
  }).on('error', reject)
})

test('answers the listed hosts, case-insensitively', async () => {
  assert.equal(await statusFor('grounded.example'), OK)
  assert.equal(await statusFor('legonas'), OK)
})

test('always answers localhost, for the Docker health check', async () => {
  assert.equal(await statusFor('localhost'), OK)
  assert.equal(await statusFor('127.0.0.1'), OK)
})

test('refuses any other host', async () => {
  assert.equal(await statusFor('evil.example'), FORBIDDEN)
})
