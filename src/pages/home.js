// Home page (/).
import { STAGE_DETAIL, RISK_SCORE_DESCRIPTIONS } from "../content/maturity.js";
import { pathForTab, wireNavLink, wireNavLinksByDataset } from "../router.js";
import { icon, STAGE_META, stageIllustration, buildFrameworkStamps, buildScoringRubricSvg } from "./shared.js";

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
      <span style="color:var(--accent-signal-ink)">Discover</span>
      <span style="color:var(--accent-secure-ink)">Transform</span>
      <span style="color:var(--accent-violet-ink)">Optimize</span>
    </div>
  </div>`;
}

const SITE_TILES = [
  { tab:'methodology', icon:'register', title:'Methodology', desc:'Exactly how scoring and adaptive questions work.' },
  { tab:'maturity', icon:'cycle', title:'Maturity Model', desc:'The 10-phase journey and NIST\'s own maturity tiers.' },
  { tab:'coreprinciples', icon:'route', title:'Core Principles', desc:'The cybersecurity philosophy this site is built on.' },
  { tab:'runbook', icon:'document', title:'Runbooks', desc:'IR plans, backup/DR, and step-by-step incident runbooks.' },
  { tab:'news', icon:'signal', title:'Trends & News', desc:'Current threats, AI-in-security developments, and where to keep learning.' },
  { tab:'casestudy', icon:'urgent', title:'Case Studies', desc:'Stuxnet, SolarWinds, Equifax, and other critical incidents - plus a simulated AI security engagement.' },
  { tab:'playbooks', icon:'checklist', title:'Playbooks', desc:'OWASP Top 10 and AI-threat playbooks, mapped to MITRE ATT&CK.' },
  { tab:'roadmap', icon:'clock', title:'Roadmap', desc:'What\'s shipped, in progress, and planned for this site itself.' },
];

const HOW_IT_WORKS = [
  { n:'01', title:'Data Collection', tagline:'Know exactly where you stand', icon:'checklist',
    desc:'Answer an adaptive questionnaire shaped by your industry and infrastructure - only relevant questions appear, including a dedicated AI Readiness & Governance track, and all six NIST CSF functions are scored individually.' },
  { n:'02', title:'Analysis', tagline:'See risks a checklist would miss', icon:'analysis',
    desc:'Every answer is cross-referenced against every other answer, so compounding risk gets flagged instead of scored in isolation - with vendor-specific mitigation notes wherever you\'ve named a product.' },
  { n:'03', title:'Recommendation', tagline:'Know what to fix first', icon:'ranked',
    desc:'A ranked, prioritized action list, not a wall of findings - each item tied to why it matters more than the rest, and mapped back to the specific control it strengthens.' },
  { n:'04', title:'Transformation', tagline:'Prove the change actually worked', icon:'cycle',
    desc:'Implement fixes using the matching Runbook or Playbook, then re-assess on a cadence to track real progress and see the score delta since your last run.' },
];

const START_LINKS = [
  { title:'Getting Started With Cybersecurity Controls', desc:'The plain-language on-ramp before you touch the assessment', tab:'starterguide', icon:'route' },
  { title:'Current Trends', desc:'This site\'s own curated threat-landscape roundup', tab:'news', icon:'signal' },
  { title:'Exploits', desc:'Confirmed actively-exploited CVEs, scored by real-world risk', tab:'exploits', icon:'urgent' },
  { title:'Runbooks', desc:'Incident runbooks and foundational documents', tab:'runbook', icon:'document' },
  { title:'Threat Modeling & Forensics', desc:'How to think ahead of an attacker, and how to reconstruct what happened after one', tab:'threatmodeling', icon:'shield' },
  { title:'Check Your Own Configuration', desc:'Free vendor and open-source tools to test your actual product security baseline - not just answer questions about it', tab:'securitytools', icon:'register' },
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

// Scroll-driven assembly for the Three Phases section. Desktop pins
// .phases-stage (position:sticky in CSS) while the user scrolls through
// .phasesRunway's fixed height; each phase card slides in from the right
// and settles into its slot in the row as its own scroll threshold is
// crossed. The reveal is bidirectional - scrolling back up past a card's
// threshold hides it again - so scrolling back to the top of the page
// always finds the section in its original, pre-scroll state instead of
// permanently stuck mid-assembly. Mobile has no meaningful scroll-driven
// moment for a single-column list, so it falls back to showing everything
// immediately, no pinning (see the max-width:760px rule in app.css).
function wirePhasesAssembly(container){
  const runway = container.querySelector('#phasesRunway');
  if(!runway) return;
  const cards = [...container.querySelectorAll('.phase-card')];
  const arrows = [...container.querySelectorAll('.phase-arrow')];
  const methodLink = container.querySelector('.phases-stage .method-link-row');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDesktop = window.matchMedia('(min-width:761px)').matches;
  const n = cards.length;

  if(reduceMotion || !isDesktop){
    cards.forEach(c=>c.classList.add('in'));
    arrows.forEach(a=>a.classList.add('in'));
    if(methodLink) methodLink.classList.add('in');
    return;
  }

  // Fixed constants matching .phases-stage's CSS top offset and its own
  // approximate rendered height - not read live from the DOM, so the
  // detail panel opening (which grows .phases-stage) can never feed back
  // into this calculation. STAGE_HEIGHT includes the section title, intro
  // paragraph, and the "Explore the full Maturity Model" link now that
  // they all live inside .phases-stage - the title stays pinned alongside
  // the cards instead of scrolling out of view before they finish
  // assembling, and the link becomes visible together with the last
  // (Optimize) card instead of only after scrolling past the whole runway.
  const STAGE_TOP = 96, STAGE_HEIGHT = 470;
  const bandWidth = 1 / n;
  function update(){
    const rect = runway.getBoundingClientRect();
    const total = runway.offsetHeight - STAGE_HEIGHT;
    const scrolled = Math.min(Math.max(STAGE_TOP - rect.top, 0), total);
    const progress = total > 0 ? scrolled / total : 0;

    // toggle, not add-only - a card is "in" exactly when the current
    // scroll progress is past its threshold, so scrolling back up hides
    // it again instead of leaving the section permanently assembled.
    // Card 0 (Discovery) is the exception: it's already marked "in" in
    // the markup itself, so the section never looks empty the moment you
    // reach it, and it stays that way regardless of scroll position.
    cards.forEach((c,i)=>{ if(i===0) return; c.classList.toggle('in', progress > i * bandWidth + bandWidth * 0.15); });
    arrows.forEach((a,i)=>{ a.classList.toggle('in', progress > (i + 1) * bandWidth + bandWidth * 0.05); });
    // same threshold as the last card - the link appears exactly when
    // the Optimize tile does, not after further scrolling.
    if(methodLink) methodLink.classList.toggle('in', progress > (n - 1) * bandWidth + bandWidth * 0.15);
  }
  window.addEventListener('scroll', update, { passive:true });
  update();
}

export function renderHomeTab(container){
  const stageOrder = ['discovery','transformation','optimization'];
  container.innerHTML = `
    <div class="page">
      <div class="hero-banner">
        <div class="hero-banner-inner">
          <h2 class="page-title">Cybersecurity posture assessment, made simple.</h2>
          <p class="page-lede">Answer adaptive questions about how your organization is set up. Get a prioritized reading of your cybersecurity, referenced to NIST CSF 2.0 and CIS Controls, and a ranked action plan. A 14-question Quick screening or a Full assessment - it runs in your browser, and your answers stay there unless you choose otherwise.</p>
          <div class="hero-links">
            <a href="${pathForTab('assessment')}" id="heroTakeAssessment" class="link-pill"><span class="link-pill-icon">${icon('checklist')}</span>Take the assessment</a>
            <a href="#how-it-works" class="link-pill secondary"><span class="link-pill-icon">${icon('route')}</span>How it works</a>
          </div>
          <p class="hero-trust">It's a structured self-assessment from your own answers - not a scan, audit or certification. <a href="/assessment/sample" class="inline-link">See example reports</a> · <a href="/methodology" class="inline-link">How scoring works</a> · <a href="/privacy" class="inline-link">Privacy</a></p>
        </div>
        ${buildHeroInfinity()}
      </div>

      <div class="section-tile">
        <h3 class="section-h" id="how-it-works">How it works</h3>
        <p class="body-text">Four steps, start to finish - and then it runs again.</p>
        <div class="hiw-grid">
          ${HOW_IT_WORKS.map((s,i)=>`
            <div class="hiw-item" style="transition-delay:${(i*0.1).toFixed(2)}s">
              <div class="hiw-icon">${icon(s.icon)}</div>
              <h4>${s.n} &middot; ${s.title}</h4>
              <p>${s.desc}</p>
              <span class="hiw-outcome">Outcome: ${s.tagline}</span>
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
        <div class="phases-runway" id="phasesRunway">
          <div class="phases-stage">
            <h3 class="section-h">The three phases of the assessment</h3>
            <p class="body-text">Every assessment moves through three stages as a continuous workflow - scroll to watch them unfold, or select a stage for a quick summary of what it involves.</p>
            <div class="phases-row">
              ${stageOrder.map((sid,i)=>`
                ${i>0 ? `<div class="phase-arrow" data-arrow-index="${i-1}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>` : ''}
                <div class="phase-card${i === 0 ? ' in' : ''}" data-stage-detail="${sid}" data-phase-index="${i}" style="border-top:2px solid ${STAGE_META[sid].color}">
                  <div class="workflow-phase-tag">Phase ${i+1}</div>
                  <div class="stage-illustration">${stageIllustration(sid)}</div>
                  <h4 style="color:${STAGE_META[sid].ink}">${STAGE_META[sid].label}</h4>
                  <p>${STAGE_META[sid].blurb}</p>
                </div>
              `).join('')}
            </div>
            <div class="stage-detail-panel" id="stageDetailPanel" style="display:none;"></div>
            <div class="method-link-row">
              <a href="${pathForTab('maturity')}" id="linkMaturityExplore" class="link-pill secondary"><span class="link-pill-icon">${icon('cycle')}</span>Explore the full Maturity Model</a>
            </div>
          </div>
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
  wirePhasesAssembly(container);

  let openStageDetail = null;
  function closeStageDetail(){
    const panel = document.getElementById('stageDetailPanel');
    if(!panel) return;
    panel.classList.remove('open');
    openStageDetail = null;
    container.querySelectorAll('[data-stage-detail]').forEach(c=>c.classList.remove('stage-active'));
    const tile = panel.closest('.section-tile');
    if(tile) tile.classList.remove('has-open-overlay');
    setTimeout(()=>{ if(!panel.classList.contains('open')) panel.style.display = 'none'; }, 300);
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
      // Desktop keeps the panel's one fixed home - a normal in-flow sibling
      // right after .phases-row, inside the sticky .phases-stage, so it
      // never drifts under the cursor during the scroll-linked reveal (see
      // wirePhasesAssembly above) - regardless of which card in the row was
      // clicked, "below the row" reads fine since the row is horizontal.
      // Below the 761px breakpoint, wirePhasesAssembly's own isDesktop check
      // already disables that scroll-linked reveal entirely and cards stack
      // in a column instead, where "below the row" actually means "below
      // Optimize" no matter which card you clicked - so on mobile the panel
      // is re-parented to sit directly after the clicked card instead,
      // reusing the exact same breakpoint wirePhasesAssembly already checks.
      const isDesktop = window.matchMedia('(min-width:761px)').matches;
      const phasesRow = container.querySelector('.phases-row');
      if(isDesktop && phasesRow){
        phasesRow.insertAdjacentElement('afterend', panel);
      } else {
        el.insertAdjacentElement('afterend', panel);
      }
      const openTile = el.closest('.section-tile');
      if(openTile) openTile.classList.add('has-open-overlay');
      panel.innerHTML = `
        <h4 style="color:${STAGE_META[sid].ink}">${STAGE_META[sid].label}</h4>
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
    if(openStageDetail && !e.target.closest('.phases-row') && !e.target.closest('.stage-detail-panel')){
      closeStageDetail();
    }
    if(riskDesc.classList.contains('open') && !e.target.closest('.risk-slider-wrap')){
      closeRiskDesc();
    }
  });
  // On desktop the panel is a normal in-flow sibling of .phases-row (inside
  // the sticky .phases-stage), so it doesn't drift under the cursor during
  // scroll; on mobile it's re-parented next to whichever card opened it
  // (see the click handler above). Either way it only needs to close on an
  // outside click, same as riskDesc - .closest('.phases-row') still finds
  // it correctly once mobile nests it inside that same row.

  container.querySelectorAll('.risk-slider-tick').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      // CONSOLIDATED-WORK-BRIEF.md §1a: re-clicking the already-selected
      // tick used to just replay the same open animation with identical
      // content - standard toggle behavior means it should close instead.
      if(btn.classList.contains('active')){
        btn.classList.remove('active');
        closeRiskDesc();
        return;
      }
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
