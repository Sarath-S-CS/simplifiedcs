// ASSESSMENT-EXPERIENCE-BRIEF.md §1 verification requirement: "walk both a
// Quick and a Full run with the same underlying weak answers and confirm
// the score, compounding-risk flags, and MITRE mapping are consistent
// between them (same core findings present in both), with Full simply
// having additional vendor-specific detail layered on top."
//
// This drives every profile screen + the NIST assessment flow via the same
// resolveNext()-based walk the real UI uses (see assessment.js's
// renderProfileScreen/renderAssessmentCategory), fed by one shared weak/
// vulnerable answer set. Run once with quickMode:false and once with
// quickMode:true - since quickSkip only ever hides pure vendor-identification
// fields (never a scored NIST question or a field any computeFlags() rule
// reads directly), Quick mode's walk should simply never visit those nodes
// while producing an otherwise identical report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, resolveNext } from "../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../src/engine/state.js";
import { ORG_PROFILE_ORDER, ORG_PROFILE_NODES, INFRA_ORDER, INFRA_NODES, DEVSEC_ORDER, DEVSEC_NODES, OT_ORDER, OT_NODES } from "../src/data/profile-questions.js";
import { TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES } from "../src/data/team-structure.js";
import { CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES } from "../src/data/containerization.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { computeFuncScores, computeOverall, computeFlags, computeGapItems, computePriorities } from "../src/engine/scoring.js";
import { matchedVendorNotes } from "../src/data/vendor-notes.js";
import { computeFrameworkRecommendations } from "../src/engine/framework-guidance.js";
import { guidanceForFlag, guidanceForGapItem } from "../src/engine/mitre-guidance.js";

function assessmentFlow() {
  const nodes = NIST_QUESTIONS.map((q) => (q.framework ? { ...q, visibleIf: (a) => Boolean(a[q.framework]) } : q));
  return buildFlow(nodes.map((q) => q.id), nodes);
}

function flows() {
  return {
    org: buildFlow(ORG_PROFILE_ORDER, ORG_PROFILE_NODES),
    team: buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES),
    infra: buildFlow(INFRA_ORDER, INFRA_NODES),
    container: buildFlow(CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES),
    devsec: buildFlow(DEVSEC_ORDER, DEVSEC_NODES),
    ot: buildFlow(OT_ORDER, OT_NODES),
    nist: assessmentFlow(),
  };
}

// One realistic, deliberately weak/vulnerable answer set covering every
// node that's reachable across the org/team/infra/container/devsec/ot/nist
// flows on this specific branch path - including several pure
// vendor-identification fields (fullMspProviderName, antivirusVendor,
// edrVendor, emailSecurityVendor, awarenessLms, cloudProvider,
// edgeDeviceVendor, hostingProvider, webServerStack, otVendor) that should
// be visited in Full mode and silently skipped in Quick mode.
const WEAK_ANSWERS = {
  employeeCount: "51–200",

  teamDedicated: "Our IT team takes care of both IT and cybersecurity",
  combinedHeadcount: "3–10",
  dayToDay: ["full-msp"],
  fullMspProviderName: "Kyndryl",
  mspSocOwner: "Same MSP",
  cyberInsurance: "No",
  incidentRecoveryOwner: "Not defined",

  hasAntivirus: "Yes",
  antivirusVendor: "Cisco",
  edrVendor: "Cisco",
  emailSecurityVendor: "Mimecast",
  awarenessLms: "KnowBe4",
  dlpUsed: "No",
  deployModel: "Hybrid (on-prem + cloud)",
  cloudProvider: "Microsoft Azure",
  sdwanUsed: "No",
  networkArch: "Flat / mostly unsegmented",
  externalDevices: "Yes",
  edgeDeviceVendor: "Fortinet",
  externalWebsite: "Yes",
  webDb: "Yes",
  hostingProvider: "Self-hosted / on-premises",
  webServerStack: "Nginx on Ubuntu 22.04",

  usesContainers: "Yes, some workloads",
  containerOrchestration: "No, containers run without an orchestrator",
  containerImageScanning: "No",
  containerHostSecurity: "Not specifically hardened - same as general servers",
  usesVirtualization: "No / cloud-native only",
  vmSegmentation: "No - flat network",

  developsSoftware: "Yes",
  devsecopsMaturity: "No formal practice - security reviewed late, if at all",
  secretsManagement: "Hardcoded or stored in plain config files",

  hasOT: "Yes",
  otSegregation: "No - flat/shared network",
  otRemoteAccess: "Yes, but not via a dedicated secure gateway",
  otPatching: "Rarely or never patched (legacy/vendor-locked)",
  otMonitoring: "No",
  otVendor: "Siemens",

  govPolicy: 0,
  govRoles: 0,
  govReporting: 0,
  govRiskDecisions: 0,
  aiToolGovernance: 0,
  isoIsms: 0,
  assetInv: 0,
  dataClass: 0,
  vendorCount: 0,
  isoRiskAssess: 0,
  mfa: 0,
  passkeys: 0,
  patching: 0,
  dbEncryption: 0,
  dbAccessControl: 0,
  dbPatching: 1,
  training: 0,
  phishingSim: 0,
  endpoint: 1,
  rdpExposed: 0,
  emailAuth: 0,
  privSeparation: 0,
  privAccountMgmt: 0,
  passwordPolicy: 0,
  passwordManager: 0,
  offboarding: 0,
  siem: 0,
  anomalyTime: 0,
  exfil: 0,
  vulnScanning: 0,
  pentest: 0,
  irPlan: 0,
  irTeam: 0,
  commsPlan: 0,
  backupTest: 0,
  bcdr: 0,
  backupIsolation: 0,
};

