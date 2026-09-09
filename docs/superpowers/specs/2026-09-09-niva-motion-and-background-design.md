# Niva Phase 2: Ambient Motion & Background Design

## Goal

PR #80 brought over Niva's static language (floating pill nav, pill buttons/badges,
larger card radii, bolder titles). This phase picks up the pieces that were
explicitly scoped out of that pass: motion and a persistent background. Four
independent, additive features:

1. A sitewide animated background (canvas particles + gradient, electric-blue accent).
2. The homepage "How it works" tiles restyled to read as a repeating cycle, not four
   discrete steps.
3. The homepage "Three phases of the assessment" tiles given a staggered scroll-reveal.
4. The mobile nav's sub-options collapsed into a per-category accordion.

## Non-goals

- No copy/content changes to `HOW_IT_WORKS`, `STAGE_META`, or any other data array.
- No change to the existing click-to-expand stage-detail panel behavior on the Three
  Phases section.
- No scroll-pin/stacking effect (explicitly declined in favor of the lighter
  staggered reveal).
- No new external dependencies (no animation libraries) - canvas, CSS, and the
  existing vanilla-JS patterns only.
- No change to desktop nav dropdown behavior (`.tab-dropdown`) - only the mobile
  hamburger panel changes.

## Global Constraints

- Every animation (canvas loop, CSS keyframes) must stop or reduce to a single
  static frame under `prefers-reduced-motion: reduce`, matching the existing
  `.climb-bar` precedent in `app.css`.
- The canvas render loop must pause via the Page Visibility API when
  `document.hidden` is true, and resume when the tab becomes visible again.
- All new color values read the existing `data-theme` attribute on
  `document.documentElement` - no new localStorage keys, no duplicate theme state.
- New accent: `--accent-electric:#2F6FFF` - same hex in both dark and light themes
  (confirmed against a live demo), only the *usage* opacity differs per theme.
- No task in this phase touches `HOW_IT_WORKS`, `STAGE_META`, `TOP_TABS`, or
  `NAV_DROPDOWN_MAP` *data* - only rendering/CSS around them.
- `node --test` (69 tests, assessment-logic only) must stay 69/69 throughout.

---

## 1. Sitewide Animated Background

### Problem

`body{ background:var(--bg); }` in `app.css` is a flat opaque fill. Inserting an
animated layer behind it would be invisible unless `body`'s own fill is removed
first.

### Components

- **Markup** (`src/shell-body.html`): insert as the *first* child of the body
  content, before the existing hidden Netlify feedback form (so it isn't nested
  inside `.app` or any transformed/`overflow` ancestor that would break `position:
  fixed` containment):
  ```html
  <div id="bgLayer" aria-hidden="true">
    <canvas id="bgCanvas"></canvas>
  </div>
  ```
- **CSS** (`app.css`): `#bgLayer{ position:fixed; inset:0; z-index:-1;
  pointer-events:none; }`. `#bgCanvas{ width:100%; height:100%; display:block; }`.
  Remove the `background:var(--bg)` declaration from the `body` rule (the layer's
  own gradient fill now paints the base color instead, so there's no gap before
  first paint - see Init below).
