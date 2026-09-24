// Roadmap page (/roadmap).

// SITE_LAST_UPDATED is the real build date, written by scripts/build.js
// into a <meta name="site-updated"> tag in the page (not into the
// JavaScript, so the hashed bundle stays byte-identical between builds of
// the same source). Don't reintroduce a literal date string here; that's
// exactly the failure mode ROADMAP-FIX-BRIEF.md flagged.
const SITE_LAST_UPDATED = document.querySelector('meta[name="site-updated"]')?.content || "recently";

// This page has three required sections - Shipped, In Progress, Planned -
// each with its own array below and its own render block in
// renderRoadmapTab(). A prior edit (b217a47) removed two of the three
// sections while only meaning to clear a stale In Progress entry, and the
// page silently ran with one section for days before anyone caught it (see
// ROADMAP-FIX-BRIEF.md). Before committing any change to ONE of these
// arrays, confirm the other two still exist and still render.
const ROADMAP_SHIPPED = [
  { module:'Adaptive Assessment Engine', desc:'Rebuilt on a data-driven decision graph - sequenced team-structure questions, containerization/virtualization as its own independent branch, per-framework question injection across all eight supported frameworks, and a session-wide de-dup engine so no branch ever asks the same thing twice.' },
  { module:'AI Readiness & Governance Track', desc:'A dedicated question track following EC-Council\'s Adopt/Defend/Govern framework - scoping how AI actually shows up in your environment (licensed platforms, embedded vendor features, custom RAG apps), over-permissioned-retrieval and AI-generated-code review questions where they apply, and defenses against AI-powered social engineering (deepfake/voice-impersonation-aware training, out-of-band verification) for every organization, regardless of whether it has adopted AI itself. Partially fulfills the Cyber Threat Intelligence item below - AI-specific threat coverage is now real, not just planned.' },
  { module:'AI-Enhanced Insights', desc:'A live, opt-in second pass on your completed results: checks your named vendors/products against CISA\'s KEV catalog and NVD\'s CVE database for anything current a fixed rule set can\'t know by nature, plus a look for patterns this specific answer combination raises beyond it. Clearly labeled as AI-generated - the deterministic report above it is already complete either way.' },
  { module:'MITRE ATT&CK Guidance Panel', desc:'A "why this matters, and what to do now" expander under each compounding-risk flag and low-scoring priority item, mapping to a real MITRE ATT&CK technique plus a compensating control computed from your own answers.' },
  { module:'Compounding-Risk Detection', desc:'Cross-answer flagging for dangerous combinations, not just per-question scoring.' },
  { module:'Vendor-Aware Mitigation Notes', desc:'Illustrative guidance for named products, entered via dropdown + "Other" across every vendor field in the questionnaire.' },
  { module:'PDF Report Export', desc:'A real, programmatically-built PDF of your results - selectable/searchable text, not a screenshot.' },
  { module:'Runbooks & Playbooks', desc:'8 incident runbooks plus 16 OWASP/AI-mapped attack-type playbooks, each with MITRE ATT&CK/ATLAS references and equal-depth, actionable steps.' },
  { module:'Case Studies', desc:'Real critical cybersecurity incidents, each tied back to a specific gap this tool is built to catch.' },
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
  { module:'Cyber Threat Intelligence', desc:'Deeper, structured threat-intelligence analysis - threat actor behavior, campaign tracking, industry-specific context - beyond what the curated Trends & News feed currently provides. The AI Readiness & Governance track above already covers the AI-specific slice of this (prompt injection, AI-powered social engineering); this item is the broader, non-AI-specific threat-intel capability still ahead.' },
  { module:'Social Engineering Simulation Tools', desc:'Letting IT administrators test their own employees against realistic phishing and social-engineering scenarios, turning the concept the Starter Guide already introduces under phishing simulation into an actual feature.' },
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

export function renderRoadmapTab(container){
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
