# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Grounded is a self-hosted espresso & coffee tracking app. TypeScript throughout: React 18 + Vite 5 frontend, Express 4 API, SQLite via `better-sqlite3`, Node 24 (Node 22.18+ for local dev). No cloud dependencies, fully self-contained — fonts are bundled too, nothing is loaded from a CDN. Deployed via Docker.

**This folder is also the author's live deployment** (`docker-compose.yml` on the NAS, database in `data/grounded.db`). Never touch `data/`, and never rebuild or restart the container — the author does that.

## Commands

```bash
npm run dev          # start both servers concurrently (Vite UI + Express API)
npm run dev:ui       # Vite only → http://localhost:5173
npm run dev:api      # Express only → http://localhost:3001 (uses node --watch)
npm run build        # build React → dist/
npm start            # production: serve built frontend + API from port 3001
npm run typecheck    # tsc --noEmit for the UI (tsconfig.json) and the API (server/tsconfig.json)
```

There is no test runner and no linter. CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run typecheck` and `npm run build`, then starts the server on an **empty** database and hits every endpoint, and separately builds and runs the Docker image. Dependabot (`.github/dependabot.yml`) opens weekly update PRs.

## Architecture

### Data flow

`useData()` ([src/hooks/useData.ts](src/hooks/useData.ts)) is the single source of truth. It fetches all data on mount (shots, brews, beans, archived beans, gear, recipes, tips, settings) and exposes mutation helpers that update local state from the API response without refetching. Only favourites and settings update optimistically, before the API answers. It is instantiated once in `App.tsx` and props-drilled to all pages — there is no context, no global store.

All `fetch()` calls are centralised in [src/api/client.ts](src/api/client.ts). Pages never call `fetch` directly.

### Routing

Hash-based (`#/route`) with no router library. `App.tsx` maps route strings to page components in a plain object. Valid routes (`VALID_ROUTES` in `App.tsx`, and the `Route` type in `src/types.ts`): `home`, `dialin`, `shot-history`, `brew-history`, `beans`, `archived-beans`, `recipes`, `gear`, `stats`, `stock`, `tips`.

One file per page in `src/pages/` (`Home.tsx`, `Dialin.tsx`, `ShotHistory.tsx`, `Beans.tsx`, …).

### Backend

`server/index.ts` — all Express routes in one file. `server/db.ts` — schema, migrations, seed data. `better-sqlite3` is synchronous; all DB calls are blocking (intentional for simplicity). `GET /api/health` is used by the Docker `HEALTHCHECK` and CI.

DB shape note: `shots` and `brews` store taste as flat columns (`taste_acidity`, etc.) but the API surfaces them nested as `taste: { acidity, ... }` via `rowToShot()` / `rowToBrew()`. Similarly `beans.notes`, `beans.doses`, `brews.pours`, `recipes.tags` and `recipes.steps` are JSON strings in SQLite, parsed in the `rowTo*()` helpers.

Schema migrations are try/catch `ALTER TABLE` lines in `db.ts`. They must come **after** the `CREATE TABLE IF NOT EXISTS` block, otherwise a fresh database never gets those columns. Any new columns or tables should be added there.

The author's live database has a few leftovers that the code doesn't create or use (`brews.filter_type`, `brews.time_target`, a `grinder_log` table). Fresh installs don't have them; don't rely on them.

### Settings

App-wide preferences live in the `settings` table (one row per key, JSON value), so every browser sees the same ones: `theme`, `fonts`, `units`, `waterRecipes`, `dialinDefaults`. API: `GET /api/settings` returns one object; `PUT /api/settings` takes a partial object and only accepts those keys (`SETTING_KEYS` in `server/index.ts`). In the UI, `App.tsx` derives each value with a default and passes it down as props; changes go through `updateSettings()` in `useData`.

Older versions kept theme, water recipes and dial-in defaults in `localStorage`. On first load, `useData` moves any of those the database doesn't have yet into it, then deletes the old keys.

### Units, theme & fonts

`useUnits.ts` provides g↔oz and °C↔°F helpers. Units are passed as props; there is no unit context.

Theme (`moody` by default) is applied as a `data-theme` attribute on `<html>`. Fonts are three CSS variables — `--font-sans` (text), `--font-mono` (numbers & labels), `--font-serif` (headings) — defined in `global.css` and overridden at runtime. Use the variables, never a hard-coded font name. The font list, the `@fontsource` imports and `applyAppearance()` are in [src/data/fonts.ts](src/data/fonts.ts). The last-used theme and fonts are also cached in `localStorage` (`grounded-theme`, `grounded-fonts`) only so the next page load paints correctly before settings arrive. The database stays the source of truth.

### Docker / env vars

- `PORT` — API port (default `3001`; host port is `5555` per `docker-compose.yml`)
- `DB_PATH` — SQLite file path (default `data/grounded.db`; in Docker the volume `./data` is mounted at `/app/data`)
- In production (`NODE_ENV=production`) the Express server serves `dist/` as static files and handles `*` with the SPA index.
- Vite proxies `/api/*` → `http://localhost:3001` in dev so there are no CORS issues locally.
- The Dockerfile builds everything in the first stage, prunes dev dependencies there, and copies `node_modules` into a runtime stage that has no compilers. Both stages must use the same base image, because `better-sqlite3` is a native module.
- `docker-compose.yml` joins the author's external `media_net` network. Leave that as is.

### ESM

`package.json` has `"type": "module"` — all server files use ESM `import` syntax. Without this field Node.js rejects the imports and every API route returns 500 on boot.

### TypeScript

- `strict` is on in both configs. `tsc` only type-checks (`noEmit`): Vite compiles the UI, and Node runs `server/*.ts` directly by stripping the types, so the server has no build step (Docker `CMD` is `node server/index.ts`).
- Because Node only strips types, the server may use **erasable syntax only** (`erasableSyntaxOnly`): no `enum`, `namespace` or parameter properties. Type-only imports must use `import type` (`verbatimModuleSyntax`), and relative imports keep their `.ts`/`.tsx` extension, in the UI too.
- [src/types.ts](src/types.ts) holds the types shared by API and UI: `Shot`, `Brew`, `Bean`, `Gear`, `Recipe`, `Tip`, `Settings`, the `*Input` request bodies, and the `*Row` shapes `SELECT *` returns before the `rowTo*()` helpers. The server imports it with `import type`, so it isn't needed at runtime and the Docker image only copies `server/`. When you add a column, update the row and API types there too.
- `src/vite-env.d.ts` declares `__APP_VERSION__` and Vite's asset imports.

### Versioning

Semantic versioning; the version lives only in `package.json` and is injected into the UI as `__APP_VERSION__` via `define` in `vite.config.js` (sidebar brand tag, Settings → About). Never hard-code a version string in components. For a release: add an entry to `CHANGELOG.md`, then `npm version patch|minor|major` (commits + creates the `vX.Y.Z` tag) and `git push --follow-tags`.
