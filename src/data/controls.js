// The controls catalog: everything the scoring engine needs to know about a
// control beyond its question text - how much it matters, which framework
// references it aligns to, and what doing something about it looks like.
//
// Methodology (explained to visitors on /methodology and in the report):
//   - Every security-relevant answer is either a scored control (here), a
//     finding-only item, context used to decide what applies, vendor
//     identification, or an informational note (PROFILE_DESIGNATIONS below).
//   - A scored control's answer resolves to one status: met, partial, gap,
//     unknown ("Not sure"), not applicable, or not asked (Quick mode).
//   - Weights are priority tiers, not precision: 3 = critical, 2 = high
//     impact, 1 = standard. They follow the priorities in CISA's Cross-Sector
//     Cybersecurity Performance Goals and the CISA/MS-ISAC #StopRansomware
//     Guide - the controls those documents put first because they block the
//     most common initial-access paths or decide whether an organization can
//     recover at all.
//
// Framework references: `csf` lists NIST CSF 2.0 subcategory ids and `cis`
// lists CIS Controls v8.1 safeguard ids. These are SimplifiedCS's own
// editorial alignment of each question to the closest outcomes - not an
// official NIST or CIS crosswalk, and not a statement of compliance. Every id
// is checked against the official identifier lists in ./references/ by
// test/control-catalog.test.js; an empty list means we found no clean match
// and chose not to force one.

export const METHODOLOGY_VERSION = "2.0.0";
export const QUESTION_SET_VERSION = "2026-09";

// Stored answer values for the two non-graded options every scored question
// can offer. Graded options keep their numeric 0/1/2 values.
export const UNKNOWN = "unknown";
export const NOT_APPLICABLE = "na";

export const STATUS = {
  MET: "met",
  PARTIAL: "partial",
  GAP: "gap",
  UNKNOWN: "unknown",
  NA: "not-applicable",
  NOT_ASKED: "not-asked",
  UNANSWERED: "unanswered",
};

export const STATUS_LABELS = {
  met: "In place",
  partial: "Partly in place",
  gap: "Not in place",
  unknown: "Not sure",
  "not-applicable": "Not applicable",
  "not-asked": "Not asked (Quick screening)",
  unanswered: "Not answered",
};

export const WEIGHT_LABELS = { 3: "Critical control", 2: "High impact", 1: "Standard" };

// Effort: Low = configuration or a decision, usually days; Medium = a small
// project or modest spend, usually weeks; High = a multi-month program or
// significant spend.
export const EFFORT_LABELS = { low: "Low", medium: "Medium", high: "High" };

function c(weight, csf, cis, action, extra) {
  return { weight, csf, cis, action, ...extra };
}
function act(title, role, effort, evidence) {
  return { title, role, effort, evidence };
}

