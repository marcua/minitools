# Todos PWA - Developer Guide

## Architecture Overview

Single-file PWA at `index.html` with a service worker at `sw.js`. Uses the [@aybdb/client](https://www.npmjs.com/package/@aybdb/client) library (loaded via jsDelivr CDN) for OAuth authentication and database queries via the ayb REST API.

## Key Components

### @aybdb/client Library - Database and auth layer
- `ayb` (global) - `AybOAuth` instance created via `restoreOAuth()` at startup
- `ayb.query(sql)` - executes SQL against ayb API
- `ayb.isConnected()` / `ayb.getConnectionInfo()` - connection state
- `ayb.disconnect()` - clears saved credentials
- `AybClient.escapeSQL(str)` - static method for SQL string escaping
- `restoreOAuth(options)` - restores OAuth session or handles callback
- `createServerSelectionModal(options)` - shows server selection UI for OAuth
- `runMigrations(client, appId, migrations)` - runs schema migrations with version tracking in `_ayb_migrations` table

### App Object - UI and business logic
- `App.init()` → `restoreOAuth()` → `tryConnect()` → `handleRoute()` → `loadLists()` or `openList()`
- Hash-based routing: `#list/{id}` for todo lists
- `showScreen(name)` - switches between `setup`, `error`, `lists`, `todo` screens

## Database Schema

```sql
todo_list (id, name, position)
todo_list_item (id, list_id, title, notes, position, completed, completed_at,
                remind_at, recurrence_type, recurrence_value, parent_id,
                created_at, updated_at)
_ayb_migrations (app_id, version, applied_at)
```

## Recurring Todos Model

- **Template**: item with `recurrence_type` set, `parent_id = NULL`
- **Spawned copy**: item with `parent_id` pointing to template
- Templates with `completed = 1` are skipped (won't spawn new todos)
- Supports multiple values: monthly `1, 15` or yearly `Jan 1, Jul 4`

### When the check runs

`processRecurrences()` used to run on *every* `loadTodos()`, including every
toggle and add — two round-trips of latency each time. It now runs at most once
per list per local day, gated by `processRecurrencesIfDue()`:

- `recurrencesCheckedFor` maps `listId` → local date string.
- It is **in memory only, deliberately**. A cold app open (including restoring
  the last list from `todos_last_hash` without navigating) always re-checks.
- A `visibilitychange` handler calls `handleAppVisible()`, so an installed PWA
  left open across midnight re-checks when it returns to the foreground. Same
  day, it issues no queries at all.
- `invalidateRecurrenceCheck()` forces a re-check after edits that can make a
  template due today: saving a schedule, or un-completing a template.

All templates are checked with one `parent_id IN (...)` query instead of one per
template, and all of a day's copies are spawned in one multi-row `INSERT`.

## Gotchas & Patterns

### 1. Service Worker Caching
**MUST bump `CACHE_NAME` in `sw.js` after every change** (e.g., `todos-v15` → `todos-v16`). Users won't see changes otherwise.

### 2. SQL String Escaping
- Use `AybClient.escapeSQL(str)` for user input in queries (escapes single quotes, handles null/undefined)
- Use `this.escapeHtml(str)` for display

### 3. Timezone Handling
- `remind_at` stored as UTC but represents local midnight
- When saving: `new Date(year, month-1, day, 0, 0, 0).toISOString()`
- When parsing: `new Date(value + 'Z')` to interpret as UTC

### 4. Date Comparisons
- `todayStart` for SQL: `new Date(y, m, d).toISOString().slice(0, 19).replace('T', ' ')`
- Compare Date objects directly in JS (they compare as UTC timestamps)

### 5. Migrations
- Add new migrations to the `todoMigrations` array (top of script)
- Migrations are run via `runMigrations(ayb, 'todos', todoMigrations)` from @aybdb/client
- State tracked in `_ayb_migrations` table with `app_id = 'todos'`
- Migrations are idempotent - errors for "duplicate column" or "already exists" are caught
- Corrupted state (version > migrations.length) throws an error

### 6. Authentication
- Uses OAuth 2.0 with PKCE via @aybdb/client `AybOAuth` class
- `restoreOAuth()` at startup handles both OAuth callback and session restore
- `createServerSelectionModal()` shows server picker for new connections
- Credentials stored in localStorage under key `ayb_Todos`
- Never clear credentials on connection failure; show error screen with retry instead

### 7. Modal Pattern
```javascript
this.showModal(`
    <h2>Title</h2>
    <div class="modal-actions">
        <button class="btn btn-secondary" onclick="App.someAction()">Secondary</button>
        <button class="btn" onclick="App.primaryAction()">Primary</button>
    </div>
`);
```

### 8. CSS Button Classes
- `btn` - primary (copper colored)
- `btn btn-secondary` - secondary (gray)
- `btn btn-danger` - destructive (red)

### 9. Todo Item Rendering
- `renderTodos()` categorizes into: scheduledTodos, activeTodos, completedTodos
- `renderTodoItem(todo, index, type)` - type is 'active', 'upcoming', 'recurring', or 'completed'
- Completed items are paginated (100 at a time)

### 10. Drag and Drop
- Works via touch events for iOS compatibility
- Updates `position` column in database (one statement, not one per item)
- Both todo items and lists support reordering

**Drop placement is decided by pointer position, not drag direction.**
`dropsAfter(target, clientY)` compares the pointer against the target's vertical
midpoint; `showDropIndicator()` draws the insertion line on that same edge
(`drag-over-above` / `drag-over-below`), and `placeAtIndicator()` inserts on the
side the line showed. All four paths — todo mouse, todo touch, list mouse, list
touch — go through these helpers.

Deciding by direction instead (`draggedIndex < targetIndex ? after : before`)
while always drawing the line above the target is what made a downward drag land
one slot too low. Keep the indicator and the insertion rule reading from the same
value, or the bug comes back.

## Performance Instrumentation

The `Perf` object (top of the script, above `App`) times every interaction that
touches the list. It is **off by default**; turn it on from Settings (lists
screen → gear icon) or with `Perf.enable()` in the console. The setting is
stored in `localStorage` under `todos_perf`.

When on:

- `Perf.instrument(ayb)` wraps `ayb.query()`, so every round-trip is timed —
  including the ones inside `processRecurrences()` and `updatePositions()`.
  Wrapping is permanent but inert while disabled, so toggling needs no reload.
- Each interaction (`toggle`, `add`, `delete`, `duplicate`, `save-edit`,
  `toggle-check`, `save-schedule`, `reorder`, `search`, `load`, `open-list`) is
  timed in five segments: `captureNotesState`, `processRecurrences`,
  `query:items`, `renderTodos`, `restoreNotesState` — plus `paint`.
- Totals are measured across two `requestAnimationFrame`s, so browser layout and
  paint show up instead of hiding behind our JS.
- Results go to the console (`console.table`) and to an on-screen overlay — the
  app usually runs as an installed PWA where there is no console. The overlay is
  collapsed to one line; tap it to expand.

Useful entry points:

- `Perf.report()` — JSON of the last 25 interactions
- `Perf.copyReport()` — same, to the clipboard (the overlay's "Copy report" button)
- `Perf.runs` — raw timing records
- `Perf.clear()` / `Perf.disable()`

### Interpreting the numbers

The console summary splits wall time three ways:

```
toggle 243ms · queries 236ms (3) · js 5ms · paint 2ms · activeRows=34 ...
```

- **queries** high → round-trips dominate. Measured against a real ayb server,
  every query costs the same ~120ms whether it returns 1 row or 101, so what
  matters is the number of *sequential* round-trips, not rows or payload size.
  Queries issued together via `Promise.all` cost one wait, not several. This is
  the usual answer.
- **js / paint** high → the re-render dominates. `renderTodos()` rebuilds every
  item's HTML (including its hidden edit form, textarea, notes preview and
  timestamps — roughly 4.7 KB per item) and reassigns `innerHTML` for all three
  sections on every mutation. `rendered` and `domNodes` show how big that gets.
  At a few hundred items this is tens of milliseconds; it only starts to matter
  in the high hundreds. If it ever does, re-split `renderTodos` into per-section
  string-building and `innerHTML` spans to see which half is at fault.
- `.todo-item` carries `animation-delay: index * 30ms`, so the list keeps
  animating for `30ms × item count` after a re-render. That is invisible in
  these numbers but visible on screen.

### Current round-trip budget

A "wave" is one latency wait; queries fired together in a `Promise.all` share one.

| Interaction | Sequential waves |
|---|---|
| Toggle / delete / add | 2 (the write, then the reads in parallel) |
| Reload, same day | 1 |
| Drag reorder, todos or lists | 1, regardless of item count |
| Cold open, nothing due | 2 |
| Cold open that spawns recurrences | 4 |
| Duplicate | 4 — still `SELECT`, then shift, then insert, then reload |
| Save schedule | 2, plus a recurrence re-check it deliberately forces |

Mutations still reload the whole list rather than patching the changed item in
place; that reload is what the last wave pays for. Collapsing `duplicateTodo()`
into a single `INSERT ... SELECT` (plus its position shift) would take it from
four waves to three.

## Common Workflow

1. Make changes to `index.html`
2. Bump cache version in `sw.js`
3. Commit and push to feature branch
4. User refreshes twice (first loads new SW, second activates it)

## Style Guidelines

- Sentence case for UI text ("Connection failed" not "Connection Failed")
- Paper & Ink aesthetic with CSS variables (`--ink`, `--ink-light`, `--paper`, `--accent`)
- Primary action button on the right, secondary on left
