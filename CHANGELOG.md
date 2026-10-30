# Changelog

All notable changes to Grounded are listed here. Versions follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (`2.0.0`) — breaking changes, e.g. a database change that needs manual migration
- **MINOR** (`1.1.0`) — new features
- **PATCH** (`1.0.1`) — bug fixes and small tweaks

## [Unreleased]

- Each release now also builds a ready-made Docker image for amd64 and arm64 and publishes it to GitHub Container Registry (`ghcr.io/adnn-alc/grounded`)

## [1.2.0] — 2026-10-30

Safer by default: the container no longer runs as root. Also a paged bean archive, a one-time option to clear the sample data on new installs, and guides for contributors. No database changes.

- The app no longer runs as root inside the container: it runs as the `node` user (uid 1000). On start it takes ownership of the `data/` folder, so existing installs keep working without manual steps
- The bean archive is now split into pages (10, 20 or 50 per page)
- Added CONTRIBUTING.md, issue templates (bug report, feature idea) and a pull request template
- New installs show a one-time banner on Home to remove the sample beans, shots, brews and gear in one go (recipes and anything you added stay). Existing installs never see it

## [1.1.0] — 2026-10-30

Settings that follow you across devices, a font picker, shots linked to their bean bags, clearer errors, and a TypeScript rewrite under the hood. Your database is upgraded automatically on the first start, after a backup copy is saved next to it.

- Optional `ALLOWED_HOSTS` setting to protect against DNS-rebinding attacks (off by default)
- Security headers on every response; the server no longer announces that it runs Express. Embedding in a dashboard still works
- Clean shutdown: `docker compose stop` now finishes open requests and closes the database properly
- API tests (`npm test`) and linting (`npm run lint`, oxlint), both run in CI
- Docker base image pinned to an exact version; the dev server only listens on localhost
- Added CODE_OF_CONDUCT.md
- Removed the unused `cors` package
- Shots and brews now link to their bean by id: renaming a bean keeps its history, two bags with the same name stay apart, and editing a shot's dose or bean now corrects the stock. Existing shots are matched to their bean automatically
- Bean stock is now updated by the server, in the same step as saving the shot or brew
- Brew modes are now set in Settings → Dial-in defaults (optional). With none set, the field is hidden. Modes already used in your shots are kept
- Failed saves now show an error message, and the form stays open with your input
- The API checks what it's sent and answers clear errors: 400 for invalid input, 404 for unknown items, instead of crashing
- Database updates are now numbered and run once each; before updating, the database is copied to `data/grounded.db.backup-v…`
- Fix: a brand-new database was missing several columns until the app was restarted once, so the first launch showed "Failed to connect to API"
- Docker image now runs on Node 24 LTS (Node 20 is end-of-life); `better-sqlite3` upgraded from 9.6 to 12.11. Local development now needs Node 22+
- Settings (theme, units, water recipes, dial-in defaults) are now stored in the database, so every browser and device sees the same ones. Existing settings from your browser are moved over automatically on first load
- Units (g/oz, °C/°F) are now remembered instead of resetting on every reload
- New font picker under Settings → Appearance: choose the text, numbers and headings fonts
- Fonts are bundled with the app instead of loaded from Google Fonts — no external requests at all
- Docker image: no compilers in the runtime image (smaller), plus a health check (`GET /api/health`)
- Added SECURITY.md, a CI workflow (build + fresh-database smoke test + Docker build) and Dependabot
- Removed unused files (`nginx.conf`, an old copy of the seed data)
- The code is now TypeScript (strict) instead of JavaScript. Shared types for shots, brews, beans, gear, recipes, tips and settings are used by both the API and the UI, and CI type-checks every push (`npm run typecheck`). Node runs the API's `.ts` files directly, so there is still no server build step. Local development now needs Node 22.18+
- The 2,000-line `pages.jsx` is split into one file per page

## [1.0.0] — 2026-10-28

First public release.

- Espresso and filter dial-in with six-axis taste rating and flavor radar
- Shot and brew history with editing, favorites and re-use as presets
- Bean library with stock tracking, archive and per-basket doses (with reference grind setting)
- Inventory, recipes, tips and gear pages
- Stats: 14-day trend, bean origins world map, espresso by basket
- Four themes, g/oz and °C/°F units, custom water recipes
- Single-container Docker deployment with SQLite storage
