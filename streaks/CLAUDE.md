# Streaks PWA

Single-file PWA habit/streak tracker with ayb database backend. Uses the [@aybdb/client](https://www.npmjs.com/package/@aybdb/client) library (loaded via jsDelivr CDN) for OAuth authentication and database queries.

See [README.md](./README.md) for full developer guide including:
- Architecture and key components
- Database schema
- Streak visualization (heatmap grids)
- Common gotchas (service worker caching, SQL escaping, timezone handling)
- Style guidelines ("Field Notes" design system)

## Key Files

- `index.html` - All app logic (single-file PWA)
- `@aybdb/client` - ayb client library loaded from jsDelivr CDN
- `sw.js` - Service worker for offline caching

## Critical Reminders

- **Always bump `CACHE_NAME` in `sw.js` after any change to `index.html`** or users won't see updates.
- Use `AybClient.escapeSQL()` for SQL string escaping (static method from ayb.js).
- The global `ayb` variable holds the `AybOAuth` instance; use `ayb.query()` for database calls.
- Migrations use `runMigrations(ayb, 'streaks', streaksMigrations)` which tracks state in `_ayb_migrations` table.
