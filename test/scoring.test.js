// Methodology 2.0 scoring. The first group reproduces the failures found in
// the September 2026 review; each must stay fixed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { assessControls, computeOverallScore, computeFlags, computeFindings, computeVerdict, CRITICAL_CONTROL_IDS } from "../src/engine/scoring.js";
import { buildReport } from "../src/engine/report-model.js";
import { effectiveState, staleAnswerIds, scoredStatus } from "../src/engine/answers.js";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { FUNCTIONS } from "../src/data/categories.js";
import { runScenario, WEAK_ANSWERS, bestAnswer } from "./helpers/scenarios.js";

// Everything in place, with a small, cloud-only, no-OT, no-dev profile.
const STRONG_PROFILE = {
  employeeCount: "11–50",
  teamDedicated: "Our IT team takes care of both IT and cybersecurity",
  combinedHeadcount: "1–2",
  dayToDay: ["inhouse-all"],
  inhouseSocCapability: "Yes, all three in-house",
  vendorCount: "1–5",
  hasAntivirus: "Yes",
  dlpUsed: "Yes",
  deployModel: "Cloud-only",
  sdwanUsed: "No",
  networkArch: "Segmented (VLANs / zones)",
  externalDevices: "No",
  externalWebsite: "No",
  usesContainers: "No",
  usesVirtualization: "No / cloud-native only",
  developsSoftware: "No",
  aiUsage: "No, not currently",
  hasOT: "No",
};

function strongState(overrides = {}, scope = { industry: "other" }) {
  return runScenario({ ...STRONG_PROFILE, ...overrides }, { scope, fallback: bestAnswer });
}

// ---------- review regressions ----------

test("review: a cloud-only organization with no MFA is never 'Strong', whatever the percentage", () => {
  const state = strongState({ mfa: 0 });
  const report = buildReport(state);
  assert.ok(report.overall.coverage >= 90, `precondition: high coverage, got ${report.overall.coverage}`);
  assert.equal(report.verdict.key, "critical-gaps");
  assert.deepEqual(report.criticalGaps.map((c) => c.id), ["mfa"]);
  assert.ok(computeFlags(state).some((f) => f.id === "cloud-no-mfa"));
});

test("review: MFA on admin accounts only is still critical for an internet-reachable organization", () => {
  const report = buildReport(strongState({ mfa: 1 }));
  assert.equal(report.verdict.key, "critical-gaps");
  assert.match(report.criticalGaps[0].reason, /admin accounts only/);
});

test("review: weak DevSecOps, secrets, container and OT answers are scored findings, not ignored", () => {
  const state = strongState({
    developsSoftware: "Yes",
    devsecopsMaturity: "No formal practice - security reviewed late, if at all",
    secretsManagement: "Hardcoded or stored in plain config files",
    usesContainers: "Yes, most/all workloads",
    containerOrchestration: "Yes",
    containerImageScanning: "No",
    containerHostSecurity: "Not specifically hardened - same as general servers",
    vmSegmentation: "No - flat network",
    hasOT: "Yes",
    otSegregation: "No - flat/shared network",
    otRemoteAccess: "Yes, but not via a dedicated secure gateway",
    otPatching: "Rarely or never patched (legacy/vendor-locked)",
    otMonitoring: "No",
    otVendor: "",
  }, { industry: "manufacturing" });
  const report = buildReport(state);
  const gapIds = report.findings.map((f) => f.id);
  for (const id of ["devsecopsMaturity", "secretsManagement", "containerImageScanning", "containerHostSecurity", "vmSegmentation", "otSegregation", "otRemoteAccess", "otPatching", "otMonitoring"]) {
    assert.ok(gapIds.includes(id), `${id} should be a finding`);
  }
  assert.ok(report.overall.coverage < 100);
  assert.equal(report.verdict.key, "critical-gaps", "a flat IT/OT network is a critical gap");
});

test("review: an answer to a question that no longer applies is ignored everywhere (stale branch answers)", () => {
  // Visitor said the public service uses a database and answered the
  // database questions badly, then went back and said there is no public
  // service at all.
  const state = strongState({ externalWebsite: "Yes", webDb: "Yes", dbEncryption: 0, dbAccessControl: 0, dbPatching: 0 });
  state.answers.externalWebsite = "No";
  const eff = effectiveState(state).answers;
  assert.equal(eff.webDb, undefined);
  assert.equal(eff.dbEncryption, undefined);
  assert.ok(staleAnswerIds(state).includes("webDb"));
  assert.ok(!computeFlags(state).some((f) => f.id === "db-unencrypted-weak-access" || f.id === "exposed-db-app-no-monitoring"));
  const db = assessControls(state).find((c) => c.id === "dbEncryption");
  assert.equal(db.status, "not-applicable");
  assert.match(buildReport(state).limitations.join(" "), /ignored because the question/);
});

