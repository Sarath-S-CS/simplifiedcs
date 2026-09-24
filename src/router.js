// Routes and in-app navigation shared by the shell (main.js) and the page
// modules: the URL for each tab, link wiring that keeps real hrefs (so
// Ctrl/middle-click still open a new tab), and the current tab / pending
// #anchor. main.js registers the function that actually navigates
// (goToTab) with setNavigationHandler(), so pages can wire links without
// importing main.js.

// --- Client-side routing (ROUTING-FIX-BRIEF.md): real URL paths for every
// top-level tab, layered onto the existing activeTab+renderApp() rendering
// model via pushState/popstate rather than replacing it. Every tab id below
// maps 1:1 to a kebab-case path; the assessment wizard itself stays a
// single /assessment route (deliberately not routed step-by-step per the
// brief - it's a stateful in-progress form, not a set of bookmarkable pages).
const ROUTES = {
  home: '/',
  methodology: '/methodology',
  maturity: '/maturity-model',
  metrics: '/metrics',
  coreprinciples: '/core-principles',
  maturitymodel: '/what-is-simplifiedcs',
  starterguide: '/starter-guide',
  threatmodeling: '/threat-modeling',
  securitytools: '/security-tools-repository',
  roadmap: '/roadmap',
  runbook: '/runbooks',
  news: '/news',
  exploits: '/exploits',
  casestudy: '/case-studies',
  playbooks: '/playbooks',
  glossary: '/glossary',
  references: '/references',
  about: '/about',
  engineering: '/engineering',
  feedback: '/feedback',
  privacy: '/privacy',
  assessment: '/assessment',
  history: '/history',
};
const PATH_TO_TAB = Object.fromEntries(Object.entries(ROUTES).map(([id, path]) => [path, id]));

export function pathForTab(id, anchor){
  const base = ROUTES[id] || '/';
  return anchor ? `${base}#${anchor}` : base;
}
export function tabForPath(pathname){
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  // /assessment/sample is the one sub-state of the assessment tab with its
  // own real URL (see ui/assessment.js's currentPathIsSample()) - every
  // other assessment phase (scope/profile/wizard/results) stays unrouted,
  // so this is a one-off rather than a second entry in ROUTES/PATH_TO_TAB.
  if(clean === '/assessment/sample') return 'assessment';
  return PATH_TO_TAB[clean] || 'home';
}

// Set by main.js at startup (its goToTab), so the link helpers below can
// navigate without this module importing main.js.
let navigate = (tab, anchor) => {};
export function setNavigationHandler(fn){ navigate = fn; }

// Distinguishes a plain in-app nav click from one that should fall through
// to the browser's own new-tab/new-window handling. Unconditional
// preventDefault() - the bug this whole file exists to fix - would swallow
// Ctrl/Cmd/Shift/middle-click too, not just plain-click's default same-tab
// navigation, which is exactly what broke "open link in new tab" before.
function isPlainLeftClick(e){
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
// Shared click-wiring for internal nav elements now that they carry real
// hrefs. getTarget(e) returns {tab, anchor}. onNavigate is for the handful
// of call sites doing something extra beyond navigation (closing a menu,
// scrolling to top) - gated behind the same plain-click check so it only
// runs on the intercepted, same-tab path, never when the browser is about
// to open the href in a new tab/window on its own.
export function wireNavClick(el, getTarget, onNavigate){
  el.addEventListener('click', (e)=>{
    if(!isPlainLeftClick(e)) return;
    const target = getTarget(e);
    if(!target || !target.tab) return;
    e.preventDefault();
    navigate(target.tab, target.anchor);
    if(onNavigate) onNavigate();
  });
}
export function wireNavLink(el, tab, anchor, onNavigate){
  wireNavClick(el, ()=> ({ tab, anchor }), onNavigate);
}
// Delegated wiring over every element matching selector within container,
// each carrying its own data-tab (+ optional data-anchor) - the common case
// across this file for template-string-rendered lists of nav links.
export function wireNavLinksByDataset(container, selector, onNavigate){
  container.querySelectorAll(selector).forEach(el=>{
    wireNavClick(el, ()=> ({ tab: el.dataset.tab, anchor: el.dataset.anchor || undefined }), onNavigate);
  });
}

export let activeTab = tabForPath(location.pathname);
export function setActiveTab(id){ activeTab = id; }
export let pendingAnchor = location.hash ? location.hash.slice(1) : null;
export function setPendingAnchor(anchor){ pendingAnchor = anchor; }

// Only clears pendingAnchor on a successful scroll. renderApp() calls this
// right after renderActiveTab(), but tabs that load live data (e.g.
// Exploits) haven't rendered their real content yet at that point - the
// target element doesn't exist until the async load finishes. Leaving
// pendingAnchor set on a miss lets those tabs call this again once their
// content is actually in the DOM (see renderExploitsTab) instead of the
// anchor being silently swallowed on the first, too-early attempt.
export function scrollToPendingAnchor(){
  if(!pendingAnchor) return;
  const el = document.getElementById(pendingAnchor);
  if(el && typeof el.scrollIntoView === 'function'){
    // CONSOLIDATED-WORK-BRIEF.md §2: landing directly on a specific
    // Playbook entry (e.g. from a report's "see the matching Playbook"
    // link) previously just scrolled to its still-collapsed accordion
    // header - technically correct, but the content the link promised
    // stayed hidden. Generic on purpose (not Playbooks-specific): any
    // anchor-linked .acc-card, on any page, opens when landed on.
    const card = el.closest('.acc-card');
    if(card) card.classList.add('open');
    el.scrollIntoView({ behavior:'smooth', block:'start' });
    pendingAnchor = null;
  }
}
