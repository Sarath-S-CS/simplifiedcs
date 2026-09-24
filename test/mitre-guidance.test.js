import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { computeFlags } from "../src/engine/scoring.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { PROFILE_CONTROLS } from "../src/data/controls.js";
import { runScenario, WEAK_ANSWERS } from "./helpers/scenarios.js";
import { FLAG_GUIDANCE, QUESTION_GUIDANCE, guidanceForFlag, guidanceForGapItem } from "../src/engine/mitre-guidance.js";

// Three realistic walks through the real flows that, between them, fire
// every combined finding: the shared weak scenario, the "outsourced with no
// formal arrangement" branch, and training without phishing simulations.
function stateWithMostFlags() {
  return runScenario(WEAK_ANSWERS, { scope: { industry: "manufacturing" } });
}

function stateWithPhishingSimFlag() {
  return runScenario({ ...WEAK_ANSWERS, training: 2, trainingCadence: 2, phishingSim: 0 }, { scope: { industry: "manufacturing" } });
}

function stateOutsourcedAdHoc() {
  const answers = { ...WEAK_ANSWERS, teamDedicated: "IT services outsourced with no internal IT team", outsourcedStructure: "No formal outsourced arrangement - handled ad hoc", socOwnership: "Fully third-party" };
  return runScenario(answers, { scope: { industry: "manufacturing" } });
}

function allFired() {
  return new Set([stateWithMostFlags(), stateWithPhishingSimFlag(), stateOutsourcedAdHoc()].flatMap((s) => computeFlags(s).map((f) => f.id)));
}

test("every flag id computeFlags() can produce has a FLAG_GUIDANCE entry", () => {
  const fired = allFired();
  // Sanity: these states are expected to exercise all 22 combined findings.
  assert.equal(fired.size, 22, `expected 22 distinct flags to fire, got ${fired.size}: ${[...fired].join(", ")}`);

  for (const id of fired) {
    assert.ok(Object.prototype.hasOwnProperty.call(FLAG_GUIDANCE, id), `no FLAG_GUIDANCE entry for fired flag "${id}"`);
  }
});

test("FLAG_GUIDANCE has no stale entries beyond what computeFlags() can produce", () => {
  const fired = allFired();
  for (const id of Object.keys(FLAG_GUIDANCE)) {
    assert.ok(fired.has(id), `FLAG_GUIDANCE has an entry "${id}" that no computeFlags() condition produces`);
  }
});

test("guidanceForFlag never uses the literal phrase 'defense in depth'", () => {
  const state = stateWithMostFlags();
  const flags = computeFlags(state);
  for (const f of flags) {
    const g = guidanceForFlag(f, state.answers);
    if (!g) continue;
    assert.doesNotMatch(g.explain.toLowerCase(), /defense in depth/);
    assert.doesNotMatch(g.control.toLowerCase(), /defense in depth/);
  }
});

test("guidanceForFlag returns a non-empty interim step for every FLAG_GUIDANCE entry, technique optional", () => {
  const state = stateWithMostFlags();
  const flagsA = computeFlags(state);
  const flagsB = computeFlags(stateWithPhishingSimFlag());
  for (const f of [...flagsA, ...flagsB]) {
    const g = guidanceForFlag(f, state.answers);
    assert.ok(g, `expected guidance for fired flag "${f.id}"`);
    assert.ok(typeof g.control === "string" && g.control.length > 0, `empty compensating control for "${f.id}"`);
    if (g.technique) {
      assert.match(g.technique.id, /^T\d{4}(\.\d{3})?$/, `malformed technique id for "${f.id}": ${g.technique.id}`);
    }
  }
});

test("guidanceForFlag returns null for an id with no mapping", () => {
  assert.equal(guidanceForFlag({ id: "not-a-real-flag" }, {}), null);
});

test("every QUESTION_GUIDANCE key is a real scored question or setup-screen control", () => {
  const knownIds = new Set([...NIST_QUESTIONS.map((q) => q.id), ...Object.keys(PROFILE_CONTROLS)]);
  for (const id of Object.keys(QUESTION_GUIDANCE)) {
    assert.ok(knownIds.has(id), `QUESTION_GUIDANCE has an entry "${id}" that doesn't match any NIST_QUESTIONS id`);
  }
});

test("'Not sure' never produces 'you do have some X' compensating text", () => {
  const unsure = guidanceForFlag({ id: "mfa-vendor-exposure" }, { siem: "unknown" });
  const none = guidanceForFlag({ id: "mfa-vendor-exposure" }, { siem: 0 });
  assert.equal(unsure.control, none.control);
  assert.doesNotMatch(unsure.control, /You do have some centralized logging/);
});

test("guidanceForGapItem returns a usable panel for a mapped question, both branches of its compensating control", () => {
  const withMfa = guidanceForGapItem({ id: "offboarding" }, { siem: 2 });
  const withoutMfa = guidanceForGapItem({ id: "offboarding" }, { siem: 0 });
  assert.ok(withMfa.control.length > 0);
  assert.ok(withoutMfa.control.length > 0);
  assert.notEqual(withMfa.control, withoutMfa.control);
});
