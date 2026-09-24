// Entry point: the app shell (masthead navigation, search, theme, mobile
// menu, animated background), the tab switcher, and the assessment and
// history tabs. Each content page lives in its own module under ./pages/,
// routes and link wiring in ./router.js.
import { createAssessmentController } from "./ui/assessment.js";
import { renderHistoryPage } from "./ui/history-view.js";
import { PLAYBOOKS } from "./content/playbooks.js";
import { CASE_STUDIES } from "./content/case-studies.js";
import { PHASES } from "./content/maturity.js";
import { GLOSSARY } from "./content/learning.js";
import { applyPageMeta } from "./ui/page-meta.js";
import { renderPrivacyPage, renderFeedbackPage, showCookieBanner, wireCookieSettingsButton } from "./ui/privacy.js";
import { FRAMEWORKS } from "./data/frameworks.js";
import { pathForTab, tabForPath, wireNavLink, wireNavLinksByDataset, activeTab, pendingAnchor, scrollToPendingAnchor, setActiveTab, setPendingAnchor, setNavigationHandler } from "./router.js";
import { icon, observeReveals } from "./pages/shared.js";
import { renderHomeTab } from "./pages/home.js";
import { renderMethodologyTab } from "./pages/methodology.js";
import { renderMaturityTab } from "./pages/maturity-model.js";
import { renderMetricsTab } from "./pages/metrics.js";
import { renderRoadmapTab } from "./pages/roadmap.js";
import { RUNBOOKS, renderRunbookTab } from "./pages/runbooks.js";
import { renderMaturityModelTab } from "./pages/what-is-simplifiedcs.js";
import { renderStarterGuideTab } from "./pages/starter-guide.js";
import { renderThreatModelingTab } from "./pages/threat-modeling.js";
import { renderNewsTab } from "./pages/news.js";
import { renderExploitsTab } from "./pages/exploits.js";
import { renderGlossaryTab } from "./pages/glossary.js";
import { renderReferencesTab } from "./pages/references.js";
import { renderAboutTab } from "./pages/about.js";
import { renderCorePrinciplesTab } from "./pages/core-principles.js";
import { renderPlaybooksTab } from "./pages/playbooks.js";
import { renderSecurityToolsTab } from "./pages/security-tools.js";
import { renderCaseStudyTab } from "./pages/case-studies.js";

const assessmentController = createAssessmentController({
  getPanel: () => document.getElementById("panel"),
  getRail: () => document.getElementById("rail"),
  icon: (name) => icon(name),
  pathForTab: (id, anchor) => pathForTab(id, anchor),
  wireNavLink: (el, id, anchor) => wireNavLink(el, id, anchor),
});

// Per-route <title> - previously every page said just "SimplifiedCS" no
// matter which tab was active, so browser tabs/history/bookmarks couldn't
// tell pages apart and a static prerendered snapshot of any route would
// have looked identical to every other. Applied in renderActiveTab().
const TAB_TITLES = {
  home: 'SimplifiedCS',
  methodology: 'Methodology - SimplifiedCS',
  maturity: 'Maturity Model - SimplifiedCS',
  metrics: 'Metrics - SimplifiedCS',
  coreprinciples: 'Core Principles - SimplifiedCS',
  maturitymodel: 'What Is SimplifiedCS?',
  starterguide: 'Starter Guide - SimplifiedCS',
  threatmodeling: 'Threat Modeling - SimplifiedCS',
  securitytools: 'Security Tools Repository - SimplifiedCS',
  roadmap: 'Roadmap - SimplifiedCS',
  runbook: 'Runbooks - SimplifiedCS',
  news: 'Cybersecurity News - SimplifiedCS',
  exploits: 'Exploit Tracker - SimplifiedCS',
  casestudy: 'Case Studies - SimplifiedCS',
  playbooks: 'Playbooks - SimplifiedCS',
  glossary: 'Glossary - SimplifiedCS',
  references: 'References - SimplifiedCS',
  about: 'About - SimplifiedCS',
  feedback: 'Feedback - SimplifiedCS',
  privacy: 'Privacy - SimplifiedCS',
  assessment: 'Assessment - SimplifiedCS',
  history: 'History - SimplifiedCS',
};

