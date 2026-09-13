# Timely PWA - Developer Guide

Single-file PWA that runs step-by-step routines with a countdown timer. Uses the
[@aybdb/client](https://www.npmjs.com/package/@aybdb/client) library (loaded via
jsDelivr CDN) for OAuth authentication and database queries.

## Architecture Overview

`index.html` holds all markup, CSS, and logic. `sw.js` is the service worker.
There is no build step. A **routine** is an ordered list of **steps**, each with
a name and a duration in seconds (entered in minutes, decimals allowed).

## Database Schema

```sql
routines (id, name, position, created_at, updated_at)
steps (id, routine_id, name, seconds, position, created_at, updated_at)
_ayb_migrations (app_id, version, applied_at)
```

- `steps.seconds` is an integer; the UI accepts minutes and multiplies by 60.
- Deleting a routine deletes its steps (both queries fire together).
- Reordering writes all positions in one `UPDATE ... CASE` statement.

## Key Components

- `App` (global, also `window.App`) - all UI and business logic.
- Hash routing: `#routine/{id}` for the routine detail screen; empty hash = list.
- Screens: `setup`, `error`, `list`, `routine`, `run` (run is a full-screen
  overlay and never gets a route, since runs are ephemeral).
- Modals: routine name, step name/minutes, confirm, settings.

## Run Engine

- Runs are **ephemeral** - nothing about a run is persisted.
- The countdown is **timestamp-based** (`run.endTime`), not decrement-based. A
  `setInterval(250ms)` tick recomputes remaining time, so a throttled or
  backgrounded tab catches up instead of losing time.
- `tick()` catches up across multiple steps in a `while` loop using the
  scheduled end times, so missed transitions don't drift.
- Pause stores `remainingMs`, clears the interval, and releases the wake lock.
- Resume recomputes `endTime = Date.now() + remainingMs` and re-acquires it.
- **+1:00** works running or paused and extends the current step (and total).
- `visibilitychange` re-acquires the wake lock and immediately ticks on return.

## Alerts & iOS

- Alerts are **synthesized with the Web Audio API** - no mp3 asset.
  - `playBing()` - three ascending sine notes at each step transition.
  - `playCompletion()` - a longer triangle arpeggio when the routine finishes.
- Settings toggle **"Repeat alert until acknowledged."** When on, a step alert
  re-chimes every 6s until the user taps the run screen. The **Done** state
  always repeats until the Done button is pressed.
- The Done state requires acknowledgement **before** releasing the wake lock and
  stopping the keep-alive tone.
- `startKeepAlive()` runs a near-inaudible 20 Hz tone while a run is active to
  hold the iOS audio session open, mirroring `ducktime/`'s audio warm-up.

## Gotchas & Patterns

### 1. Service Worker Caching
**MUST bump `CACHE_NAME` in `sw.js` after every change** (e.g. `timely-v1` →
`timely-v2`). Users won't see changes otherwise.

### 2. SQL String Escaping
Use `escapeSql()` (wrapping `AybClient.escapeSQL`) for user input and
`escapeHtml()` for display.

### 3. Batch, don't loop
Never `await ayb.query()` inside a loop over rows. Reorders are a single
`CASE` statement; routine deletion fires both `DELETE`s with `Promise.all`.

### 4. Migrations
Add to the `timelyMigrations` array and run via
`runMigrations(ayb, 'timely', timelyMigrations)`. State is tracked in
`_ayb_migrations` with `app_id = 'timely'`.

### 5. Authentication
OAuth via `restoreOAuth({ appName: 'Timely', ... })`; credentials live under
`ayb_Timely`. Never clear credentials on a connection failure - show the error
screen with a retry.

### 6. Drag and drop
Desktop uses a drag handle that sets `draggable` on mousedown; mobile uses touch
events on the handle. Drop placement is decided by pointer position against the
target's midpoint (`dropsAfter`), and the insertion line uses the same value
(`showDropIndicator` / `placeAtIndicator`). Keep the indicator and the insertion
rule reading from the same value.

## Files

- `index.html` - the whole app
- `sw.js` - service worker (bump `CACHE_NAME` on changes)
- `manifest.json`, `icon.svg` - PWA metadata
