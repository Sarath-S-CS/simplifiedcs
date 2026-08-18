// REDUNDANCY-AUDIT-BRIEF.md §3: a permanent, content-level redundancy test.
// The existing test suite (team-structure.test.js, graph-engine.test.js)
// thoroughly covers *structural* de-duplication - the dedupeKey mechanism
// itself. It has no test checking for *content-level* overlap: two
// different-by-design questions that happen to ask about the same
// real-world fact in different words. That's exactly how the confirmed
// §1 bug (socOwnership asked twice) went unnoticed despite that otherwise
// solid coverage - mspSocOwner and socOwnership are worded completely
// differently, so no exact-match check would ever have caught them.
//
// This walks a representative set of branch combinations (deliberately not
// exhaustive - dayToDay alone is a 6-option multi-select, so literally
// exhaustive is combinatorially infeasible - but hitting every distinct
// branch point at least once, plus every CLAUDE.md §5.2/§5.6 granular
// path called out by name), collects the full set of questions actually
// shown together for each, and flags any pair scoring at or above
// SIMILARITY_THRESHOLD on the word-overlap heuristic in
// src/engine/redundancy.js - an intentionally imperfect but real
// approximation, not exact-string matching, since the actual bugs found
// during this audit were all worded differently while asking the same
// thing.
//
// A flagged pair isn't automatically a bug: some overlap is real and
// intentional (a follow-up question naturally shares vocabulary with the
// question that gated it). KNOWN_OVERLAPS is the explicit, justified
// allowlist for those - anything NOT in it that still crosses the
// threshold fails the test, forcing a conscious decision (fix the wording,
// or allowlist it with a reason) rather than letting redundancy drift in
// silently as the question bank keeps growing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, visibleNodes } from "../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../src/engine/state.js";
import { findSimilarPairs } from "../src/engine/redundancy.js";
import { TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES } from "../src/data/team-structure.js";
import {
  ORG_PROFILE_ORDER, ORG_PROFILE_NODES,
  INFRA_ORDER, INFRA_NODES,
  DEVSEC_ORDER, DEVSEC_NODES,
  OT_ORDER, OT_NODES,
} from "../src/data/profile-questions.js";
import { CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES } from "../src/data/containerization.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { FRAMEWORKS } from "../src/data/frameworks.js";

const SIMILARITY_THRESHOLD = 0.15;

