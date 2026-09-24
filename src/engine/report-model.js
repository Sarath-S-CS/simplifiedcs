// One report model, shared by the web report, the sample reports and the PDF.
// Before this existed, each of those assembled its own view from raw engine
// calls and they drifted (the PDF showed a different verdict from the web
// page for the same answers). Now every renderer takes this plain,
// serializable object - which is also exactly what History saves, so a
// saved report re-opens as it was produced, not recalculated.
import { FRAMEWORKS } from "../data/frameworks.js";
import { INDUSTRIES } from "../data/industries.js";
import { REGIONS } from "../data/regions.js";
import { FUNC_DISPLAY } from "../data/categories.js";
import { ASSESSMENT_FLOW } from "../data/assessment-flow.js";
import { METHODOLOGY_VERSION, QUESTION_SET_VERSION, INFORMATIONAL_NOTES, STATUS } from "../data/controls.js";
import { effectiveState, staleAnswerIds } from "./answers.js";
import { assessControls, computeAreaScores, computeOverallScore, computeFlags, computeFindings, computeVerdict } from "./scoring.js";
import { buildActions, planByTimeframe } from "./actions.js";
import { findContradictions } from "./contradictions.js";
import { computeFrameworkRecommendations } from "./framework-guidance.js";
import { guidanceForFlag } from "./mitre-guidance.js";
import { matchedVendorNotes } from "../data/vendor-notes.js";
import { snapshotRows } from "../ui/snapshot.js";

export const REPORT_SCHEMA_VERSION = 2;

const BASELINE_CONTROL_COUNT = [...ASSESSMENT_FLOW.index.values()].filter((q) => !q.framework).length;

export function buildReport(state, { generatedAt = new Date().toISOString(), sample = null } = {}) {
  const eff = effectiveState(state);
  const a = eff.answers;
  const quick = Boolean(state.quickMode);

  const controls = assessControls(state);
  const overall = computeOverallScore(controls);
  const areas = computeAreaScores(controls);
  const flags = computeFlags(state);
  const findings = computeFindings(state, controls, flags);
  const criticalGaps = controls.filter((c) => c.critical).map((c) => ({ id: c.id, area: c.area, text: c.text, reason: c.criticalReason, chosen: c.chosen }));
  const verification = controls
    .filter((c) => c.criticalControl && c.status === STATUS.UNKNOWN)
    .map((c) => ({ id: c.id, area: c.area, text: c.text }));
  const verdict = computeVerdict({ overall, criticalGaps, verification, quickMode: quick });
  const actions = buildActions(findings, a);
  const contradictions = findContradictions(a);

  const informational = Object.entries(INFORMATIONAL_NOTES)
    .map(([id, note]) => ({ id, text: note(a[id]) }))
    .filter((n) => n.text);
  if (a.hasOT === "Not sure" && !a.otSegregation) {
    informational.push({ id: "hasOT", text: "Whether an OT/industrial control environment exists wasn't confirmed, so OT questions weren't asked. If one exists, run the Full assessment again and answer the OT section." });
  }

  const stale = staleAnswerIds(state);
  const limitations = [
    "Self-reported answers - nothing was scanned, tested or verified.",
    quick
      ? `Quick screening asked ${controls.filter((c) => c.quick).length} of ${BASELINE_CONTROL_COUNT} baseline controls. Areas not asked are not assessed at all.`
      : null,
    overall.counts.unknown ? `${overall.counts.unknown} control${overall.counts.unknown === 1 ? " was" : "s were"} answered "Not sure" and ${overall.counts.unknown === 1 ? "is" : "are"} excluded from the coverage percentage.` : null,
    overall.counts.unanswered ? `${overall.counts.unanswered} applicable question${overall.counts.unanswered === 1 ? " was" : "s were"} left unanswered.` : null,
    contradictions.length ? `${contradictions.length} set${contradictions.length === 1 ? "" : "s"} of answers look inconsistent (listed under "Answers worth double-checking").` : null,
    stale.length ? `${stale.length} earlier answer${stale.length === 1 ? " was" : "s were"} ignored because the question${stale.length === 1 ? " no longer applies" : "s no longer apply"} after later changes.` : null,
    "Framework references are SimplifiedCS's own alignment of each question to NIST CSF 2.0 and CIS Controls v8.1 - not an official crosswalk, an audit, or a compliance determination.",
  ].filter(Boolean);

  const industry = INDUSTRIES.find((i) => i.id === a.industry);
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    questionSetVersion: QUESTION_SET_VERSION,
    mode: quick ? "quick" : "full",
    generatedAt,
    sample,
    context: {
      industry: industry ? industry.label : null,
      industryId: a.industry || null,
      regions: (a.regions || []).map((id) => REGIONS.find((r) => r.id === id)?.label || id),
      frameworks: FRAMEWORKS.filter((f) => a[f.id]).map((f) => f.name),
      companyName: a.companyName || "",
      requestedBy: a.reportRequestedBy || "",
    },
    snapshot: snapshotRows(a).filter(([, v]) => !quick || (v && v !== "-" && v !== "Not specified")),
    verdict,
    overall: { coverage: overall.coverage, completeness: overall.completeness, known: overall.known, applicable: overall.applicable, counts: overall.counts },
    areas: areas.map((ar) => ({ fn: ar.fn, area: ar.area, coverage: ar.coverage, completeness: ar.completeness, known: ar.known, applicable: ar.applicable, counts: ar.counts })),
    criticalGaps,
    verification,
    controls: controls.map(({ id, fn, area, text, weight, status, statusLabel, chosen, csf, cis, critical, source }) => ({ id, fn, area, text, weight, status, statusLabel, chosen, csf, cis, critical, source })),
    // Findings stay lean; their guidance text lives once, on the matching
    // action (actions[i].findingId === findings[j].id).
    findings,
    flags: flags.map((f) => ({ ...f, guidance: guidanceForFlag(f, a, true) })),
    actions,
    plan: planByTimeframe(actions),
    contradictions,
    informational,
    frameworkRecs: computeFrameworkRecommendations(state),
    vendorNotes: matchedVendorNotes(a),
    limitations,
    staleAnswerCount: stale.length,
  };
}

// Reports compare meaningfully only when they were produced by the same
// methodology and mode. History uses this to decide whether to show a
// "change since last time" comparison at all.
export function comparable(a, b) {
  return Boolean(a && b && a.methodologyVersion === b.methodologyVersion && a.mode === b.mode);
}

export function areaLabel(fn) {
  return FUNC_DISPLAY[fn] || fn;
}
