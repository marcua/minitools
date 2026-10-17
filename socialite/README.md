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
| `HostFeeds` | One request that covers everyone you follow on a server (Mastodon local timelines, small-PDS revision lists). |
| `Live` | Opt-in realtime for Bluesky over Jetstream, including deletions. |
| `Leader` | Web Locks election so only one open tab polls. |
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
          reply_to, reply_to_author, published_at, sort_at, fetched_at, arrived_at)
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
- **Each person:** their DID document (cached 3 days) points at their PDS.
  - **First poll** (and fallback): `listRecords` for `app.bsky.feed.post` and
    `app.bsky.feed.repost`, plus `getLatestCommit` to note the repo revision.
  - **Every poll after that is one request:** `com.atproto.sync.getRepo?since=<rev>`
    returns a CAR file of everything written since that revision. `Car`
    (a small CAR + DAG-CBOR decoder) walks the repo's Merkle Search Tree from
    the new commit, following only the nodes included in the diff, and yields
    the created or changed records with their paths. Posts, reposts, and profile
    changes all come from that one response, and an unchanged repo costs
    about 60 bytes. Diffs don't include deletions. Revisions older than 2 days
    use listings instead, to keep responses bounded. A diff hydrates at most the
    20 newest reposts.
  - **Profiles** (display name and avatar) for followed people are only
    refetched when the diff contains `app.bsky.actor.profile/self`. Strangers'
    profiles (reposted or quoted authors) refresh daily.
  - **Originals are fetched once.** Reposted and quoted posts go through
    `ATP.getRecordCached`, an in-memory cache of the 3,000 most recent posts by
    URI that holds promises, so concurrent lookups share a request. Posts seen
    in anyone's listing, diff, or stream are added to it.
- **Handles are verified.** A DID document's `alsoKnownAs` is only a claim.
  It's checked (every 3 days) against the handle's DNS TXT record or
  well-known URL, and a handle that resolves to a different DID shows as
  `handle.invalid`, like in the Bluesky app. Many custom-domain well-known URLs
  don't send CORS headers, so when neither method can be read in a browser, the
  handle stays shown but unverified rather than marked invalid.
  The display name and avatar come from their `app.bsky.actor.profile/self`
  record, refreshed daily.
- **Cursor:** `{post, repost, rev}`: newest record keys plus the last-seen revision. Record keys are time-sortable TIDs,
  so a poll keeps only records newer than the cursor and pages back (up to 3
  pages) if a whole page is new.
- **Reposts and quotes** need the original record from the original author's
  PDS. They're capped per poll (12 reposts, processed oldest first with the
  cursor resuming after the last one handled; 8 quote lookups, after which a
  quote renders as a plain link). Strangers' identities are cached in
  `localStorage` (`socialite_atp_cache`, most recent 2,000).
- **Images and avatars** are stored as `getBlob` URLs on the author's PDS (the
  full-size original). By default (Settings → **Lighter images**), `imageUrl()`
  shows them through Bluesky's image CDN at the size needed instead:
  `avatar_thumbnail` (a 256 KB avatar becomes ~2 KB), `feed_thumbnail`, and
  `feed_fullsize` when you tap through. That's much less data, decoding, and
  battery for you, and less load on people's PDSes. It's a rewrite at render
  time, so turning the setting off shows the originals again. Video always
  comes from the PDS (`preload="none"`).
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
  15 min). People who posted in the last hour get 0.5× (catches threads), in
  the last day 1×, in the last week 2×, in the last month 4×, otherwise 8×.
  Then, if something cheaper covers them, the per-person poll becomes a
  backstop: 8× when Bluesky realtime is connected and 4× when a host feed covers
  them. Hidden tabs use 4×. The cap is 12h, with ±10% jitter. Returning to a
  hidden tab pulls overdue people forward (`Poller.catchUp`).
- Errors back off exponentially (capped at a day) and show on the Following
  screen. A `429` reschedules after the host's back-off window without counting
  as the person's error.
- Results are buffered: `Poller.flush()` runs about every 3s and writes posts
  (`INSERT OR IGNORE`, 25 per statement) and source state (an upsert, 50 per
  statement) concurrently.
- Follow lists resync on startup if they're older than 12 hours, or with
  **Resync** on the Accounts screen.
- The refresh button re-queues everyone not checked in the last 2 minutes.

## Host Feeds (batching per server)

The one real advantage of centralization is amortization: one fetch serves many
readers. `HostFeeds` gets some of that within one reader, since many people you
follow share a server.

