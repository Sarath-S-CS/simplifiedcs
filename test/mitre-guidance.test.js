import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { computeFlags } from "../src/engine/scoring.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { FLAG_GUIDANCE, QUESTION_GUIDANCE, guidanceForFlag, guidanceForGapItem } from "../src/engine/mitre-guidance.js";

// Fires every computeFlags() combination except training-no-phishing-sim,
// which needs training !== 0 and so directly conflicts with the
// no-training-partial-mfa / no-email-auth-no-training flags below.
function stateWithMostFlags() {
  const state = createSessionState();
  Object.assign(state.answers, {
    mfa: 0,
    vendorCount: 0,
    siem: 0,
    irPlan: 0,
    backupTest: 0,
    endpoint: 0,
    training: 0,
    govRiskDecisions: 0,
    govPolicy: 0,
    externalWebsite: "Yes",
    webDb: "Yes",
    teamDedicated: "IT services outsourced with no internal IT team",
    outsourcedStructure: "No formal outsourced arrangement - handled ad hoc",
    deployModel: "Cloud-only",
    rdpExposed: 0,
    emailAuth: 0,
    hasOT: "Yes",
    otSegregation: "No - flat/shared network",
    otRemoteAccess: "Yes, but not via a dedicated secure gateway",
    developsSoftware: "Yes",
    devsecopsMaturity: "No formal practice - security reviewed late, if at all",
    secretsManagement: "Hardcoded or stored in plain config files",
    usesContainers: "Yes, most/all workloads",
    containerImageScanning: "No",
  });
  return state;
}

function stateWithPhishingSimFlag() {
  const state = createSessionState();
  Object.assign(state.answers, { training: 2, phishingSim: 0 });
  return state;
}

test("every flag id computeFlags() can produce has a FLAG_GUIDANCE entry", () => {
  const idsA = computeFlags(stateWithMostFlags()).map((f) => f.id);
  const idsB = computeFlags(stateWithPhishingSimFlag()).map((f) => f.id);
  const fired = new Set([...idsA, ...idsB]);

  // Sanity: this test's two states are expected to exercise all 16 flags.
  assert.equal(fired.size, 16, `expected 16 distinct flags to fire, got ${fired.size}: ${[...fired].join(", ")}`);

  for (const id of fired) {
    assert.ok(Object.prototype.hasOwnProperty.call(FLAG_GUIDANCE, id), `no FLAG_GUIDANCE entry for fired flag "${id}"`);
  }
});

test("FLAG_GUIDANCE has no stale entries beyond what computeFlags() can produce", () => {
  const idsA = computeFlags(stateWithMostFlags()).map((f) => f.id);
  const idsB = computeFlags(stateWithPhishingSimFlag()).map((f) => f.id);
  const fired = new Set([...idsA, ...idsB]);
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

test("every QUESTION_GUIDANCE key is a real NIST question id", () => {
  const knownIds = new Set(NIST_QUESTIONS.map((q) => q.id));
  for (const id of Object.keys(QUESTION_GUIDANCE)) {
    assert.ok(knownIds.has(id), `QUESTION_GUIDANCE has an entry "${id}" that doesn't match any NIST_QUESTIONS id`);
  }
});

test("guidanceForGapItem returns a usable panel for a mapped question, both branches of its compensating control", () => {
  const withMfa = guidanceForGapItem({ id: "offboarding" }, { siem: 2 });
  const withoutMfa = guidanceForGapItem({ id: "offboarding" }, { siem: 0 });
  assert.ok(withMfa.control.length > 0);
  assert.ok(withoutMfa.control.length > 0);
  assert.notEqual(withMfa.control, withoutMfa.control);
});
