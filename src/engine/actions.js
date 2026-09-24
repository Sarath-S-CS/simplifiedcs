// The action register: one action per finding, in risk order, with what to
// do now, what fixes it properly, who usually owns it, how big it is, when
// to aim for, and what evidence shows it's done. Built from the findings
// register (scoring.js computeFindings) plus the catalog (controls.js) and
// guidance text (mitre-guidance.js). Pure data - exported as CSV/JSON and
// rendered by the web report and the PDF alike.
//
// Action ids are stable across runs ("A-" + control id), so progress a
// visitor tracks in this browser (./action-tracking.js) follows the same
// control from one assessment to the next.
import { CONTROL_META, PROFILE_CONTROLS, FINDING_ITEMS, EFFORT_LABELS } from "../data/controls.js";
import { guidanceForGapItem } from "./mitre-guidance.js";

export function actionId(findingId) {
  return `A-${findingId}`;
}

// Timeframes are targets, not deadlines we can know: 30 days for critical
// gaps, critical-weight controls and anything that only needs confirming;
// 60 for high-impact; 90 for the rest.
export function timeframeFor(finding) {
  if (finding.kind === "verify") return 30;
  if (finding.critical || finding.weight === 3) return 30;
  if (finding.weight === 2) return 60;
  return 90;
}

function catalogAction(id) {
  return (CONTROL_META[id] || PROFILE_CONTROLS[id] || FINDING_ITEMS[id])?.action || null;
}

export function buildActions(findings, answers) {
  return findings.map((f) => {
    const cat = catalogAction(f.id) || { title: f.title, role: "IT lead", effort: "medium", evidence: "" };
    const g = guidanceForGapItem(f, answers, true);
    const verify = f.kind === "verify";
    return {
      id: actionId(f.id),
      findingId: f.id,
      rank: f.rank,
      kind: f.kind,
      area: f.area,
      fn: f.fn,
      title: verify ? `Find out: ${f.question}` : cat.title,
      trigger: verify ? `Answered "Not sure" to: ${f.question}` : `${f.question} - your answer: "${f.chosen}"`,
      criticalReason: f.criticalReason,
      rationale: g?.explain || "",
      interim: verify ? "Ask whoever runs this area (internal IT or your provider) and record the answer and how you know." : g?.control || "",
      durableFix: g?.remediation || "",
      role: cat.role,
      effort: verify ? "low" : cat.effort,
      effortLabel: EFFORT_LABELS[verify ? "low" : cat.effort],
      timeframeDays: timeframeFor(f),
      evidence: cat.evidence,
      weight: f.weight,
      critical: f.critical,
      reasons: f.reasons,
      csf: f.csf,
      cis: f.cis,
      traceability: g?.traceability || null,
      technique: g?.technique || null,
      reference: g?.reference || null,
      owasp: g?.owasp || null,
    };
  });
}

export function planByTimeframe(actions) {
  const plan = { 30: [], 60: [], 90: [] };
  for (const a of actions) plan[a.timeframeDays].push(a.id);
  return plan;
}

// ---------- export ----------
const CSV_COLUMNS = [
  ["ID", (a) => a.id],
  ["Rank", (a) => a.rank],
  ["Action", (a) => a.title],
  ["Area", (a) => a.area],
  ["Type", (a) => (a.kind === "verify" ? "Verify" : a.kind === "finding" ? "Finding" : "Control gap")],
  ["Critical", (a) => (a.critical ? "Yes" : "No")],
  ["Trigger", (a) => a.trigger],
  ["Why it matters", (a) => [a.criticalReason, a.rationale].filter(Boolean).join(" ")],
  ["Interim step", (a) => a.interim],
  ["Durable fix", (a) => a.durableFix],
  ["Suggested owner role", (a) => a.role],
  ["Effort", (a) => a.effortLabel],
  ["Target (days)", (a) => a.timeframeDays],
  ["Evidence of completion", (a) => a.evidence],
  ["NIST CSF 2.0", (a) => a.csf.join(" ")],
  ["CIS Controls v8.1", (a) => a.cis.join(" ")],
  ["Owner", (a, t) => t.owner],
  ["Due date", (a, t) => t.due],
  ["Status", (a, t) => t.status],
  ["Evidence notes", (a, t) => t.evidenceNote],
  ["Risk acceptance", (a, t) => t.riskAcceptance],
  ["Retest date", (a, t) => t.retest],
];

// Spreadsheet apps execute cells that start with = + - @ (and tab/CR) as
// formulas, and free text (owner names, notes) is typed by the visitor.
// Prefixing an apostrophe keeps every cell plain text.
function csvCell(value) {
  let s = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function actionsToCsv(actions, tracking = {}) {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(",")];
  for (const a of actions) {
    const t = tracking[a.id] || {};
    lines.push(CSV_COLUMNS.map(([, get]) => csvCell(get(a, t))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function actionsToJson(report, tracking = {}) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      methodologyVersion: report.methodologyVersion,
      questionSetVersion: report.questionSetVersion,
      mode: report.mode,
      generatedAt: report.generatedAt,
      verdict: report.verdict,
      actions: report.actions.map((a) => ({ ...a, tracking: tracking[a.id] || null })),
    },
    null,
    2
  );
}
