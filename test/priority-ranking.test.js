// "Where to act first, ranked" must be ranked by risk, not by the order the
// questions happened to be asked. These replay the two live assessments run
// against simplifiedcs.net during the review that found the problem (answer
// sets copied from those runs), where the old ranking put governance
// paperwork and passkeys above internet-exposed RDP, missing logging, and
// untested or non-isolated backups.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionState } from "../src/engine/state.js";
import { computeGapItems, computeRankedGaps, computePriorities } from "../src/engine/scoring.js";
import { controlWeight } from "../src/data/control-weights.js";
import { SAMPLE_ANSWERS } from "../src/data/sample-scenario.js";

function stateWith(answers) {
  const state = createSessionState();
  Object.assign(state.answers, answers);
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
  const top = computePriorities(stateWith(ENERGY_FULL)).map((p) => p.id);
  assert.deepEqual(top, ["mfa", "rdpExposed", "backupTest", "privAccountMgmt", "siem"]);
});

test("energy run: passkeys (a maturity refinement) ranks below internet-exposed RDP and missing logging", () => {
  const ranked = computeRankedGaps(stateWith(ENERGY_FULL));
  const rankOf = (id) => ranked.find((g) => g.id === id).rank;
  assert.ok(rankOf("passkeys") > rankOf("rdpExposed"));
  assert.ok(rankOf("passkeys") > rankOf("siem"));
  assert.ok(rankOf("passkeys") > 5);
});

test("healthcare run: non-isolated backups and unmonitored exfiltration outrank governance paperwork", () => {
  const top = computePriorities(stateWith(HEALTHCARE_QUICK)).map((p) => p.id);
  assert.equal(top[0], "backupIsolation");
  assert.equal(top[1], "exfil", "exfil also feeds the exposed-database flag, so it gets the flag boost");
  for (const paperwork of ["govPolicy", "govRoles", "aiToolGovernance", "aiRiskOwnership"]) assert.ok(!top.includes(paperwork), `${paperwork} should not be in the top five`);
});

test("ranked list contains every gap exactly once, with consecutive ranks", () => {
  for (const answers of [HEALTHCARE_QUICK, ENERGY_FULL, SAMPLE_ANSWERS]) {
    const state = stateWith(answers);
    const gaps = computeGapItems(state).map((g) => g.id).sort();
    const ranked = computeRankedGaps(state);
    assert.deepEqual(ranked.map((g) => g.id).sort(), gaps);
    assert.deepEqual(ranked.map((g) => g.rank), ranked.map((_, i) => i + 1));
    for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].priorityScore >= ranked[i].priorityScore);
  }
});

test("a partial answer on a critical control ranks between a full gap and a standard gap", () => {
  const ranked = computeRankedGaps(stateWith(HEALTHCARE_QUICK));
  const score = (id) => ranked.find((g) => g.id === id).priorityScore;
  // mfa answered "Admin accounts only" (1 of 2) on a critical (3) control.
  assert.equal(score("mfa"), 1.5);
  assert.ok(score("mfa") < score("backupIsolation"));
  assert.ok(score("mfa") > score("govPolicy"));
});

test("control weights default to standard for unlisted questions", () => {
  assert.equal(controlWeight("mfa"), 3);
  assert.equal(controlWeight("siem"), 2);
  assert.equal(controlWeight("govPolicy"), 1);
  assert.equal(controlWeight("no-such-question"), 1);
});