// Every pair below was surfaced by this exact test while building it, then
// individually reviewed. Each reason is the actual judgment call, not
// boilerplate - if a future change makes one of these genuinely redundant
// instead of just related, update the reason or remove the entry and fix
// the wording instead.
const KNOWN_OVERLAPS = [
  // --- §5.2 team-size chain: a parent question naturally shares
  // "dedicated IT/cybersecurity team" vocabulary with its own headcount
  // follow-ups - asking "do you have a team" then "how many people are on
  // it" is sequential refinement, not two questions asking the same thing.
  { a: "teamDedicated", b: "cybersecHeadcount", reason: "parent branch question + its own headcount follow-up (§5.2 branch B)" },
  { a: "teamDedicated", b: "itHeadcountSeparate", reason: "parent branch question + its own headcount follow-up (§5.2 branch B)" },
  { a: "teamDedicated", b: "dayToDay", reason: "parent branch question + the next question in its own chain" },
  { a: "itHeadcountSeparate", b: "cybersecHeadcount", reason: "the two intentionally-separate headcount questions §5.2 branch B asks for - different teams, same template wording" },
  // --- Genuinely related but distinct facts, sharing domain vocabulary.
  { a: "irPlan", b: "irTeam", reason: "having a documented plan vs. having a designated team are different facts, both legitimately under 'incident response'" },
  { a: "irPlan", b: "bcdr", reason: "two different plans (incident response vs. business continuity/disaster recovery) that share 'documented plan' phrasing" },
  { a: "govPolicy", b: "govReporting", reason: "having a policy vs. leadership receiving reporting are different governance facts" },
  { a: "hostingProvider", b: "webServerStack", reason: "who hosts it vs. what software runs on it - different facts about the same system" },
  { a: "hostingProvider", b: "containerHostSecurity", reason: "coincidental 'host(s)' word overlap - web hosting provider vs. container host hardening" },
  { a: "hostingProvider", b: "hypervisorPatching", reason: "coincidental 'host(s)' word overlap - web hosting provider vs. hypervisor host patching" },
  { a: "hasAntivirus", b: "dlpUsed", reason: "two unrelated yes/no security-tool questions with coincidentally similar short phrasing" },
  { a: "hasOT", b: "otVendor", reason: "parent OT gate question + its own vendor follow-up" },
  { a: "teamDedicated", b: "itOnlyHeadcount", reason: "parent branch question + its own headcount follow-up (§5.2 branch A: in-house-all)" },
  { a: "hasAntivirus", b: "antivirusVendor", reason: "parent gate question + its own vendor follow-up" },
  { a: "dlpUsed", b: "dlpVendor", reason: "parent gate question + its own vendor follow-up" },
  { a: "externalDevices", b: "edgeDeviceVendor", reason: "parent gate question + its own appliance follow-up" },
  { a: "deployModel", b: "cloudProvider", reason: "parent deployment-model question + its own cloud-provider follow-up" },
  { a: "antivirusVendor", b: "dlpVendor", reason: "two unrelated vendor-name follow-ups sharing the same short 'which X product?' template phrasing" },
  { a: "teamDedicated", b: "combinedHeadcount", reason: "parent branch question + its own headcount follow-up (§5.2 branch C: combined IT & cybersecurity team)" },
  { a: "teamDedicated", b: "outsourcedStructure", reason: "parent branch question + the branch-specific follow-up asked when there's no internal team (§5.2 branch D)" },
  { a: "mdrProviderName", b: "mdrMspProviderName", reason: "two different vendor facts (the MDR service vs. the separate MSP handling the rest of IT) that legitimately reference each other by design" },
  { a: "mdrProviderName", b: "webDb", reason: "coincidental 'service' word overlap - MDR security service vs. webDb's own parent (externalWebsite), unrelated to MDR" },
  { a: "outsourcedFunctionBreakdown", b: "cloudProvider", reason: "coincidental 'provider(s)' word overlap - outsourced IT/cybersecurity functions vs. cloud infrastructure provider" },
  { a: "outsourcedStructure", b: "outsourcedFunctionBreakdown", reason: "parent branch question + the next question in its own chain (fires when structure is 'different providers per service type')" },
  // --- Cross-flow (profile question vs. NIST assessment question): the
  // profile side asks WHAT tool/capability exists (unscored context), the
  // NIST side scores HOW WELL or how formally it's actually used - a team
  // can own a tool and still score low on using it well, or vice versa,
  // so these are genuinely different facts despite sharing vocabulary.
  { a: "awarenessLms", b: "training", reason: "cross-flow: which LMS platform (profile, unscored) vs. whether training actually happens (NIST, scored) - owning a tool isn't the same as using it" },
  { a: "awarenessLms", b: "trainingCadence", reason: "cross-flow: which LMS platform (profile, unscored) vs. how often training actually runs (NIST, scored)" },
  { a: "edrVendor", b: "endpoint", reason: "cross-flow: which EDR product (profile, unscored) vs. whether it's deployed on all devices (NIST, scored) - product choice isn't the same as coverage completeness" },
  { a: "inhouseSocCapability", b: "irPlan", reason: "cross-flow: in-house SOC/IR/forensics staffing breadth (profile, unscored) vs. whether a documented IR plan exists (NIST, scored) - having the people isn't the same as having a written plan" },
  { a: "inhouseSocCapability", b: "irTeam", reason: "cross-flow: in-house SOC/IR/forensics staffing breadth (profile, unscored, only asked on the fully-in-house branch) vs. whether any designated IR contact exists at all, in-house or not (NIST, scored, universal)" },
  // --- Cross-flow coincidental short-phrase overlap - unrelated questions
  // sharing a generic word ("access", "managed", "provider(s)") rather
  // than asking about the same real-world fact.
  { a: "otRemoteAccess", b: "vendorCount", reason: "cross-flow coincidental overlap - OT remote-access controls vs. third-party vendor count, unrelated" },
  { a: "otRemoteAccess", b: "mfa", reason: "cross-flow coincidental 'remote access' overlap - OT-specific remote access controls vs. general MFA enforcement, different systems" },
  { a: "otRemoteAccess", b: "soxAccessReview", reason: "cross-flow coincidental 'access' overlap - OT remote access vs. financial-system access reviews, unrelated domains" },
  { a: "dayToDay", b: "patching", reason: "cross-flow coincidental 'managed' overlap - how cybersecurity is staffed/outsourced vs. how patches are managed, unrelated" },
  { a: "socOwnership", b: "vendorCount", reason: "cross-flow coincidental overlap - who owns SOC/monitoring vs. third-party vendor count, unrelated" },
  // --- §5.7: documented in nist-questions.js itself as an intentional
  // cadence follow-up on top of the training question, specifically NOT a
  // duplicate - this pair is expected to score high.
  { a: "training", b: "trainingCadence", reason: "§5.7: deliberate cadence follow-up on the training question, not a duplicate (see the comment in nist-questions.js)" },
  // --- §2 finding, fixed by rewording rather than removal: PCI DSS's
  // version captures a genuinely more precise regulatory detail (quarterly
  // cadence, ASV certification) that the baseline doesn't. Reworded to
  // explicitly build on the baseline answer instead of re-asking cold; the
  // remaining overlap is intentional, not a bug.
  { a: "vulnScanning", b: "pcidssASVScanning", reason: "§2: PCI DSS's quarterly-ASV requirement is a genuine refinement of the baseline scan question, not a duplicate - worded as an explicit follow-up" },
];