// ---------- statuses ----------

test("'Not sure' is its own status: excluded from coverage, never a gap, never triggers a finding", () => {
  const state = strongState({ mfa: "unknown", siem: "unknown", irPlan: 0 });
  const controls = assessControls(state);
  assert.equal(controls.find((c) => c.id === "mfa").status, "unknown");
  const overall = computeOverallScore(controls);
  assert.equal(overall.counts.unknown, 2);
  assert.ok(overall.completeness < 1);
  assert.ok(!computeFlags(state).some((f) => f.id === "cloud-no-mfa" || f.id === "no-logging-no-ir"));
  const report = buildReport(state);
  assert.equal(report.verdict.key, "verify", "an unverified critical control asks for verification");
  const mfaFinding = report.findings.find((f) => f.id === "mfa");
  assert.equal(mfaFinding.kind, "verify");
  assert.match(report.actions.find((a) => a.id === "A-mfa").title, /^Find out:/);
});

test("all 'Not sure' gives 'Not enough information' and no percentage", () => {
  const state = runScenario({ ...STRONG_PROFILE }, { scope: { industry: "other" }, fallback: (n) => (n.kind === "scored" ? "unknown" : bestAnswer(n)) });
  const report = buildReport(state);
  // Profile controls (network segmentation) are still definite answers.
  const scoredOnly = report.controls.filter((c) => c.source === "question" && c.status !== "not-applicable");
  assert.ok(scoredOnly.every((c) => c.status === "unknown"));
  assert.equal(computeVerdict({ overall: computeOverallScore([]), criticalGaps: [], verification: [] }).key, "insufficient");
  assert.equal(report.verdict.key, "verify");
});

test("a justified 'Not applicable' is excluded from coverage and from findings", () => {
  const state = strongState({ emailAuth: "na" });
  const c = assessControls(state).find((x) => x.id === "emailAuth");
  assert.equal(c.status, "not-applicable");
  assert.ok(!buildReport(state).findings.some((f) => f.id === "emailAuth"));
});

test("status mapping: highest graded option is met, lowest is gap, middle is partial", () => {
  const mfa = NIST_QUESTIONS.find((q) => q.id === "mfa");
  assert.equal(scoredStatus(mfa, 2), "met");
  assert.equal(scoredStatus(mfa, 1), "partial");
  assert.equal(scoredStatus(mfa, 0), "gap");
  assert.equal(scoredStatus(mfa, "unknown"), "unknown");
  assert.equal(scoredStatus(mfa, undefined), "unanswered");
  const siem = NIST_QUESTIONS.find((q) => q.id === "siem");
  assert.equal(scoredStatus(siem, 2), "met");
  assert.equal(scoredStatus(siem, 0), "gap");
});

// ---------- truthful question paths ----------

test("no-AI organizations aren't forced to answer (or fail) the AI usage governance question", () => {
  const state = strongState({ aiUsage: "No, not currently" });
  assert.equal(assessControls(state).find((c) => c.id === "aiToolGovernance").status, "not-applicable");
  const unsure = strongState({ aiUsage: "Not sure" });
  assert.notEqual(assessControls(unsure).find((c) => c.id === "aiToolGovernance").status, "not-applicable");
});

test("vendor count and vendor review are separate; no vendors makes review not applicable", () => {
  const none = strongState({ vendorCount: "None" });
  assert.equal(assessControls(none).find((c) => c.id === "vendorAccessReview").status, "not-applicable");
  const many = strongState({ vendorCount: "6 or more", vendorAccessReview: 0 });
  assert.equal(assessControls(many).find((c) => c.id === "vendorAccessReview").status, "gap");
});

test("hypervisor patching is asked only of organizations running their own hypervisors", () => {
  const cloud = strongState({ usesVirtualization: "Yes, cloud VM instances", vmSegmentation: "Yes, fully segmented" });
  assert.equal(assessControls(cloud).find((c) => c.id === "hypervisorPatching").status, "not-applicable");
  const onPrem = strongState({ usesVirtualization: "Yes, on-prem hypervisor (e.g. VMware, Hyper-V)", hypervisorPatching: "Ad hoc / rarely", vmSegmentation: "Yes, fully segmented" });
  assert.equal(assessControls(onPrem).find((c) => c.id === "hypervisorPatching").status, "gap");
});

