# Changelog

All notable changes to Grounded are listed here. Versions follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (`2.0.0`) — breaking changes, e.g. a database change that needs manual migration
- **MINOR** (`1.1.0`) — new features
- **PATCH** (`1.0.1`) — bug fixes and small tweaks

## [Unreleased]

- For development, the UI is now built with Vite 8 (was 5), which clears two security warnings in the dev server. The app itself is unchanged

## [1.5.2] — 2026-11-08

A fix for the time dial on Extraction. Nothing changes in your database.

- On Extraction's Dial-in, − and + under the time dial no longer throw the time to 0 or the max: they add or take off one step, as they should. The dial also only moves when you press on its ring, so a tap in the middle or just next to − / + leaves the time alone

## [1.5.1] — 2026-11-08

Finished bags are back on Stats, a long Spending total fits on Extraction, and the Docker setup works without changes. Nothing changes in your database.

- Stats → Spending shows **Beans finished** again: how much coffee your finished bags held, and how many there were (it went missing in the 1.4.0 redesign)
- On Extraction, the big Spending total no longer runs into the next number when it's long
- `docker-compose.yml` no longer joins a `media_net` network, so it works as it is. The README's quick start now uses the ready-made image from GitHub Container Registry
- For development, `npm run dev` now uses concurrently 10

## [1.5.0] — 2026-11-04

A page for each bag, quick log for the phone, care reminders for your machine and grinder, freezer tracking, and two more Extraction themes. Your database is upgraded automatically on the first start, after a backup copy is saved next to it. Once you've saved a quick shot, don't go back to an older version: it expects every shot to have a rating.

- Extraction has two more themes in Settings → Appearance: **Mocha**, a dark cocoa brown that's easier on the eyes than Roast's near-black, and **Latte**, a muted milky beige that's softer than Crema's near-white
- Beans can go **in the freezer**: a switch on each bag (and in the bean form, with the day it went in) frosts the bag over on Beans and Home, in both designs, and shows how long it's been frozen. A frozen bag stops aging: its freshness label leaves out the days it spent in the freezer, also after you take it out
- **A page for each bag**: open it by clicking a bag on Beans (on Extraction, pick the bag on the shelf, then click it again, or use **Open the bag's page** under its name). It shows the bag's freshness, what's left and roughly how many shots that is, what you've made with it and its price; your **best shot so far** with **Start from this shot**; a chart of your grind across the bag (each shot a dot, colored by where it landed, with the trend); your rating by days off roast with the days it tasted best; and every shot and brew with it, newest first. Dial in, Edit and the freezer switch are there too. Each bag has its own address (`#/bean/<id>`), so you can bookmark it
- **Quick log** for pulling a shot at the machine with your phone: a Quick / Full switch on Dial-in (espresso). Quick is the bag, dose, out and time as big numbers with − / +, starting from your last shot with that bag, and the sour-to-bitter slider if you want it; gear and grind are copied from that shot. It's saved without tasting it, and History marks it **Quick** until you add taste (its panel has **Add taste**). **Taste and notes in Full** moves what you entered to the full form. Quick is the default on a phone-sized screen, and each device remembers which one you picked. Untasted shots are left out of rating averages
- **Care** for your gear, a new tab on Gear: give each machine and grinder (or any other gear) tasks that repeat every so many shots, days or kg of coffee, from suggestions like backflushing every 50 shots or cleaning the burrs every 5 kg. Machines and grinders in use show up there by default; hide the ones you don't need, and add tasks to any other gear. Each task shows how far along it is, counted from the shots and brews you log with that gear, with **Done** to start it again. Every Done is kept in a log with what had built up since the time before (shots, coffee and days), and can be undone. When a task is due, Home shows it at the top with **Done** and **Remind me tomorrow**. Deleting gear deletes its tasks, but not the log
- Your database is upgraded automatically on the first start (for the freezer and Care), after a backup copy is saved next to it. Backups now include the care tasks and log; older backups still restore
- API: beans have `frozen_at` (the day it went into the freezer, or null) and `frozen_days`. A shot's `rating` can be null (a quick shot that hasn't been tasted). New routes: `/api/care-tasks` (GET, POST, PUT and DELETE by id, and `POST /api/care-tasks/:id/done`) and `/api/care-log` (GET, and DELETE by id to undo a Done)

