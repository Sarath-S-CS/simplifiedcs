// Example reports. Each is a FICTIONAL organization - a fixed answer set run
// through the real engine (report-model.js), not a hand-built report, so the
// examples always reflect the current methodology. Nothing here describes a
// real company, and no example claims a live vulnerability lookup happened.
//
// Two profiles, because they are who the tool is most often for:
//   itServices - a 40-person IT services / software consultancy with a
//                hybrid estate and partly outsourced security
//   saas       - a ~150-person cloud-native SaaS company with a dedicated
//                security team
// Both are realistic mixtures of solid practice and specific gaps.
// test/sample-scenario.test.js walks each through the real question flows,
// so an answer set can't go stale (every visible question must be answered).

const IT_SERVICES = {
  industry: "itservices",
  regions: ["uk"],
  soc2: true,
  companyName: "Example IT services firm (fictional)",

  employeeCount: "11–50",

  teamDedicated: "Our IT team takes care of both IT and cybersecurity",
  combinedHeadcount: "3–10",
  dayToDay: ["partial-outsource"],
  partialOutsourceFunctions: ["soc-monitoring", "backup-dr"],
  cyberInsurance: "Yes",
  incidentRecoveryOwner: "Internal team",
  vendorCount: "6 or more",

  hasAntivirus: "Yes",
  antivirusVendor: "Microsoft Defender Antivirus",
  edrVendor: "Microsoft Defender for Endpoint",
  emailSecurityVendor: "Microsoft Defender for Office 365",
  awarenessLms: "",
  dlpUsed: "No",
  deployModel: "Hybrid (on-prem + cloud)",
  cloudProvider: "Microsoft Azure",
  endpointOs: ["Windows", "macOS"],
  sdwanUsed: "No",
  networkArch: "Segmented (VLANs / zones)",
  externalDevices: "Yes",
  edgeDeviceVendor: "Fortinet FortiGate",
  externalWebsite: "Yes",
  webDb: "Yes",
  hostingProvider: "Microsoft Azure",
  webServerStack: "IIS on Windows Server 2019",

  usesContainers: "No",
  usesVirtualization: "Yes, on-prem hypervisor (e.g. VMware, Hyper-V)",
  hypervisorPatching: "Scheduled maintenance windows",
  vmSegmentation: "Partially segmented",

  developsSoftware: "Yes",
  devsecopsMaturity: "Security scanning exists but isn't enforced in the pipeline",
  secretsManagement: "Environment variables, informally managed",

  aiUsage: "Yes, broadly across the organization",
  aiUsageTypes: ["enterprise-ai", "free-personal-ai", "ai-dev-tools"],

  govPolicy: 1,
  govRoles: 1,
  govReporting: 1,
  govRiskDecisions: 1,
  vendorAccessReview: 1,
  aiToolGovernance: 0,
  aiRiskOwnership: 0,
  assetInv: 1,
  dataClass: 0,
  mfa: 1,
  passkeys: 0,
  patching: 1,
  dbEncryption: 2,
  dbAccessControl: 1,
  dbPatching: 1,
  training: 1,
  trainingCadence: 0,
  phishingSim: 0,
  aiCodeReviewParity: 1,
  aiDeepfakeTraining: 0,
  aiVerificationStep: 1,
  endpoint: 2,
  rdpExposed: 2,
  emailAuth: 1,
  privSeparation: 1,
  privilegedAccessModel: 0,
  privAccountMgmt: 1,
  passwordPolicy: 1,
  passwordManager: 2,
  offboarding: 1,
  soc2Change: 1,
  siem: 2,
  anomalyTime: 2,
  exfil: 0,
  vulnScanning: 1,
  pentest: 0,
  soc2Evidence: 1,
  irPlan: 1,
  irTeam: 2,
  commsPlan: 0,
  backupTest: 1,
  bcdr: 0,
  backupIsolation: 2,
};

