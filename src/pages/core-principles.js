// Core Principles page (/core-principles).
import { CORE_PRINCIPLES } from "../content/maturity.js";
import { pathForTab, wireNavLink } from "../router.js";

export function renderCorePrinciplesTab(container){
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
