# Minitools

A collection of tiny, client-side web tools. Everything runs in the browser, is
privacy-friendly, and avoids build steps / backend servers wherever possible.
Published at <https://marcua.net/minitools/>; source at
<https://github.com/marcua/minitools>.

## Repo Conventions

- **Single-file tools.** Most tools are one `index.html` containing markup, CSS,
  and JS. Keep logic inline unless a tool already has a build step.
- **No bundlers / no npm install for most tools.** Libraries are loaded from a
  CDN (e.g. `@aybdb/client` via jsDelivr). Don't add tooling casually.
- **Client-side only.** Never introduce a server dependency unless the tool is
  explicitly backend-backed (currently only `todos/` and `streaks/`, which talk
  to the ayb REST API).
- **Privacy-first.** Secrets (e.g. OpenAI keys in `rich/`) stay in the browser.
- **Video assets are not checked in.** `*.mp4` is gitignored; keep screenshots
  as `*.gif`.
- `export.sh` tars the tracked repo (excluding `.gitignore`, `export.sh`, and
  `*.mp4`) into the personal website output directory. It is not tracked.

## Tool Index

| Tool | Path | What it is | More docs |
|------|------|------------|-----------|
| Todos | `todos/` | Todo PWA with recurring tasks, reminders, drag-and-drop; syncs to ayb database | `todos/README.md`, `todos/CLAUDE.md` |
| Streaks | `streaks/` | Habit/streak tracker PWA with GitHub-style heatmaps; ayb database backend | `streaks/README.md`, `streaks/CLAUDE.md` |
| Timely | `timely/` | Step-by-step routine timer with synthesized chimes; ayb database backend | `timely/README.md`, `timely/CLAUDE.md` |
| Duck Time | `ducktime/` | Visual timer with presets and a duck-quack alert | — (see `index.html`) |
| Review | `review/` | Bookmarklet that extracts GitHub PR review comments as Markdown for pasting into a coding agent | `review/README.md` |
| Rich | `rich/` | Client-side CSV enrichment using the OpenAI API | `rich/README.md` |
| Figmimic | `figmimic/` | Bookmarklet that copies any web page into Figma as editable layers | — (see `index.html`) |
| Checkmate | `checkmate/` | Checklist gate before visiting a distracting site | `checkmate/README.md` |
| Playa | `playa/` | Beach-themed tool (untracked/local) | — (see `index.html`) |
| Staging | `_staging/` | Scratch space for work in progress | — |

The landing page `index.html` links to every published tool and holds their
short marketing descriptions.

## Working in This Repo

- **Per-tool instructions live in the tool's own directory.** `todos/CLAUDE.md`
  and `streaks/CLAUDE.md` contain important per-project rules (service-worker
  cache bumping, SQL escaping, etc.). Start your agent session inside the tool
  directory, or read that file before editing, so those instructions load.
- **The two ayb-backed PWAs share critical gotchas:**
  - Always bump `CACHE_NAME` in the tool's `sw.js` after changing its
    `index.html`, or users won't see updates.
  - Use `AybClient.escapeSQL()` (static method) for all SQL string escaping.
  - Never `await ayb.query()` inside a loop over rows. Batch into one statement or
    fire the queries concurrently with `Promise.all`.
  - The global `ayb` variable is the `AybOAuth` instance; use `ayb.query()`.
  - Migrations run via `runMigrations(ayb, '<name>', <name>Migrations)` and track
    state in the `_ayb_migrations` table.
- **`review/` has a build step.** Edit `review/bookmarklet.src.js`, then run
  `python3 build.py` from inside `review/` to regenerate `review/index.html`
  with the minified bookmarklet.
- **Verify changes by opening the relevant `index.html` in a browser.** There is
  no test suite.
