import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, visibleNodes } from "../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../src/engine/state.js";
import { TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES } from "../src/data/team-structure.js";

function flow() {
  return buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES);
}

function answer(state, f, id, value) {
  recordAnswer(state, f.index.get(id), value);
}

function visibleIds(f, state) {
  return visibleNodes(f, state).map((n) => n.id);
}

test("§5.2 branch A: only a dedicated IT team asks one headcount question, no cybersec headcount", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Yes, only a dedicated IT team maintaining infrastructure");
  answer(state, f, "itOnlyHeadcount", "1–2");
  const ids = visibleIds(f, state);
  assert.ok(ids.includes("itOnlyHeadcount"));
  assert.ok(!ids.includes("itHeadcountSeparate"));
  assert.ok(!ids.includes("cybersecHeadcount"));
  assert.ok(ids.includes("dayToDay"), "should proceed to day-to-day management next");
});

test("§5.2 branch B: separate IT and cybersecurity teams asks both headcounts in order", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Yes, dedicated IT and cybersecurity team");
  let ids = visibleIds(f, state);
  assert.deepEqual(ids, ["teamDedicated", "itHeadcountSeparate"], "should stop at the first headcount question, not skip ahead");
  answer(state, f, "itHeadcountSeparate", "3–10");
  ids = visibleIds(f, state);
  assert.ok(ids.includes("cybersecHeadcount"), "second headcount question should now appear");
  assert.ok(!ids.includes("combinedHeadcount"));
});

test("§5.2 branch C: one combined team asks a single combined headcount question", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
  answer(state, f, "combinedHeadcount", "10+");
  const ids = visibleIds(f, state);
  assert.ok(ids.includes("combinedHeadcount"));
  assert.ok(!ids.includes("itHeadcountSeparate"));
  assert.ok(!ids.includes("cybersecHeadcount"));
});

test("§5.2 branch D: outsourced with no internal team skips headcount entirely", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "IT services outsourced with no internal IT team");
  const ids = visibleIds(f, state);
  assert.ok(!ids.some((id) => id.toLowerCase().includes("headcount")), "no headcount question should ever appear on this branch");
  assert.ok(ids.includes("outsourcedStructure"));
  assert.ok(!ids.includes("dayToDay"), "the generic day-to-day question is replaced by outsourcedStructure on this branch");
});

test("§5.2 branch D sub-branches route correctly", () => {
  for (const [answerValue, expectNext] of [
    ["One dedicated MSP handles everything", "outsourcedMspName"],
    ["Different providers for different service types (e.g. separate MSP, MDR, backup vendor)", "outsourcedFunctionBreakdown"],
    ["No formal outsourced arrangement - handled ad hoc", "socOwnership"],
  ]) {
    const f = flow();
    const state = createSessionState();
    answer(state, f, "teamDedicated", "IT services outsourced with no internal IT team");
    answer(state, f, "outsourcedStructure", answerValue);
    const ids = visibleIds(f, state);
    assert.ok(ids.includes(expectNext), `expected ${expectNext} to be visible after answering "${answerValue}", got: ${ids}`);
  }
});

test("§5.10: MSP name asked once even when both 'full-msp' and 'mdr-msp' are selected in the multi-select", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
  answer(state, f, "combinedHeadcount", "3–10");
  answer(state, f, "dayToDay", ["full-msp", "mdr-msp"]);
  answer(state, f, "fullMspProviderName", "Kyndryl");
  answer(state, f, "mspSocOwner", "Same MSP");
  const ids = visibleIds(f, state);
  assert.ok(ids.includes("mdrProviderName"), "the MDR-specific vendor question is not a duplicate, should still be asked");
  assert.ok(!ids.includes("mdrMspProviderName"), "the MSP-name question under the MDR branch duplicates fullMspProviderName and must be skipped");
  assert.equal(state.answers.mdrMspProviderName, "Kyndryl", "the deduped answer should still be carried into scoring/results");
});

