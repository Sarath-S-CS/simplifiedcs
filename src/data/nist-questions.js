// The six NIST CSF function question sets - ported verbatim (ids, question
// text, and option text/values all unchanged) from the original index.html
// STEPS array, just flattened into individual graph nodes. `fn` remains the
// internal NIST scoring key; `category` is the new §5.9 business-facing
// label the UI actually shows. Framework-tagged questions (`framework:`)
// keep their original visibility gating: shown only when that framework is
// selected in scope.
import { FUNC_DISPLAY, FUNC_REF } from "./categories.js";

export const SECTION_META = {
  Govern: { sub: "The mandate and oversight that make everything else more than good intentions." },
  Identify: { sub: "What you have, and what depends on it." },
  Protect: { sub: "The safeguards standing between an attacker and your systems." },
  Detect: { sub: "How you'd learn something is wrong - and how fast." },
  Respond: { sub: "What happens in the first hour of a confirmed incident." },
  Recover: { sub: "How you get back to operating - and how sure you are it'll work." },
};

function scored(fn, id, text, options, extra) {
  return { id, kind: "scored", fn, category: FUNC_DISPLAY[fn], text, options, ...extra };
}

export const NIST_QUESTIONS = [
  // Govern
  scored("Govern", "govPolicy", "Is there a documented cybersecurity policy, approved by leadership?", [
    { v: 0, t: "No" },
    { v: 1, t: "Yes, but outdated or unreviewed" },
    { v: 2, t: "Yes, current and formally approved" },
  ]),
  scored("Govern", "govRoles", "Are cybersecurity roles and responsibilities formally assigned?", [
    { v: 0, t: "No - \"IT handles it\", informally" },
    { v: 1, t: "Somewhat, but not documented" },
    { v: 2, t: "Yes, clearly documented" },
  ]),
  scored("Govern", "govReporting", "Does leadership receive regular reporting on cybersecurity risk?", [
    { v: 0, t: "Never" }, { v: 1, t: "Ad hoc, when something goes wrong" }, { v: 2, t: "Yes, on a regular schedule" },
  ]),
  scored("Govern", "govRiskDecisions", "Is cybersecurity risk factored into business decisions (new vendors, new products) before they're approved?", [
    { v: 0, t: "No" }, { v: 1, t: "Sometimes, informally" }, { v: 2, t: "Yes, a formal process" },
  ]),
  scored("Govern", "isoIsms", "Do you maintain a formal Information Security Management System (ISMS) with a defined scope and periodic management review?", [
    { v: 0, t: "No" }, { v: 1, t: "Informally" }, { v: 2, t: "Yes, formally documented" },
  ], { framework: "iso27001" }),
  scored("Govern", "nis2Training", "Has your management body received specific training on cybersecurity risk oversight, as NIS2 requires of accountable executives?", [
    { v: 0, t: "No" }, { v: 1, t: "Not formally" }, { v: 2, t: "Yes" },
  ], { framework: "nis2" }),
  // §5.6 — HIPAA
  scored("Govern", "hipaaBAA", "Do you have signed Business Associate Agreements (BAAs) with every vendor that accesses, stores, or transmits PHI?", [
    { v: 0, t: "No" }, { v: 1, t: "With some, not all" }, { v: 2, t: "Yes, with all applicable vendors" },
  ], { framework: "hipaa" }),
  // §5.6 — GDPR
  scored("Govern", "gdprRopa", "Do you maintain a record of processing activities (ROPA) documenting the lawful basis for each use of personal data?", [
    { v: 0, t: "No" }, { v: 1, t: "Partial / informal" }, { v: 2, t: "Yes, maintained and current" },
  ], { framework: "gdpr" }),
  scored("Govern", "gdprDSR", "Do you have a documented process to handle data subject rights requests (access, deletion, portability) within the required timeframe?", [
    { v: 0, t: "No" }, { v: 1, t: "Informal, no defined timeframe" }, { v: 2, t: "Yes, a documented process exists" },
  ], { framework: "gdpr" }),
  // §5.8
  scored("Govern", "aiToolGovernance", "Are AI tools used within the organization, and if so, is that usage tracked and governed?", [
    { v: 0, t: "Used with no tracking or policy" },
    { v: 1, t: "Used informally - some awareness, no formal policy" },
    { v: 2, t: "A formal AI usage policy exists and usage is tracked" },
  ]),

  // Identify
  scored("Identify", "assetInv", "How would you describe your asset inventory?", [
    { v: 0, t: "No formal inventory - tribal knowledge" },
    { v: 1, t: "Partial, manually maintained spreadsheet" },
    { v: 2, t: "Automated and continuously updated" },
  ]),
  scored("Identify", "dataClass", "Do you classify data by sensitivity (public / internal / confidential / restricted)?", [
    { v: 0, t: "No" }, { v: 2, t: "Yes" },
  ]),
  scored("Identify", "vendorCount", "How many third-party vendors have access to your systems or data?", [
    { v: 2, t: "None" },
    { v: 1, t: "1–5, informally tracked" },
    { v: 0, t: "6+, and not formally reviewed" },
  ]),
  scored("Identify", "isoRiskAssess", "Do you conduct a formal asset-based risk assessment at least annually?", [
    { v: 0, t: "No" }, { v: 1, t: "Ad hoc, not annual" }, { v: 2, t: "Yes, at least annually" },
  ], { framework: "iso27001" }),
  // §5.6 — HIPAA
  scored("Identify", "hipaaRiskAnalysis", "Have you conducted a HIPAA-required security risk analysis covering all systems that create, receive, maintain, or transmit ePHI?", [
    { v: 0, t: "No" }, { v: 1, t: "Yes, but outdated or partial" }, { v: 2, t: "Yes, current and comprehensive" },
  ], { framework: "hipaa" }),

  // Protect
  scored("Protect", "mfa", "Is multi-factor authentication enforced for remote and admin access?", [
    { v: 0, t: "No" }, { v: 1, t: "Admin accounts only" }, { v: 2, t: "Yes, everywhere" },
  ]),
  scored("Protect", "patching", "How are software patches and updates managed?", [
    { v: 0, t: "Ad hoc / manual" }, { v: 1, t: "Scheduled but inconsistent" }, { v: 2, t: "Automated, with an SLA" },
  ]),
  scored("Protect", "training", "Do employees receive security awareness training?", [
    { v: 0, t: "Never" }, { v: 1, t: "Once, at onboarding" }, { v: 2, t: "Ongoing, recurring" },
  ]),
  scored("Protect", "phishingSim", "Do you run simulated phishing tests for employees?", [
    { v: 0, t: "No" }, { v: 1, t: "Yes, but infrequently (less than annually)" }, { v: 2, t: "Yes, on a regular schedule" },
  ]),
  // §5.7: cadence follow-up on top of the training question above, rather
  // than a duplicate training question - only asked once some training
  // actually happens. Integrates with (doesn't duplicate) phishingSim.
  scored("Protect", "trainingCadence", "What is the actual cadence of that security awareness training?", [
    { v: 0, t: "Ad hoc / no fixed schedule" },
    { v: 1, t: "Annually" },
    { v: 2, t: "Ongoing / continuous (e.g. monthly micro-training)" },
  ], { visibleIf: (answers) => answers.training !== 0 }),
  scored("Protect", "endpoint", "Is endpoint protection (EDR/antivirus) deployed on all devices?", [
    { v: 0, t: "No" }, { v: 1, t: "Partial coverage" }, { v: 2, t: "Yes, all devices" },
  ]),
  scored("Protect", "rdpExposed", "Is RDP or another remote-admin protocol reachable directly from the internet (not behind a VPN/ZTNA)?", [
    { v: 0, t: "Yes" }, { v: 2, t: "No - behind VPN/ZTNA only" },
  ]),
  scored("Protect", "emailAuth", "Is email authentication (SPF, DKIM, and DMARC set to quarantine/reject) enforced for your domain?", [
    { v: 0, t: "No / not sure" }, { v: 1, t: "Partially - e.g. DMARC set to \"none\"" }, { v: 2, t: "Yes, fully enforced" },
  ]),
  scored("Protect", "privSeparation", "Are administrative accounts kept separate from everyday user accounts?", [
    { v: 0, t: "No - same account used for both" }, { v: 1, t: "Partially" }, { v: 2, t: "Yes, fully separated" },
  ]),
  // §5.8: builds on privSeparation with the just-in-time dimension - only
  // meaningful once there's at least a partially separate admin account to
  // grant standing vs. just-in-time privileges on.
  scored("Protect", "privilegedAccessModel", "For those separate admin accounts, is elevated access always-on (standing privileges) or granted just-in-time for specific tasks?", [
    { v: 0, t: "Standing / always-on elevated access" },
    { v: 1, t: "Some just-in-time elements, not fully enforced" },
    { v: 2, t: "Fully just-in-time - elevated only when needed" },
  ], { visibleIf: (answers) => answers.privSeparation !== 0 }),
  scored("Protect", "privAccountMgmt", "How are privileged accounts (domain admins, database admins, local/server administrators) managed?", [
    { v: 0, t: "No formal management - shared or long-standing credentials" },
    { v: 1, t: "Individually assigned, but not regularly reviewed" },
    { v: 2, t: "Individually assigned, regularly reviewed/rotated, least-privilege enforced" },
  ]),
  scored("Protect", "passwordPolicy", "What is the organization's password policy for length, complexity, and rotation?", [
    { v: 0, t: "No formal policy / weak defaults" },
    { v: 1, t: "Basic complexity requirements enforced" },
    { v: 2, t: "Strong length/complexity policy enforced organization-wide" },
  ]),
  scored("Protect", "passwordManager", "Do administrators and/or employees use a password management tool?", [
    { v: 0, t: "No" },
    { v: 1, t: "Some individuals use one informally" },
    { v: 2, t: "Yes, an organization-provisioned password manager is standard" },
  ]),
  scored("Protect", "offboarding", "Is there a formal process to revoke all access immediately when someone leaves or changes roles?", [
    { v: 0, t: "No" }, { v: 1, t: "Informal / inconsistent" }, { v: 2, t: "Yes, formal and immediate" },
  ]),
  scored("Protect", "soc2Change", "Do you have documented change management controls for production systems?", [
    { v: 0, t: "No" }, { v: 1, t: "Informal" }, { v: 2, t: "Yes, documented and enforced" },
  ], { framework: "soc2" }),
  // §5.6 — HIPAA
  scored("Protect", "hipaaEncryption", "Is PHI encrypted both at rest and in transit?", [
    { v: 0, t: "No / not consistently" }, { v: 1, t: "One but not both (at rest or in transit)" }, { v: 2, t: "Yes, both at rest and in transit" },
  ], { framework: "hipaa" }),
  // §5.6 — SOX
  scored("Protect", "soxSoD", "Are segregation-of-duties controls enforced for systems affecting financial reporting (e.g. no single person can both initiate and approve a transaction)?", [
    { v: 0, t: "No" }, { v: 1, t: "Partially" }, { v: 2, t: "Yes, enforced" },
  ], { framework: "sox" }),
  scored("Protect", "soxAccessReview", "Are user access rights to financial systems formally reviewed on a periodic basis?", [
    { v: 0, t: "No" }, { v: 1, t: "Ad hoc, not scheduled" }, { v: 2, t: "Yes, on a defined schedule" },
  ], { framework: "sox" }),
  // §5.6 — Cyber Essentials (UK NCSC's 5 technical control themes - malware
  // protection and patch management are already covered by the existing
  // endpoint/patching questions above, so these two focus on the two themes
  // that aren't: boundary firewalls and secure configuration).
  scored("Protect", "cyberEssentialsBoundaryFirewall", "Are boundary firewalls configured to block all inbound traffic by default, only permitting explicitly required services?", [
    { v: 0, t: "No / broadly permissive rules" }, { v: 1, t: "Partially restricted" }, { v: 2, t: "Yes, default-deny with explicit exceptions only" },
  ], { framework: "cyberessentials" }),
  scored("Protect", "cyberEssentialsSecureConfig", "Are default/manufacturer passwords and unnecessary software or services removed from devices before deployment (secure baseline configuration)?", [
    { v: 0, t: "No" }, { v: 1, t: "Inconsistently" }, { v: 2, t: "Yes, a secure baseline is enforced" },
  ], { framework: "cyberessentials" }),
  // §5.6 — PCI DSS
  scored("Protect", "pcidssCDESegmentation", "Is the cardholder data environment (CDE) segmented from the rest of your network?", [
    { v: 0, t: "No" }, { v: 1, t: "Partially segmented" }, { v: 2, t: "Yes, fully segmented" },
  ], { framework: "pcidss" }),
  scored("Protect", "pcidssSensitiveAuthData", "Do you store sensitive authentication data (full track data, CVV/CVC, PIN) after authorization?", [
    { v: 0, t: "Yes, some is retained" }, { v: 1, t: "Not sure" }, { v: 2, t: "No, none is stored post-authorization" },
  ], { framework: "pcidss" }),

  // Detect
  scored("Detect", "siem", "Do you have centralized logging (SIEM or equivalent)?", [
    { v: 0, t: "No" }, { v: 2, t: "Yes" },
  ]),
  scored("Detect", "anomalyTime", "How quickly would you typically notice a suspicious login or anomaly?", [
    { v: 2, t: "Minutes to hours - automated alerting" }, { v: 1, t: "Days - manual review" }, { v: 0, t: "We likely wouldn't notice" },
  ]),
  scored("Detect", "exfil", "Do you monitor for data exfiltration or unusual outbound traffic?", [
    { v: 0, t: "No" }, { v: 2, t: "Yes" },
  ]),
  scored("Detect", "vulnScanning", "Do you run regular external and internal vulnerability scans?", [
    { v: 0, t: "Never" }, { v: 1, t: "Occasionally / ad hoc" }, { v: 2, t: "Yes, on a regular schedule" },
  ]),
  scored("Detect", "pentest", "Have you had an external penetration test or red-team engagement in the last 12 months?", [
    { v: 0, t: "No" }, { v: 1, t: "More than 12 months ago" }, { v: 2, t: "Yes, within the last 12 months" },
  ]),
  scored("Detect", "soc2Evidence", "Could you produce evidence/logs for an independent auditor showing controls operated effectively over a review period?", [
    { v: 0, t: "No" }, { v: 1, t: "Partially" }, { v: 2, t: "Yes" },
  ], { framework: "soc2" }),
  // §5.6 — SOX
  scored("Detect", "soxAuditTrail", "Are audit trails for financial systems retained and protected from tampering, per your audit requirements?", [
    { v: 0, t: "No" }, { v: 1, t: "Retained, but not protected from tampering" }, { v: 2, t: "Yes, retained and protected" },
  ], { framework: "sox" }),
  // §5.6 — PCI DSS. REDUNDANCY-AUDIT-BRIEF.md §2: worded as an explicit
  // refinement of vulnScanning above (same underlying activity - external
  // vulnerability scanning) rather than a cold re-ask, since PCI DSS's
  // actual requirement is more specific (quarterly cadence, ASV-certified)
  // than that general question captures.
  scored("Detect", "pcidssASVScanning", "You mentioned your vulnerability scanning cadence above - for PCI DSS specifically, are external scans done quarterly by an Approved Scanning Vendor (ASV), as the standard requires?", [
    { v: 0, t: "No" }, { v: 1, t: "Irregularly" }, { v: 2, t: "Yes, quarterly" },
  ], { framework: "pcidss" }),

  // Respond
  scored("Respond", "irPlan", "Do you have a documented incident response plan?", [
    { v: 0, t: "No" }, { v: 1, t: "Yes, but never tested" }, { v: 2, t: "Yes, tested annually" },
  ]),
  scored("Respond", "irTeam", "Is there a designated incident response contact or team?", [
    { v: 0, t: "No" }, { v: 2, t: "Yes" },
  ]),
  scored("Respond", "commsPlan", "Do you have a breach communication plan (legal, customers, regulators)?", [
    { v: 0, t: "No" }, { v: 2, t: "Yes" },
  ]),
  scored("Respond", "nis2Notify", "If you experienced a significant incident, could you notify your national CSIRT/authority within 24 hours, as NIS2's early-warning rule requires?", [
    { v: 0, t: "No / unsure" }, { v: 1, t: "Possibly, no defined process" }, { v: 2, t: "Yes, a defined process exists" },
  ], { framework: "nis2" }),
  // §5.6 — GDPR
  scored("Respond", "gdprBreach72h", "If a personal data breach occurred, could you notify the relevant supervisory authority within GDPR's 72-hour window?", [
    { v: 0, t: "No / unsure" }, { v: 1, t: "Possibly, no defined process" }, { v: 2, t: "Yes, a defined process exists" },
  ], { framework: "gdpr" }),

  // Recover
  scored("Recover", "backupTest", "How often are backups tested by actually restoring data?", [
    { v: 2, t: "Quarterly or more" }, { v: 1, t: "Rarely" }, { v: 0, t: "Never" },
  ]),
  scored("Recover", "bcdr", "Do you have a documented business continuity / disaster recovery plan?", [
    { v: 0, t: "No" }, { v: 2, t: "Yes" },
  ]),
  scored("Recover", "backupIsolation", "Are backups isolated from the production network (offline or immutable)?", [
    { v: 0, t: "No" }, { v: 2, t: "Yes" },
  ]),
];

export function nistQuestionsFor(fn) {
  return NIST_QUESTIONS.filter((q) => q.fn === fn);
}

export { FUNC_DISPLAY, FUNC_REF };
