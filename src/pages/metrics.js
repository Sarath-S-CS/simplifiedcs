// Metrics page (/metrics).
import { SCORE_RUBRIC } from "../content/maturity.js";
import { pathForTab, wireNavLink } from "../router.js";
import { buildScoringRubricSvg } from "./shared.js";

export function renderMetricsTab(container){
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
        <h3 class="section-h">How the score is calculated (methodology 2.0)</h3>
        <p class="body-text">Every answer resolves to one status: <b>in place</b>, <b>partly in place</b>, <b>not in place</b>, <b>not sure</b>, <b>not applicable</b>, or <b>not asked</b> (Quick screening). Only the first three are graded: in place earns 2 points, partly 1, not in place 0.</p>
        <p class="body-text"><b>Coverage</b> is the points earned divided by the points possible over the controls you answered definitely, with each control weighted by importance - 3 for critical controls, 2 for high-impact, 1 for standard. It is computed across all controls at once, not averaged across the six areas. <b>Completeness</b> is how many applicable questions have a definite answer. "Not sure" never counts as "No": it is excluded from coverage and listed as something to confirm.</p>
        <p class="body-text">Setup answers that describe a control - network segmentation, DevSecOps gates, secrets handling, container and hypervisor hardening, OT segregation and monitoring - are scored like any other control. Combined findings (risky combinations of answers) and the risk ranking are explained on the <a href="${pathForTab('methodology')}" id="linkMethodFromMetrics1" class="inline-link">Methodology</a> page. The methodology version is recorded on every report, and History only compares reports made with the same version and mode.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Reading your score</h3>
        <p class="body-text">The reading is decided by rules in a fixed order, and the percentage only matters once the earlier rules pass: any critical gap gives <b>Critical gaps found</b>; otherwise an unverified critical control gives <b>Verification needed</b>; otherwise fewer than 60% definite answers gives <b>Incomplete picture</b>; only then do the coverage bands apply. Quick screening never gives a band - it reports critical gaps or "No critical gaps in this screening".</p>
        <div class="verdict-scale">
          <div class="verdict-cell"><div class="vrange">below 40%</div><div class="vlabel" style="color:var(--accent-critical)">High exposure</div></div>
          <div class="verdict-cell"><div class="vrange">40–64%</div><div class="vlabel" style="color:var(--accent-amber-ink)">Elevated exposure</div></div>
          <div class="verdict-cell"><div class="vrange">65–84%</div><div class="vlabel">Moderate exposure</div></div>
          <div class="verdict-cell"><div class="vrange">85% or more</div><div class="vlabel" style="color:var(--accent-secure-ink)">Strong foundations</div></div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">What each reading means</h3>
        <p class="body-text">In the order they are checked. For how each phase of the <a href="${pathForTab('maturity')}" id="linkMaturityFromMetrics" class="inline-link">Maturity Model</a> connects to this, see that page directly.</p>
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
        <p class="body-text">Completed assessments are saved in your browser (if it allows storage). Your next report shows what changed since the previous one made with the same methodology and mode: the coverage change, and which findings were resolved or are new. Reports from an earlier methodology are kept, labelled, and not compared directly.</p>
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
