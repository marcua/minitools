# Socialite PWA - Developer Guide

An experiment: Bluesky (AT Protocol) and Mastodon (ActivityPub) are
decentralized, but reading them usually still goes through a big aggregator
(the Bluesky AppView) or your home instance's copy of everyone's posts. On the
**read path**, Socialite makes your browser the aggregator. Give it your handle;
it reads your public follow list, then polls each person's own server (their
PDS, or their Mastodon instance) and stores the posts in your ayb database. No
login to Bluesky or Mastodon is needed, only ayb.

Think of it as an RSS reader for social accounts: it polls respectfully while
the app is open and shows one linear timeline across all your accounts and
services.

## Architecture Overview

`index.html` holds all markup, CSS, and logic. `sw.js` caches the app shell.
There is no build step. The JS is organized in layers:

| Layer | What it does |
|-------|--------------|
| `Net` | The only path to remote servers. Per-host concurrency cap (2), minimum gap between requests (250ms), request timeout, and back-off on `429` / nearly exhausted `RateLimit-*` / `X-RateLimit-*` budgets. |
| `ATP` | AT Protocol identity and repo reads: handle → DID → DID document → PDS, `listRecords`, `getRecord`, blob URLs. Caches identities per DID. |
| `Services` | One adapter per network (`bluesky`, `mastodon`). Converts that network into the shared data model. |
| `Store` | All ayb SQL. |
| `Poller` | Decides who to check next, runs a few polls at a time, buffers results, flushes to ayb in batches. |
| `App` | Screens, rendering, routing, settings. |

Routes: empty hash = timeline, `#accounts`, `#sources` (everyone you follow,
with poll status and errors).

## Data Model

```sql
accounts (id, service, handle, remote_id, config, follows_count, follows_synced_at, created_at)
sources  (id, service, handle, display_name, avatar_url, profile_url, endpoint, cursor,
          last_polled_at, next_poll_at, last_post_at, error, error_count, created_at)
follows  (account_id, source_id, created_at)          -- PK (account_id, source_id)
posts    (id, service, source_id, kind, url, author_id, author_handle, author_name,
          author_avatar, author_url, html, content_warning, media, embed,
          reply_to, reply_to_author, published_at, sort_at, fetched_at)
_ayb_migrations (app_id, version, applied_at)
```

- **accounts** are *your* identities, one per service account. `config` is
  adapter JSON (`{pds}` for Bluesky, `{host, accountId}` for Mastodon).
- **sources** are the people you follow, **deduplicated across accounts**.
  `id` is `<service>:<remote id>` (`bluesky:did:plc:…`,
  `mastodon:user@domain`). `endpoint` and `cursor` are adapter-owned JSON.
  `next_poll_at` is epoch milliseconds; other times are ISO strings.
- **follows** joins accounts to sources. Resyncing an account rewrites its rows.
  The timeline only shows posts whose `source_id` is in `follows`, so
  unfollowing someone (or removing an account) hides them immediately.
- **posts** is the unified timeline. `id` is `<service>:<uri>`.
  - `source_id` is who put the post in your feed. For a repost/boost that's the
    reposter, while `author_*` describe the original author.
  - `kind` is `post`, `reply`, or `repost`.
  - `sort_at` is when it entered your feed (the repost time for reposts),
    clamped so future-dated posts can't pin themselves to the top.
  - `html` is display HTML (Mastodon content, or Bluesky text with facets
    rendered as links). It is **sanitized again at render time**.
  - `media` is JSON `[{type: image|video|gifv|audio, url, thumb?, alt}]`.
  - `embed` is JSON: `{type: 'link', url, title, description, image}` or
    `{type: 'quote', url, authorName, authorHandle, authorAvatar, html, media, publishedAt}`.
  - `reply_to_author` is the source-style id of the person being replied to.
    It powers the "replies to people I follow" filter, and `reply_to_author =
    source_id` marks self-threads, which always show.
- Posts older than the retention setting are pruned on startup and never
  inserted.

## Service Adapters

Adding a network (e.g. following X/Twitter accounts through a scraper) means
adding an entry to `Services`. Nothing outside the adapter knows about
specific networks. An adapter provides:

```
id, label, placeholder
resolveAccount(input)   -> { handle, remoteId, config }
fetchFollows(account)   -> [{ id, handle, displayName, avatarUrl, profileUrl, endpoint }]
mergeEndpoint(old, new) -> endpoint to keep when a follow list resyncs
pollHost(source)        -> host the next poll will hit (the poller skips busy/blocked hosts)
poll(source, ctx)       -> { posts, cursor, endpoint, profile }
```

`ctx.cutoff` is the oldest `sort_at` worth keeping. Posts use the `posts`
table's columns in camelCase (see `Store.insertPosts`). Add a `.svc-dot.<id>`
color in the CSS for the new service.

### Bluesky (AT Protocol)

- **Your account:** handle → DID via a DNS TXT record (`_atproto.<handle>`,
  queried with DNS-over-HTTPS at `dns.google`), then
  `https://<handle>/.well-known/atproto-did`, then `bsky.social`'s
  `resolveHandle` as a last resort. DID → DID document via `plc.directory`
  (`did:plc`) or `/.well-known/did.json` (`did:web`) gives the PDS.
- **Follows:** `com.atproto.repo.listRecords` for `app.bsky.graph.follow` on
  your PDS, 100 per page.
- **Each person:** their DID document (cached 3 days) points at their PDS. Each
  poll calls `listRecords` for `app.bsky.feed.post` and `app.bsky.feed.repost`.
  The display name and avatar come from their `app.bsky.actor.profile/self`
  record, refreshed daily.
