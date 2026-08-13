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

const assessmentController = createAssessmentController({
  getPanel: () => document.getElementById("panel"),
  getRail: () => document.getElementById("rail"),
  icon: (name) => icon(name),
  goToTab: (id, anchor) => goToTab(id, anchor),
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
  exportProgressJson: (overall) => exportProgressJson(overall),
});

let activeTab = 'home';
let theme = 'dark';
const TOP_TABS = [
  { id:'home', label:'Home' },
  { id:'methodology', label:'Methodology' },
  { id:'maturity', label:'Maturity Model' },
  { id:'metrics', label:'Metrics' },
  { id:'news', label:'Trends & News' },
  { id:'assessment', label:'Assessment' },
];
const HOME_DROPDOWN = [
  { id:'maturitymodel', label:'What is SimplifiedCS?' },
  { id:'coreprinciples', label:'Core Principles' },
  { id:'roadmap', label:'Roadmap' },
  { id:'runbook', label:'Runbooks' },
  { id:'playbooks', label:'Playbooks' },
  { id:'casestudy', label:'Case Studies' },
  { id:'glossary', label:'Glossary' },
  { id:'history', label:'History' },
];
const ASSESSMENT_DROPDOWN = [
  { id:'assessment', label:'Take Assessment' },
  { id:'transform', label:'Import Report' },
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
      .select('headline, body, source, source_url, category, published_at')
      .order('priority_score', { ascending:false })
      .order('published_at', { ascending:false })
      .limit(100);
    if(error) throw error;
    if(data && data.length){
      newsCache = {
        live: true,
        items: data.map(d => ({
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
      .map(n => ({ headline:n.headline, body:n.body, source:n.source, sourceUrl:null, cat:n.cat, publishedAt:n.date })),
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
    evolve:'Once assets are known, Phase 2 can map real exposure instead of guessing at it.' },
  { num:2, stage:'discovery', title:'Attack Surface Mapping', desc:'Identify every external-facing entry point - websites, APIs, VPNs, remote access, third-party integrations - and understand how an attacker would actually get in.',
    monitor:'Re-checked whenever external-facing infrastructure changes - new domains, new APIs, new remote-access points.',
    evolve:'A mapped surface is what makes Phase 4\'s gap analysis meaningful rather than generic.' },
  { num:3, stage:'discovery', title:'Governance & Ownership Baseline', desc:'Assign real accountability for security decisions before writing a single control. Without an owner, findings from every later phase just accumulate unactioned.',
    monitor:'Verified through named accountability - can you point to the specific person who owns a given control?',
    evolve:'Without an owner, nothing found in later phases gets actioned - this single phase unlocks every one after it.' },
  { num:4, stage:'discovery', title:'Gap Analysis & Prioritization', desc:'Compare current state against a recognized framework (NIST CSF, CIS Controls) and rank gaps by risk - this is the exact function this site\'s Assessment tab performs.',
    monitor:'This is literally what the Assessment tab re-measures every time you run it - your score IS this phase\'s monitoring signal.',
    evolve:'Turns raw findings into an ordered backlog, which is what Phase 5 actually executes against.' },
  { num:5, stage:'transformation', title:'Control Implementation', desc:'Roll out the prioritized technical controls - MFA, EDR, network segmentation, email authentication, backup isolation - turning the roadmap into deployed defenses.',
    monitor:'Tracked as percentage of the Phase 4 backlog actually deployed, not just planned or ticketed.',
    evolve:'Each control closed here is a specific finding that disappears from your next Assessment run.' },
  { num:6, stage:'transformation', title:'Policy & Documentation', desc:'Formalize the program in writing: security policy, incident response plan, backup/DR plan, risk register. See the Runbooks tab for what each of these should actually contain.',
    monitor:'Reviewed on the cadence the policy itself states - typically annually, or after any material infrastructure change.',
    evolve:'Turns implemented controls into an auditable, teachable program instead of tribal knowledge that leaves when one person does.' },
  { num:7, stage:'transformation', title:'Response Readiness & Testing', desc:'Rehearse the plans, don\'t just file them - tabletop exercises, restore drills from backup, and walkthroughs of the ransomware/phishing/DDoS runbooks before a real incident forces it.',
    monitor:'Measured by whether tabletop exercises and restore drills actually happened, not whether a plan merely exists on paper.',
    evolve:'The last step before a program is operational rather than aspirational - directly supported by the Runbooks tab.' },
  { num:8, stage:'optimization', title:'Continuous Monitoring & Tuning', desc:'Operationalize logging and detection, and tune it against real telemetry - an alert nobody trusts because of noise is functionally the same as no alert.',
    monitor:'Tracked via alert precision over time - false-positive rate trending down, not just alert volume trending up.',
    evolve:'Reliable detection is the precondition for Phase 9\'s audits meaning anything at all.' },
  { num:9, stage:'optimization', title:'Auditing & Validation', desc:'Vulnerability scans, penetration tests, and control audits confirm defenses work as intended rather than just existing on paper - this is also where compliance audits (ISO 27001, SOC 2) fit in.',
    monitor:'Tracked via time-to-remediate findings from scans, pen tests, and compliance audits - not merely whether audits happened.',
    evolve:'Confirms which Phase 5 controls are actually working versus just installed and forgotten.' },
  { num:10, stage:'optimization', title:'Adaptive Iteration', desc:'Feed lessons from incidents, audits, and a changing threat landscape back into the program - and back into Phase 4\'s gap analysis, since this loop never really ends.',
    monitor:'Tracked by whether lessons from real incidents and audits visibly change next quarter\'s priorities.',
    evolve:'Feeds directly back into Phase 4 - the phase that makes the other nine a cycle instead of a one-time checklist.' },
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

// --- Transform tab: practical implementation steps, mapped to Maturity Model phases 4-10 ---
const TRANSFORM_STEPS = [
  { n:1, title:'Prioritize from your assessment', desc:'Start from the ranked Priority list on your latest results - highest severity first, not whatever\'s easiest.', phaseRef:'Maturity Model Phase 4' },
  { n:2, title:'Assign ownership', desc:'Every item on that list needs a named person, not a team - an unowned finding is a finding nobody fixes.', phaseRef:'Maturity Model Phase 3' },
  { n:3, title:'Implement the technical controls', desc:'MFA, EDR, network segmentation, email authentication - the specific gaps your assessment flagged, in order.', phaseRef:'Maturity Model Phase 5' },
  { n:4, title:'Document it', desc:'Every control needs a policy behind it. See the Runbooks tab for exactly what each foundational document should contain.', phaseRef:'Maturity Model Phase 6' },
  { n:5, title:'Rehearse, don\'t just file it', desc:'Tabletop exercises and backup-restore drills - a plan that\'s never been tested is a hypothesis, not a plan.', phaseRef:'Maturity Model Phase 7' },
  { n:6, title:'Re-assess to confirm it worked', desc:'Run the Assessment again. This is how you prove the transformation happened instead of assuming it did.', phaseRef:'Maturity Model Phase 4, next cycle' },
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
      'Confirm it\'s actually an attack and not a legitimate traffic spike or an internal misconfiguration - the response differs completely',
      'Engage your upstream provider, CDN, or scrubbing service - most effective DDoS mitigation happens outside your own network edge',
      'Apply traffic filtering and rate-limiting rules for the specific attack pattern observed, not a generic block',
      'Keep stakeholders informed during the outage with a realistic status cadence - silence during an outage erodes trust faster than the outage itself',
      'After the fact, review whether current capacity and mitigation contracts are actually sized for the attack you just saw',
    ]},
  { id:'lateral', icon:'lateral', title:'Lateral Movement', sub:'Active intrusion spreading internally',
    steps:[
      'Segment or isolate the affected network segment to contain spread while investigation continues',
      'Rotate credentials for any accounts observed or suspected to be used by the intruder - assume more were touched than confirmed',
      'Use EDR to isolate affected endpoints individually rather than shutting down broad segments where avoidable, to preserve business continuity',
      'Threat-hunt for persistence mechanisms (scheduled tasks, new admin accounts, unfamiliar services) - the initial entry point is rarely the only foothold',
      'Maintain chain of custody on any forensic evidence gathered, in case of later legal, insurance, or regulatory review',
    ]},
  { id:'cloudcompromise', icon:'cloud', title:'Cloud Account Compromise', sub:'Compromised AWS/Azure/GCP credentials or console access',
    steps:[
      'Revoke or rotate the compromised credentials/API keys immediately, and invalidate active sessions and tokens',
      'Check for new IAM users, roles, or access keys the attacker may have created to maintain access after the original credential is fixed',
      'Review billing and resource-creation logs for unauthorized compute spun up for cryptomining or further attacks - a common monetization move',
      'Check for modified security groups, storage bucket permissions, or public exposure changes made during the intrusion window',
      'Preserve cloud provider audit logs (CloudTrail/Azure Activity Log/GCP Audit Logs) before any retention window expires',
    ]},
  { id:'insider', icon:'exfil', title:'Insider Threat / Data Exfiltration', sub:'Suspected internal actor or unusual data movement',
    steps:[
      'Involve HR and legal before taking action on a person, not just IT - this category carries employment and legal exposure others don\'t',
      'Preserve access logs, file activity, and DLP alerts immediately - behavior evidence degrades fast once someone knows they\'re suspected',
      'Restrict access proportionate to the evidence rather than immediately alerting the individual, to avoid destruction of evidence',
      'Review what data specifically was accessed or moved, and to where, to scope actual exposure rather than assuming worst case',
      'Close the loop afterward - most insider incidents trace back to an offboarding or access-review gap the Risk Register should already have flagged',
    ]},
  { id:'supplychain', icon:'link', title:'Supply Chain / Third-Party Compromise', sub:'A vendor or integration you depend on gets breached',
    steps:[
      'Identify exactly what that vendor could access - this is only fast if the Vendor Risk Policy\'s access record is actually kept current',
      'Revoke or rotate any credentials, API keys, or OAuth tokens shared with the affected vendor immediately, don\'t wait for their all-clear',
      'Check your own logs for activity from the vendor\'s integration during the suspected compromise window, not just take their word for scope',
      'Notify your own downstream customers if their data could have been exposed through the chain - the obligation doesn\'t stop at your vendor',
      'Reassess whether that vendor\'s access level was appropriate in the first place, and tighten it regardless of fault',
    ]},
  { id:'zeroday', icon:'urgent', title:'Zero-Day / Actively Exploited Vulnerability', sub:'A critical flaw in something you run is being exploited in the wild',
    steps:[
      'Check CISA\'s Known Exploited Vulnerabilities (KEV) catalog and vendor advisories immediately to confirm exploitation status and scope',
      'Apply the vendor patch as the primary fix - but if none exists yet, apply documented interim mitigations (disabling a feature, restricting network access) without waiting',
      'Inventory every instance of the affected product across the environment - partial patching (as seen in real incidents like the SharePoint RCE chain) leaves real exposure',
      'Hunt for indicators of prior compromise, not just patch and move on - actively-exploited flaws are often already used before a patch exists',
      'Track time-to-patch as a metric - this is exactly what Phase 9 (Auditing & Validation) of the Maturity Model should be measuring over time',
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
      'Enforce authorization server-side on every request - never trust client-side role checks alone.',
      'Deny by default; grant access explicitly per resource and role.',
      'Centralize access-control logic rather than duplicating checks per endpoint.',
      'Log and alert on repeated authorization failures from a single account.',
    ]},
  { cat:'OWASP Web', ref:'A02:2021', title:'Cryptographic Failures', mitre:'Credential Access - T1552 (Unsecured Credentials)',
    desc:'Sensitive data is transmitted or stored without adequate encryption, or with weak/outdated algorithms, exposing it if intercepted or if storage is breached.',
    steps:[
      'Encrypt sensitive data at rest and in transit using current, vetted algorithms.',
      'Never store passwords in plaintext or reversible encryption - use a modern salted hashing function.',
      'Disable legacy TLS versions and weak cipher suites.',
      'Classify data by sensitivity so encryption requirements match actual risk.',
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
      'Threat-model new features before writing code, not after.',
      'Build abuse-case testing into design review, not just functional testing.',
      'Use secure design patterns and reference architectures rather than one-off solutions.',
      'Maintain a record of previously identified design flaws so they aren\'t repeated elsewhere.',
    ]},
  { cat:'OWASP Web', ref:'A05:2021', title:'Security Misconfiguration', mitre:'Initial Access - T1190 (Exploit Public-Facing Application)',
    desc:'Default accounts, unnecessary features, verbose error messages, or open cloud storage are left enabled, giving attackers an easy, often automated, path in.',
    steps:[
      'Harden configurations using a repeatable, automated baseline (Infrastructure as Code).',
      'Disable or remove unused features, ports, services, and default accounts.',
      'Regularly scan for configuration drift, not just once at deployment.',
      'Ensure error handling doesn\'t leak stack traces or internal details to end users.',
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
      'Verify digital signatures on software updates and dependencies before deployment.',
      'Use dependency-pinning and lockfiles rather than automatically pulling the latest version.',
      'Restrict CI/CD pipelines from pulling unverified third-party packages.',
      'Apply integrity checks (checksums) to deployment artifacts.',
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
      'Validate and allow-list destination URLs/IPs for any server-initiated request.',
      'Segment internal services from the network zone that processes external requests.',
      'Disable unnecessary URL schemas and redirects in the fetching library.',
      'Block outbound requests to internal metadata/management endpoints at the firewall.',
    ]},
  { cat:'AI / LLM', ref:'LLM01:2025', title:'Prompt Injection', mitre:'MITRE ATLAS - AI Model Access / Execution',
    desc:'Crafted input, either direct from a user or indirectly embedded in retrieved content, overrides the model\'s intended instructions and causes it to perform unintended actions or reveal restricted information.',
    steps:[
      'Segregate untrusted external content from system instructions in the prompt structure.',
      'Apply output filtering and human-in-the-loop approval for any sensitive or irreversible action.',
      'Constrain model behavior via system prompts and expected output formats.',
      'Treat this as unpatchable by design - defense in depth, not a single fix.',
    ]},
  { cat:'AI / LLM', ref:'LLM02:2025', title:'Sensitive Information Disclosure', mitre:'MITRE ATLAS - Exfiltration',
    desc:'The model exposes personal data, credentials, or proprietary information in its output, either because it was present in training/context data or because output isn\'t filtered before returning to the user.',
    steps:[
      'Apply data minimization - don\'t include sensitive data in context/prompts unless strictly necessary.',
      'Filter and redact model output before it reaches the end user.',
      'Isolate retrieval-augmented generation (RAG) sources by access level, not just relevance.',
      'Audit logs and transcripts for accidental sensitive-data echoes.',
    ]},
  { cat:'AI / LLM', ref:'LLM03:2025', title:'Supply Chain', mitre:'Supply Chain Compromise - T1195',
    desc:'Third-party models, datasets, or plugins introduce vulnerable or malicious components into an AI pipeline - the same behavioral pattern as traditional software supply-chain risk, extended to model weights and training data.',
    steps:[
      'Source models and datasets only from vetted, signed repositories.',
      'Scan model files for unsafe deserialization risks (e.g., unsafe pickle loading).',
      'Maintain an AI bill of materials tracking model provenance and version.',
      'Pin specific model versions rather than auto-updating to "latest."',
    ]},
  { cat:'AI / LLM', ref:'LLM04:2025', title:'Data and Model Poisoning', mitre:'MITRE ATLAS - Resource Development / Persistence',
    desc:'Manipulated training, fine-tuning, or embedding data introduces hidden backdoors, bias, or degraded behavior that activates under specific triggering conditions.',
    steps:[
      'Validate the provenance and integrity of training and fine-tuning data sources.',
      'Test models against known trigger patterns before deployment.',
      'Monitor production model outputs for behavioral drift from baseline.',
      'Restrict who can contribute to training/fine-tuning datasets.',
    ]},
  { cat:'AI / LLM', ref:'LLM06:2025', title:'Excessive Agency', mitre:'MITRE ATLAS - Impact',
    desc:'An AI agent is granted more autonomous permissions, tool access, or ability to take real-world action than its task actually requires, so a manipulated or malfunctioning agent can cause outsized damage.',
    steps:[
      'Grant agents least-privilege access to tools and systems, scoped per task.',
      'Require human approval for irreversible or high-impact actions.',
      'Log every tool call an agent makes, with the reasoning that triggered it.',
      'Set hard rate/scope limits on what an autonomous agent can execute unsupervised.',
    ]},
  { cat:'AI / LLM', ref:'LLM10:2025', title:'Unbounded Consumption', mitre:'Impact - T1499 (Endpoint Denial of Service, closest classic analogue)',
    desc:'Uncontrolled or excessive requests to a model cause runaway computational cost, resource exhaustion, or denial of service - extended to include financial cost, not just availability.',
    steps:[
      'Apply rate limiting and per-user/per-key quotas on model API calls.',
      'Set maximum token/context limits per request.',
      'Monitor cost and usage in real time with automatic circuit breakers.',
      'Isolate high-cost operations behind additional authorization checks.',
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


let pendingAnchor = null;

function scrollToPendingAnchor(){
  if(!pendingAnchor) return;
  const el = document.getElementById(pendingAnchor);
  pendingAnchor = null;
  if(el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior:'smooth', block:'start' });
}

function renderApp(){
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

function observeReveals(){
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
  }, { threshold:0.06, rootMargin:'0px 0px -40px 0px' });
  els.forEach(el=> io.observe(el));
}

function renderTabNav(){
  const nav = document.getElementById('tabnav');
  const dropdownMap = { home: HOME_DROPDOWN, assessment: ASSESSMENT_DROPDOWN };

  const navHtml = TOP_TABS.map(t=>{
    const dd = dropdownMap[t.id];
    if(dd){
      const parentActive = activeTab===t.id || dd.some(d=>d.id===activeTab);
      return `
        <div class="tab-item has-dropdown">
          <button class="tab-btn ${parentActive?'active':''}" data-tab="${t.id}">${t.label} <span class="tab-caret" data-toggle="1">▾</span></button>
          <div class="tab-dropdown">
            ${dd.map(d=>`<button class="dropdown-link ${activeTab===d.id?'active':''}" data-tab="${d.id}">${d.label}</button>`).join('')}
          </div>
        </div>
      `;
    }
    return `<button class="tab-btn ${activeTab===t.id?'active':''}" data-tab="${t.id}">${t.label}</button>`;
  }).join('');

  nav.innerHTML = navHtml;

  nav.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeTab = btn.dataset.tab;
      renderApp();
    });
  });
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
    document.querySelectorAll('.footer-links a[data-tab]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        goToTab(a.dataset.tab);
        window.scrollTo({ top:0, behavior:'smooth' });
      });
    });
    const brandLink = document.getElementById('brandHomeLink');
    if(brandLink){
      brandLink.addEventListener('click', (e)=>{
        e.preventDefault();
        goToTab('home');
      });
    }
    window._footerLinksBound = true;
  }
}

