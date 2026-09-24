// Playbooks page (/playbooks).
import { PLAYBOOKS } from "../content/playbooks.js";
import { wireAccordions } from "../ui/a11y.js";
import { icon, prefersReducedMotion, accentIconStyle } from "./shared.js";

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

export function renderPlaybooksTab(container){
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
      <div class="acc-head" id="${p.ref}">
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
