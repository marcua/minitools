# Design Instructions: Streak/Habit Tracker Redesign (Light Version)

## Overview
Redesign this habit tracking application with a sophisticated light interface inspired by scientific journals, oceanographic field notes, and precision instruments. The app has three views: **Daily Check-in** (today's goals), **Progress View** (year heatmaps), and **Goals Management** (edit/archive).

---

## Design Direction: "Field Notes"

Create an aesthetic inspired by a marine researcher's pristine lab notebook — cream paper, precise ink, technical annotations, and occasional pops of color from highlighted data points. Completed habits should feel like successful observations being logged. Clean, bright, but never sterile.

---

## Color Palette (CSS Variables)

```css
:root {
  --paper: #FAFBFC;             /* Primary background - bright but not harsh */
  --paper-warm: #F6F5F3;        /* Warmer alternate background */
  --surface: #FFFFFF;           /* Cards, elevated elements */
  --border: #E1E4E8;            /* Subtle borders */
  --border-strong: #D0D4D9;     /* Emphasized borders */

  --ink: #1B2631;               /* Primary text - deep navy-black */
  --ink-secondary: #57606A;     /* Secondary text */
  --ink-muted: #8B949E;         /* Tertiary, placeholders */
  --ink-faint: #B8BFC6;         /* Disabled states */

  --signal: #0D9488;            /* Primary accent - deep teal (shifted slightly) */
  --signal-light: #0D948815;    /* Signal tint for backgrounds */
  --signal-medium: #0D948830;   /* Signal for borders, highlights */
  --signal-hover: #0B7A70;      /* Darker on interaction */

  --warm: #D97706;              /* Secondary accent - amber */
  --danger: #DC2626;            /* Delete/destructive */
  --success: #059669;           /* Alternative success state */

  --shadow-sm: 0 1px 2px rgba(27, 38, 49, 0.04);
  --shadow-md: 0 2px 8px rgba(27, 38, 49, 0.06), 0 1px 2px rgba(27, 38, 49, 0.04);
  --shadow-lg: 0 8px 24px rgba(27, 38, 49, 0.08), 0 2px 8px rgba(27, 38, 49, 0.04);
}
```

---

## Typography

Use **Outfit** for headings (geometric, friendly) and **DM Sans** for body text (clean, highly legible). Use **JetBrains Mono** for numbers, dates, and statistics to maintain that data-dashboard quality.

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@500;600;700&display=swap');

--font-display: 'Outfit', system-ui, sans-serif;
--font-body: 'DM Sans', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

- **Page titles**: Outfit 600, 1.75rem, `--ink`, letter-spacing: -0.02em
- **Goal names**: DM Sans 500, 1.05rem, `--ink`
- **Frequency labels**: JetBrains Mono 400, 0.7rem, uppercase, letter-spacing: 0.05em, `--ink-muted`
- **Stats/counts**: JetBrains Mono 500, `--signal`
- **Dates**: JetBrains Mono 400, 0.875rem, `--ink`

---

## Layout & Spacing

Light interfaces can be slightly tighter since contrast does the work.

- **Container max-width**: 600px, centered
- **Base unit**: 8px
- **Card padding**: 18px 22px
- **Card gap**: 10px
- **Border radius**: 10px for cards, 6px for buttons, 4px for small elements

---

## Custom SVG Icons

Draw as crisp line icons, 1.5px stroke, round linecap/linejoin. Style should feel like technical illustrations:

1. **Checkbox (unchecked)**: Rounded rectangle with `--border-strong` stroke, no fill
2. **Checkbox (checked)**: Rounded rectangle filled with `--signal`, white checkmark inside (2px stroke)
3. **Calendar**: Minimal outline with two-row dot grid inside
4. **Arrow left/right**: Simple chevrons, `--ink-muted` default, `--signal` on hover
5. **Add/Plus**: Circle outline with plus, or standalone plus sign
6. **Edit**: Minimal pencil, angled
7. **Archive**: Box with downward arrow inside
8. **Unarchive**: Box with upward arrow
9. **Drag handle**: Six dots in 2×3 grid, `--ink-faint`
10. **Flame/streak**: Simple flame outline, filled with `--warm` when active
11. **Note/memo**: Rectangle with lines, corner fold

All icons: inline SVG, `currentColor`, 20px default size.

---

## Component Specifications

### Header / Page Title
- Title left-aligned, generous top margin (48px)
- No background or borders — just typography
- Optional: thin ruled line below (like notebook paper) in `--border`
- Subtitle/date in `--ink-secondary`

### Date Navigation (Daily View)
```
     FRIDAY
  ←  01 / 03 / 2026  →
```
- Day-of-week: tiny, uppercase, `--font-mono`, `--ink-muted`, letter-spaced
- Date: `--font-mono` 500, `--ink`
- Arrows: `--ink-faint` default, `--signal` on hover
- Contained in subtle pill shape with `--paper-warm` background on hover
- Add subtle left/right slide animation when changing dates

### Goal Cards (Daily Check-in)

**Card Container:**
- Background: `--surface` (white)
- Border: 1px solid `--border`
- Border-radius: 10px
- Box-shadow: `--shadow-sm`
- Hover: `--shadow-md`, border-color transitions to `--border-strong`

**Unchecked State:**
- Checkbox: empty rounded square, `--border-strong`
- Text: `--ink`
- Frequency badge: tiny pill, `--paper-warm` background, `--ink-muted` text

**Checked State:**
- Checkbox: filled `--signal` with white checkmark
- Left border accent: 3px solid `--signal` (replaces normal border on left)
- Background: subtle `--signal-light` tint
- Text remains `--ink` (don't grey it out — this is a success!)
- Optional: subtle "logged" timestamp appears in `--ink-muted`

**Card Layout:**
```
┌─────────────────────────────────────────┐
│ [checkbox]  Goal name here              │
│             DAILY                       │
│                                         │
│             Add note...                 │
└─────────────────────────────────────────┘
```

### Expanded Card / Note Field
- Note field appears below goal name when card is selected
- Textarea with `--paper-warm` background, `--border` border
- Placeholder: "Add note..." in `--ink-faint`, italic
- Focus: border becomes `--signal`

### "Edit goals" Link
- Positioned above cards, right-aligned or below title
- Text link style: `--signal`, underline on hover
- No button styling — keep it lightweight

### Progress View (Year Heatmap)

**The Hero Component — make this beautiful:**

**Grid Specifications:**
- Each cell: 11px × 11px with 3px gap
- Border-radius: 2px per cell
- Cells arranged in weeks (columns) × days (rows)

**Cell States:**
- Empty/future: `--border` background (light grey)
- Completed: `--signal` background
- Missed (past, incomplete): `--paper-warm` with dashed border `--border`
- Today: `--signal-medium` border ring (2px), slightly larger

**Visual Hierarchy:**
- Month labels along top: `--font-mono`, 0.65rem, `--ink-muted`, uppercase
- Goal name: `--font-body` 500, `--ink`
- Stat on right: `--font-mono`, `--signal` for numerator, `--ink-muted` for denominator

**Hover Interaction:**
- Cell scales up slightly (1.3×)
- Tooltip appears with date + status
- Tooltip: `--surface` background, `--shadow-md`, small text

**Layout per Goal:**
```
Goal name here                           12/14
┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐
│●│●│●│○│●│●│●│○│●│●│●│●│○│○│ │ │ │ ...
└─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘
```

### Goals Management View

**Page Layout:**
- "← Back to today" link at top, `--signal` color
- "Add goal" button: solid `--signal` background, white text, prominent
- Goal cards in a list below

**Add Goal Button:**
- Background: `--signal`
- Text: white, `--font-body` 500
- Padding: 12px 24px
- Border-radius: 8px
- Hover: `--signal-hover`, subtle lift with `--shadow-md`
- Active: scale 0.98

**Goal Cards (Management Mode):**
- Similar to daily view cards, but with visible actions
- Drag handle on far left (appears on hover on desktop, always visible on mobile)
- Goal name + frequency in center
- "Edit" and "Archive" buttons on right

**Action Buttons:**
- Ghost style: transparent background, `--ink-secondary` text
- Border: 1px solid `--border`
- Hover: `--paper-warm` background
- Small padding: 8px 14px

**Archived Section:**
- Divider line with centered text: "Archived (n)"
- Toggle to show/hide
- Archived cards: reduced opacity (0.5)
- "Unarchive" button instead of "Archive"

---

## Form Elements (Add/Edit Goal)

**Text Input:**
- Background: `--surface`
- Border: 1px solid `--border`
- Border-radius: 6px
- Padding: 12px 14px
- Focus: border-color `--signal`, subtle `--signal-light` box-shadow

**Label:**
- Above input
- `--font-body` 500, 0.85rem, `--ink-secondary`
- Margin-bottom: 6px

**Frequency Selector (Segmented Control):**
```
┌─────────┬─────────┬─────────┐
│  Daily  │ Weekly  │ Monthly │
└─────────┴─────────┴─────────┘
```
- Container: `--paper-warm` background, 1px `--border` border, rounded
- Active segment: `--surface` background with `--shadow-sm`, `--ink` text
- Inactive segments: transparent, `--ink-secondary` text
- Active indicator slides smoothly between options

---

## Micro-interactions & Motion

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-fast: 120ms;
--duration-normal: 200ms;
--duration-slow: 350ms;
```

**Key Animations:**

1. **Page load**: Cards fade in and rise from 10px below, staggered 30ms apart
2. **Checkbox completion**:
   - Checkmark draws in (stroke-dashoffset animation)
   - Background fills with slight scale bounce (0.95 → 1.02 → 1.0)
   - Card's left border accent appears (width: 0 → 3px)
3. **Card hover**: Shadow and border transition over 150ms
4. **Date navigation**: Cards slide out/in horizontally with crossfade
5. **Heatmap load**: Cells fade in row by row, left to right, 10ms stagger
6. **Button hover**: Subtle Y lift (-1px) and shadow increase
7. **Segmented control**: Active background slides with spring easing

---

## Background & Texture

Keep backgrounds clean but not flat:

```css
body {
  background-color: var(--paper);
  background-image:
    radial-gradient(ellipse at 50% -20%, var(--signal-light) 0%, transparent 50%);
}
```

Optional: Add a subtle dot grid pattern reminiscent of lab notebooks:

```css
.page {
  background-image: radial-gradient(var(--border) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 10px 10px;
}
```

Use sparingly — perhaps only on the main container, at very low opacity.

---

## Empty States

When no goals exist:
- Centered illustration: simple line drawing of a clipboard with checkmarks, or a small plant growing
- Drawn in `--border-strong` with one element in `--signal`
- Text: "No habits yet" in `--ink-secondary`
- Subtext: "Start tracking something meaningful" in `--ink-muted`
- "Add your first goal" button below, using primary button style

---

## Accessibility & Polish

- All interactive elements have visible focus states (2px `--signal` outline with 2px offset)
- Touch targets minimum 44×44px
- `prefers-reduced-motion`: disable animations, use instant state changes
- `prefers-color-scheme: dark`: provide CSS variables override (can reference original dark palette)
- Heatmap cells need `title` or `aria-label` with full date and status

---

## Responsive Behavior

**Mobile (<480px):**
- Reduce container padding to 16px
- Cards: full-bleed (edge-to-edge with adjusted border-radius)
- Heatmap cells: 9px with 2px gap
- Stack date nav elements if needed
- "Add goal" becomes floating action button (bottom-right, circular)

**Tablet (480-768px):**
- Container max-width: 540px
- Default sizing works well

---

## File Structure

Single HTML file:
- `<style>` block with all CSS, variables at top
- Hidden SVG sprite after opening `<body>`
- Semantic markup with proper heading hierarchy
- `<script>` at end with ES6+ vanilla JS
- Data persistence via `localStorage`

---

## Reference Aesthetic

Think: Notion's clarity + Linear's precision + a beautifully typeset research paper. Light and airy, but never bland. Every element intentional, like a well-organized lab bench. Calm productivity.