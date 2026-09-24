// AI-READINESS-GOVERNANCE-BRIEF.md §2/§1: structural coverage for the new
// AI Readiness & Governance track, mirroring team-structure.test.js's
// pattern for the analogous gate/multi-select/conditional-follow-up shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, visibleNodes } from "../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../src/engine/state.js";
import { AI_GOVERNANCE_ORDER, AI_GOVERNANCE_NODES } from "../src/data/ai-governance.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { ASSESSMENT_FLOW } from "../src/data/assessment-flow.js";
import { computeFlags } from "../src/engine/scoring.js";
import { FUNCTIONS } from "../src/data/categories.js";

function flow() {
  return buildFlow(AI_GOVERNANCE_ORDER, AI_GOVERNANCE_NODES);
}
function answer(state, f, id, value) {
  recordAnswer(state, f.index.get(id), value);
}
function visibleIds(f, state) {
  return visibleNodes(f, state).map((n) => n.id);
}
function nistVisibleIds(state) {
  return visibleNodes(ASSESSMENT_FLOW, state).map((n) => n.id);
}

test("§2 gate: 'No' skips the usage-scoping multi-select and the RAG follow-up entirely", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "aiUsage", "No, not currently");
  const ids = visibleIds(f, state);
  assert.deepEqual(ids, ["aiUsage"], "the screen should end here - nothing else to ask");
});

test("§2 gate: 'Not sure' also skips the branch, same as 'No'", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "aiUsage", "Not sure");
  const ids = visibleIds(f, state);
  assert.deepEqual(ids, ["aiUsage"]);
});

test("§2 gate: both 'Yes' variants unlock the usage-scoping multi-select", () => {
  for (const yes of ["Yes, broadly across the organization", "Yes, limited to specific teams or tools"]) {
    const f = flow();
    const state = createSessionState();
    answer(state, f, "aiUsage", yes);
    assert.ok(visibleIds(f, state).includes("aiUsageTypes"), `expected aiUsageTypes to unlock for "${yes}"`);
  }
});

test("§2: the custom-AI-app RAG follow-up only appears when 'custom-ai-app' is among the selected usage types", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "aiUsage", "Yes, limited to specific teams or tools");
  answer(state, f, "aiUsageTypes", ["enterprise-ai", "ai-dev-tools"]);
  assert.ok(!visibleIds(f, state).includes("aiCustomAppRAG"), "should not ask about RAG when no custom app was selected");

  const f2 = flow();
  const state2 = createSessionState();
  answer(state2, f2, "aiUsage", "Yes, limited to specific teams or tools");
  answer(state2, f2, "aiUsageTypes", ["custom-ai-app"]);
  assert.ok(visibleIds(f2, state2).includes("aiCustomAppRAG"), "should ask about RAG once a custom app is among the selections");
});

test("§2: the RAG-permissions scored question only appears once a custom app retrieves internal data", () => {
  const state = createSessionState();
  assert.ok(!nistVisibleIds(state).includes("aiRagPermissions"), "should not appear unanswered/undetermined");

  state.answers.aiCustomAppRAG = "No";
  assert.ok(!nistVisibleIds(state).includes("aiRagPermissions"), "should not appear when the custom app doesn't retrieve internal data");

  state.answers.aiCustomAppRAG = "Yes";
  assert.ok(nistVisibleIds(state).includes("aiRagPermissions"), "should appear once the custom app is confirmed to retrieve internal data");
});

test("§2: the AI-generated-code review-parity question appears for either AI dev tools or AI-in-CI/CD, not just one", () => {
  for (const types of [["ai-dev-tools"], ["ai-cicd"], ["ai-dev-tools", "ai-cicd"]]) {
    const state = createSessionState();
    state.answers.aiUsageTypes = types;
    assert.ok(nistVisibleIds(state).includes("aiCodeReviewParity"), `expected aiCodeReviewParity to appear for usage types ${JSON.stringify(types)}`);
  }
  const state = createSessionState();
  state.answers.aiUsageTypes = ["enterprise-ai"];
  assert.ok(!nistVisibleIds(state).includes("aiCodeReviewParity"), "should not appear when neither AI dev tooling nor AI-in-CI/CD was selected");
});

