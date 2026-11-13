# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Grounded is a self-hosted espresso & coffee tracking app. TypeScript throughout: React 19 + Vite 8 frontend, Express 4 API, SQLite via `better-sqlite3`, Node 24 (Node 22.18+ for local dev). No cloud dependencies, fully self-contained — fonts are bundled too, nothing is loaded from a CDN. Deployed via Docker.

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

`useData()` ([src/hooks/useData.ts](src/hooks/useData.ts)) is the single source of truth. It fetches all data on mount (shots, brews, beans, archived beans, gear, recipes, tips, settings, care tasks and care log) and exposes mutation helpers that update local state from the API response without refetching. Only favorites and settings update optimistically, before the API answers. Exceptions: after a shot/brew is saved, edited or deleted it reloads the beans (the server moved their stock), and after a bean rename it reloads shots and brews. Every mutation is wrapped in `reportErrors()`: a failure shows an error toast (`src/components/Toast.tsx`) and then rejects, so the calling form stays open. It is instantiated once in `App.tsx` and props-drilled to all pages — there is no context, no global store.

All `fetch()` calls are centralised in [src/api/client.ts](src/api/client.ts). Pages never call `fetch` directly.

### Routing

Hash-based (`#/route`) with no router library. `App.tsx` maps route strings to page components in a plain object. Valid routes (`VALID_ROUTES` in `App.tsx`, and the `Route` type in `src/types.ts`): `home`, `dialin`, `shot-history`, `brew-history`, `beans`, `archived-beans`, `recipes`, `gear`, `stats`, `stock`, `tips`, and `bean`, a bag's own page (`src/pages/BeanPage.tsx`), whose hash carries the bag's id: `#/bean/<id>` (`fromHash()` in `App.tsx`). It's opened by a click on a Refined bean card, or a second click on the bag picked on Extraction's shelf. The bean add/edit popup is `src/components/BeanModal.tsx`, used by Beans and the bag page.

One file per page in `src/pages/` (`Home.tsx`, `Dialin.tsx`, `ShotHistory.tsx`, `Beans.tsx`, …). `App.tsx` shows `ExtractionHome.tsx` instead of `Home.tsx` when the Extraction design is on, and `Dialin.tsx` shows `ExtractionDialin.tsx`'s layout. Both Dial-in layouts keep their form state in `useShotForm` / `useBrewForm` (`src/hooks/useDialinForm.ts`), so they save the same shot or brew.

### Backend

`server/app.ts` — the Express app: security headers, the optional `ALLOWED_HOSTS` check and all routes. `server/index.ts` — starts it and shuts down cleanly on SIGTERM/SIGINT (closes the DB). `server/db.ts` — schema, migrations, seed data, `snapshotDatabase()`. `server/backup.ts` — backup export/restore and CSV export. `server/validation.ts` — a zod schema per request body, checked with `parseBody()`. `server/errors.ts` — `HttpError`, `found()` (404 when a lookup by id finds nothing) and the error handler. `better-sqlite3` is synchronous; all DB calls are blocking (intentional for simplicity). `GET /api/health` is used by the Docker `HEALTHCHECK` and CI.

Errors: every route answers errors as JSON `{ "error": "…" }` — 400 for invalid bodies (validation is lenient: it drops unknown fields and allows null numbers), 404 for unknown ids or `/api/*` paths, 409 for a duplicate id, 500 (details only in the server log) for bugs. The UI shows that message in its toast.

Beans ↔ shots/brews: `shots.bean_id` / `brews.bean_id` link to `beans.id` (no foreign key, so history survives a deleted bean; deleting a bean sets them to NULL). `bean` and `roaster` are kept on the row as display names: the server fills them from `bean_id` (`resolveBean()`), and renaming a bean updates them. The server also moves the bean's `remaining` stock in the same transaction when a shot/brew is created, edited (old dose back, new dose off) or deleted (`adjustStock()`), so the UI never computes stock itself.