// Keyed by scored-question id (src/data/nist-questions.js).
// `quick: true` marks the controls Quick screening asks.
export const CONTROL_META = {
  // ---------------- Govern ----------------
  govPolicy: c(1, ["GV.PO-01", "GV.PO-02"], [], act("Approve a short, current security policy", "Leadership", "low", "Policy document with approval date and next review date")),
  govRoles: c(1, ["GV.RR-02"], [], act("Assign named owners for security responsibilities", "Leadership", "low", "Written list (RACI) of security responsibilities and their owners"), { quick: true }),
  govReporting: c(1, ["GV.OV-01", "GV.OV-03"], [], act("Report security risk to leadership on a schedule", "Security lead", "low", "Dated leadership reports or meeting minutes covering security risk")),
  govRiskDecisions: c(1, ["GV.RM-03", "GV.SC-06"], ["15.5"], act("Add a security check to vendor and product approvals", "Leadership", "low", "Approval checklist showing the security review step, with recent examples")),
  vendorAccessReview: c(2, ["GV.SC-04", "GV.SC-07"], ["15.1", "15.5", "15.6"], act("Review third parties that can access your systems or data", "Security lead", "medium", "Vendor inventory with access scope, last review date and outcome"), { quick: true }),
  isoIsms: c(1, ["GV.PO-01", "GV.OV-02"], [], act("Define the ISMS scope and hold management reviews", "Compliance lead", "high", "ISMS scope statement and management review minutes")),
  nis2Training: c(1, ["GV.RR-01", "PR.AT-02"], ["14.9"], act("Train the management body on cyber-risk oversight", "Leadership", "low", "Training attendance records for accountable executives")),
  hipaaBAA: c(1, ["GV.SC-05", "GV.OC-03"], ["15.4"], act("Sign BAAs with every vendor that handles PHI", "Compliance lead", "medium", "Register of PHI vendors with signed BAA dates")),
  gdprRopa: c(1, ["GV.OC-03", "ID.AM-07"], ["3.2", "3.8"], act("Build and maintain a record of processing activities", "Privacy lead", "medium", "Current ROPA with lawful basis per processing activity")),
  gdprDSR: c(1, ["GV.OC-03"], [], act("Document the data-subject-request process", "Privacy lead", "low", "Written procedure and a log of handled requests with response times")),
  aiToolGovernance: c(1, ["GV.PO-01", "ID.AM-02"], ["2.1"], act("Publish an AI usage policy and track approved tools", "Security lead", "low", "AI usage policy and an inventory of approved AI tools")),
  aiRiskOwnership: c(1, ["GV.RR-02", "ID.IM-04"], [], act("Name an AI-risk owner and add an AI scenario to the IR plan", "Leadership", "low", "Named owner in writing; IR plan section covering an AI-specific scenario")),

  // ---------------- Identify ----------------
  assetInv: c(2, ["ID.AM-01", "ID.AM-02"], ["1.1", "1.3", "2.1"], act("Build an asset inventory and keep it current", "IT lead", "medium", "Inventory export with last-updated date covering devices, servers and cloud services"), { quick: true }),
  dataClass: c(1, ["ID.AM-05", "ID.AM-07"], ["3.7"], act("Classify data by sensitivity", "Security lead", "medium", "Classification scheme and labels applied to major data stores")),
  isoRiskAssess: c(1, ["ID.RA-04", "ID.RA-05"], [], act("Run a documented annual risk assessment", "Compliance lead", "medium", "Dated risk assessment with a risk register and treatment decisions")),
  hipaaRiskAnalysis: c(1, ["ID.RA-04", "ID.RA-05"], [], act("Complete a current HIPAA security risk analysis", "Compliance lead", "medium", "Dated risk analysis covering every ePHI system")),

  // ---------------- Protect ----------------
  mfa: c(3, ["PR.AA-03"], ["6.3", "6.4", "6.5"], act("Enforce MFA for remote, cloud and admin access", "IT lead", "low", "Identity-provider report showing MFA enforced for all users and admin roles"), { quick: true }),
  passkeys: c(1, ["PR.AA-03"], [], act("Offer passkeys for key systems and accounts", "IT lead", "medium", "Identity-provider settings showing passkeys enabled, with adoption numbers")),
  patching: c(3, ["PR.PS-02"], ["7.3", "7.4", "7.7"], act("Patch on a defined schedule, fastest for known-exploited flaws", "IT lead", "medium", "Patch-compliance report and the written patching timeframes"), { quick: true }),
  dbEncryption: c(2, ["PR.DS-01"], ["3.11"], act("Encrypt databases at rest", "IT lead", "low", "Database or cloud console setting showing encryption at rest")),
  dbAccessControl: c(2, ["PR.AA-05"], ["3.3", "5.4"], act("Give applications least-privilege database accounts", "Developers", "medium", "List of application database accounts and their granted permissions")),
  dbPatching: c(2, ["PR.PS-02"], ["7.4"], act("Keep database software patched", "IT lead", "low", "Database version report against the vendor's supported versions")),
  training: c(2, ["PR.AT-01"], ["14.1", "14.2"], act("Run recurring security awareness training", "Security lead", "low", "Training completion records for the last 12 months")),
  phishingSim: c(1, ["PR.AT-01"], ["14.2"], act("Run regular phishing simulations", "Security lead", "low", "Simulation results over time (click and report rates)")),
  trainingCadence: c(1, ["PR.AT-01"], ["14.1"], act("Move training to a recurring cadence", "Security lead", "low", "Training calendar and completion records")),
  endpoint: c(3, ["DE.CM-09"], ["10.1", "10.7"], act("Put endpoint protection (EDR) on every device", "IT lead", "medium", "EDR console device count matched against the asset inventory"), { quick: true }),
  rdpExposed: c(3, ["PR.IR-01"], ["12.7", "13.5"], act("Take remote-admin access off the open internet", "IT lead", "low", "External scan showing no RDP/SSH/admin ports exposed; VPN/ZTNA configuration"), { quick: true }),
  emailAuth: c(2, [], ["9.5"], act("Enforce SPF, DKIM and DMARC for your domain", "IT lead", "low", "DNS records and DMARC policy set to quarantine or reject")),
  privSeparation: c(2, ["PR.AA-05"], ["5.4"], act("Separate admin accounts from everyday accounts", "IT lead", "low", "List of admin accounts, each distinct from the owner's daily account")),
  privilegedAccessModel: c(1, ["PR.AA-05"], [], act("Grant elevated access just in time", "IT lead", "medium", "Privileged-access tool or process records showing time-bound elevation")),
  privAccountMgmt: c(3, ["PR.AA-01", "PR.AA-05"], ["5.1", "5.2", "5.4"], act("Individually assign, review and rotate privileged accounts", "IT lead", "medium", "Privileged account inventory with owners and last review/rotation dates")),
  passwordPolicy: c(1, ["PR.AA-01"], ["5.2"], act("Enforce a strong password policy", "IT lead", "low", "Identity-provider password settings")),
  passwordManager: c(1, ["PR.AA-01"], ["5.2"], act("Provide an organization password manager", "IT lead", "low", "Password manager licence and adoption numbers")),
  offboarding: c(2, ["PR.AA-01", "PR.AA-05"], ["5.3", "6.2"], act("Revoke all access immediately when people leave or move", "HR / IT lead", "low", "Offboarding checklist and recent leaver tickets with access-removal times")),
  soc2Change: c(1, ["PR.PS-01", "ID.RA-07"], [], act("Document and enforce change management for production", "IT lead", "medium", "Change records with approvals for recent production changes")),
  hipaaEncryption: c(2, ["PR.DS-01", "PR.DS-02"], ["3.10", "3.11"], act("Encrypt PHI at rest and in transit", "IT lead", "medium", "Encryption settings for systems storing or sending PHI")),
  soxSoD: c(1, ["PR.AA-05"], ["6.8"], act("Enforce segregation of duties in financial systems", "Finance / IT lead", "medium", "Role matrix for financial systems showing conflicting duties separated")),
  soxAccessReview: c(1, ["PR.AA-05"], ["5.1"], act("Review financial-system access on a schedule", "Finance / IT lead", "low", "Signed periodic access review records")),
  cyberEssentialsBoundaryFirewall: c(2, ["PR.IR-01"], ["4.4", "12.2"], act("Set boundary firewalls to deny inbound by default", "IT lead", "low", "Firewall rule export showing default-deny inbound with documented exceptions")),
  cyberEssentialsSecureConfig: c(2, ["PR.PS-01"], ["4.1", "4.7", "4.8"], act("Apply a secure baseline before deploying devices", "IT lead", "medium", "Written baseline and build checklist")),
  pcidssCDESegmentation: c(2, ["PR.IR-01"], ["3.12", "12.2"], act("Segment the cardholder data environment", "IT lead", "high", "Network diagram and segmentation test results")),
  pcidssSensitiveAuthData: c(2, ["PR.DS-01"], ["3.4"], act("Stop retaining sensitive authentication data", "Developers", "medium", "Data discovery results showing no stored track data, CVV or PIN")),
  aiRagPermissions: c(2, ["PR.AA-05"], ["3.3"], act("Make AI retrieval respect document permissions", "Developers", "medium", "Test showing a user cannot retrieve documents they cannot open directly")),
  aiCodeReviewParity: c(1, ["PR.PS-06"], ["16.1"], act("Review AI-generated code like any other code", "Developers", "low", "Branch protection or review records covering AI-assisted changes")),
  aiDeepfakeTraining: c(1, ["PR.AT-01"], ["14.2"], act("Cover AI phishing and impersonation in training", "Security lead", "low", "Training module covering AI-generated phishing and voice/video impersonation")),
  aiVerificationStep: c(2, [], [], act("Require out-of-band verification for payment changes", "Finance lead", "low", "Written verification procedure and examples of it being applied")),

  // ---------------- Detect ----------------
  siem: c(2, ["PR.PS-04", "DE.AE-03"], ["8.2", "8.9"], act("Centralize security logs", "IT lead", "medium", "Log platform showing sources connected and retention period")),
  anomalyTime: c(2, ["DE.CM-03", "DE.AE-02"], ["8.11", "13.1"], act("Set up automated alerting on suspicious activity", "Security lead", "medium", "Alert rules for suspicious logins and who receives them"), { quick: true }),
  exfil: c(2, ["DE.CM-01"], ["3.13", "13.6"], act("Monitor for unusual outbound data transfers", "Security lead", "medium", "Outbound traffic or DLP alert configuration")),
  vulnScanning: c(2, ["ID.RA-01"], ["7.5", "7.6"], act("Scan internal and external systems on a schedule", "IT lead", "medium", "Scan schedule and recent scan reports")),
  pentest: c(1, ["ID.IM-02"], ["18.1", "18.2"], act("Commission an external penetration test", "Security lead", "medium", "Penetration test report dated within the last 12 months")),
  soc2Evidence: c(1, ["PR.PS-04"], ["8.10"], act("Retain control evidence across the audit period", "Compliance lead", "medium", "Evidence repository covering the review period")),
  soxAuditTrail: c(1, ["PR.PS-04"], ["8.3", "8.10"], act("Protect financial-system audit trails from tampering", "IT lead", "medium", "Audit log retention and immutability settings")),
  pcidssASVScanning: c(1, ["ID.RA-01"], ["7.6"], act("Run quarterly ASV external scans", "IT lead", "low", "Four most recent passing ASV scan reports")),

  // ---------------- Respond ----------------
  irPlan: c(2, ["ID.IM-04", "RS.MA-01"], ["17.4", "17.7"], act("Write and test an incident response plan", "Security lead", "medium", "Plan document and the date/outcome of the last exercise"), { quick: true }),
  irTeam: c(2, ["RS.MA-01"], ["17.1"], act("Designate an incident response contact", "Leadership", "low", "Named IR contact and deputy, published internally")),
  commsPlan: c(1, ["RS.CO-02", "RS.CO-03"], ["17.2", "17.6"], act("Prepare a breach communication plan", "Leadership", "low", "Communication plan with contact lists for legal, customers and regulators")),
  nis2Notify: c(1, ["RS.CO-02"], ["17.2"], act("Define the 24-hour NIS2 notification process", "Compliance lead", "low", "Notification procedure naming the authority and the owner")),
  gdprBreach72h: c(1, ["RS.CO-02"], ["17.2"], act("Define the 72-hour GDPR breach notification process", "Privacy lead", "low", "Notification procedure naming the supervisory authority and the owner")),

  // ---------------- Recover ----------------
  backupTest: c(3, ["PR.DS-11", "RC.RP-03"], ["11.5"], act("Test restores from backup on a schedule", "IT lead", "low", "Restore test log with dates, systems restored and time taken"), { quick: true }),
  bcdr: c(2, ["ID.IM-04", "RC.RP-01"], ["11.1"], act("Document a business continuity and recovery plan", "Leadership", "medium", "Plan document with recovery priorities and last review date")),
  backupIsolation: c(3, ["PR.DS-11"], ["11.4"], act("Keep an offline or immutable backup copy", "IT lead", "medium", "Backup configuration showing an offline/immutable copy and its retention"), { quick: true }),
};