function isKnownOverlap(a, b) {
  return KNOWN_OVERLAPS.some((k) => (k.a === a && k.b === b) || (k.a === b && k.b === a));
}

function answer(state, f, id, value) {
  recordAnswer(state, f.index.get(id), value);
}

// Walks every given flow to exhaustion against one shared answers object
// (mirroring how one real assessment run shares a single session across
// all profile screens + the scored flow) and returns the combined visible
// question list, deduped by id (a node already recorded as answered stays
// in state.asked but visibleNodes() naturally won't re-list it once a
// later flow moves past it - collecting across flows can't double-count
// since each id only exists in exactly one flow's node index).
function collectVisible(state, flows) {
  const all = [];
  for (const f of flows) all.push(...visibleNodes(f, state));
  return all;
}

function profileFlows() {
  return {
    org: buildFlow(ORG_PROFILE_ORDER, ORG_PROFILE_NODES),
    team: buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES),
    infra: buildFlow(INFRA_ORDER, INFRA_NODES),
    container: buildFlow(CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES),
    devsec: buildFlow(DEVSEC_ORDER, DEVSEC_NODES),
    ot: buildFlow(OT_ORDER, OT_NODES),
  };
}

function assessmentFlow() {
  const nodes = NIST_QUESTIONS.map((q) => (q.framework ? { ...q, visibleIf: (a) => Boolean(a[q.framework]) } : q));
  return buildFlow(nodes.map((q) => q.id), nodes);
}

// Fills in enough of the always-visible infra/container/devsec/OT fields
// with a fixed, reasonable answer set so their own conditional follow-ups
// unlock too - every scenario below layers its own team-structure/framework
// answers on top of this same baseline, so infra-side questions are
// consistently present across scenarios and only the team/framework side
// varies per scenario.
function answerSharedProfileBaseline(state, flows) {
  answer(state, flows.org, "employeeCount", "51–200");
  answer(state, flows.infra, "hasAntivirus", "Yes");
  answer(state, flows.infra, "dlpUsed", "Yes");
  answer(state, flows.infra, "deployModel", "Hybrid (on-prem + cloud)");
  answer(state, flows.infra, "sdwanUsed", "No");
  answer(state, flows.infra, "networkArch", "Segmented (VLANs / zones)");
  answer(state, flows.infra, "externalDevices", "Yes");
  answer(state, flows.infra, "externalWebsite", "Yes");
  answer(state, flows.container, "usesContainers", "Yes, some workloads");
  answer(state, flows.container, "usesVirtualization", "Yes, on-prem hypervisor (e.g. VMware, Hyper-V)");
  answer(state, flows.devsec, "developsSoftware", "Yes");
  answer(state, flows.ot, "hasOT", "Yes");
  answer(state, flows.ot, "otSegregation", "Partially segregated");
}

