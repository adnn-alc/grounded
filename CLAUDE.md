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
npm run lint         # oxlint (config: .oxlintrc.json)
npm test             # node --test server/*.test.ts — needs Node 24 (runs .ts directly)
```

Linting is oxlint, not ESLint, because typescript-eslint doesn't support TypeScript 7. The React Compiler style rules (`set-state-in-effect`, `static-components`, `purity`, `refs`) are warnings for existing code; `rules-of-hooks` is an error.

Tests use Node's built-in runner, no framework: `server/api.test.ts` (routes, stock, errors, headers on a fresh seeded DB), `server/backup.test.ts` (export, replace/merge/dry-run import, CSV), `server/migrations.test.ts` (upgrading a 1.0-layout DB) and `server/hosts.test.ts` (`ALLOWED_HOSTS`). Each file runs in its own process with a temp database from `createTempDatabase()` in `server/test-helpers.ts`; set `DB_PATH` before importing `app.ts`/`db.ts`. Test files are excluded from the Docker image (`.dockerignore`).

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`, then starts the server on an **empty** database and hits every endpoint, and separately builds and runs the Docker image. `.github/workflows/release-image.yml` runs on every `v*` tag (or by hand with a tag): it checks the amd64 image starts, then pushes amd64 + arm64 to `ghcr.io/adnn-alc/grounded` as `X.Y.Z`, `X.Y`, `X` and `latest` (pre-release tags get only their own tag). The package stays private until it is made public in its GitHub settings, which can't be undone. Dependabot (`.github/dependabot.yml`) opens weekly update PRs.

## Architecture

### Data flow

`useData()` ([src/hooks/useData.ts](src/hooks/useData.ts)) is the single source of truth. It fetches all data on mount (shots, brews, beans, archived beans, gear, recipes, tips, settings) and exposes mutation helpers that update local state from the API response without refetching. Only favourites and settings update optimistically, before the API answers. Exceptions: after a shot/brew is saved, edited or deleted it reloads the beans (the server moved their stock), and after a bean rename it reloads shots and brews. Every mutation is wrapped in `reportErrors()`: a failure shows an error toast (`src/components/Toast.tsx`) and then rejects, so the calling form stays open. It is instantiated once in `App.tsx` and props-drilled to all pages — there is no context, no global store.

All `fetch()` calls are centralised in [src/api/client.ts](src/api/client.ts). Pages never call `fetch` directly.

### Routing

Hash-based (`#/route`) with no router library. `App.tsx` maps route strings to page components in a plain object. Valid routes (`VALID_ROUTES` in `App.tsx`, and the `Route` type in `src/types.ts`): `home`, `dialin`, `shot-history`, `brew-history`, `beans`, `archived-beans`, `recipes`, `gear`, `stats`, `stock`, `tips`.

One file per page in `src/pages/` (`Home.tsx`, `Dialin.tsx`, `ShotHistory.tsx`, `Beans.tsx`, …).

### Backend

`server/app.ts` — the Express app: security headers, the optional `ALLOWED_HOSTS` check and all routes. `server/index.ts` — starts it and shuts down cleanly on SIGTERM/SIGINT (closes the DB). `server/db.ts` — schema, migrations, seed data, `snapshotDatabase()`. `server/backup.ts` — backup export/restore and CSV export. `server/validation.ts` — a zod schema per request body, checked with `parseBody()`. `server/errors.ts` — `HttpError`, `found()` (404 when a lookup by id finds nothing) and the error handler. `better-sqlite3` is synchronous; all DB calls are blocking (intentional for simplicity). `GET /api/health` is used by the Docker `HEALTHCHECK` and CI.

Errors: every route answers errors as JSON `{ "error": "…" }` — 400 for invalid bodies (validation is lenient: it drops unknown fields and allows null numbers), 404 for unknown ids or `/api/*` paths, 409 for a duplicate id, 500 (details only in the server log) for bugs. The UI shows that message in its toast.

