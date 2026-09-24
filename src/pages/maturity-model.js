// Maturity Model page (/maturity-model).
import { PHASES } from "../content/maturity.js";
import { pathForTab, wireNavLink } from "../router.js";
import { STAGE_META, stageIllustration } from "./shared.js";

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

export function renderMaturityTab(container){
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
                  <td><span class="stage-chip" style="--stage-color:${STAGE_META[p.stage].color};--stage-ink:${STAGE_META[p.stage].ink}">${STAGE_META[p.stage].label}</span></td>
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
      <div class="stage-band" style="--stage-color:${meta.color};--stage-ink:${meta.ink}">
        <div class="stage-illustration stage-illustration-sm">${stageIllustration(stageId)}</div>
        <div><h3 class="stage-label">${meta.label}</h3><div class="stage-range">${meta.range}</div></div>
        <p>${meta.blurb}</p>
      </div>
    `;
    PHASES.filter(p=>p.stage===stageId).forEach(p=>{
      html += `
        <div class="phase-row" style="--phase-color:${meta.color};--phase-ink:${meta.ink}">
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
