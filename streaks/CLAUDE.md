# Streaks PWA

Single-file PWA habit/streak tracker with ayb database backend.

See [README.md](./README.md) for full developer guide including:
- Architecture and key components
- Database schema
- Streak visualization (heatmap grids)
- Common gotchas (service worker caching, SQL escaping, timezone handling)
- Style guidelines ("Field Notes" design system)

## Critical Reminder

**Always bump `CACHE_NAME` in `sw.js` after any change to `index.html`, `icon.svg`, or `manifest.json`** or users won't see updates.
