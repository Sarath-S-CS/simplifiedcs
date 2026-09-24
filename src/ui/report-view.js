// Renders the shared report model (../engine/report-model.js) as HTML for
// the results page and the example reports. Every value that can contain
// visitor text (answers, company name, "Other" text, tracking notes) goes
// through escapeHtml; links go through safeHttpUrl.
import { escapeHtml, safeHttpUrl } from "./html-safety.js";
import { FUNC_COLORS } from "../data/categories.js";
import { WEIGHT_LABELS, STATUS_LABELS } from "../data/controls.js";
import { TRACKING_STATUSES, TRACKING_STATUS_LABELS } from "../engine/action-tracking.js";

const e = escapeHtml;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function pctText(n) {
  return n === null || n === undefined ? "-" : `${n}%`;
}

export function verdictHtml(report) {
  const o = report.overall;
  const quick = report.mode === "quick";
  const stats = quick
    ? [
        ["In place", o.counts.met],
        ["Partly in place", o.counts.partial],
        ["Not in place", o.counts.gap],
        ["Not sure", o.counts.unknown],
        ["Not asked", o.counts["not-asked"]],
      ]
    : [
        ["Coverage", pctText(o.coverage), "How much of the protection you described is in place, weighted by how much each control matters."],
        ["Completeness", `${o.known} of ${o.applicable}`, "Applicable questions with a definite answer. \"Not sure\" and unanswered questions don't count toward coverage."],
        ["Critical gaps", report.criticalGaps.length],
        ["Not sure", o.counts.unknown],
      ];
  return `
    <section class="verdict-block verdict-${e(report.verdict.key)}" aria-labelledby="verdictLabel">
      <div class="verdict-eyebrow">${quick ? "Quick screening" : "Full assessment"} · Methodology ${e(report.methodologyVersion)}</div>
      <h3 class="verdict-label" id="verdictLabel">${e(report.verdict.label)}</h3>
      <p class="verdict-summary">${e(report.verdict.summary)}</p>
      <dl class="verdict-stats">
        ${stats.map(([k, v, hint]) => `<div class="verdict-stat"${hint ? ` title="${e(hint)}"` : ""}><dt>${e(k)}</dt><dd>${e(String(v))}</dd></div>`).join("")}
      </dl>
      ${quick ? "" : `<p class="scope-hint">Coverage is not a compliance score, and 100% doesn't mean risk-free. <a href="/methodology" class="inline-link">How this is scored</a></p>`}
    </section>`;
}

export function criticalHtml(report) {
  let out = "";
  if (report.criticalGaps.length) {
    out += `
      <section class="critical-list" aria-labelledby="criticalTitle">
        <h3 id="criticalTitle">Critical gaps (${report.criticalGaps.length}) - fix these first</h3>
        ${report.criticalGaps.map((c) => `<div class="flag-item"><b>${e(c.area)}:</b> ${e(c.reason)} <span class="scope-hint">Your answer: "${e(c.chosen)}"</span></div>`).join("")}
      </section>`;
  }
  if (report.verification.length) {
    out += `
      <section class="verify-list" aria-labelledby="verifyTitle">
        <h3 id="verifyTitle">Critical controls to confirm</h3>
        <p class="scope-hint">You answered "Not sure" for these. Each can decide whether an attack succeeds, so find out before relying on this reading.</p>
        <ul>${report.verification.map((v) => `<li><b>${e(v.area)}:</b> ${e(v.text)}</li>`).join("")}</ul>
      </section>`;
  }
  return out;
}

export function areasHtml(report) {
  const quick = report.mode === "quick";
  return `
    <section class="area-scores" aria-labelledby="areasTitle">
      <h3 id="areasTitle">${quick ? "Results by area (screening)" : "Coverage by area"}</h3>
      <div class="area-rows">
        ${report.areas
          .map((a) => {
            const c = a.counts;
            const detail = quick
              ? `${c.met} in place · ${c.partial} partly · ${c.gap} not in place${c.unknown ? ` · ${c.unknown} not sure` : ""}`
              : a.coverage === null
                ? a.applicable
                  ? "Not enough definite answers to score"
                  : "Not applicable"
                : `${a.known} of ${a.applicable} answered${c.unknown ? ` · ${c.unknown} not sure` : ""}`;
            return `
          <div class="area-row">
            <div class="area-name">${e(a.area)}</div>
            ${
              quick
                ? `<div class="area-counts">${c.gap + c.partial + c.unknown + c.met === 0 ? '<span class="status-chip">not asked</span>' : ""}${["gap", "partial", "unknown", "met"].map((s) => (c[s] ? `<span class="status-chip status-${s}">${c[s]} ${e(STATUS_LABELS[s].toLowerCase())}</span>` : "")).join("")}</div>`
                : `<div class="func-bar-track" role="img" aria-label="${e(a.area)} coverage ${pctText(a.coverage)}"><div class="func-bar-fill" style="width:${a.coverage ?? 0}%; background:${FUNC_COLORS[a.fn]}"></div></div>
                   <div class="area-pct">${pctText(a.coverage)}</div>`
            }
            ${quick ? "" : `<div class="area-detail">${e(detail)}</div>`}
          </div>`;
          })
          .join("")}
      </div>
    </section>`;
}

function chip(text, cls) {
  return `<span class="gap-tier ${cls}">${e(text)}</span>`;
}

function trackingForm(a, t = {}) {
  const id = e(a.id);
  const field = (name, label, type = "text", extra = "") =>
    `<label class="track-field"><span>${label}</span><input type="${type}" data-track="${id}" data-field="${name}" data-fkey="${id}-${name}" value="${e(t[name] || "")}" ${extra}></label>`;
  return `
    <fieldset class="track-form">
      <legend>Track this action <span class="opt-tag">saved in this browser only - doesn't change your score</span></legend>
      <div class="track-grid">
        <label class="track-field"><span>Status</span>
          <select data-track="${id}" data-field="status" data-fkey="${id}-status">
            ${TRACKING_STATUSES.map((s) => `<option value="${s}" ${(t.status || "open") === s ? "selected" : ""}>${e(TRACKING_STATUS_LABELS[s])}</option>`).join("")}
          </select>
        </label>
        ${field("owner", "Owner", "text", 'maxlength="500" placeholder="Name or role"')}
        ${field("due", "Due date", "date")}
        ${field("retest", "Retest date", "date")}
      </div>
      ${field("evidenceNote", "Evidence notes", "text", 'maxlength="500" placeholder="Where the evidence is kept"')}
      ${t.status === "risk-accepted" || t.riskAcceptance ? field("riskAcceptance", "Risk acceptance (who accepted it, why, until when)", "text", 'maxlength="500"') : ""}
    </fieldset>`;
}

function actionHtml(a, { tracking, interactive, links }) {
  const t = tracking[a.id] || {};
  const rows = [
    a.criticalReason ? ["Why it's critical", a.criticalReason] : null,
    ["Why it ranks here", a.reasons.join(" · ")],
    a.rationale ? ["What could go wrong", a.rationale] : null,
    a.technique ? ["Attack technique", `MITRE ATT&CK ${a.technique.id} - ${a.technique.name}`] : null,
    a.interim ? ["Interim step", a.interim] : null,
    a.durableFix ? ["Durable fix", a.durableFix] : null,
    ["Suggested owner", a.role],
    ["Evidence it's done", a.evidence],
    a.csf.length || a.cis.length ? ["Framework references", [a.csf.length ? `NIST CSF 2.0: ${a.csf.join(", ")}` : "", a.cis.length ? `CIS Controls v8.1: ${a.cis.join(", ")}` : ""].filter(Boolean).join(" · ")] : null,
  ].filter(Boolean);
  const ref = a.reference && safeHttpUrl(a.reference.url);
  const owasp = a.owasp && links?.playbook ? `<li><b>OWASP Top 10:</b> <a href="${e(links.playbook(a.owasp.ref))}" class="inline-link">${e(a.owasp.ref)} - ${e(a.owasp.title)}, with the matching Playbook</a></li>` : "";
  const statusChip = t.status && t.status !== "open" ? chip(TRACKING_STATUS_LABELS[t.status], "gap-tier-track") : "";
  return `
    <div class="acc-card action-card${a.critical ? " action-critical" : ""}" id="${e(a.id)}">
      <div class="acc-head">
        <div class="priority-rank" aria-label="Rank ${a.rank}">${String(a.rank).padStart(2, "0")}</div>
        <div class="action-head-text">
          <h4>${e(a.title)}</h4>
          <div class="acc-sub">${e(a.area)} · ${e(a.trigger)}</div>
          <div class="action-chips">
            ${a.critical ? chip("Critical gap", "gap-tier-3") : chip(WEIGHT_LABELS[a.weight], `gap-tier-${a.weight}`)}
            ${a.kind === "verify" ? chip("Verify", "gap-tier-verify") : ""}
            ${chip(`Effort: ${a.effortLabel}`, "gap-tier-1")}
            ${chip(`Target: ${a.timeframeDays} days`, "gap-tier-1")}
            ${statusChip}
          </div>
        </div>
        <div class="acc-chevron" aria-hidden="true">▸</div>
      </div>
      <div class="acc-body">
        <ul>
          ${rows.map(([k, v]) => `<li><b>${e(k)}:</b> ${e(v)}</li>`).join("")}
          ${owasp}
          ${ref ? `<li><b>Reference:</b> <a href="${ref}" target="_blank" rel="noopener noreferrer">${e(a.reference.label)}</a></li>` : ""}
        </ul>
        ${interactive ? trackingForm(a, t) : ""}
      </div>
    </div>`;
}

export function actionPlanHtml(report, { tracking = {}, interactive = false, links = null } = {}) {
  if (!report.actions.length) {
    return `<section class="action-plan" aria-labelledby="planTitle"><h3 id="planTitle">Action plan</h3><p class="body-text">No actions - every applicable control you answered is in place.</p></section>`;
  }
  const byId = new Map(report.actions.map((a) => [a.id, a]));
  const groups = [30, 60, 90].map((d) => ({ d, items: report.plan[d].map((id) => byId.get(id)) })).filter((g) => g.items.length);
  return `
    <section class="action-plan" aria-labelledby="planTitle">
      <h3 id="planTitle">Action plan - ${plural(report.actions.length, "action")}, ranked by risk</h3>
      <p class="scope-hint">Every gap, "Not sure" and finding in this report, ranked by how much it matters: how critical the control is, how far from in place it is, and whether it feeds a combined finding. Each says why it ranks where it does. Target timeframes are suggestions: 30 days for critical items and anything to confirm, 60 for high-impact, 90 for the rest.</p>
      ${groups
        .map(
          (g) => `
        <div class="plan-group">
          <h4 class="plan-heading">Within ${g.d} days <span class="plan-count">${plural(g.items.length, "action")}</span></h4>
          ${g.items.map((a) => actionHtml(a, { tracking, interactive, links })).join("")}
        </div>`
        )
        .join("")}
    </section>`;
}

export function flagsHtml(report, { links = null } = {}) {
  if (!report.flags.length) return "";
  return `
    <section class="flags" aria-labelledby="flagsTitle">
      <h3 id="flagsTitle">Combined findings - risks that compound</h3>
      ${report.flags
        .map((f) => {
          const g = f.guidance;
          const rows = g
            ? [
                g.traceability ? ["Why this was flagged", g.traceability] : null,
                g.technique ? ["Attack technique", `MITRE ATT&CK ${g.technique.id} - ${g.technique.name}`] : null,
                ["What could go wrong", g.explain],
                g.control ? ["Interim step", g.control] : null,
                g.remediation ? ["How to fix it", g.remediation] : null,
              ].filter(Boolean)
            : [];
          const ref = g?.reference && safeHttpUrl(g.reference.url);
          const actionLinks = f.inputs.filter((id) => report.actions.some((a) => a.id === `A-${id}`)).map((id) => `<a href="#A-${e(id)}" class="inline-link">A-${e(id)}</a>`);
          return `
          <div class="flag-item"><b>Combined finding -</b> ${e(f.text)}${actionLinks.length ? ` <span class="scope-hint">Actions: ${actionLinks.join(", ")}</span>` : ""}</div>
          ${
            rows.length
              ? `<div class="acc-card mitre-panel"><div class="acc-head"><div><h4>Why this matters, and what to do now</h4></div><div class="acc-chevron" aria-hidden="true">▸</div></div>
                 <div class="acc-body"><ul>${rows.map(([k, v]) => `<li><b>${e(k)}:</b> ${e(v)}</li>`).join("")}${
                   ref ? `<li><b>Reference:</b> <a href="${ref}" target="_blank" rel="noopener noreferrer">${e(g.reference.label)}</a></li>` : ""
                 }${g?.owasp && links?.playbook ? `<li><b>OWASP Top 10:</b> <a href="${e(links.playbook(g.owasp.ref))}" class="inline-link">${e(g.owasp.ref)} - ${e(g.owasp.title)}</a></li>` : ""}</ul></div></div>`
              : ""
          }`;
        })
        .join("")}
    </section>`;
}

export function notesHtml(report) {
  let out = "";
  if (report.contradictions.length) {
    out += `
      <section class="flags" aria-labelledby="contraTitle">
        <h3 id="contraTitle">Answers worth double-checking</h3>
        <p class="scope-hint">These answers don't fit together. They haven't changed any score - if one is wrong, go back and correct it.</p>
        ${report.contradictions.map((c) => `<div class="vendor-note-item">${e(c.text)}</div>`).join("")}
      </section>`;
  }
  if (report.informational.length) {
    out += `
      <section class="flags" aria-labelledby="infoTitle">
        <h3 id="infoTitle">Context notes (not scored)</h3>
        ${report.informational.map((n) => `<div class="vendor-note-item">${e(n.text)}</div>`).join("")}
      </section>`;
  }
  return out;
}

export function frameworksHtml(report) {
  if (!report.frameworkRecs.length) return "";
  return `
    <section class="flags" aria-labelledby="fwTitle">
      <h3 id="fwTitle">Compliance considerations</h3>
      ${report.frameworkRecs
        .map(
          (r) => `
        <div class="vendor-note-item">
          <b>${e(r.name)} -</b> ${e(r.summary)}
          <div class="fw-gap-list">
            ${r.gaps.map((g) => `<div class="fw-gap-item">Gap: <i>${e(g.question)}</i> - answered "${e(g.chosen)}". See <a href="#A-${e(g.id)}" class="inline-link">A-${e(g.id)}</a>.</div>`).join("")}
            ${r.unknown.map((g) => `<div class="fw-gap-item">Not sure: <i>${e(g.question)}</i></div>`).join("")}
            ${!r.gaps.length && !r.unknown.length ? `<div class="fw-gap-item">No gaps in the ${e(r.name)}-specific questions.</div>` : ""}
          </div>
        </div>`
        )
        .join("")}
      <p class="scope-hint">Pattern-based guidance from your own answers - not a certification audit or legal compliance determination.</p>
    </section>`;
}

export function vendorNotesHtml(report) {
  if (!report.vendorNotes.length) return "";
  return `
    <section class="flags" aria-labelledby="vendorTitle">
      <h3 id="vendorTitle">Vendor-specific notes</h3>
      ${report.vendorNotes.map((v) => `<div class="vendor-note-item"><b>${e(v.vendor)} -</b> ${e(v.note)}</div>`).join("")}
      <p class="scope-hint">General guidance about named products, written in advance - not a live feed and not a check of your versions. For a current check, use AI-enhanced insights below or the vendor's own advisories.</p>
    </section>`;
}

export function snapshotHtml(report) {
  if (!report.snapshot.length) return "";
  return `
    <section class="snapshot" aria-labelledby="snapTitle">
      <h3 id="snapTitle">Environment snapshot (self-reported)</h3>
      ${report.snapshot.map(([k, v]) => `<div class="snapshot-row"><div class="skey">${e(k)}</div><div>${e(v)}</div></div>`).join("")}
    </section>`;
}

export function limitationsHtml(report) {
  return `
    <section class="note-box" aria-labelledby="limitsTitle">
      <b id="limitsTitle">Limitations of this reading</b>
      <ul class="limitations">${report.limitations.map((l) => `<li>${e(l)}</li>`).join("")}</ul>
      <p class="scope-hint">Methodology ${e(report.methodologyVersion)}, question set ${e(report.questionSetVersion)}. <a href="/methodology" class="inline-link">How scoring works</a> · <a href="/privacy" class="inline-link">What's stored and where</a></p>
    </section>`;
}

// The whole deterministic report, in the same order as the PDF.
export function reportBodyHtml(report, opts = {}) {
  return [
    verdictHtml(report),
    criticalHtml(report),
    areasHtml(report),
    actionPlanHtml(report, opts),
    flagsHtml(report, opts),
    notesHtml(report),
    frameworksHtml(report),
    vendorNotesHtml(report),
    snapshotHtml(report),
    limitationsHtml(report),
  ].join("");
}
