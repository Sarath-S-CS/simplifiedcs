// Entry point. Everything below activeTab/theme through the tab renderers is
// preserved verbatim from the original index.html <script> - unchanged by
// this rebuild. Only the assessment engine itself (STEPS/PRE_STEPS/
// INDUSTRIES/REGIONS/FRAMEWORKS/VENDOR_NOTES + their render/scoring
// functions) was replaced, by the imports and controller below.
import { createAssessmentController } from "./ui/assessment.js";
import { INDUSTRIES } from "./data/industries.js";
// FUNCTIONS/FUNC_COLORS used to be plain globals at the top of the original
// script; the Methodology tab's function-legend (an educational reference
// explaining what NIST CSF's six functions ARE - correctly left showing the
// real function names, unlike the assessment UI's §5.9 relabeling) still
// reads them directly, so they need to stay available at this scope too.
import { FUNCTIONS, FUNC_COLORS } from "./data/categories.js";
import { supabase } from "./data/supabase-client.js";
import { FRAMEWORKS } from "./data/frameworks.js";

const assessmentController = createAssessmentController({
  getPanel: () => document.getElementById("panel"),
  getRail: () => document.getElementById("rail"),
  icon: (name) => icon(name),
  pathForTab: (id, anchor) => pathForTab(id, anchor),
  wireNavLink: (el, id, anchor) => wireNavLink(el, id, anchor),
  // Forward at call time (not a captured reference) - matches the original
  // code's pattern of always reading window.storage fresh, since it's a
  // host-provided API that may not exist yet at module-init time (see the
  // try/catch around every call site: it's absent entirely on a real
  // Netlify deploy today, and only present inside a Claude.ai artifact
  // preview - see §7 of CLAUDE.md for the real-database replacement plan).
  storage: {
    get: (...args) => window.storage.get(...args),
    set: (...args) => window.storage.set(...args),
    list: (...args) => window.storage.list(...args),
    delete: (...args) => window.storage.delete(...args),
  },
});

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
  roadmap: '/roadmap',
  runbook: '/runbooks',
  news: '/news',
  exploits: '/exploits',
  casestudy: '/case-studies',
  playbooks: '/playbooks',
  glossary: '/glossary',
  references: '/references',
  about: '/about',
  feedback: '/feedback',
  assessment: '/assessment',
  history: '/history',
};
const PATH_TO_TAB = Object.fromEntries(Object.entries(ROUTES).map(([id, path]) => [path, id]));

function pathForTab(id, anchor){
  const base = ROUTES[id] || '/';
  return anchor ? `${base}#${anchor}` : base;
}
function tabForPath(pathname){
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PATH_TO_TAB[clean] || 'home';
}

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
function wireNavClick(el, getTarget, onNavigate){
  el.addEventListener('click', (e)=>{
    if(!isPlainLeftClick(e)) return;
    const target = getTarget(e);
    if(!target || !target.tab) return;
    e.preventDefault();
    goToTab(target.tab, target.anchor);
    if(onNavigate) onNavigate();
  });
}
function wireNavLink(el, tab, anchor, onNavigate){
  wireNavClick(el, ()=> ({ tab, anchor }), onNavigate);
}
// Delegated wiring over every element matching selector within container,
// each carrying its own data-tab (+ optional data-anchor) - the common case
// across this file for template-string-rendered lists of nav links.
function wireNavLinksByDataset(container, selector, onNavigate){
  container.querySelectorAll(selector).forEach(el=>{
    wireNavClick(el, ()=> ({ tab: el.dataset.tab, anchor: el.dataset.anchor || undefined }), onNavigate);
  });
}

let activeTab = tabForPath(location.pathname);
let theme = 'dark';
const TOP_TABS = [
  { id:'home', label:'Home' },
  { id:'methodology', label:'Methodology' },
  { id:'maturity', label:'Maturity Model' },
  { id:'news', label:'Trends & News' },
  { id:'exploits', label:'Exploits' },
  { id:'assessment', label:'Assessment' },
];
const HOME_DROPDOWN = [
  { id:'maturitymodel', label:'What is SimplifiedCS?' },
  { id:'starterguide', label:'Starter Guide' },
  { id:'threatmodeling', label:'Threat Modeling & Forensics' },
  { id:'coreprinciples', label:'Core Principles' },
  { id:'roadmap', label:'Roadmap' },
  { id:'metrics', label:'Metrics' },
  { id:'runbook', label:'Runbooks' },
  { id:'playbooks', label:'Playbooks' },
  { id:'casestudy', label:'Case Studies' },
  { id:'glossary', label:'Glossary' },
  { id:'about', label:'About' },
];
const ASSESSMENT_DROPDOWN = [
  { id:'assessment', label:'Take Assessment' },
  { id:'history', label:'History' },
];

// Curated snapshot, written in original wording from public reporting - see the
// freshness note rendered in the News tab for how this would be kept live in production.
const NEWS_ITEMS = [
  { date:'2026-08-01', cat:'vuln', catLabel:'Vulnerability',
    headline:'Chained SharePoint flaws enable full unauthenticated RCE',
    body:'Two vulnerabilities disclosed across Microsoft\'s June and July 2026 patches - an authentication bypass and a deserialization flaw - can be chained for unauthenticated remote code execution against on-prem SharePoint. Weeks after fixes shipped, researchers still found thousands of exposed servers unpatched.',
    source:'SecurityWeek / Rapid7' },
  { date:'2026-07-28', cat:'vuln', catLabel:'Vulnerability',
    headline:'Fastjson RCE exploited under default configuration',
    body:'A critical, actively-exploited flaw in the widely used Fastjson Java library allows unauthenticated remote code execution with no special configuration required, affecting deployments still on the unsupported 1.x branch.',
    source:'SecurityWeek' },
  { date:'2026-07-26', cat:'vuln', catLabel:'Vulnerability',
    headline:'Critical Rails flaw forces early public disclosure',
    body:'A flaw in Ruby on Rails\' Active Storage component allowed unauthenticated file reads capable of exposing an application\'s master cryptographic key. Public proof-of-concept exploits appeared so quickly that maintainers published full details and forensic tooling ahead of schedule.',
    source:'BleepingComputer / Akamai' },
  { date:'2026-06-25', cat:'ot', catLabel:'OT / Industrial',
    headline:'Actively-exploited PLM platform flaw added to CISA\'s KEV catalog',
    body:'An unauthenticated RCE vulnerability in PTC Windchill and FlexPLM - platforms widely used in engineering and manufacturing - is being actively exploited to plant web shells and gain footholds inside industrial and supply-chain environments. A reminder that OT-adjacent platforms, not just classic ICS/SCADA gear, are squarely in scope for real attacks.',
    source:'CISA KEV / Field Effect' },
  { date:'2026-06-11', cat:'ai', catLabel:'AI & Security',
    headline:'Agentic AI now rated the #1 cybersecurity concern for 2026',
    body:'A Dark Reading readership poll found 48% of security professionals now rank agentic AI and autonomous systems as the top attack vector for the year, ahead of ransomware and deepfakes. Separate research found most organizations that deployed AI agents had already had a related security incident - most often tied to over-permissioned agent credentials or prompt injection.',
    source:'Dark Reading / Darktrace State of AI Cybersecurity 2026' },
  { date:'2026-06-05', cat:'ai', catLabel:'AI & Security',
    headline:'Anthropic discloses a large-scale, AI-orchestrated espionage campaign',
    body:'Anthropic reported detecting and disrupting a campaign in which a threat actor used Claude Code to automate significant portions of an attack against roughly 30 organizations - a concrete, disclosed example of the "AI agent as attacker" pattern security teams have been warning about.',
    source:'Anthropic disclosure' },
  { date:'2026-07-30', cat:'ai', catLabel:'AI & Security',
    headline:'Microsoft unveils multi-agent "Project Perception" for security operations',
    body:'Rather than a single AI assistant, Microsoft\'s new platform coordinates specialized Red Team, Blue Team, and Green Team AI agents that collaborate to discover vulnerabilities, investigate threats, validate defenses, and recommend remediation - a real-world example of the same multi-agent pattern behind this site\'s own synthesis design.',
    source:'Microsoft / industry coverage' },
  { date:'2026-03-09', cat:'landscape', catLabel:'Threat Landscape',
    headline:'Supply-chain attacks and public-facing app exploits both surge',
    body:'IBM\'s X-Force team recorded a 44% year-over-year rise in exploitation of public-facing applications, and found major supply-chain and third-party breaches have quadrupled over five years. Incidents like the Salesloft/Drift OAuth token compromise show how one trusted-vendor breach cascades into many downstream customer environments.',
    source:'IBM X-Force Threat Intelligence Index 2026' },
  { date:'2026-03-23', cat:'landscape', catLabel:'Threat Landscape',
    headline:'Breach costs diverge sharply by region',
    body:'Global average breach costs fell to $4.44M in IBM\'s latest Cost of a Data Breach report, credited to wider AI/automation adoption in detection and containment - but U.S. breach costs bucked the trend, rising 9% to $10.22M, the highest of any region measured.',
    source:'IBM Cost of a Data Breach Report' },
];
let newsFilter = 'all';
let newsCache = null; // { items, live } - loaded once per session, filter clicks just re-render from this

// §1 Phase 2: news_items is fetched by a daily Edge Function (see
// supabase/functions/fetch-news) from CISA KEV, NVD, and security RSS,
// ranked by a computed priority score (not just recency). Falls back to the
// hand-curated NEWS_ITEMS snapshot above if the table is empty (e.g. before
// the first scheduled run) or the request fails for any reason - the tab
// should never show a broken/empty page just because the live fetch had a
// bad day.
async function loadNewsData(){
  if(newsCache) return newsCache;
  try {
    const { data, error } = await supabase
      .from('news_items')
      .select('external_id, headline, body, source, source_url, category, published_at')
      .order('priority_score', { ascending:false })
      .order('published_at', { ascending:false })
      .limit(100);
    if(error) throw error;
    if(data && data.length){
      newsCache = {
        live: true,
        items: data.map(d => ({
          // external_id is 'cve:CVE-xxxx-xxxxx' for KEV-sourced items, used
          // below to link through to the matching Exploits entry instead of
          // duplicating its mitigation detail inline here.
          cveId: d.external_id?.startsWith('cve:') ? d.external_id.slice(4) : null,
          headline: d.headline, body: d.body, source: d.source, sourceUrl: d.source_url,
          cat: d.category, publishedAt: d.published_at,
        })),
      };
      return newsCache;
    }
  } catch(e) { /* fall through to static snapshot below */ }
  newsCache = {
    live: false,
    items: [...NEWS_ITEMS]
      .sort((a,b)=> b.date.localeCompare(a.date))
      .map(n => ({ headline:n.headline, body:n.body, source:n.source, sourceUrl:null, cveId:null, cat:n.cat, publishedAt:n.date })),
  };
  return newsCache;
}

// --- Original inline icon set (no external images - avoids stock-photo look and any licensing question) ---
function icon(name){
  const common = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    shield: `<svg ${common}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 8v4"/><circle cx="12" cy="15" r="0.6" fill="currentColor"/></svg>`,
    backup: `<svg ${common}><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/><path d="M18.5 9.5a3 3 0 1 1-1-2.3" transform="translate(0,-1)"/></svg>`,
    document: `<svg ${common}><path d="M7 2.5h7l3.5 3.5V21H7z"/><path d="M14 2.5V6h3.5"/><path d="M9.3 12h5.4M9.3 15h5.4M9.3 18h3.4"/></svg>`,
    register: `<svg ${common}><rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M3.5 9h17M3.5 14h17M9 4v16"/></svg>`,
    ransomware: `<svg ${common}><rect x="6" y="10.5" width="12" height="9" rx="1.2"/><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5"/><path d="M12 14v2.4"/><path d="M4 4l16 16" opacity="0.55"/></svg>`,
    phishing: `<svg ${common}><rect x="3.2" y="6" width="17.6" height="12.5" rx="1.2"/><path d="M3.2 7l8.8 6 8.8-6"/><path d="M15.5 15.5c2-1.6 2-4 .3-5.3" opacity="0.7"/></svg>`,
    ddos: `<svg ${common}><rect x="8.5" y="9" width="7" height="7" rx="1"/><path d="M12 9V4M12 20v-5M5 12H2M22 12h-3M6.5 6.5 4.5 4.5M17.5 6.5l2-2M6.5 17.5l-2 2M17.5 17.5l2 2"/></svg>`,
    lateral: `<svg ${common}><circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M6.8 7.6 10.3 16.2M17.2 7.6 13.7 16.2" stroke-dasharray="3 2.5"/></svg>`,
    cycle: `<svg ${common}><path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2"/><path d="M18.5 4v3.2H15.3M5.5 20v-3.2H8.7"/></svg>`,
    key: `<svg ${common}><circle cx="8" cy="8.5" r="4"/><path d="M11 11.5l9 9M15.5 16l2.5-2.5M18 18.5l2.5-2.5"/></svg>`,
    link: `<svg ${common}><circle cx="9.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/></svg>`,
    people: `<svg ${common}><circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-3.3 2.5-5.5 5.5-5.5S14 15.7 14 19"/><circle cx="16.5" cy="9" r="2.4"/><path d="M14.8 19c0-2.6 1.8-4.4 3.9-4.4"/></svg>`,
    cloud: `<svg ${common}><path d="M7 17a4 4 0 0 1 .3-8 5.5 5.5 0 0 1 10.6 1.8A3.5 3.5 0 0 1 17 17z"/><path d="M12 20v-3M10 19l2-2 2 2" opacity="0.75"/></svg>`,
    exfil: `<svg ${common}><path d="M7 2.5h7l3.5 3.5V21H7z"/><path d="M14 2.5V6h3.5"/><path d="M9.5 15l4.5-4.5M10 10.5h4.5V15" opacity="0.85"/></svg>`,
    urgent: `<svg ${common}><path d="M12 3l9 15.5H3z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor"/></svg>`,
    route: `<svg ${common}><path d="M5 21V3"/><path d="M5 4.5c3-2 5 2 8 0s5 2 8 0v9c-3 2-5-2-8 0s-5-2-8 0"/></svg>`,
    signal: `<svg ${common}><path d="M12 19.3v.01"/><path d="M8.2 15.8a5.2 5.2 0 0 1 7.6 0"/><path d="M5 12.3a9.2 9.2 0 0 1 14 0"/></svg>`,
    checklist: `<svg ${common}><rect x="6" y="4" width="12" height="17" rx="1.4"/><rect x="9" y="2.3" width="6" height="3" rx="1"/><path d="M9 12l1.8 1.8L15 10" /></svg>`,
    clock: `<svg ${common}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2.3h6M12 2.3V5"/></svg>`,
    sun: `<svg ${common}><circle cx="12" cy="12" r="4.3"/><path d="M12 3v2.3M12 18.7V21M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M3 12h2.3M18.7 12H21M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`,
    moon: `<svg ${common}><path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2z"/></svg>`,
    external: `<svg ${common}><path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/><path d="M14 4h6v6"/><path d="M20 4 11 13"/></svg>`,
    arrowright: `<svg ${common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    'hiw-clipboard': `<svg ${common}><rect x="6" y="4" width="12" height="17" rx="1.5"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M8.5 11l2 2 4-4.5"/><path d="M8.5 16.5h5.5"/></svg>`,
    'hiw-magnify': `<svg ${common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/><path d="M7.5 10.5h6M10.5 7.5v6"/></svg>`,
    'hiw-lightbulb': `<svg ${common}><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.7v.5h6v-.5c0-.7.3-1.3.8-1.7A6.5 6.5 0 0 0 12 3z"/></svg>`,
    'hiw-transform': `<svg ${common}><path d="M4 14a8 8 0 0 1 14-5.2"/><path d="M17 4v3.2h-3.2"/><path d="M20 10a8 8 0 0 1-14 5.2"/><path d="M7 20v-3.2h3.2"/></svg>`,
    card: `<svg ${common}><rect x="2.5" y="5.5" width="19" height="13" rx="1.6"/><path d="M2.5 9.5h19"/><path d="M6 14.5h4"/></svg>`,
    device: `<svg ${common}><rect x="3" y="4.5" width="18" height="12" rx="1.3"/><path d="M8 20h8M12 16.5V20"/></svg>`,
    home: `<svg ${common}><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-6h4v6"/></svg>`,
    menu: `<svg ${common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    close: `<svg ${common}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  };
  return icons[name] || '';
}

// --- 10-phase maturity roadmap, organized into 3 clean, non-overlapping stages ---
const RISK_SCORE_DESCRIPTIONS = {
  1: 'Minimal risk. Controls are comprehensive, tested, and continuously monitored across every function. This is an aspirational benchmark, not a typical starting point for most organizations.',
  2: 'Very low risk. A strong baseline across most functions, with only minor, well-understood gaps that are already being tracked.',
  3: 'Low risk. Core protections are in place and working; a few specific areas need attention, but nothing systemic.',
  4: 'Low-to-moderate risk. Foundational controls exist, but consistency and testing vary across the organization - some areas are solid, others untested.',
  5: 'Moderate risk. A genuine mix of solid and weak areas - the kind of profile where a single overlooked gap is enough to be exploited.',
  6: 'Moderate-to-elevated risk. Multiple functions show real gaps at once; an opportunistic attacker would likely find a way in without much effort.',
  7: 'Elevated risk. Significant gaps across several NIST functions, especially around detection and response - incidents would likely go unnoticed for a while.',
  8: 'High risk. Fundamental controls are missing or inconsistently applied. A breach isn\'t really a question of if, but when.',
  9: 'Very high risk. Minimal effective defenses in place - the organization would likely not detect an active compromise on its own.',
  10: 'Severe risk. Essentially an unmanaged security posture. Every function needs immediate, foundational work, starting with visibility into what even exists.',
};
const STAGE_DETAIL = {
  discovery: {
    summary:'The data-collection phase - your adaptive questionnaire across all six NIST CSF functions (Govern, Identify, Protect, Detect, Respond, Recover), shaped by your industry, region, and infrastructure so you only answer what actually applies.',
    metrics:'Every answer scores 0, 1, or 2 depending on the option chosen. A function\'s score is the sum of its answers divided by the maximum possible, as a percentage.',
  },
  transformation: {
    summary:'Where raw answers become an actual risk read, not just a total - every answer is cross-checked against every other answer for known dangerous combinations, then ranked into a priority action list.',
    metrics:'Compounding-risk flags are computed separately from the percentage score - two individually moderate gaps that combine into something materially worse each get surfaced as their own finding.',
  },
  optimization: {
    summary:'Re-running the assessment on a cadence to measure real change - which findings were resolved, which are newly flagged, and how the overall score has moved since the last run.',
    metrics:'History tracks a score delta between assessments, plus a resolved-vs-new breakdown per finding, so improvement is measured against your own baseline, not an abstract target.',
  },
};
const STAGE_META = {
  discovery: { label:'Discovery', range:'Phases 1–4', color:'var(--accent-signal)',
    blurb:'You don\'t have a security program yet so much as a starting point - the goal is visibility: what exists, where it\'s exposed, and who owns fixing it.' },
  transformation: { label:'Transformation', range:'Phases 5–7', color:'var(--accent-secure)',
    blurb:'Findings become controls, and controls become documented, rehearsed processes - this is where most of the actual engineering and writing happens.' },
  optimization: { label:'Optimization', range:'Phases 8–10', color:'var(--accent-violet)',
    blurb:'The program runs continuously - monitored, tested, and adjusted as the environment and threat landscape change, rather than declared "done."' },
};
const PHASES = [
  { num:1, stage:'discovery', title:'Asset & Data Discovery', desc:'Inventory hardware, software, cloud resources, and data stores - including shadow IT. You can\'t protect what you don\'t know exists, and this is where most real gaps first surface.',
    monitor:'Tracked via a living asset inventory, reviewed whenever new systems, cloud resources, or vendors are added - not just annually.',
    evolve:'Once assets are known, Phase 2 can map real exposure instead of guessing at it.',
    inputs:'Hardware, software, and cloud resource lists; data stores; shadow IT reports.',
    output:'A living asset inventory covering every system and data store.',
    doneWhen:'Every asset can be named to an owner - nothing is on the network by surprise.' },
  { num:2, stage:'discovery', title:'Attack Surface Mapping', desc:'Identify every external-facing entry point - websites, APIs, VPNs, remote access, third-party integrations - and understand how an attacker would actually get in.',
    monitor:'Re-checked whenever external-facing infrastructure changes - new domains, new APIs, new remote-access points.',
    evolve:'A mapped surface is what makes Phase 4\'s gap analysis meaningful rather than generic.',
    inputs:'External-facing infrastructure: websites, APIs, VPNs, remote access, third-party integrations.',
    output:'A complete external attack-surface map showing every entry point.',
    doneWhen:'You can name every way in from outside, not just the obvious ones.' },
  { num:3, stage:'discovery', title:'Governance & Ownership Baseline', desc:'Assign real accountability for security decisions before writing a single control. Without an owner, findings from every later phase just accumulate unactioned.',
    monitor:'Verified through named accountability - can you point to the specific person who owns a given control?',
    evolve:'Without an owner, nothing found in later phases gets actioned - this single phase unlocks every one after it.',
    inputs:'Org chart, existing decision-making authority, current (if any) security responsibilities.',
    output:'Named ownership assigned for every security decision and control.',
    doneWhen:'You can point to the specific person accountable for any given control.' },
  { num:4, stage:'discovery', title:'Gap Analysis & Prioritization', desc:'Compare current state against a recognized framework (NIST CSF, CIS Controls) and rank gaps by risk - this is the exact function this site\'s Assessment tab performs.',
    monitor:'This is literally what the Assessment tab re-measures every time you run it - your score IS this phase\'s monitoring signal.',
    evolve:'Turns raw findings into an ordered backlog, which is what Phase 5 actually executes against.',
    inputs:'Current-state controls measured against a recognized framework (NIST CSF, CIS Controls).',
    output:'A ranked backlog of gaps ordered by risk - this is what the Assessment tab generates.',
    doneWhen:'Every gap has a severity ranking and a place in the backlog, not just a list of problems.' },
  { num:5, stage:'transformation', title:'Control Implementation', desc:'Roll out the prioritized technical controls - MFA, EDR, network segmentation, email authentication, backup isolation - turning the roadmap into deployed defenses.',
    monitor:'Tracked as percentage of the Phase 4 backlog actually deployed, not just planned or ticketed.',
    evolve:'Each control closed here is a specific finding that disappears from your next Assessment run.',
    inputs:'The prioritized gap backlog from Phase 4.',
    output:'Deployed technical controls - MFA, EDR, segmentation, email auth, backup isolation.',
    doneWhen:'The gap that triggered a control\'s deployment no longer shows up on the next Assessment.' },
  { num:6, stage:'transformation', title:'Policy & Documentation', desc:'Formalize the program in writing: security policy, incident response plan, backup/DR plan, risk register. See the Runbooks tab for what each of these should actually contain.',
    monitor:'Reviewed on the cadence the policy itself states - typically annually, or after any material infrastructure change.',
    evolve:'Turns implemented controls into an auditable, teachable program instead of tribal knowledge that leaves when one person does.',
    inputs:'Controls implemented in Phase 5, plus any regulatory or compliance obligations.',
    output:'Written policy, incident response plan, backup/DR plan, and risk register (see Runbooks).',
    doneWhen:'The program is documented well enough that someone new could follow it without tribal knowledge.' },
  { num:7, stage:'transformation', title:'Response Readiness & Testing', desc:'Rehearse the plans, don\'t just file them - tabletop exercises, restore drills from backup, and walkthroughs of the ransomware/phishing/DDoS runbooks before a real incident forces it.',
    monitor:'Measured by whether tabletop exercises and restore drills actually happened, not whether a plan merely exists on paper.',
    evolve:'The last step before a program is operational rather than aspirational - directly supported by the Runbooks tab.',
    inputs:'The written plans and runbooks produced in Phase 6.',
    output:'Completed tabletop exercises, backup-restore drills, and rehearsed runbook walkthroughs.',
    doneWhen:'Every plan has actually been rehearsed, not just filed.' },
  { num:8, stage:'optimization', title:'Continuous Monitoring & Tuning', desc:'Operationalize logging and detection, and tune it against real telemetry - an alert nobody trusts because of noise is functionally the same as no alert.',
    monitor:'Tracked via alert precision over time - false-positive rate trending down, not just alert volume trending up.',
    evolve:'Reliable detection is the precondition for Phase 9\'s audits meaning anything at all.',
    inputs:'Live telemetry - logs, alerts, and detection signals.',
    output:'Tuned detection with a signal-to-noise ratio the team actually trusts.',
    doneWhen:'False-positive rate is trending down, not just alert volume trending up.' },
  { num:9, stage:'optimization', title:'Auditing & Validation', desc:'Vulnerability scans, penetration tests, and control audits confirm defenses work as intended rather than just existing on paper - this is also where compliance audits (ISO 27001, SOC 2) fit in.',
    monitor:'Tracked via time-to-remediate findings from scans, pen tests, and compliance audits - not merely whether audits happened.',
    evolve:'Confirms which Phase 5 controls are actually working versus just installed and forgotten.',
    inputs:'Deployed controls and monitoring output from Phases 5 and 8.',
    output:'Vulnerability scan results, penetration test findings, and compliance audits (ISO 27001, SOC 2).',
    doneWhen:'Findings are tracked to remediation, not just discovered.' },
  { num:10, stage:'optimization', title:'Adaptive Iteration', desc:'Feed lessons from incidents, audits, and a changing threat landscape back into the program - and back into Phase 4\'s gap analysis, since this loop never really ends.',
    monitor:'Tracked by whether lessons from real incidents and audits visibly change next quarter\'s priorities.',
    evolve:'Feeds directly back into Phase 4 - the phase that makes the other nine a cycle instead of a one-time checklist.',
    inputs:'Lessons from real incidents, audit findings, and a changing threat landscape.',
    output:'Updated priorities fed back into Phase 4\'s gap analysis.',
    doneWhen:'Next quarter\'s priorities visibly reflect what was actually learned.' },
];

// --- Score rubric: what a given band actually means, on the 0-10 scale (overall % ÷ 10) ---
const SCORE_RUBRIC = [
  { range:'0 – 1.5', verdict:'Critical', good:'Rare - if anything scores here, it\'s usually one isolated function (often Recover) while everything else is failing too.',
    bad:'Core controls are absent, not just weak - no MFA, no logging, no incident response plan, often no named security owner at all. This reflects total absence, not partial effort.',
    why:'Every question in the affected function was likely answered at its lowest option - this isn\'t measurement noise, it\'s an accurate reflection of nothing being in place yet.',
    priority:'Start at Maturity Model Phase 1 - asset discovery. Nothing later matters until you know what you\'re protecting.' },
  { range:'1.5 – 3.5', verdict:'Elevated (severe)', good:'Usually one or two functions (often Identify or Recover) have partial coverage - an asset list exists, or backups happen even if untested.',
    bad:'Protect and Detect are typically the weakest here - MFA partial at best, no centralized logging, meaning an intrusion would likely go unnoticed for a long time.',
    why:'A handful of "Partial" answers pull the average up slightly off zero, but the functions that stop real attacks are still mostly unanswered at their lowest tier.',
    priority:'Close the highest-severity items in the Priority list first - this band is where compounding-risk flags (like exposed RDP plus weak backups) are most common and most dangerous.' },
  { range:'3.5 – 5', verdict:'Elevated', good:'Baseline hygiene exists - patching happens, some endpoint protection is deployed - but inconsistently applied across the organization.',
    bad:'Governance is usually the gap here - controls exist without policy backing them, so they aren\'t sustained once the person who set them up moves on.',
    why:'Individual controls score "Partial" across the board rather than a mix of strong and absent - the org is doing things, just not consistently or on paper.',
    priority:'Move into Maturity Model Phase 3 (Governance) and Phase 6 (Policy & Documentation) - enough is in place that formalizing it will lock in real gains.' },
  { range:'5 – 7', verdict:'Moderate', good:'This is usually where MFA is enforced, backups are tested at least occasionally, and a written security policy exists - real, working fundamentals, not just intentions.',
    bad:'Response readiness is the most common weak point in this band - plans exist on paper (Respond/Recover score fine) but haven\'t been rehearsed, and detection tends to be reactive rather than proactive.',
    why:'Most functions individually look "fine" (Partial-to-Yes answers throughout), but nothing has been tested end-to-end - the score reflects presence of controls, not proof they\'d hold up under a real incident.',
    priority:'Maturity Model Phase 7 - Response Readiness & Testing - is where this band gets stuck without deliberate rehearsal (tabletop exercises, restore drills).' },
  { range:'7 – 8.5', verdict:'Strong (developing)', good:'Controls are implemented and tested - this is typically an org that\'s been through at least one real incident or a serious tabletop exercise.',
    bad:'Monitoring/tuning is the usual gap - alerting exists but hasn\'t been tuned enough to avoid noise, or audits happen but findings aren\'t tracked to closure.',
    why:'Almost every question scores at or near its top option, with only Detect/Optimization-related items pulling the average down slightly.',
    priority:'Maturity Model Phase 8–9 - Continuous Monitoring and Auditing - is where this band should focus, since the foundational work is already done.' },
  { range:'8.5 – 10', verdict:'Strong', good:'Full coverage across all six functions, tested and audited, with a demonstrated feedback loop from past incidents and audits into current priorities.',
    bad:'Even here, the compounding-risk flags still matter - a single overlooked combination (like a new vendor integration nobody reviewed) can create real exposure that a per-function score alone wouldn\'t catch.',
    why:'Consistently top-tier answers across every function - this band is earned, not assumed, and should be re-verified every assessment cycle rather than taken for granted.',
    priority:'Maturity Model Phase 10 - Adaptive Iteration. The job here is sustaining the loop, not finding new gaps.' },
];