export let theme = 'dark';
// HEADER-REDESIGN-BRIEF.md: six top-level categories, each holding its own
// real destinations - Home and Assessment are themselves real pages in
// addition to being dropdown parents (categoryOnly is absent so their
// label stays a real link), while Framework/Learn/Resources/Insights exist
// only as groupings with no page of their own (categoryOnly:true - see
// renderTabNav()/renderHamburgerMenu() for how that's rendered as a
// toggle-only trigger instead of a dead link to "/").
const TOP_TABS = [
  { id:'home', label:'Home' },
  { id:'framework', label:'Framework', categoryOnly:true },
  { id:'learn', label:'Learn', categoryOnly:true },
  { id:'resources', label:'Resources', categoryOnly:true },
  { id:'insights', label:'Insights', categoryOnly:true },
  { id:'assessment', label:'Assessment' },
];
const HOME_DROPDOWN = [
  { id:'maturitymodel', label:'What is SimplifiedCS?' },
  { id:'methodology', label:'Methodology' },
  { id:'roadmap', label:'Roadmap' },
  { id:'about', label:'About' },
];
const FRAMEWORK_DROPDOWN = [
  { id:'maturity', label:'Maturity Model' },
  { id:'coreprinciples', label:'Core Principles' },
  { id:'metrics', label:'Metrics' },
];
const LEARN_DROPDOWN = [
  { id:'starterguide', label:'Starter Guide' },
  { id:'threatmodeling', label:'Threat Modeling & Forensics' },
  { id:'glossary', label:'Glossary' },
  { id:'securitytools', label:'Security Tooling Repository' },
];
const RESOURCES_DROPDOWN = [
  { id:'runbook', label:'Runbooks' },
  { id:'playbooks', label:'Playbooks' },
];
const INSIGHTS_DROPDOWN = [
  { id:'news', label:'Trends & News' },
  { id:'exploits', label:'Exploits' },
  { id:'casestudy', label:'Case Studies' },
];
const ASSESSMENT_DROPDOWN = [
  { id:'assessment', label:'Take Assessment' },
  { id:'history', label:'History' },
];
const NAV_DROPDOWN_MAP = {
  home: HOME_DROPDOWN,
  framework: FRAMEWORK_DROPDOWN,
  learn: LEARN_DROPDOWN,
  resources: RESOURCES_DROPDOWN,
  insights: INSIGHTS_DROPDOWN,
  assessment: ASSESSMENT_DROPDOWN,
};

// False until the first render: the first page load keeps the browser's
// normal starting focus; only later in-site navigations move it.
let hasRenderedOnce = false;

function renderApp(){
  const isNavigation = hasRenderedOnce;
  hasRenderedOnce = true;
  // Every navigation funnels through here (goToTab's forward-nav and the
  // popstate back/forward handler both call this), so it's the one place
  // that can reliably reset scroll position - without it, a page you
  // navigate to keeps whatever scrollY the previous page was at, which
  // reads as landing mid-page instead of at the top. Instant, not smooth -
  // arriving at a new page should snap the way a real navigation does;
  // smooth is reserved for scrollToPendingAnchor() below, which animates
  // to a specific element *within* the page that just loaded. Anchor-
  // targeted nav (pendingAnchor set) skips this reset entirely.
  if(!pendingAnchor) window.scrollTo(0, 0);
  const tc = document.getElementById('tabContent');
  if(tc && tc.childNodes.length){
    tc.classList.add('tab-fade');
    setTimeout(()=>{
      renderTabNav();
      renderThemeToggle();
      renderActiveTab();
      requestAnimationFrame(()=>{
        tc.classList.remove('tab-fade');
        observeReveals();
        if(isNavigation && !pendingAnchor) focusPageHeading({ scroll:false });
        scrollToPendingAnchor();
      });
    }, 160);
  } else {
    renderTabNav();
    renderThemeToggle();
    renderActiveTab();
    observeReveals();
    scrollToPendingAnchor();
  }
}

// After an in-site navigation, move keyboard and screen-reader focus to the
// new page's heading - the equivalent of a full page load putting the
// reader at the top of the new page. Without it, focus stays on the link
// that was clicked and nothing tells a screen-reader user the page changed.
// Also used by the "Skip to main content" link.
function focusPageHeading({ scroll }){
  const main = document.getElementById('tabContent');
  const target = (main && main.querySelector('h2')) || main;
  if(!target) return;
  if(!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: !scroll });
}

