# Streaks PWA - Developer Guide

## Architecture Overview

Single-file PWA at `index.html` with a service worker at `sw.js`. Uses the [@aybdb/client](https://www.npmjs.com/package/@aybdb/client) library (loaded via jsDelivr CDN) for OAuth authentication and database queries via the ayb REST API. Tracks daily, weekly, and monthly habits with GitHub-style heatmap visualizations.

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

### Goals CRUD
- `getGoals(includeArchived)` - fetches goals, optionally including archived
- `createGoal(name, frequency)` - adds new goal with position
- `updateGoal(id, name, frequency)` - updates existing goal
- `archiveGoal(id)` / `unarchiveGoal(id)` - soft delete/restore
- `reorderGoals(orderedIds)` - updates position for drag-and-drop

### Completions CRUD
- `getCompletionsForDate(dateStr)` - fetches completions for a specific day
- `toggleCompletion(goalId, dateStr, note)` - creates or deletes completion
- `updateCompletionNote(goalId, dateStr, note)` - updates note on completion
- `getCompletionsForYear(year)` - fetches all completions for heatmap
- `getYearsWithData()` - returns years that have completion data

### Screen Management
- `showScreen(screenId)` - switches between `setup-screen`, `error-screen`, `main-screen`, `goals-screen`, `year-screen`
- Hash-based routing: `#goals` for management, `#year/{year}` for historical view

## Database Schema

```sql
goals (id, name, frequency, position, archived, created_at, updated_at)
completions (id, goal_id, date, note, checked, created_at, updated_at)
_ayb_migrations (app_id, version, applied_at)
```

- `frequency` is CHECK constrained to: `'daily'`, `'weekly'`, `'monthly'`
- `completions.date` stores UTC date string (YYYY-MM-DD)
- Unique constraint on `(goal_id, date)` prevents duplicate completions

## Streak Visualization

### Heatmap Grid
- **Daily**: 7-row CSS grid (days of week) × ~53 columns (weeks), like GitHub contributions
- **Weekly**: 52 cells in a flex row
- **Monthly**: 12 cells in a flex row

### Cell States
- `.filled` - completed (teal background)
- `.missed` - past, not completed (dashed border)
- `.future` - upcoming (dashed border, no fill)
- `.today` - current day (teal ring highlight)
- `.placeholder` - padding cells before Jan 1

### Cell Sizing
- Desktop: 8×8px cells, 2px gap
- Mobile (<480px): 4×4px cells, 1px gap (fits ~54 columns)

## Gotchas & Patterns

### 1. Service Worker Caching
**MUST bump `CACHE_NAME` in `sw.js` after every change** (e.g., `streaks-v16` → `streaks-v17`). Users won't see changes otherwise.

### 2. SQL String Escaping
- Use `AybClient.escapeSQL(str)` for user input in queries (escapes single quotes, handles null/undefined)
- Use `escapeHtml(str)` for display

### 3. Timezone Handling
- `completions.date` stored as UTC but represents local date
- `localToUTC(dateStr)` - converts local date string to UTC for storage
- `getLocalDate(date)` - formats Date object as local YYYY-MM-DD
- `parseLocalDate(dateStr)` - parses YYYY-MM-DD as local Date

### 4. Date Navigation
- `currentDate` state variable tracks selected day
- Date picker and prev/next arrows update this
- `getDayOfWeek(dateStr)` returns uppercase day name for header

### 5. Migrations
- Add new migrations to the `streaksMigrations` array (top of script)
- Migrations are run via `runMigrations(ayb, 'streaks', streaksMigrations)` from @aybdb/client
- State tracked in `_ayb_migrations` table with `app_id = 'streaks'`
- Migrations are idempotent - errors for "duplicate column" or "already exists" are caught
- Corrupted state (version > migrations.length) throws an error

### 6. Authentication
- Uses OAuth 2.0 with PKCE via @aybdb/client `AybOAuth` class
- `restoreOAuth()` at startup handles both OAuth callback and session restore
- `createServerSelectionModal()` shows server picker for new connections
- Credentials stored in localStorage under key `ayb_Streaks`
- Never clear credentials on connection failure; show error screen with retry instead

### 7. Modal Pattern
```javascript
showModal('goal-modal');
hideModal('goal-modal');
// Modals use .modal-overlay.active class
```

### 8. Drag and Drop
- Desktop: native HTML5 drag events
- Mobile: touch events with long-press activation (400ms)
- Updates `position` column in database via `reorderGoals()`

### 9. Note Display
- Notes support basic markdown: `[text](url)` and bare URLs
- `renderMarkdown(text)` converts to clickable links
- Notes appear below completed items, clickable to edit

## Common Workflow

1. Make changes to `index.html`, `icon.svg`, or `manifest.json`
2. Bump cache version in `sw.js`
3. Commit and push to feature branch
4. User refreshes twice (first loads new SW, second activates it)

## Style Guidelines ("Field Notes" Design System)

### Color Palette
```css
--paper: #FAFBFC        /* Primary background */
--paper-warm: #F6F5F3   /* Alternate background */
--surface: #FFFFFF      /* Cards, elevated elements */
--border: #E1E4E8       /* Subtle borders */
--ink: #1B2631          /* Primary text */
--ink-secondary: #57606A /* Secondary text */
--ink-muted: #8B949E    /* Tertiary text */
--signal: #0D9488       /* Primary accent (teal) */
--warm: #D97706         /* Secondary accent (amber) */
--danger: #DC2626       /* Destructive actions */
```

### Typography
- **Outfit** - headings (geometric, friendly)
- **DM Sans** - body text (clean, legible)
- **JetBrains Mono** - dates, stats, frequencies (data feel)

### Button Classes
- `.btn` - primary (teal)
- `.btn.btn-secondary` - ghost style (transparent with border)
- `.btn.btn-danger` - destructive (red)
- `.btn-small` - reduced padding for inline actions

### Component Patterns
- Cards: white background, subtle border, small shadow
- Completed items: left border accent (3px teal), light teal background
- Frequency labels: uppercase, letter-spaced, monospace, muted color
- Empty states: centered icon + title + description + CTA button
