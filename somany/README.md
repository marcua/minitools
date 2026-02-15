# So Many! - Counting Games for Toddlers

A collection of simple counting and sorting games designed for young children. Built as a single-file PWA with a neobrutalism aesthetic.

## Architecture Overview

### Single-File PWA
- `index.html` - Contains all HTML, CSS, and JavaScript
- `sw.js` - Service worker for offline caching
- `manifest.json` - PWA metadata
- `icon.svg` - App icon

### Game Structure

The app uses a simple state machine:

```
Menu Screen → Game Screen → Results Screen
     ↑______________|_______________|
```

Each game has:
- 5 rounds
- Score tracking
- Visual feedback (correct/wrong animations)
- End-of-game results with encouraging messages

## Current Games

### 1. More or Less? (`bigger-smaller`)
- Shows two groups of different emoji (e.g., ducks vs frogs)
- Randomly asks "Which has MORE?" or "Which has LESS?"
- Player taps the correct group
- Groups have 1-6 emoji each

### 2. Find the Number! (`count-match`)
- Shows a target number prominently
- Shows two groups of different emoji
- Player must tap the group that has exactly that many

## Design System: Neobrutalism

### Core Principles
- **Bold colors** - Bright yellows, pinks, blues, purples
- **Thick black borders** - 4-6px solid black outlines
- **Hard shadows** - Offset box shadows (no blur)
- **Chunky shapes** - Large border-radius, big touch targets
- **Playful typography** - Comic Sans style fonts

### CSS Variables
```css
--yellow: #FFE66D;    /* Primary background */
--pink: #FF6B9D;      /* Game card accent */
--blue: #4ECDC4;      /* Game card accent */
--purple: #A855F7;    /* Number target */
--green: #7ED957;     /* Correct/success */
--red: #FF6B6B;       /* Wrong/back button */
--black: #1A1A2E;     /* Borders & text */

--border-thick: 4px solid var(--black);
--border-chonky: 6px solid var(--black);
--shadow-brutal: 6px 6px 0px var(--shadow);
```

### Interactive States
- **Hover**: Element lifts up-left, shadow grows
- **Active/Press**: Element moves down-right, shadow shrinks
- **Correct**: Green background + pulse animation
- **Wrong**: Red background + shake animation

## Adding New Games

1. **Create a new screen** in the HTML:
```html
<div id="new-game-screen" class="screen">
    <div class="game-header">...</div>
    <!-- Game content -->
</div>
```

2. **Add a game card** in the menu:
```html
<div class="game-card purple" onclick="startGame('new-game')">
    <span class="emoji">...</span>
    <span class="title">New Game</span>
    <span class="desc">Description</span>
</div>
```

3. **Implement game logic**:
```javascript
function setupNewGameRound() {
    // Update round/score display
    // Generate random content
    // Set state.correctAnswer
    // Render groups
}
```

4. **Add to startGame switch**:
```javascript
case 'new-game':
    showScreen('new-game-screen');
    setupNewGameRound();
    break;
```

## Gotchas & Patterns

### 1. Service Worker Caching
**Always bump `CACHE_NAME` in `sw.js`** after any change:
```javascript
const CACHE_NAME = 'somany-v2'; // was v1
```

### 2. Touch Target Sizing
Minimum touch targets for toddlers should be large:
- Emoji groups: min 140x140px
- Buttons: generous padding (20px 48px)

### 3. Preventing Double-Taps
The `state.isProcessing` flag prevents rapid taps:
```javascript
if (state.isProcessing) return;
state.isProcessing = true;
// ... handle selection
// Reset after animation completes
```

### 4. Emoji Rendering
Emoji are rendered as individual `<span>` elements for proper wrapping:
```javascript
function renderGroup(elementId, emoji, count) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.className = 'emoji-item';
        span.textContent = emoji;
        container.appendChild(span);
    }
}
```

### 5. Responsive Design
- Uses `clamp()` for fluid typography
- Stacks groups vertically on mobile (<500px)
- `user-scalable=no` prevents accidental zoom on toddler devices

## Future Game Ideas

- **Color Sorting**: Drag emoji to matching colored boxes
- **Pattern Matching**: Continue the pattern
- **Size Ordering**: Arrange from smallest to biggest
- **Missing Number**: What comes next? (1, 2, ?)
