// Threat Modeling page (/threat-modeling).
import { wireAccordions } from "../ui/a11y.js";
import { pathForTab, wireNavLinksByDataset } from "../router.js";
import { icon, accentIconStyle } from "./shared.js";

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
  { id:'tm-methodologies', icon:'cycle', title:'How organizations do it - STRIDE, PASTA, and other real methodologies', body:`
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

export function renderThreatModelingTab(container){
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