Beans ↔ shots/brews: `shots.bean_id` / `brews.bean_id` link to `beans.id` (no foreign key, so history survives a deleted bean; deleting a bean sets them to NULL). `bean` and `roaster` are kept on the row as display names: the server fills them from `bean_id` (`resolveBean()`), and renaming a bean updates them. The server also moves the bean's `remaining` stock in the same transaction when a shot/brew is created, edited (old dose back, new dose off) or deleted (`adjustStock()`), so the UI never computes stock itself.

DB shape note: `shots` and `brews` store taste as flat columns (`taste_acidity`, etc.) but the API surfaces them nested as `taste: { acidity, ... }` via `rowToShot()` / `rowToBrew()`. Similarly `beans.notes`, `beans.doses`, `brews.pours`, `recipes.tags` and `recipes.steps` are JSON strings in SQLite, parsed in the `rowTo*()` helpers.

Schema: the `CREATE TABLE IF NOT EXISTS` block in `db.ts` is the full current schema, so a fresh database is complete at once (and is stamped with the latest version). Existing databases are upgraded by the numbered `MIGRATIONS` list: `PRAGMA user_version` stores how many have run, each pending one runs once in its own transaction, and a failure stops startup. Before migrating an existing database, the server writes a snapshot next to it (`grounded.db.backup-v<old version>-<timestamp>`, via `VACUUM INTO`). To change the schema: update the `CREATE TABLE` block **and** append a migration (use `addColumn()`, which checks first); never edit or reorder a released migration. Also update the row and API types in `src/types.ts`.

The author's live database has a few leftovers that the code doesn't create or use (`brews.filter_type`, `brews.time_target`, a `grinder_log` table). Fresh installs don't have them; don't rely on them.

### Backups

