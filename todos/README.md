# Todos PWA - Developer Guide

## Architecture Overview

Single-file PWA at `index.html` with a service worker at `sw.js`. Uses an external ayb database via REST API.

## Key Components

### DB Object - Database abstraction
- `DB.config` - stored credentials (baseUrl, entity, database, token)
- `DB.query(sql)` - executes SQL against ayb API
- `DB.saveConfig(url, token)` - parses URL and saves to localStorage
- `DB.runMigrations()` - runs schema migrations with version tracking

### App Object - UI and business logic
- `App.init()` → `tryConnect()` → `handleRoute()` → `loadLists()` or `openList()`
- Hash-based routing: `#list/{id}` for todo lists
- `showScreen(name)` - switches between `setup`, `error`, `lists`, `todo` screens

## Database Schema

```sql
todo_list (id, name, position)
todo_list_item (id, list_id, title, notes, position, completed, completed_at,
                remind_at, recurrence_type, recurrence_value, parent_id,
                created_at, updated_at)
_migrations (version)
```

## Recurring Todos Model

- **Template**: item with `recurrence_type` set, `parent_id = NULL`
- **Spawned copy**: item with `parent_id` pointing to template
- `processRecurrences()` runs on list load, spawns copies for today
- Templates with `completed = 1` are skipped (won't spawn new todos)
- Supports multiple values: monthly `1, 15` or yearly `Jan 1, Jul 4`

## Gotchas & Patterns

### 1. Service Worker Caching
**MUST bump `CACHE_NAME` in `sw.js` after every change** (e.g., `todos-v15` → `todos-v16`). Users won't see changes otherwise.

### 2. SQL String Escaping
- Use `this.escapeSQL(str)` for user input in queries (escapes single quotes)
- Use `this.escapeHtml(str)` for display

### 3. Timezone Handling
- `remind_at` stored as UTC but represents local midnight
- When saving: `new Date(year, month-1, day, 0, 0, 0).toISOString()`
- When parsing: `new Date(value + 'Z')` to interpret as UTC

### 4. Date Comparisons
- `todayStart` for SQL: `new Date(y, m, d).toISOString().slice(0, 19).replace('T', ' ')`
- Compare Date objects directly in JS (they compare as UTC timestamps)

### 5. Migrations
- Add new migrations to the `migrations` array in `DB.runMigrations()`
- Migrations are idempotent - errors for "duplicate column" or "already exists" are caught
- Auto-repair logic resets if `version > migrations.length`

### 6. Credential Preservation
- Never clear localStorage on connection failure
- Show error screen with retry option instead
- Only clear old credentials on successful new connection

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
- Updates `position` column in database
- Both todo items and lists support reordering

## Common Workflow

1. Make changes to `index.html`
2. Bump cache version in `sw.js`
3. Commit and push to feature branch
4. User refreshes twice (first loads new SW, second activates it)

## Style Guidelines

- Sentence case for UI text ("Connection failed" not "Connection Failed")
- Paper & Ink aesthetic with CSS variables (`--ink`, `--ink-light`, `--paper`, `--accent`)
- Primary action button on the right, secondary on left
