// ASSESSMENT-REPORT-DEPTH-BRIEF.md §6: every finding in the deterministic
// report - compounding-risk flags, compliance-gap items, and ranked
// priority items alike - gets the same five-part treatment, with no AI
// call required:
//   1. traceability - explicit, named answer(s) that triggered it
//   2. consequence  - a specific, attack-reasoned "what could go wrong"
//   3. technique    - the MITRE ATT&CK tactic/technique, where genuinely
//                     applicable (null, not invented, for pure governance/
//                     process gaps - see PHASE2-BRIEF.md's original rule)
//   4. compensatingControl - an interim measure if full remediation isn't
//                     immediate
//   5. remediation  - the concrete, full fix
// `reference` is optional and only ever a URL verified to actually resolve
// and match its topic before being added here - never guessed.
//
// FLAG_GUIDANCE covers every id computeFlags() can produce. QUESTION_GUIDANCE
// covers every NIST question id (all 58, including every framework-tagged
// one) - it's the single source both computePriorities()' top-5 AND
// framework-guidance.js's compliance gaps read from, so a question never has
// two separately-maintained guidance entries that could drift apart.
//
// Quick mode renders only traceability + consequence + remediation (see
// guidanceForFlag/guidanceForGapItem's `full` param) - technique and
// compensatingControl are the "deeper layering" §7 explicitly trades away
// for Quick's shorter runtime, not a data-availability limitation.
import { NIST_QUESTIONS } from "../data/nist-questions.js";

function t(id, name) {
  return { id, name };
}
function ref(label, url) {
  return { label, url };
}

// Generic traceability for any single NIST question - "you indicated X for
// Y" - built directly from computeGapItems()'s own `gap`/`chosen` fields
// (or, for framework gaps, framework-guidance.js's identical shape), so no
// per-question traceability text needs hand-authoring at all.
function questionTraceability(item) {
  return `You indicated "${item.chosen}" for: "${item.gap || item.question}"`;
}

// Small helper for flags spanning a NIST-scored question specifically -
// looks up the actual option label chosen, for flags' own hand-written
// traceability functions to quote directly instead of restating the raw
// stored value (which is a bare 0/1/2 for scored questions).
function chosenLabel(id, answers) {
  const q = NIST_QUESTIONS.find((n) => n.id === id);
  if (!q) return String(answers[id]);
  const opt = q.options.find((o) => o.v === answers[id]);
  return opt ? opt.t : String(answers[id]);
}