`GET /api/export` downloads a `Backup` (`src/types.ts`): a header (`app`, `format`, `version`, `schemaVersion`, `exportedAt`), raw `SELECT *` rows for `beans`, `shots`, `brews`, `gear`, `recipes` and `tips`, and the settings (except `sampleData`). `POST /api/import` takes `{ mode, dryRun?, backup }`: `replace` deletes those tables and the settings and loads the backup; `merge` only inserts rows whose id isn't there yet and settings that aren't set. It refuses non-Grounded files and backups with a newer `schemaVersion`, inserts only the columns the table has (an older backup's missing columns get their defaults), writes a `grounded.db.backup-import-…` snapshot first (deleted again if the import fails) and runs in one transaction. A dry run rolls the transaction back and returns the same counts; the UI uses it as the preview. That route alone accepts bodies up to 50 MB. Stock isn't recounted on import. When you add a table, add it to `BACKUP_TABLES` in `backup.ts` and the `BackupTable` type. `GET /api/export/shots.csv` / `brews.csv` export a fixed column list; text that starts like a formula gets a leading `'`. The UI is `src/components/DataSettings.tsx` (Settings → Backup & data).

### Settings

App-wide preferences live in the `settings` table (one row per key, JSON value), so every browser sees the same ones: `theme`, `fonts`, `units`, `waterRecipes`, `dialinDefaults`, `brewModes`. API: `GET /api/settings` returns one object; `PUT /api/settings` takes a partial object and only accepts those keys (`settingsSchema` in `server/validation.ts`).

`sampleData` is only ever set on a brand-new install (`'present'`, by `db.ts`). While it's `'present'`, Home shows a banner whose button calls `POST /api/sample-data/clear`. That deletes exactly the rows in `SAMPLE_IDS` (`db.ts`; recipes are kept), unlinks the user's own shots from removed sample beans and sets `'cleared'`; it answers 409 on any install not marked `'present'`. "Keep them" sets `'dismissed'`. Keep `SAMPLE_IDS` in sync with the seed data.

`brewModes` (espresso machine buttons/programs) is optional: when it's empty or missing, Dial-in and the shot editor don't show a brew mode field at all. In the UI, `App.tsx` derives each value with a default and passes it down as props; changes go through `updateSettings()` in `useData`.

Older versions kept theme, water recipes and dial-in defaults in `localStorage`. On first load, `useData` moves any of those the database doesn't have yet into it, then deletes the old keys.

### Units, theme & fonts

`useUnits.ts` provides g↔oz and °C↔°F helpers. Units are passed as props; there is no unit context.

Theme (`moody` by default) is applied as a `data-theme` attribute on `<html>`. Fonts are three CSS variables — `--font-sans` (text), `--font-mono` (numbers & labels), `--font-serif` (headings) — defined in `global.css` and overridden at runtime. Use the variables, never a hard-coded font name. The font list, the `@fontsource` imports and `applyAppearance()` are in [src/data/fonts.ts](src/data/fonts.ts). The last-used theme and fonts are also cached in `localStorage` (`grounded-theme`, `grounded-fonts`) only so the next page load paints correctly before settings arrive. The database stays the source of truth.

### Docker / env vars

- `PORT` — API port (default `3001`; host port is `5555` per `docker-compose.yml`)
- `DB_PATH` — SQLite file path (default `data/grounded.db`; in Docker the volume `./data` is mounted at `/app/data`)
- `ALLOWED_HOSTS` — optional, comma-separated host names/IPs. When set, requests for any other `Host` get 403 (DNS-rebinding protection); `localhost`/`127.0.0.1` always work for the health check. Unset = off.
- No `X-Frame-Options`/`frame-ancestors` header on purpose: the author embeds Grounded in a home dashboard.
- The Dockerfile pins `node:24-alpine` by digest; Dependabot bumps it.
- In production (`NODE_ENV=production`) the Express server serves `dist/` as static files and handles `*` with the SPA index.
- Vite proxies `/api/*` → `http://localhost:3001` in dev so there are no CORS issues locally.
- The Dockerfile builds everything in the first stage, prunes dev dependencies there, and copies `node_modules` into a runtime stage that has no compilers. Both stages must use the same base image, because `better-sqlite3` is a native module.
- The app runs as `node` (uid 1000), not root. `docker-entrypoint.sh` starts as root, `chown`s the data folder (the `DB_PATH` directory) to node, then `exec su-exec node …`. A compose `user:` override skips the chown and runs as that user. CI checks this with a root-owned bind mount. Keep `docker-entrypoint.sh` LF-only (`.gitattributes`).
- `docker-compose.yml` joins the author's external `media_net` network. Leave that as is.

### ESM

`package.json` has `"type": "module"` — all server files use ESM `import` syntax. Without this field Node.js rejects the imports and every API route returns 500 on boot.

### TypeScript

- `strict` is on in both configs. `tsc` only type-checks (`noEmit`): Vite compiles the UI, and Node runs `server/*.ts` directly by stripping the types, so the server has no build step (Docker `CMD` is `node server/index.ts`).
- Because Node only strips types, the server may use **erasable syntax only** (`erasableSyntaxOnly`): no `enum`, `namespace` or parameter properties. Type-only imports must use `import type` (`verbatimModuleSyntax`), and relative imports keep their `.ts`/`.tsx` extension, in the UI too.
- [src/types.ts](src/types.ts) holds the types shared by API and UI: `Shot`, `Brew`, `Bean`, `Gear`, `Recipe`, `Tip`, `Settings`, the `*Input` request bodies, and the `*Row` shapes `SELECT *` returns before the `rowTo*()` helpers. The server imports it with `import type`, so it isn't needed at runtime and the Docker image only copies `server/`. When you add a column, update the row and API types there too.
- `src/vite-env.d.ts` declares `__APP_VERSION__` and Vite's asset imports.

### Versioning

Semantic versioning; the version lives only in `package.json` and is injected into the UI as `__APP_VERSION__` via `define` in `vite.config.js` (sidebar brand tag, Settings → About). Never hard-code a version string in components. For a release: add an entry to `CHANGELOG.md`, then `npm version patch|minor|major` (commits + creates the `vX.Y.Z` tag) and `git push --follow-tags`. The tag push publishes the Docker image (see Commands).