- **Mastodon:** `GET /api/v1/timelines/public?local=true` returns the
  server's recent public posts from *all* its local accounts in one request,
  and the ones from people you follow are kept. It omits boosts, most replies,
  and unlisted posts, so per-person polls continue as a 4× slower backstop.
  `min_id` paging walks forward from the cursor, so a busy server makes us fall
  behind rather than skip anything. After 3 overflowing runs in a row the server
  counts as too busy and is retried in a day. Some servers (mastodon.social,
  mastodon.online, …) require login for this endpoint (`422`); those are
  marked unavailable for a day.
- **Bluesky:** a self-hosted PDS (not `*.bsky.network`) with fewer than 1,000
  accounts answers `com.atproto.sync.listRepos` with every repo's revision in
  one request. Only people whose revision moved get polled right away.
- **Cost-neutral by construction:** batching cuts each covered person's own
  polls to a quarter. The batch request spends exactly the freed 3/4 budget
  (`HostFeeds.feedInterval`), never faster than every 2 minutes and never slower
  than the base interval. So batching never adds load; it turns savings into
  latency. With 29 people followed on one server it's checked every 2 minutes;
  with 3 people, roughly every 10.
- Feed state (cursor, availability) is a per-device cache in `localStorage`
  (`socialite_host_feeds`).

## Realtime (Jetstream, opt-in)

