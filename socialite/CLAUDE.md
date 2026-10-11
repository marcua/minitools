# Socialite PWA

Single-file PWA that builds one timeline from the people you follow on Bluesky
and Mastodon by reading their posts **directly from their own servers** (PDSes
and Mastodon instances), with an ayb database backend for persistence. Uses the
[@aybdb/client](https://www.npmjs.com/package/@aybdb/client) library (loaded
via jsDelivr CDN) for OAuth authentication and database queries.

See [README.md](./README.md) for the full developer guide including:
- Architecture and the service-adapter interface
- Database schema (`accounts`, `sources`, `follows`, `posts`)
- Poller and per-host politeness (`Net`), host feeds, realtime (Jetstream), tab leader
- Tradeoffs and criticisms of the model
- How each service is read (AT Protocol, Mastodon API) and their fallbacks
- Common gotchas (service worker caching, SQL escaping, HTML sanitizing)

## Key Files

- `index.html` - All app logic (single-file PWA)
- `sw.js` - Service worker for offline caching of the app shell
- `manifest.json`, `icon.svg` - PWA metadata

## Critical Reminders

- **Always bump `CACHE_NAME` in `sw.js` after any change to `index.html`** or
  users won't see updates.
- The service worker must **never** cache cross-origin data requests (PDSes,
  Mastodon servers); only the app shell and the ayb client script.
- Use `sqlVal()` (wraps `AybClient.escapeSQL`) for every SQL literal.
- Batch into one statement or fire concurrently with `Promise.all`; never loop
  `await ayb.query()` over a list of rows. Poll results are buffered and
  flushed in batches by `Poller.flush()`.
- All outbound network calls go through `Net` so per-host concurrency, spacing,
  and rate-limit back-off apply. Don't call `fetch()` directly for remote data.
- All remote HTML goes through `sanitizeHtml()` at render time. Build
  attributes with `escapeHtml()` and URLs with `safeUrl()`.
- Never open Jetstream with an empty `wantedDids`; Jetstream reads that as the
  whole network. `Live.sync()` closes the socket instead.
- Load-reduction features must not add load: host feeds spend only the budget
  they free (`HostFeeds.feedInterval`), and only the `Leader` tab polls.
- Network-specific code lives only in a `Services` adapter. The rest of the
  app works on the normalized post/source shape.
- The global `ayb` variable is the `AybOAuth` instance; use `ayb.query()`.
- Migrations run via `runMigrations(ayb, 'socialite', socialiteMigrations)` and
  track state in `_ayb_migrations` with `app_id = 'socialite'`.