function renderTabNav(){
  const nav = document.getElementById('tabnav');

  const navHtml = TOP_TABS.map(t=>{
    const dd = NAV_DROPDOWN_MAP[t.id];
    if(dd){
      const parentActive = activeTab===t.id || dd.some(d=>d.id===activeTab);
      // categoryOnly tabs (Framework/Learn/Resources/Insights) have no page
      // of their own - pathForTab() would silently fall back to "/" - so
      // the whole trigger just toggles the dropdown like the caret does,
      // rather than being a real link to a page that doesn't exist.
      const trigger = t.categoryOnly
        ? `<button type="button" class="tab-btn ${parentActive?'active':''}" data-toggle="1">${t.label} <span class="tab-caret">▾</span></button>`
        : `<a class="tab-btn ${parentActive?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${t.label} <span class="tab-caret" data-toggle="1">▾</span></a>`;
      return `
        <div class="tab-item has-dropdown">
          ${trigger}
          <div class="tab-dropdown">
            ${dd.map(d=>`<a class="dropdown-link ${activeTab===d.id?'active':''}" href="${pathForTab(d.id)}" data-tab="${d.id}">${d.label}</a>`).join('')}
          </div>
        </div>
      `;
    }
    return `<a class="tab-btn ${activeTab===t.id?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${t.label}</a>`;
  }).join('');

  nav.innerHTML = navHtml;

  wireNavLinksByDataset(nav, '[data-tab]');
  nav.querySelectorAll('[data-toggle]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      e.preventDefault();
      const item = el.closest('.tab-item');
      const wasOpen = item.classList.contains('open');
      nav.querySelectorAll('.tab-item.open').forEach(i=>i.classList.remove('open'));
      if(!wasOpen) item.classList.add('open');
    });
  });
  if(!window._tabnavOutsideClickBound){
    document.addEventListener('click', (e)=>{
      if(!e.target.closest('.tab-item')){
        document.querySelectorAll('.tab-item.open').forEach(i=>i.classList.remove('open'));
      }
    });
    window._tabnavOutsideClickBound = true;
  }
  if(!window._footerLinksBound){
    // renderApp() itself now resets scroll on every navigation without a
    // pending anchor, so this no longer needs its own scroll-to-top callback.
    wireNavLinksByDataset(document, '.footer-links a[data-tab]');
    const brandLink = document.getElementById('brandHomeLink');
    if(brandLink) wireNavLink(brandLink, 'home');
    window._footerLinksBound = true;
  }
}

function renderThemeToggle(){
  const btn = document.getElementById('themeToggle');
  const isLight = theme === 'light';
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', String(isLight));
  // A switch is named for what it turns on; its checked state says whether it is
  // on. ("Switch to light mode, on" would contradict itself.)
  btn.setAttribute('aria-label', 'Light mode');
  btn.innerHTML = `
    <span class="theme-switch-track">
      <span class="theme-switch-thumb">${icon(isLight ? 'sun' : 'moon')}</span>
    </span>
  `;
  btn.onclick = ()=>{
    theme = isLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    renderThemeToggle();
    try { localStorage.setItem('simplifiedcs:theme', theme); } catch(e){ /* ignore - see init()'s comment */ }
  };
}

