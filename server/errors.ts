// Errors the API answers with on purpose (bad input, unknown id). Anything else that
// reaches the error handler in app.ts is a bug and answers 500 without details.
import type { NextFunction, Request, Response } from 'express'

export const BAD_REQUEST  = 400
export const FORBIDDEN    = 403
export const NOT_FOUND    = 404
export const CONFLICT     = 409
export const SERVER_ERROR = 500

const CLIENT_ERROR_MIN = 400

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Throws a 404 when a lookup by id found nothing */
export function found<T>(row: T | undefined, what: string): T {
  if (row === undefined) throw new HttpError(NOT_FOUND, `${what} not found`)
  return row
}

/** Express error handler: always answers JSON with an `error` message */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) { next(err); return }
  const e = err as { status?: number, statusCode?: number, code?: string, message?: string, type?: string }

  // HttpError, plus body-parser's own errors (400 for broken JSON, 413 for a body over 100 KB)
  let status = e.status ?? e.statusCode ?? SERVER_ERROR
  let message = e.message ?? 'Something went wrong'
  if (e.type === 'entity.parse.failed') message = "The request body isn't valid JSON"
  if (e.type === 'entity.too.large') message = 'The request is too large'

  // SQLite refused the write, e.g. an id that already exists
  if (e.code?.startsWith('SQLITE_CONSTRAINT')) {
    status = e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ? CONFLICT : BAD_REQUEST
    message = status === CONFLICT ? 'Something with that id already exists' : `Database rejected the change: ${message}`
  }

  if (status < CLIENT_ERROR_MIN || status >= SERVER_ERROR) {
    console.error(`${req.method} ${req.originalUrl} failed:`, err)
    res.status(SERVER_ERROR).json({ error: 'Something went wrong on the server. Check the container logs for details.' })
    return
  }
  res.status(status).json({ error: message })
}
