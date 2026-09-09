# Niva-Inspired Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt the layout/shape language of https://niva.framer.website (floating rounded nav, pill buttons/badges, larger card radii, bolder page titles) across every page of SimplifiedCS, while keeping the site's existing color identity untouched and both themes working correctly.

**Architecture:** SimplifiedCS is a single-file vanilla-JS SPA (`src/main.js` renders every tab into one `<div id="app">`; all styling lives in `src/styles/app.css`; `src/shell-body.html` holds the static shell markup). The whole visual system is already driven by shared CSS classes reused across ~20 pages (`.masthead`, `.section-tile`, `.page-intro`, `.cta-btn`, `.tab-btn`, `.acc-card`, badges/chips) plus theme tokens in `:root`/`html[data-theme="light"]`. This plan adds a small set of new shape tokens and updates those shared classes so the redesign cascades to every page automatically, then does a targeted audit of the handful of components that don't inherit from the shared classes.

**Tech Stack:** Vanilla JS (ES modules bundled by esbuild), hand-written CSS with custom properties, `node --test` for the existing assessment-logic regression suite (69 tests, unrelated to this visual work but must stay green), Claude Code's Browser pane for live verification (no CSS/visual test tooling exists in this repo — verification is manual/visual by design).

**Spec:** No separate spec file — the design was proposed and approved section-by-section in chat on 2026-09-09 (nav→floating rounded bar, buttons/badges/chips→full pill, card radius 12px→~20px with more padding, page titles scale up, no color changes, no decorative textures). This plan document is the durable record.

## Global Constraints

- **Keep the existing color identity.** No token in `:root` / `html[data-theme="light"]` for colors (`--bg`, `--text`, `--accent-*`, `--tile-bg`, `--line`, etc.) changes value in this plan. Only shape (border-radius), some spacing/padding, and page-title typography change.
- **No decorative background textures** (dot-grid patterns, etc.) — explicitly out of scope per the approved design.
- **Both themes must keep working identically in shape** — border-radius/padding/typography tokens are theme-independent (same value in dark and light), so this should be automatic, but every verification step must still check both themes because color/contrast interacts with new shapes (e.g., a bigger pill button needs the same border/hover states to still read correctly in light mode).
- **One commit, one PR** — this repo's established convention (see `CLAUDE.md` §4.6) is a single clean commit per PR, not incremental per-task commits pushed to the branch. Verify after each task locally, but only make one `git commit` once all tasks in this plan are complete and verified, then open one PR. **Do not merge — the user explicitly said not to merge until they confirm.**
- **Never guess a selector's current state.** Several selectors in this codebase look related by name but have independently-overriding rules elsewhere in the file (e.g. `.link-pill` appears in a shared `border-radius:12px` group AND has its own later `border-radius:999px` rule that wins the cascade — it's already a true pill, don't touch it). Every task below tells you exactly which rule is authoritative; if a step asks you to grep first, that grep is not optional busywork — the plan's authors verified these once already, and file line numbers can drift as edits land.
- **Test after every task:** `node --test` (must stay 69/69 passing — this suite tests assessment logic, not CSS, but a stray syntax error in `src/main.js` would break the whole app) and `node scripts/build.js` (must complete with no errors) before any live-browser verification step.
- **Browser pane quirks already known from this project:** requestAnimationFrame/CSS transitions don't advance in a non-visible tab (front the tab before screenshotting); deep-linked routes (e.g. `/exploits`) 404 against the local dev server (no SPA fallback) — navigate to `/` and click through, or use `document.querySelector('[data-tab="..."]').click()` via `javascript_tool` instead of `navigate`.

---

## Task 1: Design tokens + floating rounded nav

