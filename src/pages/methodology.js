// Methodology page (/methodology).
import { FUNCTIONS, FUNC_COLORS } from "../data/categories.js";
import { pathForTab, wireNavLink } from "../router.js";
import { buildFrameworkStamps } from "./shared.js";

export function renderMethodologyTab(container){
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
        <p class="body-text">Each answer is graded in place / partly / not in place, or recorded as "Not sure" or not applicable (both excluded from the percentage). Coverage is weighted by how critical each control is, and any critical gap sets the reading before any percentage does. The full breakdown of exactly how that's calculated, what each score band means, and how to read your result lives on the <a href="${pathForTab('metrics')}" id="linkMetricsFromMethod" class="inline-link">Metrics</a> page.</p>
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
        <h3 class="section-h">AI Readiness & Governance, scored the same way as everything else</h3>
        <p class="body-text">A short scoping section - do you use AI tools, and how - determines which AI-specific questions actually apply, the same "nobody answers questions that don't apply to them" principle used everywhere else in this assessment. The questions that do apply aren't a separate bolted-on section: they're real, scored questions inside the same six-function model above, weighted into <b>Protect</b> and <b>Govern</b> exactly like any other question, following EC-Council's Adopt/Defend/Govern (ADG) framework's three-pillar structure. Where a genuine MITRE mapping exists - over-permissioned retrieval in a custom RAG application, indirect prompt injection via a malicious document - it's cited the same way every other finding on this site is, including MITRE ATLAS's AI-specific technique catalog where ATT&amp;CK's enterprise matrix doesn't have an equivalent, never stretched onto something it doesn't actually describe. And a small number of questions - like whether security awareness training addresses AI-generated phishing and voice/video impersonation - are asked of everyone, regardless of whether your organization has adopted AI itself, since defending against AI-powered adversaries doesn't require having adopted AI yourself. The compounding-risk cross-checking described above applies here too: a custom AI application that retrieves internal data without respecting existing permissions, combined with no named owner for AI-related risk, is flagged as its own finding for exactly the same reason unenforced MFA plus unreviewed vendors is - the combination is what actually matters, not either gap in isolation.</p>
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
