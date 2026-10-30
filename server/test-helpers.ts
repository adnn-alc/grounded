// Shared setup for server/*.test.ts. Each test file runs in its own process
// (node --test), so each gets its own throwaway database.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Express } from 'express'

/** A fresh temp folder with DB_PATH pointing into it. Call before importing app.ts or db.ts. */
export function createTempDatabase(): { dir: string, dbPath: string, cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'grounded-test-'))
  const dbPath = path.join(dir, 'grounded.db')
  process.env.DB_PATH = dbPath
  return { dir, dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

export interface ApiResponse<T = unknown> { status: number, headers: Headers, body: T }

/** Starts the app on a random port and returns a small JSON client for it */
export async function startApi(app: Express): Promise<{
  base: string
  call: <T = unknown>(method: string, url: string, body?: unknown) => Promise<ApiResponse<T>>
  close: () => Promise<void>
}> {
  const server = await new Promise<ReturnType<Express['listen']>>(resolve => {
    const s = app.listen(0, () => resolve(s))
  })
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const call = async <T,>(method: string, url: string, body?: unknown): Promise<ApiResponse<T>> => {
    const res = await fetch(base + url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, headers: res.headers, body: (text ? JSON.parse(text) : null) as T }
  }

  const close = (): Promise<void> => new Promise(resolve => server.close(() => resolve()))
  return { base, call, close }
}