// --- Foundational documents (referenced from the Runbooks tab) ---
const FOUNDATIONAL_DOCS = [
  { id:'irplan', icon:'shield', title:'Incident Response Plan',
    points:[
      'Roles and a clear chain of command (who declares an incident, who leads response, who has final say to shut something down)',
      'Severity classification - not every incident needs the same response tier',
      'Communication plan: internal escalation, legal/regulatory notification obligations, and what (if anything) goes to customers or the public',
      'Evidence preservation steps, so forensic investigation isn\'t compromised by an eager cleanup',
      'A named post-incident review process - the plan should explicitly require updating itself after every real incident',
    ]},
  { id:'backupdr', icon:'backup', title:'Backup & Disaster Recovery Plan',
    points:[
      'Follow the 3-2-1 rule as a baseline: 3 copies of data, on 2 different media types, with 1 copy offline or immutable',
      'Define RTO (how fast you must be back up) and RPO (how much data loss is tolerable) per system - not every system needs the same targets',
      'Isolate backups from the production network so a ransomware event can\'t encrypt the recovery path along with everything else',
      'Test restores on a real schedule - a backup that has never been restored is a hypothesis, not a plan',
      'Document a failover/DR site or cloud region if uptime requirements demand it, and test that failover too',
    ]},
  { id:'policy', icon:'document', title:'Cybersecurity Policy Document',
    points:[
      'Scope: which systems, data, and people the policy governs',
      'Acceptable use, access control, and data classification rules stated plainly enough that non-security staff can follow them',
      'Named roles and responsibilities (ties directly to Phase 3 of the Maturity Model - governance has to exist before policy means anything)',
      'A mandatory review cadence - annually at minimum, and after any material change to infrastructure or the threat landscape',
    ]},
  { id:'riskreg', icon:'register', title:'Risk Register',
    points:[
      'One row per identified risk: description, likelihood, impact, and a calculated or assigned risk rating',
      'A named owner per risk - an unowned risk is a risk nobody is actually managing',
      'Treatment plan and status: accept, mitigate, transfer (insurance), or avoid - and what\'s actually being done about it',
      'A review date per entry, not just a review date for the whole register - old risks silently going stale is the most common failure mode',
    ]},
  { id:'bcp', icon:'cycle', title:'Business Continuity Plan',
    points:[
      'Distinct from the Backup/DR plan: this covers how the *business* keeps operating, not just how IT recovers systems',
      'Identify critical business functions and their maximum tolerable downtime - not every process is equally urgent',
      'Named alternate processes (manual workarounds, alternate suppliers, alternate premises) for when primary systems are unavailable',
      'A communication tree for staff, customers, and suppliers that doesn\'t depend on the systems that might be down',
      'Tested via exercises, not just written - a plan that has only ever been read is unproven',
    ]},
  { id:'iam', icon:'key', title:'Access Control / IAM Policy',
    points:[
      'Least-privilege as the default: access granted for a specific need, not by default "in case it\'s useful"',
      'A defined joiner/mover/leaver process - access granted on day one and revoked the moment someone leaves or changes role',
      'Privileged/admin access kept separate from everyday accounts, with additional approval and logging requirements',
      'Periodic access reviews - confirming people still need what they were granted, not just granting once and forgetting',
    ]},
  { id:'vendor', icon:'link', title:'Third-Party / Vendor Risk Policy',
    points:[
      'A required security review before any vendor gets access to systems or data - not after the contract is signed',
      'Minimum security requirements scaled to what the vendor can actually touch (a payroll processor needs more scrutiny than a stock-photo subscription)',
      'A record of what each vendor can access, so a vendor breach (like the Salesloft/Drift incident referenced in the News tab) can be scoped quickly',
      'A defined offboarding step for vendors too - revoking access when a contract ends, not just for employees',
    ]},
  { id:'training', icon:'people', title:'Security Awareness Training Program',
    points:[
      'Recurring, not one-time - a single onboarding session is well-documented to fade within months',
      'Scenario-based content (real phishing simulations, not just slideshows) tends to change behavior more than lecture-style training',
      'Role-specific modules - finance staff need BEC/wire-fraud training that a warehouse employee doesn\'t, and vice versa',
      'Tracked completion and a non-punitive reporting culture - see the Phishing runbook for why blame reduces future self-reporting',
    ]},
];

// --- Incident runbooks ---
const RUNBOOKS = [
  { id:'ransomware', icon:'ransomware', title:'Ransomware', sub:'Encryption event / extortion attempt',
    steps:[
      'Isolate affected systems immediately: disable the NIC (Disable-NetAdapter in PowerShell, or "Disable" in Network Connections) or pull the network cable rather than powering off, to preserve memory-resident evidence. If EDR is deployed (CrowdStrike, Defender for Endpoint, SentinelOne), use its console isolation action instead of touching the machine directly - it\'s logged and reversible',
      'Take file servers, NAS/SAN volumes, and mapped network drives offline immediately even if not yet visibly affected - ransomware actively hunts for and encrypts every reachable network share, so isolating shared storage buys time before individual endpoints are triaged',
      'Activate the incident response team and open an incident bridge; determine true scope by querying your EDR console for other endpoints showing the same process tree or mass file-rename/encryption behavior, rather than assuming it\'s limited to what was visibly reported',
      'Preserve evidence before any cleanup: capture memory on at least one representative infected host if tooling exists (EDR live-response, or a tool like Magnet RAM Capture), and export EDR/SIEM logs covering the prior 30 days - dwell time before the encryption trigger is commonly days to weeks',
      'Identify the ransomware family from the ransom note and check it against a known-decryptor list at nomoreransom.org (the Europol-backed No More Ransom project) before assuming payment or full rebuild is the only path - free decryptors exist for dozens of older families',
      'Notify legal counsel, cyber insurance, and any regulators your jurisdiction/sector requires - breach-notification clocks (e.g. GDPR\'s 72-hour window) start from discovery, so this runs in parallel with containment, not after it',
      'Verify backup integrity before relying on it: check backup job logs for gaps around the incident window, and check for shadow-copy deletion (`vssadmin list shadows`) - `vssadmin delete shadows /all` run by the attacker is a documented, common step specifically meant to block easy recovery',
      'Restore from the most recent clean, verified-isolated backup into a sandboxed/isolated network segment first, scan it, and only then reconnect to production - restoring into a still-compromised network just re-triggers the same event',
      'Reset credentials for every account with plausible exposure, not just visibly-affected ones - domain admin, service accounts, and local admin passwords (via LAPS if deployed) - before reconnecting restored systems, since credential theft typically precedes the encryption trigger by days',
      'Run a post-incident review and feed findings back into Phase 10 of the Maturity Model - the same gap that let this in will let the next one in too',
    ]},
  { id:'phishing', icon:'phishing', title:'Phishing / BEC', sub:'Credential compromise or business email compromise',
    steps:[
      'Have a one-click reporting mechanism for users - the built-in "Report Message" add-in in Outlook/Microsoft 365, or Google Workspace\'s built-in phishing report action - the first report is often the only warning before it spreads',
      'Quarantine the message organization-wide: in Microsoft 365, search by sender/subject in Threat Explorer (Defender portal) and run "Purge" across all mailboxes; in Google Workspace, use the Investigation Tool to search and bulk-delete. Block the sending domain and any malicious URLs/attachment hashes via the Tenant Allow/Block List (Microsoft) or equivalent gateway rule',
      'For any account that clicked through or entered credentials: force an immediate password reset AND separately revoke active sessions/refresh tokens - a password reset alone does not invalidate an already-issued session. In Entra ID this is "Revoke sessions" on the user\'s page (or Revoke-MgUserSignInSession via the Microsoft Graph PowerShell SDK); in Google Workspace, "Sign out of all sessions" in the Admin console',
      'Check for persistence set up while the attacker had access: review inbox rules for auto-forward or delete-on-arrival rules (Get-InboxRule in Exchange Online PowerShell), check for newly-granted OAuth app consents on the account (Enterprise Applications in Entra ID, or third-party access in Google Workspace), and check tenant-level mail-flow rules for anything unfamiliar',
      'If this looks like BEC (a request to change payment details, redirect a wire, or an urgent executive ask): before any funds move, verbally confirm the request via a phone number you already had on file - never one supplied in the suspect email - and alert finance/AP immediately so any pending transfer can be held',
      'Search for other recipients of the same or a similar message using Threat Explorer / Google Vault, rather than relying solely on self-reporting to find everyone who received it',
      'Follow up with the affected user and team without blame - punitive responses reliably reduce future self-reporting, and the goal is faster reporting next time, not less reporting out of fear',
    ]},
  { id:'ddos', icon:'ddos', title:'DDoS', sub:'Availability / denial-of-service attack',
    steps:[
      'Confirm it\'s actually an attack, not a legitimate spike or misconfiguration: check for genuine traffic-volume anomalies correlated with unusual source-IP diversity/geography or protocol anomalies in your CDN/WAF dashboard (Cloudflare Analytics, AWS Shield/CloudFront metrics) rather than reacting to a single alert threshold breach - a real product launch or press mention can look identical to a volumetric attack at a glance',
      'Identify the attack layer, since response differs completely: volumetric (L3/4 - UDP/ICMP flood or reflection/amplification) needs upstream scrubbing; application-layer (L7 - an HTTP flood against a specific endpoint) needs WAF/rate-limiting closer to the app. Check your provider\'s traffic breakdown by protocol, port, and request pattern to tell which you\'re facing',
      'Engage your upstream provider, CDN, or dedicated scrubbing service immediately (Cloudflare, AWS Shield Advanced, Akamai, or your ISP\'s DDoS mitigation service if contracted) - most effective volumetric mitigation happens outside your own network edge, since your own bandwidth is what\'s being exhausted',
      'If a CDN/Anycast layer already sits in front of production, verify it\'s actually switched into an aggressive "under attack" or challenge mode (e.g. Cloudflare\'s "I\'m Under Attack" mode) rather than left on default settings, which are tuned for normal traffic, not an active flood',
      'Apply traffic filtering and rate-limiting rules specific to the observed pattern - block by source ASN/geography if the attack is concentrated, rate-limit the specific endpoint under an L7 flood - rather than a broad block that also drops legitimate users',
      'If the attack is DNS-based or a reflection/amplification attack abusing your own exposed services (open DNS resolvers, NTP, memcached), check for and lock down any misconfigured services of your own that could be contributing to amplification, separate from defending against the inbound flood itself',
      'Keep stakeholders and customers informed during the outage via a status page (StatusPage, Instatus, or equivalent) with a realistic, regularly-updated cadence - silence during an outage erodes trust faster than the outage itself',
      'After the fact, review whether current bandwidth capacity, scrubbing contracts, and rate-limit thresholds were actually sized for the attack you just saw, and adjust based on what worked or didn\'t in the real event',
    ]},
  { id:'lateral', icon:'lateral', title:'Lateral Movement', sub:'Active intrusion spreading internally',
    steps:[
      'Use EDR to isolate the specific affected endpoints individually (the network-isolation action in CrowdStrike/Defender for Endpoint/SentinelOne) rather than shutting down broad network segments where avoidable, to contain spread while preserving business continuity elsewhere',
      'Where individual-endpoint isolation isn\'t available or the intrusion has already crossed multiple segments, isolate the affected VLAN/subnet at the switch or firewall level as a broader containment step while investigation continues',
      'Hunt for the specific technique in use before assuming it\'s stopped: check for anomalous use of legitimate admin tools (PsExec, WMI, PowerShell remoting/WinRM, RDP) between hosts that don\'t normally talk to each other - this "living off the land" pattern is how most real intrusions actually spread, not custom malware',
      'Rotate credentials for every account observed or plausibly used by the intruder - assume more were touched than confirmed, and check EDR telemetry for LSASS memory-access indicators (a Mimikatz-style credential-dumping signature), since an attacker who reached lateral-movement stage has likely harvested credentials beyond the first compromised account',
      'Threat-hunt for persistence across every host the intruder plausibly touched, not just the originally-identified one: new scheduled tasks (Get-ScheduledTask), new local/domain admin accounts, unfamiliar services (Get-Service), and new or modified Group Policy Objects - the initial entry point is rarely the only foothold left behind',
      'Check Active Directory specifically for privilege-escalation and persistence indicators: new members added to Domain Admins/Enterprise Admins, Kerberoasting-pattern ticket requests, or Golden/Silver Ticket indicators if you have the logging to detect them - lateral movement frequently aims at AD compromise as the actual objective',
      'Maintain chain of custody on any forensic evidence gathered (exported logs, memory captures, disk images) with documented collection time, method, and handler, in case of later legal, insurance, or regulatory review',
      'Once contained, rebuild affected hosts from known-clean images rather than just removing identified malware - a host that hosted an active intruder shouldn\'t be trusted back into production based on cleanup alone',
    ]},
  { id:'cloudcompromise', icon:'cloud', title:'Cloud Account Compromise', sub:'Compromised AWS/Azure/GCP credentials or console access',
    steps:[
      'Revoke or rotate the compromised credentials/API keys immediately - for AWS, deactivate the IAM access key first (`aws iam update-access-key --status Inactive`) rather than deleting it outright, so it remains available for forensic review; use the equivalent key-disable action in Azure/GCP',
      'Invalidate active sessions and tokens separately from rotating the credential - a rotated password or disabled key doesn\'t retroactively kill an already-issued session token or STS credential still within its validity window',
      'Check for new IAM users, roles, access keys, or federated identity providers the attacker may have created to maintain access after the original credential is fixed - this is the most common way cloud intrusions survive an initial "fix," and it\'s worth checking even before full scope is confirmed',
      'Review CloudTrail (AWS) / Activity Log (Azure) / Audit Logs (GCP) specifically for CreateUser, CreateAccessKey, AttachUserPolicy, and PutRolePolicy events (or provider equivalents) during the suspected compromise window - these are the specific actions an attacker uses to establish persistent access',
      'Review billing and resource-creation logs for unauthorized compute spun up for cryptomining or further attack infrastructure - a sudden spike in a region you don\'t normally use, or an unusually large instance type, is the classic signature of this monetization move',
      'Check for modified security groups, NACLs, storage bucket policies (S3/Blob/GCS), or public-exposure changes made during the intrusion window - an attacker will often open a bucket or security-group rule to exfiltrate data or maintain reach even after the original credential path is closed',
      'Preserve cloud provider audit logs before any retention window expires - export CloudTrail/Activity Log/Audit Logs to storage outside the affected account if there\'s any chance the attacker had permissions broad enough to disable or delete logging',
      'Once contained, review the IAM policy that was actually exploited - was the compromised credential over-privileged relative to its function? - and tighten it; the fix isn\'t complete if the same identity goes back into production with the same excess permissions it had before',
    ]},
  { id:'insider', icon:'exfil', title:'Insider Threat / Data Exfiltration', sub:'Suspected internal actor or unusual data movement',
    steps:[
      'Involve HR and legal before taking any action against a specific person, not just IT - this category carries employment-law and privacy exposure others don\'t, and premature unilateral IT action (disabling an account, searching a device) without sign-off can itself create liability or taint the investigation',
      'Preserve access logs, file-activity logs, and DLP alerts immediately, before anything ages out of retention - pull authentication logs, file-server/SharePoint access logs, and any DLP alert history covering as far back as is available, not just the triggering event',
      'Restrict access proportionate to the actual evidence rather than making a visible change to the person\'s access or alerting them directly - a sudden access change tips off a genuinely malicious insider to destroy evidence or accelerate exfiltration before scope is understood',
      'Where legally and technically feasible, place a covert monitoring hold on the account (enhanced logging, mail/file-activity alerting) rather than an overt lockout, until HR/legal confirm the investigation approach - coordinate this specifically with legal, since monitoring an employee carries its own compliance requirements depending on jurisdiction',
      'Review exactly what data was accessed or moved, and to where: unusual volume downloads, access outside the person\'s normal role/project scope, removable-media activity if endpoint logging captures it, and uploads to personal cloud storage or personal email - to scope actual exposure rather than assuming worst case',
      'Cross-reference the timeline against known triggers - a resignation, a performance issue, or an upcoming termination are the most common precursors to a real insider incident, and knowing the timeline shapes both urgency and the legal approach',
      'Once evidence supports action, coordinate access revocation and any device/account preservation with HR and legal as a single planned action, typically timed with any employment action, rather than staggered steps that could tip off the individual',
      'Close the loop afterward - most insider incidents trace back to an offboarding gap, an access-review gap, or overly broad access the Risk Register should already have flagged; feed the specific gap back into that process, not just this one case',
    ]},
  { id:'supplychain', icon:'link', title:'Supply Chain / Third-Party Compromise', sub:'A vendor or integration you depend on gets breached',
    steps:[
      'Identify exactly what that vendor/integration could access - this is only fast if a current access record exists (the Vendor Risk Policy\'s inventory on this site\'s Runbooks tab is built for exactly this); if it doesn\'t exist yet, pull every API key, OAuth grant, and account associated with the vendor\'s name directly from your identity provider and integration settings',
      'Revoke or rotate any credentials, API keys, or OAuth tokens shared with the affected vendor immediately - don\'t wait for the vendor\'s own all-clear or root-cause confirmation, since their compromise-timeline assessment is often incomplete or delayed relative to yours',
      'For OAuth/SaaS-to-SaaS integrations specifically, revoke the app\'s consent/grant at the identity-provider level (Enterprise Applications in Entra ID, connected apps in the Google Workspace admin console, or the equivalent app-authorization list) - disabling the vendor\'s own login doesn\'t necessarily kill a previously-granted OAuth token',
      'Check your own logs for activity from the vendor\'s integration during the suspected compromise window - API access logs, webhook activity, or logins attributable to the integration - rather than relying solely on the vendor\'s stated scope of impact',
      'If the vendor had write access to your systems (not just read), specifically review what was created, modified, or deleted during the window - a compromised vendor integration with write access is a path for an attacker to plant persistence directly in your environment, not just read your data',
      'Notify your own downstream customers if their data could plausibly have been exposed through the chain - the obligation doesn\'t stop at your vendor, and NotPetya-style incidents (see Case Studies) show how far a single compromised update can propagate',
      'Coordinate with legal on notification timing and content - a third-party-caused incident can still trigger your own regulatory notification duties depending on what data was involved and your jurisdiction',
      'Reassess whether that vendor\'s access level was appropriate in the first place, and tighten it regardless of fault - this is the step most organizations skip once the immediate incident is closed, and it\'s exactly what lets the same exposure recur with the next vendor',
    ]},
  { id:'zeroday', icon:'urgent', title:'Zero-Day / Actively Exploited Vulnerability', sub:'A critical flaw in something you run is being exploited in the wild',
    steps:[
      'Check CISA\'s Known Exploited Vulnerabilities (KEV) catalog and the vendor\'s own security advisory immediately to confirm exploitation status, affected versions, and known indicators of compromise - KEV entries specifically flag confirmed real-world exploitation, not just theoretical severity',
      'Inventory every instance of the affected product across the environment before patching anything - including instances you don\'t normally think of as "that product" (embedded components, a vendor appliance running the same library, dev/test/staging copies) - partial patching, as seen in real incidents like the SharePoint on-prem RCE chain, leaves real exposure even after the "main" instance is fixed',
      'Apply the vendor patch as the primary fix as soon as it\'s validated in a non-production environment; if no patch exists yet, apply the vendor\'s documented interim mitigation (disabling a specific feature, restricting network access to the affected service/port) immediately rather than waiting for a patch timeline',
      'If the vulnerability is remotely exploitable and no patch or mitigation is immediately deployable, apply temporary compensating controls: a WAF virtual-patching rule if a signature exists for the specific CVE, or restricting network reachability to the affected service via firewall rule until a real fix is in place',
      'Hunt for indicators of prior compromise before assuming patching alone resolves it - actively-exploited flaws are frequently used against a target before a patch exists or before the organization is even aware of the CVE, so check logs covering the period before public disclosure, not just after',
      'Check the affected systems specifically for webshells, unexpected scheduled tasks, or new admin accounts if the vulnerability class is remote code execution - these are the persistence mechanisms attackers typically plant immediately after successful exploitation, and a clean patch doesn\'t remove them retroactively',
      'Validate the patch actually closed the gap - re-scan the specific instance with a vulnerability scanner or the vendor\'s own detection guidance, since some patches require an additional configuration step beyond just installing the update to be fully effective',
      'Track time-to-patch as a real metric from disclosure/KEV-listing to remediation - this is exactly what Phase 9 (Auditing & Validation) of the Maturity Model should be measuring over time, and the Equifax case (see Case Studies) is the clearest illustration of why this metric matters more than most',
    ]},
];

// --- Where to keep following this yourself - real, verified, currently-active sources ---
// --- Case studies: watershed cybersecurity incidents, each tied back to this site's own content ---
// --- Glossary: every cybersecurity term used across this site ---
const GLOSSARY = [
  { term:'Air-gap', def:'Physically isolating a network or system so it has no connection to untrusted networks - common in OT/ICS environments.' },
  { term:'Attack surface', def:'The total set of points where an attacker could try to enter or extract data from an environment.' },
  { term:'BCP (Business Continuity Plan)', def:'A plan for keeping business operations running during a disruption - broader than IT disaster recovery, covering people and processes.' },
  { term:'BEC (Business Email Compromise)', def:'Fraud where an attacker impersonates a trusted party over email to trigger a payment or data disclosure.' },
  { term:'CIS Controls v8', def:'A prioritized set of defensive safeguards published by the Center for Internet Security, used here for question-level detail.' },
  { term:'CISA KEV', def:'The U.S. Cybersecurity and Infrastructure Security Agency catalog of vulnerabilities confirmed to be actively exploited in the wild.' },
  { term:'Compounding risk', def:"This site's term for two or more individually moderate gaps that combine into a materially worse risk than either alone." },
  { term:'Containerization', def:'Packaging an application with its dependencies into a portable, isolated unit (e.g. Docker) that runs consistently across environments.' },
  { term:'CVE', def:'Common Vulnerabilities and Exposures - the standardized public identifier assigned to a specific known security flaw.' },
  { term:'DDoS', def:'Distributed Denial of Service - flooding a system with traffic from many sources to make it unavailable to legitimate users.' },
  { term:'DevSecOps', def:'Embedding security checks directly into software development and deployment pipelines rather than reviewing at the end.' },
  { term:'DKIM', def:'DomainKeys Identified Mail - cryptographically signs outbound email so recipients can verify it genuinely came from your domain.' },
  { term:'DLP', def:'Data Loss Prevention - tooling that detects and blocks sensitive data from leaving an organization improperly.' },
  { term:'DMARC', def:'A policy layer built on SPF and DKIM telling receiving mail servers what to do with messages that fail authentication.' },
  { term:'EDR', def:'Endpoint Detection & Response - software that monitors devices for malicious behavior and can isolate or remediate automatically.' },
  { term:'Exfiltration', def:'Unauthorized transfer of data out of an organization, typically the final stage of a data breach.' },
  { term:'Hardening', def:'Reducing a system\'s attack surface by disabling unnecessary services, tightening configuration, and applying secure defaults.' },
  { term:'IAM', def:'Identity & Access Management - the policies and systems governing who can access what, and under what conditions.' },
  { term:'Immutable backup', def:'A backup that cannot be altered or deleted for a set period, protecting recovery data from ransomware encryption.' },
  { term:'Incident Response Plan', def:'A documented, rehearsed procedure defining roles, severity levels, communications, and steps taken during a security incident.' },
  { term:'ISMS', def:'Information Security Management System - the documented, scoped, management-reviewed structure at the heart of ISO 27001.' },
  { term:'ISO 27001', def:'An international standard for establishing and certifying an Information Security Management System.' },
  { term:'Jump host', def:'A hardened, monitored intermediate server that administrators must pass through to reach sensitive systems.' },
  { term:'KEV', def:'Known Exploited Vulnerability - a flaw with confirmed active exploitation, warranting faster remediation than severity score alone suggests.' },
  { term:'Lateral movement', def:'An attacker progressing from an initially compromised system deeper into a network to reach higher-value targets.' },
  { term:'Least privilege', def:'Granting each account only the minimum access needed for its role, rather than broad access by default.' },
  { term:'Maturity tier', def:'A qualitative stage (Partial, Risk Informed, Repeatable, Adaptive) describing how deliberately an organization manages cyber risk.' },
  { term:'MDR', def:'Managed Detection & Response - an outsourced service providing continuous monitoring, threat hunting, and incident response.' },
  { term:'MFA', def:'Multi-factor authentication - requiring more than one independent proof of identity before granting access.' },
  { term:'Microsegmentation', def:'Dividing a network into very granular zones so a compromise in one zone cannot reach others without passing controls.' },
  { term:'MSP', def:'Managed Service Provider - an outsourced provider handling IT operations, sometimes including security functions.' },
  { term:'NIS2', def:'An EU directive imposing cybersecurity risk-management and incident-notification duties on essential and important entities.' },
  { term:'NIST CSF 2.0', def:'The NIST Cybersecurity Framework, organized around six functions: Govern, Identify, Protect, Detect, Respond, and Recover.' },
  { term:'NVD', def:'National Vulnerability Database - the U.S. government repository of standardized vulnerability data and severity scoring.' },
  { term:'OT / ICS', def:'Operational Technology / Industrial Control Systems - computing that controls physical processes, prioritizing safety and availability over confidentiality.' },
  { term:'Penetration test', def:'An authorized simulated attack performed to validate whether defenses actually hold up in practice.' },
  { term:'Phishing', def:'Deceptive messages designed to trick recipients into revealing credentials, opening malware, or authorizing fraudulent actions.' },
  { term:'Prompt injection', def:'An attack against AI systems where malicious instructions hidden in content cause the model to act against its operator\'s intent.' },
  { term:'Ransomware', def:'Malware that encrypts data, or threatens to leak it, and demands payment for restoration or silence.' },
  { term:'RCE', def:'Remote Code Execution - a vulnerability class letting an attacker run arbitrary code on a system over a network.' },
  { term:'Risk register', def:'A living record of identified risks with likelihood, impact, a named owner, treatment plan, and review date.' },
  { term:'RPO', def:'Recovery Point Objective - the maximum amount of data loss, measured in time, that an organization can tolerate.' },
  { term:'RTO', def:'Recovery Time Objective - the maximum acceptable time to restore a system after an outage.' },
  { term:'SAST', def:'Static Application Security Testing - analyzing source code for security flaws before the application is run.' },
  { term:'SCADA', def:'Supervisory Control and Data Acquisition - systems used to monitor and control industrial processes at scale.' },
  { term:'SD-WAN', def:'Software-Defined Wide Area Network - centrally managed, software-controlled routing across distributed network sites.' },
  { term:'Secrets management', def:'Storing and rotating credentials, API keys, and certificates in a dedicated vault rather than in code or config files.' },
  { term:'Segmentation', def:'Dividing a network into isolated zones so that compromise of one area does not automatically grant access to others.' },
  { term:'SIEM', def:'Security Information & Event Management - centralizes, correlates, and alerts on security logs across an environment.' },
  { term:'SOC 2', def:'An audit standard covering security and related controls, frequently required by enterprise buyers of SaaS products.' },
  { term:'SPF', def:'Sender Policy Framework - a DNS record declaring which mail servers are authorized to send email for your domain.' },
  { term:'SQL injection', def:'Injecting malicious database commands through unvalidated application input, often to read or alter an entire database.' },
  { term:'Supply chain attack', def:'Compromising a trusted vendor, library, or software update to reach that vendor\'s downstream customers.' },
  { term:'Tabletop exercise', def:'A discussion-based rehearsal where a team walks through an incident scenario to test plans before a real event.' },
  { term:'Threat actor', def:'An individual or group conducting malicious activity, ranging from criminal groups to state-sponsored operations.' },
  { term:'Vulnerability scanning', def:'Automated checks against systems to identify known vulnerabilities and misconfigurations on a recurring basis.' },
  { term:'Zero-day', def:'A vulnerability being exploited before a patch exists, or before defenders are aware of it.' },
  { term:'Zero trust', def:'A model that never assumes trust based on network location, verifying every access request explicitly instead.' },
  { term:'ZTNA', def:'Zero Trust Network Access - granting per-application access after verification, replacing broad VPN network access.' },
];

