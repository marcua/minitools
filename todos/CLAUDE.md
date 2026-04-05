# Todos PWA

Single-file PWA todo app with ayb database backend. Uses the [ayb.js](https://github.com/marcua/ayb) client library for OAuth authentication and database queries.

See [README.md](./README.md) for full developer guide including:
- Architecture and key components
- Database schema
- Recurring todos model
- Common gotchas (service worker caching, SQL escaping, timezone handling)
- Style guidelines

## Key Files

- `index.html` - All app logic (single-file PWA)
- `ayb.js` - Vendored ayb client library (from marcua/ayb PR #743)
- `sw.js` - Service worker for offline caching

## Critical Reminders

- **Always bump `CACHE_NAME` in `sw.js` after any change to `index.html` or `ayb.js`** or users won't see updates.
- Use `AybClient.escapeSQL()` for SQL string escaping (static method from ayb.js).
- The global `ayb` variable holds the `AybOAuth` instance; use `ayb.query()` for database calls.
- Migrations use `runMigrations(ayb, 'todos', todoMigrations)` which tracks state in `_ayb_migrations` table.