// Profile-screen questions that are genuinely controls (an answer describes
// how well something is protected, not just what exists). They are asked on
// the setup screens because that is where they make sense in context, but
// they are scored exactly like any other control. `status` maps each option
// string to a status; anything else (including "Other" free text) is scored
// as unknown, since we cannot grade text we did not write.
export const PROFILE_CONTROLS = {
  networkArch: {
    fn: "Protect",
    text: "Is your network segmented (not flat)?",
    status: { "Flat / mostly unsegmented": "gap", "Segmented (VLANs / zones)": "met", "Zero-trust / microsegmented": "met" },
    ...c(2, ["PR.IR-01"], ["12.2", "13.4"], act("Segment the network into zones", "IT lead", "high", "Network diagram showing zones and the rules between them")),
  },
  devsecopsMaturity: {
    fn: "Protect",
    text: "Are security checks enforced in your software delivery pipeline?",
    status: {
      "No formal practice - security reviewed late, if at all": "gap",
      "Security scanning exists but isn't enforced in the pipeline": "partial",
      "Security gates (SAST/dependency scanning) enforced in CI/CD": "met",
    },
    ...c(1, ["PR.PS-06"], ["16.1", "16.12"], act("Enforce security checks in CI/CD", "Developers", "medium", "Pipeline configuration showing required security checks")),
  },
  secretsManagement: {
    fn: "Protect",
    text: "Are application secrets kept out of code and config files?",
    status: {
      "Hardcoded or stored in plain config files": "gap",
      "Environment variables, informally managed": "partial",
      "Dedicated secrets manager (e.g. Vault, cloud KMS)": "met",
    },
    ...c(2, ["PR.PS-06"], [], act("Move secrets into a secrets manager and rotate them", "Developers", "medium", "Secrets manager in use; secret-scanning results showing no secrets in repositories")),
  },
  containerImageScanning: {
    fn: "Detect",
    text: "Are container images scanned for known vulnerabilities before deployment?",
    status: { No: "gap", Occasionally: "partial", "Yes, automated on every build": "met" },
    ...c(2, ["ID.RA-01"], ["7.5", "16.5"], act("Scan container images on every build", "Developers", "low", "Pipeline or registry scan results for recent images")),
  },
  containerHostSecurity: {
    fn: "Protect",
    text: "Are container hosts hardened and patched?",
    status: {
      "Not specifically hardened - same as general servers": "gap",
      "Some hardening (e.g. minimal base images)": "partial",
      "Hardened and patched on a defined cadence": "met",
    },
    ...c(1, ["PR.PS-01"], ["4.1", "16.7"], act("Harden container hosts and patch them on a cadence", "IT lead", "medium", "Host baseline and patch records")),
  },
  hypervisorPatching: {
    fn: "Protect",
    text: "Are on-premises hypervisor hosts patched on a defined schedule?",
    status: { "Ad hoc / rarely": "gap", "Scheduled maintenance windows": "partial", "Actively managed patch program with a defined SLA": "met" },
    ...c(2, ["PR.PS-02"], ["7.3"], act("Patch hypervisor hosts on a defined schedule", "IT lead", "medium", "Hypervisor version report and patch schedule")),
  },
  vmSegmentation: {
    fn: "Protect",
    text: "Are workloads of different trust levels segmented from each other?",
    status: { "No - flat network": "gap", "Partially segmented": "partial", "Yes, fully segmented": "met" },
    ...c(2, ["PR.IR-01"], ["12.2", "16.8"], act("Segment workloads by trust level", "IT lead", "medium", "Network or security-group rules separating production, test and internet-facing workloads")),
  },
  otSegregation: {
    fn: "Protect",
    text: "Is the OT network segregated from corporate IT?",
    status: { "No - flat/shared network": "gap", "Partially segregated": "partial", "Yes, fully segregated": "met" },
    ...c(3, ["PR.IR-01"], ["12.2", "13.4"], act("Segregate OT from the corporate network", "OT engineer", "high", "Network diagram with the IT/OT boundary and firewall rules")),
  },
  otRemoteAccess: {
    fn: "Protect",
    text: "Does remote access to OT go through a dedicated, monitored gateway (or not exist)?",
    status: {
      "No remote access exists": "met",
      "Yes, but not via a dedicated secure gateway": "gap",
      "Yes, via a monitored jump host / secure gateway": "met",
    },
    ...c(3, ["PR.IR-01"], ["12.7", "13.5"], act("Route OT remote access through a monitored gateway", "OT engineer", "medium", "Gateway configuration and access logs")),
  },
  otPatching: {
    fn: "Protect",
    text: "Are OT/ICS devices patched through a managed program?",
    status: {
      "Rarely or never patched (legacy/vendor-locked)": "gap",
      "Patched during scheduled maintenance windows": "partial",
      "Actively managed patch program": "met",
    },
    ...c(2, ["PR.PS-02"], ["7.3", "7.4"], act("Establish an OT patch and compensating-control program", "OT engineer", "high", "OT asset list with firmware versions and patch or mitigation status")),
  },
  otMonitoring: {
    fn: "Detect",
    text: "Is OT/ICS network traffic monitored?",
    status: { No: "gap", "Partial coverage": "partial", Yes: "met" },
    ...c(2, ["DE.CM-01"], ["13.3", "13.6"], act("Monitor OT network traffic", "OT engineer", "medium", "OT monitoring tool coverage of OT network segments")),
  },
};