- **Cursor:** `{post, repost}` record keys. Record keys are time-sortable TIDs,
  so a poll keeps only records newer than the cursor and pages back (up to 3
  pages) if a whole page is new.
- **Reposts and quotes** need the original record from the original author's
  PDS. They're capped per poll (12 reposts, processed oldest first with the
  cursor resuming after the last one handled; 8 quote lookups, after which a
  quote renders as a plain link). Strangers' identities are cached in
  `localStorage` (`socialite_atp_cache`, most recent 2,000).
- **Images, video, and avatars** load straight from the PDS with
  `com.atproto.sync.getBlob`, not the Bluesky CDN. They're full-size originals,
  so they're lazy-loaded.
- Web links (post timestamps, mentions, hashtags) point at `bsky.app`.

### Mastodon

- **Your account:** `@you@instance` → `GET /api/v1/accounts/lookup` on your
  instance.
- **Follows:** `GET /api/v1/accounts/:id/following?limit=80`, following the
  `Link: rel="next"` header. Works without auth unless you hide your follows.
- **Each person:** reads `GET /api/v1/accounts/:id/statuses` from **their own
  server** (the host of their profile URL), after a one-time `lookup` there to
  learn their local id. `since_id` makes later polls incremental. The cursor is
  `{host, id}` because ids are per server.
- **Fallback:** if their server doesn't speak the Mastodon API (Threads,
  Misskey, micro.blog, bridges) or refuses anonymous reads, Socialite reads your
  home instance's copy instead. A clear `4xx` switches right away, while a
  network/CORS failure (often a rate limit the browser can't read) only
  switches after 3 in a row. Direct reads are retried weekly. These people show
  a "via <home>" tag on the Following screen.
- Boosts become `repost`s, Mastodon 4.5 quote posts and preview cards become
  `embed`s, custom emoji are inlined, and `spoiler_text` becomes a collapsible
  content warning.

## Poller

- Runs every second while the app is open. It picks the most overdue followed
  sources and starts up to 6 polls at once, skipping any whose host is busy or
  backing off.
- The next poll is scheduled adaptively from the base interval (setting, default
  15 min). People who posted in the last day get the base interval, in the last
  week 2×, in the last month 4×, otherwise 8×, capped at 6h, with ±10% jitter.
- Errors back off exponentially (capped at a day) and show on the Following
  screen. A `429` reschedules after the host's back-off window without counting
  as the person's error.
- Results are buffered: `Poller.flush()` runs about every 3s and writes posts
  (`INSERT OR IGNORE`, 25 per statement) and source state (an upsert, 50 per
  statement) concurrently.
- Follow lists resync on startup if they're older than 12 hours, or with
  **Resync** on the Accounts screen.
- The refresh button re-queues everyone not checked in the last 2 minutes.

## Timeline

- Paged from ayb, 40 at a time, keyset-paginated on `(sort_at, id)`, with
  infinite scroll.
- After each flush the app counts posts newer than the top of the current view.
  At the top of the page it reloads in place (at most every 8s); otherwise it
  shows an "N new posts" pill.
- Filter chips (shown when you have 2+ accounts) narrow the timeline to one
  account's follows. Settings (stored per device in `localStorage`) cover the
  poll interval, the replies filter, reposts on/off, and retention.

## Gotchas & Patterns

### 1. Service Worker Caching
**MUST bump `CACHE_NAME` in `sw.js` after every change** (e.g. `socialite-v1` →
`socialite-v2`). The worker only handles same-origin assets and the ayb client
script. Everything else, including every PDS/instance request, must bypass it
so polls never see a cached answer.

### 2. SQL
Use `sqlVal()` for every literal: it handles `NULL`, numbers, JSON objects, and
quotes strings with `AybClient.escapeSQL`. Numeric ids that come from our own
state are interpolated as numbers.

### 3. Batch, don't loop
Never `await ayb.query()` inside a loop over rows. Inserts and upserts are
chunked multi-row statements fired with `Promise.all`.

### 4. Untrusted remote content
Everything from a PDS or instance is untrusted. `sanitizeHtml()` rebuilds HTML
from an allowlist (links must be http(s) and open in a new tab, and the only
images kept are custom emoji). `escapeHtml()` escapes quotes so it's safe in
attributes. `safeUrl()` gates every `href`/`src`.

### 5. Politeness
Never bypass `Net`. Keep per-poll request counts bounded: a steady-state
Bluesky poll is 2 requests, and a Mastodon poll is 1.

### 6. Migrations
Add to the `socialiteMigrations` array and run via
`runMigrations(ayb, 'socialite', socialiteMigrations)`.

### 7. Authentication
OAuth via `restoreOAuth({ appName: 'Socialite', ... })`; credentials live under
`ayb_Socialite`. Never clear credentials on a connection failure; show the error
screen with a retry.

## Known Limits

- Deleted or edited posts aren't updated after they're stored.
- Only *public* posts and *public* follow lists are visible (by design, until
  there's a write/auth path).
- The same post can appear more than once if several people you follow repost
  it, and people bridged across networks (e.g. Bridgy Fed) can show up twice.
- Polling only happens while a tab is open.

## Future Directions

- **Write path:** authenticate per account (atproto OAuth / Mastodon OAuth) and
  post through each service. `accounts.config` is where tokens or session info
  would go.
- **Streaming:** Mastodon's streaming API needs auth for user timelines, and a
  PDS firehose (`com.atproto.sync.subscribeRepos`) carries every repo on that
  host, so polling is the honest option for now. Relays and Jetstream can filter
  by DID, but they reintroduce an aggregator.
- **Background fetching:** a scheduled worker that polls while the app is
  closed.
- **More services:** X/Twitter via scrapers, RSS/Atom feeds, and Threads are all
  just new `Services` adapters.
