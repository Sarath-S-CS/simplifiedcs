// Case Studies page (/case-studies): the simulated engagement plus the live case-study feed.
import { caseStudyCardHtml } from "../ui/feed-cards.js";
import { CASE_STUDIES } from "../content/case-studies.js";
import { SIMULATED_ENGAGEMENT } from "../content/learning.js";
import { wireAccordions, keepFocusAcrossRedraw } from "../ui/a11y.js";
import { getSupabase } from "../data/supabase-client.js";
import { pathForTab, wireNavLink, activeTab } from "../router.js";
import { icon, observeReveals } from "./shared.js";

const SMALL_NUMBER_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];

// AI-READINESS-GOVERNANCE-BRIEF.md §3 - a fictional, illustrative engagement
// (Contoso Advisory Ltd. doesn't exist) authored to demonstrate this site's
// own assessment methodology against a realistic GenAI/RAG deployment, kept
// clearly, repeatedly labeled as simulated rather than a real historical
// incident - the same honesty requirement as the Sample Report. Severity
// bands from the Likelihood x Impact product (1-5 each, 1-25 total),
// matching the brief's own rubric-style scoring: Low 1-4, Medium 5-9,
// High 10-16, Critical 17-25. MITRE technique IDs are the same ones this
// session verified directly against attack.mitre.org / atlas.mitre.org
// before use - T1213 (Data from Information Repositories) for the
// over-permissioned retrieval finding, AML.T0051.001 (MITRE ATLAS's
// Indirect Prompt Injection via Retrieved Content) for the malicious-
// document finding - never invented to fit.
function riskSeverity(likelihood, impact){
  const score = likelihood * impact;
  if(score >= 17) return 'Critical';
  if(score >= 10) return 'High';
  if(score >= 5) return 'Medium';
  return 'Low';
}
// Reuses the same green -> amber -> red spectrum the results gauge already
// uses for overall health (see the --accent-signal/#E0A94A/--accent-critical
// gradient stops in app.css), rather than reaching for an unrelated accent
// color (violet/pop/electric) that has no "risk" meaning anywhere else on
// this site. Critical and High share red - the text badge next to it is
// what actually distinguishes the two, same as this platform's own verdict
// labels rely on text, not a five-color ramp, to be precise.
const SEVERITY_ACCENT = { Critical: '--accent-critical', High: '--accent-critical', Medium: '--accent-amber', Low: '--accent-signal' };

// case_studies is fetched from Supabase (see supabase/functions/fetch-
// case-studies) - a scheduled job that researches and adds new watershed-
// caliber incidents over time, on top of the nine seeded here originally.
// Falls back to the static CASE_STUDIES snapshot above (same shape) if the
// live fetch fails, same live-with-fallback pattern as loadNewsData().
let caseStudiesCache = null;
async function loadCaseStudiesData(){
  if(caseStudiesCache) return caseStudiesCache;
  try {
    // incident_date, not fetched_at, as the tiebreak within a year - two
    // incidents from the same year should sort by when they actually
    // happened, not by which order a bulk research/insert pass happened
    // to write them in. nullsFirst:false so an entry with no known exact
    // date (year only) still sorts sensibly (after its dated same-year
    // siblings) instead of jumping to the front.
    const { data, error } = await (await getSupabase())
      .from('case_studies')
      .select('external_id, year, title, href, source_name, summary_what, summary_how, summary_impact, summary_lesson, summary_safeguard')
      .order('year', { ascending:false })
      .order('incident_date', { ascending:false, nullsFirst:false });
    if(error) throw error;
    if(data && data.length){
      caseStudiesCache = {
        live: true,
        items: data.map(d => ({
          year:d.year, title:d.title, href:d.href, sourceName:d.source_name,
          summaryWhat:d.summary_what, summaryHow:d.summary_how, summaryImpact:d.summary_impact,
          lesson:d.summary_lesson, summarySafeguard:d.summary_safeguard,
        })),
      };
      return caseStudiesCache;
    }
  } catch(e) { /* fall through to static snapshot below */ }
  caseStudiesCache = {
    live: false,
    items: [...CASE_STUDIES].sort((a,b)=>Number(b.year)-Number(a.year)),
  };
  return caseStudiesCache;
}