// --- Site search: covers nav destinations plus deeper content (glossary,
// runbooks, playbooks, frameworks, case studies, maturity phases). Built
// once, lazily, since every source array is a module-level const that's
// fully initialized by the time a user could actually trigger a search. ---
let searchIndexCache = null;
function getSearchIndex(){
  if(searchIndexCache) return searchIndexCache;
  const idx = [];
  TOP_TABS.forEach(t=>{
    // categoryOnly tabs (Framework/Learn/...) aren't a real destination -
    // only their dropdown children are searchable pages.
    if(!t.categoryOnly) idx.push({ type:'Page', title:t.label, tab:t.id });
    (NAV_DROPDOWN_MAP[t.id] || []).forEach(d=> idx.push({ type:'Page', title:d.label, tab:d.id }));
  });
  GLOSSARY.forEach(g=> idx.push({ type:'Glossary', title:g.term, sub:g.def, tab:'glossary' }));
  RUNBOOKS.forEach(r=> idx.push({ type:'Runbook', title:r.title, sub:r.sub, tab:'runbook' }));
  PLAYBOOKS.forEach(p=> idx.push({ type:'Playbook', title:`${p.ref} ${p.title}`, sub:p.desc, tab:'playbooks' }));
  FRAMEWORKS.forEach(f=> idx.push({ type:'Framework', title:f.name, sub:f.desc, tab:'assessment' }));
  CASE_STUDIES.forEach(c=> idx.push({ type:'Case Study', title:c.title, sub:c.body, tab:'casestudy' }));
  PHASES.forEach(p=> idx.push({ type:'Maturity Phase', title:`Phase ${p.num}: ${p.title}`, sub:p.desc, tab:'maturity', anchor:`maturity-${p.stage}` }));
  searchIndexCache = idx;
  return idx;
}
function searchSite(query){
  const q = query.trim().toLowerCase();
  if(!q) return [];
  const scored = [];
  getSearchIndex().forEach(item=>{
    const title = item.title.toLowerCase();
    let score = 0;
    if(title === q) score = 100;
    else if(title.startsWith(q)) score = 80;
    else if(title.includes(q)) score = 60;
    else if(item.sub && item.sub.toLowerCase().includes(q)) score = 30;
    if(score) scored.push({ ...item, score });
  });
  scored.sort((a,b)=> b.score - a.score);
  return scored.slice(0, 8);
}
function renderSearchWidget(){
  const widget = document.getElementById('searchWidget');
  if(!widget) return;
  widget.innerHTML = `
    <button class="search-toggle-btn" id="searchToggleBtn" aria-label="Search" type="button">${icon('hiw-magnify')}</button>
    <input type="text" class="search-input" id="searchInput" placeholder="Search the site…" autocomplete="off" />
    <div class="search-results" id="searchResults"></div>
  `;
  const toggleBtn = document.getElementById('searchToggleBtn');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  function renderResults(){
    const matches = searchSite(input.value);
    if(!input.value.trim()){
      results.innerHTML = '';
      results.classList.remove('open');
      return;
    }
    results.innerHTML = matches.length
      ? matches.map(m=>`
          <a class="search-result" href="${pathForTab(m.tab, m.anchor)}" data-tab="${m.tab}" ${m.anchor ? `data-anchor="${m.anchor}"` : ''}>
            <span class="search-result-type">${m.type}</span>
            <span class="search-result-title">${m.title}</span>
          </a>
        `).join('')
      : `<div class="search-empty">No matches for "${input.value.trim()}"</div>`;
    results.classList.add('open');
    wireNavLinksByDataset(results, '.search-result', closeSearch);
  }
  const mastheadRight = widget.closest('.masthead-right');
  function openSearch(){
    widget.classList.add('expanded');
    if(mastheadRight) mastheadRight.classList.add('search-active');
    input.focus();
  }
  function closeSearch(){
    widget.classList.remove('expanded');
    if(mastheadRight) mastheadRight.classList.remove('search-active');
    input.value = '';
    results.innerHTML = '';
    results.classList.remove('open');
  }
  toggleBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(widget.classList.contains('expanded')) closeSearch();
    else openSearch();
  });
  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeSearch(); });
  document.addEventListener('click', (e)=>{
    if(widget.classList.contains('expanded') && !e.target.closest('.search-widget')) closeSearch();
  });
  window.addEventListener('scroll', ()=>{
    if(widget.classList.contains('expanded')) closeSearch();
  }, { passive:true });
}

