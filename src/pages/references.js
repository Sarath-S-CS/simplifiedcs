// References page (/references).
import { REFERENCES } from "../content/learning.js";
import { icon } from "./shared.js";

export function renderReferencesTab(container){
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
