import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { computeFlags, scoreFunction, computeFuncScores } from "../src/engine/scoring.js";
import { visibleNodes } from "../src/engine/graph.js";
import { ASSESSMENT_FLOW } from "../src/data/assessment-flow.js";
import { FUNCTIONS } from "../src/data/categories.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";

function visibleIdsFor(fn, state) {
  return visibleNodes(ASSESSMENT_FLOW, state)
    .filter((q) => q.fn === fn)
    .map((q) => q.id);
}

test("no duplicate question ids in the six-function NIST question set", () => {
  const ids = NIST_QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every NIST question is tagged with one of the six real functions", () => {
  for (const q of NIST_QUESTIONS) {
    assert.ok(FUNCTIONS.includes(q.fn), `question ${q.id} has an invalid fn: ${q.fn}`);
  }
});

test("scoreFunction returns 0 for a completely unanswered function", () => {
  const state = createSessionState();
  assert.equal(scoreFunction("Govern", state), 0);
});

test("scoreFunction returns 100 when every visible question in that function is answered at max", () => {
  const state = createSessionState();
  for (const q of NIST_QUESTIONS.filter((q) => q.fn === "Recover")) {
    const max = Math.max(...q.options.map((o) => o.v));
    state.answers[q.id] = max;
  }
  assert.equal(scoreFunction("Recover", state), 100);
});

test("computeFuncScores returns exactly the six business-mapped functions", () => {
  const state = createSessionState();
  const scores = computeFuncScores(state);
  assert.deepEqual(scores.map((s) => s.fn).sort(), [...FUNCTIONS].sort());
});

test("§5.2 adaptation: 'no team, no formal arrangement' flag fires on the new field names", () => {
  const state = createSessionState();
  state.answers.teamDedicated = "IT services outsourced with no internal IT team";
  state.answers.outsourcedStructure = "No formal outsourced arrangement - handled ad hoc";
  const flags = computeFlags(state);
  assert.ok(
    flags.some((f) => f.id === "no-accountability" && f.text.includes("No internal IT/security team and no formal outsourced arrangement")),
    "expected the no-accountability flag to fire"
  );
});

test("§5.2 adaptation: the no-accountability flag does NOT fire for a fully staffed, well-managed org", () => {
  const state = createSessionState();
  state.answers.teamDedicated = "Our IT team takes care of both IT and cybersecurity";
  const flags = computeFlags(state);
  assert.ok(!flags.some((f) => f.id === "no-accountability"));
});

test("§5.5 adaptation: unscanned container images flag fires on the renamed fields", () => {
  const state = createSessionState();
  state.answers.usesContainers = "Yes, most/all workloads";
  state.answers.containerImageScanning = "No";
  const flags = computeFlags(state);
  assert.ok(flags.some((f) => f.id === "unscanned-container-images" && f.text.includes("scanning images for known vulnerabilities")));
});

test("§5.5 adaptation: the container-scanning flag does not fire when containers aren't used", () => {
  const state = createSessionState();
  state.answers.usesContainers = "No";
  state.answers.containerImageScanning = "No";
  const flags = computeFlags(state);
  assert.ok(!flags.some((f) => f.id === "unscanned-container-images"));
});

test("§5.7: training cadence follow-up only appears once training happens at all", () => {
  const state = createSessionState();
  state.answers.training = 0; // "Never"
  assert.ok(!visibleIdsFor("Protect", state).includes("trainingCadence"));

  state.answers.training = 2; // "Ongoing, recurring"
  assert.ok(visibleIdsFor("Protect", state).includes("trainingCadence"));
});

test("§5.8: JIT privileged-access question only applies once accounts are at least partially separated", () => {
  const state = createSessionState();
  state.answers.privSeparation = 0; // "No - same account used for both"
  assert.ok(!visibleIdsFor("Protect", state).includes("privilegedAccessModel"));

  state.answers.privSeparation = 1; // "Partially"
  assert.ok(visibleIdsFor("Protect", state).includes("privilegedAccessModel"));
});

test("§5.8: the new Protect/Govern depth questions exist and score within the standard 0-2 range", () => {
  const newIds = ["aiToolGovernance", "privilegedAccessModel", "privAccountMgmt", "passwordPolicy", "passwordManager"];
  for (const id of newIds) {
    const q = NIST_QUESTIONS.find((n) => n.id === id);
    assert.ok(q, `missing question: ${id}`);
    assert.deepEqual([...new Set(q.options.map((o) => o.v))].sort(), [0, 1, 2], `${id} should use the standard 0/1/2 scoring range`);
  }
});