// One team-structure scenario per distinct §5.2 branch point, including
// the specific SOC free-text-turned-checkbox paths from §1 (with and
// without SOC actually selected, since only one of those two should
// suppress socOwnership).
const TEAM_SCENARIOS = [
  {
    name: "in-house-all",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "Yes, only a dedicated IT team maintaining infrastructure");
      answer(state, f, "itOnlyHeadcount", "3–10");
      answer(state, f, "dayToDay", ["inhouse-all"]);
      answer(state, f, "inhouseSocCapability", "Yes, all three in-house");
    },
  },
  {
    name: "partial-outsource, SOC not among selected functions",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "Yes, dedicated IT and cybersecurity team");
      answer(state, f, "itHeadcountSeparate", "3–10");
      answer(state, f, "cybersecHeadcount", "1–2");
      answer(state, f, "dayToDay", ["partial-outsource"]);
      answer(state, f, "partialOutsourceFunctions", ["patch-management", "backup-dr"]);
      answer(state, f, "socOwnership", "Hybrid - some in-house, some third-party");
    },
  },
  {
    name: "partial-outsource, SOC IS among selected functions (§1 bug repro)",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "Yes, dedicated IT and cybersecurity team");
      answer(state, f, "itHeadcountSeparate", "3–10");
      answer(state, f, "cybersecHeadcount", "1–2");
      answer(state, f, "dayToDay", ["partial-outsource"]);
      answer(state, f, "partialOutsourceFunctions", ["soc-monitoring", "patch-management"]);
    },
  },
  {
    name: "full-msp (§1 bug repro)",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "3–10");
      answer(state, f, "dayToDay", ["full-msp"]);
      answer(state, f, "fullMspProviderName", "Kyndryl");
      answer(state, f, "mspSocOwner", "Same MSP");
    },
  },
  {
    name: "mixed-msp-other, SOC among other-provider functions",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "10+");
      answer(state, f, "dayToDay", ["mixed-msp-other"]);
      answer(state, f, "mixedMspProviderName", "Rackspace Technology");
      answer(state, f, "mixedOtherProviderDetail", ["soc-monitoring"]);
    },
  },
  {
    name: "mdr-msp",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "1–2");
      answer(state, f, "dayToDay", ["mdr-msp"]);
      answer(state, f, "mdrProviderName", "Arctic Wolf");
      answer(state, f, "mdrMspProviderName", "Kyndryl");
    },
  },
  {
    name: "mssp",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "1–2");
      answer(state, f, "dayToDay", ["mssp"]);
      answer(state, f, "msspProviderName", "Secureworks");
    },
  },
  {
    name: "outsourced, one dedicated MSP",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "IT services outsourced with no internal IT team");
      answer(state, f, "outsourcedStructure", "One dedicated MSP handles everything");
      answer(state, f, "outsourcedMspName", "Kyndryl");
    },
  },
  {
    name: "outsourced, different providers per function, SOC among them (§1 bug repro)",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "IT services outsourced with no internal IT team");
      answer(state, f, "outsourcedStructure", "Different providers for different service types (e.g. separate MSP, MDR, backup vendor)");
      answer(state, f, "outsourcedFunctionBreakdown", ["soc-monitoring", "email-security"]);
    },
  },
  {
    name: "outsourced, no formal arrangement",
    apply: (state, f) => {
      answer(state, f, "teamDedicated", "IT services outsourced with no internal IT team");
      answer(state, f, "outsourcedStructure", "No formal outsourced arrangement - handled ad hoc");
    },
  },
];

// Collects unexpected-overlap failures across every scenario before
// asserting, rather than asserting inside the loop - a thrown assertion on
// scenario 1 would otherwise abort the loop before scenarios 2..n ever ran,
// so a single test run could only ever reveal one scenario's gaps at a
// time. Asserting once at the end gives a complete picture in one pass,
// which matters for a test meant to stay low-friction as the question bank
// grows - a future contributor should see every gap at once, not fix-rerun
// repeatedly to discover them one scenario at a time.
test("content redundancy: representative team-structure branches, each layered on the same profile baseline", () => {
  const failures = [];
  for (const scenario of TEAM_SCENARIOS) {
    const flows = profileFlows();
    const state = createSessionState();
    answerSharedProfileBaseline(state, flows);
    scenario.apply(state, flows.team);
    const visible = collectVisible(state, [flows.org, flows.team, flows.infra, flows.container, flows.devsec, flows.ot]);
    const pairs = findSimilarPairs(visible.map((n) => ({ id: n.id, text: n.text })), SIMILARITY_THRESHOLD);
    const unexpected = pairs.filter((p) => !isKnownOverlap(p.a, p.b));
    if (unexpected.length) failures.push({ scenario: scenario.name, unexpected });
  }
  assert.deepEqual(
    failures,
    [],
    `new, unreviewed content overlap found - either these questions genuinely ask the same thing (fix the wording/dedupe) or they're related-but-distinct and belong in KNOWN_OVERLAPS with a reason:\n${JSON.stringify(failures, null, 2)}`
  );
});