- **JS** (`src/main.js`, new function `initAnimatedBackground()`): mirrors the
  approved demo's canvas-particle logic:
  - ~50 particles, slow independent drift, faint connecting lines drawn between
    particles within 120px of each other.
  - Every frame paints, in order: (1) an opaque `ctx.fillRect` of the current
    `--bg` color covering the full canvas - this is what makes `body`'s own
    background removal safe, since the canvas itself now provides full
    coverage; (2) a `CanvasGradient` radial tint wash on top (cached and only
    rebuilt on resize/theme change, not reallocated per frame); (3) the
    particle connecting lines; (4) the particle dots. Steps 3-4 must repaint
    every frame regardless (the particles move), so folding 1-2 into the same
    frame is free - no separate DOM/CSS gradient layer is needed.
  - Dot/line color: `rgba(90,150,255, α)` in dark theme, `rgba(47,111,255, α)` in
    light theme (matches the demo exactly - dot α 0.75/0.55, line α scales with
    distance up to 0.12).
  - Resize: recompute canvas backing size from `devicePixelRatio` and
    re-seed particle positions on `window resize` (debounced via
    `requestAnimationFrame`, not a per-pixel listener).
  - Theme sync: a `MutationObserver` on `document.documentElement` watching the
    `data-theme` attribute triggers a gradient-cache rebuild and updates the
    dot/line color constants used by the next frame. This is intentionally
    decoupled from `renderThemeToggle()` - the toggle doesn't need to know the
    background exists.
  - Reduced motion: if `matchMedia('(prefers-reduced-motion: reduce)').matches`,
    draw exactly one frame and never call `requestAnimationFrame`.
  - Visibility: `document.addEventListener('visibilitychange', ...)` cancels the
    pending `requestAnimationFrame` handle when `document.hidden`, and restarts
    the loop when it becomes visible again (only if reduced-motion is off).
  - Called once from `init()` (after `theme` is resolved, alongside the existing
    `renderHamburgerMenu()` / `renderApp()` calls) - **not** from
    `renderActiveTab()` or any per-route render path, so particle state and the
    animation loop persist untouched across SPA navigation.

### Why this is safe

`.workflow-step`, `.fw-card`, `.acc-card`, `.masthead`, and the other
`backdrop-filter:blur()` surfaces already sit on a near-transparent
`--surface-raised`/`--tile-bg` fill - removing `body`'s flat color lets those
existing blur surfaces pick up the moving background instead of blurring nothing,
with no change needed to any of those rules.

### Testing

- `node --test` unaffected (no assessment-logic touched).
- Manual: verify in both themes, verify `prefers-reduced-motion` freezes it
  (DevTools "Emulate CSS media feature" / `resize_window` colorScheme param can't
  toggle this - check via `matchMedia` override in `javascript_tool`), verify
  toggling dark/light updates colors without a page reload, verify no layout
  shift or scroll-jank on any page, verify text over cards stays legible.

---

## 2. "How It Works" as a Cycle

### Problem

The four `HOW_IT_WORKS` steps (`Data Collection` -> `Analysis` -> `Recommendation`
-> `Transformation`) already narrate a loop in their own copy - step 04 ends with
"Re-assess on a cadence... see the score delta since your last run," which *is*
step 01 again. Nothing currently signals that visually; the grid just stops after
card 4.

### Design decision (refines the chat description, revised again during self-review)

The chat proposal described "a connecting circuit-style line... curving back into
a loop," which implies a single path drawn across all four card positions. A
first draft of this spec tried to approximate that with small connector icons
positioned *between* cards - but `.phase4-grid` reflows from 4 columns to 2 to 1
across breakpoints (`app.css:1452-1456`), and in the 2-column layout the
1->2 transition runs left-to-right while 2->3 wraps down to the next row and
runs right-to-left. A connector anchored to a fixed corner can't correctly point
"at the next card" in both directions without per-breakpoint JS positioning
logic - exactly the complexity this refinement was meant to avoid.

Final approach: put the cycle indicator **inside each card**, next to its own
step number, instead of between cards. This is fully breakpoint-agnostic (each
card only ever needs to know about itself) and needs no positioning logic at
all.

**Please confirm this (twice-revised) approach when reviewing this spec.**

### Components

- **Markup** (`renderHomeTab()` in `main.js`): each `.phase4-card`'s existing
  `.vnum` (currently just `01`/`02`/`03`/`04`) gains a small inline icon right
  after the number:
  ```html
  <div class="vnum">01<svg class="vnum-arrow">...chevron...</svg></div>
  ```
  For card 4 only, the icon is a distinct loop glyph instead of a chevron:
  ```html
  <div class="vnum">04<svg class="vnum-arrow vnum-loop">...curved return arrow...</svg></div>
  <span class="phase4-loop-label">Cycle repeats -> Data Collection</span>
  ```
  (the label renders below card 4's bullet list, inside the same card - no new
  sibling elements, no grid changes of any kind.)
