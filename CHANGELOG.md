# Changelog

All notable changes to Grounded are listed here. Versions follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (`2.0.0`) — breaking changes, e.g. a database change that needs manual migration
- **MINOR** (`1.1.0`) — new features
- **PATCH** (`1.0.1`) — bug fixes and small tweaks

## [Unreleased]

- Fix: a brand-new database was missing several columns until the app was restarted once, so the first launch showed "Failed to connect to API"
- Docker image now runs on Node 24 LTS (Node 20 is end-of-life); `better-sqlite3` upgraded from 9.6 to 12.11. Local development now needs Node 22+

## [1.0.0] — 2026-10-28

First public release.

- Espresso and filter dial-in with six-axis taste rating and flavor radar
- Shot and brew history with editing, favorites and re-use as presets
- Bean library with stock tracking, archive and per-basket doses (with reference grind setting)
- Inventory, recipes, tips and gear pages
- Stats: 14-day trend, bean origins world map, espresso by basket
- Four themes, g/oz and °C/°F units, custom water recipes
- Single-container Docker deployment with SQLite storage
