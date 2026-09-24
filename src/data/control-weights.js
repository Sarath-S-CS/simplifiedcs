// How much closing each scored question's gap reduces real-world risk, as a
// priority tier - used ONLY to rank "Where to act first" and the full gap
// list (computeRankedGaps() in src/engine/scoring.js). It deliberately does
// not change any score percentage.
//
// Before this existed, the ranking sorted gaps only by how far the answer
// was from the best option, and ties (most of them) kept questionnaire
// order - so the "ranked" top five was just the first five weak answers in
// the order they were asked, and governance questions (asked first) always
// won. Live testing surfaced "support passkeys" ranked above internet-exposed
// RDP, no centralized logging, and never-tested backups.
//
// Tiers follow the priorities in CISA's Cross-Sector Cybersecurity
// Performance Goals (CPGs) and the CISA/MS-ISAC #StopRansomware Guide:
//   3 critical - the controls those documents put first because they block
//                the most common initial-access paths or decide whether an
//                organization can recover at all: MFA, no internet-exposed
//                remote admin, patching, EDR on every device, privileged
//                account control, offline/immutable and actually-tested
//                backups.
//   2 high     - detection, response, and data-exposure controls: logging,
//                exfiltration monitoring, vulnerability scanning, email
//                authentication, admin-account separation, offboarding, an
//                IR plan and owner, BC/DR, the database controls for an
//                internet-facing app, out-of-band verification for payment
//                changes (business email compromise), and compliance
//                questions whose gap is itself a direct technical exposure.
//   1 standard - everything else: governance/documentation, maturity
//                refinements (passkeys, training cadence), and the
//                framework-specific paperwork questions. These still appear
//                in the full gap list; they just don't outrank an open door.
// Unlisted questions default to 1.
export const CONTROL_WEIGHTS = {
  // critical
  mfa: 3,
  rdpExposed: 3,
  patching: 3,
  endpoint: 3,
  privAccountMgmt: 3,
  backupIsolation: 3,
  backupTest: 3,

  // high
  siem: 2,
  exfil: 2,
  anomalyTime: 2,
  vulnScanning: 2,
  emailAuth: 2,
  privSeparation: 2,
  offboarding: 2,
  training: 2,
  irPlan: 2,
  irTeam: 2,
  bcdr: 2,
  assetInv: 2,
  vendorCount: 2,
  dbEncryption: 2,
  dbAccessControl: 2,
  dbPatching: 2,
  aiVerificationStep: 2,
  aiRagPermissions: 2,
  hipaaEncryption: 2,
  pcidssSensitiveAuthData: 2,
  pcidssCDESegmentation: 2,
  cyberEssentialsBoundaryFirewall: 2,
  cyberEssentialsSecureConfig: 2,
};

export const WEIGHT_LABELS = { 3: "Critical control", 2: "High impact", 1: "Standard" };

export function controlWeight(questionId) {
  return CONTROL_WEIGHTS[questionId] ?? 1;
}
