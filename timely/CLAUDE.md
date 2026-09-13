# Timely PWA

Single-file PWA that runs step-by-step routines with a countdown timer and ayb
database backend. Uses the [@aybdb/client](https://www.npmjs.com/package/@aybdb/client)
library (loaded via jsDelivr CDN) for OAuth authentication and database queries.

See [README.md](./README.md) for the full developer guide including:
- Architecture and key components
- Database schema (`routines`, `steps`)
- Run engine (timestamp-based countdown, catch-up across steps)
- Alerts (Web Audio, repeat-until-acknowledged) and iOS wake-lock quirks
- Common gotchas (service worker caching, SQL escaping, drag-and-drop placement)

## Key Files

- `index.html` - All app logic (single-file PWA)
- `sw.js` - Service worker for offline caching
- `manifest.json`, `icon.svg` - PWA metadata

## Critical Reminders

- **Always bump `CACHE_NAME` in `sw.js` after any change to `index.html`** or
  users won't see updates.
- Use `escapeSql()` (wraps `AybClient.escapeSQL`) for SQL string escaping.
- Batch into one statement or fire concurrently with `Promise.all`; never loop
  `await ayb.query()` over a list of rows.
- The global `ayb` variable is the `AybOAuth` instance; use `ayb.query()`.
- Migrations run via `runMigrations(ayb, 'timely', timelyMigrations)` and track
  state in `_ayb_migrations` with `app_id = 'timely'`.
- Runs are **ephemeral**: never persist in-progress timer state.
- Done state must be acknowledged before releasing the wake lock / keep-alive
  audio.
- Drop placement and the insertion indicator must read from the same
  pointer-vs-midpoint value (`dropsAfter`).
