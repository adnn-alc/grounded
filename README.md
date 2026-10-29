# Grounded ☕

A self-hosted espresso & filter coffee tracker. Log shots and brews while you dial in, keep a library of beans, gear and recipes, and see how your coffee is trending over time.

React + Express + SQLite in a single Docker container. No accounts, no cloud, no telemetry — your data stays in one SQLite file on your own machine.

---

## Features

- **Dial-in** — espresso and filter modes. Log dose, yield, time, temperature, grind, pre-infusion, grinder RPM, basket, water recipe and brew mode, then rate the cup on six taste axes (acidity, sweetness, body, bitterness, balance, aftertaste) with a live flavor radar.
- **Basket doses** — save the dose you measured for each basket per bean, along with the grind setting it was measured at, and apply it with one click.
- **Shot & brew history** — browse, edit, favorite and re-use past shots and brews as a starting point for the next one.
- **Beans** — roaster, origin, process, variety, roast date, tasting notes, price and remaining stock. Archive finished bags.
- **Inventory** — open bags, low-stock warnings and spending.
- **Recipes & tips** — store your own brew recipes and notes.
- **Gear** — machines, grinders, baskets, drippers, scales and kettles. Active gear feeds the dial-in dropdowns.
- **Stats** — 14-day trend, bean origins world map, espresso stats per basket, and more.
- **Settings** — four themes (Moody, Midnight, Parchment, Terminal), a choice of bundled fonts, g/oz and °C/°F units, default dial-in values and custom water recipes. Settings are stored on the server, so every browser and device sees the same ones.

---

## Quick start (Docker)

```bash
git clone https://github.com/<you>/grounded.git
cd grounded
docker compose up -d --build
```

Then open **http://localhost:5555**.

> **Note:** `docker-compose.yml` joins an external Docker network called `media_net` (used to sit behind a reverse proxy on the author's server). If you don't have that network, delete the two `networks:` blocks from `docker-compose.yml` before running, or create it first with `docker network create media_net`.

The database is stored at `./data/grounded.db` next to `docker-compose.yml`, so it survives container rebuilds and updates. On first run it is created and filled with a few sample beans, shots and gear to explore — delete them from the UI once you start logging your own.

To use a different host port, change the left side of the mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:3001"   # host:container
```

### Updating

```bash
git pull
docker compose up -d --build
```

---

## Local development

Requires Node 22+ (Node 24 LTS recommended — it's what the Docker image uses).

```bash
npm install
npm run dev
```

This starts both servers:

- **Vite UI** → http://localhost:5173
- **Express API** → http://localhost:3001

Vite proxies `/api/*` to Express, so there's no CORS setup needed. The dev database is created at `data/grounded.db`.

| Command           | What it does                                        |
|-------------------|-----------------------------------------------------|
| `npm run dev`     | UI + API together                                   |
| `npm run dev:ui`  | Vite only                                           |
| `npm run dev:api` | Express only (restarts on file changes)             |
| `npm run build`   | Build the frontend into `dist/`                     |
| `npm start`       | Run the API; with `NODE_ENV=production` it also serves `dist/` |

### Running without Docker

```bash
npm install
npm run build
NODE_ENV=production npm start
```

Everything is served from one port (3001 by default).

---

## Configuration

| Variable   | Default             | Description                                          |
|------------|---------------------|------------------------------------------------------|
| `PORT`     | `3001`              | Port the server listens on                           |
| `DB_PATH`  | `data/grounded.db`  | Path to the SQLite database file                     |
| `NODE_ENV` | —                   | Set to `production` to serve the built frontend      |

---

## Backup & restore

All your data — logs, beans, gear, recipes and settings — is in the `data/` folder. SQLite runs in WAL mode, so stop the container before copying to get a consistent snapshot:

```bash
docker compose stop
cp data/grounded.db ~/grounded-backup-$(date +%F).db
docker compose start
```

To restore, stop the container, put the backup back at `data/grounded.db` (and remove any `grounded.db-wal` / `grounded.db-shm` files next to it), then start it again.

---

## Security

Grounded has **no login or authentication** — anyone who can reach the port can view and edit all data. It's meant for a home network. If you expose it to the internet, put it behind a reverse proxy with authentication (e.g. Nginx Proxy Manager access lists, Authelia, or a VPN like Tailscale).

Found a security problem? Please report it privately — see [SECURITY.md](SECURITY.md).

---

## Project structure

```
grounded/
├── Dockerfile              # Multi-stage build: builds the UI, runs the API
├── docker-compose.yml
├── .github/                # CI workflow and Dependabot config
├── server/
│   ├── index.js            # Express API — all routes
│   └── db.js               # SQLite schema, migrations, seed data
├── src/
│   ├── App.jsx             # Hash routing, theme, settings
│   ├── api/client.js       # All fetch() calls
│   ├── hooks/
│   │   ├── useData.js      # Loads all data, exposes mutation helpers
│   │   └── useUnits.js     # g/oz and °C/°F helpers
│   ├── pages/              # Home, Dial-in, history, beans, gear, stats…
│   ├── components/         # Shell, charts, settings, world map, basket doses
│   ├── data/               # Static data (world map, fonts, water recipes, brew modes)
│   └── styles/global.css   # Themes via CSS custom properties
└── scripts/
    └── build-world-map.mjs # Regenerates src/data/worldMap.js
```

---

## API

All endpoints are JSON under `/api`.

| Resource | Endpoints |
|----------|-----------|
| Shots    | `GET /shots` · `POST /shots` · `PUT /shots/:id` · `DELETE /shots/:id` · `PATCH /shots/:id/favorite` |
| Brews    | `GET /brews` · `POST /brews` · `PUT /brews/:id` · `DELETE /brews/:id` · `PATCH /brews/:id/favorite` |
| Beans    | `GET /beans` · `GET /beans/archived` · `POST /beans` · `PUT /beans/:id` · `DELETE /beans/:id` |
| Gear     | `GET /gear` · `POST /gear` · `PUT /gear/:id` · `DELETE /gear/:id` |
| Recipes  | `GET /recipes` · `POST /recipes` · `PUT /recipes/:id` · `DELETE /recipes/:id` |
| Tips     | `GET /tips` · `POST /tips` · `PUT /tips/:id` · `DELETE /tips/:id` |
| Settings | `GET /settings` · `PUT /settings` (partial update) |
| Health   | `GET /health` |

---

## Tech stack

| Layer    | Choice                                      |
|----------|---------------------------------------------|
| UI       | React 18 + Vite 5                           |
| API      | Express 4                                   |
| Database | SQLite via better-sqlite3                   |
| Styling  | Plain CSS with custom properties            |
| Charts   | Hand-rolled SVG                             |
| Fonts    | Bundled via Fontsource (Inter, JetBrains Mono, Instrument Serif by default) |
| Deploy   | Docker / Docker Compose                     |

---

## Versioning

Grounded uses [Semantic Versioning](https://semver.org/). Every release is a git tag (`v1.0.0`, `v1.1.0`, …) and is listed in [CHANGELOG.md](CHANGELOG.md). The current version is shown in the sidebar and under Settings → About.

To cut a release:

```bash
npm version minor     # or patch / major — bumps package.json + lock, commits and tags
git push --follow-tags
```

---

## License

Copyright (C) 2026 adnn-alc

Grounded is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License v3.0](LICENSE) or (at your option) any later version.

In short: you're free to use, modify and self-host it. If you distribute a modified version — or run a modified version as a service that other people use over a network — you must make your source code available under the same license.
