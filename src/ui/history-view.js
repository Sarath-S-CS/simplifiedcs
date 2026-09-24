// The History page: reports saved in this browser (../engine/run-history.js).
// Only comparable runs - same methodology and mode - are charted together;
// reports from the earlier methodology are listed with their original
// result and labelled, never re-scored in place.
import { listRuns, deleteRun } from "../engine/run-history.js";
import { clearAllLocalData } from "../engine/local-data.js";
import { METHODOLOGY_VERSION } from "../data/controls.js";
import { INDUSTRIES } from "../data/industries.js";
import { escapeHtml } from "./html-safety.js";

const e = escapeHtml;

function trendSvg(runs) {
  const w = 600;
  const h = 120;
  const pad = 20;
  const pts = runs.map((r, i) => [pad + (runs.length === 1 ? 0 : (i / (runs.length - 1)) * (w - 2 * pad)), h - pad - (r.summary.coverage / 100) * (h - 2 * pad)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return `<svg class="trend-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Coverage over time for full assessments: ${runs.map((r) => `${r.summary.coverage}%`).join(", ")}">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--line)" stroke-width="1"/>
    <path d="${d}" fill="none" stroke="var(--accent-secure)" stroke-width="2"/>
    ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--accent-secure)"/>`).join("")}
  </svg>`;
}

function rowResult(r) {
  if (r.legacy) return `<span class="history-score">${e(String(r.legacyOverall))}%</span> <span class="scope-hint">earlier method (1.x)</span>`;
  const s = r.summary;
  return `<span class="history-score">${e(s.verdict.label)}</span>${s.mode === "full" && s.coverage !== null ? ` <span class="scope-hint">${s.coverage}% coverage</span>` : ""}${s.methodologyVersion !== METHODOLOGY_VERSION ? ` <span class="scope-hint">method ${e(s.methodologyVersion)}</span>` : ""}`;
}

export function renderHistoryPage({ panel, pathForTab, wireNavLink, openRun, goToAssessment, onChange }) {
  const runs = listRuns();
  const comparable = runs.filter((r) => !r.legacy && r.summary?.mode === "full" && r.summary.methodologyVersion === METHODOLOGY_VERSION && r.summary.coverage !== null);
  panel.innerHTML = `
    <div class="page-intro">
      <div class="page-eyebrow">History</div>
      <h2 class="page-title" tabindex="-1">Assessment history</h2>
      <p class="page-lede">${runs.length} report${runs.length === 1 ? "" : "s"} saved in this browser only. Nothing here is sent to a server; clearing your browser's site data removes it. <a href="/privacy" class="inline-link">What's stored</a></p>
    </div>
    <div class="section-tile">
      ${comparable.length >= 2 ? `<h3 class="section-h">Coverage over time (Full assessments, methodology ${e(METHODOLOGY_VERSION)})</h3>${trendSvg(comparable)}` : ""}
      <ul class="history-list">
        ${
          runs.length
            ? runs
                .slice()
                .reverse()
                .map((r) => {
                  const industry = r.summary?.industry || INDUSTRIES.find((i) => i.id === r.industry)?.label || "";
                  return `
          <li class="history-row">
            <div>${e(new Date(r.ts).toLocaleDateString())} ${e(new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}${industry ? ` · ${e(industry)}` : ""} · ${r.mode === "quick" ? "Quick screening" : "Full"}${r.ai ? " · AI insights" : ""}</div>
            <div class="history-row-actions">
              <div>${rowResult(r)}</div>
              ${r.answers ? `<button type="button" class="history-view-btn" data-run="${e(r.id)}">View report →</button>` : ""}
              <button type="button" class="history-view-btn" data-delete="${e(r.id)}" aria-label="Delete the report from ${e(new Date(r.ts).toLocaleString())}">Delete</button>
            </div>
          </li>`;
                })
                .join("")
            : '<li class="body-text">No reports saved yet - complete an assessment to start tracking.</li>'
        }
      </ul>
      <div class="cta-row">
        <a class="cta-btn" href="${pathForTab("assessment")}" id="backToScope">← Back to Assessment</a>
        <button type="button" class="cta-btn secondary" id="clearAllData">Clear all data stored by this site</button>
      </div>
      <p class="scope-hint">"Clear all data" removes saved reports, any in-progress assessment, action tracking, and your cookie and AI choices from this browser.</p>
    </div>`;
  wireNavLink(document.getElementById("backToScope"), "assessment");
  panel.querySelectorAll("[data-run]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (openRun(btn.dataset.run)) goToAssessment();
    })
  );
  panel.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (!confirm("Delete this saved report from this browser? This can't be undone.")) return;
      deleteRun(btn.dataset.delete);
      onChange();
    })
  );
  document.getElementById("clearAllData").addEventListener("click", () => {
    if (!confirm("Remove everything SimplifiedCS has stored in this browser - saved reports, in-progress answers, action tracking, and your cookie and AI choices? This can't be undone.")) return;
    const n = clearAllLocalData();
    onChange();
    alert(n ? "All SimplifiedCS data in this browser has been removed." : "There was nothing stored to remove.");
  });
}