// A simple, deliberately uncluttered box-and-arrow diagram (§3: "a simple
// architecture diagram") - four boxes for the real flow, one dashed return
// arrow for the response path, and the five trust boundaries the brief
// asks for called out as a numbered legend underneath rather than five
// separate crossing arrows, which would turn "simple" into a tangle.
function renderSimulatedArchitecture(){
  // Gap widths were previously fixed (60-70px) regardless of label length -
  // "③ retrieval" (~68px) and especially "④ retrieved data" (~99px) never
  // fit inside a 60px gap at any font size this diagram uses, so both
  // spilled horizontally into the Azure OpenAI/SharePoint tiles on either
  // side of them, not just past a single number that looked small. Every
  // gap below is sized from the actual rendered width of the label it
  // holds (measured via SVGTextElement.getComputedTextLength(), not
  // estimated) plus real margin, not just widened until it looked right at
  // one zoom level. The circled number in each label also gets its own
  // larger tspan - legibility was the other half of the complaint, not
  // just the overlap.
  return `
    <svg viewBox="0 0 930 210" xmlns="http://www.w3.org/2000/svg" class="sim-arch-svg" role="img" aria-label="Architecture: User, through the GenAI Assistant and Azure OpenAI, to SharePoint Online and back">
      <defs>
        <marker id="simArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent-signal)"/>
        </marker>
        <marker id="simArrowMuted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted)"/>
        </marker>
      </defs>
      <line x1="112" y1="70" x2="217" y2="70" stroke="var(--accent-signal)" stroke-width="2" marker-end="url(#simArrow)"/>
      <line x1="367" y1="70" x2="472" y2="70" stroke="var(--accent-signal)" stroke-width="2" marker-end="url(#simArrow)"/>
      <line x1="622" y1="60" x2="757" y2="60" stroke="var(--accent-signal)" stroke-width="2" marker-end="url(#simArrow)"/>
      <line x1="757" y1="82" x2="622" y2="82" stroke="var(--accent-critical)" stroke-width="2" marker-end="url(#simArrowMuted)"/>
      <path d="M816,122 C816,188 92,188 92,122" fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-dasharray="4 4" marker-end="url(#simArrowMuted)"/>
      <text x="454" y="152" text-anchor="middle" font-family="var(--mono)" fill="var(--text-muted)" letter-spacing="0.02em"><tspan font-size="13">⑤</tspan><tspan font-size="10.5"> LLM output → user</tspan></text>
      <text x="164" y="58" text-anchor="middle" font-family="var(--mono)" fill="var(--text-muted)" letter-spacing="0.02em"><tspan font-size="13">①</tspan><tspan font-size="10"> user → app</tspan></text>
      <text x="419" y="58" text-anchor="middle" font-family="var(--mono)" fill="var(--text-muted)" letter-spacing="0.02em"><tspan font-size="13">②</tspan><tspan font-size="10"> app → Azure</tspan></text>
      <text x="689" y="48" text-anchor="middle" font-family="var(--mono)" fill="var(--text-muted)" letter-spacing="0.02em"><tspan font-size="13">③</tspan><tspan font-size="10"> retrieval</tspan></text>
      <text x="689" y="97" text-anchor="middle" font-family="var(--mono)" fill="var(--accent-critical)" letter-spacing="0.02em"><tspan font-size="13">④</tspan><tspan font-size="10"> retrieved data</tspan></text>
      <g>
        <rect x="20" y="40" width="92" height="72" rx="8" fill="var(--tile-bg)" stroke="var(--line)"/>
        <text x="66" y="72" text-anchor="middle" font-size="12" fill="var(--text)" font-weight="600">User</text>
        <text x="66" y="88" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">Contoso staff</text>
      </g>
      <g>
        <rect x="217" y="30" width="150" height="92" rx="8" fill="var(--tile-bg)" stroke="var(--accent-signal)"/>
        <text x="292" y="62" text-anchor="middle" font-size="12" fill="var(--text)" font-weight="600">GenAI Assistant</text>
        <text x="292" y="78" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">Microsoft 365</text>
        <text x="292" y="92" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">Entra ID auth</text>
      </g>
      <g>
        <rect x="472" y="30" width="150" height="92" rx="8" fill="var(--tile-bg)" stroke="var(--accent-signal)"/>
        <text x="547" y="62" text-anchor="middle" font-size="12" fill="var(--text)" font-weight="600">Azure OpenAI</text>
        <text x="547" y="78" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">RAG orchestration</text>
      </g>
      <g>
        <rect x="757" y="30" width="138" height="92" rx="8" fill="var(--tile-bg)" stroke="var(--accent-critical)"/>
        <text x="826" y="62" text-anchor="middle" font-size="12" fill="var(--text)" font-weight="600">SharePoint</text>
        <text x="826" y="78" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">Online</text>
        <text x="826" y="92" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">document retrieval</text>
      </g>
    </svg>
    <p class="sim-arch-legend">Five trust boundaries: <b>① user → app</b> · <b>② app → Azure services</b> · <b>③ retrieval → SharePoint</b><br>· <b>④ retrieved data → LLM</b> (the boundary Finding 2 below crosses) · <b>⑤ LLM output → user</b>.</p>
  `;
}

