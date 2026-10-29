// Starts the API (and, in production, the built UI) and shuts down cleanly.
import { app } from './app.ts'
import db from './db.ts'

const DEFAULT_PORT = 3001
const PORT = Number(process.env.PORT) || DEFAULT_PORT
const FORCE_EXIT_MS = 5000

const server = app.listen(PORT, () => {
  console.log(`\n☕ Grounded API running on http://localhost:${PORT}`)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   UI dev server → http://localhost:5173`)
  }
})

// `docker compose stop` sends SIGTERM: finish open requests, close the database
// (which also folds the WAL file back into grounded.db), then exit
function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down`)
  server.close(() => {
    db.close()
    process.exit(0)
  })
  // Don't hang on a stuck connection
  setTimeout(() => process.exit(0), FORCE_EXIT_MS).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