## [1.4.0] — 2026-11-02

A redesign (Refined), a second design to switch to (Extraction), a page that works on a phone, and a sour-to-bitter slider instead of the verdict buttons. Your database is upgraded automatically on the first start, after a backup copy is saved next to it. An older version can still read the upgraded database.

- New look throughout: a calmer sidebar with **Pull a shot** at the top, bigger serif page titles, plain-language labels, and cards without the old all-caps labels
- Works in a phone browser: a bottom tab bar (Home, History, Pull, Beans, More), full-screen Settings and shot details, and a save bar on Dial-in. Taste folds away until you open it. History rows show dose, yield and time under the bag
- **How did it land?** A slider from sour through balanced to bitter replaces the Good / Under / Over / Bad buttons, with a **Bad shot** (or **Bad brew**) switch next to it for one that went wrong. Turning it on grays the slider out. Until you place it, a hollow knob sits in the middle to show it can be dragged. Existing shots and brews are placed on the slider for you (sour 25, good 50, bitter 75; bad ones have the switch on)
- No timer anywhere. Shot time and total brew time are typed, dragged on a slider (up to 60 s and 3 min; typing more is fine) or nudged with − / +, and the slider marks your last time with that bag. Nothing assumes a 1:2 ratio or a 25–30 s window
- Dial-in: the bag's basket doses are chips you tap to use, with the grind you measured them at, every number has − / + buttons, **Start from this** loads your last shot with that bag, and the rating can be set by hand (it starts at the average of the taste sliders). Tap the bag's tasting notes to add them to your notes. Gear (machine, basket, grinder, water, brew mode) is always shown, and the save bar sits below the page instead of covering it. The back arrow returns to the page you came from
- Filter Dial-in: pours are entered as scale totals ("to 150 g"); the plan follows the dose and water until you change it
- Home: your last shot with **Pull again**, its ratio, basket, temperature and grind as labeled values, and where it landed with the label under the mark; this week's shots and brews against last week (Sundays marked in red under the chart); and open bags with how much is left in whole grams next to your favorites (4 at a time, with pages), so it fits a desktop window without scrolling. **Add a bag** at the end of the bags opens the new-bag form on Beans
- Shots and Brews: the tab you're not on shows its count on both pages, not just on Shots. Grouped by day, filtered by bag (open bags first, then finished ones) and period (7, 30, 90 days or all time), with a search over the bean, roaster and notes, with the details in a wider panel on the right: numbers first, then machine, grinder, basket and water on their own labeled rows
- Beans: basket doses and grind on each bag (one basket can have a dose for each grind you measured it at), how many days off roast with a freshness label (resting, in its window, aging, past its best), the price, and **Dial in**, **Edit** and **Finish** on the same line as the basket doses link, right under the doses. The header shows how much coffee is available, rounded up to a whole number
- Espresso ratios show two decimals (1:2.05); filter ratios keep one (1:16.7)
- Stats: Espresso and Filter side by side, each with where your shots or brews landed between sour and bitter (bad ones apart), for 30 days, 90 days or all time. Below them, Origins (countries, process, roasters) next to Spending: spent on beans, bags, average per bag and per kg, the most expensive bag, beans per month for the last 6 months, spent on gear, how much coffee you used, and how much is left in your open bags. The rating-per-day chart, the espresso-by-basket table and the price per coffee are gone
- **Extraction**, a second design, picked in Settings → Appearance next to Refined: a narrow icon rail instead of the sidebar, big bold numbers, and an oxblood palette with crema and cherry (**Roast**) or a warm light one (**Crema**). Home shows your last shot in large numbers with its ratio, basket, temperature and grind over a sour-to-bitter gauge, the rating beside it and the last 10 days on the right, this week as four numbers, your open bags as a shelf (each bag its own color, filled to what's left, with a cherry outline when it's nearly out) and your favorites next to it, 4 at a time. Dial-in has its own layout in three columns: the bag's name as the title with its roaster, days off roast and what's left as pills, **Change bag** next to it (one click opens the list of bags, on Refined too), the recipe as big numbers with − / +, a bar of coffee in against espresso (or water) out with the ratio, then the basket doses as chips and the gear as labeled pickers; in the middle a large dial for the time that you drag, type into, nudge with − / + or scroll over (up for more, down for less), with dots for your last 5 times on that bag, their range under it and **Start from it** for the last one; on the right the taste in colors, the sour-to-bitter gauge, the rating, notes (with the bag's notes to tap) and **Save**. For filter the pours show as one bar under the dial, with **Edit pours** to change them. On a phone the dial comes first, the recipe as tiles, and Save sits at the bottom. History has one entry in the rail, with Shots / Brews at the top: each row shows the bag, dose → yield and the time in cherry, where it landed and the rating, and the one you pick opens beside the list with its recipe in big numbers, the sour-to-bitter gauge, ratio, grind, temperature and pre-infusion in a row, the rating with notes next to the taste chart, a brew's pours as a bar, and the gear in a panel. Beans shows your open bags as a shelf like Home's (with the days off roast on each); pick one to see where it's from, its notes, its basket doses, what's left with the price, **Dial in**, **Edit** and the button that moves it to Finished bags, then its 4 best-rated shots and brews. Stats, Gear, Stock, Tips and Recipes keep their layout but take on the same look: sections without cards between thin lines, big numbers in a row with dividers, gear, bags, notes and recipes on soft rounded tiles, Primary gear in crema, a small bag in its shelf color beside each Stock row, a colored dot for each Tips category (and an Espresso / Filter toggle on a phone); the Stats map stays in its panel. Page titles drop the full stop. Dropdowns and text boxes are rounded pills. Extraction has its own fonts: Fraunces for numbers and headings (or DM Serif Display, Playfair Display, Instrument Serif) and Instrument Sans for text (or Geist, DM Sans, Inter). The design is stored on the server like the other settings, so every browser sees the same one, and each design keeps its own theme and fonts when you switch
- Settings: a centered dialog with sections, two new themes (**Oat**, gray and light, and **Ember**, oxblood), and fonts picked from chips. Water recipes and brew modes each have their own section. Geist and Geist Mono are the new default text and number fonts. on a phone it scrolls on its own without moving the page behind it
- Renamed: Inventory is now **Stock**, the bean archive is **Finished bags**, shown as bordered cards (10/page, 20/page or 50/page). Beans and Finished bags share an **Open / Finished** switch at the top to move between them
- Stock lists the emptiest bag first with how many shots are left at your usual dose. The **Reorder** buttons, which didn't do anything, are gone
- Gear, Recipes, Tips and the coffee map match the new look, and the basket doses popup lines up its columns. Gear categories and recipes fill both columns without gaps and show each item's price next to its status (€0 when there's none: free or included with something else), each Tips category sits in its own block, and Recipes no longer has a timer
- Gear pickers in Dial-in and the shot editor list each name once, and only take grinders and machines from categories that end in that word, so parts filed as "Grinder burrs" or "Machine parts" stay out
- Dropdowns inside a labeled box line up with their label instead of starting a little to the right
- Every popup (editing a bean, shot, brew, recipe, gear or tip, basket doses, Settings) closes with **Escape** as well as by clicking outside it
- The page you open starts at the top, and the sidebar clearly marks the page you're on in every theme. The logo at the top left (sidebar, rail or phone) takes you back to Home
- US English spelling throughout (favorites, color)
- API: settings have `design` (`refined` or `extraction`) and `extraction` (its `theme` and `fonts`). Shots and brews have `landed` (0–100, or null) and `bad`. `verdict` is still accepted and returned, now worked out from those two. CSV exports have both new columns
- API: a shot, brew, bean, gear item, recipe or tip saved without an `id` gets one with a random part, so two saved in the same millisecond no longer clash with a 409

## [1.3.0] — 2026-10-30

Backup & restore from the app, plus CSV export for spreadsheets. No database changes.

- Backup & restore in **Settings → Backup & data**: download everything as one JSON file, and restore it on a new install (replace everything) or merge it into an existing one (add missing only). You see what a restore would change first, and a copy of the current database is saved before it runs
- Export shots and brews as CSV for spreadsheets
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