DB shape note: `shots` and `brews` store taste as flat columns (`taste_acidity`, etc.) but the API surfaces them nested as `taste: { acidity, ... }` via `rowToShot()` / `rowToBrew()`. `shots`/`brews` also have `landed` (0 sour … 50 balanced … 100 bitter, NULL = not placed) and `bad` (0/1); `server/taste.ts` turns a request body into those columns and still writes `verdict` (worked out from them) so an older version reading the same database keeps working. Rows that only have a verdict (from before migration 4, or an older backup) are filled by `fillFromVerdictsSql()` on upgrade and after every import. Similarly `beans.notes`, `beans.doses`, `brews.pours`, `recipes.tags` and `recipes.steps` are JSON strings in SQLite, parsed in the `rowTo*()` helpers.

Freezer: `beans.frozen_at` is the day a bag went into the freezer (NULL = not frozen) and `beans.frozen_days` the days it spent frozen before. Taking it out adds that stay to `frozen_days` (`freezerFields()` in `src/data/beans.ts`), and freshness counts days off roast minus all frozen days (`beanFreshness()`). `PUT /api/beans/:id` keeps both as they are when a client doesn't send them, like `doses`.

Quick log: Dial-in's Quick / Full switch (espresso only; `src/pages/QuickShot.tsx`) saves a shot with `rating` NULL, meaning not tasted yet. Its taste columns hold the middle values (5) the form starts with. Anything that shows or averages ratings has to allow null: use `ratingText()` / `ratingsOf()` / `ratingOrder()` from `src/data/taste.ts`. History marks such shots Quick, and the edit form keeps the rating null until the taste sliders are moved or a rating is typed. Which of Quick or Full a device shows is kept in `localStorage` (`grounded-quick-log`), not in the settings, because it differs per device (Quick by default on a phone-sized screen).

Care: `care_tasks` (per gear item: `name`, `every`, `unit` = `shots` | `days` | `grams`, `since` = when the count runs from, `snoozed_until`) and `care_log` (one row per Done, with the task's and gear's names at the time, `started`, `done_at` and the `shots`/`grams`/`days` that had built up). How far along a task is gets worked out in the UI (`src/data/care.ts`), because it counts the shots and brews whose `machine`, `grinder_model`, `basket` or `dripper` is the gear's name. The UI sends those counts with `POST /api/care-tasks/:id/done`, which logs them and moves `since` to `done_at`. `DELETE /api/care-log/:id` undoes a Done and puts `since` back. Deleting gear (or clearing sample gear) deletes its tasks, but the log stays. The UI is the Care tab on Gear (`src/components/Care.tsx`) and `CareReminder` at the top of both Homes.

Schema: the `CREATE TABLE IF NOT EXISTS` block in `db.ts` is the full current schema, so a fresh database is complete at once (and is stamped with the latest version). Existing databases are upgraded by the numbered `MIGRATIONS` list: `PRAGMA user_version` stores how many have run, each pending one runs once in its own transaction, and a failure stops startup. Before migrating an existing database, the server writes a snapshot next to it (`grounded.db.backup-v<old version>-<timestamp>`, via `VACUUM INTO`). To change the schema: update the `CREATE TABLE` block **and** append a migration (use `addColumn()`, which checks first); never edit or reorder a released migration. Also update the row and API types in `src/types.ts`.

### Backups