test("accountability follow-ups (SOC ownership, cyber insurance, incident recovery) are skipped when fully in-house with no outsourcing", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
  answer(state, f, "combinedHeadcount", "10+");
  answer(state, f, "dayToDay", ["inhouse-all"]);
  answer(state, f, "inhouseSocCapability", "Yes, all three in-house");
  const ids = visibleIds(f, state);
  assert.ok(!ids.includes("socOwnership"));
  assert.ok(!ids.includes("cyberInsurance"));
  assert.ok(!ids.includes("incidentRecoveryOwner"));
});

test("accountability follow-ups appear once for any outsourcing arrangement, regardless of which branch triggered them", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
  answer(state, f, "combinedHeadcount", "1–2");
  answer(state, f, "dayToDay", ["mssp"]);
  answer(state, f, "msspProviderName", "Secureworks");
  const ids = visibleIds(f, state);
  assert.ok(ids.includes("socOwnership"));
  assert.equal(ids.filter((id) => id === "socOwnership").length, 1);
});

test("no duplicate node ids exist in the team-structure graph", () => {
  const ids = TEAM_STRUCTURE_NODES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "every node id must be unique");
  assert.deepEqual([...TEAM_STRUCTURE_ORDER].sort(), [...ids].sort(), "TEAM_STRUCTURE_ORDER must match the node set exactly");
});

// Bug found while verifying ASSESSMENT-EXPERIENCE-BRIEF.md §2: selecting
// "Other" on a provider-name vendor field records an empty-string answer,
// which (before the vendorNameDedupeValue fix) immediately satisfied its
// own dedupeKey and self-adopted, making the field - and its "Other" text
// input - vanish before the user could type anything into it. Each of
// these six fields shares a dedupeKey specifically so a later field in the
// same family doesn't re-ask once one has a real answer; selecting "Other"
// must not count as a real answer for that purpose.
const PROVIDER_NAME_OTHER_SCENARIOS = [
  {
    nodeId: "outsourcedMspName",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "IT services outsourced with no internal IT team");
      answer(state, f, "outsourcedStructure", "One dedicated MSP handles everything");
    },
  },
  {
    nodeId: "fullMspProviderName",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "3–10");
      answer(state, f, "dayToDay", ["full-msp"]);
    },
  },
  {
    nodeId: "mixedMspProviderName",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "10+");
      answer(state, f, "dayToDay", ["mixed-msp-other"]);
    },
  },
  {
    nodeId: "mdrProviderName",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "1–2");
      answer(state, f, "dayToDay", ["mdr-msp"]);
    },
  },
  {
    nodeId: "msspProviderName",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "1–2");
      answer(state, f, "dayToDay", ["mssp"]);
    },
  },
];

test("selecting 'Other' on a provider-name field keeps it visible until real text is typed", () => {
  for (const { nodeId, setup } of PROVIDER_NAME_OTHER_SCENARIOS) {
    const f = flow();
    const state = createSessionState();
    setup(state, f);
    // Mirrors fieldHtml's vendor-select handler: choosing "Other" records "".
    answer(state, f, nodeId, "");
    const ids = visibleIds(f, state);
    assert.ok(ids.includes(nodeId), `${nodeId}: selecting "Other" (empty string) must not make the field disappear`);
    // Now typing a real name resolves the shared dedupeKey as expected.
    answer(state, f, nodeId, "A local/regional MSP");
    const idsAfter = visibleIds(f, state);
    assert.equal(state.answers[nodeId], "A local/regional MSP");
    assert.ok(!idsAfter.includes(nodeId) || idsAfter.filter((id) => id === nodeId).length === 1, `${nodeId}: should not be duplicated once answered`);
  }
});

test("mdrMspProviderName ('Other') doesn't self-adopt and blocks its own MDR-branch chain", () => {
  const f = flow();
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
  answer(state, f, "combinedHeadcount", "1–2");
  answer(state, f, "dayToDay", ["mdr-msp"]);
  answer(state, f, "mdrProviderName", "Arctic Wolf");
  answer(state, f, "mdrMspProviderName", "");
  const ids = visibleIds(f, state);
  assert.ok(ids.includes("mdrMspProviderName"), "selecting 'Other' here must not make the field disappear before a name is typed");
});