function renderSimulatedFinding(f, i){
  const sev = riskSeverity(f.likelihood, f.impact);
  return `
    <div class="acc-card sim-finding">
      <div class="acc-head">
        <div class="icon-badge" style="--icon-accent:var(${SEVERITY_ACCENT[sev]});">${i+1}</div>
        <div>
          <h4>${f.title}</h4>
          <div class="acc-sub">Likelihood ${f.likelihood} × Impact ${f.impact} <span class="sim-sev-badge" style="color:var(${SEVERITY_ACCENT[sev]}-ink);border-color:var(${SEVERITY_ACCENT[sev]});">${sev}</span></div>
        </div>
      </div>
      <div class="acc-body">
        <p class="body-text">${f.body}</p>
        ${f.technique ? `<p class="sim-finding-technique">MITRE ${f.technique.id.startsWith('AML') ? 'ATLAS' : 'ATT&CK'}: <a href="${f.technique.url}" target="_blank" rel="noopener noreferrer">${f.technique.id} - ${f.technique.name}</a></p>` : ''}
      </div>
    </div>
  `;
}

function renderSimulatedEngagement(){
  const e = SIMULATED_ENGAGEMENT;
  const counts = { Critical:0, High:0, Medium:0, Low:0 };
  e.findings.forEach(f => counts[riskSeverity(f.likelihood, f.impact)]++);
  return `
    <div class="section-tile sim-engagement" id="sim-engagement">
      <div class="sample-banner sim-banner"><b>Simulated</b> A fictional engagement - a personal project built to demonstrate this platform's own assessment methodology - not a real company or a real historical incident.</div>
      <h3 class="section-h">Simulated Engagement: AI Security Assessment</h3>
      <p class="body-text">${e.summary}</p>
      <h4 class="sim-subhead">Architecture</h4>
      <p class="body-text">${e.architectureNote}</p>
      <div class="sim-arch-wrap">${renderSimulatedArchitecture()}</div>
      <h4 class="sim-subhead">Findings</h4>
      <p class="sim-severity-summary">${counts.Critical} Critical · ${counts.High} High · ${counts.Medium} Medium · ${counts.Low} Low</p>
      <div class="sim-findings-list">
        ${e.findings.map(renderSimulatedFinding).join('')}
      </div>
    </div>
  `;
}

function renderCaseStudyCard(c){
  // Markup and escaping live in src/ui/feed-cards.js (shared with the tests).
  return caseStudyCardHtml(c, { externalIcon: icon('external') });
}

export async function renderCaseStudyTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Learn From What Already Happened</div>
        <h2 class="page-title">Case Studies</h2>
        <p class="page-lede">Critical cybersecurity incidents - each one traces back to a gap this site is specifically built to catch before it becomes a headline.</p>
      </div>
      <div class="section-tile"><p class="body-text">Loading the latest…</p></div>
    </div>
  `;
  const { items } = await loadCaseStudiesData();
  if(!document.getElementById('tabContent')?.contains(container) && activeTab !== 'casestudy') return;

  const count = items.length;
  const countWord = SMALL_NUMBER_WORDS[count] || String(count);

  const restoreFocus = keepFocusAcrossRedraw(container);
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Learn From What Already Happened</div>
        <h2 class="page-title">Case Studies</h2>
        <p class="page-lede">${countWord.charAt(0).toUpperCase()}${countWord.slice(1)} critical cybersecurity incidents - each one traces back to a gap this site is specifically built to catch before it becomes a headline. This page covers two different things: real-world incidents that actually happened, and a simulated engagement - a personal project applying this same platform's methodology to a realistic AI deployment.</p>
      </div>

      <div class="section-tile sim-highlight">
        <div class="sim-highlight-row">
          <div>
            <h3 class="section-h" style="margin-top:0">Also on this page: a simulated engagement</h3>
            <p class="body-text">Alongside the real-world incidents below, I built a simulated AI security engagement - a personal project applying this platform's own assessment methodology to a realistic GenAI/RAG deployment, findings and all. It's clearly labeled as fictional throughout, not a real company or incident.</p>
          </div>
          <a class="cta-btn secondary sim-highlight-link" href="#sim-engagement">Take me there →</a>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Real-World Incidents</h3>
        <div class="case-grid">
          ${items.map(renderCaseStudyCard).join('')}
        </div>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaCaseAssess">See where you stand →</a>
          <a class="cta-btn secondary" href="${pathForTab('runbook')}" id="ctaCaseRunbook">See the matching runbooks</a>
        </div>
      </div>

      ${renderSimulatedEngagement()}
    </div>
  `;
  wireNavLink(document.getElementById('ctaCaseAssess'), 'assessment');
  wireNavLink(document.getElementById('ctaCaseRunbook'), 'runbook');
  wireAccordions(container.querySelector('.sim-engagement'));
  observeReveals();
  restoreFocus();
}
