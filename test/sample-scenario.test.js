// ASSESSMENT-EXPERIENCE-BRIEF.md §6: "See a Sample Report" runs a fixed
// answer set through the real engine rather than a hardcoded fake report -
// this guards against that answer set silently going stale (producing zero
// flags, zero vendor notes, or crashing a report function) as scoring.js/
// vendor-notes.js/framework-guidance.js evolve, without pinning to brittle
// exact numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { SAMPLE_ANSWERS } from "../src/data/sample-scenario.js";
import { computeFuncScores, computeOverall, computeFlags, computeGapItems, computePriorities } from "../src/engine/scoring.js";
import { matchedVendorNotes } from "../src/data/vendor-notes.js";
import { computeFrameworkRecommendations } from "../src/engine/framework-guidance.js";
import { guidanceForFlag } from "../src/engine/mitre-guidance.js";
import { FUNCTIONS } from "../src/data/categories.js";

function sampleState() {
  const state = createSessionState();
  Object.assign(state.answers, SAMPLE_ANSWERS);
  return state;
}

test("§6 sample scenario: produces a full six-function score in a believable mid-range band", () => {
  const state = sampleState();
  const funcScores = computeFuncScores(state);
  assert.deepEqual(funcScores.map((f) => f.fn), FUNCTIONS);
  for (const f of funcScores) assert.ok(f.pct > 0 && f.pct < 100, `${f.fn} should be neither 0% nor 100% for a "realistic mixed" sample`);
  const overall = computeOverall(funcScores);
  assert.ok(overall > 30 && overall < 85, `expected a moderate overall score, got ${overall}%`);
});

test("§6 sample scenario: triggers at least one compounding-risk flag with real MITRE guidance", () => {
  const state = sampleState();
  const flags = computeFlags(state);
  assert.ok(flags.length >= 1, "sample scenario should demonstrate the compounding-risk engine, not show zero flags");
  const withGuidance = flags.filter((f) => guidanceForFlag(f, state.answers));
  assert.ok(withGuidance.length >= 1, "expected at least one flag with a real MITRE ATT&CK mapping, to actually demo that panel");
});

test("§6 sample scenario: matches at least one vendor-specific mitigation note", () => {
  const state = sampleState();
  const notes = matchedVendorNotes(state.answers);
  assert.ok(notes.length >= 1, "sample scenario's named vendors should demo the vendor-notes panel, not show it empty");
});

test("§6 sample scenario: surfaces its selected framework's recommendations", () => {
  const state = sampleState();
  const recs = computeFrameworkRecommendations(state);
  assert.ok(recs.some((r) => r.name === "HIPAA"), "sample scenario selects HIPAA and should surface its recommendations");
});

test("§6 sample scenario: produces a non-empty, ranked priority list", () => {
  const state = sampleState();
  const gaps = computeGapItems(state);
  const priorities = computePriorities(state);
  assert.ok(gaps.length >= 5);
  assert.ok(priorities.length >= 1 && priorities.length <= 5);
});