const SAAS = {
  industry: "saas",
  regions: ["eu", "na"],
  soc2: true,
  gdpr: true,
  companyName: "Example SaaS company (fictional)",

  employeeCount: "51–200",

  teamDedicated: "Yes, dedicated IT and cybersecurity team",
  itHeadcountSeparate: "3–10",
  cybersecHeadcount: "1–2",
  dayToDay: ["mdr-msp"],
  mdrProviderName: "",
  mdrMspProviderName: "",
  socOwnership: "Hybrid - some in-house, some third-party",
  cyberInsurance: "Yes",
  incidentRecoveryOwner: "Internal team",
  vendorCount: "6 or more",

  hasAntivirus: "Yes",
  antivirusVendor: "",
  edrVendor: "",
  emailSecurityVendor: "",
  awarenessLms: "",
  dlpUsed: "Not sure",
  deployModel: "Cloud-only",
  cloudProvider: "Amazon Web Services (AWS)",
  endpointOs: ["macOS", "Linux"],
  sdwanUsed: "No",
  networkArch: "Zero-trust / microsegmented",
  externalDevices: "No",
  externalWebsite: "Yes",
  webDb: "Yes",
  hostingProvider: "Amazon Web Services (AWS)",
  webServerStack: "",

  usesContainers: "Yes, most/all workloads",
  containerOrchestration: "Yes",
  containerImageScanning: "Occasionally",
  containerHostSecurity: "Hardened and patched on a defined cadence",
  usesVirtualization: "Yes, cloud VM instances",
  vmSegmentation: "Yes, fully segmented",

  developsSoftware: "Yes",
  devsecopsMaturity: "Security gates (SAST/dependency scanning) enforced in CI/CD",
  secretsManagement: "Dedicated secrets manager (e.g. Vault, cloud KMS)",

  aiUsage: "Yes, limited to specific teams or tools",
  aiUsageTypes: ["ai-dev-tools", "custom-ai-app"],
  aiCustomAppRAG: "Yes",

  govPolicy: 2,
  govRoles: 2,
  govReporting: 1,
  govRiskDecisions: 2,
  vendorAccessReview: 1,
  gdprRopa: 1,
  gdprDSR: 2,
  aiToolGovernance: 1,
  aiRiskOwnership: 1,
  assetInv: 2,
  dataClass: 2,
  mfa: 2,
  passkeys: 1,
  patching: 2,
  dbEncryption: 2,
  dbAccessControl: 2,
  dbPatching: 2,
  training: 2,
  trainingCadence: 1,
  phishingSim: 1,
  aiRagPermissions: 1,
  aiCodeReviewParity: 2,
  aiDeepfakeTraining: 1,
  aiVerificationStep: 2,
  endpoint: 2,
  rdpExposed: 2,
  emailAuth: 2,
  privSeparation: 2,
  privilegedAccessModel: 1,
  privAccountMgmt: 2,
  passwordPolicy: 2,
  passwordManager: 2,
  offboarding: 2,
  soc2Change: 2,
  siem: 2,
  anomalyTime: 2,
  exfil: 0,
  vulnScanning: 2,
  pentest: 2,
  soc2Evidence: 1,
  irPlan: 1,
  irTeam: 2,
  commsPlan: 2,
  gdprBreach72h: 1,
  backupTest: "unknown",
  bcdr: 2,
  backupIsolation: 2,
};

// Static AI-insights examples, in the live response format (schema 2).
// Deliberately no vulnerability advisories: showing a CVE match for a real
// product on a fictional company would be a made-up vulnerability claim,
// and no lookup is run for examples. Source status says exactly that.
function exampleAi(products, patterns, narrative) {
  return {
    schemaVersion: 2,
    example: true,
    sourceStatus: products.map((p) => ({
      productKey: p.key,
      name: p.name,
      category: p.category,
      kind: "software",
      kev: "not-checked-example",
      nvd: "not-checked-example",
      notes: ["Example report - no live lookup was run."],
    })),
    advisories: [],
    patterns,
    narrative,
    limitations: ["This is an illustration of the AI-insights format using fictional answers. No vulnerability sources were queried for it."],
    dropped: { advisories: 0, patterns: 0 },
  };
}

export const SAMPLE_SCENARIOS = {
  itServices: {
    id: "itServices",
    label: "IT services firm",
    blurb: "A fictional 40-person IT services and software consultancy: hybrid estate, security monitoring partly outsourced, SOC 2 in scope.",
    answers: IT_SERVICES,
    ai: exampleAi(
      [
        { key: "p0-fortinet-fortigate", name: "Fortinet FortiGate", category: "edge device / firewall" },
        { key: "p1-microsoft-defender-for-endpoint", name: "Microsoft Defender for Endpoint", category: "EDR" },
      ],
      [
        {
          finding: "Free personal AI tools are in use with no usage policy, while client software is developed in-house",
          why: "Staff pasting client code or data into unmanaged AI tools is a realistic leak path for a consultancy, and nothing in these answers limits it. It sits alongside - not inside - the scored AI governance gap, because it's the combination with client work that raises the stakes.",
          basedOn: [
            "Which of the following describes how AI is used in your environment?",
            "Is the organization's use of AI tools tracked and governed?",
            "Does your organization develop or maintain custom software/applications?",
          ],
        },
      ],
      "In this example, day-to-day protections such as endpoint coverage, logging and isolated backups are in place. The gaps that matter most are MFA covering admin accounts only in a hybrid environment, and incident and continuity planning that hasn't been tested."
    ),
  },
  saas: {
    id: "saas",
    label: "SaaS company",
    blurb: "A fictional ~150-person cloud-native SaaS company: dedicated security team, containers on AWS, SOC 2 and GDPR in scope.",
    answers: SAAS,
    ai: exampleAi(
      [{ key: "p0-amazon-web-services-aws", name: "Amazon Web Services (AWS)", category: "cloud provider" }],
      [
        {
          finding: "An internal AI assistant searches company documents with only partly permission-aware retrieval, and AI-risk ownership is only partly defined",
          why: "Neither answer is a gap on its own, but together they mean the assistant could surface documents to people who can't normally open them, with no one clearly responsible for noticing. Worth a targeted test with a low-privilege account.",
          basedOn: [
            "Does that retrieval respect the same access permissions the underlying documents already have?",
            "Is there a named, accountable owner for AI-related risk in your organization?",
          ],
        },
      ],
      "In this example, most controls are in place and none of the critical controls is missing. The main open questions are whether backups have actually been restore-tested (answered \"Not sure\") and whether large outbound data transfers from the customer-facing app would be noticed."
    ),
  },
};

export const DEFAULT_SAMPLE = "itServices";
