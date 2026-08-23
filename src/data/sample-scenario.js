// ASSESSMENT-EXPERIENCE-BRIEF.md §6: the fixed, realistic answer set behind
// "See a Sample Report". Deliberately a REALISTIC MIXED profile, not a
// worst-case one - a mid-size healthcare org with genuinely solid practices
// in some areas (recurring training, enforced logging, segmented network)
// and a couple of specific, real gaps (MFA not enforced, no outbound
// monitoring on a DB-connected public app) - enough for the compounding-risk
// engine, MITRE mapping, and vendor notes to all have something real to
// show, without reading as a five-alarm fire.
//
// Same architecture principle as §1: this is answers fed through the real
// engine (scoring.js/computeFlags/vendor-notes.js/etc.), not a hardcoded
// fake report object, so the sample automatically stays correct as the
// scoring/rules logic evolves instead of needing separate upkeep.
export const SAMPLE_ANSWERS = {
  industry: "health",
  hipaa: true,

  employeeCount: "201–1,000",

  teamDedicated: "Yes, dedicated IT and cybersecurity team",
  itHeadcountSeparate: "3–10",
  cybersecHeadcount: "1–2",
  dayToDay: ["inhouse-all"],
  inhouseSocCapability: "Some in-house, some gaps",

  hasAntivirus: "Yes",
  antivirusVendor: "Bitdefender",
  edrVendor: "CrowdStrike Falcon",
  emailSecurityVendor: "Mimecast",
  awarenessLms: "KnowBe4",
  dlpUsed: "Yes",
  dlpVendor: "Microsoft Purview",
  deployModel: "Hybrid (on-prem + cloud)",
  cloudProvider: "Microsoft Azure",
  sdwanUsed: "No",
  networkArch: "Segmented (VLANs / zones)",
  externalDevices: "Yes",
  edgeDeviceVendor: "Fortinet FortiGate",
  externalWebsite: "Yes",
  webDb: "Yes",
  hostingProvider: "Amazon Web Services (AWS)",
  webServerStack: "Nginx on Ubuntu 22.04",

  usesContainers: "Yes, some workloads",
  containerOrchestration: "Yes",
  containerImageScanning: "Occasionally",
  containerHostSecurity: "Some hardening (e.g. minimal base images)",
  usesVirtualization: "Yes, on-prem hypervisor (e.g. VMware, Hyper-V)",
  hypervisorPatching: "Scheduled maintenance windows",
  vmSegmentation: "Partially segmented",

  developsSoftware: "Yes",
  devsecopsMaturity: "Security scanning exists but isn't enforced in the pipeline",
  secretsManagement: "Environment variables, informally managed",

  hasOT: "No",

  govPolicy: 1,
  govRoles: 2,
  govReporting: 1,
  govRiskDecisions: 1,
  hipaaBAA: 1,
  aiToolGovernance: 1,
  assetInv: 1,
  dataClass: 2,
  vendorCount: 1,
  hipaaRiskAnalysis: 1,
  mfa: 0,
  passkeys: 0,
  patching: 1,
  dbEncryption: 0,
  dbAccessControl: 0,
  dbPatching: 1,
  training: 2,
  phishingSim: 1,
  trainingCadence: 2,
  endpoint: 2,
  rdpExposed: 2,
  emailAuth: 1,
  privSeparation: 2,
  privilegedAccessModel: 1,
  privAccountMgmt: 1,
  passwordPolicy: 2,
  passwordManager: 1,
  offboarding: 1,
  hipaaEncryption: 2,
  siem: 2,
  anomalyTime: 1,
  exfil: 0,
  vulnScanning: 1,
  pentest: 1,
  irPlan: 1,
  irTeam: 2,
  commsPlan: 2,
  backupTest: 1,
  bcdr: 2,
  backupIsolation: 0,
};

// ASSESSMENT-EXPERIENCE-BRIEF.md §6: "the AI-enhanced insights portion
// should be a well-written, static example - do not trigger a real live
// API call every time someone views the sample." Written to look like a
// genuine ai-insights.mts response for this exact answer set, kept
// separately from the live rendering path so it's obviously hand-authored.
export const SAMPLE_AI_INSIGHTS = {
  recency: [
    {
      vendorOrProduct: "Fortinet FortiGate",
      finding: "FortiGate/FortiOS has a recent history of critical, actively-exploited authentication-bypass CVEs. No CVE specific to this exact configuration was found, but firmware currency is worth confirming directly given that track record.",
      source: "CISA KEV catalog (pattern match, illustrative)",
    },
    {
      vendorOrProduct: "Mimecast",
      finding: "No current actively-exploited CVEs found against Mimecast's email security platform.",
      source: "NVD CVE database (illustrative)",
    },
  ],
  longTail: [
    {
      finding: "Segmented network architecture, but MFA not enforced at all",
      why: "A segmented network limits lateral movement after a breach, but doesn't stop the initial compromise - and with MFA off entirely, a single leaked password is enough to get in. These two answers don't individually look alarming, but MFA is usually the higher-leverage fix precisely because it blocks the step that happens before segmentation would even matter.",
    },
  ],
  narrative:
    "This is a reasonably well-run environment for its size - recurring security training, enforced logging, and a segmented network are all real, working fundamentals. The two flagged gaps (no MFA enforcement, and no outbound-traffic monitoring on a database-connected public app) are specific and fixable rather than symptomatic of a broader absence of controls, which is a meaningfully different starting point than an org with no program at all.",
};