- **CSS**: `.vnum-arrow` is a small (14x14px) inline-block SVG, `color:
  var(--accent-signal)` for the three plain chevrons (matching `.vnum`'s existing
  color) and `color:var(--accent-electric)` for `.vnum-loop`, which also gets a
  `border:1px solid var(--accent-electric); border-radius:50%; padding:2px;` ring
  so it visually reads as "different from the other three" at a glance.
  `.phase4-loop-label{ display:block; margin-top:10px; font-family:var(--mono);
  font-size:10.5px; letter-spacing:0.04em; text-transform:uppercase;
  color:var(--accent-electric); }`.
- **Animation**: `.vnum-arrow` has a small internal dot that slides from one end
  to the other via a CSS keyframe local to the icon's own tiny viewBox (no
  cross-element coordinates needed). Staggered by card index
  (`animation-delay:0s/0.4s/0.8s/1.2s` for cards 1-4 respectively),
  `animation-fill-mode:forwards`, plays once. Trigger: gated behind the existing
  `.revealed` class already added to the parent `.section-tile` by
  `observeReveals()` - `.section-tile:not(.revealed) .vnum-arrow-dot{
  animation-play-state:paused; }` / `.section-tile.revealed .vnum-arrow-dot{
  animation-play-state:running; }`. No new IntersectionObserver needed.
  After the one-shot sequence finishes, `.vnum-loop`'s ring gets a slow
  (`4s ease-in-out infinite`), low-opacity (`0.4` to `0.7`) glow pulse as the
  idle state - the one visual element that keeps gently indicating "this keeps
  going."
- **Reduced motion**: covered by the existing global rule
  (`@media (prefers-reduced-motion: reduce){ animation-duration:0.001ms !important;
  animation-iteration-count:1 !important; }` already in `app.css`) - the dot
  animations and the idle glow both collapse to their end state with no code
  changes needed here.

### Testing

- Manual: verify the icon+label render correctly inside each card at all three
  grid breakpoints (4-col, 2-col, 1-col) with no overlap or wrapping issues,
  verify the one-shot dot sequence plays once per page load when scrolled into
  view (not on every re-render), verify the loop-back glow is subtle enough not
  to distract from the card content around it, verify both themes.

---

## 3. "Three Phases" Staggered Reveal

### Components

- **Markup** (`renderHomeTab()`): no structural change - `.workflow-row`'s three
  `.workflow-step` elements (and the two `.workflow-arrow` separators between
  them) each get an inline `style="transition-delay:${i*120}ms"` at render time,
  the same inline-delay pattern already used for `.climb-bar` in
  `buildMaturityClimbSvg()`.
- **CSS**: 
  ```css
  .section-tile:not(.revealed) .workflow-step,
  .section-tile:not(.revealed) .workflow-arrow{ opacity:0; transform:translateY(16px); }
  .section-tile.revealed .workflow-step,
  .section-tile.revealed .workflow-arrow{
    opacity:1; transform:translateY(0);
    transition:opacity .5s ease, transform .5s ease;
  }
  ```
  Gated behind the same parent `.section-tile.revealed` class `observeReveals()`
  already adds - zero new JS.
- **Explicitly unchanged**: the click-to-expand `stage-detail-panel` logic in
  `renderHomeTab()` (lines ~1586-1630) is untouched - it operates on the same
  `.workflow-step` elements after they've already been laid out, independent of
  the opacity/transform reveal transition.

### Testing

- Manual: verify the stagger plays once on scroll-into-view, verify clicking a
  phase to open its detail panel still works identically before/after/during the
  reveal, verify mobile stacked layout (column, arrows rotated 90°) still
  staggers sensibly top-to-bottom.

---

