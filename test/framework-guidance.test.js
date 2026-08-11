import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { computeFrameworkRecommendations } from "../src/engine/framework-guidance.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { FRAMEWORKS } from "../src/data/frameworks.js";

test("§5.6: every framework in FRAMEWORKS has at least one injected question", () => {
  for (const f of FRAMEWORKS) {
    const count = NIST_QUESTIONS.filter((q) => q.framework === f.id).length;
    assert.ok(count > 0, `${f.id} has no injected questions - §5.6 requires all 8 frameworks to actually do something`);
  }
});

test("§5.6: no framework recommendations appear when nothing is selected", () => {
  const state = createSessionState();
  assert.deepEqual(computeFrameworkRecommendations(state), []);
});

test("§5.6: selecting a framework surfaces its summary and specific gaps from its own questions", () => {
  const state = createSessionState();
  state.answers.hipaa = true;
  state.answers.hipaaBAA = 0; // "No" - a real gap
  state.answers.hipaaRiskAnalysis = 2; // fully answered, no gap
  state.answers.hipaaEncryption = 1; // partial gap

  const recs = computeFrameworkRecommendations(state);
  assert.equal(recs.length, 1);
  const hipaa = recs[0];
  assert.equal(hipaa.id, "hipaa");
  assert.ok(hipaa.summary.length > 20, "summary should be real content, not a placeholder");
  assert.equal(hipaa.gaps.length, 2, "exactly the two below-max answers should surface as gaps");
  assert.ok(hipaa.gaps.some((g) => g.question.includes("Business Associate Agreements")));
  assert.ok(!hipaa.gaps.some((g) => g.question.includes("risk analysis")), "the fully-answered question should not appear as a gap");
});

test("§5.6: a framework with all its questions maxed out reports zero gaps", () => {
  const state = createSessionState();
  state.answers.soc2 = true;
  for (const q of NIST_QUESTIONS.filter((q) => q.framework === "soc2")) {
    state.answers[q.id] = Math.max(...q.options.map((o) => o.v));
  }
  const recs = computeFrameworkRecommendations(state);
  assert.equal(recs[0].gaps.length, 0);
});
