// Glossary page (/glossary).
import { GLOSSARY } from "../content/learning.js";

export function renderGlossaryTab(container){
  const sorted = [...GLOSSARY].sort((a,b)=> a.term.localeCompare(b.term));
  const groups = {};
  sorted.forEach(g=>{
    const letter = g.term[0].toUpperCase();
    (groups[letter] = groups[letter] || []).push(g);
  });
  const letters = Object.keys(groups).sort();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">Glossary</h2>
        <p class="page-lede">Every cybersecurity term used across this site, defined in plain language and sorted alphabetically.</p>
      </div>
      <div class="section-tile">
        <div class="alpha-index">
          ${alphabet.map(l=> groups[l]
            ? `<a class="alpha-chip" href="#gl-${l}">${l}</a>`
            : `<span class="alpha-chip disabled">${l}</span>`).join('')}
        </div>
        ${letters.map(l=>`
          <div class="glossary-letter-group" id="gl-${l}">
            <div class="glossary-letter">${l}</div>
            ${groups[l].map(g=>`
              <div class="glossary-entry"><b>${g.term}</b><span>${g.def}</span></div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