test("OT 'Not sure' keeps OT questions in industries where OT is common, and becomes a note elsewhere", () => {
  const likely = strongState({ hasOT: "Not sure", otSegregation: "Not sure", otRemoteAccess: "Not sure", otPatching: "Not sure", otMonitoring: "Not sure" }, { industry: "manufacturing" });
  assert.equal(assessControls(likely).find((c) => c.id === "otSegregation").status, "unknown");
  const other = strongState({ hasOT: "Not sure" }, { industry: "finance" });
  assert.equal(assessControls(other).find((c) => c.id === "otSegregation").status, "not-applicable");
  assert.ok(buildReport(other).informational.some((n) => n.id === "hasOT"));
});

test("contradictory answers are listed for double-checking without changing the score", () => {
  const state = strongState({ irPlan: 2, irTeam: 0 });
  const report = buildReport(state);
  assert.ok(report.contradictions.some((c) => c.id === "tested-ir-plan-no-contact"));
  assert.match(report.limitations.join(" "), /inconsistent/);
});

// ---------- ranking + findings register ----------

test("ranking: critical gaps outrank standard gaps, and every finding says why it ranks where it does", () => {
  const state = runScenario(WEAK_ANSWERS, { scope: { iso27001: true, industry: "manufacturing" } });
  const findings = computeFindings(state);
  const rank = (id) => findings.find((f) => f.id === id).rank;
  assert.ok(rank("rdpExposed") < rank("passkeys"));
  assert.ok(rank("mfa") < rank("govReporting"));
  for (const f of findings) assert.ok(f.reasons.length >= 1, f.id);
  const firstStandard = findings.findIndex((f) => f.weight === 1);
  const lastCritical = findings.map((f) => f.critical).lastIndexOf(true);
  assert.ok(lastCritical < firstStandard, "every critical gap ranks above every standard-weight item");
});

test("the findings register covers every gap: scored, profile-derived and finding-only", () => {
  const state = runScenario(WEAK_ANSWERS, { scope: { industry: "manufacturing" } });
  const report = buildReport(state);
  const ids = new Set(report.findings.map((f) => f.id));
  for (const c of report.controls) if (["gap", "partial", "unknown"].includes(c.status)) assert.ok(ids.has(c.id), c.id);
  assert.ok(ids.has("incidentRecoveryOwner"), "finding-only item");
  assert.equal(report.actions.length, report.findings.length);
});

test("combined findings: new rules fire on definite answers", () => {
  const state = runScenario(WEAK_ANSWERS, { scope: { industry: "manufacturing" } });
  const ids = computeFlags(state).map((f) => f.id);
  for (const id of ["flat-network-backups-exposed", "deepfake-no-verification", "exposed-devices-no-scanning", "shared-admin-no-separation", "mfa-vendor-exposure", "ot-flat-network"]) {
    assert.ok(ids.includes(id), id);
  }
});

test("exposed-database finding names only the monitoring that is actually missing", () => {
  const state = strongState({ externalWebsite: "Yes", webDb: "Yes", siem: 2, exfil: 0 });
  const flag = computeFlags(state).find((f) => f.id === "exposed-db-app-no-monitoring");
  assert.ok(flag);
  assert.match(flag.text, /without outbound-traffic monitoring/);
  assert.doesNotMatch(flag.text, /centralized logging/);
});

test("the 'no team, no formal arrangement' finding still fires on the team-structure answers", () => {
  const state = createSessionState();
  state.answers.teamDedicated = "IT services outsourced with no internal IT team";
  state.answers.outsourcedStructure = "No formal outsourced arrangement - handled ad hoc";
  assert.ok(computeFlags(state).some((f) => f.id === "no-accountability"));
});

test("area scores cover exactly the six functions", () => {
  const report = buildReport(strongState());
  assert.deepEqual(report.areas.map((a) => a.fn), FUNCTIONS);
  assert.equal(report.verdict.key, "strong");
});

test("critical rules exist only for weight-3 controls", async () => {
  const { CONTROL_META, PROFILE_CONTROLS } = await import("../src/data/controls.js");
  for (const id of CRITICAL_CONTROL_IDS) assert.equal((CONTROL_META[id] || PROFILE_CONTROLS[id]).weight, 3, id);
});
