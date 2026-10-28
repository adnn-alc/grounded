# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Grounded is a self-hosted espresso & coffee tracking app (previously named Cascara — renamed May 2026). React 18 + Vite 5 frontend, Express 4 API, SQLite via `better-sqlite3`. No cloud dependencies, fully self-contained. Deployed via Docker.

## Commands

```bash
npm run dev          # start both servers concurrently (Vite UI + Express API)
npm run dev:ui       # Vite only → http://localhost:5173
npm run dev:api      # Express only → http://localhost:3001 (uses node --watch)
npm run build        # build React → dist/
npm start            # production: serve built frontend + API from port 3001
```

There is no test runner and no linter configured.

## Architecture

### Data flow

`useData()` ([src/hooks/useData.js](src/hooks/useData.js)) is the single source of truth. It fetches all data on mount and exposes typed mutation helpers that update local state optimistically without refetching. It is instantiated once in `App.jsx` and props-drilled to all pages — there is no context, no global store.

All `fetch()` calls are centralised in [src/api/client.js](src/api/client.js). Pages never call `fetch` directly.

### Routing

Hash-based (`#/route`) with no router library. `App.jsx` maps route strings to page components in a plain object. Valid routes: `home`, `dialin`, `history`, `beans`, `archived-beans`, `recipes`, `gear`, `stats`, `stock`.

### Backend

`server/index.js` — all Express routes in one file. `server/db.js` — schema, migrations, seed data. `better-sqlite3` is synchronous; all DB calls are blocking (intentional for simplicity).

DB shape note: `shots` stores taste as flat columns (`taste_acidity`, etc.) but the API surfaces them nested as `taste: { acidity, ... }` via the `rowToShot()` helper. Similarly `beans.notes`, `recipes.tags`, and `recipes.steps` are JSON strings in SQLite, parsed in `rowToBean()` / `rowToRecipe()`.

Schema migrations use a try/catch `ALTER TABLE` pattern at the top of `db.js` — safe to run repeatedly on startup.

The live database (`data/grounded.db`) has a few extra columns that were added outside the current migration scripts:
- `brews`: `filter_type`, `time_target`
- A `grinder_log` table exists but has no API routes

Any new columns or tables should be added as migrations in `db.js`.

### Units & theme

`useUnits.js` provides g↔oz and °C↔°F helpers. Units are passed as props; there is no unit context. Theme (`moody` by default) is stored in `localStorage` under `grounded-theme` and applied as a `data-theme` attribute on `<html>`. A migration shim in `App.jsx` moves the old `cascara-theme` key on first load.

### Docker / env vars

- `PORT` — API port (default `3001`; host port is `5555` per `docker-compose.yml`)
- `DB_PATH` — SQLite file path (default `data/grounded.db`; in Docker the volume `./data` is mounted at `/app/data`)
- In production (`NODE_ENV=production`) the Express server serves `dist/` as static files and handles `*` with the SPA index.
- Vite proxies `/api/*` → `http://localhost:3001` in dev so there are no CORS issues locally.

### ESM

`package.json` has `"type": "module"` — all server files use ESM `import` syntax. Without this field Node.js rejects the imports and every API route returns 500 on boot.

### Versioning

Semantic versioning; the version lives only in `package.json` and is injected into the UI as `__APP_VERSION__` via `define` in `vite.config.js` (sidebar brand tag, Settings → About). Never hard-code a version string in components. For a release: add an entry to `CHANGELOG.md`, then `npm version patch|minor|major` (commits + creates the `vX.Y.Z` tag) and `git push --follow-tags`.