**Files:**
- Modify: `src/styles/app.css:1-30` (token block — add new custom properties near the other tokens, not scattered)
- Modify: `src/styles/app.css:110-160` (`.app`, `.masthead`, `.masthead-inner` and related rules)
- Modify: `src/styles/app.css:445-479` (masthead mobile breakpoints)
- Modify: `src/main.js:950-980` and `src/main.js:3875` (remove `syncViewportWidthVar()` — see Step 5; this is the one place in this whole plan that touches `src/main.js`, and only because this step makes the function's sole purpose disappear, not because any behavior changes)

**Interfaces:**
- Produces: `--radius-pill`, `--radius-card`, `--radius-input`, `--radius-nav` custom properties, defined once in `:root` and available to every later task in this plan.

- [ ] **Step 1: Add the new shape tokens**

Find the `:root{...}` block at the top of `src/styles/app.css` (starts at line 1). Add these four lines inside it, near the other structural (non-color) tokens:

```css
--radius-pill: 999px;
--radius-card: 20px;
--radius-input: 14px;
--radius-nav: 24px;
```

These are shape tokens, not theme tokens — do **not** repeat them inside `html[data-theme="light"]{...}` (same value in both themes, which is why they belong in the base `:root` only).

- [ ] **Step 2: Rebuild and confirm no regression yet**

Run: `node --test` — expect `69/69 passing` (unchanged, this step adds unused CSS variables only).
Run: `node scripts/build.js` — expect a clean build with no errors.

- [ ] **Step 3: Convert `.masthead` from full-bleed to floating inset**

The current `.masthead` rule (verified at `src/styles/app.css:137-149`) uses a `--viewport-width`-based breakout hack to force true 100vw width, plus `margin-top:-40px` to cancel `.app`'s own top padding so the bar touches the very top of the viewport with no gap. A floating nav needs the opposite: normal `.app`-constrained width (which already leaves `.app`'s own side padding as the "float" margin) and a visible gap above it, not a cancelled one.

Replace:
```css
  .masthead{
    position:sticky;
    top:0;
    z-index:10;
    width:var(--viewport-width, 100vw);
    margin-left:calc(50% - (var(--viewport-width, 100vw) / 2));
    margin-top:-40px;
    margin-bottom:32px;
    border-bottom:1px solid var(--line);
    background:var(--masthead-bg);
    backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
  }
```
with:
```css
  .masthead{
    position:sticky;
    top:16px;
    z-index:10;
    margin-top:16px;
    margin-bottom:32px;
    border:1px solid var(--line);
    border-radius:var(--radius-nav);
    background:var(--masthead-bg);
    backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
    box-shadow:0 8px 24px rgba(0,0,0,0.12);
  }
```
Also delete the large comment block directly above the old rule (`/* The masthead used to bleed only to .app's own padding edge... */`, roughly 20 lines) — it explains the breakout hack this step removes, and leaving it would describe code that no longer exists. Replace it with a short comment: `/* Floating inset nav (Niva-inspired layout pass) - a normal .app-constrained block, not a full-bleed breakout; .app's own side padding IS the float margin. */`

- [ ] **Step 4: Simplify `.masthead-inner` now that it doesn't need to escape `.app`'s width cap**

The current rule (verified at `src/styles/app.css:150-159`) gives `.masthead-inner` its own `max-width:1600px` specifically so nav content could use width `.masthead`'s old 100vw breakout provided beyond `.app`'s 1200px cap. Since `.masthead` no longer exceeds `.app`'s width, that 1600px cap is now unreachable dead code, and the inner padding is now double-applied on top of `.app`'s own side padding.

Replace:
```css
  .masthead-inner{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:48px;
    flex-wrap:wrap;
    max-width:1600px;
    margin:0 auto;
    padding:16px clamp(24px, 4vw, 64px);
  }
```
with:
```css
  .masthead-inner{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:32px;
    flex-wrap:wrap;
    padding:14px 24px;
  }
```

- [ ] **Step 5: Remove the now-orphaned `syncViewportWidthVar()`**

`--viewport-width` (verified via `grep -n "viewport-width\|syncViewportWidthVar" src/main.js src/styles/app.css`) is consumed *only* by the two `.masthead` properties Step 3 just deleted (`width:var(--viewport-width, 100vw)` and the `margin-left:calc(...)` breakout). Once those are gone, `syncViewportWidthVar()` computes a CSS variable nothing reads — dead work running on every render and every window resize. Remove it:

1. In `src/main.js`, delete the `syncViewportWidthVar()` function definition and its preceding comment block (verified at lines 950-976 — starts at the comment `// Keeps --viewport-width (consumed by .masthead's full-bleed breakout in`, ends after the function's closing `}`).
2. In the same file, in `observeReveals()` (verified at line 978-979), delete the line `syncViewportWidthVar();` that currently opens the function body — `observeReveals()` itself stays; only that one call is removed. `observeReveals()`'s actual job (wiring the `.section-tile, .page-intro` scroll-reveal `IntersectionObserver`) is unrelated to this redesign and must be left otherwise untouched.
3. Delete the line `window.addEventListener('resize', syncViewportWidthVar);` (verified at line 3875).

This is a behavior-neutral cleanup, not a functional change — the variable it set had no remaining reader after Step 3, so removing the setter changes nothing observable. It's the one place in this entire plan that touches `src/main.js`.

- [ ] **Step 6: Adjust mobile breakpoints for the smaller floating bar**

At `src/styles/app.css:454-460` (the `@media (max-width:480px)` block), the rule `.masthead-inner{ gap:10px; padding:14px 16px; }` still applies correctly to the new markup as-is — no change needed there. But add one line to shrink the nav's own corner radius at this width so it doesn't look disproportionate on a narrow floating bar; inside that same `@media (max-width:480px){...}` block, add:
```css
    .masthead{ margin-top:10px; border-radius:16px; }
```

- [ ] **Step 7: Rebuild and verify live**

Run: `node --test` — expect `69/69 passing`.
Run: `node scripts/build.js` — expect a clean build.

Start the dev server (`preview_start` with name `simplifiedcs`), open a tab at the root URL, set `localStorage.setItem('simplifiedcs:theme','dark')` and reload. Screenshot the top of the Home page at desktop width (1400x900) and confirm: the nav bar has visible rounded corners, visible page background peeking on both sides (not touching the browser edges), and a shadow instead of a hard bottom border. Repeat with `simplifiedcs:theme` set to `'light'`. Resize to mobile (375x812) and confirm the nav still reads correctly (rounded, not overflowing, hamburger visible instead of the full tab row per the existing 1200px breakpoint). Click the Home/Framework/Learn dropdowns and confirm they still open and position correctly relative to the now-inset nav (they're absolutely positioned relative to `.tab-item`, which hasn't moved structurally, so this should already work — verify rather than assume).

---

## Task 2: Buttons and interactive pills → full pill shape

**Files:**
- Modify: `src/styles/app.css:993-999` (`.cta-btn` and `.cta-btn.secondary`)
- Modify: `src/styles/app.css:1029-1035` (`.filter-pill`)
- Modify: `src/styles/app.css:84-87` (shared badge/chip group — `.tab-btn.active` specifically for this task; the rest of this group is Task 3's job)

**Interfaces:**
- Consumes: `--radius-pill` from Task 1.

- [ ] **Step 1: Give `.cta-btn` a pill shape**

`.cta-btn` (verified at `src/styles/app.css:993-996`) currently has no `border-radius` at all (sharp corners) despite being the site's primary call-to-action button, used on nearly every page. Add one property to the existing rule:
```css
  .cta-btn{
    font-family:var(--sans); font-size:14px; font-weight:600; padding:13px 26px;
    border:1px solid var(--accent-signal); background:var(--accent-signal); color:var(--text-on-accent); cursor:pointer;
    border-radius:var(--radius-pill);
  }
```
(`.cta-btn.secondary` at line 998 only overrides color/background/border-color, not shape — it inherits the new radius automatically, no separate edit needed.)

- [ ] **Step 2: Give `.filter-pill` an actual pill shape**

`.filter-pill` (verified at `src/styles/app.css:1029-1033`, used for the News and Exploits category filter buttons) is, like `.cta-btn`, currently square despite its name. Add `border-radius:var(--radius-pill);` to its declaration block.

- [ ] **Step 3: Make the active nav-tab highlight a pill**

In the shared badge/chip group at `src/styles/app.css:84-87`, `.tab-btn.active` currently gets `border-radius:6px` alongside several badge classes. Remove `.tab-btn.active` from that shared selector list (it'll get a proper pill treatment together with the other badges/chips group changes in Task 3, but the ACTIVE NAV TAB specifically should visually match the button/pill family, not the small-text-tag family, since it's a bigger, more prominent element). Give it its own explicit rule right after `.tab-btn:hover` (verified at `src/styles/app.css:270-271`):
```css
  .tab-btn.active{ border-radius:var(--radius-pill); }
```

- [ ] **Step 4: Rebuild and verify**

Run: `node --test` (69/69) and `node scripts/build.js` (clean).

Live: screenshot the Home page hero in dark mode — confirm "Take the assessment" / "How it works" style CTA buttons are now fully pill-shaped. Click into the News or Exploits tab and confirm the category filter buttons are pill-shaped and the active-state highlight still shows clearly (contrast unchanged, just shape). Click a top-nav tab (e.g. Framework) and confirm its active-state background is now a pill, not a small rounded rectangle. Repeat in light mode.

---

## Task 3: Badges, tags, and chips → pill shape

**Files:**
- Modify: `src/styles/app.css:84-88` (shared badge/chip group, minus `.tab-btn.active` which Task 2 already pulled out and minus `.checkbox` which must stay excluded — see Step 1)
- Modify: `src/styles/app.css:1039` (`.news-cat`)
- Modify: `src/styles/app.css:1607` (`.stage-chip`)

**Interfaces:**
- Consumes: `--radius-pill` from Task 1.

- [ ] **Step 1: Update the shared badge/chip group, excluding `.checkbox`**

Verify the current state of this block first — it may have shifted after Task 2's edit:
```bash
grep -n "border-radius:6px" src/styles/app.css
```
It should now read (after Task 2 removed `.tab-btn.active`):
```css
  .q-badge, .priority-tag, .alpha-chip, .news-cat, .checkbox,
  .footer-social-icon, .icon-badge, .exploit-ransomware-badge, .exploit-sector-chip{
    border-radius:6px;
  }
```
`.checkbox` (verified real usage at `src/main.js` — a 16x16px form checkbox for multi-select assessment questions, e.g. `.fw-card .checkbox` and `.region-chip .checkbox`) should **not** become a full pill — a circular checkbox reads as a radio button, which would misrepresent multi-select fields. Split it out. Replace the block with:
```css
  .q-badge, .priority-tag, .alpha-chip, .news-cat,
  .footer-social-icon, .icon-badge, .exploit-ransomware-badge, .exploit-sector-chip{
    border-radius:var(--radius-pill);
  }
  .checkbox{ border-radius:4px; }
```
(`.footer-social-icon` and `.icon-badge` both get overridden to `border-radius:50%` by the very next rule already in the file — verified at `src/styles/app.css:88` — so their appearance in this pill group is now redundant but harmless; leave them in rather than fixing something that isn't broken, since a perfect circle already satisfies "pill".)

- [ ] **Step 2: Give `.news-cat` and `.stage-chip` their missing radius**

`.news-cat` (verified at `src/styles/app.css:1039`) has no radius of its own — it relies entirely on the shared group Step 1 just updated, so it's already fixed; no separate edit needed here. Confirm this by checking it's listed in the shared selector (it is, per Step 1's replacement block).

`.stage-chip` (verified at `src/styles/app.css:1607`, used for Maturity Model stage badges, and reused by the Security Tooling Repository page's Licence/Phase tags) is **not** in the shared group at all and currently has no radius property whatsoever — sharp corners. Add one property to its existing declaration:
```css
  .stage-chip{ display:inline-block; font-family:var(--mono); font-size:10.5px; text-transform:uppercase; letter-spacing:0.04em; padding:3px 8px; border:1px solid var(--stage-color); color:var(--stage-color); white-space:nowrap; border-radius:var(--radius-pill); }
```

- [ ] **Step 3: Rebuild and verify**

Run: `node --test` (69/69) and `node scripts/build.js` (clean).

Live: visit the Maturity Model page and confirm stage badges are pill-shaped in both themes. Visit the Security Tooling Repository page, open the "Active Directory & On-Prem Identity" accordion, and confirm the Licence/Phase chips in the table are pill-shaped. Visit News and confirm each card's category tag is a pill. Visit the Assessment flow far enough to see a multi-select question with checkboxes, and confirm checkboxes are still small squares (NOT pills) — this is the one class this task deliberately excluded.

---

## Task 4: Cards and tiles → larger radius and padding

**Files:**
- Modify: `src/styles/app.css:75-83` (shared card/tile group)
- Modify: `src/styles/app.css:938-939` (`.section-tile` padding)
- Modify: `src/styles/app.css:924-925` (`.page-intro` padding)

**Interfaces:**
- Consumes: `--radius-card`, `--radius-input` from Task 1.

- [ ] **Step 1: Split the shared 12px group into cards vs. form inputs**

The current group (verified at `src/styles/app.css:75-83`) mixes large content tiles with form inputs. Both should get more rounding, but at different scales — a full-width text input rounded as aggressively as a card can look odd. Replace:
```css
  .section-tile, .page-intro, .hero-banner, .fw-card, .acc-card, .case-card,
  .industry-card, .region-chip, .site-tile, .start-link, .phase4-card, .workflow-step,
  .rubric-card, .toc-list, .delta-box, .info-box, .note-box,
  .news-card, .tier-row, .phase-row, .stage-band, .resource-group, .osint-item,
  .link-pill, .footer-social-icon, .region-note, .ot-skip-note, .ot-likely-note,
  .exploit-card, .exploit-score-box, .exploit-safety,
  select, input[type="text"], input[type="file"]{
    border-radius:12px;
  }
```
with:
```css
  .section-tile, .page-intro, .hero-banner, .fw-card, .acc-card, .case-card,
  .industry-card, .region-chip, .site-tile, .start-link, .phase4-card, .workflow-step,
  .rubric-card, .toc-list, .delta-box, .info-box, .note-box,
  .news-card, .tier-row, .phase-row, .stage-band, .resource-group, .osint-item,
  .footer-social-icon, .region-note, .ot-skip-note, .ot-likely-note,
  .exploit-card, .exploit-score-box, .exploit-safety{
    border-radius:var(--radius-card);
  }
  select, input[type="text"], input[type="file"]{
    border-radius:var(--radius-input);
  }
```
Note `.link-pill` was removed from this list entirely — it already gets `border-radius:999px` from its own later, more specific rule at `src/styles/app.css:1409-1423` (verified — this rule already wins the cascade today), so including it here was always dead weight; removing it is a cleanup, not a behavior change.

- [ ] **Step 2: Give the two most common tile types (`.section-tile`, `.page-intro`) more generous padding**

Verified current rule at `src/styles/app.css:938`: `.section-tile{ background:var(--tile-bg); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid var(--line); padding:32px 36px; }`. Change `padding:32px 36px;` to `padding:36px 40px;`.

Verified current rule at `src/styles/app.css:924`: `.page-intro{ background:var(--tile-bg); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border:1px solid var(--line); padding:32px 36px; }`. Apply the same change: `padding:36px 40px;`.

Leave the existing `@media (max-width:720px)` overrides for both (`padding:22px 20px`) untouched — mobile padding was already tuned tighter and doesn't need to grow.

- [ ] **Step 3: Rebuild and verify**

Run: `node --test` (69/69) and `node scripts/build.js` (clean).

Live: screenshot the Home page, About page, and Playbooks page (accordion cards) in both themes at desktop width. Confirm card corners are visibly more rounded than before and content has more breathing room, with no text overflowing or touching the new rounder corners awkwardly. Check a page with a form input (Assessment flow's free-text fields) and confirm inputs are rounded but not as aggressively as cards. Resize to mobile and confirm the existing tighter mobile padding still applies (cards shouldn't look identical to desktop padding on a phone).

---

## Task 5: Page-title typography scale

**Files:**
- Modify: `src/styles/app.css:970` (`h2.page-title`)
- Modify: `src/styles/app.css:985` (`h3.section-h`, proportional nudge only)

**Interfaces:**
- None — pure CSS value change, no new tokens (font sizes weren't tokenized before this and don't need to be for a one-time bump).

- [ ] **Step 1: Scale up page titles**

Replace the verified current rule at `src/styles/app.css:970`:
```css
  .page h2.page-title{ font-size:44px; font-weight:600; margin:0 0 14px; line-height:1.15; }
```
with:
```css
  .page h2.page-title{ font-size:54px; font-weight:700; margin:0 0 14px; line-height:1.1; }
```
(line-height tightened slightly from 1.15 to 1.1 — larger bold display type reads better with less line-height, matching Niva's tighter headline spacing.)

- [ ] **Step 2: Nudge section headings for proportion**

Replace the verified current rule at `src/styles/app.css:985`:
```css
  .page h3.section-h{ font-size:22px; font-weight:600; margin:36px 0 14px; }
```
with:
```css
  .page h3.section-h{ font-size:24px; font-weight:600; margin:36px 0 14px; }
```
This is a small, proportional adjustment only (22px→24px) so section headings don't look undersized next to the much bigger new page title — not a full type-scale overhaul, per the approved design (page titles were the explicit ask, not every heading level).

- [ ] **Step 3: Check for overflow on the longest real page titles**

Some page titles are long (e.g. "Threat Modeling & Forensics", "Security Tooling Repository"). Before general verification, specifically check these two pages plus any others with multi-word titles at mobile width (375px) — at 54px font-size, a long title needs to wrap cleanly across 2+ lines without any container overflow. `.page-intro`/`.page-title` don't set an explicit `white-space` or `max-width` that would prevent wrapping, so this should already wrap naturally, but confirm rather than assume.

- [ ] **Step 4: Rebuild and verify**

Run: `node --test` (69/69) and `node scripts/build.js` (clean).

Live: screenshot Home, Threat Modeling & Forensics, and Security Tooling Repository page titles at both desktop and mobile width, both themes. Confirm titles are visibly larger/bolder, wrap cleanly with no overflow, and remain legible (font-weight 700 shouldn't blur or clip in either theme).

---

## Task 6: Remaining one-off components audit

**Files:**
- Modify: `src/styles/app.css:1632` (`.resume-banner`)
- Modify: `src/styles/app.css:1636` (`.mode-card`)
- Modify: `src/styles/app.css:1656` (`.sample-banner`)
- Modify: `src/styles/app.css:1619-1626` (`.save-toast`)

**Interfaces:**
- Consumes: `--radius-card` from Task 1.

- [ ] **Step 1: Find every remaining hardcoded `border-radius` not yet covered by Tasks 1-5**

Run:
```bash
grep -n "border-radius:12px\|border-radius: 12px" src/styles/app.css
```
This should now return only the individual rules Tasks 1-5 didn't already touch (the shared 12px group was already converted to `var(--radius-card)`/`var(--radius-input)` in Task 4). It should match exactly four remaining rules: `.resume-banner` (line 1632), `.mode-card` (line 1636), `.sample-banner` (line 1656), and `.save-toast` (line 1623, the one-time "answers saved" toast shown during the Assessment flow). For each, replace the literal `12px` with `var(--radius-card)` — all four are card-like floating/bordered containers, not buttons or tags, so the card token is correct for all of them. If the grep returns any match not in this list of four, read it in context before changing it — the plan's authors verified these four specifically; a fifth would mean something shifted and needs its own judgment call, not a blind find-and-replace.

- [ ] **Step 2: Round the outer edge of data tables**

`.table-wrap` (verified at `src/styles/app.css:1597`: `.table-wrap{ overflow-x:auto; margin:20px 0 32px; }`, wraps every `<table class="data-table">` on the Maturity Model and Security Tooling Repository pages) currently has no radius — table corners are square, which will now look inconsistent next to every other now-rounded container.

**Do not add `overflow:hidden`.** The shorthand `overflow` property sets both axes at once and would silently override the existing `overflow-x:auto`, breaking the mobile horizontal-scroll behavior this exact task is supposed to preserve (verified in Step 3 below). Per the CSS overflow spec, a box with a non-`visible` value on either axis already clips its content to that box's `border-radius` — `overflow-x:auto` alone is sufficient to round the table's visible corners once `.table-wrap` itself has a radius; no separate `overflow-y`/`overflow` declaration is needed.

Change the rule to:
```css
  .table-wrap{ overflow-x:auto; margin:20px 0 32px; border-radius:var(--radius-card); border:1px solid var(--line); }
```
`.data-table` itself (verified at `src/styles/app.css:1598`: `width:100%; border-collapse:collapse; font-size:12.5px; min-width:640px;`) has no border of its own — only individual `th`/`td` cells draw `border-bottom` rules for row separation — so there is no redundant border to remove elsewhere. Individual `<td>`/`<th>` cell borders stay exactly as they are; only the wrapper's outer corners round.

- [ ] **Step 3: Rebuild and verify**

Run: `node --test` (69/69) and `node scripts/build.js` (clean).

Live: visit the Assessment flow far enough to see the resume-progress banner and the mode-selection cards (Quick/Full/Sample), confirm both now have the larger card radius in both themes. Visit Maturity Model's "Model at a glance" table and Security Tooling Repository's per-category tables, confirm the table's outer corners are now rounded while internal cell borders are unchanged, and confirm the existing horizontal-scroll-on-mobile behavior (`.table-wrap{ overflow-x:auto }`) still works at mobile width — rounding the container must not break that scroll behavior.

---

## Task 7: Full-site visual verification pass

**Files:** None modified — this task is pure verification of Tasks 1-6's combined effect across every page.

**Interfaces:** None.

- [ ] **Step 1: Confirm the automated regression suite and build are clean**

Run: `node --test` — expect `69/69 passing`.
Run: `node scripts/build.js` — expect a clean build with zero errors, and `git diff --stat` should show changes limited to `src/styles/app.css`, `assets/app.css`, `index.html` (the generated files), and the small `syncViewportWidthVar()` removal in `src/main.js` from Task 1 Step 5 — no other edits to `src/main.js`, and none at all to `src/shell-body.html`.

- [ ] **Step 2: Screenshot every distinct page template in dark mode**

Using the Browser pane (front the tab before every screenshot — rAF/transitions don't advance in a hidden tab), visit and screenshot each of: Home, What is SimplifiedCS?, Methodology, Roadmap, About, Maturity Model, Core Principles, Metrics, Starter Guide, Threat Modeling & Forensics, Glossary, Security Tooling Repository, Runbooks, Playbooks, Trends & News, Exploits, Case Studies, Assessment (landing + one question screen), History. For each: confirm nav renders as a floating rounded bar, cards/tiles show the new radius and padding, buttons/badges/chips are pill-shaped, the page title is visibly larger/bolder, and — critically — **check text readability**: no text touching or clipped by a now-larger rounded corner, no button label wrapping awkwardly inside its new pill shape, sufficient contrast maintained (this task changes shape only, so contrast shouldn't regress, but verify rather than assume, especially on `.stage-chip`/`.exploit-sector-chip` where a pill shape has less background area behind small text at the rounded ends).

- [ ] **Step 3: Repeat Step 2 in light mode**

Same page list, `localStorage.setItem('simplifiedcs:theme','light')`. Pay particular attention to the floating nav's shadow (verified as `box-shadow:0 8px 24px rgba(0,0,0,0.12)` in Task 1 — a dark shadow should still read correctly against a light background; if it looks too heavy or too faint, this is the point to tune it, not before) and to any card whose border was relying on a specific radius/border combination for visual separation against a lighter `--tile-bg`.

- [ ] **Step 4: Mobile-width pass**

Resize to 375x812. Re-screenshot Home, one accordion-heavy page (Playbooks or Starter Guide), and Security Tooling Repository (has the widest tables). Confirm: nav collapses to the hamburger correctly below 1200px width (unchanged threshold) and looks proportionate as a smaller floating bar (Task 1 Step 6's 16px radius kicks in here), no horizontal page overflow anywhere, tables still scroll horizontally inside their own now-rounded container rather than overflowing the page.

- [ ] **Step 5: Interaction/functionality check — nothing is broken**

Directly exercise, and confirm each still works exactly as before this redesign: every top-nav dropdown opens/closes and every link inside resolves to the right page; the mobile hamburger menu opens and lists every category correctly; the search widget expands, returns results, and navigates on click; the theme toggle switches themes and persists via `localStorage`; at least one accordion (Starter Guide or Playbooks) expands/collapses on click; the Quick Navigation TOC-click-opens-accordion behavior on Starter Guide/Threat Modeling/Security Tooling Repository still works; the Assessment flow can be started and at least one question answered and advanced past. Only Task 1's `syncViewportWidthVar()` removal touched `src/main.js` (a dead-code deletion, not a behavior change), so none of this should have changed — this step exists specifically to catch a shape/CSS change that accidentally affected click targets, z-index/stacking (the new nav shadow or border-radius could in principle clip a dropdown if `overflow` were mishandled — it isn't, per Task 1, but verify), or spacing that pushes an interactive element out of its expected hit area.

- [ ] **Step 6: Final commit**

Once every check above passes with no unresolved issues:
```bash
git add src/styles/app.css src/main.js assets/app.css index.html docs/superpowers/plans/2026-09-09-niva-layout-redesign.md
git commit -m "Redesign layout in the style of niva.framer.website: floating nav, pill buttons/badges, larger card radii, bolder page titles

Keeps the existing color identity in both themes untouched - shape,
spacing, and page-title typography only. Verified across every page,
both themes, and mobile width; no functional regressions (node --test
69/69, all nav/search/accordion/theme-toggle/assessment interactions
re-checked manually)."
```
Push the branch and open a PR with a summary of the change and the verification performed. **Do not merge this PR** — the user must review and explicitly confirm first.