test("content redundancy: every framework's injected questions, individually and all at once", () => {
  const scenarios = [
    { name: "no frameworks (baseline only)", frameworks: [] },
    ...FRAMEWORKS.map((fw) => ({ name: `${fw.name} only`, frameworks: [fw.id] })),
    { name: "every framework at once (max cross-framework overlap stress test)", frameworks: FRAMEWORKS.map((fw) => fw.id) },
  ];
  const failures = [];
  for (const scenario of scenarios) {
    const flow = assessmentFlow();
    const state = createSessionState();
    for (const id of scenario.frameworks) state.answers[id] = true;
    const visible = visibleNodes(flow, state);
    const pairs = findSimilarPairs(visible.map((n) => ({ id: n.id, text: n.text })), SIMILARITY_THRESHOLD);
    const unexpected = pairs.filter((p) => !isKnownOverlap(p.a, p.b));
    if (unexpected.length) failures.push({ scenario: scenario.name, unexpected });
  }
  assert.deepEqual(
    failures,
    [],
    `new, unreviewed content overlap found:\n${JSON.stringify(failures, null, 2)}`
  );
});

// The two tests above check redundancy *within* the profile flow and
// *within* the NIST assessment flow separately, but never combined - so a
// profile question duplicating a NIST question (or vice versa) would slip
// past both. Which profile questions are visible depends only on the
// team-structure branch; which NIST questions are visible depends only on
// framework selection; neither affects the other, so any branch + any
// framework combination is a valid real scenario. Checking the UNION of
// every profile question ever visible across all TEAM_SCENARIOS against
// the UNION of every NIST question (all frameworks at once, the maximal
// set) therefore covers every pair that could ever actually co-occur for
// a real user, without needing the full branch x framework cross-product.
test("content redundancy: profile-flow questions against NIST assessment questions (cross-flow)", () => {
  const allProfileVisible = new Map();
  for (const scenario of TEAM_SCENARIOS) {
    const flows = profileFlows();
    const state = createSessionState();
    answerSharedProfileBaseline(state, flows);
    scenario.apply(state, flows.team);
    collectVisible(state, [flows.org, flows.team, flows.infra, flows.container, flows.devsec, flows.ot]).forEach((n) =>
      allProfileVisible.set(n.id, n.text)
    );
  }

  const nistState = createSessionState();
  for (const fw of FRAMEWORKS) nistState.answers[fw.id] = true;
  const allNistVisible = visibleNodes(assessmentFlow(), nistState);

  const combined = [
    ...Array.from(allProfileVisible, ([id, text]) => ({ id, text })),
    ...allNistVisible.map((n) => ({ id: n.id, text: n.text })),
  ];
  const profileIds = new Set(allProfileVisible.keys());
  const nistIds = new Set(allNistVisible.map((n) => n.id));

  const pairs = findSimilarPairs(combined, SIMILARITY_THRESHOLD);
  const crossFlowOnly = pairs.filter((p) => (profileIds.has(p.a) && nistIds.has(p.b)) || (profileIds.has(p.b) && nistIds.has(p.a)));
  const unexpected = crossFlowOnly.filter((p) => !isKnownOverlap(p.a, p.b));
  assert.deepEqual(
    unexpected,
    [],
    `new, unreviewed cross-flow overlap between a profile question and a NIST question found:\n${JSON.stringify(unexpected, null, 2)}`
  );
});

// §3: "specifically include multi-select-to-later-single-question patterns
// as an explicit test case, not just prose-similarity checking, since
// that's a structurally distinct failure mode from simple wording
// overlap." These are exact, deterministic checks of the actual
// mechanism (dedupeKey + dedupeValue array-membership), not fuzzy
// similarity scoring - the fuzzy check above is for catching *wording*
// overlap; this is for catching *structural* regressions in the fix itself.
// Each checkbox node lives on a different branch, so each needs its own
// real prerequisite path answered first - recording an answer directly on
// e.g. partialOutsourceFunctions without teamDedicated/dayToDay already
// set would let recordAnswer populate state.dedupe correctly, but
// visibleNodes()'s walk would never actually reach socOwnership to adopt
// it (it'd still be stuck at the first unanswered required node), so the
// test would pass for the wrong reason. Setting up the full path is what
// makes this an honest end-to-end check of the fix, not just the mechanism.
const SOC_DEDUPE_PATHS = [
  {
    nodeId: "partialOutsourceFunctions",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "Yes, dedicated IT and cybersecurity team");
      answer(state, f, "itHeadcountSeparate", "3–10");
      answer(state, f, "cybersecHeadcount", "1–2");
      answer(state, f, "dayToDay", ["partial-outsource"]);
    },
  },
  {
    nodeId: "outsourcedFunctionBreakdown",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "IT services outsourced with no internal IT team");
      answer(state, f, "outsourcedStructure", "Different providers for different service types (e.g. separate MSP, MDR, backup vendor)");
    },
  },
  {
    nodeId: "mixedOtherProviderDetail",
    setup: (state, f) => {
      answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
      answer(state, f, "combinedHeadcount", "10+");
      answer(state, f, "dayToDay", ["mixed-msp-other"]);
      answer(state, f, "mixedMspProviderName", "Rackspace Technology");
    },
  },
];

