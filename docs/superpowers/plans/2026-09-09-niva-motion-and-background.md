# Niva Phase 2: Ambient Motion & Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sitewide animated background, a cyclical treatment for the homepage
"How it works" tiles, a staggered scroll-reveal for the homepage "Three phases"
tiles, and a mobile-nav accordion for sub-options - the Niva reference elements
scoped out of PR #80.

**Architecture:** Four additive, mostly-independent features layered onto the
existing single-file vanilla-JS SPA (`src/main.js` render functions,
`src/styles/app.css` theme-token CSS, `src/shell-body.html` static shell). No new
files, no new dependencies, no data-array changes. The background is a `<canvas>`
in a fixed layer initialized once at app bootstrap; the other three features are
DOM/CSS changes inside existing render functions.

**Tech Stack:** Vanilla JS, Canvas 2D API, CSS custom properties + `@keyframes`,
`IntersectionObserver` (existing `observeReveals()`, not new), `MutationObserver`
(new, for background theme sync), esbuild (`scripts/build.js`, unchanged).

**Spec:** [docs/superpowers/specs/2026-09-09-niva-motion-and-background-design.md](../specs/2026-09-09-niva-motion-and-background-design.md)

## Global Constraints

- Every animation (canvas loop, CSS keyframes) reduces to a single static frame
  under `prefers-reduced-motion: reduce`.
- The canvas render loop pauses via the Page Visibility API when `document.hidden`
  is true.
- All new color logic reads the existing `data-theme` attribute on
  `document.documentElement` - no new localStorage keys.
- New accent token: `--accent-electric:#2F6FFF` (same hex both themes).
- No task touches `HOW_IT_WORKS`, `STAGE_META`, `TOP_TABS`, or `NAV_DROPDOWN_MAP`
  *data* - only rendering/CSS around them.
- `node --test` (69 tests) must stay 69/69 after every task.
- `node scripts/build.js` must complete cleanly after every task; `git diff --stat`
  after rebuild must show only the exact files that task is expected to touch
  (plus the generated `assets/app.css`, `assets/app.js`, `index.html`).

---

### Task 1: Sitewide Animated Background

**Files:**
- Modify: `src/shell-body.html` (insert layer markup)
- Modify: `src/styles/app.css` (new token, layer CSS, remove `body` background)
- Modify: `src/main.js` (new `initAnimatedBackground()` function + one call site
  in `init()`)

**Interfaces:**
- Produces: `initAnimatedBackground()` - a zero-argument function, called once
  from `init()`. No other task depends on its internals, only on the fact that
  `#bgLayer`/`#bgCanvas` exist in the DOM and `--accent-electric` exists as a CSS
  token (Tasks 2-4 use the token directly in CSS, not the JS function).

- [ ] **Step 1: Add the `--accent-electric` token**

In `src/styles/app.css`, add to **both** the dark `:root` block (near
`--accent-pop:#FF5FA2;` at line 30) and the light `html[data-theme="light"]`
block (near `--accent-pop:#C9186B;` at line 59):

```css
--accent-electric:#2F6FFF;
```

- [ ] **Step 2: Insert the background layer markup**

In `src/shell-body.html`, insert as the very first line (before the existing
`<!-- Static, hidden form... -->` comment):

```html
<div id="bgLayer" aria-hidden="true"><canvas id="bgCanvas"></canvas></div>
```

- [ ] **Step 3: Add the layer CSS and remove the flat body background**

In `src/styles/app.css`, remove the line `background:var(--bg);` from the `body`
rule (around line 69), and add a new rule immediately after that `body` rule:

```css
#bgLayer{ position:fixed; inset:0; z-index:-1; pointer-events:none; background:var(--bg); }
#bgCanvas{ width:100%; height:100%; display:block; }
```