## 4. Mobile Nav Accordion

### Problem

`renderHamburgerMenu()`'s `openMenu()` (main.js:1162-1183) renders every
`TOP_TABS` category heading followed immediately by *all* of its
`NAV_DROPDOWN_MAP` children, always expanded, as one flat list.

### Components

- **Markup change** in `openMenu()`'s template: for a `categoryOnly` tab with a
  non-empty `NAV_DROPDOWN_MAP[t.id]`, render the heading as a toggle button
  instead of a plain div:
  ```html
  <button type="button" class="mobile-nav-heading mobile-nav-toggle"
    data-category="${t.id}" aria-expanded="false">
    ${t.label} <span class="mobile-nav-chevron">▾</span>
  </button>
  <div class="mobile-nav-sublist" id="mobileSublist-${t.id}">
    ${(dd||[]).map(d=>`<a class="mobile-nav-sublink ...">${d.label}</a>`).join('')}
  </div>
  ```
  Tabs with no dropdown (Home, Assessment - real single links) render exactly as
  today, no toggle wrapper.
- **Behavior** (in `openMenu()`, alongside the existing `wireNavLinksByDataset`
  call): each `.mobile-nav-toggle` click toggles an `.open` class on its own
  `.mobile-nav-sublist` and flips its own `aria-expanded` - independent per
  category (multiple open at once), matching the confirmed "accordion per
  category" answer, not "single active section."
- **Auto-expand on open**: when `openMenu()` builds the panel, the category whose
  `NAV_DROPDOWN_MAP` contains the current `activeTab` starts with `.open` already
  applied (and `aria-expanded="true"`), so a user already on a Resources sub-page
  doesn't have to hunt for it.
- **CSS**: `.mobile-nav-heading` currently styles a plain `<div>` (font/color/
  padding only, `app.css:412-415`). Converting it to a `<button>` for the toggle
  case needs the same reset already used for `.mobile-nav-link`/
  `.mobile-nav-sublink` (`app.css:403-406,416-419`): `.mobile-nav-toggle{
  background:transparent; border:none; width:100%; font:inherit; cursor:pointer;
  display:flex; align-items:center; justify-content:space-between; }` layered on
  top of the existing `.mobile-nav-heading` rule (class list
  `"mobile-nav-heading mobile-nav-toggle"`, so non-interactive category labels
  keep today's exact look untouched). `.mobile-nav-sublist{ max-height:0;
  overflow:hidden; transition:max-height .25s ease; }` /
  `.mobile-nav-sublist.open{ max-height:400px; }` (a generous fixed cap rather
  than measuring scrollHeight - the longest category, Resources, has 6 items and
  comfortably fits). Chevron rotates 180° when open via
  `.mobile-nav-toggle[aria-expanded="true"] .mobile-nav-chevron`.
- **Explicitly unchanged**: clicking an actual `.mobile-nav-sublink` still
  navigates and closes the *whole* mobile panel via the existing
  `wireNavLinksByDataset(panel, '[data-tab]', closeMenu)` call - the new toggle
  buttons are a separate click target (`.mobile-nav-toggle`, no `data-tab`
  attribute) so they don't trigger that handler.

### Testing

- Manual: verify every category with children expands/collapses independently,
  verify a plain link (Home/Assessment) is unaffected, verify the active
  category auto-expands on open, verify tapping a sub-link still closes the
  entire mobile panel and navigates, verify scroll-to-close (existing behavior)
  still works.

---

## Verification Plan (all four features)

1. `node --test` stays 69/69 throughout.
2. `node scripts/build.js` completes cleanly; `git diff --stat` after rebuild
   touches only the expected generated files.
3. Live check via the local dev server in the Browser pane: both themes, desktop
   width and a mobile width (`resize_window`), for every homepage section touched
   plus the mobile nav on at least two other pages.
4. Screenshot the homepage (both themes) and the mobile nav open state (both
   themes) as the readability/regression proof before requesting merge.