export const FLAG_GUIDANCE = {
  "mfa-vendor-exposure": {
    technique: t("T1078", "Valid Accounts"),
    traceability: (a) => `You indicated MFA enforcement is "${chosenLabel("mfa", a)}" and reported "${chosenLabel("vendorCount", a)}" for third-party vendor access.`,
    explain:
      "Once a vendor credential leaks (in a breach that has nothing to do with you), this is the technique that turns it into access: the attacker just logs in as a legitimate user. MFA is the control that specifically stops a leaked password alone from being enough.",
    compensatingControl: (a) =>
      a.siem !== 0
        ? "You do have some centralized logging in place - until MFA is rolled out everywhere, add alerting specifically on vendor and service-account logins from new locations or at unusual times, since that's the exact path this gap leaves open."
        : "Start the MFA rollout with vendor-facing and admin accounts specifically, not devices - that's the smallest set of accounts that closes the largest share of this exposure. In parallel, ask your highest-risk vendors for written confirmation of their own access controls until yours are in place.",
    remediation: () =>
      "Enforce MFA organization-wide, prioritized by risk: vendor and service accounts first, then admin, then everyone else. Simultaneously build (even a one-page) vendor inventory recording what each vendor can actually access, so a future leaked credential has a known, bounded blast radius instead of an unknown one.",
    reference: ref("CISA: Require Multifactor Authentication", "https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/require-multifactor-authentication"),
  },
  "no-logging-no-ir": {
    technique: t("T1070", "Indicator Removal"),
    traceability: (a) => `You indicated centralized logging (SIEM or equivalent) is "${chosenLabel("siem", a)}" and your incident response plan is "${chosenLabel("irPlan", a)}".`,
    explain:
      "Attackers who want to cover their tracks after a breach use techniques like this to erase logs. Without centralized logging, they don't need to bother - there's nothing to erase, and no way to reconstruct what happened after the fact.",
    compensatingControl: (a) =>
      a.irTeam === 2
        ? "You do have a designated incident response contact or team - even without formal logging, write down a one-page \"if something looks wrong, do this first\" checklist for that person now, rather than waiting for a full IR plan."
        : "Name one person as the accountable incident contact today, even informally - an unwritten plan with no owner is the actual gap here, and that's fixable in an afternoon while the logging and formal plan get built out.",
    remediation: () =>
      "Turn on your hosting/cloud provider's or firewall's built-in logging first (often a checkbox, not a purchase), feeding a centralized place you actually review. In parallel, write and test a short incident response plan - even 1-2 tabletop pages covering who declares an incident and who has authority to isolate a system - and store it somewhere reachable even if the primary network is down.",
  },
  "untested-backup-weak-endpoint": {
    technique: t("T1486", "Data Encrypted for Impact"),
    traceability: (a) => `You indicated backups are tested "${chosenLabel("backupTest", a)}" and endpoint protection coverage is "${chosenLabel("endpoint", a)}".`,
    explain:
      "This is the ransomware technique itself - files and systems encrypted until a ransom is paid. Endpoint protection is what's supposed to catch the encryption process running; tested backups are what make the ransom demand irrelevant. This gap removes both.",
    compensatingControl: (a) =>
      a.backupIsolation === 2
        ? "Your backups are at least isolated from the production network, which is the part that matters most against ransomware specifically - as an immediate low-effort step, manually restore one file or one non-critical system now to get a first real data point on whether the backups actually work."
        : "As an immediate step, manually test-restore a single file or one low-priority system this week - that's a far smaller lift than a full DR test and still tells you whether backups are fundamentally sound before anything depends on them.",
    remediation: () =>
      "Schedule quarterly (at minimum) backup-restore tests against real systems, not just verifying the backup job completed. Close the endpoint gap in parallel by extending EDR/antivirus to 100% of devices - a single unprotected laptop is a common actual entry point.",
    reference: ref("CISA: StopRansomware", "https://www.cisa.gov/stopransomware"),
  },
  "no-training-partial-mfa": {
    technique: t("T1566", "Phishing"),
    traceability: (a) => `You indicated security awareness training is "${chosenLabel("training", a)}" and MFA enforcement is "${chosenLabel("mfa", a)}".`,
    explain:
      "This is the most common way attackers get initial access - a malicious link or attachment that a person, not a system, has to recognize and reject. Untrained employees are less likely to catch it, and partial MFA means a successful phish can still land on an account with no second gate.",
    compensatingControl: (a) =>
      a.emailAuth === 2
        ? "Email authentication is enforced, which filters out a meaningful share of spoofed phishing before it reaches anyone - while training gets built out, finish the MFA rollout to 100% of accounts first, since that closes the gap that matters most if a phish does get through."
        : "Finishing MFA rollout to 100% of accounts is the faster, cheaper interim step compared to standing up a training program - it directly limits what a successful phish can do, even before anyone's had a single training session.",
    remediation: () =>
      "Stand up recurring (not one-time) security awareness training - even a low-cost platform with monthly micro-training beats an annual slideshow - and complete the MFA rollout to every account, not just admins, in parallel.",
  },
  "no-vendor-risk-review": {
    technique: t("T1195", "Supply Chain Compromise"),
    traceability: (a) => `You indicated cybersecurity risk in vendor decisions is "${chosenLabel("govRiskDecisions", a)}" and reported "${chosenLabel("vendorCount", a)}" for third-party vendor access.`,
    explain:
      "This is risk entering through a trusted third party rather than a direct attack on you - a compromised vendor becomes a way in. It's why unreviewed vendor relationships are treated as a real attack surface, not just a procurement detail.",
    compensatingControl: (a) =>
      a.assetInv !== 0
        ? "You have at least a partial asset inventory - use it now to identify which of your 6+ vendors actually touch your most sensitive systems or data, and review just those manually as an interim step before a formal process exists for all of them."
        : "Start with a short list: which vendors have access to your most sensitive systems or data, not all of them. Reviewing that short list manually this month is a realistic interim step; a formal process for every vendor is not.",
    remediation: () =>
      "Require a short security questionnaire before any new vendor gets system or data access, and retroactively review your highest-access existing vendors against the same questions this quarter.",
  },
  "no-policy-no-ir": {
    technique: null,
    traceability: (a) => `You indicated your cybersecurity policy is "${chosenLabel("govPolicy", a)}" and your incident response plan is "${chosenLabel("irPlan", a)}".`,
    explain:
      "This isn't a specific attacker technique - it's a program-level gap. Without a leadership-approved policy or a tested response plan, readiness for every technique described elsewhere in this report depends on whoever happens to notice something first, rather than an accountable process.",
    compensatingControl: (a) =>
      a.irTeam === 2
        ? "You do have a designated incident contact - get leadership to sign off on that person's authority to act in a one-paragraph email or memo now. That's a real interim mandate, and far faster than waiting for a full policy document."
        : "The single fastest fix here isn't a document - it's naming one accountable person, today, even informally, and getting a one-line acknowledgment from leadership that they're it until a formal policy exists.",
    remediation: () =>
      "Draft a short (1-2 page) leadership-approved security policy and a short incident response plan in parallel - neither needs to be exhaustive to be real; both need a named owner and leadership's actual sign-off, not just a draft sitting unapproved.",
  },
  "exposed-db-app-no-monitoring": {
    technique: t("T1190", "Exploit Public-Facing Application"),
    traceability: (a) =>
      `You indicated you operate an externally-reachable customer-facing service ("${a.externalWebsite}") connected to a backend database ("${a.webDb}"), with logging "${chosenLabel("siem", a)}" and outbound-traffic monitoring "${chosenLabel("exfil", a)}".`,
    explain:
      "A public web app connected to a database is a direct target for this technique - things like SQL injection against the app itself. Centralized logging and outbound-traffic monitoring are what typically catch the follow-on data exfiltration; without them, a successful exploit can run for a long time before anyone notices.",
    compensatingControl: (a) =>
      a.vulnScanning !== 0
        ? "Regular vulnerability scanning helps catch some exploitable issues before they're used, but it doesn't replace monitoring for exfiltration after the fact. As an immediate step, turn on your hosting or cloud provider's built-in access/traffic logging - most include this at no extra cost, and it beats having no visibility at all."
        : "As an immediate step, turn on your hosting or cloud provider's built-in access and traffic logging - most platforms include this by default at no extra cost. It's not a substitute for a real monitoring program, but it's meaningfully better than the current no-visibility state.",
    remediation: () =>
      "Put a web application firewall in front of the app (most cloud providers and CDNs offer one), run an authenticated vulnerability/injection scan against it, and enable outbound-traffic alerting for unusually large data transfers - together these address the entry point, the flaw, and the exfiltration step.",
    reference: ref("OWASP Top 10", "https://owasp.org/www-project-top-ten/"),
  },
  "db-unencrypted-weak-access": {
    technique: t("T1005", "Data from Local System"),
    traceability: (a) => `You indicated the database is encrypted at rest: "${chosenLabel("dbEncryption", a)}", and routine application access uses least-privilege credentials: "${chosenLabel("dbAccessControl", a)}".`,
    explain:
      "A database that isn't encrypted at rest, combined with routine application access through shared or admin credentials rather than least-privilege accounts, means a single leaked credential - or a misplaced backup - exposes the entire dataset in plain, readable form, not just whatever the compromised account was meant to touch.",
    compensatingControl: () =>
      "As an immediate step, rotate the shared/admin credential currently used for routine app access and restrict it to only the specific tables/operations the application actually needs, even before a fully separate least-privilege account is provisioned.",
    remediation: () =>
      "Enable at-rest encryption (a native feature on every major database engine and managed cloud database service - typically a configuration change, not a migration) and create a dedicated, least-privilege application account scoped to only what the app needs, retiring the shared/admin credential from routine use.",
    reference: ref("OWASP Top 10", "https://owasp.org/www-project-top-ten/"),
  },
  "no-accountability": {
    technique: null,
    traceability: (a) => `You indicated your team structure is "${a.teamDedicated}" with outsourcing arrangement "${a.outsourcedStructure}".`,
    explain:
      "Not a specific attacker technique - a structural gap. Every finding elsewhere in this report assumes someone is positioned to act on it; with no internal team and no formal outsourced arrangement, that assumption doesn't hold.",
    compensatingControl: () =>
      "Name one internal person - even someone without a security background - as the accountable point of contact for whatever IT support you do use. That single step turns ad hoc into at least nominally managed, and it's the realistic starting point here rather than standing up a formal function overnight.",
    remediation: () =>
      "Formalize an arrangement with a dedicated MSP/MSSP (a named contract, not an ad hoc relationship) or hire even a part-time internal IT/security resource - either closes this gap; leaving it undecided does not.",
  },
  "cloud-no-mfa": {
    technique: t("T1078.004", "Valid Accounts: Cloud Accounts"),
    traceability: (a) => `You indicated your infrastructure is "${a.deployModel}" with MFA enforcement "${chosenLabel("mfa", a)}".`,
    explain:
      "The cloud-specific version of credential-based access - a leaked password alone is enough to reach admin consoles that are reachable from anywhere in the world, not just from inside your office network.",
    compensatingControl: (a) =>
      a.passwordPolicy === 2
        ? "A strong password policy is already enforced, which raises the bar somewhat - but it doesn't stop a reused or phished password. Prioritize MFA on the cloud admin console / root account specifically first; that single account is the highest-value target and the fastest thing to lock down."
        : "Prioritize MFA on the cloud admin console / root account specifically, before anywhere else - it's the single highest-value account, reachable from anywhere, and the fastest one to close.",
    remediation: () =>
      "Enforce MFA on every cloud account, starting with the root/global-admin account today, then every account with any administrative role, then all remaining users - most cloud providers (AWS, Azure, GCP) let you enforce this org-wide from a single console setting.",
    reference: ref("Microsoft Entra: multifactor authentication overview", "https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mfa-howitworks"),
  },
  "rdp-exposed-ransomware-path": {
    technique: t("T1133", "External Remote Services"),
    traceability: (a) => `You indicated RDP or another remote-admin protocol is reachable directly from the internet: "${chosenLabel("rdpExposed", a)}".`,
    explain:
      "Remote access exposed directly to the internet is a documented, repeatedly-used entry point - attackers scan for exactly this and use it to log straight in, no phishing or malware required to get the initial foothold.",
    compensatingControl: () =>
      "Putting RDP behind a VPN or ZTNA is the real fix, but as an immediate same-day step: restrict access to a specific IP allowlist and enable account lockout / rate-limiting on failed logins. Neither is a substitute for removing the direct exposure, but both meaningfully raise the cost of the most common automated attacks in the meantime.",
    remediation: () =>
      "Move remote administrative access behind a VPN or Zero Trust Network Access (ZTNA) solution so RDP itself is never directly internet-reachable, and require MFA on that VPN/ZTNA login.",
    reference: ref("CISA: StopRansomware", "https://www.cisa.gov/stopransomware"),
  },
  "no-email-auth-no-training": {
    technique: t("T1566", "Phishing"),
    traceability: (a) => `You indicated email authentication (SPF/DKIM/DMARC) is "${chosenLabel("emailAuth", a)}" and security awareness training is "${chosenLabel("training", a)}".`,
    explain:
      "Without SPF/DKIM/DMARC enforced, attackers can send email that appears to come from your own domain - to your employees, or to your customers and partners. Without training, the people receiving it are less equipped to catch what technical filtering alone won't.",
    compensatingControl: (a) =>
      a.phishingSim !== 0
        ? "Simulated phishing tests are already happening, which helps build detection reflexes even without formal training - as a fast, low-disruption interim step, move DMARC from monitoring to quarantine (not straight to reject) to start blocking spoofed mail without risking legitimate mail getting dropped."
        : "As a fast, low-disruption interim step, set DMARC to quarantine (not reject yet) - it starts filtering spoofed mail claiming to be from your domain without the risk of legitimate mail bouncing while you're still tuning it.",
    remediation: () =>
      "Publish SPF and DKIM records and move DMARC to enforcement (quarantine, then reject once confident) - most mail providers document this as a guided setup, not custom engineering. Pair it with recurring security awareness training, since technical filtering alone won't stop every spoofed message.",
  },
  "training-no-phishing-sim": {
    technique: t("T1566", "Phishing"),
    traceability: (a) => `You indicated security awareness training is "${chosenLabel("training", a)}" and simulated phishing tests are "${chosenLabel("phishingSim", a)}".`,
    explain:
      "Training is meant to be the human-side defense against this technique, but without testing it, its actual effectiveness is unmeasured - you know training happened, not whether it worked.",
    compensatingControl: () =>
      "Run one low-stakes test manually before investing in a platform - a single internal email from IT with a fake \"reset your password\" link, tracking who clicks. It's a real interim data point on whether the training is landing, at effectively no cost.",
    remediation: () =>
      "Add recurring simulated phishing tests (monthly or quarterly, many awareness-training platforms include this) and track click/report rates over time as the actual measure of whether training is working, not just completion rates.",
  },
  "ot-flat-network": {
    technique: t("T1021", "Remote Services"),
    traceability: (a) => `You indicated your OT/ICS environment's network segregation from corporate IT is: "${a.otSegregation}".`,
    explain:
      "On a flat network, an attacker who compromises an ordinary IT account can use normal, everyday remote-access protocols to move straight into OT/ICS systems - no separate OT-specific exploit needed, just the same techniques used for regular lateral movement.",
    compensatingControl: (a) =>
      a.otRemoteAccess === "Yes, via a monitored jump host / secure gateway"
        ? "Remote access into OT is at least going through a monitored gateway, which limits one path in - as an interim step short of a full segmentation project, apply basic VLAN separation to your highest-value OT assets first rather than the whole environment at once."
        : "As an interim step short of a full segmentation project, apply basic VLAN separation to your highest-value OT assets first - a partial segmentation done now is better than a complete one planned for later.",
    remediation: () =>
      "Implement a real OT/IT segmentation architecture (a demilitarized zone between the two networks is the industry-standard reference model, per the Purdue Model), with firewalls mediating anything that must cross between them.",
  },
  "ot-remote-access-unsecured": {
    technique: t("T1133", "External Remote Services"),
    traceability: (a) => `You indicated OT remote access is: "${a.otRemoteAccess}".`,
    explain:
      "The same technique as the RDP exposure above, but the destination is industrial control systems rather than a normal server - remote access without a dedicated, monitored gateway is a direct path from a compromised remote device into OT.",
    compensatingControl: (a) =>
      a.otSegregation === "Yes, fully segregated"
        ? "OT is properly segregated from corporate IT, which limits how far a compromise through this remote-access path could spread - still, restrict that access to specific source IPs and put it behind MFA on a jump host as an immediate step, ahead of a full dedicated-gateway project."
        : "As an immediate step ahead of standing up a full dedicated gateway, restrict this remote access to specific source IPs and require MFA on a jump host in front of it - it won't match a real secure gateway, but it closes the most obvious version of this exposure quickly.",
    remediation: () =>
      "Stand up a dedicated, monitored jump host or OT-specific remote access gateway (several ICS security vendors build exactly this) so no remote connection reaches OT devices directly.",
  },
  "hardcoded-secrets-no-gates": {
    technique: t("T1552.001", "Unsecured Credentials: Credentials In Files"),
    traceability: (a) => `You indicated your DevSecOps practice is "${a.devsecopsMaturity}" and secrets management is "${a.secretsManagement}".`,
    explain:
      "Credentials sitting in code or plain config files are exactly what this technique targets - and unlike a stolen password, a hardcoded secret is often findable by anyone who ever gets read access to the repository or a build artifact, including long after the original reason for having it is gone.",
    compensatingControl: () =>
      "Rotate any currently-hardcoded secrets now - that's independent of whether a scanning gate exists yet. For new code going forward, move to environment variables or a basic secrets manager immediately, even before a full pipeline gate is built to enforce it.",
    remediation: () =>
      "Adopt a secrets manager (cloud-native options exist in AWS/Azure/GCP at low or no additional cost) and add an automated secret-scanning gate to your CI/CD pipeline (e.g. gitleaks or GitHub's own secret scanning) so a new hardcoded credential fails the build instead of merging.",
  },
  "unscanned-container-images": {
    technique: t("T1190", "Exploit Public-Facing Application"),
    traceability: (a) => `You indicated container use: "${a.usesContainers}" with image vulnerability scanning: "${a.containerImageScanning}".`,
    explain:
      "An unscanned image can easily be running software with a known, already-published, already-patched vulnerability without anyone realizing it - and if that container is internet-facing, that's precisely the opening this technique targets.",
    compensatingControl: (a) =>
      a.patching === 2
        ? "Host-level patching is on an automated schedule, which is good discipline - but it doesn't reach inside container images. Run a one-time manual scan against your existing images now (free tools like Trivy exist for exactly this) while automated image scanning gets set up properly."
        : "Run a one-time manual scan against your existing images now (free tools like Trivy exist for exactly this) - it won't replace ongoing automated scanning, but it tells you today whether anything currently running has a known, already-fixed vulnerability.",
    remediation: () =>
      "Add automated image scanning to your build pipeline (Trivy, Grype, or your registry's built-in scanner - most are free and open-source) so every image is scanned before deployment, not just checked once manually.",
  },
};