// Faithfully mirrors how the real UI drives a flow (renderProfileScreen's
// nextBtn handler, renderAssessmentCategory's option click): repeatedly ask
// the engine what to show next, answer it, move on. A node quickMode hides
// is simply never returned by resolveNext(), so this loop naturally answers
// fewer fields under Quick mode without needing separate Quick/Full answer
// lists.
function driveFlow(state, flow) {
  let id = resolveNext(flow, null, state);
  let guard = 0;
  while (id !== null) {
    if (++guard > 200) throw new Error(`driveFlow: possible infinite loop, stuck around "${id}"`);
    const node = flow.index.get(id);
    const value = WEAK_ANSWERS[id];
    assert.notEqual(value, undefined, `WEAK_ANSWERS has no entry for visible node "${id}" - add one`);
    recordAnswer(state, node, value);
    id = resolveNext(flow, id, state);
  }
}

function runScenario(quickMode) {
  const f = flows();
  const state = createSessionState();
  state.quickMode = quickMode;
  state.answers.iso27001 = true; // scope-level answer, set directly like renderScope() does
  driveFlow(state, f.org);
  driveFlow(state, f.team);
  driveFlow(state, f.infra);
  driveFlow(state, f.container);
  driveFlow(state, f.devsec);
  driveFlow(state, f.ot);
  driveFlow(state, f.nist);
  return state;
}

test("§1: Quick and Full modes produce identical NIST function scores on the same weak answers", () => {
  const full = runScenario(false);
  const quick = runScenario(true);
  assert.deepEqual(computeFuncScores(quick), computeFuncScores(full));
  assert.equal(computeOverall(computeFuncScores(quick)), computeOverall(computeFuncScores(full)));
});

test("§1: Quick and Full modes flag the same compounding-risk findings", () => {
  const full = runScenario(false);
  const quick = runScenario(true);
  const fullFlags = computeFlags(full);
  const quickFlags = computeFlags(quick);
  // A non-trivial scenario: this weak answer set should actually trigger
  // several flags, or the "consistency" being asserted below is vacuous.
  assert.ok(fullFlags.length >= 8, `expected several compounding-risk flags from this weak scenario, got ${fullFlags.length}`);
  assert.deepEqual(quickFlags.map((f) => f.id), fullFlags.map((f) => f.id));
});

test("§1: Quick and Full modes produce identical gap items, priorities, and framework recommendations", () => {
  const full = runScenario(false);
  const quick = runScenario(true);
  assert.deepEqual(computeGapItems(quick), computeGapItems(full));
  assert.deepEqual(computePriorities(quick), computePriorities(full));
  assert.deepEqual(computeFrameworkRecommendations(quick), computeFrameworkRecommendations(full));
});

test("§1: Quick and Full modes produce identical MITRE ATT&CK guidance for every flag and priority item", () => {
  const full = runScenario(false);
  const quick = runScenario(true);
  const fullFlags = computeFlags(full);
  const quickFlags = computeFlags(quick);
  for (let i = 0; i < fullFlags.length; i++) {
    assert.deepEqual(guidanceForFlag(quickFlags[i], quick.answers), guidanceForFlag(fullFlags[i], full.answers), `MITRE guidance for flag "${fullFlags[i].id}" differs between Quick and Full`);
  }
  const fullPriorities = computePriorities(full);
  const quickPriorities = computePriorities(quick);
  for (let i = 0; i < fullPriorities.length; i++) {
    assert.deepEqual(guidanceForGapItem(quickPriorities[i], quick.answers), guidanceForGapItem(fullPriorities[i], full.answers), `MITRE guidance for priority item "${fullPriorities[i].id}" differs between Quick and Full`);
  }
});

test("§1: vendor-specific mitigation notes are the one honest, expected difference - present in Full, absent in Quick", () => {
  const full = runScenario(false);
  const quick = runScenario(true);
  const fullNotes = matchedVendorNotes(full.answers);
  const quickNotes = matchedVendorNotes(quick.answers);
  assert.ok(fullNotes.length > 0, "expected the weak scenario's named vendors (Cisco, Fortinet, Mimecast, KnowBe4) to match at least one vendor note in Full mode");
  assert.equal(quickNotes.length, 0, "Quick mode should collect zero vendor-identification fields, so it should produce zero vendor notes");
});

test("§1: Quick mode never asks a pure vendor-identification field", () => {
  const quick = runScenario(true);
  const vendorFieldIds = [
    "antivirusVendor", "edrVendor", "emailSecurityVendor", "awarenessLms", "dlpVendor",
    "cloudProvider", "sdwanUsed", "sdwanVendor", "edgeDeviceVendor", "hostingProvider",
    "webServerStack", "otVendor", "outsourcedMspName", "fullMspProviderName",
    "mixedMspProviderName", "mdrProviderName", "mdrMspProviderName", "msspProviderName",
  ];
  for (const id of vendorFieldIds) {
    assert.equal(quick.asked.includes(id), false, `Quick mode should never ask "${id}"`);
  }
});

test("§1: Full mode still asks the vendor-identification fields this scenario's branch reaches", () => {
  const full = runScenario(false);
  const reachedInThisScenario = ["antivirusVendor", "edrVendor", "emailSecurityVendor", "awarenessLms", "cloudProvider", "edgeDeviceVendor", "hostingProvider", "webServerStack", "otVendor", "fullMspProviderName"];
  for (const id of reachedInThisScenario) {
    assert.equal(full.asked.includes(id), true, `Full mode should still ask "${id}"`);
  }
});
