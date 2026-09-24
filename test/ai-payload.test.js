// The AI-Insights request must carry the actual answers - its long-tail
// pass and narrative are only as grounded as what it's sent. These run the
// real engine over the fixed sample scenario rather than hand-built
// fixtures, so a data-file change that breaks the digest shows up here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { SAMPLE_ANSWERS } from "../src/data/sample-scenario.js";
import { visibleNodes } from "../src/engine/graph.js";
import { ASSESSMENT_FLOW } from "../src/data/assessment-flow.js";
import { computeGapItems } from "../src/engine/scoring.js";
import { profileAnswerDigest, scoredAnswerDigest } from "../src/engine/ai-payload.js";

function sampleState() {
  const state = createSessionState();
  Object.assign(state.answers, SAMPLE_ANSWERS);
  return state;
}

test("scored digest covers every visible scored question, with the chosen option's label", () => {
  const state = sampleState();
  const digest = scoredAnswerDigest(state);
  const visible = visibleNodes(ASSESSMENT_FLOW, state).filter((q) => q.fn);
  assert.equal(digest.length, visible.length);
  for (const [i, q] of visible.entries()) {
    assert.equal(digest[i].q, q.text);
    assert.equal(digest[i].a, q.options.find((o) => o.v === state.answers[q.id])?.t ?? "Not answered");
  }
});

test("scored digest marks exactly the questions computeGapItems() counts as gaps", () => {
  const state = sampleState();
  const gapTexts = new Set(computeGapItems(state).map((g) => g.gap));
  for (const d of scoredAnswerDigest(state)) assert.equal(d.gap, gapTexts.has(d.q), d.q);
  // Strengths are included too - that's what stops the model calling an
  // in-place control "missing".
  assert.ok(scoredAnswerDigest(state).some((d) => !d.gap), "expected at least one non-gap answer in the sample");
});

test("scored digest labels functions the way the report does, not with raw NIST ids", () => {
  const fns = new Set(scoredAnswerDigest(sampleState()).map((d) => d.fn));
  assert.ok(fns.has("Access & Identity") && fns.has("Recovery & Continuity"), [...fns].join(", "));
});

test("profile digest uses question text and readable answers, never internal ids", () => {
  const state = sampleState();
  const digest = profileAnswerDigest(state);
  assert.ok(digest.length >= 5, `expected a real profile, got ${digest.length} rows`);
  for (const row of digest) {
    assert.ok(row.q && row.a, JSON.stringify(row));
    assert.ok(!/__other__/i.test(row.a), `raw Other sentinel leaked: ${row.a}`);
  }
  const size = digest.find((r) => /employees/i.test(r.q));
  assert.equal(size?.a, SAMPLE_ANSWERS.employeeCount);
});

test("profile digest maps multiselect ids to labels and appends Other text", () => {
  const state = createSessionState();
  state.answers.teamDedicated = "Our IT team takes care of both IT and cybersecurity";
  state.answers.combinedHeadcount = "3–10";
  state.answers.dayToDay = ["inhouse-all", "__other__"];
  state.answers.dayToDay__otherText = "after-hours NOC phone answering";
  const row = profileAnswerDigest(state).find((r) => /day to day/i.test(r.q));
  assert.ok(row, "expected the day-to-day question in the digest");
  assert.equal(row.a, "In-house team manages everything, no services outsourced; Other: after-hours NOC phone answering");
});