// Answers that are not controls but still describe a weakness worth acting
// on. They appear in the findings register and action plan; they do not
// change any coverage percentage.
export const FINDING_ITEMS = {
  incidentRecoveryOwner: {
    fn: "Respond",
    when: (v) => v === "Not defined",
    text: "No one owns post-incident recovery",
    weight: 2,
    csf: ["RC.RP-01"],
    cis: ["17.5"],
    explain: "When nobody owns recovery, restoring systems after an incident stalls on decisions that should have been made in advance - who restores what, in what order, and with whose authority.",
    interim: "Decide today, in writing, who leads recovery after an incident and who can approve bringing systems back online.",
    remediation: "Assign recovery ownership formally (internal lead, MSP contract clause, or an IR retainer), and record it in the incident response and continuity plans.",
    action: act("Name who owns post-incident recovery", "Leadership", "low", "Written assignment of recovery ownership in the IR or continuity plan"),
  },
  outsourcedStructure: {
    fn: "Govern",
    when: (v) => v === "No formal outsourced arrangement - handled ad hoc",
    text: "IT and security support has no formal arrangement",
    weight: 2,
    csf: ["GV.RR-02", "GV.SC-02"],
    cis: ["15.4"],
    explain: "With no internal team and no formal support arrangement, nobody is accountable for acting on any finding in this report.",
    interim: "Name one internal person as the accountable contact for whatever IT support you use today.",
    remediation: "Put a written agreement in place with an IT/security provider (scope, response times, security responsibilities), or assign an internal owner.",
    action: act("Formalize who provides and owns IT and security support", "Leadership", "medium", "Signed service agreement or written internal assignment of responsibility"),
  },
};