export const QUESTION_GUIDANCE = {
  // ---------------- Govern ----------------
  govPolicy: {
    technique: null,
    explain: "No leadership-approved policy means no top-down mandate driving readiness - controls depend on individual initiative rather than an accountable program, and are the first thing to lapse when the person who set them up leaves.",
    compensatingControl: () => "Name one accountable owner for security decisions today, even informally, while a real policy gets drafted.",
    remediation: () => "Draft a short (1-2 page) policy covering scope, acceptable use, and access basics, and get explicit leadership sign-off - a real, if brief, policy beats a comprehensive one that never gets approved.",
  },
  govRoles: {
    technique: null,
    explain: "\"IT handles it\" as the entire answer means no one is specifically accountable for verifying any given control actually works - gaps surface only after an incident, not before one.",
    compensatingControl: () => "Assign at least one named owner per major control area (endpoint, backups, access, monitoring, incident response) informally, today.",
    remediation: () => "Document a simple RACI for your top control areas and review/update it at least annually or after any org change.",
  },
  govReporting: {
    technique: null,
    explain: "Leadership can't fund or prioritize what they don't know about - without regular reporting, resourcing decisions happen blind to actual risk.",
    compensatingControl: () => "Send leadership a short informal summary of this assessment's findings now, even without a recurring cadence yet.",
    remediation: () => "Establish at least a quarterly risk report to leadership covering top findings and progress against them.",
  },
  govRiskDecisions: {
    technique: t("T1195", "Supply Chain Compromise"),
    explain: "New vendors and products are onboarded without a security review, meaning risk enters the environment through decisions nobody security-vetted before signing.",
    compensatingControl: () => "Informally require a quick IT/security check before any new vendor gets system or data access, even without a formal process yet.",
    remediation: () => "Add a short vendor security questionnaire as a required step before contract signature for any new vendor touching systems or data.",
  },
  isoIsms: {
    technique: null,
    explain: "Without a formal ISMS, individual controls may exist in isolation with nothing tying them together or re-evaluating them as the business changes - exactly what a 27001 audit checks first.",
    compensatingControl: () => "Write an informal scope statement (which systems/data are in scope) as a starting point before a full ISMS exists.",
    remediation: () => "Stand up a lightweight ISMS: documented scope, a risk register, and a semi-annual management review meeting.",
  },
  nis2Training: {
    technique: null,
    explain: "NIS2 places personal liability on management bodies specifically because oversight failures at that level are what let risk compound unnoticed across an organization.",
    compensatingControl: () => "Have leadership complete a single vendor-provided cyber-risk-for-executives briefing as an interim step.",
    remediation: () => "Schedule recurring (at least annual) governance-level training on cyber risk oversight and NIS2 duties for every accountable executive.",
  },
  hipaaBAA: {
    technique: t("T1195", "Supply Chain Compromise"),
    explain: "A vendor touching PHI without a signed BAA means there's no contractual assurance of their security controls, and a breach at their end becomes your HIPAA liability with no documented risk allocation.",
    compensatingControl: () => "Identify which current vendors touch PHI without a signed BAA and prioritize outreach to just that list first.",
    remediation: () => "Execute a BAA with every vendor that creates, receives, maintains, or transmits PHI before continuing to share data with them.",
  },
  gdprRopa: {
    technique: null,
    explain: "Without a ROPA, you can't demonstrate the lawful basis for any given use of personal data if a regulator or data subject asks - GDPR Article 30 requires this record specifically for that reason.",
    compensatingControl: () => "Start an informal spreadsheet inventory of what personal data is processed, why, and its lawful basis, before a polished ROPA exists.",
    remediation: () => "Build and maintain a formal ROPA covering purpose, categories of data, recipients, retention, and lawful basis for each processing activity.",
    reference: ref("GDPR Article 30 - Records of processing activities", "https://gdpr-info.eu/art-30-gdpr/"),
  },
  gdprDSR: {
    technique: null,
    explain: "Without a documented process, a real data-subject-rights request (access, deletion, portability) risks missing GDPR's required response window simply from not knowing who owns it internally.",
    compensatingControl: () => "Name one person as the interim owner of any data-subject request that comes in, with a manual checklist, before a formal process exists.",
    remediation: () => "Document a repeatable process (who receives the request, who verifies identity, who fulfills it, and by when) and test it once with a mock request.",
  },
  aiToolGovernance: {
    technique: null,
    explain: "Ungoverned AI tool usage commonly means sensitive data gets pasted into third-party AI services with unclear data-retention/training terms, or unreviewed AI-generated code ships without the same scrutiny other code gets.",
    compensatingControl: () => "Publish a one-page \"don't paste this into AI tools\" list (customer data, credentials, source code) immediately, before a formal policy exists.",
    remediation: () => "Establish a formal AI usage policy naming approved tools, prohibited data categories, and track usage the same way other software is inventoried.",
  },

  // ---------------- Identify ----------------
  assetInv: {
    technique: null,
    explain: "Without a real asset inventory, you can't protect what you don't know exists - shadow IT and forgotten systems are common actual entry points precisely because nobody is watching them.",
    compensatingControl: () => "Do a manual one-time inventory pass this month of anything with an IP address or a login, even without ongoing automation yet.",
    remediation: () => "Deploy automated asset discovery (many EDR and network tools include this) and review the inventory at least quarterly.",
  },
  dataClass: {
    technique: null,
    explain: "Without classifying data by sensitivity, every system gets roughly the same level of protection - your most sensitive data isn't specially guarded, and everything else isn't handled more cheaply either.",
    compensatingControl: () => "Identify just your single most sensitive data category (e.g. customer PII, financial records) and apply extra access restriction to it now.",
    remediation: () => "Define a simple 3-4 tier classification scheme (e.g. public/internal/confidential/restricted) and label major data stores/systems accordingly.",
  },
  vendorCount: {
    technique: t("T1195", "Supply Chain Compromise"),
    explain: "Unreviewed third-party access is a way for risk to enter through a trusted vendor rather than a direct attack on you.",
    compensatingControl: (a) =>
      a.assetInv !== 0
        ? "Use your existing asset inventory to identify which vendors touch your most sensitive systems or data, and review just that short list manually as an interim step."
        : "Start with a short list - which vendors have access to your most sensitive systems or data, not all of them - and review just those manually as a realistic interim step.",
    remediation: () => "Build a vendor inventory recording what each vendor can access, and require a lightweight security review before granting any new vendor access going forward.",
  },
  isoRiskAssess: {
    technique: null,
    explain: "Without an annual formal risk assessment, new risk introduced by business change (new systems, vendors, regulations) goes unassessed until something forces the issue.",
    compensatingControl: () => "Run an informal, even single-afternoon risk review of your top systems as an interim step before a formal process exists.",
    remediation: () => "Conduct a formal, documented asset-based risk assessment at least annually, scoring likelihood and impact and tracking treatment decisions.",
  },
  hipaaRiskAnalysis: {
    technique: null,
    explain: "A HIPAA risk analysis has to cover every system that creates, receives, maintains, or transmits ePHI - letting it go stale or skipping it means you can't demonstrate you actually know where your PHI exposure is, one of the most commonly cited findings in real OCR enforcement actions.",
    compensatingControl: () => "List every system that touches ePHI today as an interim inventory, even before a full risk analysis is redone.",
    remediation: () => "Commission or conduct a current, comprehensive HIPAA security risk analysis covering all ePHI systems, and track remediation of findings on a schedule.",
  },

  // ---------------- Protect ----------------
  mfa: {
    technique: t("T1078", "Valid Accounts"),
    explain: "MFA is the specific control that stops a leaked or guessed password alone from being enough to log in as a legitimate user.",
    compensatingControl: (a) =>
      a.passwordPolicy === 2
        ? "A strong password policy is enforced, which helps somewhat - prioritize MFA on admin and remote-access accounts first, since those are the highest-value targets."
        : "Prioritize MFA on admin and remote-access accounts first - that's the smallest rollout that closes the largest share of risk.",
    remediation: () => "Enforce MFA for every account, not just admins - most identity providers (Microsoft Entra, Google Workspace, Okta) support org-wide enforcement from one setting.",
    reference: ref("CISA: Require Multifactor Authentication", "https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/require-multifactor-authentication"),
  },
  passkeys: {
    technique: t("T1110", "Brute Force"),
    explain: "Even with MFA, a password can still be phished, reused, or brute-forced as the first factor. Passkeys remove that weakness structurally - there's no shared secret for an attacker to ever obtain in the first place, since the private key never leaves the device.",
    compensatingControl: () => "If passkeys aren't feasible organization-wide yet, ensure MFA is at minimum fully enforced as the interim mitigation for the same underlying credential-theft risk.",
    remediation: () => "Enable passkey/WebAuthn support in your identity provider (Microsoft Entra, Google Workspace, and Okta all support this natively) starting with admin and highest-risk accounts, then expand.",
    reference: ref("Microsoft Entra: passkey (FIDO2) authentication", "https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-passkeys-fido2"),
  },
  patching: {
    technique: t("T1190", "Exploit Public-Facing Application"),
    explain: "Unpatched software is what turns an already-known, already-fixed vulnerability into a working exploit - attackers routinely scan for exactly this rather than looking for something novel.",
    compensatingControl: (a) =>
      a.vulnScanning !== 0
        ? "Vulnerability scanning is happening at least occasionally, which helps surface what's missing - use that output to prioritize patching your internet-facing systems first, ahead of everything else."
        : "Prioritize patching internet-facing systems first, on whatever manual cadence is realistic right now - that's the subset actually reachable by an opportunistic scan.",
    remediation: () => "Automate patch deployment with a defined SLA (e.g. critical patches within 72 hours, everything else within 30 days) rather than ad hoc manual patching.",
  },
  dbEncryption: {
    technique: t("T1005", "Data from Local System"),
    explain: "An unencrypted database means a stolen backup, a misconfigured storage bucket, or a leaked credential exposes the data in plain, immediately-usable form - encryption at rest is what makes a stolen copy alone insufficient.",
    compensatingControl: () => "As an interim step, confirm at minimum that any database backups or exports are encrypted, even if the live database itself isn't yet.",
    remediation: () => "Enable at-rest encryption - a native, typically low-effort setting on every major database engine and managed cloud database service, not a migration project.",
  },
  dbAccessControl: {
    technique: t("T1078", "Valid Accounts"),
    explain: "Routine application access through a shared or admin database credential means a single compromised credential (from the app server, a leaked config file, or a former employee) grants broad, often unaudited access to the entire database.",
    compensatingControl: () => "As an interim step, restrict the current shared/admin credential to only the specific tables or operations the application actually needs.",
    remediation: () => "Provision a dedicated, least-privilege application account scoped to only what the app requires, and retire the shared/admin credential from routine use.",
  },
  dbPatching: {
    technique: t("T1190", "Exploit Public-Facing Application"),
    explain: "Database software carries its own CVEs independent of the application built on top of it - an unpatched database engine can be exploited directly, bypassing whatever protections exist at the application layer entirely.",
    compensatingControl: () => "As an interim step, check your database engine's current version against its vendor's security advisories to see if any known-exploited vulnerability applies right now.",
    remediation: () => "Put database software on the same defined patch cadence as the rest of your infrastructure - most managed cloud database services offer automatic minor-version patching as a configuration option.",
  },
  training: {
    technique: t("T1566", "Phishing"),
    explain: "Training is the human-side defense against this technique - recognizing and reporting a malicious link or attachment before it's acted on.",
    compensatingControl: (a) =>
      a.emailAuth === 2
        ? "Email authentication is enforced, which filters some spoofed mail before it arrives - reinforce that with a simple, well-publicized way for employees to report suspicious email as an immediate interim step."
        : "As an immediate step, publish a simple, well-known way for employees to report suspicious email - low-effort, and useful even before formal training exists.",
    remediation: () => "Stand up recurring (not one-time) security awareness training - even a low-cost platform with monthly micro-training beats an annual slideshow.",
  },
  phishingSim: {
    technique: t("T1566", "Phishing"),
    explain: "Simulated phishing tests are how you find out whether your actual defenses against this technique - training, filtering, reporting habits - are working, rather than assuming they are.",
    compensatingControl: () => "Run one low-stakes manual test before investing in a platform - a single internal email from IT with a fake link, tracking who clicks. It's a real data point at effectively no cost.",
    remediation: () => "Add recurring simulated phishing tests (monthly or quarterly) and track click/report rates over time as the real measure of whether training works.",
  },
  trainingCadence: {
    technique: t("T1566", "Phishing"),
    explain: "A single onboarding session is well-documented to fade from memory within months - without an ongoing cadence, the workforce's actual readiness against phishing decays continuously between now and whenever the next session happens to occur.",
    compensatingControl: () => "Send one short refresher (even a single email with 2-3 real examples of recent phishing attempts) now, as an interim measure ahead of a fixed cadence.",
    remediation: () => "Move to ongoing, recurring training (monthly micro-training beats an annual session) - most awareness platforms support this on autopilot once configured.",
  },
  endpoint: {
    technique: t("T1204", "User Execution"),
    explain: "Partial endpoint coverage means the devices without protection are exactly where malware delivered via a phishing link or malicious attachment can execute and run undetected - one unprotected laptop is a real, common entry point, not a theoretical gap.",
    compensatingControl: () => "As an interim step, identify and prioritize the highest-risk unprotected devices (remote workers, privileged users) for coverage first, rather than waiting for a full rollout.",
    remediation: () => "Extend EDR/antivirus deployment to 100% of devices, and enforce it as a condition of network access (many EDR platforms support this directly) so an unprotected device can't silently rejoin later.",
  },
  rdpExposed: {
    technique: t("T1133", "External Remote Services"),
    explain: "Remote-admin access reachable directly from the internet is a well-documented, heavily automated attack path - it doesn't require phishing or malware, just a scan that finds it.",
    compensatingControl: () => "As an immediate step ahead of moving it behind a VPN/ZTNA, restrict access to a specific IP allowlist and enable account lockout on failed logins.",
    remediation: () => "Move remote administrative access behind a VPN or ZTNA solution, with MFA required on that login, so RDP itself is never directly internet-reachable.",
  },
  emailAuth: {
    technique: t("T1566", "Phishing"),
    explain: "Without SPF/DKIM/DMARC enforced, attackers can send mail that appears to come from your own domain, to your own employees, customers, or partners.",
    compensatingControl: (a) =>
      a.phishingSim !== 0
        ? "Simulated phishing tests are already running, which helps independent of this gap - as a fast interim step, move DMARC to quarantine (not reject yet) to start filtering spoofed mail without risking legitimate mail bouncing."
        : "As a fast interim step, move DMARC to quarantine (not reject yet) - it filters spoofed mail without the risk of legitimate mail bouncing while it's tuned.",
    remediation: () => "Publish SPF and DKIM records and move DMARC to full enforcement (reject) once you've confirmed legitimate mail flows aren't affected during a quarantine period.",
  },
  privSeparation: {
    technique: t("T1078", "Valid Accounts"),
    explain: "When the same account is used for everyday work and admin tasks, there's no privilege escalation for an attacker to perform - a single compromised login is already an admin login.",
    compensatingControl: () => "As an interim step short of full separation, at minimum create a distinct admin login for the highest-risk systems (domain controllers, core financial or customer data) first, rather than everywhere at once.",
    remediation: () => "Issue separate admin and everyday accounts for every user who needs elevated access, with the admin account never used for email, browsing, or routine work.",
  },
  privilegedAccessModel: {
    technique: t("T1078", "Valid Accounts"),
    explain: "Standing (always-on) elevated access means a compromised admin credential grants full privileges at any moment, indefinitely - just-in-time access limits the actual window an attacker has to a specific, short-lived, auditable elevation event.",
    compensatingControl: () => "As an interim step, review which standing-admin accounts are actually used daily versus rarely, and de-escalate the rarely-used ones to on-demand access first.",
    remediation: () => "Adopt a privileged access management (PAM) solution or your identity provider's built-in just-in-time elevation feature (Microsoft Entra PIM, for example) so elevated access is granted per-task and expires automatically.",
  },
  privAccountMgmt: {
    technique: t("T1078", "Valid Accounts"),
    explain: "Shared or long-standing privileged credentials are a high-value target precisely because they're rarely rotated and often outlive the reason they were created - one compromise can go unnoticed for a long time.",
    compensatingControl: (a) =>
      a.offboarding === 2
        ? "Access is at least revoked promptly when someone leaves, which limits one source of stale privileged credentials - as an interim step, do a one-time manual review of who currently holds privileged access, even without a recurring review process yet."
        : "As an interim step, do a one-time manual review of who currently holds privileged access and revoke anything clearly stale - a single pass now is better than waiting for a full recurring review process.",
    remediation: () => "Individually assign every privileged account (no shared logins), and schedule a recurring (at least quarterly) access review with least-privilege enforcement.",
  },
  passwordPolicy: {
    technique: t("T1110", "Brute Force"),
    explain: "Weak or default password requirements make automated password-guessing and credential-stuffing attacks meaningfully more likely to succeed.",
    compensatingControl: (a) =>
      a.mfa !== 0
        ? "MFA is at least partially enforced, which limits what a guessed password alone can do - as an interim step, set a minimum length requirement (length matters more than complexity rules) even before a full policy is formalized."
        : "As an interim step, set a minimum length requirement organization-wide (length matters more than complexity rules) - it's a five-minute setting change, not a program.",
    remediation: () => "Adopt a length-focused password policy (12+ characters, no forced periodic rotation, which NIST no longer recommends since it drives weaker password reuse patterns) and pair it with MFA.",
    reference: ref("NIST SP 800-63B: Digital Identity Guidelines - Authentication", "https://pages.nist.gov/800-63-3/sp800-63b.html"),
  },
  passwordManager: {
    technique: t("T1110", "Brute Force"),
    explain: "Without a password manager, password reuse across services is common - and reuse is exactly what makes credential-stuffing attacks (using passwords leaked from an unrelated breach) work.",
    compensatingControl: (a) =>
      a.mfa === 2
        ? "MFA is enforced everywhere, which meaningfully limits the damage from a reused/stuffed password - in the meantime, publish a simple written password policy (unique passwords, minimum length) as the documented interim standard until a password manager is deployed."
        : "In the meantime, publish a simple written password policy (unique passwords per service, minimum length) as the documented interim standard, and prioritize deploying at least partial MFA alongside it - together they cover most of what a password manager alone would.",
    remediation: () => "Deploy an organization-provisioned password manager (most business identity/security suites include one) so unique passwords per service become the default, not a personal discipline problem.",
  },
  offboarding: {
    technique: t("T1078", "Valid Accounts"),
    explain: "An account left active after someone leaves is a fully legitimate-looking login that nobody is watching - one of the most common, least sophisticated ways attackers (including former employees) get in.",
    compensatingControl: (a) =>
      a.siem !== 0
        ? "Centralized logging is in place - use it to set an alert specifically for logins from accounts belonging to recently departed staff as an interim measure until offboarding is fully automated."
        : "As an interim step, add \"revoke all access\" as the literal first line item on whatever offboarding checklist (formal or not) currently exists, and assign it to a specific person by name.",
    remediation: () => "Automate access revocation tied to HR's own termination workflow (most identity providers support this integration) so it doesn't depend on someone remembering a manual step.",
  },
  soc2Change: {
    technique: null,
    explain: "Without documented change management, a SOC 2 Type II audit has no evidence trail to test - and more practically, undocumented production changes are a common source of accidental outages and unreviewed security-relevant misconfigurations alike.",
    compensatingControl: () => "As an interim step, start logging production changes in a shared doc or ticketing system, even without formal approval gates yet.",
    remediation: () => "Implement a change management process with required approval and logging for production changes - most ticketing/CI tools (Jira, GitHub, ServiceNow) support this as a workflow, not a separate system.",
  },
  hipaaEncryption: {
    technique: t("T1005", "Data from Local System"),
    explain: "PHI encrypted in only one state (at rest or in transit, not both) leaves the other state exposed in plain form - e.g. encrypted on disk but sent over an unencrypted connection still exposes it to interception.",
    compensatingControl: () => "Identify and prioritize whichever state (at rest or in transit) is currently unencrypted, since closing the weaker of the two first removes the larger share of exposure.",
    remediation: () => "Enable encryption for PHI both at rest (native database/storage encryption) and in transit (TLS everywhere, no exceptions for internal traffic) - both are standard, low-effort configuration options on modern platforms.",
  },
  soxSoD: {
    technique: null,
    explain: "Without segregation of duties, a single person can both initiate and approve a financial transaction with no independent check - the exact control gap SOX Section 404 audits specifically test for.",
    compensatingControl: () => "As an interim step, identify your highest-value financial workflows and add a manual second-approver check, even before a system-enforced control exists.",
    remediation: () => "Configure your financial system's built-in approval workflows to enforce segregation of duties (most ERP/accounting platforms support this natively) rather than relying on informal practice.",
  },
  soxAccessReview: {
    technique: t("T1078", "Valid Accounts"),
    explain: "Without periodic access review, financial-system permissions granted for a past role or project tend to persist indefinitely - stale access is exactly what turns a single compromised account into a broader financial-reporting risk.",
    compensatingControl: () => "As an interim step, do a one-time manual review of who currently has financial-system access and revoke anything clearly stale.",
    remediation: () => "Schedule a recurring (at least quarterly) formal review of financial-system access rights, with sign-off from a named control owner.",
  },
  cyberEssentialsBoundaryFirewall: {
    technique: t("T1133", "External Remote Services"),
    explain: "A broadly permissive boundary firewall means far more of your network is reachable from the internet than actually needs to be - every open, unnecessary port is one more thing an attacker doesn't have to work to find.",
    compensatingControl: () => "As an interim step, audit current firewall rules for anything permissive that isn't clearly justified, and close the obvious unnecessary ones immediately.",
    remediation: () => "Reconfigure boundary firewalls to default-deny, explicitly allowing only the specific services that genuinely need external reachability - Cyber Essentials scores this exact control directly.",
  },
  cyberEssentialsSecureConfig: {
    technique: t("T1078", "Valid Accounts"),
    explain: "Default manufacturer passwords and unnecessary pre-installed software/services on a device are both well-known, commonly scanned-for weaknesses - they're what an attacker checks for first because they require no actual exploitation, just default configuration nobody changed.",
    compensatingControl: () => "As an interim step, change default credentials on your highest-exposure devices (anything internet-facing) first, even before a full secure-baseline process exists.",
    remediation: () => "Define and enforce a secure baseline configuration (no default credentials, unnecessary services disabled) applied before any device is deployed, not audited after the fact.",
  },
  pcidssCDESegmentation: {
    technique: t("T1021", "Remote Services"),
    explain: "An unsegmented cardholder data environment means a compromise anywhere on the broader network can reach systems that store or process card data - segmentation is what PCI DSS uses to shrink the actual audit scope and the real attack surface together.",
    compensatingControl: () => "As an interim step, identify which systems genuinely need to be in the cardholder data environment and apply basic network ACLs restricting access to just those, ahead of full segmentation.",
    remediation: () => "Implement real network segmentation (VLANs plus firewall rules, validated by a segmentation penetration test) isolating the cardholder data environment from the rest of the network.",
  },
  pcidssSensitiveAuthData: {
    technique: t("T1005", "Data from Local System"),
    explain: "Retaining full track data, CVV/CVC, or PIN data after authorization is explicitly prohibited by PCI DSS specifically because that data is what makes stolen card data usable for fraud - its presence turns any breach into a much more damaging one.",
    compensatingControl: () => "As an immediate step, identify exactly where this data is currently being retained and stop writing new records to that field/table today, even before historical data is purged.",
    remediation: () => "Purge any retained sensitive authentication data and reconfigure payment processing so it is never stored post-authorization - most payment processors provide tokenization specifically to avoid ever touching this data directly.",
  },

  // ---------------- Detect ----------------
  siem: {
    technique: t("T1070", "Indicator Removal"),
    explain: "Without centralized logging, there's no reconstructable record of what happened during an incident - attackers who clear local logs face no obstacle since there was never a second, centralized copy.",
    compensatingControl: () => "As an interim step, turn on your hosting/cloud provider's or firewall's built-in logging (often a checkbox, not a purchase) even before a dedicated SIEM exists.",
    remediation: () => "Deploy centralized logging (a SIEM or a lighter-weight log aggregation tool) covering at minimum authentication events, firewall/network logs, and endpoint alerts.",
  },
  anomalyTime: {
    technique: t("T1078", "Valid Accounts"),
    explain: "\"We likely wouldn't notice\" means an attacker using a valid, stolen credential can operate for an extended, unbounded period before detection - the technique itself is unremarkable; the real risk is entirely in the lack of anything watching for it.",
    compensatingControl: () => "As an interim step, enable your identity provider's built-in unusual-sign-in alerting (impossible travel, new device/location) - most include this at no extra cost.",
    remediation: () => "Deploy automated alerting on anomalous logins and behavior (via SIEM correlation rules or your identity provider's built-in risk detection) so detection happens in minutes to hours, not never.",
  },
  exfil: {
    technique: t("T1041", "Exfiltration Over C2 Channel"),
    explain: "Without monitoring for unusual outbound traffic, this is how a breach goes from \"contained\" to \"data actually left the building\" without anyone noticing at the time.",
    compensatingControl: (a) =>
      a.siem !== 0
        ? "Centralized logging exists - as an interim step, add a basic alert for large or unusual outbound data transfers using what's already being collected, rather than waiting on a dedicated exfiltration-monitoring tool."
        : "As an interim step, check whether your firewall, hosting provider, or cloud platform already logs outbound traffic volume by default - many do, and enabling an alert on unusually large transfers is often a configuration change, not a new purchase.",
    remediation: () => "Enable outbound traffic monitoring with alerting on unusually large or unusual-destination transfers - most modern firewalls and cloud platforms support this as a built-in feature.",
  },
  vulnScanning: {
    technique: t("T1190", "Exploit Public-Facing Application"),
    explain: "Without regular vulnerability scanning, known exploitable flaws in your own systems go undiscovered by you - and get discovered by an attacker's scan instead.",
    compensatingControl: () => "As an interim step, run a single one-time scan against your internet-facing systems now (several reputable free/low-cost scanners exist) even before a recurring schedule is set up.",
    remediation: () => "Schedule regular (at minimum quarterly, ideally continuous) external and internal vulnerability scans, and track findings to remediation.",
  },
  pentest: {
    technique: null,
    explain: "A scan finds known vulnerabilities; a penetration test finds exploitable chains and logic flaws a scanner can't - going 12+ months without one means your actual exploitability (not just your patch level) is untested.",
    compensatingControl: () => "As an interim step, at minimum ensure vulnerability scanning (a lighter-weight alternative) is happening regularly while a full pentest is scheduled.",
    remediation: () => "Schedule an external penetration test or red-team engagement at least annually, and after any major infrastructure change.",
  },
  soc2Evidence: {
    technique: null,
    explain: "A SOC 2 Type II audit specifically tests whether controls operated effectively over a review period, not just whether they exist - without retained evidence/logs, there's nothing to actually demonstrate that.",
    compensatingControl: () => "As an interim step, start retaining logs/evidence for your key controls now, even before a full audit-ready evidence program exists - gaps before today can't be recovered.",
    remediation: () => "Build a systematic evidence-retention process (many GRC/compliance platforms automate this) tied to each control being tested, not manual collection at audit time.",
  },
  soxAuditTrail: {
    technique: t("T1070", "Indicator Removal"),
    explain: "An audit trail that isn't protected from tampering can't reliably prove what happened in a financial system - and this is precisely the technique (indicator/log tampering) that would defeat an unprotected trail.",
    compensatingControl: () => "As an interim step, ensure audit logs are at minimum being retained somewhere separate from the systems that generate them, even before full tamper-protection is implemented.",
    remediation: () => "Implement write-once or centrally-forwarded, access-controlled audit logging for financial systems so logs can't be altered by anyone with access to the source system.",
  },
  pcidssASVScanning: {
    technique: t("T1190", "Exploit Public-Facing Application"),
    explain: "PCI DSS requires quarterly external scans specifically by an Approved Scanning Vendor - irregular or non-ASV scanning means you can't demonstrate continuous compliance, and real gaps can persist for a full quarter or more before being found.",
    compensatingControl: () => "As an interim step, run your existing vulnerability scanning on an internal quarterly cadence now, even before engaging a formal ASV.",
    remediation: () => "Engage a PCI-Approved Scanning Vendor for mandatory quarterly external scans, and remediate any findings before the next scan cycle.",
  },

  // ---------------- Respond ----------------
  irPlan: {
    technique: null,
    explain: "An untested (or absent) incident response plan means the first real incident becomes the first rehearsal - improvised decisions under pressure are slower and more error-prone than a practiced process.",
    compensatingControl: () => "As an interim step, write a one-page \"first hour\" checklist (who declares an incident, who has authority to isolate a system) even before a full plan exists.",
    remediation: () => "Write a documented incident response plan and test it annually via a tabletop exercise, updating it based on what the exercise reveals.",
  },
  irTeam: {
    technique: null,
    explain: "With no designated contact, a suspected incident has nowhere specific to go - critical early minutes are lost figuring out who should even be told, let alone who acts.",
    compensatingControl: () => "Name one person as the interim incident contact today, even informally, with no other qualifications required than being reachable.",
    remediation: () => "Formally designate an incident response contact or team, publish how to reach them, and confirm they have the authority they'd need in a real incident.",
  },
  commsPlan: {
    technique: null,
    explain: "Without a breach communication plan, legal, customer, and regulatory notifications get improvised during the highest-pressure moment of an incident - increasing the odds of missed legal deadlines or reputational mistakes.",
    compensatingControl: () => "As an interim step, identify who (legal counsel, a PR contact) would need to be looped in for a breach, even before a written plan exists.",
    remediation: () => "Document a breach communication plan naming who notifies legal, customers, and regulators, and under what circumstances/timelines each applies.",
  },
  nis2Notify: {
    technique: null,
    explain: "NIS2's 24-hour early-warning requirement is tight enough that an ad hoc, un-rehearsed process will very likely miss it - the deadline itself is one of the most commonly failed NIS2 requirements in readiness assessments.",
    compensatingControl: () => "As an interim step, identify exactly which national CSIRT/authority you'd need to notify and how, so the contact information exists before it's needed under pressure.",
    remediation: () => "Build and rehearse a defined process for the 24-hour early-warning notification, integrated into your broader incident response plan.",
  },
  gdprBreach72h: {
    technique: null,
    explain: "GDPR's 72-hour breach notification window is short enough that an undefined process risks missing it entirely - and missing the deadline is itself a separate compliance failure on top of the breach.",
    compensatingControl: () => "As an interim step, identify your relevant supervisory authority and their notification requirements now, so this isn't researched for the first time during a real breach.",
    remediation: () => "Document and rehearse a defined process for the 72-hour supervisory authority notification, integrated into your incident response plan.",
  },

  // ---------------- Recover ----------------
  backupTest: {
    technique: t("T1486", "Data Encrypted for Impact"),
    explain: "This is the ransomware technique - and an untested backup is a backup whose recoverability is simply unknown until the day it matters most.",
    compensatingControl: (a) =>
      a.backupIsolation === 2
        ? "Backups are at least isolated from the production network, which is the part that matters most against ransomware specifically - test-restore a single file or system now for a first real data point."
        : "As an immediate step, manually test-restore a single file or one low-priority system this week - a small real test now beats a large untested backup indefinitely.",
    remediation: () => "Schedule quarterly (at minimum) backup-restore tests against real systems, documenting actual restore time against your required recovery targets.",
    reference: ref("CISA: StopRansomware", "https://www.cisa.gov/stopransomware"),
  },
  bcdr: {
    technique: null,
    explain: "Without a documented business continuity/disaster recovery plan, an outage forces improvised decisions about which systems and processes matter most to restore first - decided for the first time during the outage itself.",
    compensatingControl: () => "As an interim step, list your top 3-5 business-critical systems and their rough acceptable downtime, even before a full BCDR plan exists.",
    remediation: () => "Document a business continuity/disaster recovery plan defining recovery priorities, targets (RTO/RPO), and alternate processes, and test it periodically.",
  },
  backupIsolation: {
    technique: t("T1490", "Inhibit System Recovery"),
    explain: "Ransomware operators specifically target connected backup systems and shadow copies to prevent recovery, not just the primary systems - a backup reachable from the production network can be encrypted or deleted right alongside everything else.",
    compensatingControl: (a) =>
      a.backupTest === 2
        ? "Backups are tested regularly, which confirms they work - the remaining risk is that they're reachable from production. As an interim step, move at least the most recent backup set to an offline or immutable copy even before the whole backup system is re-architected."
        : "As an interim step, prioritize moving just the most recent backup set to an offline or immutable copy - the full re-architecture can follow, but one truly isolated recent copy is what actually matters in a live ransomware scenario.",
    remediation: () => "Adopt the 3-2-1 backup rule (3 copies, 2 media types, 1 offline/immutable) so at least one copy is structurally unreachable from a network-based ransomware event.",
    reference: ref("CISA: StopRansomware", "https://www.cisa.gov/stopransomware"),
  },
};

export function guidanceForFlag(flag, answers, full = true) {
  const g = FLAG_GUIDANCE[flag.id];
  if (!g) return null;
  const base = {
    traceability: g.traceability ? g.traceability(answers) : null,
    explain: g.explain,
    remediation: g.remediation ? g.remediation(answers) : null,
  };
  if (!full) return base;
  return {
    ...base,
    technique: g.technique,
    control: g.compensatingControl(answers),
    reference: g.reference || null,
  };
}

export function guidanceForGapItem(item, answers, full = true) {
  const g = QUESTION_GUIDANCE[item.id];
  if (!g) return null;
  const base = {
    traceability: questionTraceability(item),
    explain: g.explain,
    remediation: g.remediation ? g.remediation(answers) : null,
  };
  if (!full) return base;
  return {
    ...base,
    technique: g.technique,
    control: g.compensatingControl(answers),
    reference: g.reference || null,
  };
}