`GET /api/export` downloads a `Backup` (`src/types.ts`): a header (`app`, `format`, `version`, `schemaVersion`, `exportedAt`), raw `SELECT *` rows for `beans`, `shots`, `brews`, `gear`, `recipes`, `tips`, `care_tasks` and `care_log`, and the settings (except `sampleData`). `POST /api/import` takes `{ mode, dryRun?, backup }`: `replace` deletes those tables and the settings and loads the backup; `merge` only inserts rows whose id isn't there yet and settings that aren't set. It refuses non-Grounded files and backups with a newer `schemaVersion`, inserts only the columns the table has (an older backup's missing columns get their defaults), writes a `grounded.db.backup-import-…` snapshot first (deleted again if the import fails) and runs in one transaction. A dry run rolls the transaction back and returns the same counts; the UI uses it as the preview. That route alone accepts bodies up to 50 MB. Stock isn't recounted on import. When you add a table, add it to `BACKUP_TABLES` in `backup.ts`, the `BackupTable` type, `importSchema` in `validation.ts` (with a default, so older backups still import) and `TABLE_WORDS` in `DataSettings.tsx`. `GET /api/export/shots.csv` / `brews.csv` export a fixed column list; text that starts like a formula gets a leading `'`. The UI is `src/components/DataSettings.tsx` (Settings → Backup and data).

### Settings

App-wide preferences live in the `settings` table (one row per key, JSON value), so every browser sees the same ones: `design`, `theme`, `fonts`, `extraction`, `units`, `waterRecipes`, `dialinDefaults`, `brewModes`, `careHidden` (gear ids left out of Gear → Care). API: `GET /api/settings` returns one object; `PUT /api/settings` takes a partial object and only accepts those keys (`settingsSchema` in `server/validation.ts`).

`sampleData` is only ever set on a brand-new install (`'present'`, by `db.ts`). While it's `'present'`, Home shows a banner whose button calls `POST /api/sample-data/clear`. That deletes exactly the rows in `SAMPLE_IDS` (`db.ts`; recipes are kept), unlinks the user's own shots from removed sample beans and sets `'cleared'`; it answers 409 on any install not marked `'present'`. "Keep them" sets `'dismissed'`. Keep `SAMPLE_IDS` in sync with the seed data.

`brewModes` (espresso machine buttons/programs) is optional: when it's empty or missing, Dial-in and the shot editor don't show a brew mode field at all. In the UI, `App.tsx` derives each value with a default and passes it down as props; changes go through `updateSettings()` in `useData`.

Older versions kept theme, water recipes and dial-in defaults in `localStorage`. On first load, `useData` moves any of those the database doesn't have yet into it, then deletes the old keys.

### Units, designs, themes & fonts

`useUnits.ts` provides g↔oz and °C↔°F helpers and the currency sign (`units.currency`: `EUR`, `USD` or `GBP`; it only changes the sign shown with prices, nothing is converted). Units are passed as props; there is no unit context.

There are two designs, set by the `design` setting (missing = `refined`, the default for fresh installs) and applied as `data-design` on `<html>`:

- **Refined**: the sidebar, serif titles, mono numbers. Its theme is the `theme` setting (`moody` by default; also `midnight`, `terminal`, `parchment`, `oat`, `ember`, listed in `THEMES` in `Settings.tsx`) and its fonts are `fonts` (three roles).
- **Extraction**: an icon rail (`Rail` in `Shell.tsx`), its own Home (`src/pages/ExtractionHome.tsx`) and its own Dial-in (`src/pages/ExtractionDialin.tsx`: bag and recipe, the time dial `TimeDial` from `Fields.tsx`, and taste in three columns). Its History is Refined's `HistoryList` with its own rows and `ExtractionInspector` (`src/components/ExtractionInspector.tsx`) as the panel, picked by the `design` prop on `ShotHistory` / `BrewHistory`; Beans works the same way with `ExtractionBeans` (`src/components/ExtractionBeans.tsx`), while the add/edit popups stay in `Beans.tsx`. Stats, Gear, Stock, Tips and Recipes keep Refined's markup and are restyled in `extraction.css` under their page class (`stats-page`, `gear-page`, …); the few Extraction-only elements (`si-bag`, `tips-seg`, `title-dot`) are hidden on Refined in `global.css`. Every other page is Refined's markup restyled in `src/styles/extraction.css` under `[data-design="extraction"]`. Its theme and fonts live in the `extraction` setting (`{ theme: 'roast' | 'mocha' | 'latte' | 'crema', fonts: { sans, serif } }`), so switching designs keeps each one's choices. It has two font roles: numbers and headings share one face, so `--font-mono` is set to the serif.

`lookFrom(settings)` in [src/data/fonts.ts](src/data/fonts.ts) works out the design, theme and fonts with their defaults, and `applyAppearance()` puts them on `<html>` (`data-design`, `data-theme`, the font variables). The theme colors are defined in `global.css` (Refined) and `extraction.css`; a theme id is only valid in its own design. Fonts are three CSS variables — `--font-sans` (text), `--font-mono` (numbers & labels), `--font-serif` (headings) — overridden at runtime. Use the variables, never a hard-coded font name (the design and theme preview cards in Settings are the exception). Main buttons use `--primary` (the accent on Refined, cherry on Extraction). The font lists and the `@fontsource` imports are in `fonts.ts`. The last look is also cached in `localStorage` (`grounded-look`) only so the next page load paints correctly before settings arrive. The database stays the source of truth.

### Docker / env vars

- `PORT` — API port (default `3001`; host port is `5555` per `docker-compose.yml`)
- `DB_PATH` — SQLite file path (default `data/grounded.db`; in Docker the volume `./data` is mounted at `/app/data`)
- `ALLOWED_HOSTS` — optional, comma-separated host names/IPs. When set, requests for any other `Host` get 403 (DNS-rebinding protection); `localhost`/`127.0.0.1` always work for the health check. Unset = off.
- No `X-Frame-Options`/`frame-ancestors` header on purpose, so Grounded can be embedded in a home dashboard.
- The Dockerfile pins `node:24-alpine` by digest; Dependabot bumps it.
- In production (`NODE_ENV=production`) the Express server serves `dist/` as static files and handles `*` with the SPA index.
- Vite proxies `/api/*` → `http://localhost:3001` in dev so there are no CORS issues locally.
- The Dockerfile builds everything in the first stage, prunes dev dependencies there, and copies `node_modules` into a runtime stage that has no compilers. Both stages must use the same base image, because `better-sqlite3` is a native module.
- The app runs as `node` (uid 1000), not root. `docker-entrypoint.sh` starts as root, `chown`s the data folder (the `DB_PATH` directory) to node, then `exec su-exec node …`. A compose `user:` override skips the chown and runs as that user. CI checks this with a root-owned bind mount. Keep `docker-entrypoint.sh` LF-only (`.gitattributes`).
- `docker-compose.yml` is the generic one users get. Local additions (your own networks, for example) go in a git-ignored `docker-compose.override.yml` next to it, which Docker Compose merges in automatically; keep them out of `docker-compose.yml`.

### ESM

`package.json` has `"type": "module"` — all server files use ESM `import` syntax. Without this field Node.js rejects the imports and every API route returns 500 on boot.

### TypeScript

- `strict` is on in both configs. `tsc` only type-checks (`noEmit`): Vite compiles the UI, and Node runs `server/*.ts` directly by stripping the types, so the server has no build step (Docker `CMD` is `node server/index.ts`).
- Because Node only strips types, the server may use **erasable syntax only** (`erasableSyntaxOnly`): no `enum`, `namespace` or parameter properties. Type-only imports must use `import type` (`verbatimModuleSyntax`), and relative imports keep their `.ts`/`.tsx` extension, in the UI too.
- [src/types.ts](src/types.ts) holds the types shared by API and UI: `Shot`, `Brew`, `Bean`, `Gear`, `Recipe`, `Tip`, `Settings`, the `*Input` request bodies, and the `*Row` shapes `SELECT *` returns before the `rowTo*()` helpers. The server imports it with `import type`, so it isn't needed at runtime and the Docker image only copies `server/`. When you add a column, update the row and API types there too.
- `src/vite-env.d.ts` declares `__APP_VERSION__` and Vite's asset imports.

### Versioning

Semantic versioning; the version lives only in `package.json` and is injected into the UI as `__APP_VERSION__` via `define` in `vite.config.js` (sidebar brand tag, Settings → About). Never hard-code a version string in components. For a release: add an entry to `CHANGELOG.md`, then `npm version patch|minor|major` (commits + creates the `vX.Y.Z` tag) and `git push --follow-tags`. The tag push publishes the Docker image (see Commands).