// --- Mobile nav: collapses the top nav into a single menu button below a
// breakpoint, listing every top-level tab plus its dropdown children flat. ---
function renderHamburgerMenu(){
  const btn = document.getElementById('navHamburger');
  if(!btn) return;
  let panelOpen = false;
  function render(){
    btn.innerHTML = icon(panelOpen ? 'close' : 'menu');
    btn.setAttribute('aria-expanded', String(panelOpen));
  }
  function closeMenu(){
    panelOpen = false;
    const panel = document.getElementById('mobileNavPanel');
    if(panel) panel.remove();
    render();
  }
  function openMenu(){
    panelOpen = true;
    render();
    const panel = document.createElement('div');
    panel.className = 'mobile-nav-panel';
    panel.id = 'mobileNavPanel';
    panel.setAttribute('role', 'navigation');
    panel.setAttribute('aria-label', 'Main');
    panel.innerHTML = TOP_TABS.map(t=>{
      const dd = NAV_DROPDOWN_MAP[t.id];
      if(!dd || !dd.length){
        // No dropdown content at all - a plain link. Not currently true for
        // any TOP_TABS entry (every one of them has a NAV_DROPDOWN_MAP
        // entry), but kept as a safe fallback.
        return `<a class="mobile-nav-link ${activeTab===t.id?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${t.label}</a>`;
      }
      // A category auto-expands, and shows a "you're in here" accent
      // color on its own heading/link, whenever the active page is one of
      // its sub-pages - explicitly requested: the user wants the current
      // location visible at both the top-level and sub-option level, and
      // is fine with the dropdown being shown open to achieve that.
      // isExactActive (the category's OWN page, only possible for
      // Home/Assessment) and containsOnlyChildActive (a sub-page under it
      // is active) are kept separate so a plain "contains" accent never
      // overrides the stronger "this exact page" .active treatment.
      const isExactActive = activeTab === t.id;
      const containsChildActive = dd.some(d=>d.id===activeTab);
      const expanded = isExactActive || containsChildActive;
      const sublist = `
        <div class="mobile-nav-sublist ${expanded ? 'open' : ''}" id="mobileSublist-${t.id}">
          ${dd.map(d=>`<a class="mobile-nav-sublink ${activeTab===d.id?'active':''}" href="${pathForTab(d.id)}" data-tab="${d.id}">${d.label}</a>`).join('')}
        </div>
      `;
      if(t.categoryOnly){
        // Framework/Learn/Resources/Insights have no page of their own -
        // the whole header is the toggle, like the desktop nav's
        // caret-only trigger for these same tabs. containsChildActive is
        // the only "you are here" signal they can ever show, since they
        // have no page of their own to be exactly active.
        return `
          <button type="button" class="mobile-nav-heading mobile-nav-toggle ${containsChildActive ? 'contains-active' : ''}" data-category="${t.id}" aria-expanded="${expanded}">
            ${t.label} <span class="mobile-nav-chevron">&#9662;</span>
          </button>
          ${sublist}
        `;
      }
      // Home/Assessment: a real link to their own page AND a dropdown of
      // sub-pages - exactly like their desktop nav-bar trigger (a link plus
      // a separate caret that toggles the dropdown). This branch previously
      // rendered only a plain link, silently dropping their dropdown
      // content on mobile even though desktop showed it correctly.
      return `
        <div class="mobile-nav-heading-row">
          <a class="mobile-nav-link mobile-nav-link-with-toggle ${isExactActive ? 'active' : containsChildActive ? 'contains-active' : ''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${t.label}</a>
          <button type="button" class="mobile-nav-toggle mobile-nav-toggle-caret" data-category="${t.id}" aria-expanded="${expanded}" aria-label="Toggle ${t.label} submenu">
            <span class="mobile-nav-chevron">&#9662;</span>
          </button>
        </div>
        ${sublist}
      `;
    }).join('');
    document.querySelector('.masthead').appendChild(panel);
    wireNavLinksByDataset(panel, '[data-tab]', closeMenu);
    panel.querySelectorAll('.mobile-nav-toggle').forEach(toggle=>{
      toggle.addEventListener('click', (e)=>{
        e.stopPropagation();
        const sublist = document.getElementById(`mobileSublist-${toggle.dataset.category}`);
        const isOpen = sublist.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
    });
    requestAnimationFrame(()=> panel.classList.add('open'));
  }
  render();
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(panelOpen) closeMenu(); else openMenu();
  });
  document.addEventListener('click', (e)=>{
    if(panelOpen && !e.target.closest('#mobileNavPanel') && !e.target.closest('#navHamburger')) closeMenu();
  });
  window.addEventListener('scroll', ()=>{ if(panelOpen) closeMenu(); }, { passive:true });
}

function goToTab(id, anchor){
  // ASSESSMENT-REPORT-DEPTH-BRIEF.md §2: re-clicking "Assessment" while
  // already viewing it (Sample Report, mid-wizard, results) is a deliberate
  // "start over" action, not a same-tab no-op - requestLanding() confirms
  // first if that would discard real in-progress work, and this is also
  // what fixes the confirmed "does nothing while viewing a Sample Report"
  // bug (that phase previously just re-rendered itself identically).
  if(id === 'assessment' && activeTab === 'assessment'){
    assessmentController.requestLanding();
    return;
  }
  setActiveTab(id);
  setPendingAnchor(anchor || null);
  const path = pathForTab(id, anchor);
  if(location.pathname + location.hash !== path){
    history.pushState({ tab:id, anchor: anchor || null }, '', path);
  }
  renderApp();
}