Settings → **Realtime Bluesky** opens one WebSocket to Bluesky's
[Jetstream](https://github.com/bluesky-social/jetstream), filtered to the DIDs
you follow (`wantedDids`, up to 10,000) and to posts/reposts.

- New posts arrive within seconds, and **deletions propagate** (polling can't
  see deletes).
- While connected, direct PDS polls drop to an 8× backstop. In testing, a
  17-person Bluesky follow list went from about 90 PDS requests an hour to about
  11.
- The connection resumes from the last seen `time_us` cursor (Jetstream keeps
  roughly a day of backlog), so posts made while the app was closed still
  arrive. It rotates among the public instances on reconnect, with back-off.
- **Never subscribe with an empty `wantedDids`**: Jetstream treats that as
  "everything" (the whole network). `Live.sync()` closes the socket instead.
- Live events never advance polling cursors, so if the stream drops something
  the backstop poll still finds it.
- This is deliberately opt-in. It's the one place Socialite leans on shared
  infrastructure, and Jetstream records arrive without signatures or proofs.

## One Poller per Browser

`Leader` takes a Web Lock (`socialite-poller`). Only the tab holding it polls
or streams. Other tabs read new posts from ayb every 30s and show "another tab
is fetching". Two tabs never double the load on anyone's server.

The **visible tab always takes over**: it opens with `steal: true`, and does so
again whenever it becomes visible. Otherwise a backgrounded or suspended tab
(common on iOS) could keep the lock while barely running, and the tab you're
looking at would never poll. The tab that loses the lock stops polling, flushes
what it has, closes its Jetstream socket, and queues to get the lock back. A tab
that takes over reloads sources from ayb first, so it continues from the
previous leader's cursors instead of redoing work.

This only coordinates tabs in one browser. Two *devices* still poll
independently (see Known Limits).

## Battery

- **Background pause:** a minute after the app is hidden, all fetching stops
  (polling, batch checks, and the realtime stream) via `Leader.sleep()`.
  Returning calls `Leader.wake()` and pulls overdue people forward.
- **Lighter images** (above) is the biggest saving per screen of posts.
- **Minimal redrawing:** the status line redraws only when its text changes,
  and the refresh icon spins only briefly after a tap, rather than animating
  for as long as anything is fetching.
- **Fewer writes:** the diagnostics heartbeat writes to `localStorage` every
  5s, not every second.

## Measuring Load

The Following screen opens with a **Right now** panel that refreshes every 2s
and shows the build number. It lists each check in progress (person, server,
seconds elapsed), each one-per-server batch check that's running, and every
server we're backing off from or queueing on. If the status line says "N
fetching" for long, that link opens this panel.

Stalls can't hold polling slots:
- `Net`'s abort timer also covers reading the body (`Net.read()`).
- A host that has asked us to back off for more than 5s fails requests right
  away with a 429 rather than queueing. The poller reschedules for when the
  back-off ends, without counting it as an error.
- Every check and batch check has a 2-minute deadline (`withDeadline`).

`BUILD` in `index.html` is shown in Settings; bump it along with `CACHE_NAME`.

### Diagnostics and safe mode

- `Diag` keeps the last 40 problems in `localStorage` (`socialite_diag`), and
  the Right now panel shows them: uncaught errors, failed saves, diff
  fallbacks, failed stream events, and any moment the visible page was
  unresponsive for more than 3s.
- A heartbeat (`socialite_diag_beat`) is written every second with what
  synchronous work is in progress (`Diag.during(...)`, e.g. decoding a diff or
  rendering posts). If a session ends without a clean `pagehide`, the next
  load logs where it was.
- Opening the app with `?safe` loads everything but fetches nothing (no
  polling, no stream), so the UI stays usable for reading diagnostics even if
  something in polling is freezing the page.

### Robustness rules

- The CAR/CBOR decoder checks every length against the remaining bytes, caps
  nesting, and never revisits a tree node, so malformed input throws rather
  than looping. Diffs over 5 MB are refused. A diff failure falls back to
  listings and skips diffs for that person for a day (`cursor.noDiffUntil`).
- `Net` queues requests per host in order, with one timer per host and no
  polling waiters.
- Jetstream events go through a queue with 3 workers (at most 2,000 queued).
- Saves are per chunk: only failed chunks are retried, every 15s. A post that
  fails 3 times is dropped (a later poll can bring it back).

`Net` logs every request. The Following screen shows the requests made in the
last hour, plus which servers are batched and whether Bluesky is live. An
initial sync is the expensive part: 158 people took about 820 requests to
backfill, including reposted and quoted originals and identity lookups.

## Timeline

- Paged from ayb, 40 at a time, keyset-paginated on `(sort_at, id)`, with
  infinite scroll.
- **Live arrivals never slip into the middle of the timeline.** Polling means a
  post can arrive long after it was written (a quiet person checked hourly), so
  sorting it by time would bury it where you'd never see it. Instead:
  - Each post gets `arrived_at`, stamped from the client clock when it comes
    from a live poll, host feed, or stream event. Backfill (a person's first-ever
    poll), catch-up (the first poll of people already due when the app opened,
    a host feed's first run, Jetstream replay from before the app opened) gets
    `NULL`. Those posts belong in time order.
  - The timeline (`feed.posts`) is everything as of `feed.loadedAt`.
  - **Nothing appears on its own.** While you read, even at the top, the
    timeline holds still. A bubble at the bottom ("↑ N new posts", above the
    browser toolbar) counts what's waiting. Tapping it scrolls to the top and
    either shows live arrivals in a **New** group above the timeline (newest
    arrival first, "New · N" header, "Earlier" divider, reposts grouped into
    rows) or, for backfill and catch-up posts, reloads the timeline in time
    order. Then it re-counts in case more are waiting.
  - The only exception is an empty timeline (e.g. right after adding an
    account), which fills itself.
  - Reloading (opening the app, changing a filter, or the settings that reload)
    merges everything back into true time order.
- **Repost rows** (Settings → *Group reposts into rows*, on by default). Inspired by
  Phanpy's boosts carousel, which pulls a fetched page's boosts into one
  sideways-scrolling row. `groupFeed()` cuts the time-ordered timeline into
  chunks of 15 posts by people (`REPOST_CHUNK`); each chunk's reposts (not
  quotes) go into one row at the end of that chunk. A post reposted by several
  people becomes one card ("A, B and 2 others reposted"), and a repost of a post
  already shown in full above is skipped. A chunk with a single repost shows it
  as a normal post at the end.
  - Grouping only looks backwards, so loading more never changes chunks already
    on screen: completed chunks are appended to `#feed`, and the unfinished
    last chunk is drawn in `#feed-tail` (posts by people only) until it fills.
  - Deleted or moved-to-New posts are hidden via `feed.removed` instead of being
    spliced out of `feed.posts`, which would shift chunk boundaries.
  - The New group is grouped the same way.
- Filter chips (shown when you have 2+ accounts) narrow the timeline to one
  account's follows. Settings (stored per device in `localStorage`) cover the
  poll interval, the replies filter, reposts on/off, and retention.

## Gotchas & Patterns

### 1. Service Worker Caching
**MUST bump `CACHE_NAME` in `sw.js` after every change** (e.g. `socialite-v1` →
`socialite-v2`). The worker only handles same-origin assets and the ayb client
script. Everything else, including every PDS/instance request, must bypass it
so polls never see a cached answer. The page itself is network-first (cache only when
offline), and the worker's own fetches use `cache: 'reload'`/`'no-cache'`
because the site sends `max-age=600`; otherwise a fresh worker could cache a
stale `index.html` and updates would lag by a load or ten minutes.

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

- Deleted posts are only removed for Bluesky with realtime on. Edits are never
  picked up.
- Only *public* posts and *public* follow lists are visible (by design, until
  there's a write/auth path).
- The same post can appear more than once if several people you follow repost
  it, and people bridged across networks (e.g. Bridgy Fed) can show up twice.
- Polling only happens while a tab is open.
- Each device polls independently. One reader with a phone and a laptop open
  is two readers as far as servers are concerned.

## Tradeoffs and Criticisms

Socialite is an experiment, so here's an honest accounting.

**Technical**

- **Fan-out-on-read scales badly.** One AppView or home server fetches a post
  once for all its readers. Socialite fetches it once *per reader*. If 10,000
  Socialite users follow someone on a small server, that server gets 10,000×
  the polls, all anonymous and indistinguishable from scrapers. (Browsers
  can't set a `User-Agent`, and a custom header would force a CORS preflight on
  every request.)
- **ActivityPub is already push-based and already deduplicated.** Your home
  server receives each post once and shares it with all its users. Reading from
  each author's own server adds load compared with reading from your home
  server. It buys independence from your home admin, not efficiency.
- **Latency vs. politeness is a hard tradeoff for polling.** Host feeds and
  revision checks narrow it, but only streaming closes it, and for Bluesky the
  only practical streams (relay/Jetstream) are shared infrastructure.
- **What you can't build without an index:** notifications and mentions (they
  come from strangers), replies *to* a post, like/repost counts, threads,
  search, discovery. These all need someone to index the whole network. A
  personal reader can only ever be a timeline.
- **Moderation is missing.** Bluesky's labelers and Mastodon admins' domain
  blocks and filters are applied server-side. Socialite shows only self-labels
  and content warnings. Exposure is limited to people you chose to follow and
  what they repost or quote.
- **Trust and verification.** Records from `listRecords` and Jetstream aren't
  checked against repo signatures. The PDS is authoritative anyway, but a
  shared cache or relay would need proofs. Handles are checked, but some can't
  be verified from a browser (CORS).
- **Browser constraints.** Everything depends on servers keeping permissive
  CORS. There's no background polling, and mobile browsers suspend tabs.
  Images default to Bluesky's image CDN (a shared service) for size and
  battery. Turning that off reads full-size originals from each PDS.
- **Deletes and edits.** Without streaming, a deleted post stays in your
  database until retention prunes it.

**Social**

- **Consent and norms.** Fediverse users and admins choose instance-level
  norms: authorized fetch, opting out of search, defederating from bad actors.
  Anonymous direct reads sidestep some of that intent, even though the API is
  public. The fediverse has a history of pushing back hard on
  aggregators/scrapers.
- **Free-riding.** Admins pay to serve their users. Socialite readers add load
  to servers they don't belong to or support.
- **Blocks and deletes.** If someone blocks you, their public posts still show
  here. Keeping deleted posts runs against what people expect when they delete.
- **Moderation shifts to the individual,** which is freeing for some people
  and a burden (or a harassment vector) for others.
- **Who it's for.** It requires running an ayb database, so it's for
  technical users. That's fine for an experiment, but it's not a model for
  everyone.

**Where it lands.** Owning the *read side* (your storage, your ranking, your
filters, your client) is valuable, and it shows that the data really is
portable. Doing all the *transport* yourself is the expensive part, and it's
the part where sharing helps. The atproto design already separates these: a
relay is a shared, neutral fan-out of signed data, while the AppView is the
opinionated index. Using a relay or Jetstream for transport and polling PDSes
only as a backstop keeps most of the independence at a fraction of the load.

## Future Directions

- **Shared, verifiable cache:** readers could pool their fetches (for example
  a shared ayb database of recently polled records) so each server is polled
  once per cooperative rather than once per reader. For atproto, entries would
  need commit proofs (`com.atproto.sync.getRecord` returns a verifiable CAR)
  so peers can't forge posts. Mastodon has no signatures on the API, so a pool
  there means trusting its members.
- **Mastodon streaming** with per-account auth (`wss://…/api/v1/streaming`).
- **Signature verification** of atproto records.

- **Write path:** authenticate per account (atproto OAuth / Mastodon OAuth) and
  post through each service. `accounts.config` is where tokens or session info
  would go.
- **Small-PDS streaming:** `com.atproto.sync.subscribeRepos` on a
  self-hosted PDS carries only that host's handful of repos. It could replace
  polling there, but it needs CBOR/CAR decoding in the browser.
- **Background fetching:** a scheduled worker that polls while the app is
  closed.
- **More services:** X/Twitter via scrapers, RSS/Atom feeds, and Threads are all
  just new `Services` adapters.
