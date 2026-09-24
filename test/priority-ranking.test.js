// "Where to act first" must be ranked by risk, not by the order the
// questions happened to be asked. These replay the two live assessments run
// against simplifiedcs.net during the August 2026 review (answer sets copied
// from those runs, so they use the old v1 answer format and go through the
// same migration a saved run would), where the original ranking put
// governance paperwork and passkeys above internet-exposed RDP, missing
// logging, and untested or non-isolated backups.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { computeFindings } from "../src/engine/scoring.js";
import { buildReport } from "../src/engine/report-model.js";
import { migrateAnswers } from "../src/engine/migrate.js";
import { SAMPLE_SCENARIOS } from "../src/data/sample-scenario.js";

function stateWith(answers) {
  const state = createSessionState();
  Object.assign(state.answers, migrateAnswers(answers, 1).answers);
  return state;
}

// Quick run: Healthcare, UK, 1-10 staff, hybrid, flat network, a
// customer-facing web app backed by a database.
const HEALTHCARE_QUICK = {
  industry: "health", regions: ["uk"], employeeCount: "1–10",
  teamDedicated: "Our IT team takes care of both IT and cybersecurity", combinedHeadcount: "3–10",
  deployModel: "Hybrid (on-prem + cloud)", networkArch: "Flat / mostly unsegmented",
  externalDevices: "Yes", externalWebsite: "Yes", webDb: "Yes", aiUsage: "Not sure", hasOT: "Not sure",
  govPolicy: 0, govRoles: 0, govReporting: 1, govRiskDecisions: 2, aiToolGovernance: 0, aiRiskOwnership: 0,
  assetInv: 2, dataClass: 2, vendorCount: 0,
  mfa: 1, passkeys: 1, patching: 2, dbEncryption: 2, dbAccessControl: 2, dbPatching: 0, training: 2, phishingSim: 1,
  trainingCadence: 2, endpoint: 2, rdpExposed: 2, emailAuth: 2, privSeparation: 0, privAccountMgmt: 2, passwordPolicy: 1,
  passwordManager: 2, offboarding: 1, aiDeepfakeTraining: 0, aiVerificationStep: 0,
  siem: 2, anomalyTime: 1, exfil: 0, vulnScanning: 1, pentest: 2,
  irPlan: 2, irTeam: 0, commsPlan: 2,
  backupTest: 2, bcdr: 0, backupIsolation: 0,
};

// Full run: Energy, NIS2 selected, 1,000+ staff, cloud-only, RDP exposed.
const ENERGY_FULL = {
  industry: "energy", regions: ["africa"], nis2: true, employeeCount: "1,000+",
  deployModel: "Cloud-only", networkArch: "Zero-trust / microsegmented", externalDevices: "Yes", externalWebsite: "No",
  aiUsage: "Not sure", hasOT: "Not sure",
  govPolicy: 1, govRoles: 1, govReporting: 1, govRiskDecisions: 0, nis2Training: 0, aiToolGovernance: 2, aiRiskOwnership: 2,
  assetInv: 1, dataClass: 2, vendorCount: 1,
  mfa: 0, passkeys: 0, patching: 1, training: 2, phishingSim: 0, trainingCadence: 0, endpoint: 1, rdpExposed: 0,
  emailAuth: 1, privSeparation: 0, privAccountMgmt: 0, passwordPolicy: 0, passwordManager: 1, offboarding: 2,
  aiDeepfakeTraining: 0, aiVerificationStep: 0,
  siem: 0, anomalyTime: 0, exfil: 0, vulnScanning: 0, pentest: 2,
  irPlan: 1, irTeam: 2, commsPlan: 0, nis2Notify: 1,
  backupTest: 0, bcdr: 2, backupIsolation: 2,
};

test("energy run: exposed RDP, no MFA, untested backups and shared admin creds lead the list", () => {
  const top = computeFindings(stateWith(ENERGY_FULL)).slice(0, 4).map((p) => p.id);
  assert.deepEqual([...top].sort(), ["backupTest", "mfa", "privAccountMgmt", "rdpExposed"]);
});

test("energy run: passkeys (a maturity refinement) ranks below internet-exposed RDP and missing logging", () => {
  const ranked = computeFindings(stateWith(ENERGY_FULL));
  const rankOf = (id) => ranked.find((g) => g.id === id).rank;
  assert.ok(rankOf("passkeys") > rankOf("rdpExposed"));
  assert.ok(rankOf("passkeys") > rankOf("siem"));
  assert.ok(rankOf("passkeys") > 5);
});

test("healthcare run: non-isolated backups lead; governance paperwork stays out of the top five", () => {
  const ranked = computeFindings(stateWith(HEALTHCARE_QUICK));
  const top = ranked.slice(0, 5).map((p) => p.id);
  assert.equal(top[0], "backupIsolation");
  // MFA on admin accounts only, in a hybrid organization, is a critical gap.
  assert.ok(top.includes("mfa"));
  assert.ok(top.includes("exfil"), "exfil also feeds the exposed-database finding");
  for (const paperwork of ["govPolicy", "govRoles", "aiToolGovernance", "aiRiskOwnership"]) assert.ok(!top.includes(paperwork), `${paperwork} should not be in the top five`);
});

test("ranked list contains every non-met control exactly once, with consecutive ranks and non-increasing scores", () => {
  for (const answers of [HEALTHCARE_QUICK, ENERGY_FULL, SAMPLE_SCENARIOS.itServices.answers, SAMPLE_SCENARIOS.saas.answers]) {
    const state = stateWith(answers);
    const report = buildReport(state);
    const expected = report.controls.filter((c) => ["gap", "partial", "unknown"].includes(c.status)).map((c) => c.id);
    const ranked = computeFindings(state);
    for (const id of expected) assert.equal(ranked.filter((g) => g.id === id).length, 1, id);
    assert.deepEqual(ranked.map((g) => g.rank), ranked.map((_, i) => i + 1));
    for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].priorityScore >= ranked[i].priorityScore);
  }
});

test("a partial answer on a critical control outranks a standard-weight gap, and says why", () => {
  const ranked = computeFindings(stateWith(HEALTHCARE_QUICK));
  const item = (id) => ranked.find((g) => g.id === id);
  assert.ok(item("mfa").priorityScore > item("govPolicy").priorityScore);
  assert.ok(item("mfa").reasons.some((r) => /admin accounts only/.test(r)));
  assert.ok(item("govPolicy").reasons.some((r) => /Your answer/.test(r)));
});

test("old saved answers are migrated, not misread: v1 vendorCount becomes count + review", () => {
  const { answers, notes } = migrateAnswers({ vendorCount: 0, mfa: 2 }, 1);
  assert.equal(answers.vendorCount, "6 or more");
  assert.equal(answers.vendorAccessReview, 0);
  assert.ok(notes.length >= 1);
  assert.equal(migrateAnswers({ vendorCount: 2 }, 1).answers.vendorCount, "None");
  assert.equal(migrateAnswers({ pcidssSensitiveAuthData: 1 }, 1).answers.pcidssSensitiveAuthData, "unknown");
});