(`#bgLayer` keeps its own `background:var(--bg)` as a same-frame-1 safety net
before the canvas's own first paint runs, so there is never a flash of the
browser's default white background.)

- [ ] **Step 4: Rebuild and verify no visual regression yet**

```bash
node scripts/build.js
node --test
```
Expected: build completes, 69/69 tests pass. The page should look unchanged
(solid background, no canvas content yet - `initAnimatedBackground()` doesn't
exist yet).

- [ ] **Step 5: Implement `initAnimatedBackground()`**

In `src/main.js`, add this function above the `(async function init(){` block
(near line 3837):

```js
function initAnimatedBackground(){
  const canvas = document.getElementById('bgCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let particles = [];
  let rafId = null;
  let gradient = null;
  let width = 0, height = 0;

  function isLight(){ return document.documentElement.getAttribute('data-theme') === 'light'; }

  function sizeCanvas(){
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width; height = rect.height;
    canvas.width = Math.max(1, width * devicePixelRatio);
    canvas.height = Math.max(1, height * devicePixelRatio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    buildGradient(width, height);
  }

  function buildGradient(w, h){
    const g = ctx.createRadialGradient(w*0.15, h*-0.05, 0, w*0.15, h*-0.05, Math.max(w,h)*0.8);
    const tint = isLight() ? 'rgba(47,111,255,0.10)' : 'rgba(47,111,255,0.18)';
    g.addColorStop(0, tint);
    g.addColorStop(1, 'rgba(47,111,255,0)');
    gradient = g;
  }

  function initParticles(){
    particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      r: 1 + Math.random() * 1.8,
    }));
  }

  function draw(){
    const bg = isLight() ? '#FFFFFF' : '#000000';
    const dotColor = isLight() ? '47,111,255' : '90,150,255';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    if(gradient){ ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height); }

    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0 || p.x > width) p.vx *= -1;
      if(p.y < 0 || p.y > height) p.vy *= -1;
    });
    for(let i = 0; i < particles.length; i++){
      for(let j = i + 1; j < particles.length; j++){
        const a = particles[i], b = particles[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if(d < 120){
          ctx.strokeStyle = `rgba(${dotColor},${0.12 * (1 - d / 120)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    particles.forEach(p => {
      ctx.fillStyle = `rgba(${dotColor},${isLight() ? 0.55 : 0.75})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });

    if(!reduceMotion) rafId = requestAnimationFrame(draw);
  }

  function stop(){ if(rafId){ cancelAnimationFrame(rafId); rafId = null; } }
  function start(){ if(!rafId && !reduceMotion) draw(); }

  sizeCanvas();
  initParticles();
  draw();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { sizeCanvas(); initParticles(); }, 120);
  });

  document.addEventListener('visibilitychange', () => {
    if(document.hidden) stop(); else start();
  });

  new MutationObserver(() => {
    buildGradient(width, height);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
```

- [ ] **Step 6: Call it once from `init()`**

In `src/main.js`, inside the `(async function init(){ ... })()` block, add
`initAnimatedBackground();` on its own line immediately before the existing
`renderHamburgerMenu();` call (near line 3867) - after `theme` has been resolved
and `data-theme` has been set on `document.documentElement`, and only once
(never inside `renderActiveTab()` or any per-route render path).

- [ ] **Step 7: Rebuild and verify**

```bash
node scripts/build.js
node --test
```
Expected: build completes, 69/69 tests pass.

- [ ] **Step 8: Manual verification**

Using the Browser pane against the local dev server:
- Confirm particles drift and connecting lines fade in/out as particles pass
  near each other, in both dark and light theme (toggle live, no reload).
- Confirm cards using `backdrop-filter` (e.g. `.workflow-step`, `.fw-card`) show
  a faint blur of the moving background through them.
- Confirm no layout shift and no horizontal scrollbar on any page at both
  desktop and a mobile emulated width.
- Confirm via `javascript_tool` that forcing
  `matchMedia('(prefers-reduced-motion: reduce)').matches` (or checking the
  `reduceMotion` capture at load time under an emulated reduced-motion profile)
  results in a single static frame with no ongoing `requestAnimationFrame` calls.

- [ ] **Step 9: Commit**

```bash
git add src/shell-body.html src/styles/app.css src/main.js assets/app.css assets/app.js index.html
git commit -m "Add sitewide animated canvas background with electric-blue accent"
```

---

### Task 2: "How It Works" Cycle Treatment

**Files:**
- Modify: `src/main.js` (`renderHomeTab()`'s `HOW_IT_WORKS.map(...)` block, near
  line 1441)
- Modify: `src/styles/app.css` (new `.vnum-arrow`, `.vnum-loop`,
  `.phase4-loop-label` rules, plus reveal-gating rules)

**Interfaces:**
- Consumes: `--accent-electric` (Task 1, Step 1) and the existing `.revealed`
  class already added to `.section-tile` by `observeReveals()`
  (`src/main.js:950-971`, unchanged).
- Produces: nothing consumed by later tasks - self-contained.

- [ ] **Step 1: Add the index parameter and per-card icon markup**

In `src/main.js`, change the `HOW_IT_WORKS.map(s=>` callback (line 1441) to
`HOW_IT_WORKS.map((s,i)=>`, and change the `.vnum` line (line 1443) from:

```js
              <div class="vnum">${s.n}</div>
```

to:

```js
              <div class="vnum">${s.n}${i === HOW_IT_WORKS.length - 1 ? `
                <svg class="vnum-arrow vnum-loop" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2"/><path d="M18.5 4v3.2H15.3M5.5 20v-3.2H8.7"/></svg>` : `
                <svg class="vnum-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`}
              </div>
              ${i === HOW_IT_WORKS.length - 1 ? '<span class="phase4-loop-label">Cycle repeats &rarr; Data Collection</span>' : ''}
```

(The `.vnum-loop` path is the codebase's existing `cycle` icon glyph from the
`icon()` registry at `src/main.js:265`, inlined here rather than called through
`icon()` since it needs its own class for animation targeting. The plain-chevron
path is the same glyph already used inline for `.workflow-arrow` in this same
function, at `src/main.js:1485`.)

- [ ] **Step 2: Add the icon and label CSS**

In `src/styles/app.css`, add near the existing `.phase4-card .vnum` rule (line
1459):

```css
.vnum{ display:flex; align-items:center; gap:6px; }
.vnum-arrow{ color:var(--accent-signal); opacity:0; transform:scale(0.5); transition:opacity .4s ease, transform .4s ease; }
.section-tile.revealed .vnum-arrow{ opacity:1; transform:scale(1); }
.phase4-card:nth-child(1) .vnum-arrow{ transition-delay:0s; }
.phase4-card:nth-child(2) .vnum-arrow{ transition-delay:.4s; }
.phase4-card:nth-child(3) .vnum-arrow{ transition-delay:.8s; }
.phase4-card:nth-child(4) .vnum-arrow{ transition-delay:1.2s; }
.vnum-loop{
  color:var(--accent-electric); border:1px solid var(--accent-electric);
  border-radius:50%; padding:2px; box-sizing:content-box;
}
.section-tile.revealed .vnum-loop{
  animation:vnum-loop-spin 8s linear infinite, vnum-loop-glow 4s ease-in-out infinite;
}
@keyframes vnum-loop-spin{ to{ transform:rotate(360deg); } }
@keyframes vnum-loop-glow{ 0%,100%{ box-shadow:0 0 0 0 rgba(47,111,255,0.4); } 50%{ box-shadow:0 0 6px 2px rgba(47,111,255,0.35); } }
.phase4-loop-label{
  display:block; margin-top:10px; font-family:var(--mono); font-size:10.5px;
  letter-spacing:0.04em; text-transform:uppercase; color:var(--accent-electric);
}
```

- [ ] **Step 3: Rebuild and verify**

```bash
node scripts/build.js
node --test
```
Expected: build completes, 69/69 tests pass.

- [ ] **Step 4: Manual verification**

- Confirm all 4 cards show a small icon next to their step number, cards 1-3 a
  plain chevron in the existing teal accent, card 4 a ringed loop icon in
  electric blue.
- Confirm the icons fade/scale in with a staggered delay (0/.4/.8/1.2s) the
  first time the section scrolls into view, and do NOT replay on subsequent
  scrolls past the section.
- Confirm card 4's loop icon keeps a slow continuous rotation + glow pulse
  after the initial reveal.
- Confirm layout is unaffected at all three grid breakpoints (4-col, 2-col,
  1-col via `resize_window`).
- Confirm both themes.

- [ ] **Step 5: Commit**

```bash
git add src/main.js assets/app.css assets/app.js index.html
git commit -m "Restyle How It Works tiles as a repeating cycle"
```

---

### Task 3: "Three Phases" Staggered Reveal

**Files:**
- Modify: `src/main.js` (`renderHomeTab()`'s `stageOrder.map(...)` block for
  `.workflow-row`, near line 1484)
- Modify: `src/styles/app.css` (new reveal-gating rules near `.workflow-row`,
  line 1466)

**Interfaces:**
- Consumes: the existing `.revealed` class on the parent `.section-tile`
  (unchanged, same mechanism as Task 2).
- Produces: nothing consumed by later tasks - self-contained. Does not modify
  the existing click-to-expand `stage-detail-panel` logic
  (`src/main.js:1586-1630`) in any way.

- [ ] **Step 1: Add inline transition-delay to each step and arrow**

In `src/main.js`, in the `stageOrder.map((sid,i)=>` template (line 1484-1492),
add an inline `style` with the delay to both the arrow and the step div. Change:

```js
            ${i>0 ? `<div class="workflow-arrow">...</div>` : ''}
            <div class="workflow-step" data-stage-detail="${sid}" style="border-top:2px solid ${STAGE_META[sid].color}">
```

to:

```js
            ${i>0 ? `<div class="workflow-arrow" style="transition-delay:${(i*0.12).toFixed(2)}s"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>` : ''}
            <div class="workflow-step" data-stage-detail="${sid}" style="border-top:2px solid ${STAGE_META[sid].color}; transition-delay:${(i*0.12).toFixed(2)}s">
```

(Keep the existing inner content of `.workflow-arrow` and `.workflow-step`
exactly as it is today - only the opening tags gain the inline `style` delay
addition shown above, appended to `.workflow-step`'s existing
`border-top:...` inline style rather than replacing it.)

- [ ] **Step 2: Add the reveal-gating CSS**

In `src/styles/app.css`, add near the existing `.workflow-row` rule (line 1466):

```css
.section-tile:not(.revealed) .workflow-step,
.section-tile:not(.revealed) .workflow-arrow{ opacity:0; transform:translateY(16px); }
.section-tile.revealed .workflow-step,
.section-tile.revealed .workflow-arrow{
  opacity:1; transform:translateY(0);
  transition:opacity .5s ease, transform .5s ease;
}
```

- [ ] **Step 3: Rebuild and verify**

```bash
node scripts/build.js
node --test
```
Expected: build completes, 69/69 tests pass.

- [ ] **Step 4: Manual verification**

- Confirm the three phase tiles (and their connecting arrows) fade/slide in
  with a visible stagger the first time the section scrolls into view, and do
  not replay on later scrolls.
- Confirm clicking a phase tile still opens its detail panel exactly as before,
  both immediately after the reveal animation and after scrolling away and back.
- Confirm the mobile stacked layout (`max-width:700px`, column direction,
  arrows rotated 90°) still staggers top-to-bottom sensibly.
- Confirm both themes.

- [ ] **Step 5: Commit**

```bash
git add src/main.js assets/app.css assets/app.js index.html
git commit -m "Add staggered scroll-reveal to Three Phases homepage tiles"
```

---

### Task 4: Mobile Nav Accordion

**Files:**
- Modify: `src/main.js` (`renderHamburgerMenu()`'s `openMenu()`, near line 1162)
- Modify: `src/styles/app.css` (new `.mobile-nav-toggle`, `.mobile-nav-sublist`,
  `.mobile-nav-chevron` rules near line 412)

**Interfaces:**
- Consumes: `TOP_TABS`, `NAV_DROPDOWN_MAP`, `activeTab`, `pathForTab()`,
  `wireNavLinksByDataset()` - all existing, unchanged.
- Produces: nothing consumed by later tasks - self-contained.

- [ ] **Step 1: Rewrite the panel template with per-category toggles**

In `src/main.js`, replace the `panel.innerHTML = TOP_TABS.map(t=>{...}).join('');`
block inside `openMenu()` (lines 1168-1179):

```js
    panel.innerHTML = TOP_TABS.map(t=>{
      const dd = NAV_DROPDOWN_MAP[t.id];
      // categoryOnly tabs render as a plain section heading (no href to a
      // page that doesn't exist) - only Home/Assessment are real links here.
      const heading = t.categoryOnly
        ? `<div class="mobile-nav-heading">${t.label}</div>`
        : `<a class="mobile-nav-link ${activeTab===t.id?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${t.label}</a>`;
      return `
        ${heading}
        ${(dd||[]).map(d=>`<a class="mobile-nav-sublink ${activeTab===d.id?'active':''}" href="${pathForTab(d.id)}" data-tab="${d.id}">${d.label}</a>`).join('')}
      `;
    }).join('');
```

with:

```js
    panel.innerHTML = TOP_TABS.map(t=>{
      const dd = NAV_DROPDOWN_MAP[t.id];
      if(!t.categoryOnly){
        // Home/Assessment: real single links, unaffected by the accordion.
        return `<a class="mobile-nav-link ${activeTab===t.id?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${t.label}</a>`;
      }
      const containsActive = (dd||[]).some(d=>d.id===activeTab);
      return `
        <button type="button" class="mobile-nav-heading mobile-nav-toggle" data-category="${t.id}" aria-expanded="${containsActive}">
          ${t.label} <span class="mobile-nav-chevron">&#9662;</span>
        </button>
        <div class="mobile-nav-sublist ${containsActive ? 'open' : ''}" id="mobileSublist-${t.id}">
          ${(dd||[]).map(d=>`<a class="mobile-nav-sublink ${activeTab===d.id?'active':''}" href="${pathForTab(d.id)}" data-tab="${d.id}">${d.label}</a>`).join('')}
        </div>
      `;
    }).join('');
```

- [ ] **Step 2: Wire the toggle click handlers**

In `src/main.js`, immediately after the existing
`wireNavLinksByDataset(panel, '[data-tab]', closeMenu);` line inside `openMenu()`
(line 1181), add:

```js
    panel.querySelectorAll('.mobile-nav-toggle').forEach(toggle=>{
      toggle.addEventListener('click', (e)=>{
        e.stopPropagation();
        const sublist = document.getElementById(`mobileSublist-${toggle.dataset.category}`);
        const isOpen = sublist.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
    });
```

- [ ] **Step 3: Add the accordion CSS**

In `src/styles/app.css`, add near the existing `.mobile-nav-heading` rule (line
412):

```css
.mobile-nav-toggle{
  background:transparent; border:none; width:100%; font:inherit; cursor:pointer;
  display:flex; align-items:center; justify-content:space-between;
}
.mobile-nav-chevron{ transition:transform .2s ease; font-size:10px; }
.mobile-nav-toggle[aria-expanded="true"] .mobile-nav-chevron{ transform:rotate(180deg); }
.mobile-nav-sublist{ max-height:0; overflow:hidden; transition:max-height .25s ease; }
.mobile-nav-sublist.open{ max-height:400px; }
```

- [ ] **Step 4: Rebuild and verify**

```bash
node scripts/build.js
node --test
```
Expected: build completes, 69/69 tests pass.

- [ ] **Step 5: Manual verification**

At a mobile emulated width, open the hamburger menu on the homepage and on at
least one other page (e.g. a Resources sub-page):
- Confirm Home and Assessment still render as plain links with no toggle
  chevron.
- Confirm Framework/Resources/About (and any other categoryOnly tab) render as
  toggle buttons that independently expand/collapse their own sub-links -
  multiple can be open at once.
- Confirm the category containing the current page starts already expanded
  when the menu opens.
- Confirm tapping an actual sub-link still closes the entire mobile panel and
  navigates.
- Confirm scroll-to-close (existing behavior) still works.
- Confirm both themes.

- [ ] **Step 6: Commit**

```bash
git add src/main.js assets/app.css assets/app.js index.html
git commit -m "Collapse mobile nav sub-options into a per-category accordion"
```

---

### Task 5: Full-Site Verification Pass

**Files:** none (verification only; fixes discovered here land as amendments to
the relevant task's files, not new files)

**Interfaces:** none

- [ ] **Step 1: Full regression check**

```bash
node --test
node scripts/build.js
git diff --stat
```
Expected: 69/69 tests pass; `git diff --stat` (working tree vs the last commit)
is empty - if the build produced any drift, investigate before continuing.

- [ ] **Step 2: Live check across pages, both themes**

Using the Browser pane against the local dev server, for each of: Home,
Methodology, Maturity Model, at least one Resources sub-page (e.g. Runbooks),
and the Security Tooling Repository page:
- Toggle dark/light and confirm the background animates correctly and text
  stays legible over it in both.
- Confirm no page shows a layout shift, horizontal scrollbar, or console error.

- [ ] **Step 3: Mobile width check**

Using `resize_window` to an emulated mobile width, repeat the hamburger-menu
accordion check (Task 4, Step 5) on two different pages, and confirm the
How-It-Works and Three-Phases sections (Task 2 and 3) still look correct in the
single-column mobile layout.

- [ ] **Step 4: Screenshots**

Take and share screenshots of: the homepage in dark mode, the homepage in light
mode, and the mobile nav open (either theme) - the readability/regression proof
requested before merge.

- [ ] **Step 5: Hand off**

Announce: "I'm using the finishing-a-development-branch skill to complete this
work." and follow that skill: verify tests, present the merge/PR/keep-as-is
menu, and proceed only on explicit instruction - this project's standing rule is
to wait for an explicit "merge it" before merging.
