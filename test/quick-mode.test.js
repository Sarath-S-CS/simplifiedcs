// Quick screening (methodology 2.0): at most 15 required responses on every
// path, including setup; an honest screening report with limited coverage;
// and a "Continue to Full" that keeps every compatible answer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleNodes } from "../src/engine/graph.js";
import { createSessionState } from "../src/engine/state.js";
import { PROFILE_SCREENS } from "../src/data/profile-flow.js";
import { ASSESSMENT_FLOW } from "../src/data/assessment-flow.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { buildReport } from "../src/engine/report-model.js";
import { computeFlags } from "../src/engine/scoring.js";
import { visibleProfileScreens } from "../src/engine/answers.js";
import { runScenario, WEAK_ANSWERS, bestAnswer } from "./helpers/scenarios.js";

// Scope-screen responses Quick requires (industry only - Quick hides the
// region and framework pickers).
const QUICK_SCOPE_REQUIRED = 1;

function requiredVisibleCount(state) {
  let n = 0;
  for (const screen of visibleProfileScreens(state)) n += visibleNodes(screen.flow, state).filter((x) => x.required !== false).length;
  n += visibleNodes(ASSESSMENT_FLOW, state).length;
  return n;
}

// Every graded option position plus "Not sure", for every Quick question.
const pickers = [
  (node) => (node.kind === "scored" ? node.options[0].v : node.options[0]),
  (node) => (node.kind === "scored" ? node.options[node.options.length - 1].v : node.options[node.options.length - 1]),
  (node) => bestAnswer(node),
  (node) => (node.kind === "scored" ? "unknown" : node.options[Math.floor(node.options.length / 2)]),
];

test("Quick asks at most 15 required responses on every path, including setup", () => {
  for (const industry of ["health", "saas", "finance", "other"]) {
    for (const pick of pickers) {
      const state = runScenario({}, { quickMode: true, scope: { industry }, fallback: pick });
      const total = QUICK_SCOPE_REQUIRED + requiredVisibleCount(state);
      assert.ok(total <= 15, `${industry}: ${total} required responses`);
      assert.ok(state.asked.length + QUICK_SCOPE_REQUIRED <= 15, `${industry}: asked ${state.asked.length}`);
    }
  }
});

test("Quick covers every one of the six areas with at least one control", () => {
  const quickFns = new Set(NIST_QUESTIONS.filter((q) => q.quick).map((q) => q.fn));
  assert.equal(quickFns.size, 6);
});

test("Quick asks only its allow-listed questions - never vendor identification", () => {
  const state = runScenario(WEAK_ANSWERS, { quickMode: true, scope: { industry: "manufacturing" } });
  for (const id of state.asked) {
    const node = [...PROFILE_SCREENS.flatMap((s) => [...s.flow.index.values()]), ...ASSESSMENT_FLOW.index.values()].find((n) => n.id === id);
    assert.ok(node.quick, `${id} is not a Quick question`);
  }
  for (const id of ["edrVendor", "cloudProvider", "edgeDeviceVendor", "fullMspProviderName", "otVendor"]) assert.ok(!state.asked.includes(id), id);
});

test("the Quick report is a screening: counts and limited-coverage note, never a 'Strong' verdict", () => {
  const best = runScenario({}, { quickMode: true, scope: { industry: "other" }, fallback: bestAnswer });
  const report = buildReport(best);
  assert.equal(report.mode, "quick");
  assert.equal(report.verdict.key, "screened");
  assert.match(report.limitations.join(" "), /Quick screening asked \d+ of \d+ baseline controls/);
  assert.ok(report.controls.some((c) => c.status === "not-asked"));
  assert.ok(!report.controls.some((c) => c.status === "not-asked" && report.findings.some((f) => f.id === c.id)), "controls not asked are never findings");
});

test("Quick finds the same critical gaps Full finds on the controls both ask", () => {
  const full = buildReport(runScenario(WEAK_ANSWERS, { scope: { industry: "manufacturing" } }));
  const quick = buildReport(runScenario(WEAK_ANSWERS, { quickMode: true, scope: { industry: "manufacturing" } }));
  assert.equal(quick.verdict.key, "critical-gaps");
  const quickIds = new Set(NIST_QUESTIONS.filter((q) => q.quick).map((q) => q.id));
  const fullCriticalOnQuick = full.criticalGaps.map((c) => c.id).filter((id) => quickIds.has(id));
  assert.deepEqual(quick.criticalGaps.map((c) => c.id).sort(), fullCriticalOnQuick.sort());
  // Combined findings only fire where Quick has the inputs; none are invented.
  for (const f of computeFlags(runScenario(WEAK_ANSWERS, { quickMode: true, scope: { industry: "manufacturing" } }))) {
    assert.ok(f.inputs.every((id) => quickIds.has(id) || id === "outsourcedStructure"), f.id);
  }
});

test("Continue to Full keeps every Quick answer and asks only what's missing", () => {
  const quick = runScenario(WEAK_ANSWERS, { quickMode: true, scope: { industry: "health" } });
  const quickAnswers = { ...quick.answers };
  quick.quickMode = false; // what the "Continue to Full assessment" button does
  for (const [id, v] of Object.entries(quickAnswers)) assert.deepEqual(quick.answers[id], v);
  const fullVisible = visibleNodes(ASSESSMENT_FLOW, quick).map((n) => n.id);
  for (const q of NIST_QUESTIONS.filter((x) => x.quick)) {
    assert.ok(fullVisible.includes(q.id));
    assert.notEqual(quick.answers[q.id], undefined, `${q.id} should be pre-answered`);
  }
  assert.ok(fullVisible.some((id) => quick.answers[id] === undefined), "Full still has unanswered questions to ask");
});

test("a fresh session isn't in Quick mode", () => {
  assert.equal(createSessionState().quickMode, false);
});