const REFERENCES = [
  { label:'NIST Cybersecurity Framework 2.0', href:'https://www.nist.gov/cyberframework', note:'Primary framework backbone for all six scored functions.' },
  { label:'CIS Controls v8', href:'https://www.cisecurity.org/controls', note:'Source of question-level control granularity.' },
  { label:'ISO/IEC 27001', href:'https://www.iso.org/standard/27001', note:'Optional compliance overlay for ISMS-related questions.' },
  { label:'EU NIS2 Directive', href:'https://digital-strategy.ec.europa.eu/en/policies/nis2-directive', note:'Optional overlay covering EU incident-notification duties.' },
  { label:'AICPA SOC 2', href:'https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2', note:'Optional overlay for vendor/SaaS audit readiness.' },
  { label:'CISA Known Exploited Vulnerabilities Catalog', href:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', note:'Authoritative source for confirmed active exploitation.' },
  { label:'National Vulnerability Database (NVD)', href:'https://nvd.nist.gov/', note:'Standardized vulnerability data and severity scoring.' },
  { label:'IBM X-Force Threat Intelligence Index', href:null, note:'Cited for threat landscape statistics on the Trends & News tab.' },
  { label:'IBM Cost of a Data Breach Report', href:null, note:'Cited for breach cost figures on the Trends & News tab.' },
  { label:'Darktrace State of AI Cybersecurity', href:null, note:'Cited for AI-related threat findings on the Trends & News tab.' },
  { label:'Case study sources', href:null, note:'Each incident on the Case Studies tab links to its own source individually.' },
];

// --- Playbooks: attack-type reference mapped to OWASP + MITRE ATT&CK/ATLAS ---
const PLAYBOOK_SELECTION_CRITERIA = [
  'Inclusion in an established industry classification - OWASP Top 10:2021 for web applications, or the OWASP Top 10 for LLM Applications (2025) for AI-specific risk.',
  'Mappability to a MITRE ATT&CK tactic (or MITRE ATLAS tactic for AI-specific entries), so each playbook connects to a broader adversary-behavior model rather than standing alone.',
  'Real-world exploitation evidence, cross-referenced against CISA\'s KEV catalog and the incidents on this site\'s Case Studies tab.',
  'A mitigation achievable without a dedicated security engineering team - consistent with the rest of this site\'s intended audience.',
];

const OSINT_TOOLS = [
  { name:'Shodan', desc:'Indexes internet-connected devices and exposed services - used to understand what an organization\'s actual external attack surface looks like.' },
  { name:'theHarvester', desc:'Aggregates public email addresses, subdomains, and employee names from search engines and public sources.' },
  { name:'Maltego', desc:'Link-analysis tool for mapping relationships between infrastructure, domains, and organizations.' },
  { name:'SpiderFoot', desc:'Automates OSINT collection across dozens of public data sources into a single reconnaissance report.' },
  { name:'VirusTotal', desc:'Checks files, URLs, and indicators of compromise against multiple antivirus and threat-intel engines.' },
  { name:'Have I Been Pwned', desc:'Checks whether an email address or domain appears in known public credential breaches.' },
  { name:'MITRE ATT&CK Navigator', desc:'Visualizes which tactics and techniques a given threat actor or scenario covers - used to build each playbook\'s mapping below.' },
];

const PLAYBOOKS = [
  { cat:'OWASP Web', ref:'A01:2021', title:'Broken Access Control', mitre:'Privilege Escalation - T1548 (Abuse Elevation Control Mechanism)',
    desc:'Authorization checks are missing or incorrectly enforced, letting authenticated users act outside their intended permissions - e.g., accessing another user\'s records by changing an ID in a URL.',
    steps:[
      'Enforce authorization server-side on every request - never trust client-side role checks alone; a hidden button or greyed-out UI element is not an access control, since the underlying API endpoint is still directly reachable.',
      'Deny by default and grant access explicitly per resource and role, and specifically test for Insecure Direct Object Reference (IDOR) by attempting to access another user\'s resource by changing an ID/UUID in the request - this is the single most common real-world instance of this category.',
      'Verify object-level authorization for any endpoint accepting a user-supplied ID (order ID, invoice ID, file path) - confirm the requesting user actually owns or has rights to that specific object, not just that they\'re authenticated at all.',
      'Centralize access-control logic in a single reusable middleware/policy layer (a policy-as-code approach like OPA or Casbin, or your framework\'s built-in authorization middleware) rather than duplicating ad hoc checks per endpoint, where one omitted check becomes the exploitable gap.',
      'Disable directory listing and restrict CORS configuration to explicit, known origins rather than a wildcard (*) - both are common, easily-checked broken-access-control misconfigurations distinct from application logic flaws.',
      'Log and alert on repeated authorization failures from a single account or source IP (e.g. more than a handful of 403 responses within a short window) - this pattern typically indicates automated ID enumeration/IDOR probing in progress.',
    ]},
  { cat:'OWASP Web', ref:'A02:2021', title:'Cryptographic Failures', mitre:'Credential Access - T1552 (Unsecured Credentials)',
    desc:'Sensitive data is transmitted or stored without adequate encryption, or with weak/outdated algorithms, exposing it if intercepted or if storage is breached.',
    steps:[
      'Encrypt sensitive data at rest using current, vetted algorithms - AES-256 is the standard baseline; for databases, use built-in transparent data encryption (SQL Server TDE, RDS encryption-at-rest) rather than relying on disk-level encryption alone.',
      'Encrypt data in transit with TLS 1.2 minimum, TLS 1.3 where supported, for every connection carrying sensitive data - including internal service-to-service traffic, not just the public-facing edge, since lateral movement inside a flat network can otherwise intercept unencrypted internal calls.',
      'Never store passwords in plaintext or reversible encryption - use a purpose-built password hashing function (bcrypt, scrypt, or Argon2id) with an appropriately-tuned work factor, never a general-purpose hash like MD5/SHA-1/SHA-256 alone, which are fast by design and trivially brute-forced for password use.',
      'Disable legacy TLS versions (SSLv3, TLS 1.0/1.1) and weak cipher suites in the server/load-balancer configuration - verify with Qualys SSL Labs\' free SSL Server Test that the actual negotiated configuration matches intent, since a config change doesn\'t always take effect the way it\'s expected to.',
      'Classify data by sensitivity (public/internal/confidential/restricted) so encryption requirements match actual risk rather than one blanket policy - this also determines what needs field-level encryption (SSNs, card data) versus what\'s adequately covered by disk/transport encryption alone.',
      'Manage encryption keys through a dedicated key management service (AWS KMS, Azure Key Vault, HashiCorp Vault) with defined rotation, rather than embedding keys in application config or source - a strong algorithm with a poorly-managed key provides little real protection.',
    ]},
  { cat:'OWASP Web', ref:'A03:2021', title:'Injection', mitre:'Initial Access / Execution - T1190 (Exploit Public-Facing Application)',
    desc:'Untrusted input is interpreted as executable code or commands by an interpreter (SQL, OS shell, LDAP), letting an attacker manipulate queries or execute arbitrary commands.',
    steps:[
      'Use parameterized queries/prepared statements everywhere user input reaches a database call - your framework or ORM\'s parameter-binding API (?/:param placeholders), never string/template concatenation, including for dynamically-built search or filter queries, which is where developers most often fall back to concatenation.',
      'Validate and sanitize all input server-side using allow-lists (accept known-good patterns) rather than deny-lists (block known-bad patterns) - deny-lists are reliably bypassed by encoding tricks; an allow-list for a numeric ID parameter that only accepts digits closes the injection path regardless of payload.',
      'Apply least-privilege database accounts so a successful injection has limited reach: the application\'s DB account should never be the database\'s admin/root account, and shouldn\'t have DROP, ALTER, or cross-schema access it doesn\'t functionally need.',
      'Deploy a WAF with injection-pattern rules (the OWASP ModSecurity Core Rule Set, or the managed rule sets built into Cloudflare/AWS WAF/Azure Front Door) as a compensating layer in front of the application - this catches many real-world attempts while underlying code is still being remediated.',
      'Run static analysis (SAST) for injection patterns in CI/CD - Semgrep\'s public ruleset, Bandit for Python, or GitHub CodeQL\'s default query set - configured to flag on pull request, not just generate a report no one reads.',
      'Enable database query logging or a database activity monitoring tool during and after remediation to catch anomalous query patterns (unexpected UNION clauses, unusually long query strings from application service accounts) against endpoints not yet fully patched.',
    ]},
  { cat:'OWASP Web', ref:'A04:2021', title:'Insecure Design', mitre:'Spans multiple tactics - an architectural gap, not a single technique',
    desc:'The application\'s underlying architecture or business logic contains exploitable flaws that no amount of secure coding can fix, because the design itself doesn\'t account for abuse cases.',
    steps:[
      'Threat-model new features before writing code, not after - a lightweight structured method like STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) applied to a feature\'s data flow is enough to catch most design-level gaps without needing a dedicated security engineer to run it.',
      'Build abuse-case testing into design review specifically, not just functional testing: for every "happy path" user story, write at least one corresponding abuse case ("what happens if this user skips a step / submits a negative quantity / replays this request") and confirm the design accounts for it.',
      'Apply rate limiting and business-logic limits at the design stage for anything with real-world consequences (checkout flows, password reset, referral/promo codes) - failures here (unlimited promo-code redemption, no cap on reset attempts) are business-logic flaws that secure coding alone can\'t fix after the fact.',
      'Use secure design patterns and reference architectures rather than one-off solutions - for common needs like authentication, session management, or file upload, prefer a vetted library/framework feature over custom-built logic, since custom implementations of these specific patterns have a long track record of reintroducing known flaws.',
      'Segregate tiers by trust level at the architecture stage (a DMZ for anything internet-facing, isolated from internal systems that don\'t need direct exposure) - a design decision that\'s expensive to retrofit but straightforward to get right upfront.',
      'Maintain a running record of previously identified design flaws so they aren\'t repeated in the next feature or application - insecure-design issues tend to recur across a codebase once introduced, since the same team often repeats the same pattern elsewhere.',
    ]},
  { cat:'OWASP Web', ref:'A05:2021', title:'Security Misconfiguration', mitre:'Initial Access - T1190 (Exploit Public-Facing Application)',
    desc:'Default accounts, unnecessary features, verbose error messages, or open cloud storage are left enabled, giving attackers an easy, often automated, path in.',
    steps:[
      'Harden configurations using a repeatable, automated baseline (Infrastructure as Code - Terraform, CloudFormation, or Ansible) rather than manual one-off server setup, so every environment starts from the same known-secure configuration and drift is easier to detect against a defined source of truth.',
      'Apply a recognized hardening benchmark (the CIS Benchmarks for your specific OS/platform, freely available from the Center for Internet Security) rather than an ad hoc internal checklist, and automate the check with a tool like OpenSCAP or your cloud provider\'s native compliance scanner.',
      'Disable or remove unused features, ports, services, and default accounts on every system before production - including admin consoles, sample applications, and default credentials that ship enabled on many platforms and appliances out of the box.',
      'Regularly scan for configuration drift, not just once at deployment - a scheduled compliance scan (weekly or on every change) catches manual out-of-band changes that bypass your IaC pipeline, which is how most real-world drift actually happens.',
      'Ensure error handling doesn\'t leak stack traces, internal file paths, or database error details to end users - configure generic error pages for production and route the actual detail to internal logging only, since verbose errors are a common, low-effort reconnaissance source for attackers.',
      'Check for open cloud storage specifically (S3 buckets, Azure Blob containers, GCS buckets set to public) as a recurring automated check - this single misconfiguration class has caused a disproportionate share of real-world large data exposures and is trivially detectable with existing free scanning tools.',
    ]},
  { cat:'OWASP Web', ref:'A06:2021', title:'Vulnerable and Outdated Components', mitre:'Initial Access - T1190 (Exploit Public-Facing Application)',
    desc:'Using libraries, frameworks, or components with known vulnerabilities, often because there\'s no inventory of what\'s actually running in production.',
    steps:[
      'Maintain a software bill of materials (SBOM) for every application, and separately inventory infrastructure-level software (OS versions, container base images, network appliance firmware) - application SCA tools won\'t catch an outdated firewall or unpatched hypervisor.',
      'Automate dependency scanning (SCA) in the build pipeline - GitHub\'s built-in Dependabot, Snyk, or OWASP Dependency-Check are all reasonable starting points - configured to fail or flag the build on new critical/high findings, not just generate a report no one reads.',
      'Cross-reference newly-disclosed vulnerabilities against CISA\'s Known Exploited Vulnerabilities (KEV) catalog specifically, not CVSS score alone - a medium-severity, actively-exploited CVE warrants faster remediation than a critical-severity one with no known exploitation.',
      'Patch or replace end-of-life components on a defined schedule, and track time-to-patch once a fix exists as a real metric - the Equifax breach (see Case Studies) is the canonical example of a patch existing for months before exploitation; the gap that mattered was the delay applying it, not the vulnerability itself.',
      'Subscribe to vendor security advisories and CVE feeds for every component actually in use, rather than relying on periodic manual checks - for anything internet-facing, the gap between disclosure and mass exploitation attempts is often measured in days.',
      'For container images specifically, scan base images and layers before deployment (Trivy, Grype, or your registry\'s built-in scanning on ECR/GCR/ACR) and re-scan on a recurring schedule even for unchanged images - new CVEs are disclosed against existing software constantly.',
    ]},
  { cat:'OWASP Web', ref:'A07:2021', title:'Identification and Authentication Failures', mitre:'Credential Access - T1110 (Brute Force)',
    desc:'Weak session management, missing account lockout, or lack of MFA allows attackers to compromise accounts through credential stuffing or brute force.',
    steps:[
      'Enforce MFA everywhere feasible, prioritized by risk: start with admin/privileged accounts and anything reachable from the internet (VPN, RDP gateways, cloud consoles) via a Conditional Access policy in Entra ID (or equivalent), then extend to all users. For legacy apps without native MFA support, front them with an MFA-capable reverse proxy or ZTNA product rather than leaving them permanently exempt.',
      'Set an account lockout policy that balances brute-force protection against denial-of-service risk - a common baseline is 5-10 failed attempts within a 15-minute window with a resetting counter, configured via Default Domain Policy → Account Lockout Policy in Active Directory, or the equivalent smart-lockout setting in Entra ID/Okta.',
      'Rate-limit authentication endpoints at the application or WAF layer (a rate-based rule on the login endpoint in Cloudflare/AWS WAF) - account lockout alone doesn\'t stop distributed credential-stuffing spread thin across many accounts.',
      'Rotate and invalidate session tokens on password change, not just at explicit logout - a compromised session token otherwise survives a password reset - and set short re-authentication intervals for high-privilege sessions rather than defaulting to long-lived "remember me" everywhere.',
      'Eliminate default credentials on every deployed system before production, including network gear, IoT/OT devices, and management interfaces, not just applications - track this as a deployment-checklist item, not a one-time audit.',
      'Check new or changed passwords against a breach-password list (e.g. the Have I Been Pwned Pwned Passwords API, which several IdPs and password managers integrate natively) so a password already circulating in a public breach corpus is rejected even if it meets complexity rules.',
    ]},
  { cat:'OWASP Web', ref:'A08:2021', title:'Software and Data Integrity Failures', mitre:'Supply Chain Compromise - T1195',
    desc:'Code or infrastructure relies on plugins, libraries, or updates from sources that aren\'t verified for integrity, allowing a compromised upstream source to inject malicious code.',
    steps:[
      'Verify digital signatures on software updates and dependencies before deployment where the ecosystem supports it (npm package provenance/Sigstore, GPG-signed OS packages) rather than trusting an unsigned download by URL or filename alone.',
      'Use dependency-pinning and lockfiles (package-lock.json, pinned requirements.txt, Gemfile.lock) rather than automatically pulling the latest version on every build - an unpinned build is reproducible only by luck, and a compromised upstream release reaches you the moment it\'s published.',
      'Restrict CI/CD pipelines from pulling unverified third-party packages: use a private package registry/proxy (Artifactory, Azure Artifacts, or npm/PyPI\'s own scoped-registry features) that only serves vetted versions, rather than pulling directly from the public registry on every build.',
      'Protect CI/CD pipeline configuration itself from unauthorized modification - require review before merging changes to build/deploy scripts, since a modified pipeline file is a documented real-world path for injecting malicious code into an otherwise-clean codebase (the SolarWinds pattern - see Case Studies).',
      'Apply integrity checks (checksums/hashes) to deployment artifacts at each handoff point in the pipeline - verify the artifact deployed to production is byte-for-byte the one that was built and scanned, not something substituted in transit.',
      'Avoid insecure deserialization of untrusted data, and where deserializing external input is unavoidable, use a format/library that doesn\'t support arbitrary object instantiation (prefer JSON over language-native serialization like Python pickle or Java native serialization for anything externally-supplied).',
    ]},
  { cat:'OWASP Web', ref:'A09:2021', title:'Security Logging and Monitoring Failures', mitre:'Defense Evasion - T1070 (Indicator Removal)',
    desc:'Insufficient logging, or logs that aren\'t monitored, means breaches go undetected for long periods and can\'t be reconstructed after the fact.',
    steps:[
      'Centralize logs in a SIEM or log-aggregation platform (Microsoft Sentinel, Splunk, Elastic, or a lighter option like Datadog) with alerting thresholds defined for specific conditions - not just raw retention with no one watching it.',
      'Log authentication events, access-control failures, and input-validation failures specifically - at minimum every failed login, every privilege-escalation attempt, every 401/403 response, and every input rejected by validation logic (a burst of rejected input from one source is a stronger injection-attempt signal than any single request).',
      'Set specific, actionable alert rules rather than "alert on everything": a practical starting set is 5+ failed logins for one account within 10 minutes, a successful login from an impossible-travel location, and a spike in 403/500 responses from one source IP - tune thresholds against your own baseline rather than using defaults blindly.',
      'Forward logs to the SIEM in near-real-time rather than end-of-day batch collection, and use write-once/immutable log storage where the platform supports it - a local Windows Event Log with no forwarding is trivially cleared by an attacker with local admin (wevtutil cl <log>) before anyone notices.',
      'Retain logs long enough to cover realistic dwell time, not just a compliance minimum - ransomware and BEC incidents commonly show weeks of attacker presence before the visible trigger event, and 30 days is often not enough to reconstruct the actual entry point.',
      'Test detection coverage with periodic red-team, purple-team, or even a simple tabletop walkthrough - simulate a failed-login burst and confirm the alert actually fires and reaches a real person. A SIEM with no verified alert path is functionally the same as no SIEM.',
    ]},
  { cat:'OWASP Web', ref:'A10:2021', title:'Server-Side Request Forgery (SSRF)', mitre:'Initial Access / C2 - T1190 (Exploit Public-Facing Application)',
    desc:'An application fetches a remote resource without validating the user-supplied URL, letting an attacker force the server to make requests to internal systems it shouldn\'t reach.',
    steps:[
      'Validate and allow-list destination hosts/IPs for any server-initiated request built from user input (webhook URLs, "fetch this image" features, PDF-generation-from-URL) - reject anything not on the explicit allow-list rather than deny-listing known-bad ranges, which is reliably bypassed via DNS rebinding or alternate IP encodings.',
      'Specifically block requests to RFC 1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.1), and link-local addresses (169.254.0.0/16) at the application layer, in addition to any network-level control - this is the exact range attackers target to reach internal services from a vulnerable server-side request.',
      'Block outbound requests to cloud metadata endpoints specifically (169.254.169.254 for AWS/Azure/GCP) - the single highest-value SSRF target in cloud environments, since it can return temporary credentials for the instance\'s IAM role, turning an SSRF into a full account compromise.',
      'Segment internal services from the network zone that processes external requests, so a successful SSRF against the public-facing app has a limited set of reachable internal targets rather than open access to the whole internal network.',
      'Disable unnecessary URL schemas (file://, gopher://, dict://) and disable automatic redirect-following, or re-validate the destination after each redirect hop, in the HTTP client library performing the server-initiated fetch - redirect chains are a common technique to bypass an initial allow-list check.',
      'Use a dedicated network egress proxy for server-initiated outbound requests where feasible, so allow-listing and logging happen in one enforced choke point rather than being reimplemented (and potentially forgotten) in every feature that makes an outbound call.',
    ]},
  { cat:'AI / LLM', ref:'LLM01:2025', title:'Prompt Injection', mitre:'MITRE ATLAS - AI Model Access / Execution',
    desc:'Crafted input, either direct from a user or indirectly embedded in retrieved content, overrides the model\'s intended instructions and causes it to perform unintended actions or reveal restricted information.',
    steps:[
      'Segregate untrusted external content from system instructions structurally, not just by prompt wording - use the distinct message roles your model API supports (system vs. user vs. tool/retrieved-content) so retrieved or user-supplied text is never concatenated into the same channel as your actual instructions.',
      'Apply output filtering and require human-in-the-loop approval for any sensitive or irreversible action (sending an email, executing a transaction, modifying data) the model\'s output could trigger - never let model output directly execute a consequential action without a checkpoint.',
      'Constrain model behavior via system prompts and expected output formats (e.g. requiring structured, schema-validated output) so an injected instruction has a harder time producing output your downstream code will actually act on.',
      'Apply the same input-validation discipline to content the model retrieves (RAG sources, tool results, scraped web content) as to direct user input - indirect prompt injection via poisoned retrieved content is a documented attack path distinct from direct user prompts.',
      'Grant the model/agent the minimum tool access and permissions actually needed for its task, since a successful injection can only do as much damage as the permissions available to whatever it\'s able to trigger.',
      'Treat this class of attack as not fully solvable by prompt wording alone - combine structural segregation, output validation, least-privilege tool access, and human approval for high-impact actions, since each individual mitigation has documented bypasses on its own.',
    ]},
  { cat:'AI / LLM', ref:'LLM02:2025', title:'Sensitive Information Disclosure', mitre:'MITRE ATLAS - Exfiltration',
    desc:'The model exposes personal data, credentials, or proprietary information in its output, either because it was present in training/context data or because output isn\'t filtered before returning to the user.',
    steps:[
      'Apply data minimization - don\'t include sensitive data (PII, credentials, proprietary source) in context/prompts unless strictly necessary for the task, since anything placed in context is a candidate for the model to echo back, intentionally or not.',
      'Filter and redact model output before it reaches the end user - a PII-detection/redaction pass (regex-based for structured formats like SSNs/card numbers, or a dedicated tool like Microsoft Presidio) on outbound responses, especially for features that summarize or process documents that may contain sensitive data.',
      'Isolate retrieval-augmented generation (RAG) sources by the requesting user\'s actual access level, not just topical relevance - a RAG system retrieving from a shared index without per-document access control will surface content to users who shouldn\'t see it, even if the underlying documents have separate permissions in their source system.',
      'Disable or restrict model training/fine-tuning on user-submitted content by default, and make any opt-in explicit and clearly disclosed - accidental inclusion of sensitive user input in a future training set is a durable, hard-to-reverse disclosure.',
      'Set explicit system-prompt instructions and, where the platform supports it, output-format constraints that prevent the model from repeating back system prompts, internal configuration, or another user\'s context in a shared/multi-tenant deployment.',
      'Audit logs and transcripts on a recurring basis, not just after an incident, for accidental sensitive-data echoes - a routine sample review catches disclosure patterns before they\'re reported by a user or discovered externally.',
    ]},
  { cat:'AI / LLM', ref:'LLM03:2025', title:'Supply Chain', mitre:'Supply Chain Compromise - T1195',
    desc:'Third-party models, datasets, or plugins introduce vulnerable or malicious components into an AI pipeline - the same behavioral pattern as traditional software supply-chain risk, extended to model weights and training data.',
    steps:[
      'Source models and datasets only from vetted repositories with verifiable provenance (Hugging Face\'s signed-commit and model-card provenance features, or a vendor\'s official model registry) rather than an unofficial mirror or an unverified upload.',
      'Scan model files for unsafe deserialization risks before loading - a pickle-format model file can execute arbitrary code on load, so prefer safetensors or another format that doesn\'t support arbitrary object instantiation, and scan anything still in pickle format (e.g. Hugging Face\'s built-in Pickle Import scanner, or picklescan).',
      'Maintain an AI bill of materials tracking model provenance, version, license, and training-data source for every model in use, the same way a traditional SBOM tracks software dependencies - this is what lets you actually respond when a specific model or dataset is later found to be compromised or mislicensed.',
      'Pin specific model versions in production rather than auto-updating to "latest" - a model update can silently change behavior (including safety behavior) in ways a traditional dependency update wouldn\'t, so treat model version changes as a reviewed deployment, not an automatic pull.',
      'Vet third-party plugins, tools, and agent extensions with the same scrutiny as a code dependency - a plugin with broad tool access is effectively new code running with the agent\'s permissions, and should go through the same review as any other third-party integration.',
      'Apply integrity checks (checksums/hashes) to model artifacts at deployment time, matching the pattern used for traditional software artifacts, so the model actually loaded into production is verified to be the one that was reviewed and approved.',
    ]},
  { cat:'AI / LLM', ref:'LLM04:2025', title:'Data and Model Poisoning', mitre:'MITRE ATLAS - Resource Development / Persistence',
    desc:'Manipulated training, fine-tuning, or embedding data introduces hidden backdoors, bias, or degraded behavior that activates under specific triggering conditions.',
    steps:[
      'Validate the provenance and integrity of every training and fine-tuning data source before use - know specifically where each dataset came from and whether it\'s passed through any untrusted intermediate step; scraped web content and crowdsourced/user-submitted data carry materially higher poisoning risk than a curated, access-controlled internal source.',
      'Restrict who can contribute to training/fine-tuning datasets with the same access-control discipline applied to production code - a poisoned dataset is functionally equivalent to a malicious code commit, and should require review before being incorporated.',
      'Hold out a portion of training data for adversarial review, and specifically look for anomalous or duplicated patterns that could indicate a deliberately-inserted trigger, rather than assuming a large dataset is safe by volume alone.',
      'Test models against known trigger-pattern categories before deployment (specific unusual phrases, formatting, or input sequences designed to activate a backdoor) as part of pre-deployment evaluation, not just standard accuracy/quality benchmarks.',
      'Monitor production model outputs for behavioral drift from an established baseline on an ongoing basis, not just at initial deployment - a poisoning trigger may be designed to activate only under specific conditions that don\'t show up in routine testing.',
      'If fine-tuning on user-submitted or feedback data in a continuous-learning setup, rate-limit and review the influence any single source can have on the model - an unlimited feedback loop from a small number of accounts is a documented path to gradually poisoning model behavior over time.',
    ]},
  { cat:'AI / LLM', ref:'LLM06:2025', title:'Excessive Agency', mitre:'MITRE ATLAS - Impact',
    desc:'An AI agent is granted more autonomous permissions, tool access, or ability to take real-world action than its task actually requires, so a manipulated or malfunctioning agent can cause outsized damage.',
    steps:[
      'Grant agents least-privilege access to tools and systems, scoped per task rather than a broad standing credential - an agent that only needs to read calendar data shouldn\'t also hold write access to email or file storage just because it\'s convenient to provision once.',
      'Require explicit human approval for irreversible or high-impact actions specifically (sending external communications, financial transactions, deleting data, modifying access permissions) - define this list concretely per deployment rather than leaving "high-impact" as a vague judgment call the agent itself makes.',
      'Log every tool call an agent makes, with the reasoning/prompt context that triggered it, in a format a human can actually review after the fact - this is what makes an agent\'s actions auditable rather than a black box, and is essential for diagnosing when something goes wrong.',
      'Set hard rate and scope limits on what an autonomous agent can execute unsupervised within a given time window (maximum number of actions, maximum monetary value if it can initiate transactions) as a backstop independent of the agent\'s own reasoning, since a malfunctioning or manipulated agent can otherwise take many actions very quickly before a human notices.',
      'Isolate agent execution environments (sandboxed containers, restricted service accounts) from broader production systems, so a compromised or malfunctioning agent\'s blast radius is contained to what it was actually provisioned to touch.',
      'Periodically review and prune the actual permissions granted to each agent against what it\'s genuinely used in practice - agent tool access tends to accumulate over time the same way human account permissions do, and needs the same recurring review.',
    ]},
  { cat:'AI / LLM', ref:'LLM10:2025', title:'Unbounded Consumption', mitre:'Impact - T1499 (Endpoint Denial of Service, closest classic analogue)',
    desc:'Uncontrolled or excessive requests to a model cause runaway computational cost, resource exhaustion, or denial of service - extended to include financial cost, not just availability.',
    steps:[
      'Apply rate limiting and per-user/per-key quotas on model API calls, scaled to realistic usage patterns rather than a single global limit - a per-key quota stops one compromised or abused credential from consuming the entire budget/capacity available to every other user.',
      'Set maximum token/context limits per request, and specifically cap the size of any user-controllable input included in context (uploaded documents, retrieved search results) - an unbounded input size is a direct unbounded-cost vector even without malicious intent.',
      'Monitor cost and usage in real time with automatic circuit breakers that pause or throttle a specific key/user when spend crosses a defined threshold within a time window, rather than discovering a runaway cost spike only when the monthly bill arrives.',
      'Isolate high-cost operations (large-context requests, multi-step agent chains, image/video generation) behind additional authorization checks or a separate, more tightly-quota\'d tier, rather than exposing them at the same access level as routine low-cost requests.',
      'Set hard ceilings on recursive or chained model calls specifically (an agent calling itself, or a workflow that can trigger further model calls based on its own output) - an unbounded chain is one of the more common ways a single request turns into runaway cost or resource exhaustion.',
      'Alert on anomalous usage patterns per account (a sudden large increase in request volume or average request size relative to that account\'s own baseline), which catches both abuse and legitimate-but-costly misconfigurations before they become a large bill or a denial-of-service condition.',
    ]},
];

const CASE_STUDIES = [
  { year:'2010', title:'Stuxnet', href:'https://en.wikipedia.org/wiki/Stuxnet',
    body:'A worm believed to be a joint U.S.–Israeli operation physically damaged centrifuges at an Iranian uranium enrichment facility by manipulating industrial control systems while feeding operators falsified normal readings.',
    lesson:'The first widely-documented cyberattack with physical, real-world consequences - the entire reason this site treats OT/ICS as a distinct module rather than folding it into general IT.' },
  { year:'2013', title:'Target Corporation data breach', href:'https://en.wikipedia.org/wiki/Target_Corporation#2013_security_breach',
    body:'Attackers stole network credentials from a third-party HVAC vendor, then pivoted into Target\'s network and installed point-of-sale malware, exposing roughly 40 million payment cards during the holiday shopping season.',
    lesson:'A textbook case for why the Third-Party/Vendor Risk Policy on the Runbooks tab exists - the breach didn\'t start with Target\'s own systems at all.' },
  { year:'2014', title:'Sony Pictures hack', href:'https://en.wikipedia.org/wiki/2014_Sony_Pictures_hack',
    body:'Attackers, later attributed by U.S. officials to North Korea, exfiltrated internal emails, unreleased films, and employee data, then deployed wiper malware that destroyed large portions of Sony\'s computing infrastructure.',
    lesson:'A destructive attack, not just a data leak - exactly the scenario the Backup & Disaster Recovery guidance on the Runbooks tab is built around.' },
  { year:'2017', title:'Equifax data breach', href:'https://en.wikipedia.org/wiki/2017_Equifax_data_breach',
    body:'A critical Apache Struts vulnerability was publicly disclosed and patched in March 2017; Equifax failed to apply it, and attackers exploited the same flaw months later, exposing sensitive data on roughly 143 million people.',
    lesson:'The gap wasn\'t sophistication, it was patch management - the exact combination this site\'s Vulnerability & Patch Management questions and the Zero-Day runbook are designed to catch.' },
  { year:'2017', title:'WannaCry ransomware attack', href:'https://en.wikipedia.org/wiki/WannaCry_ransomware_attack',
    body:'Self-propagating ransomware exploited a leaked NSA Windows SMB vulnerability (EternalBlue) to spread across unpatched systems worldwide within hours, crippling parts of the UK\'s National Health Service among thousands of other organizations.',
    lesson:'Shows exactly why this site\'s Ransomware runbook opens with isolation, not negotiation - and why untested backups turn an infection into a catastrophe.' },
  { year:'2017', title:'NotPetya', href:'https://en.wikipedia.org/wiki/Petya_(malware)',
    body:'Disguised as ransomware but built purely to destroy data, NotPetya spread through a compromised update to Ukrainian tax software and went on to cause over $10 billion in global damage, including to shipping giant Maersk.',
    lesson:'The clearest real-world case for the Supply Chain/Third-Party Compromise runbook - the entry point was software the victims trusted and had already installed.' },
  { year:'2020', title:'SolarWinds hack', href:'https://en.wikipedia.org/wiki/SolarWinds_hack',
    body:'Suspected Russian state-sponsored actors inserted malicious code into SolarWinds\' Orion software updates, compromising roughly 18,000 downstream customers including multiple U.S. federal agencies, undetected for months.',
    lesson:'The reason Maturity Model Phase 9 (Auditing & Validation) matters as much as Phase 5 (Control Implementation) - a control that exists but isn\'t independently verified can be silently subverted.' },
  { year:'2021', title:'Colonial Pipeline ransomware attack', href:'https://en.wikipedia.org/wiki/Colonial_Pipeline_ransomware_attack',
    body:'A ransomware attack, traced back to a single compromised password with no MFA on a legacy VPN account, forced the shutdown of a pipeline supplying nearly half the U.S. East Coast\'s fuel.',
    lesson:'One missing control - MFA on remote access - cascading into critical infrastructure disruption is exactly the kind of compounding risk this site\'s assessment is built to flag before it happens, not after.' },
];


const LEARNING_RESOURCES = {
  podcasts: [
    { name:'Darknet Diaries', desc:'Jack Rhysider narrates real-world hacking and breach stories as compelling long-form episodes - the most listened-to show in the genre.' },
    { name:'Risky Business', desc:'Weekly news and interviews aimed at practitioners, running since 2007 - built for signal over explainer.' },
    { name:'Smashing Security', desc:'Graham Cluley and Carole Theriault cover the same threat landscape with a lighter, more entertaining tone.' },
    { name:'CyberWire Daily', desc:'A tight daily news briefing hosted by Dave Bittner - built for a quick catch-up rather than a deep dive.' },
    { name:'Malicious Life', desc:'Ran Levi\'s narrative deep-dives into the history behind major cybercrimes, produced by Cybereason.' },
  ],
  newsletters: [
    { name:'tl;dr sec', desc:'A weekly curation of the best security engineering and AppSec writing, without the fluff.' },
    { name:'SANS NewsBites / @RISK / OUCH!', desc:'The SANS Institute\'s trio of newsletters covering news, vulnerabilities, and plain-language awareness tips.' },
    { name:'Unsupervised Learning', desc:'Daniel Miessler\'s newsletter sitting right at the intersection of security and AI - directly relevant to the trends on the News tab.' },
    { name:'CloudSecList', desc:'Marco Lancini\'s weekly, low-noise roundup of cloud-native security research and tooling.' },
  ],
  medium: [
    { name:'InfoSec Write-ups', desc:'The largest cybersecurity publication on Medium - bug bounty write-ups, CTF walkthroughs, and real vulnerability research, with its own weekly digest.' },
  ],
  newssites: [
    { name:'BleepingComputer', desc:'Fast, detailed coverage of breaking vulnerabilities, ransomware, and malware - often first to publish technical detail on an active incident.' },
    { name:'Krebs on Security', desc:'Brian Krebs\' investigative reporting - slower, deeper breach investigations rather than daily news volume.' },
    { name:'SecurityWeek', desc:'Broad daily coverage across vulnerabilities, breaches, and industry news - a solid single feed to check regularly.' },
  ],
  linkedin: [
    { name:'The Cyber Security Hub™', desc:'One of the largest cybersecurity communities on LinkedIn, with a widely-subscribed newsletter surfacing industry news and leadership commentary.' },
  ],
};


let pendingAnchor = location.hash ? location.hash.slice(1) : null;

// Only clears pendingAnchor on a successful scroll. renderApp() calls this
// right after renderActiveTab(), but tabs that load live data (e.g.
// Exploits) haven't rendered their real content yet at that point - the
// target element doesn't exist until the async load finishes. Leaving
// pendingAnchor set on a miss lets those tabs call this again once their
// content is actually in the DOM (see renderExploitsTab) instead of the
// anchor being silently swallowed on the first, too-early attempt.
function scrollToPendingAnchor(){
  if(!pendingAnchor) return;
  const el = document.getElementById(pendingAnchor);
  if(el && typeof el.scrollIntoView === 'function'){
    el.scrollIntoView({ behavior:'smooth', block:'start' });
    pendingAnchor = null;
  }
}

function renderApp(){
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

// Keeps --viewport-width (consumed by .masthead's full-bleed breakout in
// app.css) equal to the real, scrollbar-excluded viewport width - see the
// comment above .masthead for why plain 100vw isn't safe there. Called from
// observeReveals() because that runs after every content render (initial
// load, tab switches, and narrower re-renders like the Exploits filter
// pills that update the DOM without going through renderApp() at all) -
// any of those can toggle the vertical scrollbar at a constant window
// width, and a plain resize listener alone would miss that.
//
// The immediate read can land mid-transition right after a viewport/DPR
// change (observed while testing: a page load that landed just as the
// browser was still settling a device-emulation switch briefly read a
// clientWidth that matched neither the old nor the new size, and since
// nothing else would have re-fired, that wrong value would've stuck
// permanently). The setTimeout re-reads shortly after, once layout has
// genuinely settled, correcting anything the immediate read got wrong -
// cheap insurance against a bad reading being permanent instead of a brief
// flash. Deliberately not requestAnimationFrame: rAF is tied to the
// compositor and simply never fires for a backgrounded/non-visible tab
// (confirmed while testing this fix), which would turn "briefly wrong"
// into "wrong until the tab regains focus."
function syncViewportWidthVar(){
  document.documentElement.style.setProperty('--viewport-width', document.documentElement.clientWidth + 'px');
  setTimeout(()=>{
    document.documentElement.style.setProperty('--viewport-width', document.documentElement.clientWidth + 'px');
  }, 100);
}

function observeReveals(){
  syncViewportWidthVar();
  const els = document.querySelectorAll('.section-tile, .page-intro');
  if(!('IntersectionObserver' in window)){
    els.forEach(el=>el.classList.add('revealed'));
    return;
  }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold:0, rootMargin:'0px 0px -40px 0px' });
  // threshold must stay 0 (any visible pixel), not a ratio like 0.06 - a
  // ratio is measured against the target's OWN height, and a tile that
  // grows past ~15-16k px (e.g. the live News grid with 75 cards) can
  // never show 6% of itself in one viewport, so it would silently never
  // reveal. This bit the News tab directly once the live feed grew past a
  // handful of items.
  els.forEach(el=> io.observe(el));
}

