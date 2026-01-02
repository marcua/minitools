# Todos PWA

Single-file PWA todo app with ayb database backend.

See [README.md](./README.md) for full developer guide including:
- Architecture and key components
- Database schema
- Recurring todos model
- Common gotchas (service worker caching, SQL escaping, timezone handling)
- Style guidelines

## Critical Reminder

**Always bump `CACHE_NAME` in `sw.js` after any change to `index.html`** or users won't see updates.
