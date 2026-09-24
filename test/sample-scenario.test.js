// The example reports are fictional answer sets run through the real engine.
// These guard against an example going stale (a question it doesn't answer,
// or a report that stops demonstrating anything) and against examples
// making claims no lookup supports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_SCENARIOS, DEFAULT_SAMPLE } from "../src/data/sample-scenario.js";
import { buildReport } from "../src/engine/report-model.js";
import { runScenario } from "./helpers/scenarios.js";

const SCOPE_KEYS = ["industry", "regions", "soc2", "gdpr", "companyName"];

function stateFor(sample) {
  const scope = Object.fromEntries(Object.entries(sample.answers).filter(([k]) => SCOPE_KEYS.includes(k)));
  // No fallback: every question an example reaches must have an answer.
  return runScenario(sample.answers, { scope });
}

test("there are IT-services and SaaS examples, and the default exists", () => {
  assert.deepEqual(Object.keys(SAMPLE_SCENARIOS).sort(), ["itServices", "saas"]);
  assert.ok(SAMPLE_SCENARIOS[DEFAULT_SAMPLE]);
});

for (const sample of Object.values(SAMPLE_SCENARIOS)) {
  test(`${sample.id}: answers every question its path reaches, and nothing it doesn't`, () => {
    const state = stateFor(sample);
    const report = buildReport(state);
    assert.equal(report.staleAnswerCount, 0, "every answer in the example should be for a question that applies");
    assert.equal(report.overall.counts.unanswered, 0);
  });

  test(`${sample.id}: is clearly fictional and demonstrates the report`, () => {
    const report = buildReport(stateFor(sample));
    assert.match(sample.answers.companyName, /fictional/i);
    assert.ok(report.findings.length >= 5);
    assert.ok(report.actions.length === report.findings.length);
    assert.ok(report.overall.coverage > 30 && report.overall.coverage < 95, `coverage ${report.overall.coverage}`);
    assert.ok(report.frameworkRecs.length >= 1);
  });

  test(`${sample.id}: the static AI example makes no vulnerability claims`, () => {
    assert.equal(sample.ai.example, true);
    assert.equal(sample.ai.advisories.length, 0);
    for (const s of sample.ai.sourceStatus) assert.match(s.kev + s.nvd, /not-checked-example/);
    assert.doesNotMatch(JSON.stringify(sample.ai), /CVE-\d{4}-\d+/);
  });
}

test("the two examples differ in a way worth showing: one has critical gaps, one doesn't", () => {
  const it = buildReport(stateFor(SAMPLE_SCENARIOS.itServices));
  const saas = buildReport(stateFor(SAMPLE_SCENARIOS.saas));
  assert.equal(it.verdict.key, "critical-gaps");
  assert.notEqual(saas.verdict.key, "critical-gaps");
  assert.equal(saas.verdict.key, "verify", "the SaaS example's 'Not sure' on restore testing asks for verification");
});