function renderTabNav(){
  const nav = document.getElementById('tabnav');
  const dropdownMap = { home: HOME_DROPDOWN, assessment: ASSESSMENT_DROPDOWN };

  const navHtml = TOP_TABS.map(t=>{
    const dd = dropdownMap[t.id];
    const label = t.id==='home' ? `<span class="tab-btn-icon" aria-label="Home">${icon('home')}</span>` : t.label;
    if(dd){
      const parentActive = activeTab===t.id || dd.some(d=>d.id===activeTab);
      return `
        <div class="tab-item has-dropdown">
          <a class="tab-btn ${parentActive?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${label} <span class="tab-caret" data-toggle="1">▾</span></a>
          <div class="tab-dropdown">
            ${dd.map(d=>`<a class="dropdown-link ${activeTab===d.id?'active':''}" href="${pathForTab(d.id)}" data-tab="${d.id}">${d.label}</a>`).join('')}
          </div>
        </div>
      `;
    }
    return `<a class="tab-btn ${activeTab===t.id?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${label}</a>`;
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
  btn.setAttribute('aria-label', `Switch to ${isLight ? 'dark' : 'light'} mode`);
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
  const dropdownMap = { home: HOME_DROPDOWN, assessment: ASSESSMENT_DROPDOWN };
  TOP_TABS.forEach(t=>{
    idx.push({ type:'Page', title:t.label, tab:t.id });
    (dropdownMap[t.id] || []).forEach(d=> idx.push({ type:'Page', title:d.label, tab:d.id }));
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
    const dropdownMap = { home: HOME_DROPDOWN, assessment: ASSESSMENT_DROPDOWN };
    const panel = document.createElement('div');
    panel.className = 'mobile-nav-panel';
    panel.id = 'mobileNavPanel';
    panel.innerHTML = TOP_TABS.map(t=>{
      const dd = dropdownMap[t.id];
      return `
        <a class="mobile-nav-link ${activeTab===t.id?'active':''}" href="${pathForTab(t.id)}" data-tab="${t.id}">${t.id==='home' ? 'Home' : t.label}</a>
        ${(dd||[]).map(d=>`<a class="mobile-nav-sublink ${activeTab===d.id?'active':''}" href="${pathForTab(d.id)}" data-tab="${d.id}">${d.label}</a>`).join('')}
      `;
    }).join('');
    document.querySelector('.masthead').appendChild(panel);
    wireNavLinksByDataset(panel, '[data-tab]', closeMenu);
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
  activeTab = id;
  pendingAnchor = anchor || null;
  const path = pathForTab(id, anchor);
  if(location.pathname + location.hash !== path){
    history.pushState({ tab:id, anchor: anchor || null }, '', path);
  }
  renderApp();
}

function renderActiveTab(){
  const container = document.getElementById('tabContent');
  if(activeTab === 'home') renderHomeTab(container);
  else if(activeTab === 'methodology') renderMethodologyTab(container);
  else if(activeTab === 'maturity') renderMaturityTab(container);
  else if(activeTab === 'metrics') renderMetricsTab(container);
  else if(activeTab === 'coreprinciples') renderCorePrinciplesTab(container);
  else if(activeTab === 'maturitymodel') renderMaturityModelTab(container);
  else if(activeTab === 'starterguide') renderStarterGuideTab(container);
  else if(activeTab === 'threatmodeling') renderThreatModelingTab(container);
  else if(activeTab === 'roadmap') renderRoadmapTab(container);
  else if(activeTab === 'runbook') renderRunbookTab(container);
  else if(activeTab === 'news') renderNewsTab(container);
  else if(activeTab === 'exploits') renderExploitsTab(container);
  else if(activeTab === 'casestudy') renderCaseStudyTab(container);
  else if(activeTab === 'playbooks') renderPlaybooksTab(container);
  else if(activeTab === 'glossary') renderGlossaryTab(container);
  else if(activeTab === 'references') renderReferencesTab(container);
  else if(activeTab === 'about') renderAboutTab(container);
  else if(activeTab === 'feedback') renderFeedbackTab(container);
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

function stageIllustration(stageId){
  const svgs = {
    discovery: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs><radialGradient id="gDisc" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stop-color="var(--accent-signal)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-signal)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gDisc)"/>
        <circle cx="30" cy="26" r="3" fill="var(--accent-signal)" opacity="0.6"/>
        <circle cx="72" cy="30" r="2.4" fill="var(--accent-signal)" opacity="0.5"/>
        <circle cx="68" cy="70" r="3" fill="var(--accent-signal)" opacity="0.6"/>
        <circle cx="24" cy="66" r="2" fill="var(--accent-signal)" opacity="0.5"/>
        <circle cx="43" cy="43" r="17" fill="none" stroke="var(--accent-signal)" stroke-width="4.5"/>
        <line x1="55" y1="55" x2="74" y2="74" stroke="var(--accent-signal)" stroke-width="5.5" stroke-linecap="round"/>
      </svg>`,
    transformation: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs>
          <radialGradient id="gTrans" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="var(--accent-secure)" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="var(--accent-secure)" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="gTransFlow" x1="30" y1="50" x2="62" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="var(--accent-amber)"/>
            <stop offset="100%" stop-color="var(--accent-secure)"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#gTrans)"/>
        <!-- scattered, disconnected findings on the left... -->
        <circle cx="26" cy="38" r="3.5" fill="var(--accent-amber)" opacity="0.85"/>
        <circle cx="23" cy="53" r="3" fill="var(--accent-critical)" opacity="0.75"/>
        <circle cx="29" cy="66" r="3" fill="var(--accent-pop)" opacity="0.8"/>
        <!-- ...flowing through the transformation... -->
        <path d="M33 52 Q45 44 58 50" fill="none" stroke="url(#gTransFlow)" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M52 44l8 6-8 6" fill="none" stroke="var(--accent-secure)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- ...into one verified, engineered control on the right -->
        <path d="M68 37l11 6.5v13l-11 6.5-11-6.5v-13z" fill="var(--accent-secure)"/>
        <path d="M62 50l4.5 4.5 9-9" fill="none" stroke="var(--text-on-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    optimization: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs><radialGradient id="gOpt" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="var(--accent-violet)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-violet)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gOpt)"/>
        <rect x="24" y="55" width="10" height="21" fill="var(--accent-violet)" opacity="0.55"/>
        <rect x="45" y="40" width="10" height="36" fill="var(--accent-violet)" opacity="0.78"/>
        <rect x="66" y="24" width="10" height="52" fill="var(--accent-violet)"/>
        <path d="M22 50l16-14 12 8 24-22" fill="none" stroke="var(--accent-violet)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
  };
  return svgs[stageId] || '';
}

function buildHeroInfinity(){
  // Lemniscate of Gerono, re-parametrized to start at a crossing point so each
  // half of the array is one clean, contiguous loop (not split across the array boundary).
  const a = 82, n = 90, cx = 130, cy = 68;
  const pts = [];
  for(let i=0;i<=n;i++){
    const t = Math.PI/2 + (i/n) * 2 * Math.PI;
    const denom = 1 + Math.sin(t)*Math.sin(t);
    pts.push([cx + a*Math.cos(t)/denom, cy + a*Math.sin(t)*Math.cos(t)/denom]);
  }
  const toPath = arr => 'M' + arr.map(p=>p[0].toFixed(2)+','+p[1].toFixed(2)).join(' L');
  const d = toPath(pts) + ' Z';
  const half = Math.round(n/2);
  const discoveryLoop = toPath(pts.slice(0, half+1));   // left loop
  const optimizeLoop = toPath(pts.slice(half, n+1));    // right loop
  return `
  <div class="hero-infinity">
    <svg viewBox="0 0 ${cx*2} ${cy*2}" xmlns="http://www.w3.org/2000/svg">
      <path d="${d}" fill="none" stroke="var(--line)" stroke-width="7"/>
      <path d="${discoveryLoop}" fill="none" stroke="var(--accent-signal)" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
      <path d="${optimizeLoop}" fill="none" stroke="var(--accent-violet)" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
      <path d="${d}" fill="none" stroke="var(--accent-signal)" stroke-width="7" stroke-linecap="round" class="infinity-flow"/>
    </svg>
    <div class="infinity-caption">
      <span style="color:var(--accent-signal)">Discovery</span>
      <span style="color:var(--accent-secure)">Transform</span>
      <span style="color:var(--accent-violet)">Optimization</span>
    </div>
  </div>`;
}

// Original, text/icon-based "stamps" referencing the frameworks/principles
// this site draws on - deliberately not a reproduction of any organization's
// actual logo or mark, per VISUAL-UPDATE-BRIEF.md item 11's trademark note.
const FRAMEWORK_STAMPS = [
  { label:'Defense in Depth', icon:'shield', color:'--accent-signal' },
  { label:'ISO 27001', icon:'register', color:'--accent-secure' },
  { label:'SOC 2', icon:'checklist', color:'--accent-violet' },
  { label:'Cyber Essentials', icon:'key', color:'--accent-amber' },
  { label:'PCI DSS', icon:'card', color:'--accent-critical' },
];
function buildFrameworkStamps(){
  return `
  <div class="stamp-row">
    ${FRAMEWORK_STAMPS.map(s=>`
      <div class="stamp" style="--stamp-color:var(${s.color})" title="${s.label}">
        <div class="stamp-ring"></div>
        <span class="stamp-icon">${icon(s.icon)}</span>
        <span class="stamp-label">${s.label}</span>
      </div>
    `).join('')}
  </div>`;
}

const SITE_TILES = [
  { tab:'methodology', icon:'register', title:'Methodology', desc:'Exactly how scoring and adaptive questions work.' },
  { tab:'maturity', icon:'cycle', title:'Maturity Model', desc:'The 10-phase journey and NIST\'s own maturity tiers.' },
  { tab:'coreprinciples', icon:'route', title:'Core Principles', desc:'The cybersecurity philosophy this site is built on.' },
  { tab:'runbook', icon:'document', title:'Runbooks', desc:'IR plans, backup/DR, and step-by-step incident runbooks.' },
  { tab:'news', icon:'signal', title:'Trends & News', desc:'Current threats, AI-in-security developments, and where to keep learning.' },
  { tab:'casestudy', icon:'urgent', title:'Case Studies', desc:'Stuxnet, SolarWinds, Equifax, and other watershed incidents.' },
  { tab:'playbooks', icon:'checklist', title:'Playbooks', desc:'OWASP Top 10 and AI-threat playbooks, mapped to MITRE ATT&CK.' },
  { tab:'roadmap', icon:'clock', title:'Roadmap', desc:'What\'s shipped, in progress, and planned for this site itself.' },
];

// Wide-format custom SVG banners for the "How it works" cards - same
// hand-built, theme-adaptive (var(--accent-*)) style as stageIllustration()
// above, just a banner aspect ratio instead of a circular badge. Each one
// depicts what that step actually does, not just an abstract icon.
function howItWorksIllustration(id){
  const svgs = {
    'hiw-clipboard': `
      <svg viewBox="0 0 260 100" preserveAspectRatio="xMidYMid meet">
        <line x1="50" y1="26" x2="118" y2="58" stroke="var(--accent-signal)" stroke-width="1.5" opacity="0.5"/>
        <line x1="110" y1="26" x2="124" y2="55" stroke="var(--accent-secure)" stroke-width="1.5" opacity="0.5"/>
        <line x1="170" y1="26" x2="138" y2="55" stroke="var(--accent-violet)" stroke-width="1.5" opacity="0.5"/>
        <line x1="212" y1="26" x2="144" y2="58" stroke="var(--accent-amber)" stroke-width="1.5" opacity="0.5"/>
        <circle cx="50" cy="20" r="9" fill="var(--accent-signal)" opacity="0.85"/>
        <rect x="100" y="11" width="18" height="18" rx="3" fill="var(--accent-secure)" opacity="0.85"/>
        <polygon points="170,10 180,28 160,28" fill="var(--accent-violet)" opacity="0.85"/>
        <circle cx="212" cy="20" r="8" fill="var(--accent-amber)" opacity="0.85"/>
        <rect x="106" y="52" width="48" height="38" rx="5" fill="var(--surface-raised)" stroke="var(--accent-signal)" stroke-width="2"/>
        <rect x="120" y="46" width="20" height="10" rx="2" fill="var(--accent-signal)"/>
        <line x1="114" y1="66" x2="146" y2="66" stroke="var(--accent-signal)" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="114" y1="74" x2="146" y2="74" stroke="var(--accent-signal)" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
        <line x1="114" y1="82" x2="134" y2="82" stroke="var(--accent-signal)" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
      </svg>`,
    'hiw-magnify': `
      <svg viewBox="0 0 260 100" preserveAspectRatio="xMidYMid meet">
        <g opacity="0.35">
          <circle cx="60" cy="25" r="4" fill="var(--text-muted)"/>
          <circle cx="90" cy="20" r="4" fill="var(--text-muted)"/>
          <circle cx="120" cy="30" r="4" fill="var(--text-muted)"/>
          <circle cx="100" cy="55" r="4" fill="var(--text-muted)"/>
          <circle cx="135" cy="48" r="4" fill="var(--text-muted)"/>
          <circle cx="60" cy="75" r="4" fill="var(--text-muted)"/>
        </g>
        <line x1="90" y1="20" x2="70" y2="50" stroke="var(--accent-critical)" stroke-width="2" stroke-linecap="round"/>
        <line x1="70" y1="50" x2="95" y2="80" stroke="var(--accent-critical)" stroke-width="2" stroke-linecap="round"/>
        <circle cx="90" cy="20" r="5" fill="var(--accent-critical)"/>
        <circle cx="70" cy="50" r="5" fill="var(--accent-critical)"/>
        <circle cx="95" cy="80" r="5" fill="var(--accent-critical)"/>
        <circle cx="175" cy="48" r="30" fill="none" stroke="var(--accent-signal)" stroke-width="4"/>
        <line x1="196" y1="69" x2="215" y2="88" stroke="var(--accent-signal)" stroke-width="6" stroke-linecap="round"/>
      </svg>`,
    'hiw-lightbulb': `
      <svg viewBox="0 0 260 100" preserveAspectRatio="xMidYMid meet">
        <circle cx="45" cy="45" r="22" fill="none" stroke="var(--accent-amber)" stroke-width="3"/>
        <path d="M45 23a22 22 0 0 1 15 38" fill="none" stroke="var(--accent-amber)" stroke-width="3" opacity="0.4"/>
        <line x1="45" y1="67" x2="45" y2="76" stroke="var(--accent-amber)" stroke-width="3" stroke-linecap="round"/>
        <line x1="38" y1="76" x2="52" y2="76" stroke="var(--accent-amber)" stroke-width="3" stroke-linecap="round"/>
        <rect x="90" y="24" width="130" height="10" rx="5" fill="var(--accent-critical)"/>
        <rect x="90" y="42" width="98" height="10" rx="5" fill="var(--accent-amber)"/>
        <rect x="90" y="60" width="70" height="10" rx="5" fill="var(--accent-signal)"/>
        <rect x="90" y="78" width="45" height="10" rx="5" fill="var(--line)"/>
      </svg>`,
    'hiw-transform': `
      <svg viewBox="0 0 260 100" preserveAspectRatio="xMidYMid meet">
        <rect x="30" y="60" width="24" height="24" fill="var(--line)" opacity="0.7"/>
        <rect x="66" y="46" width="24" height="38" fill="var(--line)" opacity="0.85"/>
        <line x1="115" y1="60" x2="150" y2="30" stroke="var(--accent-secure)" stroke-width="4" stroke-linecap="round"/>
        <path d="M140 28l12-3-3 12" fill="none" stroke="var(--accent-secure)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="175" y="40" width="24" height="44" fill="var(--accent-secure)" opacity="0.65"/>
        <rect x="205" y="20" width="24" height="64" fill="var(--accent-secure)"/>
        <circle cx="217" cy="20" r="10" fill="var(--accent-signal)"/>
        <path d="M212 20l3.5 3.5 7-7" fill="none" stroke="var(--text-on-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
  };
  return svgs[id] || '';
}

const HOW_IT_WORKS = [
  { n:'01', title:'Data Collection', sub:'Assessment', tagline:'Know exactly where you stand', icon:'hiw-clipboard',
    bullets:[
      'Answer an adaptive questionnaire shaped by your industry and infrastructure',
      'Only relevant questions appear - nothing generic, nothing wasted',
      'All six NIST CSF functions scored individually',
    ]},
  { n:'02', title:'Analysis', sub:null, tagline:'See risks a checklist would miss', icon:'hiw-magnify',
    bullets:[
      'Every answer cross-referenced against every other answer',
      'Compounding risk flagged, not just scored in isolation',
      'Vendor-specific mitigation notes where you\'ve named a product',
    ]},
  { n:'03', title:'Recommendation', sub:null, tagline:'Know what to fix first', icon:'hiw-lightbulb',
    bullets:[
      'A ranked, prioritized action list - not a wall of findings',
      'Each item tied to why it matters more than the rest',
      'Mapped back to the specific control it strengthens',
    ]},
  { n:'04', title:'Transformation', sub:null, tagline:'Prove the change actually worked', icon:'hiw-transform',
    bullets:[
      'Implement fixes using the matching Runbook or Playbook',
      'Re-assess on a cadence to track real progress',
      'See the score delta since your last run',
    ]},
];

const START_LINKS = [
  { title:'Getting Started With Cybersecurity Controls', desc:'The plain-language on-ramp before you touch the assessment', tab:'starterguide', icon:'route' },
  { title:'Current Trends', desc:'This site\'s own curated threat-landscape roundup', tab:'news', icon:'signal' },
  { title:'Exploits', desc:'Confirmed actively-exploited CVEs, scored by real-world risk', tab:'exploits', icon:'urgent' },
  { title:'Runbooks', desc:'Incident runbooks and foundational documents', tab:'runbook', icon:'document' },
  { title:'Threat Modeling & Forensics', desc:'How to think ahead of an attacker, and how to reconstruct what happened after one', tab:'threatmodeling', icon:'shield' },
];
// The four items below all go direct to CISA or NVD themselves, not this
// site's own content - kept as one consolidated element (see
// renderHomeTab's "Things to get you started" section) specifically so
// that "these are the authoritative sources, not a summary of them" reads
// as the point, rather than blending in as four more content-tile links.
const OFFICIAL_SOURCE_LINKS = [
  { title:'CISA KEV Catalog', desc:'Actively exploited vulnerabilities, updated continuously', href:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', domain:'cisa.gov' },
  { title:'NVD - National Vulnerability Database', desc:'The U.S. government\'s authoritative CVE repository', href:'https://nvd.nist.gov/', domain:'nvd.nist.gov' },
  { title:'Recently Flagged Exploits', desc:'CISA\'s KEV catalog, sorted with newest entries first', href:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', domain:'cisa.gov' },
  { title:'Ongoing Threat Actor Campaigns', desc:'CISA\'s cybersecurity advisories on active TTPs', href:'https://www.cisa.gov/news-events/cybersecurity-advisories', domain:'cisa.gov' },
];

function renderHomeTab(container){
  const stageOrder = ['discovery','transformation','optimization'];
  container.innerHTML = `
    <div class="page">
      <div class="hero-banner">
        <div class="hero-banner-inner">
          <h2 class="page-title">Cybersecurity posture assessment, made simple.</h2>
          <p class="page-lede">Answer a few adaptive questions. Get a scored, prioritized, evidence-based read on your cybersecurity health - and a clear path to improve it.</p>
          <div class="hero-links">
            <a href="${pathForTab('assessment')}" id="heroTakeAssessment" class="link-pill"><span class="link-pill-icon">${icon('checklist')}</span>Take the assessment</a>
            <a href="#how-it-works" class="link-pill secondary"><span class="link-pill-icon">${icon('route')}</span>How it works</a>
          </div>
        </div>
        ${buildHeroInfinity()}
      </div>

      <div class="section-tile">
        <h3 class="section-h" id="how-it-works">How it works</h3>
        <p class="body-text">Four steps, start to finish.</p>
        <div class="phase4-grid">
          ${HOW_IT_WORKS.map(s=>`
            <div class="phase4-card">
              <div class="phase4-banner">${howItWorksIllustration(s.icon)}</div>
              <div class="vnum">${s.n}</div>
              <h4>${s.title}${s.sub ? ` <span style="color:var(--text-muted); font-weight:400;">(${s.sub})</span>` : ''}</h4>
              <div class="phase4-tagline">${s.tagline}</div>
              <ul class="phase4-bullets">
                ${s.bullets.map(b=>`<li>${b}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section-tile">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <h3 class="section-h">Methodology</h3>
            <p class="body-text">Every question maps to a real control from a recognized framework - nothing here is invented. These frameworks are the guiding principles behind every score:</p>
          </div>
          ${buildFrameworkStamps()}
        </div>
        <div class="framework-badges">
          <div class="framework-badge">NIST CSF 2.0</div>
          <div class="framework-badge">CIS Controls v8</div>
          <div class="framework-badge">ISO 27001</div>
          <div class="framework-badge">NIS2</div>
          <div class="framework-badge">GDPR</div>
          <div class="framework-badge">Cyber Essentials</div>
          <div class="framework-badge">PCI DSS</div>
          <div class="framework-badge framework-badge-pipeline">+ more in the pipeline</div>
        </div>
        <p class="body-text">The baseline (NIST CSF + CIS) applies to every organization. The rest layer in based on your industry and the regions you operate in - a healthcare provider and a SaaS company are asked different follow-up questions, scored against different compliance overlays, because the risks and obligations genuinely differ. Operational Technology and DevSecOps modules do the same, appearing only where they're actually relevant. This framework set keeps growing as the tool matures.</p>
        <p class="body-text">Frameworks decide which controls matter; a consistent set of principles decides how the findings get prioritized and explained - proactive over reactive, defense in depth, least privilege, zero trust, and treating improvement as a continuous loop rather than a one-time project, among others.</p>
        <div class="method-link-row">
          <a href="${pathForTab('methodology')}" id="linkMethodologyFromHome" class="link-pill secondary"><span class="link-pill-icon">${icon('checklist')}</span>Explore the full Methodology</a>
          <a href="${pathForTab('coreprinciples')}" id="linkPrinciplesFromHome" class="link-pill secondary"><span class="link-pill-icon">${icon('hiw-lightbulb')}</span>Core Principles</a>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The three phases of the assessment</h3>
        <p class="body-text">Every assessment moves through three stages as a continuous workflow. Select a stage below for a quick summary of what it involves.</p>
        <div class="workflow-row">
          ${stageOrder.map((sid,i)=>`
            ${i>0 ? `<div class="workflow-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>` : ''}
            <div class="workflow-step" data-stage-detail="${sid}" style="border-top:2px solid ${STAGE_META[sid].color}">
              <div class="workflow-phase-tag">Phase ${i+1}</div>
              <div class="stage-illustration">${stageIllustration(sid)}</div>
              <h4 style="color:${STAGE_META[sid].color}">${STAGE_META[sid].label}</h4>
              <p>${STAGE_META[sid].blurb}</p>
            </div>
          `).join('')}
        </div>
        <div class="stage-detail-panel" id="stageDetailPanel" style="display:none;"></div>
        <div class="method-link-row">
          <a href="${pathForTab('maturity')}" id="linkMaturityExplore" class="link-pill secondary"><span class="link-pill-icon">${icon('cycle')}</span>Explore the full Maturity Model</a>
        </div>
      </div>

      <div class="section-tile">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <h3 class="section-h">Risk Score Matrix</h3>
            <p class="body-text">Every assessment runs on a scored matrix (see the <a href="${pathForTab('metrics')}" id="linkMetricsFromHome" class="inline-link">Metrics</a> page for the full breakdown). Select a number for what that risk level actually means:</p>
          </div>
          <div class="metrics-rubric-wrap">${buildScoringRubricSvg()}</div>
        </div>
        <div class="risk-slider-wrap">
          <div class="risk-slider-label">Interactive risk scale - the lower the score, the stronger the security posture</div>
          <div class="risk-slider-track">
            <div class="risk-slider-fill"></div>
            ${Array.from({length:10}, (_,i)=>`<button class="risk-slider-tick" data-risk="${i+1}" type="button">${i+1}</button>`).join('')}
          </div>
          <div class="risk-slider-ends"><span>1 - Minimal risk</span><span>10 - Severe risk</span></div>
          <div class="risk-slider-desc" id="riskSliderDesc"></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Things to get you started</h3>
        <p class="body-text">Real, current sources - not just this site's own content.</p>
        <div class="start-links">
          <div class="start-link-dropdown" id="officialSourcesDropdown">
            <button type="button" class="start-link start-link-dropdown-toggle">
              <div class="icon-badge">${icon('external')}</div>
              <div><h4>Official Sources - CISA &amp; NVD</h4><p>Direct links to the two authoritative catalogs themselves, not a summary of them</p></div>
              <span class="ext-mark start-link-dropdown-caret">▾</span>
            </button>
            <div class="start-link-dropdown-panel">
              ${OFFICIAL_SOURCE_LINKS.map(l=>`
                <a class="official-source-item" href="${l.href}" target="_blank" rel="noopener noreferrer">
                  <div><b>${l.title}</b><span>${l.desc}</span></div>
                  <span class="official-source-domain">${l.domain} ↗</span>
                </a>
              `).join('')}
            </div>
          </div>
          ${START_LINKS.map(l=>`
            <a class="start-link" ${l.href ? `href="${l.href}" target="_blank" rel="noopener noreferrer"` : `href="${pathForTab(l.tab)}" data-tab="${l.tab}"`}>
              <div class="icon-badge">${icon(l.icon)}</div>
              <div><h4>${l.title}</h4><p>${l.desc}</p></div>
              ${l.external ? '<span class="ext-mark">↗</span>' : ''}
            </a>
          `).join('')}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Explore the site</h3>
        <p class="body-text">Everything this platform offers, in one map.</p>
        <div class="site-tile-grid">
          ${SITE_TILES.map(t=>`
            <a class="site-tile" href="${pathForTab(t.tab)}" data-tab="${t.tab}">
              <div class="icon-badge">${icon(t.icon)}</div>
              <h4>${t.title}</h4>
              <p>${t.desc}</p>
            </a>
          `).join('')}
        </div>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaStart">Start an assessment →</a>
          <a class="cta-btn secondary" href="${pathForTab('methodology')}" id="ctaMethod">See how scoring works</a>
        </div>
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('ctaStart'), 'assessment');
  wireNavLink(document.getElementById('ctaMethod'), 'methodology');
  wireNavLink(document.getElementById('heroTakeAssessment'), 'assessment');
  wireNavLink(document.getElementById('linkMetricsFromHome'), 'metrics');
  wireNavLink(document.getElementById('linkMaturityExplore'), 'maturity');
  wireNavLink(document.getElementById('linkMethodologyFromHome'), 'methodology');
  wireNavLink(document.getElementById('linkPrinciplesFromHome'), 'coreprinciples');

  let openStageDetail = null;
  function closeStageDetail(){
    const panel = document.getElementById('stageDetailPanel');
    if(!panel) return;
    panel.classList.remove('open');
    openStageDetail = null;
    container.querySelectorAll('[data-stage-detail]').forEach(c=>c.classList.remove('stage-active'));
    const tile = panel.closest('.section-tile');
    if(tile) tile.classList.remove('has-open-overlay');
    setTimeout(()=>{ if(!panel.classList.contains('open')) panel.style.display = 'none'; }, 220);
  }
  container.querySelectorAll('[data-stage-detail]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      if(e.target.closest('.stage-detail-panel')) return; // clicks inside the open panel shouldn't re-toggle it
      e.stopPropagation();
      const sid = el.dataset.stageDetail;
      const panel = document.getElementById('stageDetailPanel');
      const d = STAGE_DETAIL[sid];
      if(openStageDetail === sid){ closeStageDetail(); return; }
      openStageDetail = sid;
      container.querySelectorAll('[data-stage-detail]').forEach(c=>c.classList.remove('stage-active'));
      el.classList.add('stage-active');
      const row = el.closest('.workflow-row') || el.parentElement;
      // Below the 700px breakpoint .workflow-row stacks into a column, and
      // every step is a separate block rather than three items on one
      // line. A position:absolute panel doesn't push later siblings down
      // regardless of where it's pinned, so pointing it at the clicked
      // step (rather than the row's own bottom) just made it float on top
      // of whichever step came next instead of the row's bottom. Give it
      // static, in-flow placement right after the clicked step there
      // instead, so it genuinely pushes the remaining steps down.
      // Above 700px all three steps share one line, so appending it to
      // the row and pinning it to that shared line's bottom edge (with
      // position:absolute) still spans the full row width correctly.
      const stacked = window.matchMedia('(max-width:700px)').matches;
      if(stacked){
        panel.classList.add('stage-detail-panel-inline');
        el.insertAdjacentElement('afterend', panel);
      } else {
        panel.classList.remove('stage-detail-panel-inline');
        row.appendChild(panel);
        panel.style.top = (el.offsetTop + el.offsetHeight) + 'px';
      }
      const openTile = el.closest('.section-tile');
      if(openTile) openTile.classList.add('has-open-overlay');
      panel.innerHTML = `
        <h4 style="color:${STAGE_META[sid].color}">${STAGE_META[sid].label}</h4>
        <p class="body-text">${d.summary}</p>
        <p class="body-text"><b>Scoring metrics used:</b> ${d.metrics}</p>
        <a href="${pathForTab('maturity', `maturity-${sid}`)}" id="stageDetailMaturityLink" class="inline-link">See ${STAGE_META[sid].label} in full on the Maturity Model page →</a>
      `;
      panel.style.display = 'block';
      requestAnimationFrame(()=> panel.classList.add('open'));
      wireNavLink(document.getElementById('stageDetailMaturityLink'), 'maturity', `maturity-${sid}`);
    });
  });
  const riskDesc = document.getElementById('riskSliderDesc');
  function closeRiskDesc(){
    riskDesc.classList.remove('open');
  }
  document.addEventListener('click', (e)=>{
    if(openStageDetail && !e.target.closest('.workflow-row') && !e.target.closest('.stage-detail-panel')){
      closeStageDetail();
    }
    if(riskDesc.classList.contains('open') && !e.target.closest('.risk-slider-wrap')){
      closeRiskDesc();
    }
  });
  // stage-detail-panel still overlays content instead of pushing it, so
  // scrolling past it should tuck it away automatically rather than
  // leaving it drifting under the cursor. riskDesc is in-flow (it pushes
  // "Things to get you started" down instead of floating over it), so it
  // has no such drift to guard against and can just stay open on scroll
  // like any other content.
  window.addEventListener('scroll', ()=>{
    if(openStageDetail) closeStageDetail();
  }, { passive:true });

  container.querySelectorAll('.risk-slider-tick').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const n = btn.dataset.risk;
      container.querySelectorAll('.risk-slider-tick').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      riskDesc.innerHTML = `<b>Risk score ${n}:</b> ${RISK_SCORE_DESCRIPTIONS[n]}`;
      riskDesc.classList.remove('open');
      requestAnimationFrame(()=> riskDesc.classList.add('open'));
    });
  });

  wireNavLinksByDataset(container, '.site-tile');
  wireNavLinksByDataset(container, '.start-link[data-tab]');

  const sourcesDropdown = document.getElementById('officialSourcesDropdown');
  const sourcesToggle = sourcesDropdown.querySelector('.start-link-dropdown-toggle');
  sourcesToggle.addEventListener('click', (e)=>{
    e.stopPropagation();
    sourcesDropdown.classList.toggle('open');
  });
  document.addEventListener('click', (e)=>{
    if(sourcesDropdown.classList.contains('open') && !e.target.closest('#officialSourcesDropdown')){
      sourcesDropdown.classList.remove('open');
    }
  });
}

function renderMethodologyTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <div class="page-eyebrow">How It Works</div>
            <h2 class="page-title">Methodology</h2>
            <p class="page-lede">What you get scored on, why the question set changes per organization, and how the final synthesis is built.</p>
          </div>
          ${buildFrameworkStamps()}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Why NIST CSF and CIS Controls</h3>
        <p class="body-text"><b>NIST CSF 2.0</b> was built by the U.S. National Institute of Standards and Technology as an outcomes-based framework rather than a prescriptive technical checklist - it describes <i>what</i> a mature security program achieves (govern, identify, protect, detect, respond, recover) without dictating exactly how. That makes it vendor-neutral, technology-agnostic, and adopted internationally well beyond the US, which is exactly why it works as a common baseline regardless of your size, sector, or maturity level. Nearly every other major framework - ISO 27001, SOC 2, the others in this assessment - maps cleanly onto its structure, so it functions as a shared language between them rather than one more competing standard.</p>
        <p class="body-text"><b>CIS Controls v8</b> was chosen to complement it for the opposite reason: where NIST CSF stays abstract, CIS is deliberately prescriptive and prioritized - a maintained, practical answer to "where do I actually start." Pairing the two gives this assessment both the high-level structure and the concrete, specific questions underneath it, rather than picking one at the expense of the other.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The framework backbone</h3>
        <p class="body-text">Every assessment scores six functions, matching <b>NIST CSF 2.0</b>, with question granularity drawn from <b>CIS Controls v8</b>. Each question maps to a real control - nothing here is invented.</p>
        <div class="func-legend">
          ${FUNCTIONS.map(f=>`<div class="func-legend-row"><div class="func-legend-dot" style="background:${FUNC_COLORS[f]}"></div><div><b>${f}</b><span>${
            f==='Govern' ? 'Policy, roles, oversight, and risk-informed decisions' :
            f==='Identify' ? 'Asset inventory, data classification, third-party risk' :
            f==='Protect' ? 'Access control, patching, training, endpoint defense' :
            f==='Detect' ? 'Logging, monitoring, vulnerability scanning, testing' :
            f==='Respond' ? 'Incident response plan, team, communication' :
            'Backup testing, business continuity, isolation'
          }</span></div></div>`).join('')}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Scoring, in brief</h3>
        <p class="body-text">Each question scores 0, 1, or 2 depending on the answer chosen, rolled up into a function score and an overall percentage. The full breakdown of exactly how that's calculated, what each score band means, and how to read your result lives on the <a href="${pathForTab('metrics')}" id="linkMetricsFromMethod" class="inline-link">Metrics</a> page.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Why the questions themselves change</h3>
        <p class="body-text">Before scoring starts, you choose an industry and any relevant compliance standards (ISO 27001 / NIS2 / SOC 2), which inject a handful of framework-specific questions into the relevant functions. Two further sections adapt on their own: <b>Operational Technology</b> is skipped by default for industries where it's rarely applicable (and can be included manually), and <b>DevSecOps / containerization</b> only expands if you confirm you develop software. Nobody answers questions that don't apply to them.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The part that isn't just averaging</h3>
        <p class="body-text">Before the results are shown, every answer is cross-checked against every other answer for known dangerous combinations - not just totalled. No MFA plus many unreviewed vendors, exposed remote access plus untested backups, no email authentication plus no security training: each is flagged as its own finding, because the combination is materially riskier than either gap alone. This is the difference between a scored checklist and an actual risk read.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Vendor-aware, not a scanner</h3>
        <p class="body-text">If you name specific products (a firewall vendor, hosting provider, etc.), the report can surface mitigation guidance tied to well-documented historical exploitation patterns for that product. This is intentionally illustrative, not a live vulnerability feed - it's a prompt to check current advisories, not a substitute for a real vulnerability management program.</p>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaStart2">Start an assessment →</a>
        </div>
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('ctaStart2'), 'assessment');
  wireNavLink(document.getElementById('linkMetricsFromMethod'), 'metrics');
}

// ANIMATIONS-BRIEF.md: a "climbing" visual for the Maturity Model intro -
// ascending bars in the same discovery/transformation/optimization colors
// already used for the stage illustrations and phase table on this exact
// page, so it reads as an extension of content already here rather than a
// new palette. CSS-driven (staggered @keyframes per bar, see app.css)
// rather than JS-per-frame, and respects prefers-reduced-motion there too.
function buildMaturityClimbSvg(){
  const bars = [
    { h:30, color:'--accent-signal' },
    { h:46, color:'--accent-signal' },
    { h:64, color:'--accent-secure' },
    { h:82, color:'--accent-secure' },
    { h:100, color:'--accent-violet' },
    { h:120, color:'--accent-violet' },
  ];
  const barW = 24, gap = 12, baseY = 132;
  return `
  <svg viewBox="0 0 280 140" xmlns="http://www.w3.org/2000/svg">
    <line x1="2" y1="${baseY}" x2="278" y2="${baseY}" stroke="var(--line)" stroke-width="1.5"/>
    ${bars.map((b,i)=>{
      const x = 8 + i*(barW+gap);
      return `<rect class="climb-bar" x="${x}" y="${baseY-b.h}" width="${barW}" height="${b.h}" rx="3" fill="var(${b.color})" style="animation-delay:${(i*0.16).toFixed(2)}s"/>`;
    }).join('')}
    <circle class="climb-peak-dot" cx="${8+5*(barW+gap)+barW/2}" cy="${baseY-120-12}" r="4.5" fill="var(--accent-violet)"/>
  </svg>`;
}

function renderMaturityTab(container){
  const stageOrder = ['discovery','transformation','optimization'];
  let html = `
    <div class="page">
      <div class="page-intro">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <div class="page-eyebrow">Maturity Model</div>
            <h2 class="page-title">Maturity Model</h2>
            <p class="page-lede">How a security program actually progresses - ten phases across three stages, four recognized maturity tiers, and what each number on your results page means for where you actually stand.</p>
          </div>
          <div class="maturity-climb-wrap">${buildMaturityClimbSvg()}</div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Model at a glance</h3>
        <p class="body-text">All ten phases side by side: what goes in, what comes out, and what "done" actually looks like before the program moves on. Use this as the quick reference; the sections below go phase by phase in depth.</p>
        <div class="table-wrap">
          <table class="data-table glance-table">
            <thead><tr><th>Level</th><th>Phase</th><th>Stage</th><th>Inputs reviewed</th><th>What it produces</th><th>Definition of done</th></tr></thead>
            <tbody>
              ${PHASES.map(p=>`
                <tr>
                  <td class="dt-level">${String(p.num).padStart(2,'0')}</td>
                  <td class="dt-title">${p.title}</td>
                  <td><span class="stage-chip" style="--stage-color:${STAGE_META[p.stage].color}">${STAGE_META[p.stage].label}</span></td>
                  <td>${p.inputs}</td>
                  <td>${p.output}</td>
                  <td>${p.doneWhen}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
  `;
  stageOrder.forEach(stageId=>{
    const meta = STAGE_META[stageId];
    html += `<div class="section-tile" id="maturity-${stageId}">`;
    html += `
      <div class="stage-band" style="--stage-color:${meta.color}">
        <div class="stage-illustration stage-illustration-sm">${stageIllustration(stageId)}</div>
        <div><h3 class="stage-label">${meta.label}</h3><div class="stage-range">${meta.range}</div></div>
        <p>${meta.blurb}</p>
      </div>
    `;
    PHASES.filter(p=>p.stage===stageId).forEach(p=>{
      html += `
        <div class="phase-row" style="--phase-color:${meta.color}">
          <div class="phase-num">${String(p.num).padStart(2,'0')}</div>
          <div><h4>${p.title}</h4><p>${p.desc}</p></div>
        </div>
      `;
    });
    html += `</div>`;
  });
  html += `
      <div class="section-tile">
        <div class="roadmap-loop">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-signal)" stroke-width="1.8" stroke-linecap="round"><path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2"/><path d="M18.5 4v3.2H15.3M5.5 20v-3.2H8.7"/></svg>
          <span>Phase 10 feeds back into Phase 4 - the Assessment tab is designed to be re-run on a cadence, precisely to drive this loop rather than end it.</span>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Maturity is a known concept - we're borrowing it deliberately</h3>
        <p class="body-text">NIST CSF itself defines four <b>Implementation Tiers</b> describing how an organization's risk management practice matures - this site's repeat-assessment design mirrors that same progression, just measured through this specific instrument instead of a qualitative review.</p>
        <div class="tier-track">
          <div class="tier-row"><div class="tier-num">01</div><div class="tier-body"><h4>Partial</h4><p>Risk management is reactive and ad hoc. Practices exist inconsistently across the organization, often driven by individual initiative rather than policy.</p></div></div>
          <div class="tier-row"><div class="tier-num">02</div><div class="tier-body"><h4>Risk Informed</h4><p>Risk management practices are approved by management but not established as organization-wide policy - awareness exists, consistency doesn't yet.</p></div></div>
          <div class="tier-row"><div class="tier-num">03</div><div class="tier-body"><h4>Repeatable</h4><p>Practices are formally approved and expressed as policy, applied consistently, and regularly updated based on changes in risk and the environment.</p></div></div>
          <div class="tier-row"><div class="tier-num">04</div><div class="tier-body"><h4>Adaptive</h4><p>The organization adapts its practices continuously based on lessons learned and predictive indicators - security is a living, improving process, not a static state.</p></div></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The full phase table</h3>
        <p class="body-text">Every phase, with how it's actually monitored and what it unlocks next. For how your score itself is calculated, see the <a href="${pathForTab('metrics')}" id="linkMetricsFromMaturity" class="inline-link">Metrics</a> page.</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Level</th><th>Stage</th><th>Title</th><th>How it's monitored</th><th>How it advances the program</th></tr></thead>
            <tbody>
              ${PHASES.map(p=>`
                <tr>
                  <td class="dt-level">${String(p.num).padStart(2,'0')}</td>
                  <td>${STAGE_META[p.stage].label}</td>
                  <td class="dt-title">${p.title}</td>
                  <td>${p.monitor}</td>
                  <td>${p.evolve}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaMaturityAssess">Start an assessment →</a>
          <a class="cta-btn secondary" href="${pathForTab('runbook')}" id="ctaMaturityDocs">See documentation & runbooks</a>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;
  wireNavLink(document.getElementById('ctaMaturityAssess'), 'assessment');
  wireNavLink(document.getElementById('ctaMaturityDocs'), 'runbook');
  wireNavLink(document.getElementById('linkMetricsFromMaturity'), 'metrics');
}

// UX-VISUAL-CREDIBILITY-BRIEF.md §4: SVG-native SMIL animation
// (<animateMotion>) isn't CSS, so no @media (prefers-reduced-motion) rule
// can gate it - the two moving-dot diagrams below (Runbooks' lifecycle
// loop, Playbooks' flow) need this JS-level check instead, unlike every
// other animation on the site which is plain CSS and already covered by
// app.css's own reduced-motion blocks.
function prefersReducedMotion(){
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildLifecycleSvg(){
  const stages = ['Draft','Review','Approve','Publish','Periodic Review'];
  const cx=200, cy=170, r=110;
  const pts = stages.map((s,i)=>{
    const a = (i/stages.length)*2*Math.PI - Math.PI/2;
    return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a), label:s };
  });
  const pathD = `M ${cx+r},${cy} A ${r},${r} 0 1,1 ${cx-r+0.01},${cy} A ${r},${r} 0 1,1 ${cx+r},${cy}`;
  // Static dot sits exactly on the path's own starting point (cx+r, cy)
  // when motion is reduced - a deliberate resting position, not a
  // truncated animation.
  const dot = prefersReducedMotion()
    ? `<circle cx="${(cx+r).toFixed(1)}" cy="${cy}" r="6" fill="var(--accent-signal)"/>`
    : `<circle r="6" fill="var(--accent-signal)"><animateMotion dur="9s" repeatCount="indefinite"><mpath href="#lifecyclePath"/></animateMotion></circle>`;
  return `
  <svg viewBox="-30 0 400 340" xmlns="http://www.w3.org/2000/svg">
    <path id="lifecyclePath" d="${pathD}" fill="none" stroke="var(--line)" stroke-width="1.5"/>
    ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="var(--surface)" stroke="var(--accent-secure)" stroke-width="1.6"/>`).join('')}
    ${pts.map(p=>{
      const labelY = p.y + (p.y > cy ? 22 : (p.y < cy - 5 ? -14 : 5));
      const anchor = p.x > cx+30 ? 'start' : p.x < cx-30 ? 'end' : 'middle';
      return `<text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" class="lifecycle-node-label">${p.label}</text>`;
    }).join('')}
    ${dot}
    <text x="200" y="175" text-anchor="middle" class="lifecycle-node-label" style="font-size:12px; letter-spacing:0.05em;">continuous, not one-and-done</text>
  </svg>`;
}

// Playbooks' own animation (VISUAL-UPDATE-BRIEF.md item 9) - same
// animated-dot-along-a-path technique and .lifecycle-row/.lifecycle-wrap
// layout as Runbooks' lifecycle diagram for visual consistency between the
// two pages, but a distinct linear flow depicting this page's own
// construction path (attack pattern -> MITRE tactic -> NIST control ->
// concrete steps), not a re-skin of the same circular diagram.
function buildPlaybookFlowSvg(){
  // viewBox height picked so this renders at roughly the same height as
  // Runbooks' circular lifecycle diagram at the shared .lifecycle-wrap
  // svg width (380px) - a literal top-to-bottom translation of that
  // diagram's 4-node spacing would render noticeably taller/lankier here.
  const nodes = [
    { label:'Attack Pattern', color:'--accent-critical', y:24 },
    { label:'MITRE Tactic', color:'--accent-amber', y:84 },
    { label:'NIST Control', color:'--accent-signal', y:144 },
    { label:'Response Steps', color:'--accent-secure', y:200 },
  ];
  const cx = 40;
  const pathD = `M ${cx},${nodes[0].y} L ${cx},${nodes[nodes.length-1].y}`;
  // Static dot at the path's own starting point (the first node) when
  // motion is reduced - see prefersReducedMotion()'s comment above.
  const dot = prefersReducedMotion()
    ? `<circle cx="${cx}" cy="${nodes[0].y}" r="6" fill="var(--accent-signal)"/>`
    : `<circle r="6" fill="var(--accent-signal)"><animateMotion dur="6s" repeatCount="indefinite"><mpath href="#playbookFlowPath"/></animateMotion></circle>`;
  return `
  <svg viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg">
    <path id="playbookFlowPath" d="${pathD}" fill="none" stroke="var(--line)" stroke-width="1.5"/>
    ${nodes.map(n=>`
      <circle cx="${cx}" cy="${n.y}" r="7" fill="var(--surface)" stroke="var(${n.color})" stroke-width="2.2"/>
      <text x="${cx+20}" y="${n.y+4}" class="lifecycle-node-label">${n.label}</text>
    `).join('')}
    ${dot}
  </svg>`;
}

// METRICS-ANIMATION-REVISION-BRIEF.md: replaces the first pass (three
// static circles, no motion tying them together - too basic and, per
// direct review, "several disconnected static elements placed near each
// other"). The corrected concept is one connected composition telling
// the actual story of how Metrics works: individual 0/1/2 answers
// (small red/amber/green dots, each following its own short curved
// path via <animateMotion> - same SMIL technique buildLifecycleSvg
// already uses for its moving dot, staggered so they arrive in a
// flowing stream rather than all at once) converging into a radial
// gauge, which fills along a red-amber-green arc (matching the exact
// exposure-band language on this page's own "Reading your score"
// section) as a needle sweeps up and settles, with a percentage readout
// fading in at the same moment. Faint dashed trail lines behind each dot
// are always rendered (not just during motion) so the "many inputs feed
// one gauge" story still reads with reduced motion. SMIL isn't
// controllable via CSS media queries (see prefersReducedMotion()'s own
// comment above buildLifecycleSvg), so the dots are omitted entirely
// when motion is reduced, leaving only the gauge - itself CSS-driven and
// covered by app.css's own reduced-motion block, shown at its settled
// reading rather than hidden. Sits in .page-intro-row next to the page
// title on the standalone Metrics page; on Home it's placed inside the
// Risk Score Matrix section instead, alongside (not replacing) that
// section's existing interactive 1-10 scale.
function buildScoringRubricSvg(){
  const dots = [
    { x:18, y:18, color:'--accent-critical' },
    { x:44, y:14, color:'--accent-signal' },
    { x:12, y:46, color:'--accent-amber' },
    { x:38, y:52, color:'--accent-signal' },
    { x:16, y:78, color:'--accent-critical' },
    { x:46, y:82, color:'--accent-amber' },
    { x:26, y:100, color:'--accent-signal' },
  ];
  const convergeX = 128, convergeY = 96;
  const n = dots.length;
  const reduced = prefersReducedMotion();
  const paths = dots.map(d=>{
    const midX = (d.x+convergeX)/2, midY = (d.y+convergeY)/2 - 10;
    return `M${d.x},${d.y} Q${midX},${midY} ${convergeX},${convergeY}`;
  });
  return `
  <svg viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="metricsArcGrad" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="var(--accent-critical)"/>
        <stop offset="50%" stop-color="var(--accent-amber)"/>
        <stop offset="100%" stop-color="var(--accent-signal)"/>
      </linearGradient>
    </defs>
    ${paths.map(p=>`<path d="${p}" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>`).join('')}
    ${reduced ? '' : dots.map((d,i)=>{
      const start = (i/n)*0.5;
      const end = start + 0.16;
      return `
        <circle r="3.2" fill="var(${d.color})">
          <animateMotion dur="5s" repeatCount="indefinite" calcMode="linear" path="${paths[i]}" keyPoints="0;0;1;1" keyTimes="0;${start.toFixed(2)};${end.toFixed(2)};1"/>
          <animate attributeName="opacity" dur="5s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;${(end-0.02).toFixed(2)};${end.toFixed(2)};1"/>
        </circle>`;
    }).join('')}
    <path d="M151,92 a34,34 0 0 1 68,0" fill="none" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/>
    <path class="metrics-gauge-arc" d="M151,92 a34,34 0 0 1 68,0" fill="none" stroke="url(#metricsArcGrad)" stroke-width="6" stroke-linecap="round" stroke-dasharray="107" stroke-dashoffset="107"/>
    <line class="metrics-gauge-needle" x1="185" y1="92" x2="185" y2="62" stroke="var(--text)" stroke-width="3" stroke-linecap="round" style="transform-origin:185px 92px;"/>
    <circle cx="185" cy="92" r="4" fill="var(--text)"/>
    <text class="metrics-gauge-readout" x="185" y="118" text-anchor="middle">76%</text>
  </svg>`;
}

function renderMetricsTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <div class="page-eyebrow">Scoring & Calculation</div>
            <h2 class="page-title">Metrics</h2>
            <p class="page-lede">Exactly how a score is calculated, what each band means, and how to read your result - all the scoring mechanics in one place.</p>
          </div>
          <div class="metrics-rubric-wrap">${buildScoringRubricSvg()}</div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">How the score is calculated</h3>
        <p class="body-text">Each question scores 0, 1, or 2 depending on the answer chosen. A function's score is the sum of its answers divided by the maximum possible, expressed as a percentage. The overall score is the average across all six NIST CSF functions - visible as the radial gauge on your results page. This is a straightforward roll-up, but it isn't the whole picture: see "the part that isn't just averaging" on the <a href="${pathForTab('methodology')}" id="linkMethodFromMetrics1" class="inline-link">Methodology</a> page for how compounding-risk flags factor in separately.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Reading your score</h3>
        <p class="body-text">The overall percentage is a snapshot, not a grade. It exists to be compared against your <i>own</i> next assessment - the trend matters more than any single number.</p>
        <div class="verdict-scale">
          <div class="verdict-cell"><div class="vrange">0–29%</div><div class="vlabel" style="color:var(--accent-critical)">Critical exposure</div></div>
          <div class="verdict-cell"><div class="vrange">30–54%</div><div class="vlabel" style="color:var(--accent-signal)">Elevated exposure</div></div>
          <div class="verdict-cell"><div class="vrange">55–79%</div><div class="vlabel">Moderate exposure</div></div>
          <div class="verdict-cell"><div class="vrange">80–100%</div><div class="vlabel" style="color:var(--accent-secure)">Strong health</div></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Why your score is what it is</h3>
        <p class="body-text">Bands below are shown on a 0–10 scale (your overall percentage ÷ 10) - a 5–7, for example, means something specific about your organization, not just "middling." For how each phase of the <a href="${pathForTab('maturity')}" id="linkMaturityFromMetrics" class="inline-link">Maturity Model</a> connects to these bands, see that page directly.</p>
        ${SCORE_RUBRIC.map(r=>`
          <div class="rubric-card">
            <div class="rubric-head"><div class="rubric-range">${r.range}</div><div class="rubric-verdict">${r.verdict}</div></div>
            <div class="rubric-row"><b>Good bits</b><span>${r.good}</span></div>
            <div class="rubric-row"><b>Bad bits</b><span>${r.bad}</span></div>
            <div class="rubric-row"><b>Why this number</b><span>${r.why}</span></div>
            <div class="rubric-row"><b>Priority</b><span>${r.priority}</span></div>
          </div>
        `).join('')}
      </div>

      <div class="section-tile">
        <h3 class="section-h">How this site tracks it over time</h3>
        <p class="body-text">Every completed assessment is saved. Your next run shows the score delta, which specific findings were resolved, and which are newly flagged - the closest thing this tool has to watching an organization actually improve, run over run, rather than guessing at where it stands.</p>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('history')}" id="ctaMetricsHistory">View assessment history →</a>
          <a class="cta-btn secondary" href="${pathForTab('assessment')}" id="ctaMetricsAssess">Start an assessment →</a>
        </div>
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('ctaMetricsHistory'), 'history');
  wireNavLink(document.getElementById('ctaMetricsAssess'), 'assessment');
  wireNavLink(document.getElementById('linkMethodFromMetrics1'), 'methodology');
  wireNavLink(document.getElementById('linkMaturityFromMetrics'), 'maturity');
}

// SITE_LAST_UPDATED comes from esbuild's define (see scripts/build.js) -
// a real build timestamp instead of a hand-typed date someone has to
// remember to update. Don't reintroduce a literal date string here; that's
// exactly the failure mode ROADMAP-FIX-BRIEF.md flagged.
const SITE_LAST_UPDATED = __BUILD_TIME__;

// This page has three required sections - Shipped, In Progress, Planned -
// each with its own array below and its own render block in
// renderRoadmapTab(). A prior edit (b217a47) removed two of the three
// sections while only meaning to clear a stale In Progress entry, and the
// page silently ran with one section for days before anyone caught it (see
// ROADMAP-FIX-BRIEF.md). Before committing any change to ONE of these
// arrays, confirm the other two still exist and still render.
const ROADMAP_SHIPPED = [
  { module:'Adaptive Assessment Engine', desc:'Rebuilt on a data-driven decision graph - sequenced team-structure questions, containerization/virtualization as its own independent branch, per-framework question injection across all eight supported frameworks, and a session-wide de-dup engine so no branch ever asks the same thing twice.' },
  { module:'AI-Enhanced Insights', desc:'A live, opt-in second pass on your completed results: checks your named vendors/products against CISA\'s KEV catalog and NVD\'s CVE database for anything current a fixed rule set can\'t know by nature, plus a look for patterns this specific answer combination raises beyond it. Clearly labeled as AI-generated - the deterministic report above it is already complete either way.' },
  { module:'MITRE ATT&CK Guidance Panel', desc:'A "why this matters, and what to do now" expander under each compounding-risk flag and low-scoring priority item, mapping to a real MITRE ATT&CK technique plus a compensating control computed from your own answers.' },
  { module:'Compounding-Risk Detection', desc:'Cross-answer flagging for dangerous combinations, not just per-question scoring.' },
  { module:'Vendor-Aware Mitigation Notes', desc:'Illustrative guidance for named products, entered via dropdown + "Other" across every vendor field in the questionnaire.' },
  { module:'PDF Report Export', desc:'A real, programmatically-built PDF of your results - selectable/searchable text, not a screenshot.' },
  { module:'Runbooks & Playbooks', desc:'8 incident runbooks plus 16 OWASP/AI-mapped attack-type playbooks, each with MITRE ATT&CK/ATLAS references and equal-depth, actionable steps.' },
  { module:'Case Studies', desc:'8 real watershed cybersecurity incidents, each tied back to a specific gap this tool is built to catch.' },
  { module:'Glossary & References', desc:'A 59-term glossary and a sourced references page.' },
  { module:'Starter Guide', desc:'A narrative, in-order on-ramp for starting cybersecurity from zero - distinct from the Glossary\'s alphabetical lookup.' },
  { module:'Threat Modeling & Forensics', desc:'Real named methodologies (STRIDE, PASTA, attack trees, DREAD) for reasoning through an attack before it happens, plus practical forensics basics - order of volatility, evidence preservation, when to call in outside help - for reconstructing what happened after one does.' },
  { module:'Live Trends & News', desc:'Daily-refreshed threat-landscape feed pulled from CISA\'s KEV catalog, NVD, and security RSS feeds, updated automatically - not a static snapshot.' },
  { module:'Exploits Page', desc:'Confirmed actively-exploited CVEs from CISA KEV, VulnCheck KEV, and ENISA\'s EU Vulnerability Database, scored by real-world exploitation likelihood via FIRST.org\'s EPSS, refreshed daily.' },
  { module:'Header, Navigation & Site Search', desc:'Live site search across every page, a mobile hamburger menu, and a real toggle-style theme switch.' },
  { module:'Real Client-Side Routing', desc:'Every page has a real, shareable URL - back/forward, bookmarking, and opening links in a new tab all work as expected.' },
  { module:'Custom Visual System & Animations', desc:'Original SVG illustrations across the site, a Maturity Model comparison table, framework stamps, and custom CSS animations on the Maturity Model and Exploits pages.' },
  { module:'Hosting & Domain', desc:'Live at simplifiedcs.net via Netlify, auto-deployed from GitHub on every update.' },
];

const ROADMAP_IN_PROGRESS = [
  { module:'Save & Resume (same browser)', desc:'In-progress answers are saved to your browser\'s own local storage as you go - close the tab, close the browser, even restart the device, and resuming picks up where you left off, as long as it\'s the same browser on the same device. This is what\'s actively being built and hardened right now.' },
  { module:'Feedback Form', desc:'The submission mechanism is built and wired to Netlify Forms, but Netlify Forms is not currently enabled for this site at the account level - confirmed directly, not assumed - so a real submission likely isn\'t being captured yet. Worth enabling and testing with a real submission before calling this shipped.' },
];

const ROADMAP_PLANNED = [
  { module:'Persistent History & Score Tracking', desc:'Replacing today\'s session-only History with real, persistent storage, so completed assessment results are still there - and comparable over time - the next time you visit.' },
  { module:'Cross-Device Resume', desc:'A securely-generated link to pick up an in-progress assessment from any device, complementing the current same-device browser save above - a future, more advanced capability layered on top of it, not a replacement for it.' },
  { module:'Chatbot Assistant', desc:'A conversational assistant to help visitors navigate the site, answer cybersecurity basics questions, and potentially help fill out the assessment conversationally.' },
  { module:'Blog', desc:'Longer-form original writing - the reasoning behind specific tool and framework choices, and lessons drawn from real incidents - separate from the existing Trends & News feed, which curates external sources rather than publishing original posts.' },
  { module:'Learning', desc:'A structured, sequenced path for building cybersecurity knowledge over time, distinct from the Starter Guide (a one-time on-ramp) and the Glossary (lookup as needed, not a course).' },
  { module:'Personal Projects', desc:'A page highlighting other work outside SimplifiedCS itself, for visitors arriving through a portfolio context rather than looking for the assessment tool specifically.' },
];

// --- Roadmap intro: three-stage pipeline flow (ROADMAP-FIX-BRIEF.md) - a
// small indicator traveling shipped -> in progress -> planned, colored
// through the exact same green/amber/gray already used for this page's own
// roadmap-log-shipped/progress/planned card accents. Sits in .page-intro-row
// next to the page title, same slot buildMaturityClimbSvg/
// buildExploitsRadarSvg use on their own pages.
function buildRoadmapPipelineSvg(){
  return `
  <svg viewBox="0 0 260 90" xmlns="http://www.w3.org/2000/svg">
    <line x1="30" y1="45" x2="230" y2="45" stroke="var(--line)" stroke-width="1.5"/>
    <circle cx="30" cy="45" r="9" fill="var(--accent-secure)"/>
    <circle cx="130" cy="45" r="9" fill="var(--accent-amber)"/>
    <circle cx="230" cy="45" r="9" fill="var(--text-muted)"/>
    <circle class="pipeline-flow-dot" cx="30" cy="45" r="4.5" fill="var(--accent-signal)"/>
  </svg>`;
}

function renderRoadmapTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <div class="page-eyebrow">Site Status</div>
            <h2 class="page-title">Roadmap</h2>
            <p class="page-lede">Not the assessment methodology - this page tracks the status of the website itself: what's shipped and working, what's actively being built, and what's planned next. Last updated <b>${SITE_LAST_UPDATED}</b>.</p>
          </div>
          <div class="roadmap-pipeline-wrap">${buildRoadmapPipelineSvg()}</div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Shipped &amp; accessible now</h3>
        <p class="body-text">Fully functional in the live version of this site today.</p>
        <div class="roadmap-log-grid">
          ${ROADMAP_SHIPPED.map(m=>`
            <div class="roadmap-log-card roadmap-log-shipped">
              <h4>${m.module}</h4>
              <p>${m.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Work in progress</h3>
        <p class="body-text">Being actively built right now.</p>
        ${ROADMAP_IN_PROGRESS.length ? `
        <div class="roadmap-log-grid">
          ${ROADMAP_IN_PROGRESS.map(m=>`
            <div class="roadmap-log-card roadmap-log-progress">
              <div class="roadmap-log-date">In progress</div>
              <h4>${m.module}</h4>
              <p>${m.desc}</p>
            </div>
          `).join('')}
        </div>` : `
        <p class="body-text">Nothing actively in progress right now.</p>`}
      </div>

      <div class="section-tile">
        <h3 class="section-h">Planned / ideation</h3>
        <p class="body-text">Not yet started - scoped and intended, not yet onboarded.</p>
        <div class="roadmap-log-grid">
          ${ROADMAP_PLANNED.map(m=>`
            <div class="roadmap-log-card roadmap-log-planned">
              <div class="roadmap-log-date">Planned</div>
              <h4>${m.module}</h4>
              <p>${m.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function wireAccordions(container){
  container.querySelectorAll('.acc-head').forEach(head=>{
    head.addEventListener('click', ()=>{
      head.parentElement.classList.toggle('open');
    });
  });
}

// Scoped to the Runbooks and Playbooks pages specifically (per VISUAL-
// UPDATE-BRIEF.md items 8-9) via a --icon-accent custom property set
// inline per item, consumed by a var(--icon-accent, <original-default>)
// fallback added to the shared .icon-badge rule (see app.css) - .icon-badge
// itself stays the muted default everywhere else on the site (Home's site
// tiles, start-links, etc.) since nothing there ever sets the property.
// Deliberately not a literal inline color/border-color: that would win
// over the existing :hover rule's color change (inline specificity beats a
// class selector), which could make an icon the same color as its own
// hover background and disappear.
const ICON_ACCENT_CYCLE = ['--accent-signal','--accent-secure','--accent-violet','--accent-amber','--accent-critical','--accent-pop'];
function accentIconStyle(i){
  const v = ICON_ACCENT_CYCLE[i % ICON_ACCENT_CYCLE.length];
  return `style="--icon-accent:var(${v});"`;
}

function renderRunbookTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Documentation & Runbooks</div>
        <h2 class="page-title">Runbooks your team can actually use</h2>
        <p class="page-lede">Guidance on the documents every program needs, and step-by-step runbooks for the incidents most likely to happen - ransomware, phishing, DDoS, and lateral movement.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Keeping documents alive, not just written</h3>
        <div class="lifecycle-row">
          <div class="lifecycle-text">
            <p class="body-text">A policy that's never reviewed is a policy that's already wrong. Every foundational document below should move through the same cycle continuously:</p>
            <p class="body-text">A document that was accurate the day it was written starts drifting the moment anything around it changes. An incident response plan naming a specific person as the point of contact is already wrong the day that person leaves the company; a backup runbook referencing a tool the organization decommissioned two years ago sends whoever's following it during an actual incident down a dead end - exactly when there's no time left to improvise.</p>
            <p class="body-text"><b>Periodic review means a real cadence on a real calendar, with a real owner.</b> Most organizations review foundational documents at least annually, and more often - quarterly, or after any significant infrastructure or staffing change - for anything genuinely operational, like an incident response plan or a backup/DR runbook. Ownership matters as much as cadence: a document with no named owner tends to drift indefinitely until an actual incident exposes how stale it's gotten. Assign a specific role, not just "the team," responsible for confirming it's still accurate on schedule, whether or not anything obviously changed in the meantime.</p>
          </div>
          <div class="lifecycle-wrap lifecycle-wrap--tall">${buildLifecycleSvg()}</div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Foundational Documents</h3>
        <div id="docAccordions"></div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Incident Runbooks</h3>
        <p class="body-text">Each of these is meant to be printable and usable mid-incident - short, ordered, and specific enough that whoever's on call at 2am isn't improvising.</p>
        <div id="runbookAccordions"></div>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaDocsAssess">See where you stand first →</a>
        </div>
      </div>
    </div>
  `;

  const docContainer = document.getElementById('docAccordions');
  docContainer.innerHTML = FOUNDATIONAL_DOCS.map((d,i)=>`
    <div class="acc-card" data-id="${d.id}">
      <div class="acc-head">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon(d.icon)}</div>
        <div><h4>${d.title}</h4></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body"><ul>${d.points.map(pt=>`<li>${pt}</li>`).join('')}</ul></div>
    </div>
  `).join('');

  const runbookContainer = document.getElementById('runbookAccordions');
  runbookContainer.innerHTML = RUNBOOKS.map((r,i)=>`
    <div class="acc-card" data-id="${r.id}">
      <div class="acc-head">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon(r.icon)}</div>
        <div><h4>${r.title}</h4><div class="acc-sub">${r.sub}</div></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body"><ol>${r.steps.map(s=>`<li>${s}</li>`).join('')}</ol></div>
    </div>
  `).join('');

  wireAccordions(docContainer);
  wireAccordions(runbookContainer);
  wireNavLink(document.getElementById('ctaDocsAssess'), 'assessment');
}


// CONSOLIDATED-WORK-BRIEF.md §6: complete content rewrite - the previous
// version predated nearly everything built this session (no mention of
// AI enrichment, RAG, PDF export, Exploits, Trends & News, Runbooks/
// Playbooks, Case Studies, or the assessment modes). Content below is
// the brief's own finished text; this only builds the page and wires in
// every link, it doesn't rewrite the substance. Deliberately does NOT
// re-explain Maturity Model or Exploits in any depth - links out to them
// instead, the same way this page already correctly links out rather
// than duplicating other pages' content. Keeps the page's existing
// single-scroll TOC layout (not the Starter Guide's accordion pattern) -
// this page's job is a quick, complete overview in a couple of minutes,
// not deep reading. Every internal link uses a shared .ws-link class +
// data-tab, wired in one wireNavLinksByDataset() pass at the bottom
// rather than one wireNavLink() call per link - the previous version's
// per-link wiring doesn't scale to how many real links this rewrite
// needs (13, once every mentioned page is a working link, per the
// brief's own build note).
function renderMaturityModelTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">What is SimplifiedCS?</h2>
        <p class="page-lede">This isn't a checklist that asks the same twenty questions to every visitor and calls it an assessment. It's an adaptive engine that changes based on your industry, your infrastructure, your region, and your own answers as you give them - cross-references what you tell it for risk combinations a static form would never catch - and hands back a report with real teeth: specific findings, mapped to specific frameworks, tied to real attacker behavior, with an optional AI layer checking your exact vendors against what's actually being exploited right now. Here's everything it actually does.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Contents</h3>
        <ul class="toc-list">
          <li><a href="#ws-what">What this tool actually does</a></li>
          <li><a href="#ws-how">How an assessment works, start to finish</a></li>
          <li><a href="#ws-reasoning">What makes the reasoning genuinely good, not just automated</a></li>
          <li><a href="#ws-frameworks">Every framework and standard it's built on</a></li>
          <li><a href="#ws-rest">The rest of the site</a></li>
        </ul>
      </div>

      <div class="section-tile">
        <h3 class="section-h" id="ws-what">What this tool actually does</h3>
        <p class="body-text">SimplifiedCS is an adaptive cybersecurity self-assessment platform - pick your industry, answer questions that change based on what you've already said, and get back a scored, prioritized report on where your organization actually stands. It's built for small and medium businesses that need a real read on their security posture without hiring a consultant to get one.</p>

        <h3 class="section-h" id="ws-how">How an assessment works</h3>
        <p class="body-text">Three ways in, depending on what you need: a <b>~2-minute Quick assessment</b> covering the core NIST CSF scoring, a <b>~5-minute Full assessment</b> adding vendor-specific guidance for your exact products, or an <b>instant Sample Report</b> if you just want to see the depth before committing any time at all - start there.</p>
        <p class="body-text">Whichever you choose, your in-progress answers save automatically to your browser as you go, so closing the tab doesn't cost you anything. Once it's complete, export the whole thing as a real, selectable-text PDF - not a screenshot.</p>

        <h3 class="section-h" id="ws-reasoning">What makes the reasoning genuinely good</h3>
        <p class="body-text">This is the part that separates SimplifiedCS from a generic checklist, and it's worth being specific about:</p>
        <ul>
          <li><b>Compounding-risk detection</b> - answers get cross-referenced against each other, not scored in isolation. Two individually-minor gaps that combine into something genuinely dangerous get flagged as exactly that.</li>
          <li><b>Real MITRE ATT&amp;CK mapping</b> - every significant finding names the actual attack technique it enables, not a generic warning.</li>
          <li><b>A hybrid AI architecture, done deliberately</b> - the core scoring and findings are produced by a tested, deterministic rules engine, so they're guaranteed consistent every time. On top of that, an optional <b>retrieval-augmented (RAG)</b> enrichment layer checks your specifically named vendors and products against live CISA and NVD threat intelligence - catching what a fixed rule set can't know by nature, clearly labeled wherever it appears, never replacing the deterministic core underneath it.</li>
          <li><b>Vendor-aware, not generic</b> - mitigation guidance is tailored to the actual products you named, not one-size-fits-all advice.</li>
        </ul>

        <h3 class="section-h" id="ws-frameworks">Every framework and standard it's built on</h3>
        <p class="body-text">The fixed baseline is NIST CSF 2.0 (all six functions) and CIS Controls v8, applied to everyone. Layered in based on your industry and region: ISO 27001, NIS2, SOC 2, HIPAA, GDPR, SOX, Cyber Essentials, and PCI DSS - with more frameworks planned as the tool grows. Dedicated tracks exist for Operational Technology/ICS and DevSecOps/cloud-native environments, shown only when actually relevant. See <a href="${pathForTab('methodology')}" class="inline-link ws-link" data-tab="methodology">Methodology</a> for exactly how scoring works, and <a href="${pathForTab('metrics')}" class="inline-link ws-link" data-tab="metrics">Metrics</a> for what every number on your results page actually means.</p>

        <h3 class="section-h" id="ws-rest">The rest of the site</h3>
        <p class="body-text">Everything else here, in one place:</p>
        <ul>
          <li><b><a href="${pathForTab('maturity')}" class="inline-link ws-link" data-tab="maturity">Maturity Model</a></b> - the ten-phase path a security program actually follows, and where a given score falls on it.</li>
          <li><b><a href="${pathForTab('exploits')}" class="inline-link ws-link" data-tab="exploits">Exploits</a></b> - actively-exploited vulnerabilities from CISA KEV, VulnCheck, and ENISA, scored by real-world exploitation likelihood.</li>
          <li><b><a href="${pathForTab('news')}" class="inline-link ws-link" data-tab="news">Trends &amp; News</a></b> - a daily-refreshed threat-landscape feed, not a static snapshot.</li>
          <li><b><a href="${pathForTab('runbook')}" class="inline-link ws-link" data-tab="runbook">Runbooks</a></b> and <b><a href="${pathForTab('playbooks')}" class="inline-link ws-link" data-tab="playbooks">Playbooks</a></b> - step-by-step incident response guidance and attack-pattern-specific response plans, mapped to MITRE ATT&amp;CK/ATLAS.</li>
          <li><b><a href="${pathForTab('casestudy')}" class="inline-link ws-link" data-tab="casestudy">Case Studies</a></b> - real incidents, each tied back to the specific gap this tool is built to catch.</li>
          <li><b><a href="${pathForTab('coreprinciples')}" class="inline-link ws-link" data-tab="coreprinciples">Core Principles</a></b> - the philosophy behind how every recommendation gets prioritized and explained.</li>
          <li><b><a href="${pathForTab('starterguide')}" class="inline-link ws-link" data-tab="starterguide">Starter Guide</a></b> - brand new to cybersecurity? Start here, not with the assessment.</li>
          <li><b><a href="${pathForTab('threatmodeling')}" class="inline-link ws-link" data-tab="threatmodeling">Threat Modeling &amp; Forensics</a></b> - how to think ahead of an attacker, and how to reconstruct what happened after one.</li>
          <li><b><a href="${pathForTab('glossary')}" class="inline-link ws-link" data-tab="glossary">Glossary</a></b> and <b><a href="${pathForTab('references')}" class="inline-link ws-link" data-tab="references">References</a></b> - term lookups and sourcing, whenever needed.</li>
        </ul>
        <p class="body-text">Take a look around. Most of what's here started as a real gap someone found in a real assessment - it keeps growing for exactly that reason.</p>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaMMAssess">Start an assessment →</a>
        </div>
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('ctaMMAssess'), 'assessment');
  wireNavLinksByDataset(container, '.ws-link');
}

// STARTER-GUIDE-BRIEF.md: a narrative, in-order on-ramp for someone starting
// from zero - deliberately not the Glossary (alphabetical lookup). Content
// is finished/research-grounded per the brief; this only builds the page
// and cross-links it doesn't rewrite the substance. Sections 1-8 render as
// collapsible accordions (matching Runbooks/Playbooks' .acc-card pattern,
// all-collapsed by default - the established default elsewhere on the
// site); section 9 (Further Reading) is deliberately NOT an accordion,
// styled instead as always-visible .start-link cards like Home's "Things
// to get you started", per the brief's own "End of page" framing.
const STARTER_GUIDE_SECTIONS = [
  { id:'sg-audience', icon:'route', title:'Who this page is for', body:`
    <p class="body-text">New to cybersecurity? Just took on IT for a company that never had a dedicated setup before? This page is the on-ramp - the foundational concepts worth understanding before you touch the actual assessment, written in plain language, in an order that actually makes sense to read top to bottom. If you already know this material, the <a href="${pathForTab('assessment')}" class="inline-link sg-crosslink" data-tab="assessment">assessment</a> itself and the <a href="${pathForTab('glossary')}" class="inline-link sg-crosslink" data-tab="glossary">Glossary</a> will serve you better than this page will.</p>
  `},
  { id:'sg-identity', icon:'key', title:'Identity & Access', body:`
    <p class="body-text">Access control decides who can do what - and it's the foundation everything else sits on, because a strong password policy doesn't matter if the wrong person already has admin rights they never needed.</p>
    <p class="body-text"><b>The principle of least privilege</b> means giving people access to exactly what their role requires, nothing more. An access control list (ACL) is the practical mechanism for this - a defined set of permissions attached to a system, file, or resource, specifying exactly who can read, write, or execute it. See the <a href="${pathForTab('glossary', 'gl-L')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-L">Glossary</a> for more on least privilege specifically.</p>
    <p class="body-text"><b>Password policy</b> is more than "make it long." A genuinely useful policy covers minimum length (current guidance favors length over complex character requirements), discouraging reuse across systems, and - critically - requiring multi-factor authentication (<a href="${pathForTab('glossary', 'gl-M')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-M">MFA</a>) wherever it's available, since a strong password alone is no longer considered sufficient on its own.</p>
    <p class="body-text"><b>Passkeys</b> are a newer, stronger alternative to passwords entirely. Instead of a shared secret you type in (which can be phished, guessed, or leaked in a breach), a passkey uses public-key cryptography tied to your device - you approve a login with your fingerprint, face, or device PIN, and there's no password for an attacker to steal in the first place. They're built on the FIDO Alliance's open standard and are increasingly supported across major platforms (Microsoft, Google, Apple accounts all support them today).</p>
    <p class="body-text"><b>Identity management</b> is how an organization handles all of this at scale - who has an account, what they can access, and how that access changes as people join, move roles, or leave. Larger organizations typically centralize this through an identity provider (IdP) with single sign-on (SSO), so access can be granted or revoked from one place rather than chasing down permissions system by system.</p>
  `},
  { id:'sg-devices', icon:'device', title:'Devices & Data', body:`
    <p class="body-text"><b>Device management</b> covers every laptop, phone, and workstation that touches company data. The key question: is a device company-owned and centrally managed, or is it an employee's personal device being used for work (BYOD - "bring your own device")? Company-owned devices are far easier to secure consistently; BYOD introduces real tradeoffs between employee flexibility and the organization's ability to enforce security settings. Mobile Device Management (MDM) tools exist specifically to apply consistent security policy - screen locks, encryption, remote wipe - across a fleet of devices regardless of who owns them.</p>
    <p class="body-text"><b>Data classification</b> means knowing what kind of data you actually have before you can protect it properly. Not all data carries the same risk - personally identifiable information (PII), financial records, and health data typically demand stronger protection than, say, public marketing material. Classifying data (even informally, as "sensitive" vs. "general") is what makes the rest of your security decisions possible to prioritize correctly.</p>
    <p class="body-text"><b>Encryption</b> protects data in two different states, and both matter: encryption <i>at rest</i> protects data sitting on a disk or in a database; encryption <i>in transit</i> protects data as it moves across a network. A system can have one without the other, and both gaps are real.</p>
  `},
  { id:'sg-infrastructure', icon:'cloud', title:'Infrastructure & Services', body:`
    <p class="body-text">Where does your organization's technology actually live? <b>Cloud vs. on-premises</b> is the first fork - and most organizations today run a mix of both, not a clean either/or.</p>
    <p class="body-text">Within cloud services, it helps to know the three common models: <b>SaaS</b> (Software as a Service - you use a finished application, like email or CRM, and the provider manages everything underneath it), <b>PaaS</b> (Platform as a Service - you deploy your own code onto infrastructure the provider manages), and <b>IaaS</b> (Infrastructure as a Service - you manage the operating system and everything above it, on infrastructure the provider hosts). Each model shifts a different amount of security responsibility onto you versus the provider - worth knowing which model you're actually using for a given system.</p>
    <p class="body-text"><b>Basic network concepts</b> worth understanding early: a firewall controls what traffic is allowed in or out of a network based on rules; a VPN (virtual private network) creates an encrypted tunnel for remote access; network <a href="${pathForTab('glossary', 'gl-S')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-S">segmentation</a> means dividing a network into smaller, isolated zones so that a compromise in one area doesn't automatically grant access to everything else.</p>
  `},
  { id:'sg-protecting', icon:'backup', title:'Protecting What You Have', body:`
    <p class="body-text"><b>Backups</b> are the single most consistently under-tested control in most organizations. The well-established guideline is the <b>3-2-1 rule</b>: keep at least 3 copies of your data, on 2 different types of storage media, with at least 1 copy stored offsite. Critically - a backup that has never been tested for restoration isn't a real backup, it's an assumption. Ransomware specifically targets backups when it can reach them, which is exactly why the offsite/isolated copy matters most.</p>
    <p class="body-text"><b>Patching</b> means applying vendor-released updates that fix known vulnerabilities. The gap between a patch being released and it actually being applied is exactly the window attackers look for - this is why frameworks like NIST CSF and tools like CISA's <a href="${pathForTab('exploits')}" class="inline-link sg-crosslink" data-tab="exploits">Known Exploited Vulnerabilities catalog</a> exist to help prioritize which patches matter most urgently, not just track that patches exist.</p>
    <p class="body-text"><b>Endpoint protection</b> (antivirus, and its more capable modern successor, <a href="${pathForTab('glossary', 'gl-E')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-E">EDR</a> - endpoint detection and response) is the layer watching individual devices for malicious activity, not just blocking known-bad files but detecting suspicious behavior in real time.</p>
  `},
  { id:'sg-people', icon:'people', title:'People Matter Too', body:`
    <p class="body-text">Technology alone doesn't secure an organization - the people using it are part of the system, for better or worse.</p>
    <p class="body-text"><b>Security awareness training</b> teaches staff to recognize real threats (<a href="${pathForTab('glossary', 'gl-P')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-P">phishing</a> emails, social engineering attempts, unsafe practices) - but training without reinforcement fades. That's why <b>phishing simulation</b> exists: periodically sending realistic, safe test phishing emails to see who clicks, then using that as a coaching opportunity rather than a punishment.</p>
    <p class="body-text"><b>Incident response</b>, at a foundational level, just means having a plan <i>before</i> something goes wrong - who gets notified, who has authority to make decisions, and what the first steps are. This page won't go deep here; the site's <a href="${pathForTab('runbook')}" class="inline-link sg-crosslink" data-tab="runbook">Runbooks</a> are built specifically for that level of detail once you need it.</p>
  `},
  { id:'sg-tools', icon:'checklist', title:'Tools That Help', body:`
    <p class="body-text">None of the above requires expensive tooling to start doing well, but the right category of tool makes consistency much easier at any real scale. Presented here at a category level, not as endorsements of specific products:</p>
    <ul>
      <li><b>Password managers</b> - generate and store strong, unique passwords per site/system, removing the human tendency to reuse passwords across services.</li>
      <li><b>MDM platforms</b> - apply and enforce device security policy across a fleet, rather than trusting each device to be configured correctly by hand.</li>
      <li><b>Identity/IAM platforms</b> - centralize who has access to what, with single sign-on and centralized deprovisioning when someone leaves.</li>
      <li><b>Backup solutions</b> - automate the 3-2-1 pattern rather than relying on someone remembering to do it manually.</li>
    </ul>
  `},
  { id:'sg-nextsteps', icon:'link', title:'Where to go from here', links:[
    { title:'Take the assessment', desc:'See where your organization actually stands against these fundamentals, scored and prioritized.', tab:'assessment', icon:'checklist' },
    { title:'Glossary', desc:'Look up any term from this page (or anywhere else on the site) in plain language.', tab:'glossary', icon:'register' },
    { title:'Core Principles', desc:'The philosophy behind why this site\'s recommendations are structured the way they are.', tab:'coreprinciples', icon:'hiw-lightbulb' },
    { title:'Methodology', desc:'How scoring actually works, and which frameworks ground every question.', tab:'methodology', icon:'route' },
    { title:'Runbooks', desc:'Step-by-step incident response guidance, once you need more depth than this page covers.', tab:'runbook', icon:'document' },
  ]},
];

// Verified against each source directly (not guessed) per the brief's own
// implementation note - see STARTER-GUIDE-BRIEF.md §9.
const STARTER_GUIDE_FURTHER_READING = [
  { title:'Microsoft Learn - Microsoft 365 security best practices', desc:'Practical, vendor-maintained guidance for organizations on Microsoft\'s ecosystem specifically.', href:'https://learn.microsoft.com/en-us/microsoft-365/admin/security-and-compliance/m365b-security-best-practices?view=o365-worldwide' },
  { title:'CISA - Cyber Guidance for Small Businesses', desc:'The U.S. government\'s own small-business-focused starting point, including the Cyber Essentials starter kit.', href:'https://www.cisa.gov/cyber-guidance-small-businesses' },
  { title:'NIST - Small Business Cybersecurity Corner', desc:'Genuinely well-matched, since this site\'s own assessment is built on NIST CSF already - includes the CSF 2.0 Small Business Quick-Start Guide.', href:'https://www.nist.gov/itl/smallbusinesscyber' },
  { title:'FIDO Alliance - Passkeys', desc:'The actual industry standards body for passkeys, the right source for that concept specifically.', href:'https://fidoalliance.org/passkeys/' },
];

function renderStarterGuideTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">On-Ramp</div>
        <h2 class="page-title">Starter Guide</h2>
        <p class="page-lede">A guided, in-order read for anyone starting from zero - new to cybersecurity, or standing up IT/security for a new company for the first time. Explains why each thing matters and how the pieces connect, before you touch the actual assessment.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Contents</h3>
        <ul class="toc-list">
          ${STARTER_GUIDE_SECTIONS.map(s=>`<li><a href="#${s.id}" class="sg-toc-link" data-target="${s.id}">${s.title}</a></li>`).join('')}
          <li><a href="#sg-further-reading">Further reading</a></li>
        </ul>
      </div>

      <div class="section-tile">
        <div id="sgAccordions"></div>
      </div>

      <div class="section-tile" id="sg-further-reading">
        <h3 class="section-h">Further reading</h3>
        <p class="body-text">Real, current sources beyond this site's own content - each verified directly before being listed here.</p>
        <div class="start-links">
          ${STARTER_GUIDE_FURTHER_READING.map(r=>`
            <a class="start-link" href="${r.href}" target="_blank" rel="noopener noreferrer">
              <div class="icon-badge">${icon('external')}</div>
              <div><h4>${r.title}</h4><p>${r.desc}</p></div>
              <span class="ext-mark">↗</span>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const accContainer = document.getElementById('sgAccordions');
  accContainer.innerHTML = STARTER_GUIDE_SECTIONS.map((s,i)=>`
    <div class="acc-card" data-id="${s.id}">
      <div class="acc-head" id="${s.id}">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon(s.icon)}</div>
        <div><h4>${s.title}</h4></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body">
        ${s.links ? `
          <div class="start-links">
            ${s.links.map(l=>`
              <a class="start-link" href="${pathForTab(l.tab)}" data-tab="${l.tab}">
                <div class="icon-badge">${icon(l.icon)}</div>
                <div><h4>${l.title}</h4><p>${l.desc}</p></div>
              </a>
            `).join('')}
          </div>
        ` : s.body}
      </div>
    </div>
  `).join('');
  wireAccordions(accContainer);

  wireNavLinksByDataset(accContainer, '.start-link[data-tab]');
  wireNavLinksByDataset(accContainer, '.sg-crosslink');

  // Jumping to a specific section from the TOC while every accordion
  // starts collapsed would land on an empty header - open the target
  // accordion (if it isn't already) before letting the native #anchor
  // scroll happen.
  container.querySelectorAll('.sg-toc-link').forEach(link=>{
    link.addEventListener('click', (e)=>{
      const card = document.querySelector(`.acc-card[data-id="${link.dataset.target}"]`);
      if(card && !card.classList.contains('open')){
        e.preventDefault();
        card.classList.add('open');
        requestAnimationFrame(()=> card.scrollIntoView({ behavior:'smooth', block:'start' }));
      }
    });
  });
}

// CONSOLIDATED-WORK-BRIEF.md §5: a split visual for the Threat Modeling &
// Forensics intro - left half a small branching attack tree (threat
// modeling: reasoning through how an attacker could get in, before they
// do), right half a magnifying glass resolving scattered points into a
// timeline (forensics: reconstructing what happened, after the fact).
// Same site color language as every other page-intro animation - red for
// the attacker's-eye-view tree, teal/green for forensic resolution/
// clarity - not a new palette. Sits in .page-intro-row same as the other
// four intro animations.
function buildThreatModelForensicsSvg(){
  const leaves = [
    { x:34, y:78, delay:'0s' },
    { x:80, y:78, delay:'0.7s' },
    { x:104, y:50, delay:'1.4s' },
  ];
  return `
  <svg viewBox="0 0 260 100" xmlns="http://www.w3.org/2000/svg">
    <!-- threat modeling: a branching attack tree -->
    <g stroke="var(--accent-critical)" stroke-width="1.6" fill="none" opacity="0.8">
      <path d="M58,22 L34,78"/>
      <path d="M58,22 L80,78"/>
      <path d="M80,78 L104,50"/>
    </g>
    <circle cx="58" cy="22" r="6" fill="var(--accent-critical)"/>
    ${leaves.map(l=>`<circle class="tmf-leaf" cx="${l.x}" cy="${l.y}" r="5" fill="var(--accent-critical)" style="animation-delay:${l.delay}"/>`).join('')}
    <line x1="130" y1="12" x2="130" y2="88" stroke="var(--line)" stroke-width="1"/>
    <!-- forensics: scattered points resolving into a timeline through the lens -->
    <g class="tmf-scatter" fill="var(--accent-secure)">
      <circle cx="162" cy="30" r="3"/>
      <circle cx="178" cy="62" r="2.6"/>
      <circle cx="150" cy="58" r="2.6"/>
    </g>
    <line x1="146" y1="82" x2="216" y2="82" stroke="var(--accent-secure)" stroke-width="1.4" stroke-dasharray="2.5 3" opacity="0.6"/>
    <circle cx="163" cy="82" r="2.4" fill="var(--accent-secure)"/>
    <circle cx="181" cy="82" r="2.4" fill="var(--accent-secure)"/>
    <circle cx="199" cy="82" r="2.4" fill="var(--accent-secure)"/>
    <circle cx="188" cy="48" r="20" fill="none" stroke="var(--accent-signal)" stroke-width="4"/>
    <line x1="202" y1="62" x2="216" y2="76" stroke="var(--accent-signal)" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
}

const THREAT_MODELING_SECTIONS = [
  { id:'tm-what-is', icon:'route', title:'What threat modeling actually is', body:`
    <p class="body-text">Threat modeling is a structured way of asking "how could someone actually attack this?" before they do, so the answer can inform what gets built or fixed. A basic threat model identifies what you're protecting (the asset), who might attack it and why (the threat actor and motivation), how they could realistically do it (the attack vector), and what happens if they succeed (the impact).</p>
    <p class="body-text">This is the same reasoning this site's own assessment applies to compounding-risk findings - not just "is MFA enabled," but "what happens to an attacker's plan if it isn't."</p>
  `},
  { id:'tm-why-deliberate', icon:'checklist', title:"Why it's worth doing deliberately", body:`
    <p class="body-text">Every organization does some threat modeling whether they call it that or not - deciding where to put a firewall is an implicit threat model. Doing it deliberately catches what informal intuition misses: the compounding combination of two individually-minor gaps, the assumption nobody questioned because it was never written down, the attack path that only becomes obvious once it's drawn out.</p>
  `},
  { id:'tm-methodologies', icon:'cycle', title:'How organizations actually do it', body:`
    <p class="body-text">Real, named methodologies - none require a dedicated team to start using, even a small organization can walk through STRIDE's six categories against its most important system in an afternoon:</p>
    <ul>
      <li><b>STRIDE</b> (Microsoft's framework) - Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege - a checklist-style lens for walking through a system component by component.</li>
      <li><b>PASTA</b> (Process for Attack Simulation and Threat Analysis) - a risk-centric, multi-stage methodology tying technical threats back to actual business impact.</li>
      <li><b>Attack trees</b> - a visual technique: a goal at the root ("compromise the customer database"), with branches showing every way an attacker could reach it.</li>
      <li><b>DREAD</b> - often paired with STRIDE for scoring: Damage, Reproducibility, Exploitability, Affected users, Discoverability.</li>
    </ul>
  `},
  { id:'tm-what-is-forensics', icon:'device', title:'What digital forensics actually is', body:`
    <p class="body-text">The disciplined process of investigating a security incident after the fact - figuring out what happened, how the attacker got in, what they touched, and when - in a way that holds up to scrutiny, not just a guess based on what looks unusual. "Disciplined" matters: forensics isn't just looking around a compromised system, it's preserving evidence carefully enough that conclusions drawn from it are actually reliable.</p>
  `},
  { id:'tm-why-forensics', icon:'urgent', title:'Why forensics matters, even for a small organization', body:`
    <p class="body-text">Without it, an incident becomes "something bad happened, we cleaned it up, we're not entirely sure how." Forensics turns "we think we fixed it" into "we know what happened and we know it's closed."</p>
  `},
  { id:'tm-forensics-basics', icon:'key', title:'Forensics basics for a general IT administrator', body:`
    <p class="body-text">You don't need to be a specialist to get the fundamentals right:</p>
    <ul>
      <li><b>The order of volatility matters</b> - capture the most fragile evidence first (what's in memory, active network connections) before more durable evidence (files on disk).</li>
      <li><b>Don't investigate directly on the live, compromised system if avoidable</b> - isolate it from the network (rather than powering it off immediately, which destroys memory-resident evidence) and work from a copy where possible.</li>
      <li><b>Preserve logs immediately</b> - don't let routine log rotation quietly delete the most useful record of what happened.</li>
      <li><b>Keep a simple, timestamped record of what was observed and when</b> - a lightweight version of "chain of custody."</li>
      <li><b>Know when to call in outside help, and don't be afraid to.</b> A genuinely serious incident (ransomware, confirmed sensitive-data breach, anything with legal/regulatory exposure) usually calls for a professional incident-response firm.</li>
    </ul>
    <div class="start-links">
      <a class="start-link" href="${pathForTab('runbook')}" data-tab="runbook">
        <div class="icon-badge">${icon('document')}</div>
        <div><h4>Runbooks</h4><p>The fuller incident-response process, once you're past these first basic steps.</p></div>
      </a>
    </div>
  `},
];

function renderThreatModelingTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <div class="page-eyebrow">Prevention &amp; Response</div>
            <h2 class="page-title">Threat Modeling &amp; Forensics</h2>
            <p class="page-lede">Threat modeling and forensics are two ends of the same timeline. Threat modeling happens before anything goes wrong - systematically thinking through how an attacker could actually get in, so the gaps can be closed in advance. Forensics happens after something has gone wrong - reconstructing what actually happened, so the gap that got used can be closed and learned from. One is prevention through imagination; the other is response through investigation. A mature security program does both.</p>
          </div>
          <div class="tmf-wrap">${buildThreatModelForensicsSvg()}</div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Contents</h3>
        <ul class="toc-list">
          ${THREAT_MODELING_SECTIONS.map(s=>`<li><a href="#${s.id}" class="tm-toc-link" data-target="${s.id}">${s.title}</a></li>`).join('')}
        </ul>
      </div>

      <div class="section-tile">
        <div id="tmAccordions"></div>
      </div>
    </div>
  `;

  const accContainer = document.getElementById('tmAccordions');
  accContainer.innerHTML = THREAT_MODELING_SECTIONS.map((s,i)=>`
    <div class="acc-card" data-id="${s.id}">
      <div class="acc-head" id="${s.id}">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon(s.icon)}</div>
        <div><h4>${s.title}</h4></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body">${s.body}</div>
    </div>
  `).join('');
  wireAccordions(accContainer);
  wireNavLinksByDataset(accContainer, '.start-link[data-tab]');

  container.querySelectorAll('.tm-toc-link').forEach(link=>{
    link.addEventListener('click', (e)=>{
      const card = document.querySelector(`.acc-card[data-id="${link.dataset.target}"]`);
      if(card && !card.classList.contains('open')){
        e.preventDefault();
        card.classList.add('open');
        requestAnimationFrame(()=> card.scrollIntoView({ behavior:'smooth', block:'start' }));
      }
    });
  });
}

const NEWS_CATS = [
  { id:'all', label:'All' },
  { id:'ai', label:'AI & Security' },
  { id:'vuln', label:'Vulnerabilities' },
  { id:'ot', label:'OT / Industrial' },
  { id:'landscape', label:'Threat Landscape' },
];

async function renderNewsTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro revealed">
        <div class="page-eyebrow">Stay Current</div>
        <h2 class="page-title">Trends & News</h2>
        <p class="page-lede">A curated read of what's actually happening in the threat landscape and in AI-for-security - the same context a good consultant would bring into a conversation with you.</p>
      </div>
      <div class="section-tile revealed"><p class="body-text">Loading the latest…</p></div>
    </div>
  `;
  const newsData = await loadNewsData();
  // Bail if the user already navigated away while this was loading.
  if(!document.getElementById('tabContent')?.contains(container) && activeTab !== 'news') return;
  renderNewsList(container, newsData);
  // renderNewsList() just replaced the loading skeleton's .section-tile
  // with a fresh one - re-observe it so the scroll-reveal fade-in actually
  // fires (see the identical note on the filter-pill handler below).
  observeReveals();
}

function renderNewsList(container, newsData){
  const items = newsData.items.filter(n => newsFilter==='all' || n.cat===newsFilter);
  const freshness = newsData.live
    ? `Refreshed daily from CISA's KEV catalog, NVD, and security RSS feeds, ranked by exploitation status/severity/recency - not just "newest first."`
    : `Showing a curated snapshot - the live feed didn't return anything this time, so nothing's lost, just not current. Refresh in a bit.`;
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Stay Current</div>
        <h2 class="page-title">Trends & News</h2>
        <p class="page-lede">A curated read of what's actually happening in the threat landscape and in AI-for-security - the same context a good consultant would bring into a conversation with you.</p>
      </div>

      <div class="section-tile">
        <p class="news-freshness">${freshness}</p>
        <div class="news-filters">
          ${NEWS_CATS.map(c=>`<button class="filter-pill ${newsFilter===c.id?'active':''}" data-cat="${c.id}">${c.label}</button>`).join('')}
        </div>
        <div class="news-grid">
          ${items.map(n=>`
            <div class="news-card">
              <div class="news-meta"><span>${new Date(n.publishedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span><span class="news-cat">${NEWS_CATS.find(c=>c.id===n.cat)?.label || n.cat}</span></div>
              <h4>${n.headline}</h4>
              <p>${n.body}</p>
              <div class="news-source">${
                // Only KEV-sourced items are guaranteed to actually have a
                // matching entry on Exploits (which tracks confirmed
                // actively-exploited CVEs specifically, not every
                // high-CVSS NVD disclosure) - checking source here, not
                // just presence of a CVE id, avoids linking NVD items
                // through to an Exploits card that may not exist. See §1
                // of EXPLOITS-FIX-BRIEF.md.
                (n.cveId && n.source === 'CISA KEV Catalog')
                  ? `<a class="news-source-exploit-link" href="${pathForTab('exploits', `exploit-${n.cveId}`)}" data-goto-exploit="${n.cveId}">${n.source} - full detail on Exploits →</a>`
                  : (n.sourceUrl ? `<a href="${n.sourceUrl}" target="_blank" rel="noopener noreferrer">${n.source}</a>` : n.source)
              }</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Where to keep following this yourself</h3>
        <p class="body-text">This tab is a snapshot; these are live, ongoing sources across every format worth following - podcasts for the commute, newsletters for the inbox, and communities for everything in between.</p>
        <div class="resource-groups">
          <div class="resource-group">
            <h4>Podcasts</h4>
            ${LEARNING_RESOURCES.podcasts.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>Newsletters</h4>
            ${LEARNING_RESOURCES.newsletters.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>Medium</h4>
            ${LEARNING_RESOURCES.medium.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>News Sites</h4>
            ${LEARNING_RESOURCES.newssites.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
          <div class="resource-group">
            <h4>LinkedIn</h4>
            ${LEARNING_RESOURCES.linkedin.map(r=>`<div class="resource-item"><b>${r.name}</b><span>${r.desc}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  container.querySelectorAll('[data-goto-exploit]').forEach(btn=>{
    wireNavClick(btn, ()=> ({ tab:'exploits', anchor:`exploit-${btn.dataset.gotoExploit}` }));
  });
  container.querySelectorAll('.filter-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      newsFilter = btn.dataset.cat;
      renderNewsList(container, newsData);
      // renderNewsList() replaces container.innerHTML, so the fresh
      // .section-tile starts at opacity:0 per the scroll-reveal CSS (see
      // observeReveals()) - without re-observing it here, it never gets the
      // .revealed class and stays invisible, which is exactly the reported
      // "filter click does nothing / blank page" bug (§4 Phase 2 brief).
      observeReveals();
    });
  });
}

// §2 Exploits: exploit_items is fetched daily by a scheduled Edge Function
// (see supabase/functions/fetch-exploits) from CISA's Known Exploited
// Vulnerabilities catalog, enriched with an EPSS score from FIRST.org - the
// same read-only-Supabase, no-live-refetch-per-visit pattern as News. There
// is deliberately no static fallback snapshot here (unlike News's
// NEWS_ITEMS) - fabricating placeholder vulnerability data would be
// actively misleading, so an empty/failed fetch shows an honest "not
// available right now" state with a direct link to CISA's own catalog.
let exploitsCache = null;
async function loadExploitsData(){
  if(exploitsCache) return exploitsCache;
  try {
    const { data, error } = await supabase
      .from('exploit_items')
      .select('cve_id, vendor, product, headline, description, explainer, safe_guidance, sectors_impacted, is_ransomware, epss_score, epss_percentile, source, source_url, date_added, due_date, priority_score')
      .order('priority_score', { ascending:false });
    if(error) throw error;
    exploitsCache = { live:true, items: data || [] };
  } catch(e) {
    exploitsCache = { live:false, items: [] };
  }
  return exploitsCache;
}

// Must match RETENTION_CAP in supabase/functions/fetch-exploits/index.ts -
// stated here only so the page's own intro text can be honest about the
// actual policy instead of leaving visitors to guess (see EXPLOITS-FIX-
// BRIEF.md §5).
const EXPLOITS_RETENTION_CAP = 60;

const EXPLOIT_FILTERS = [
  { id:'all', label:'All' },
  { id:'ransomware', label:'Ransomware-Linked' },
  { id:'ot', label:'Critical Infrastructure / OT', sector:'Critical Infrastructure / OT & ICS' },
  { id:'healthcare', label:'Healthcare', sector:'Healthcare' },
  { id:'financial', label:'Financial Services', sector:'Financial Services' },
  { id:'government', label:'Government & Public Sector', sector:'Government & Public Sector' },
];
let exploitsFilter = 'all';

function matchesExploitFilter(item, filterId){
  if(filterId === 'all') return true;
  if(filterId === 'ransomware') return item.is_ransomware;
  const f = EXPLOIT_FILTERS.find(x=>x.id===filterId);
  return f && item.sectors_impacted?.includes(f.sector);
}

// ANIMATIONS-BRIEF.md: a "live threat detection" visual for the Exploits
// page's main intro, alongside the title (same page-intro-row slot
// buildMaturityClimbSvg uses on the Maturity page) - pulsing radar rings
// plus a few small blips fading in at fixed points, in the same
// accent-critical/accent-amber threat colors already used for the
// ransomware-linked badge on this page rather than introducing a new
// palette. CSS-driven (@keyframes, see app.css), respects
// prefers-reduced-motion there too.
function buildExploitsRadarSvg(){
  const blips = [
    { cx:38, cy:40, r:3, delay:0.4, dur:2.6 },
    { cx:84, cy:36, r:2.5, delay:1.6, dur:3.2 },
    { cx:80, cy:82, r:3, delay:2.4, dur:2.9 },
    { cx:30, cy:78, r:2.5, delay:0.9, dur:3.4 },
  ];
  return `
  <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <circle class="radar-ring" cx="60" cy="60" r="10" style="animation-delay:0s"/>
    <circle class="radar-ring" cx="60" cy="60" r="10" style="animation-delay:1s"/>
    <circle class="radar-ring" cx="60" cy="60" r="10" style="animation-delay:2s"/>
    ${blips.map(b=>`<circle class="radar-blip" cx="${b.cx}" cy="${b.cy}" r="${b.r}" style="animation-delay:${b.delay}s; animation-duration:${b.dur}s;"/>`).join('')}
    <circle class="radar-center" cx="60" cy="60" r="5"/>
  </svg>`;
}

async function renderExploitsTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro revealed">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <div class="page-eyebrow">Active Threats</div>
            <h2 class="page-title">Exploits</h2>
            <p class="page-lede">Vulnerabilities with confirmed active exploitation in the wild - not just a high severity score - sourced from CISA's Known Exploited Vulnerabilities catalog and scored by real-world exploitation likelihood.</p>
          </div>
          <div class="exploit-radar-wrap">${buildExploitsRadarSvg()}</div>
        </div>
      </div>
      <div class="section-tile revealed"><p class="body-text">Loading the latest…</p></div>
    </div>
  `;
  const exploitsData = await loadExploitsData();
  if(!document.getElementById('tabContent')?.contains(container) && activeTab !== 'exploits') return;
  renderExploitsList(container, exploitsData);
  observeReveals();
  // renderApp() already tried scrollToPendingAnchor() once, before this
  // async load finished - the target .exploit-card didn't exist yet at
  // that point, so it's a no-op retry unless something (e.g. a News card)
  // linked here with a pending anchor, in which case this is the attempt
  // that actually finds it.
  scrollToPendingAnchor();
}

function renderExploitsList(container, exploitsData){
  const items = exploitsData.items.filter(n => matchesExploitFilter(n, exploitsFilter));
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-intro-row">
          <div class="page-intro-text">
            <div class="page-eyebrow">Active Threats</div>
            <h2 class="page-title">Exploits</h2>
            <p class="page-lede">Vulnerabilities with confirmed active exploitation in the wild - not just a high severity score - sourced from CISA's Known Exploited Vulnerabilities catalog and scored by real-world exploitation likelihood.</p>
          </div>
          <div class="exploit-radar-wrap">${buildExploitsRadarSvg()}</div>
        </div>
      </div>

      ${!exploitsData.live || !exploitsData.items.length ? `
        <div class="section-tile">
          <p class="body-text">Live exploit data isn't available right now. Nothing's lost - this refreshes daily - but in the meantime, see <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener noreferrer" class="inline-link">CISA's KEV catalog</a> directly.</p>
        </div>
      ` : `
        <div class="section-tile">
          <p class="news-freshness">Refreshed daily from CISA's Known Exploited Vulnerabilities catalog, VulnCheck's KEV, and ENISA's EU Vulnerability Database, scored with EPSS (Exploit Prediction Scoring System) from FIRST.org - a model estimating the probability a vulnerability will actually be exploited, not just how severe it could theoretically be. Ranked by priority and capped at the ${EXPLOITS_RETENTION_CAP} highest-priority entries, not just newest-first, so the list stays current without growing unbounded.</p>
          <div class="news-filters">
            ${EXPLOIT_FILTERS.map(f=>`<button class="filter-pill ${exploitsFilter===f.id?'active':''}" data-filter="${f.id}">${f.label}</button>`).join('')}
          </div>
          <div class="exploits-grid">
            ${items.map(item=>{
              const epssPct = item.epss_score != null ? (item.epss_score*100).toFixed(1) : null;
              const percentilePct = item.epss_percentile != null ? (item.epss_percentile*100).toFixed(1) : null;
              const dateAdded = new Date(item.date_added).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
              const dueDate = item.due_date ? new Date(item.due_date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : null;
              return `
                <div class="exploit-card" id="exploit-${item.cve_id}">
                  <div class="exploit-meta">
                    <span class="exploit-cve">${item.cve_id}</span>
                    ${item.is_ransomware ? '<span class="exploit-ransomware-badge">Ransomware-Linked</span>' : ''}
                  </div>
                  <h4>${item.headline}</h4>
                  <div class="exploit-vendor">${item.vendor} · ${item.product}</div>
                  ${epssPct != null ? `
                    <div class="exploit-scores">
                      <div class="exploit-score-box">
                        <span class="exploit-score-value">${epssPct}%</span>
                        <span class="exploit-score-label">EPSS score - probability of exploitation in the next 30 days</span>
                      </div>
                      <div class="exploit-score-box">
                        <span class="exploit-score-value">${percentilePct}%</span>
                        <span class="exploit-score-label">EPSS percentile - riskier than this share of all scored CVEs</span>
                      </div>
                    </div>
                  ` : ''}
                  <div class="exploit-sectors">${(item.sectors_impacted||[]).map(s=>`<span class="exploit-sector-chip">${s}</span>`).join('')}</div>
                  <p>${item.description}</p>
                  <p>${item.explainer}</p>
                  <p class="exploit-safety"><b>Staying safe:</b> ${item.safe_guidance}</p>
                  <div class="exploit-footer">
                    <span class="exploit-dates">Added to KEV catalog ${dateAdded}${dueDate ? ` · CISA remediation due ${dueDate}` : ''}</span>
                    <a href="${item.source_url}" target="_blank" rel="noopener noreferrer">View on NVD →</a>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `}
    </div>
  `;
  container.querySelectorAll('.filter-pill').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      exploitsFilter = btn.dataset.filter;
      renderExploitsList(container, exploitsData);
      observeReveals();
    });
  });
}

function renderGlossaryTab(container){
  const sorted = [...GLOSSARY].sort((a,b)=> a.term.localeCompare(b.term));
  const groups = {};
  sorted.forEach(g=>{
    const letter = g.term[0].toUpperCase();
    (groups[letter] = groups[letter] || []).push(g);
  });
  const letters = Object.keys(groups).sort();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">Glossary</h2>
        <p class="page-lede">Every cybersecurity term used across this site, defined in plain language and sorted alphabetically.</p>
      </div>
      <div class="section-tile">
        <div class="alpha-index">
          ${alphabet.map(l=> groups[l]
            ? `<a class="alpha-chip" href="#gl-${l}">${l}</a>`
            : `<span class="alpha-chip disabled">${l}</span>`).join('')}
        </div>
        ${letters.map(l=>`
          <div class="glossary-letter-group" id="gl-${l}">
            <div class="glossary-letter">${l}</div>
            ${groups[l].map(g=>`
              <div class="glossary-entry"><b>${g.term}</b><span>${g.def}</span></div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderReferencesTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">References</h2>
        <p class="page-lede">The frameworks, catalogs, and reports this assessment is built on and cites.</p>
      </div>
      <div class="section-tile">
        <ul class="ref-list">
          ${REFERENCES.map(r=>`
            <li>
              ${r.href
                ? `<a class="link-pill" href="${r.href}" target="_blank" rel="noopener noreferrer"><span class="link-pill-icon">${icon('external')}</span>${r.label}</a>`
                : `<b style="color:var(--text)">${r.label}</b>`}
              <div style="margin-top:8px;">${r.note}</div>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderFeedbackTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Feedback</div>
        <h2 class="page-title">Send feedback</h2>
        <p class="page-lede">Found something broken, confusing, or missing? Think a feature should exist? This goes straight to the creator - no account or email of yours required.</p>
      </div>
      <div class="section-tile">
        <div id="feedbackFormWrap">
          <form id="feedbackForm">
            <div class="field">
              <label>Your name <span class="opt-tag">optional</span></label>
              <input type="text" id="fbName" placeholder="How should we address you?">
            </div>
            <div class="field">
              <label>Your email <span class="opt-tag">optional</span></label>
              <input type="email" id="fbEmail" placeholder="Only if you'd like a reply">
            </div>
            <div class="field">
              <label>Feedback</label>
              <textarea id="fbMessage" rows="6" placeholder="Bug report, confusing wording, a feature you think is missing - anything." required></textarea>
            </div>
            <div style="position:absolute; left:-9999px;"><label>Don't fill this out: <input type="text" id="fbBotField"></label></div>
            <div id="fbError" class="fb-error" style="display:none;"></div>
            <div class="cta-row">
              <button type="submit" class="cta-btn" id="fbSubmit">Send feedback →</button>
            </div>
          </form>
        </div>
        <div id="feedbackSuccess" style="display:none;">
          <p class="body-text">Thank you - your feedback has been sent. It's genuinely read and taken into account for what gets worked on next.</p>
          <div class="cta-row">
            <a class="cta-btn secondary" href="${pathForTab('home')}" id="fbBackHome">Back to Home</a>
          </div>
        </div>
      </div>
    </div>
  `;
  const fbBackHome = document.getElementById('fbBackHome');
  if(fbBackHome) wireNavLink(fbBackHome, 'home');
  document.getElementById('feedbackForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const errEl = document.getElementById('fbError');
    errEl.style.display = 'none';
    const message = document.getElementById('fbMessage').value.trim();
    if(!message){
      errEl.textContent = 'Please enter your feedback before sending.';
      errEl.style.display = 'block';
      return;
    }
    const submitBtn = document.getElementById('fbSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    const payload = new URLSearchParams({
      'form-name': 'feedback',
      'name': document.getElementById('fbName').value.trim(),
      'email': document.getElementById('fbEmail').value.trim(),
      'message': message,
      'bot-field': document.getElementById('fbBotField').value,
    });
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
      });
      if(!res.ok) throw new Error('Submission failed');
      document.getElementById('feedbackFormWrap').style.display = 'none';
      document.getElementById('feedbackSuccess').style.display = 'block';
    } catch(err){
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send feedback →';
      errEl.textContent = "Couldn't send that just now - please try again in a moment.";
      errEl.style.display = 'block';
    }
  });
}

function renderAboutTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">About</div>
        <h2 class="page-title">About this project</h2>
        <div class="about-narrative">
          <p class="page-lede">Hey there - my name is Sarath, creator of SimplifiedCS. I built this site with one goal: making cybersecurity accessible to everyone.</p>
          <p class="page-lede">With over 9 years of experience in cybersecurity and IT, I've seen the hurdles most companies actually run into firsthand, and wanted to design a simpler workflow for getting past them. This isn't meant to be a last-resort or final solution for every cyber need you have - the goal is to minimize risk as much as realistically possible, using existing tools and minimal cost, not to replace a real security program entirely.</p>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">A few technical highlights</h3>
        <ul class="tech-highlights-list">
          <li>An <b>adaptive decision-graph engine</b>, not a static form - questions branch on industry, region, infrastructure, and prior answers, with a session-wide <b>de-duplication system</b> so nothing is ever asked twice</li>
          <li><b>Compounding-risk detection</b> that flags dangerous <i>combinations</i> of gaps, not just individual weak answers - each one mapped to a real <b>MITRE ATT&amp;CK technique</b>, not a generic warning</li>
          <li>A deliberate <b>hybrid AI architecture</b>: a tested, deterministic scoring engine as the guaranteed-correct core, with an optional live layer checking named vendors against current threat data on top of it</li>
          <li><b>Live threat intelligence</b> pulled from CISA's KEV catalog, VulnCheck, ENISA, and NVD, scored by real-world exploitation likelihood via FIRST.org's <b>EPSS</b> model</li>
          <li>A programmatically-built, <b>selectable-text PDF export</b>, and a real <b>client-side router</b> with working back/forward navigation and shareable URLs - not the "everything is one page pretending to be many" shortcut it's easy to settle for</li>
        </ul>
      </div>

      <div class="section-tile">
        <div class="about-narrative">
          <p class="page-lede">This is a work in progress, and feedback is genuinely welcome - if you think a feature is missing or something could work better, I'd like to hear about it.</p>
          <p class="page-lede">This project is an <b>adaptive</b> cybersecurity assessment and compliance-readiness platform designed for small and medium-sized businesses. It helps organizations understand their current security posture, identify weaknesses, and receive practical recommendations to strengthen their cybersecurity defenses.</p>
          <p class="page-lede">The platform is based primarily on the NIST Cybersecurity Framework and CIS Critical Security Controls v8. It guides organizations through structured assessments, highlights security gaps, and provides actionable suggestions to improve their overall resilience.</p>
          <p class="page-lede">In addition to security assessments, the platform supports compliance-readiness initiatives across <b>eight frameworks</b> - ISO/IEC 27001, NIS2, SOC 2, HIPAA, GDPR, SOX, Cyber Essentials, and PCI DSS - layered in based on your industry and the regions you operate in, with more frameworks planned as the tool grows. Its long-term goal is to provide businesses with a centralized solution for continuously monitoring, improving, and demonstrating their security and compliance posture.</p>
          <p class="page-lede">Most recently, the platform added a <b>hybrid AI layer</b> to the results. Every report is still built first by the same tested, deterministic scoring engine the assessment has run on from the start - that part doesn't change, and it's already complete and accurate on its own. On top of it, an optional live pass checks your named vendors and products against current CISA and NVD vulnerability data, and looks for patterns in your specific answers the fixed rule set wasn't built to anticipate. It's clearly labeled wherever it appears, and it's additive, not a replacement.</p>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The idea behind the mark</h3>
        <p class="body-text">Fragments, scattered and disconnected, converging into a single, complete shield. That's meant to mirror what this tool actually does - individually small, disconnected gaps (a missing control here, an unpatched system there) assembling into your real security posture once they're identified and addressed together.</p>
        <div class="logo-assembly-wrap" id="logoAssemblyWrap"></div>
      </div>
    </div>
  `;
  renderLogoAssembly();
}

function renderLogoAssembly(){
  const wrap = document.getElementById('logoAssemblyWrap');
  if(!wrap) return;
  const logoSrc = document.querySelector('.brand-logo')?.src || '';
  // Fixed set of fragment offsets/timings for a consistent, repeatable assembly animation
  const fragments = [
    {x:-180,y:-90,size:14,delay:0.0},{x:-210,y:-30,size:10,delay:0.35},{x:-170,y:40,size:16,delay:0.7},
    {x:-140,y:-120,size:8,delay:1.05},{x:-230,y:70,size:12,delay:0.23},{x:-100,y:100,size:9,delay:1.17},
    {x:-190,y:110,size:11,delay:0.58},{x:-240,y:-60,size:13,delay:0.82},{x:-120,y:-70,size:10,delay:1.28},
    {x:-160,y:-160,size:9,delay:0.47},{x:-250,y:10,size:15,delay:0.93},{x:-90,y:-140,size:8,delay:1.4},
  ];
  wrap.innerHTML = `
    <div class="logo-assembly-stage">
      ${fragments.map(f=>`<div class="assembly-fragment" style="--fx:${f.x}px; --fy:${f.y}px; --fdelay:${f.delay}s; width:${f.size}px; height:${f.size}px;"></div>`).join('')}
      <img src="${logoSrc}" alt="SimplifiedCS logo" class="assembly-logo">
    </div>
  `;
}

const CORE_PRINCIPLES = [
  { title:'Proactive, not reactive', desc:'Waiting for an incident to find your gaps is the most expensive way to learn about them. Assessing, monitoring, and fixing ahead of time is consistently cheaper than recovering afterward - the entire reason this site exists is to move that discovery earlier.' },
  { title:'People, process, and technology - not technology alone', desc:'A well-configured firewall behind an untrained employee and no documented process is still a weak posture. Real security improvement requires progress across all three, together, not a single expensive tool standing in for the other two.' },
  { title:'A culture, not a department', desc:"Security isn't something the IT team owns on everyone else's behalf. Every person who clicks a link, sets a password, or handles data is part of the control surface - the goal is a culture people grow into, not a policy document nobody reads." },
  { title:'Defense in depth', desc:'No single control is perfect, so no single control should be load-bearing. Layer defenses so that one failure - a missed patch, a clicked phishing link - doesn\'t cascade into a full compromise on its own.' },
  { title:'Zero trust', desc:"Trust is not something a network location should grant automatically. Every request gets verified explicitly, regardless of whether it originates inside or outside the perimeter - the perimeter itself is no longer the control." },
  { title:'Least privilege', desc:'Access should match what a role genuinely needs to do its job, nothing more. Excess privilege sits quietly until the one day an account is compromised, at which point it becomes the attacker\'s privilege too.' },
  { title:'The CIA triad', desc:'Confidentiality, Integrity, and Availability - the three properties "secure" actually breaks down into. A control that protects one can quietly undermine another; good security design keeps all three in view at once, not just the one that feels most urgent.' },
  { title:'Segment the problem, not just the network', desc:"Looking at an entire security program at once is paralyzing. Breaking it into smaller, contained pieces - by function, by system, by risk - the same way network segmentation contains a breach, makes the work tractable and the containment real." },
  { title:'Decide from data, not instinct', desc:"Gut feeling about where the risk is usually points at the most visible problem, not the most likely one. Structured assessment, scoring, and trend tracking exist precisely to replace that instinct with evidence." },
  { title:'Improvement is a loop, not a destination', desc:"There's no final state where an organization is simply \"done\" being secure. Threats, infrastructure, and staff all change continuously, so the assessment is built to be re-run on a cadence, not completed once and filed away - the same loop this site's own animation is built around." },
];

function renderCorePrinciplesTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Philosophy</div>
        <h2 class="page-title">Core Principles</h2>
        <p class="page-lede">The cybersecurity principles this site is designed around - not a marketing list, the actual reasoning behind how the assessment, scoring, and recommendations are built.</p>
      </div>
      <div class="section-tile">
        <div class="principles-grid">
          ${CORE_PRINCIPLES.map((p,i)=>`
            <div class="principle-card">
              <div class="principle-num">${String(i+1).padStart(2,'0')}</div>
              <h4>${p.title}</h4>
              <p>${p.desc}</p>
            </div>
          `).join('')}
        </div>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaPrinciplesAssess">See these principles in practice →</a>
        </div>
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('ctaPrinciplesAssess'), 'assessment');
}

function renderPlaybooksTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">Playbooks</h2>
        <p class="page-lede">Top attack types curated based on OWASP Top 10, mapped through MITRE ATT&amp;CK/ATLAS to concrete mitigations.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">What a playbook is</h3>
        <div class="lifecycle-row">
          <p class="body-text">A playbook is a structured, step-by-step reference that pairs a specific attack pattern with a defined set of detection and mitigation actions, so a team responds consistently rather than improvising mid-incident. Each one below is created by identifying a classified attack type, mapping it to a MITRE ATT&amp;CK or ATLAS tactic, and deriving mitigation steps from the applicable NIST CSF controls. They exist so that response knowledge lives in a document instead of one person's head - repeatable across a team and over time. In practice, a company keeps the relevant playbook accessible to whoever is on call, walks through it during tabletop exercises (see Maturity Model Phase 7 - Response Readiness & Testing), and updates it whenever a real incident exposes a gap.</p>
          <div class="lifecycle-wrap">${buildPlaybookFlowSvg()}</div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Selection criteria</h3>
        <p class="body-text">Attack types included below were chosen against four criteria:</p>
        <ol class="ordered-list">
          ${PLAYBOOK_SELECTION_CRITERIA.map(c=>`<li>${c}</li>`).join('')}
        </ol>
      </div>

      <div class="section-tile">
        <h3 class="section-h">OSINT tools referenced</h3>
        <p class="body-text">Building and validating a playbook draws on the following open-source intelligence and reconnaissance tools - used here strictly for reference and threat-model construction, not for conducting unauthorized testing.</p>
        <div class="osint-grid">
          ${OSINT_TOOLS.map(t=>`<div class="osint-item"><b>${t.name}</b><span>${t.desc}</span></div>`).join('')}
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">How MITRE ATT&amp;CK / ATLAS is used</h3>
        <p class="body-text">MITRE ATT&amp;CK organizes real-world adversary behavior into Tactics (the attacker's goal at a given stage - Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact) and Techniques (the specific method used to achieve that goal, each with a standard ID such as T1190). For AI/LLM-specific attack types, MITRE ATLAS - a parallel framework scoped specifically to adversarial threats against AI/ML systems - is referenced instead, since classic ATT&amp;CK wasn't built to describe attacks like prompt injection or model poisoning.</p>
        <h3 class="section-h">Mapping methodology</h3>
        <p class="body-text">Each playbook below follows the same construction path: the attack type is anchored to its OWASP category; the underlying attacker behavior is mapped to its corresponding MITRE ATT&amp;CK or ATLAS tactic (and technique ID where one applies); the mitigation steps are derived primarily from the NIST CSF Protect and Detect functions; and each entry is kept to four concrete, achievable steps rather than an exhaustive checklist, consistent with this site's Runbooks tab.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Example playbooks</h3>
        <div id="playbookAccordions"></div>
      </div>
    </div>
  `;

  const pbContainer = document.getElementById('playbookAccordions');
  pbContainer.innerHTML = PLAYBOOKS.map((p,i)=>`
    <div class="acc-card" data-id="${p.ref}">
      <div class="acc-head">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon('urgent')}</div>
        <div>
          <h4>${p.title} <span class="q-badge">${p.cat}</span></h4>
          <div class="acc-sub">${p.ref} · ${p.mitre}</div>
        </div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body">
        <p class="body-text" style="margin-bottom:12px;">${p.desc}</p>
        <ol>${p.steps.map(s=>`<li>${s}</li>`).join('')}</ol>
      </div>
    </div>
  `).join('');
  wireAccordions(pbContainer);
}

function renderCaseStudyTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Learn From What Already Happened</div>
        <h2 class="page-title">Case Studies</h2>
        <p class="page-lede">Eight watershed cybersecurity incidents - each one traces back to a gap this site is specifically built to catch before it becomes a headline.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Watershed incidents</h3>
        <div class="case-grid">
          ${CASE_STUDIES.map(c=>`
            <div class="case-card">
              <div class="case-year">${c.year}</div>
              <h4>${c.title}</h4>
              <p>${c.body}</p>
              <div class="case-lesson"><b>Why it's here -</b> ${c.lesson}</div>
              <a class="case-link link-pill" href="${c.href}" target="_blank" rel="noopener noreferrer"><span class="link-pill-icon">${icon('external')}</span>Read more</a>
            </div>
          `).join('')}
        </div>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaCaseAssess">See where you stand →</a>
          <a class="cta-btn secondary" href="${pathForTab('runbook')}" id="ctaCaseRunbook">See the matching runbooks</a>
        </div>
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('ctaCaseAssess'), 'assessment');
  wireNavLink(document.getElementById('ctaCaseRunbook'), 'runbook');
}


function buildTrendSvg(runs){
  const w = 600, h = 120, pad = 20;
  const points = runs.map((r,i)=>{
    const x = pad + (runs.length===1 ? 0 : (i/(runs.length-1)) * (w-2*pad));
    const y = h - pad - (r.overall/100)*(h-2*pad);
    return [x,y];
  });
  const pathD = points.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const dots = points.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--accent-secure)"/>`).join('');
  return `<svg class="trend-chart" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="var(--line)" stroke-width="1"/>
    <path d="${pathD}" fill="none" stroke="var(--accent-secure)" stroke-width="2"/>
    ${dots}
  </svg>`;
}

async function renderHistory(){
  const panel = document.getElementById('panel');
  panel.innerHTML = `<div class="page-intro"><div class="page-eyebrow">History</div><h2 class="page-title">Loading past assessments…</h2></div>`;
  let runs = [];
  try {
    const lr = await window.storage.list('runs:', false);
    if(lr && lr.keys && lr.keys.length){
      const gets = await Promise.all(lr.keys.map(k => window.storage.get(k, false).catch(()=>null)));
      runs = gets.filter(Boolean).map(g => JSON.parse(g.value)).sort((a,b)=> a.ts - b.ts);
    }
  } catch(e){ /* storage unavailable */ }

  panel.innerHTML = `
    <div class="page-intro">
      <div class="page-eyebrow">History</div>
      <h2 class="page-title">Assessment History</h2>
      <p class="page-lede">${runs.length} assessment${runs.length===1?'':'s'} saved on this account.</p>
    </div>
    <div class="section-tile">
      ${runs.length>=2 ? buildTrendSvg(runs) : ''}
      <div class="history-list">
        ${runs.length ? runs.slice().reverse().map(r=>`
          <div class="history-row">
            <div>${new Date(r.ts).toLocaleDateString()} ${new Date(r.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}${r.industry ? ' · ' + (INDUSTRIES.find(i=>i.id===r.industry)?.label || r.industry) : ''}</div>
            <div class="history-score">${r.overall}%</div>
          </div>
        `).join('') : '<p class="body-text">No assessments saved yet - complete one to start tracking.</p>'}
      </div>
      <div class="cta-row">
        <a class="cta-btn" href="${pathForTab('assessment')}" id="backToScope">← Back to Assessment</a>
        ${runs.length ? `<button class="cta-btn secondary" id="clearHistory">Clear history</button>` : ''}
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('backToScope'), 'assessment');
  const clearBtn = document.getElementById('clearHistory');
  if(clearBtn){
    clearBtn.addEventListener('click', async ()=>{
      try {
        const lr = await window.storage.list('runs:', false);
        if(lr && lr.keys) await Promise.all(lr.keys.map(k=>window.storage.delete(k, false).catch(()=>null)));
      } catch(e){ /* ignore */ }
      renderHistory();
    });
  }
  observeReveals();
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
  window.addEventListener('resize', syncViewportWidthVar);
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
  renderSearchWidget();
  renderHamburgerMenu();
  renderApp();
  // Back/forward: the URL has already changed by the time this fires, so
  // just read it and re-render - no pushState here, goToTab() already
  // handles the forward-navigation case.
  window.addEventListener('popstate', ()=>{
    activeTab = tabForPath(location.pathname);
    pendingAnchor = location.hash ? location.hash.slice(1) : null;
    renderApp();
  });
})();