function renderThemeToggle(){
  const btn = document.getElementById('themeToggle');
  const goingTo = theme==='dark' ? 'light' : 'dark';
  btn.innerHTML = `${icon(goingTo==='light' ? 'sun' : 'moon')} <span>${goingTo==='light' ? 'Light' : 'Dark'} mode</span>`;
  btn.onclick = async ()=>{
    theme = goingTo;
    document.documentElement.setAttribute('data-theme', theme);
    renderThemeToggle();
    try { await window.storage.set('theme', theme, false); } catch(e){ /* ignore */ }
  };
}

function goToTab(id, anchor){
  activeTab = id;
  pendingAnchor = anchor || null;
  renderApp();
}

function exportProgressJson(overallValue){
  const exportData = { scsExport:true, exportedAt: Date.now(), overall: overallValue ?? null, answers: assessmentController.session.answers };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = overallValue === undefined || overallValue === null ? 'in-progress' : 'complete';
  a.download = `simplifiedcs-assessment-${suffix}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderActiveTab(){
  const container = document.getElementById('tabContent');
  if(activeTab === 'home') renderHomeTab(container);
  else if(activeTab === 'methodology') renderMethodologyTab(container);
  else if(activeTab === 'maturity') renderMaturityTab(container);
  else if(activeTab === 'metrics') renderMetricsTab(container);
  else if(activeTab === 'coreprinciples') renderCorePrinciplesTab(container);
  else if(activeTab === 'maturitymodel') renderMaturityModelTab(container);
  else if(activeTab === 'roadmap') renderRoadmapTab(container);
  else if(activeTab === 'transform') renderTransformTab(container);
  else if(activeTab === 'runbook') renderRunbookTab(container);
  else if(activeTab === 'news') renderNewsTab(container);
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
        <defs><radialGradient id="gTrans" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="var(--accent-secure)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-secure)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gTrans)"/>
        <path d="M25 42a25 25 0 0 1 42-16" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round"/>
        <path d="M17 27l8 0 0 8" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M75 58a25 25 0 0 1-42 16" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round"/>
        <path d="M83 73l-8 0 0-8" fill="none" stroke="var(--accent-secure)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
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
  { title:'CISA KEV Catalog', desc:'Actively exploited vulnerabilities, updated continuously', href:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', icon:'urgent', external:true },
  { title:'NVD - National Vulnerability Database', desc:'The U.S. government\'s authoritative CVE repository', href:'https://nvd.nist.gov/', icon:'register', external:true },
  { title:'Recently Flagged Exploits', desc:'CISA\'s KEV catalog, sorted with newest entries first', href:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', icon:'clock', external:true },
  { title:'Ongoing Threat Actor Campaigns', desc:'CISA\'s cybersecurity advisories on active TTPs', href:'https://www.cisa.gov/news-events/cybersecurity-advisories', icon:'lateral', external:true },
  { title:'Current Trends', desc:'This site\'s own curated threat-landscape roundup', tab:'news', icon:'signal' },
  { title:'Runbooks', desc:'Incident runbooks and foundational documents', tab:'runbook', icon:'document' },
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
            <a href="#" id="heroTakeAssessment" class="link-pill"><span class="link-pill-icon">${icon('checklist')}</span>Take the assessment</a>
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
              <div class="phase4-icon">${icon(s.icon)}</div>
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
        <h3 class="section-h">The three phases of the assessment</h3>
        <p class="body-text">Every assessment moves through three stages as a continuous workflow. Select a stage for a quick summary - each links through to the full detail on the <a href="#" id="linkMaturityFromPhases" class="inline-link">Maturity Model</a> page.</p>
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
      </div>

      <div class="section-tile">
        <h3 class="section-h">Risk Score Matrix</h3>
        <p class="body-text">Every assessment runs on a scored matrix (see the <a href="#" id="linkMetricsFromHome" class="inline-link">Metrics</a> page for the full breakdown). Select a number for what that risk level actually means:</p>
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
        <h3 class="section-h">Methodology</h3>
        <p class="body-text">Every question maps to a real control from a recognized framework - nothing here is invented. These frameworks are the guiding principles behind every score:</p>
        <div class="framework-badges">
          <div class="framework-badge">NIST CSF 2.0</div>
          <div class="framework-badge">CIS Controls v8</div>
          <div class="framework-badge">ISO 27001</div>
          <div class="framework-badge">NIS2</div>
          <div class="framework-badge">SOC 2</div>
          <div class="framework-badge">HIPAA</div>
          <div class="framework-badge">GDPR</div>
          <div class="framework-badge">SOX</div>
          <div class="framework-badge">Cyber Essentials</div>
          <div class="framework-badge">PCI DSS</div>
          <div class="framework-badge framework-badge-pipeline">+ more in the pipeline</div>
        </div>
        <p class="body-text">The baseline (NIST CSF + CIS) applies to every organization. The rest layer in based on your industry and the regions you operate in - a healthcare provider and a SaaS company are asked different follow-up questions, scored against different compliance overlays, because the risks and obligations genuinely differ. Operational Technology and DevSecOps modules do the same, appearing only where they're actually relevant. This framework set keeps growing as the tool matures.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Things to get you started</h3>
        <p class="body-text">Real, current sources - not just this site's own content.</p>
        <div class="start-links">
          ${START_LINKS.map(l=>`
            <a class="start-link" ${l.href ? `href="${l.href}" target="_blank" rel="noopener noreferrer"` : `href="#" data-tab="${l.tab}"`}>
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
            <div class="site-tile" data-tab="${t.tab}">
              <div class="icon-badge">${icon(t.icon)}</div>
              <h4>${t.title}</h4>
              <p>${t.desc}</p>
            </div>
          `).join('')}
        </div>
        <div class="cta-row">
          <button class="cta-btn" id="ctaStart">Start an assessment →</button>
          <button class="cta-btn secondary" id="ctaMethod">See how scoring works</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ctaStart').addEventListener('click', ()=> goToTab('assessment'));
  document.getElementById('ctaMethod').addEventListener('click', ()=> goToTab('methodology'));
  document.getElementById('heroTakeAssessment').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('assessment'); });
  document.getElementById('linkMetricsFromHome').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('metrics'); });
  document.getElementById('linkMaturityFromPhases').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('maturity'); });

  let openStageDetail = null;
  function closeStageDetail(){
    const panel = document.getElementById('stageDetailPanel');
    if(!panel) return;
    panel.classList.remove('open');
    openStageDetail = null;
    container.querySelectorAll('[data-stage-detail]').forEach(c=>c.classList.remove('stage-active'));
    setTimeout(()=>{ if(!panel.classList.contains('open')) panel.style.display = 'none'; }, 220);
  }
  container.querySelectorAll('[data-stage-detail]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      const sid = el.dataset.stageDetail;
      const panel = document.getElementById('stageDetailPanel');
      const d = STAGE_DETAIL[sid];
      if(openStageDetail === sid){ closeStageDetail(); return; }
      openStageDetail = sid;
      container.querySelectorAll('[data-stage-detail]').forEach(c=>c.classList.remove('stage-active'));
      el.classList.add('stage-active');
      el.insertAdjacentElement('afterend', panel);
      panel.innerHTML = `
        <h4 style="color:${STAGE_META[sid].color}">${STAGE_META[sid].label}</h4>
        <p class="body-text">${d.summary}</p>
        <p class="body-text"><b>Scoring metrics used:</b> ${d.metrics}</p>
        <a href="#" id="stageDetailMaturityLink" class="inline-link">See ${STAGE_META[sid].label} in full on the Maturity Model page →</a>
      `;
      panel.style.display = 'block';
      requestAnimationFrame(()=> panel.classList.add('open'));
      document.getElementById('stageDetailMaturityLink').addEventListener('click', (e2)=>{
        e2.preventDefault();
        goToTab('maturity', `maturity-${sid}`);
      });
    });
  });
  document.addEventListener('click', (e)=>{
    if(openStageDetail && !e.target.closest('.workflow-row') && !e.target.closest('.stage-detail-panel')){
      closeStageDetail();
    }
  });

  const riskDesc = document.getElementById('riskSliderDesc');
  container.querySelectorAll('.risk-slider-tick').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const n = btn.dataset.risk;
      container.querySelectorAll('.risk-slider-tick').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      riskDesc.innerHTML = `<b>Risk score ${n}:</b> ${RISK_SCORE_DESCRIPTIONS[n]}`;
      riskDesc.classList.remove('open');
      requestAnimationFrame(()=> riskDesc.classList.add('open'));
    });
  });

  container.querySelectorAll('.site-tile').forEach(el=>{
    el.addEventListener('click', ()=> goToTab(el.dataset.tab));
  });
  container.querySelectorAll('.start-link[data-tab]').forEach(el=>{
    el.addEventListener('click', (e)=>{ e.preventDefault(); goToTab(el.dataset.tab); });
  });
}

function renderMethodologyTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">How It Works</div>
        <h2 class="page-title">Methodology</h2>
        <p class="page-lede">What you get scored on, why the question set changes per organization, and how the final synthesis is built.</p>
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
        <p class="body-text">Each question scores 0, 1, or 2 depending on the answer chosen, rolled up into a function score and an overall percentage. The full breakdown of exactly how that's calculated, what each score band means, and how to read your result lives on the <a href="#" id="linkMetricsFromMethod" class="inline-link">Metrics</a> page.</p>
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
          <button class="cta-btn" id="ctaStart2">Start an assessment →</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ctaStart2').addEventListener('click', ()=> goToTab('assessment'));
  document.getElementById('linkMetricsFromMethod').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('metrics'); });
}

function renderMaturityTab(container){
  const stageOrder = ['discovery','transformation','optimization'];
  let html = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Maturity Model</div>
        <h2 class="page-title">Maturity Model</h2>
        <p class="page-lede">How a security program actually progresses - ten phases across three stages, four recognized maturity tiers, and what each number on your results page means for where you actually stand.</p>
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
        <p class="body-text">Every phase, with how it's actually monitored and what it unlocks next. For how your score itself is calculated, see the <a href="#" id="linkMetricsFromMaturity" class="inline-link">Metrics</a> page.</p>
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
          <button class="cta-btn" id="ctaMaturityAssess">Start an assessment →</button>
          <button class="cta-btn secondary" id="ctaMaturityDocs">See documentation & runbooks</button>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;
  document.getElementById('ctaMaturityAssess').addEventListener('click', ()=> goToTab('assessment'));
  document.getElementById('ctaMaturityDocs').addEventListener('click', ()=> goToTab('runbook'));
  document.getElementById('linkMetricsFromMaturity').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('metrics'); });
}

function buildLifecycleSvg(){
  const stages = ['Draft','Review','Approve','Publish','Periodic Review'];
  const cx=200, cy=170, r=110;
  const pts = stages.map((s,i)=>{
    const a = (i/stages.length)*2*Math.PI - Math.PI/2;
    return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a), label:s };
  });
  const pathD = `M ${cx+r},${cy} A ${r},${r} 0 1,1 ${cx-r+0.01},${cy} A ${r},${r} 0 1,1 ${cx+r},${cy}`;
  return `
  <svg viewBox="0 0 400 340" xmlns="http://www.w3.org/2000/svg">
    <path id="lifecyclePath" d="${pathD}" fill="none" stroke="var(--line)" stroke-width="1.5"/>
    ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="var(--surface)" stroke="var(--accent-secure)" stroke-width="1.6"/>`).join('')}
    ${pts.map(p=>{
      const labelY = p.y + (p.y > cy ? 22 : (p.y < cy - 5 ? -14 : 5));
      const anchor = p.x > cx+30 ? 'start' : p.x < cx-30 ? 'end' : 'middle';
      return `<text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" class="lifecycle-node-label">${p.label}</text>`;
    }).join('')}
    <circle r="6" fill="var(--accent-signal)">
      <animateMotion dur="9s" repeatCount="indefinite">
        <mpath href="#lifecyclePath"/>
      </animateMotion>
    </circle>
    <text x="200" y="175" text-anchor="middle" class="lifecycle-node-label" style="font-size:11px; letter-spacing:0.05em;">continuous, not one-and-done</text>
  </svg>`;
}

function renderMetricsTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Scoring & Calculation</div>
        <h2 class="page-title">Metrics</h2>
        <p class="page-lede">Exactly how a score is calculated, what each band means, and how to read your result - all the scoring mechanics in one place.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">How the score is calculated</h3>
        <p class="body-text">Each question scores 0, 1, or 2 depending on the answer chosen. A function's score is the sum of its answers divided by the maximum possible, expressed as a percentage. The overall score is the average across all six NIST CSF functions - visible as the radial gauge on your results page. This is a straightforward roll-up, but it isn't the whole picture: see "the part that isn't just averaging" on the <a href="#" id="linkMethodFromMetrics1" class="inline-link">Methodology</a> page for how compounding-risk flags factor in separately.</p>
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
        <p class="body-text">Bands below are shown on a 0–10 scale (your overall percentage ÷ 10) - a 5–7, for example, means something specific about your organization, not just "middling." For how each phase of the <a href="#" id="linkMaturityFromMetrics" class="inline-link">Maturity Model</a> connects to these bands, see that page directly.</p>
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
          <button class="cta-btn" id="ctaMetricsHistory">View assessment history →</button>
          <button class="cta-btn secondary" id="ctaMetricsAssess">Start an assessment →</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ctaMetricsHistory').addEventListener('click', ()=> goToTab('history'));
  document.getElementById('ctaMetricsAssess').addEventListener('click', ()=> goToTab('assessment'));
  document.getElementById('linkMethodFromMetrics1').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('methodology'); });
  document.getElementById('linkMaturityFromMetrics').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('maturity'); });
}

const SITE_LAST_UPDATED = 'August 10, 2026';
const SITE_STARTED = 'June 2026';

// Both prior entries here (Feedback Form, Core Principles Page) have since
// shipped and moved off this list - nothing is currently queued. Add real
// in-progress items here as they start.
const ROADMAP_IN_PROGRESS = [];

function renderRoadmapTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Site Status</div>
        <h2 class="page-title">Roadmap</h2>
        <p class="page-lede">Not the assessment methodology - this page tracks what's actively being built on the website itself right now. Started <b>${SITE_STARTED}</b> · Last updated <b>${SITE_LAST_UPDATED}</b>.</p>
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
        <p class="body-text">A policy that's never reviewed is a policy that's already wrong. Every foundational document below should move through the same cycle continuously:</p>
        <div class="lifecycle-wrap">${buildLifecycleSvg()}</div>
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
          <button class="cta-btn" id="ctaDocsAssess">See where you stand first →</button>
        </div>
      </div>
    </div>
  `;

  const docContainer = document.getElementById('docAccordions');
  docContainer.innerHTML = FOUNDATIONAL_DOCS.map(d=>`
    <div class="acc-card" data-id="${d.id}">
      <div class="acc-head">
        <div class="icon-badge">${icon(d.icon)}</div>
        <div><h4>${d.title}</h4></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body"><ul>${d.points.map(pt=>`<li>${pt}</li>`).join('')}</ul></div>
    </div>
  `).join('');

  const runbookContainer = document.getElementById('runbookAccordions');
  runbookContainer.innerHTML = RUNBOOKS.map(r=>`
    <div class="acc-card" data-id="${r.id}">
      <div class="acc-head">
        <div class="icon-badge">${icon(r.icon)}</div>
        <div><h4>${r.title}</h4><div class="acc-sub">${r.sub}</div></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body"><ol>${r.steps.map(s=>`<li>${s}</li>`).join('')}</ol></div>
    </div>
  `).join('');

  wireAccordions(docContainer);
  wireAccordions(runbookContainer);
  document.getElementById('ctaDocsAssess').addEventListener('click', ()=> goToTab('assessment'));
}


function renderTransformTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Assessment</div>
        <h2 class="page-title">Import Report</h2>
        <p class="page-lede">Import a previous assessment to review and re-run it, and follow the practical steps for actually closing what it found.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Import a previous report</h3>
        <div class="upload-zone">
          <label class="upload-label" for="reportUpload">Choose a file →</label>
          <input type="file" id="reportUpload" accept=".json">
          <div class="upload-hint">Choose your exported SimplifiedCS JSON file to resume the assessment.</div>
          <div id="uploadResult"></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Steps to strengthen your cyber health</h3>
        <p class="body-text">Once you know what's wrong, this is the practical sequence for actually fixing it - each step ties back to a specific phase on the Maturity Model.</p>
        <div class="transform-steps">
          ${TRANSFORM_STEPS.map(s=>`
            <div class="transform-step">
              <div class="transform-step-num">${String(s.n).padStart(2,'0')}</div>
              <div>
                <h4>${s.title}</h4>
                <p>${s.desc}</p>
                <div class="phase-ref">${s.phaseRef}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="cta-row">
          <button class="cta-btn" id="ctaTransformAssess">Start a fresh assessment →</button>
          <button class="cta-btn secondary" id="ctaTransformRoadmap">See the full Maturity Model</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ctaTransformAssess').addEventListener('click', ()=> goToTab('assessment'));
  document.getElementById('ctaTransformRoadmap').addEventListener('click', ()=> goToTab('maturity'));

  document.getElementById('reportUpload').addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const resultEl = document.getElementById('uploadResult');
    const ext = file.name.split('.').pop().toLowerCase();

    if(ext === 'json'){
      const reader = new FileReader();
      reader.onload = (ev)=>{
        try {
          const data = JSON.parse(ev.target.result);
          if(!data.scsExport) throw new Error('not-recognized');
          assessmentController.loadExport(data);
          const industryLabel = (INDUSTRIES.find(i=>i.id===(data.scope?.industry || data.answers?.industry))||{}).label || 'Not set';
          const scoreLine = (data.overall === null || data.overall === undefined) ? 'In progress - not yet completed' : `${data.overall}% overall`;
          resultEl.className = 'upload-result';
          resultEl.innerHTML = `
            <b>Report loaded</b> - ${file.name}<br>
            Previous status: <b>${scoreLine}</b> · Industry: <b>${industryLabel}</b><br>
            Exported: ${data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'unknown'}<br><br>
            Your prior answers are loaded. Continue to the Assessment tab to review, adjust, and re-run.
          `;
          const goBtn = document.createElement('button');
          goBtn.className = 'cta-btn';
          goBtn.style.marginTop = '14px';
          goBtn.textContent = 'Review & re-run assessment →';
          goBtn.addEventListener('click', ()=>{ goToTab('assessment'); });
          resultEl.appendChild(goBtn);
        } catch(err){
          resultEl.className = 'upload-result error';
          resultEl.innerHTML = `<b>Couldn't read this file</b> - it doesn't look like a SimplifiedCS export. Try exporting one from a completed assessment's results screen first (look for "Export as JSON").`;
        }
      };
      reader.readAsText(file);
    } else {
      resultEl.className = 'upload-result';
      resultEl.innerHTML = `
        <b>File received</b> - ${file.name}<br>
        This prototype only fully parses its own JSON export format. In the live version, this is exactly where Claude's document understanding would extract structured findings from any report format (PDF, Word, whatever your last audit came in) and pre-populate the assessment automatically - that integration isn't built here yet.
      `;
    }
  });
}

function renderMaturityModelTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">What is SimplifiedCS?</h2>
        <p class="page-lede">What this tool is, how it's used, and what it covers.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Contents</h3>
        <ul class="toc-list">
          <li><a href="#mm-what">What this tool is</a></li>
          <li><a href="#mm-how">How it's used</a></li>
          <li><a href="#mm-capabilities">Capabilities</a></li>
          <li><a href="#mm-segments">Segments covered</a></li>
        </ul>
      </div>

      <div class="section-tile">
        <h3 class="section-h" id="mm-what">What this tool is</h3>
        <p class="body-text">A self-assessment and advisory instrument that scores an organization's cybersecurity health against NIST CSF 2.0 and CIS Controls v8, cross-references answers for compounding risk instead of scoring each in isolation, and tracks maturity across repeated runs over time.</p>

        <h3 class="section-h" id="mm-how">How it's used</h3>
        <p class="body-text">Pick an industry and any relevant compliance standards, answer an adaptive questionnaire that only shows what's relevant to your organization, and receive a scored, prioritized report - then re-run it periodically and use Import Report to close what it finds.</p>

        <h3 class="section-h" id="mm-capabilities">Capabilities</h3>
        <p class="body-text">Adaptive question branching by industry and infrastructure · compounding-risk detection across answers rather than per-question scoring alone · vendor-aware mitigation notes for named products · assessment history with score-delta tracking · a documentation and runbook library · report import for re-assessment · a maturity model for context. See the <a href="#" id="linkMaturityFromWhat" class="inline-link">Maturity Model</a> and <a href="#" id="linkMetricsFromWhat" class="inline-link">Metrics</a> pages for the full detail behind each of these.</p>

        <h3 class="section-h" id="mm-segments">Segments covered</h3>
        <p class="body-text">NIST CSF 2.0 (all six functions, including Govern) and CIS Controls v8 as the fixed baseline, with optional ISO 27001, NIS2, SOC 2, HIPAA, GDPR, SOX, Cyber Essentials, and PCI DSS modules layered in by industry and region. Dedicated coverage for Operational Technology/ICS and DevSecOps/cloud-native practices, both shown only when relevant to the organization being assessed.</p>
        <div class="cta-row">
          <button class="cta-btn" id="ctaMMAssess">Start an assessment →</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ctaMMAssess').addEventListener('click', ()=> goToTab('assessment'));
  document.getElementById('linkMaturityFromWhat').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('maturity'); });
  document.getElementById('linkMetricsFromWhat').addEventListener('click', (e)=>{ e.preventDefault(); goToTab('metrics'); });
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
      <div class="page-intro">
        <div class="page-eyebrow">Stay Current</div>
        <h2 class="page-title">Trends & News</h2>
        <p class="page-lede">A curated read of what's actually happening in the threat landscape and in AI-for-security - the same context a good consultant would bring into a conversation with you.</p>
      </div>
      <div class="section-tile"><p class="body-text">Loading the latest…</p></div>
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
              <div class="news-source">${n.sourceUrl ? `<a href="${n.sourceUrl}" target="_blank" rel="noopener noreferrer">${n.source}</a>` : n.source}</div>
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
            <button class="cta-btn secondary" id="fbBackHome">Back to Home</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('fbBackHome')?.addEventListener('click', ()=> goToTab('home'));
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
        <p class="page-lede">Hey there - my name is Sarath, creator of SimplifiedCS. I built this site with one goal: making cybersecurity accessible to everyone.</p>
        <p class="page-lede">With over 9 years of experience in cybersecurity and IT, I've seen the hurdles most companies actually run into firsthand, and wanted to design a simpler workflow for getting past them. This isn't meant to be a last-resort or final solution for every cyber need you have - the goal is to minimize risk as much as realistically possible, using existing tools and minimal cost, not to replace a real security program entirely.</p>
        <p class="page-lede">This is a work in progress, and feedback is genuinely welcome - if you think a feature is missing or something could work better, I'd like to hear about it.</p>
        <p class="page-lede">This project is a cybersecurity assessment and compliance-readiness platform designed for small and medium-sized businesses. It helps organizations understand their current security posture, identify weaknesses, and receive practical recommendations to strengthen their cybersecurity defenses.</p>
        <p class="page-lede">The platform is based primarily on the NIST Cybersecurity Framework and CIS Critical Security Controls v8. It guides organizations through structured assessments, highlights security gaps, and provides actionable suggestions to improve their overall resilience.</p>
        <p class="page-lede">In addition to security assessments, the platform supports compliance-readiness initiatives for frameworks such as ISO/IEC 27001 and SOC 2. Its long-term goal is to provide businesses with a centralized solution for continuously monitoring, improving, and demonstrating their security and compliance posture.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The idea behind the mark</h3>
        <p class="body-text">Fragments, scattered and disconnected, converging into a single, complete shield. That's meant to mirror what this tool actually does - individually small, disconnected gaps (a missing control here, an unpatched system there) assembling into your real security posture once they're identified and addressed together.</p>
        <div class="logo-assembly-wrap" id="logoAssemblyWrap"></div>
      </div>

      <div class="section-tile">
        <p class="body-text">This section is intentionally left blank for now.</p>
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
          <button class="cta-btn" id="ctaPrinciplesAssess">See these principles in practice →</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ctaPrinciplesAssess').addEventListener('click', ()=> goToTab('assessment'));
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
        <p class="body-text">A playbook is a structured, step-by-step reference that pairs a specific attack pattern with a defined set of detection and mitigation actions, so a team responds consistently rather than improvising mid-incident. Each one below is created by identifying a classified attack type, mapping it to a MITRE ATT&amp;CK or ATLAS tactic, and deriving mitigation steps from the applicable NIST CSF controls. They exist so that response knowledge lives in a document instead of one person's head - repeatable across a team and over time. In practice, a company keeps the relevant playbook accessible to whoever is on call, walks through it during tabletop exercises (see Maturity Model Phase 7 - Response Readiness & Testing), and updates it whenever a real incident exposes a gap.</p>
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
  pbContainer.innerHTML = PLAYBOOKS.map(p=>`
    <div class="acc-card" data-id="${p.ref}">
      <div class="acc-head">
        <div class="icon-badge">${icon('urgent')}</div>
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
          <button class="cta-btn" id="ctaCaseAssess">See where you stand →</button>
          <button class="cta-btn secondary" id="ctaCaseRunbook">See the matching runbooks</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('ctaCaseAssess').addEventListener('click', ()=> goToTab('assessment'));
  document.getElementById('ctaCaseRunbook').addEventListener('click', ()=> goToTab('runbook'));
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
        <button class="cta-btn" id="backToScope">← Back to Assessment</button>
        ${runs.length ? `<button class="cta-btn secondary" id="clearHistory">Clear history</button>` : ''}
      </div>
    </div>
  `;
  document.getElementById('backToScope').addEventListener('click', ()=>{
    goToTab('assessment');
  });
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
  try {
    const r = await window.storage.get('theme', false);
    if(r && (r.value === 'light' || r.value === 'dark')) theme = r.value;
  } catch(e){ /* default to dark */ }
  document.documentElement.setAttribute('data-theme', theme);
  renderApp();
})();