// How every setup-screen (profile) question is used. test/control-catalog
// .test.js fails if a profile question is added without a designation, so
// no answer can silently fall out of the report.
//   control        - scored (PROFILE_CONTROLS above)
//   finding        - produces a finding-only item or combined finding
//   context        - decides which questions apply, or sets exposure/scale
//   vendor         - names a product/provider (vendor notes, AI lookups)
//   informational  - reported as a context note, not scored
export const PROFILE_DESIGNATIONS = {
  employeeCount: "context",
  teamDedicated: "context",
  itOnlyHeadcount: "context",
  itHeadcountSeparate: "context",
  cybersecHeadcount: "context",
  combinedHeadcount: "context",
  outsourcedStructure: "finding",
  outsourcedMspName: "vendor",
  outsourcedFunctionBreakdown: "context",
  vendorCount: "context",
  dayToDay: "context",
  inhouseSocCapability: "informational",
  partialOutsourceFunctions: "context",
  fullMspProviderName: "vendor",
  mspSocOwner: "informational",
  mixedMspProviderName: "vendor",
  mixedOtherProviderDetail: "context",
  mdrProviderName: "vendor",
  mdrMspProviderName: "vendor",
  msspProviderName: "vendor",
  socOwnership: "context",
  cyberInsurance: "informational",
  incidentRecoveryOwner: "finding",
  hasAntivirus: "informational",
  antivirusVendor: "vendor",
  edrVendor: "vendor",
  emailSecurityVendor: "vendor",
  awarenessLms: "vendor",
  dlpUsed: "informational",
  dlpVendor: "vendor",
  deployModel: "context",
  cloudProvider: "vendor",
  endpointOs: "context",
  sdwanUsed: "context",
  sdwanVendor: "vendor",
  networkArch: "control",
  externalDevices: "context",
  edgeDeviceVendor: "vendor",
  edgeDeviceVersion: "vendor",
  externalWebsite: "context",
  webDb: "context",
  hostingProvider: "vendor",
  webServerStack: "vendor",
  developsSoftware: "context",
  devsecopsMaturity: "control",
  secretsManagement: "control",
  usesContainers: "context",
  containerOrchestration: "context",
  containerImageScanning: "control",
  containerHostSecurity: "control",
  usesVirtualization: "context",
  hypervisorPatching: "control",
  vmSegmentation: "control",
  aiUsage: "context",
  aiUsageTypes: "context",
  aiCustomAppRAG: "context",
  hasOT: "context",
  otSegregation: "control",
  otRemoteAccess: "control",
  otPatching: "control",
  otMonitoring: "control",
  otVendor: "vendor",
};

// Informational notes: answers that matter for context but are not scored.
// Each returns note text for the report, or null.
export const INFORMATIONAL_NOTES = {
  inhouseSocCapability: (v) =>
    v === "No dedicated SOC/IR/forensics capability"
      ? "No in-house SOC, incident response or forensics capability - detection and response rely on the tools and plans scored in Detect and Respond."
      : null,
  mspSocOwner: (v) => (v === "No SOC/monitoring in place" ? "No SOC or security monitoring service is in place alongside the MSP." : null),
  cyberInsurance: (v) =>
    v === "No"
      ? "No cyber insurance policy. Not scored - whether to insure is a business decision - but incident costs would be borne directly."
      : v === "Not sure"
        ? "Cyber insurance status is unknown. Worth confirming, since policies often set requirements (such as MFA and backups) and an incident hotline."
        : null,
  hasAntivirus: (v) =>
    v === "No" ? "No antivirus product reported. Endpoint protection coverage is scored separately under Protect." : v === "Not sure" ? "Antivirus status is unknown." : null,
  dlpUsed: (v) => (v === "No" ? "No data loss prevention (DLP) product. Outbound-data monitoring is scored separately under Detect." : null),
};