test("§2: the universal questions (deepfake training, out-of-band verification, AI risk ownership) appear regardless of AI adoption", () => {
  for (const gate of ["No, not currently", "Not sure", "Yes, broadly across the organization", undefined]) {
    const state = createSessionState();
    if (gate) state.answers.aiUsage = gate;
    const ids = nistVisibleIds(state);
    assert.ok(ids.includes("aiDeepfakeTraining"), `expected aiDeepfakeTraining for gate=${gate}`);
    assert.ok(ids.includes("aiVerificationStep"), `expected aiVerificationStep for gate=${gate}`);
    assert.ok(ids.includes("aiRiskOwnership"), `expected aiRiskOwnership for gate=${gate}`);
  }
});

test("§2: no duplicate node ids between the AI profile screen and the NIST question set", () => {
  const profileIds = new Set(AI_GOVERNANCE_NODES.map((n) => n.id));
  const nistIds = new Set(NIST_QUESTIONS.map((n) => n.id));
  for (const id of profileIds) assert.ok(!nistIds.has(id), `id "${id}" exists in both the profile screen and the NIST question set`);
});

test("§2: the five new scored AI questions exist, use the standard 0/2 range, and are tagged with a real NIST function", () => {
  const ids = ["aiRagPermissions", "aiCodeReviewParity", "aiDeepfakeTraining", "aiVerificationStep", "aiRiskOwnership"];
  for (const id of ids) {
    const q = NIST_QUESTIONS.find((n) => n.id === id);
    assert.ok(q, `missing question: ${id}`);
    assert.deepEqual([...new Set(q.options.map((o) => o.v).filter((v) => typeof v === "number"))].sort(), [0, 1, 2], `${id} should use the standard 0/1/2 scoring range`);
    assert.ok(q.options.some((o) => o.v === "unknown"), `${id} should offer "Not sure"`);
    assert.ok(FUNCTIONS.includes(q.fn), `${id} has an invalid fn: ${q.fn}`);
  }
});

test("§2 compounding-risk flag: fires only when a custom AI app over-retrieves AND no one owns AI risk", () => {
  const state = createSessionState();
  Object.assign(state.answers, { aiUsage: "Yes, limited to specific teams or tools", aiUsageTypes: ["custom-ai-app"], aiCustomAppRAG: "Yes", aiRagPermissions: 0, aiRiskOwnership: 0 });
  assert.ok(computeFlags(state).some((f) => f.id === "ai-rag-no-ownership"));
});

test("§2 compounding-risk flag: does not fire if either half of the combination is healthy", () => {
  const partialOwnership = createSessionState();
  Object.assign(partialOwnership.answers, { aiUsage: "Yes, limited to specific teams or tools", aiUsageTypes: ["custom-ai-app"], aiCustomAppRAG: "Yes", aiRagPermissions: 0, aiRiskOwnership: 2 });
  assert.ok(!computeFlags(partialOwnership).some((f) => f.id === "ai-rag-no-ownership"), "should not fire when AI risk ownership is in place");

  const permissionAware = createSessionState();
  Object.assign(permissionAware.answers, { aiUsage: "Yes, limited to specific teams or tools", aiUsageTypes: ["custom-ai-app"], aiCustomAppRAG: "Yes", aiRagPermissions: 2, aiRiskOwnership: 0 });
  assert.ok(!computeFlags(permissionAware).some((f) => f.id === "ai-rag-no-ownership"), "should not fire when retrieval is already permission-aware");

  const noCustomApp = createSessionState();
  Object.assign(noCustomApp.answers, { aiUsage: "Yes, limited to specific teams or tools", aiUsageTypes: ["custom-ai-app"], aiCustomAppRAG: "No", aiRagPermissions: 0, aiRiskOwnership: 0 });
  assert.ok(!computeFlags(noCustomApp).some((f) => f.id === "ai-rag-no-ownership"), "should not fire when there's no custom RAG app to begin with");
});
