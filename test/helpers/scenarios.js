// Drives the real question flows the way the UI does (ask the engine what
// to show next, answer it, move on), so tests exercise branching, dedupe
// and visibility exactly as a visitor would experience them.
import assert from "node:assert/strict";
import { resolveNext } from "../../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../../src/engine/state.js";
import { PROFILE_SCREENS } from "../../src/data/profile-flow.js";
import { ASSESSMENT_FLOW } from "../../src/data/assessment-flow.js";

// Answer to give a node that has no entry in the scenario: undefined makes
// driveFlow fail loudly, so every scenario lists what it answers.
export function driveFlow(state, flow, answers, { fallback } = {}) {
  let id = resolveNext(flow, null, state);
  let guard = 0;
  while (id !== null) {
    if (++guard > 300) throw new Error(`driveFlow: possible infinite loop around "${id}"`);
    const node = flow.index.get(id);
    let value = answers[id];
    if (value === undefined && fallback) value = fallback(node);
    assert.notEqual(value, undefined, `scenario has no answer for visible node "${id}"`);
    recordAnswer(state, node, value);
    id = resolveNext(flow, id, state);
  }
}

// scope: scope-screen answers (industry, frameworks...), set directly like
// renderScope() does.
export function runScenario(answers, { quickMode = false, scope = {}, fallback } = {}) {
  const state = createSessionState();
  state.quickMode = quickMode;
  Object.assign(state.answers, scope);
  for (const screen of PROFILE_SCREENS) {
    if (screen.skipIf && screen.skipIf(state.answers)) continue;
    driveFlow(state, screen.flow, answers, { fallback });
  }
  driveFlow(state, ASSESSMENT_FLOW, answers, { fallback });
  return state;
}

// A realistic, deliberately weak answer set covering every node reachable
// on this branch path, including pure vendor-identification fields.
export const WEAK_ANSWERS = {
  employeeCount: "51–200",

  teamDedicated: "Our IT team takes care of both IT and cybersecurity",
  combinedHeadcount: "3–10",
  dayToDay: ["full-msp"],
  fullMspProviderName: "Kyndryl",
  mspSocOwner: "Same MSP",
  cyberInsurance: "No",
  incidentRecoveryOwner: "Not defined",
  vendorCount: "6 or more",

  hasAntivirus: "Yes",
  antivirusVendor: "Cisco",
  edrVendor: "Cisco",
  emailSecurityVendor: "Mimecast",
  awarenessLms: "KnowBe4",
  dlpUsed: "No",
  deployModel: "Hybrid (on-prem + cloud)",
  cloudProvider: "Microsoft Azure",
  endpointOs: ["Windows", "Linux"],
  sdwanUsed: "No",
  networkArch: "Flat / mostly unsegmented",
  externalDevices: "Yes",
  edgeDeviceVendor: "Fortinet",
  edgeDeviceVersion: "",
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

  aiUsage: "Yes, broadly across the organization",
  aiUsageTypes: ["custom-ai-app", "ai-dev-tools"],
  aiCustomAppRAG: "Yes",

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
  vendorAccessReview: 0,
  aiToolGovernance: 0,
  aiRiskOwnership: 0,
  isoIsms: 0,
  assetInv: 0,
  dataClass: 0,
  isoRiskAssess: 0,
  mfa: 0,
  passkeys: 0,
  patching: 0,
  dbEncryption: 0,
  dbAccessControl: 0,
  dbPatching: 1,
  training: 0,
  phishingSim: 0,
  aiRagPermissions: 0,
  aiCodeReviewParity: 0,
  aiDeepfakeTraining: 0,
  aiVerificationStep: 0,
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

// Picks the strongest graded option (scored) or a strong/neutral option
// (profile) - for building "everything in place" scenarios.
export function bestAnswer(node) {
  if (node.kind === "scored") return Math.max(...node.options.filter((o) => typeof o.v === "number").map((o) => o.v));
  if (node.type === "multiselect") return node.required ? [node.options[0].id] : [];
  if (node.type === "vendor" || node.type === "text") return "";
  return node.options[node.options.length - 1] === "Not sure" ? node.options[node.options.length - 2] : node.options[node.options.length - 1];
}