function renderActiveTab(){
  const container = document.getElementById('tabContent');
  document.title = location.pathname.replace(/\/+$/, "") === "/assessment/sample" ? "Example Reports - SimplifiedCS" : (TAB_TITLES[activeTab] || 'SimplifiedCS');
  applyPageMeta(activeTab, document.title, location.pathname);
  if(activeTab === 'home') renderHomeTab(container);
  else if(activeTab === 'methodology') renderMethodologyTab(container);
  else if(activeTab === 'maturity') renderMaturityTab(container);
  else if(activeTab === 'metrics') renderMetricsTab(container);
  else if(activeTab === 'coreprinciples') renderCorePrinciplesTab(container);
  else if(activeTab === 'maturitymodel') renderMaturityModelTab(container);
  else if(activeTab === 'starterguide') renderStarterGuideTab(container);
  else if(activeTab === 'threatmodeling') renderThreatModelingTab(container);
  else if(activeTab === 'securitytools') renderSecurityToolsTab(container);
  else if(activeTab === 'roadmap') renderRoadmapTab(container);
  else if(activeTab === 'runbook') renderRunbookTab(container);
  else if(activeTab === 'news') renderNewsTab(container);
  else if(activeTab === 'exploits') renderExploitsTab(container);
  else if(activeTab === 'casestudy') renderCaseStudyTab(container);
  else if(activeTab === 'playbooks') renderPlaybooksTab(container);
  else if(activeTab === 'glossary') renderGlossaryTab(container);
  else if(activeTab === 'references') renderReferencesTab(container);
  else if(activeTab === 'about') renderAboutTab(container);
  else if(activeTab === 'feedback') renderFeedbackPage(container);
  else if(activeTab === 'privacy') renderPrivacyPage(container);
  else if(activeTab === 'assessment') renderAssessmentTab(container);
  else if(activeTab === 'history'){
    container.innerHTML = `<div class="page" id="panel"></div>`;
    renderHistory();
  }
}

function renderAssessmentTab(container){
  container.innerHTML = `
    <div class="assessment-serial" id="serial"></div>
    <div class="layout">
      <div class="rail" id="rail"></div>
      <div><div class="panel" id="panel"></div></div>
    </div>
  `;
  assessmentController.renderCurrentPhase();
}

// Completed assessments saved in this browser - see ./ui/history-view.js.
function renderHistory(){
  renderHistoryPage({
    panel: document.getElementById('panel'),
    pathForTab,
    wireNavLink,
    openRun: (id) => assessmentController.openRun(id),
    goToAssessment: () => goToTab('assessment'),
    onChange: () => renderHistory(),
  });
  observeReveals();
}

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

(async function init(){
  // The browser's own automatic scroll restoration on back/forward fights
  // with renderApp()'s own scroll-to-top-or-anchor handling below - without
  // this, popstate ends up with whatever scrollY the browser decided to
  // restore for that history entry instead of what the app just set,
  // since both run on the same navigation. 'manual' hands scroll
  // ownership entirely to the app, which is what a pushState-routed SPA
  // is expected to do.
  if('scrollRestoration' in history) history.scrollRestoration = 'manual';
  // ICON-THEME-QUALITY-BRIEF.md §2: window.storage only exists inside
  // Claude's own sandbox, not on the real deployed site - every call here
  // was silently failing in production, so the theme choice has never
  // actually persisted between visits despite the code appearing to try.
  // localStorage is the real, synchronous, browser-native equivalent
  // (already used the same way for the assessment's save/resume feature).
  // Priority: a stored manual choice always wins; otherwise detect the
  // system/browser preference once, on this initial load only (no live
  // listener - a mid-session OS theme change intentionally doesn't retheme
  // an already-open page); if neither is available, `theme` keeps its
  // 'dark' module-level default.
  try {
    const stored = localStorage.getItem('simplifiedcs:theme');
    if(stored === 'light' || stored === 'dark'){
      theme = stored;
    } else if(typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches){
      theme = 'light';
    }
  } catch(e){ /* default to dark */ }
  document.documentElement.setAttribute('data-theme', theme);
  initAnimatedBackground();
  renderSearchWidget();
  renderHamburgerMenu();
  setNavigationHandler(goToTab);
  renderApp();
  // The link's own #tabContent jump would go through the router (popstate)
  // and re-render the page, so move focus directly instead.
  document.querySelector('.skip-link')?.addEventListener('click', (e)=>{
    e.preventDefault();
    focusPageHeading({ scroll:true });
  });
  // Analytics are off until the visitor chooses (assets/gtag-init.js).
  showCookieBanner();
  wireCookieSettingsButton();
  // Back/forward: the URL has already changed by the time this fires, so
  // just read it and re-render - no pushState here, goToTab() already
  // handles the forward-navigation case.
  window.addEventListener('popstate', ()=>{
    setActiveTab(tabForPath(location.pathname));
    setPendingAnchor(location.hash ? location.hash.slice(1) : null);
    renderApp();
  });
})();