test("§1 regression: SOC ownership is never asked twice via any of the three checkbox paths, but IS still asked when SOC wasn't among the selections", () => {
  for (const { nodeId, setup } of SOC_DEDUPE_PATHS) {
    // SOC selected -> socOwnership must be suppressed and carry a real answer forward
    {
      const f = buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES);
      const state = createSessionState();
      setup(state, f);
      answer(state, f, nodeId, ["soc-monitoring", "patch-management"]);
      const ids = visibleNodes(f, state).map((n) => n.id);
      assert.ok(!ids.includes("socOwnership"), `${nodeId}: socOwnership should be suppressed once SOC/monitoring is checked here`);
      assert.equal(
        state.answers.socOwnership,
        "Hybrid - some in-house, some third-party",
        `${nodeId}: the deduped answer should still be carried forward into scoring/results, not left blank`
      );
    }
    // SOC NOT selected -> socOwnership must still be asked (proves this isn't just suppressing the question unconditionally)
    {
      const f = buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES);
      const state = createSessionState();
      setup(state, f);
      answer(state, f, nodeId, ["patch-management"]);
      const ids = visibleNodes(f, state).map((n) => n.id);
      assert.ok(ids.includes("socOwnership"), `${nodeId}: socOwnership must still be asked when SOC/monitoring wasn't one of the selected functions`);
    }
  }
});

test("§1 regression: mspSocOwner (structured select, not a checkbox) also dedupes against socOwnership", () => {
  const f = buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES);
  const state = createSessionState();
  answer(state, f, "teamDedicated", "Our IT team takes care of both IT and cybersecurity");
  answer(state, f, "combinedHeadcount", "3–10");
  answer(state, f, "dayToDay", ["full-msp"]);
  answer(state, f, "fullMspProviderName", "Kyndryl");
  answer(state, f, "mspSocOwner", "Same MSP");
  const ids = visibleNodes(f, state).map((n) => n.id);
  assert.ok(!ids.includes("socOwnership"), "socOwnership must not be asked again after mspSocOwner already answered the same question");
  assert.equal(state.answers.socOwnership, "Same MSP", "the raw mspSocOwner value should carry forward - nothing downstream reads socOwnership by its own specific option strings");
});

test("KNOWN_OVERLAPS stays accurate: every allowlisted pair still actually meets the similarity threshold", () => {
  // Guards against the allowlist silently accumulating stale entries for
  // pairs that no longer overlap (e.g. after a future wording tweak) -
  // those should be removed so the allowlist keeps meaning "reviewed and
  // accepted," not "once flagged, ignored forever."
  const allTexts = new Map();
  for (const n of TEAM_STRUCTURE_NODES) allTexts.set(n.id, n.text);
  for (const n of ORG_PROFILE_NODES) allTexts.set(n.id, n.text);
  for (const n of INFRA_NODES) allTexts.set(n.id, n.text);
  for (const n of CONTAINERIZATION_NODES) allTexts.set(n.id, n.text);
  for (const n of DEVSEC_NODES) allTexts.set(n.id, n.text);
  for (const n of OT_NODES) allTexts.set(n.id, n.text);
  for (const n of NIST_QUESTIONS) allTexts.set(n.id, n.text);

  for (const { a, b } of KNOWN_OVERLAPS) {
    assert.ok(allTexts.has(a), `KNOWN_OVERLAPS references unknown node id "${a}"`);
    assert.ok(allTexts.has(b), `KNOWN_OVERLAPS references unknown node id "${b}"`);
  }
});
