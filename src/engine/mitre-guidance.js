// §2 Phase 2: MITRE ATT&CK + compensating-controls guidance for the results
// panel. Two lookup tables, keyed off the stable ids introduced in
// scoring.js: FLAG_GUIDANCE (one entry per computeFlags() combination) and
// QUESTION_GUIDANCE (one entry per single low-scoring question that can
// appear in computePriorities()' top-5).
//
// Deliberately not exhaustive. Per PHASE2-BRIEF.md's "no fabricated data"
// rule, an id is only present here when there's a genuinely confident,
// well-established ATT&CK Enterprise technique behind it - flags/questions
// that are governance/process gaps rather than a specific attacker
// technique (e.g. no-accountability, pentest cadence) are either omitted
// entirely or given a `technique: null` entry that explains the reasoning
// without inventing a technique ID to hang it on.
//
// Every `compensatingControl` is a function of the full answers object so it
// can genuinely cross-reference other collected answers rather than restate
// the gap. Framing is "do X in the meantime", never the words "defense in
// depth".

function t(id, name) {
  return { id, name };
}

export const FLAG_GUIDANCE = {
  "mfa-vendor-exposure": {
    technique: t("T1078", "Valid Accounts"),
    explain:
      "Once a vendor credential leaks (in a breach that has nothing to do with you), this is the technique that turns it into access: the attacker just logs in as a legitimate user. MFA is the control that specifically stops a leaked password alone from being enough.",
    compensatingControl: (a) =>
      a.siem !== 0
        ? "You do have some centralized logging in place - until MFA is rolled out everywhere, add alerting specifically on vendor and service-account logins from new locations or at unusual times, since that's the exact path this gap leaves open."
        : "Start the MFA rollout with vendor-facing and admin accounts specifically, not devices - that's the smallest set of accounts that closes the largest share of this exposure. In parallel, ask your highest-risk vendors for written confirmation of their own access controls until yours are in place.",
  },
  "no-logging-no-ir": {
    technique: t("T1070", "Indicator Removal"),
    explain:
      "Attackers who want to cover their tracks after a breach use techniques like this to erase logs. Without centralized logging, they don't need to bother - there's nothing to erase, and no way to reconstruct what happened after the fact.",
    compensatingControl: (a) =>
      a.irTeam === 2
        ? "You do have a designated incident response contact or team - even without formal logging, write down a one-page \"if something looks wrong, do this first\" checklist for that person now, rather than waiting for a full IR plan."
        : "Name one person as the accountable incident contact today, even informally - an unwritten plan with no owner is the actual gap here, and that's fixable in an afternoon while the logging and formal plan get built out.",
  },
  "untested-backup-weak-endpoint": {
    technique: t("T1486", "Data Encrypted for Impact"),
    explain:
      "This is the ransomware technique itself - files and systems encrypted until a ransom is paid. Endpoint protection is what's supposed to catch the encryption process running; tested backups are what make the ransom demand irrelevant. This gap removes both.",
    compensatingControl: (a) =>
      a.backupIsolation === 2
        ? "Your backups are at least isolated from the production network, which is the part that matters most against ransomware specifically - as an immediate low-effort step, manually restore one file or one non-critical system now to get a first real data point on whether the backups actually work."
        : "As an immediate step, manually test-restore a single file or one low-priority system this week - that's a far smaller lift than a full DR test and still tells you whether backups are fundamentally sound before anything depends on them.",
  },
  "no-training-partial-mfa": {
    technique: t("T1566", "Phishing"),
    explain:
      "This is the most common way attackers get initial access - a malicious link or attachment that a person, not a system, has to recognize and reject. Untrained employees are less likely to catch it, and partial MFA means a successful phish can still land on an account with no second gate.",
    compensatingControl: (a) =>
      a.emailAuth === 2
        ? "Email authentication is enforced, which filters out a meaningful share of spoofed phishing before it reaches anyone - while training gets built out, finish the MFA rollout to 100% of accounts first, since that closes the gap that matters most if a phish does get through."
        : "Finishing MFA rollout to 100% of accounts is the faster, cheaper interim step compared to standing up a training program - it directly limits what a successful phish can do, even before anyone's had a single training session.",
  },
  "no-vendor-risk-review": {
    technique: t("T1195", "Supply Chain Compromise"),
    explain:
      "This is risk entering through a trusted third party rather than a direct attack on you - a compromised vendor becomes a way in. It's why unreviewed vendor relationships are treated as a real attack surface, not just a procurement detail.",
    compensatingControl: (a) =>
      a.assetInv !== 0
        ? "You have at least a partial asset inventory - use it now to identify which of your 6+ vendors actually touch your most sensitive systems or data, and review just those manually as an interim step before a formal process exists for all of them."
        : "Start with a short list: which vendors have access to your most sensitive systems or data, not all of them. Reviewing that short list manually this month is a realistic interim step; a formal process for every vendor is not.",
  },
  "no-policy-no-ir": {
    technique: null,
    explain:
      "This isn't a specific attacker technique - it's a program-level gap. Without a leadership-approved policy or a tested response plan, readiness for every technique described elsewhere in this report depends on whoever happens to notice something first, rather than an accountable process.",
    compensatingControl: (a) =>
      a.irTeam === 2
        ? "You do have a designated incident contact - get leadership to sign off on that person's authority to act in a one-paragraph email or memo now. That's a real interim mandate, and far faster than waiting for a full policy document."
        : "The single fastest fix here isn't a document - it's naming one accountable person, today, even informally, and getting a one-line acknowledgment from leadership that they're it until a formal policy exists.",
  },
  "exposed-db-app-no-monitoring": {
    technique: t("T1190", "Exploit Public-Facing Application"),
    explain:
      "A public web app connected to a database is a direct target for this technique - things like SQL injection against the app itself. Centralized logging and outbound-traffic monitoring are what typically catch the follow-on data exfiltration; without them, a successful exploit can run for a long time before anyone notices.",
    compensatingControl: (a) =>
      a.vulnScanning !== 0
        ? "Regular vulnerability scanning helps catch some exploitable issues before they're used, but it doesn't replace monitoring for exfiltration after the fact. As an immediate step, turn on your hosting or cloud provider's built-in access/traffic logging - most include this at no extra cost, and it beats having no visibility at all."
        : "As an immediate step, turn on your hosting or cloud provider's built-in access and traffic logging - most platforms include this by default at no extra cost. It's not a substitute for a real monitoring program, but it's meaningfully better than the current no-visibility state."
  },
  "no-accountability": {
    technique: null,
    explain:
      "Not a specific attacker technique - a structural gap. Every finding elsewhere in this report assumes someone is positioned to act on it; with no internal team and no formal outsourced arrangement, that assumption doesn't hold.",
    compensatingControl: () =>
      "Name one internal person - even someone without a security background - as the accountable point of contact for whatever IT support you do use. That single step turns ad hoc into at least nominally managed, and it's the realistic starting point here rather than standing up a formal function overnight.",
  },
  "cloud-no-mfa": {
    technique: t("T1078.004", "Valid Accounts: Cloud Accounts"),
    explain:
      "The cloud-specific version of credential-based access - a leaked password alone is enough to reach admin consoles that are reachable from anywhere in the world, not just from inside your office network.",
    compensatingControl: (a) =>
      a.passwordPolicy === 2
        ? "A strong password policy is already enforced, which raises the bar somewhat - but it doesn't stop a reused or phished password. Prioritize MFA on the cloud admin console / root account specifically first; that single account is the highest-value target and the fastest thing to lock down."
        : "Prioritize MFA on the cloud admin console / root account specifically, before anywhere else - it's the single highest-value account, reachable from anywhere, and the fastest one to close.",
  },
  "rdp-exposed-ransomware-path": {
    technique: t("T1133", "External Remote Services"),
    explain:
      "Remote access exposed directly to the internet is a documented, repeatedly-used entry point - attackers scan for exactly this and use it to log straight in, no phishing or malware required to get the initial foothold.",
    compensatingControl: () =>
      "Putting RDP behind a VPN or ZTNA is the real fix, but as an immediate same-day step: restrict access to a specific IP allowlist and enable account lockout / rate-limiting on failed logins. Neither is a substitute for removing the direct exposure, but both meaningfully raise the cost of the most common automated attacks in the meantime.",
  },
  "no-email-auth-no-training": {
    technique: t("T1566", "Phishing"),
    explain:
      "Without SPF/DKIM/DMARC enforced, attackers can send email that appears to come from your own domain - to your employees, or to your customers and partners. Without training, the people receiving it are less equipped to catch what technical filtering alone won't.",
    compensatingControl: (a) =>
      a.phishingSim !== 0
        ? "Simulated phishing tests are already happening, which helps build detection reflexes even without formal training - as a fast, low-disruption interim step, move DMARC from monitoring to quarantine (not straight to reject) to start blocking spoofed mail without risking legitimate mail getting dropped."
        : "As a fast, low-disruption interim step, set DMARC to quarantine (not reject yet) - it starts filtering spoofed mail claiming to be from your domain without the risk of legitimate mail bouncing while you're still tuning it.",
  },
  "training-no-phishing-sim": {
    technique: t("T1566", "Phishing"),
    explain:
      "Training is meant to be the human-side defense against this technique, but without testing it, its actual effectiveness is unmeasured - you know training happened, not whether it worked.",
    compensatingControl: () =>
      "Run one low-stakes test manually before investing in a platform - a single internal email from IT with a fake \"reset your password\" link, tracking who clicks. It's a real interim data point on whether the training is landing, at effectively no cost.",
  },
  "ot-flat-network": {
    technique: t("T1021", "Remote Services"),
    explain:
      "On a flat network, an attacker who compromises an ordinary IT account can use normal, everyday remote-access protocols to move straight into OT/ICS systems - no separate OT-specific exploit needed, just the same techniques used for regular lateral movement.",
    compensatingControl: (a) =>
      a.otRemoteAccess === "Yes, via a monitored jump host / secure gateway"
        ? "Remote access into OT is at least going through a monitored gateway, which limits one path in - as an interim step short of a full segmentation project, apply basic VLAN separation to your highest-value OT assets first rather than the whole environment at once."
        : "As an interim step short of a full segmentation project, apply basic VLAN separation to your highest-value OT assets first - a partial segmentation done now is better than a complete one planned for later.",
  },
  "ot-remote-access-unsecured": {
    technique: t("T1133", "External Remote Services"),
    explain:
      "The same technique as the RDP exposure above, but the destination is industrial control systems rather than a normal server - remote access without a dedicated, monitored gateway is a direct path from a compromised remote device into OT.",
    compensatingControl: (a) =>
      a.otSegregation === "Yes, fully segregated"
        ? "OT is properly segregated from corporate IT, which limits how far a compromise through this remote-access path could spread - still, restrict that access to specific source IPs and put it behind MFA on a jump host as an immediate step, ahead of a full dedicated-gateway project."
        : "As an immediate step ahead of standing up a full dedicated gateway, restrict this remote access to specific source IPs and require MFA on a jump host in front of it - it won't match a real secure gateway, but it closes the most obvious version of this exposure quickly.",
  },
  "hardcoded-secrets-no-gates": {
    technique: t("T1552.001", "Unsecured Credentials: Credentials In Files"),
    explain:
      "Credentials sitting in code or plain config files are exactly what this technique targets - and unlike a stolen password, a hardcoded secret is often findable by anyone who ever gets read access to the repository or a build artifact, including long after the original reason for having it is gone.",
    compensatingControl: () =>
      "Rotate any currently-hardcoded secrets now - that's independent of whether a scanning gate exists yet. For new code going forward, move to environment variables or a basic secrets manager immediately, even before a full pipeline gate is built to enforce it.",
  },
  "unscanned-container-images": {
    technique: t("T1190", "Exploit Public-Facing Application"),
    explain:
      "An unscanned image can easily be running software with a known, already-published, already-patched vulnerability without anyone realizing it - and if that container is internet-facing, that's precisely the opening this technique targets.",
    compensatingControl: (a) =>
      a.patching === 2
        ? "Host-level patching is on an automated schedule, which is good discipline - but it doesn't reach inside container images. Run a one-time manual scan against your existing images now (free tools like Trivy exist for exactly this) while automated image scanning gets set up properly."
        : "Run a one-time manual scan against your existing images now (free tools like Trivy exist for exactly this) - it won't replace ongoing automated scanning, but it tells you today whether anything currently running has a known, already-fixed vulnerability.",
  },
};

export const QUESTION_GUIDANCE = {
  mfa: {
    technique: t("T1078", "Valid Accounts"),
    explain: "MFA is the specific control that stops a leaked or guessed password alone from being enough to log in as a legitimate user.",
    compensatingControl: (a) =>
      a.passwordPolicy === 2
        ? "A strong password policy is enforced, which helps somewhat - prioritize MFA on admin and remote-access accounts first, since those are the highest-value targets."
        : "Prioritize MFA on admin and remote-access accounts first - that's the smallest rollout that closes the largest share of risk.",
  },
  patching: {
    technique: t("T1190", "Exploit Public-Facing Application"),
    explain: "Unpatched software is what turns an already-known, already-fixed vulnerability into a working exploit - attackers routinely scan for exactly this rather than looking for something novel.",
    compensatingControl: (a) =>
      a.vulnScanning !== 0
        ? "Vulnerability scanning is happening at least occasionally, which helps surface what's missing - use that output to prioritize patching your internet-facing systems first, ahead of everything else."
        : "Prioritize patching internet-facing systems first, on whatever manual cadence is realistic right now - that's the subset actually reachable by an opportunistic scan.",
  },
  training: {
    technique: t("T1566", "Phishing"),
    explain: "Training is the human-side defense against this technique - recognizing and reporting a malicious link or attachment before it's acted on.",
    compensatingControl: (a) =>
      a.emailAuth === 2
        ? "Email authentication is enforced, which filters some spoofed mail before it arrives - reinforce that with a simple, well-publicized way for employees to report suspicious email as an immediate interim step."
        : "As an immediate step, publish a simple, well-known way for employees to report suspicious email - low-effort, and useful even before formal training exists.",
  },
  phishingSim: {
    technique: t("T1566", "Phishing"),
    explain: "Simulated phishing tests are how you find out whether your actual defenses against this technique - training, filtering, reporting habits - are working, rather than assuming they are.",
    compensatingControl: () =>
      "Run one low-stakes manual test before investing in a platform - a single internal email from IT with a fake link, tracking who clicks. It's a real data point at effectively no cost.",
  },
  rdpExposed: {
    technique: t("T1133", "External Remote Services"),
    explain: "Remote-admin access reachable directly from the internet is a well-documented, heavily automated attack path - it doesn't require phishing or malware, just a scan that finds it.",
    compensatingControl: () =>
      "As an immediate step ahead of moving it behind a VPN/ZTNA, restrict access to a specific IP allowlist and enable account lockout on failed logins.",
  },
  emailAuth: {
    technique: t("T1566", "Phishing"),
    explain: "Without SPF/DKIM/DMARC enforced, attackers can send mail that appears to come from your own domain, to your own employees, customers, or partners.",
    compensatingControl: (a) =>
      a.phishingSim !== 0
        ? "Simulated phishing tests are already running, which helps independent of this gap - as a fast interim step, move DMARC to quarantine (not reject yet) to start filtering spoofed mail without risking legitimate mail bouncing."
        : "As a fast interim step, move DMARC to quarantine (not reject yet) - it filters spoofed mail without the risk of legitimate mail bouncing while it's tuned.",
  },
  privSeparation: {
    technique: t("T1078", "Valid Accounts"),
    explain: "When the same account is used for everyday work and admin tasks, there's no privilege escalation for an attacker to perform - a single compromised login is already an admin login.",
    compensatingControl: () =>
      "As an interim step short of full separation, at minimum create a distinct admin login for the highest-risk systems (domain controllers, core financial or customer data) first, rather than everywhere at once.",
  },
  privAccountMgmt: {
    technique: t("T1078", "Valid Accounts"),
    explain: "Shared or long-standing privileged credentials are a high-value target precisely because they're rarely rotated and often outlive the reason they were created - one compromise can go unnoticed for a long time.",
    compensatingControl: (a) =>
      a.offboarding === 2
        ? "Access is at least revoked promptly when someone leaves, which limits one source of stale privileged credentials - as an interim step, do a one-time manual review of who currently holds privileged access, even without a recurring review process yet."
        : "As an interim step, do a one-time manual review of who currently holds privileged access and revoke anything clearly stale - a single pass now is better than waiting for a full recurring review process.",
  },
  passwordPolicy: {
    technique: t("T1110", "Brute Force"),
    explain: "Weak or default password requirements make automated password-guessing and credential-stuffing attacks meaningfully more likely to succeed.",
    compensatingControl: (a) =>
      a.mfa !== 0
        ? "MFA is at least partially enforced, which limits what a guessed password alone can do - as an interim step, set a minimum length requirement (length matters more than complexity rules) even before a full policy is formalized."
        : "As an interim step, set a minimum length requirement organization-wide (length matters more than complexity rules) - it's a five-minute setting change, not a program.",
  },
  passwordManager: {
    technique: t("T1110", "Brute Force"),
    explain: "Without a password manager, password reuse across services is common - and reuse is exactly what makes credential-stuffing attacks (using passwords leaked from an unrelated breach) work.",
    compensatingControl: (a) =>
      a.mfa === 2
        ? "MFA is enforced everywhere, which meaningfully limits the damage from a reused/stuffed password - in the meantime, publish a simple written password policy (unique passwords, minimum length) as the documented interim standard until a password manager is deployed."
        : "In the meantime, publish a simple written password policy (unique passwords per service, minimum length) as the documented interim standard, and prioritize deploying at least partial MFA alongside it - together they cover most of what a password manager alone would.",
  },
  offboarding: {
    technique: t("T1078", "Valid Accounts"),
    explain: "An account left active after someone leaves is a fully legitimate-looking login that nobody is watching - one of the most common, least sophisticated ways attackers (including former employees) get in.",
    compensatingControl: (a) =>
      a.siem !== 0
        ? "Centralized logging is in place - use it to set an alert specifically for logins from accounts belonging to recently departed staff as an interim measure until offboarding is fully automated."
        : "As an interim step, add \"revoke all access\" as the literal first line item on whatever offboarding checklist (formal or not) currently exists, and assign it to a specific person by name.",
  },
  exfil: {
    technique: t("T1041", "Exfiltration Over C2 Channel"),
    explain: "Without monitoring for unusual outbound traffic, this is how a breach goes from \"contained\" to \"data actually left the building\" without anyone noticing at the time.",
    compensatingControl: (a) =>
      a.siem !== 0
        ? "Centralized logging exists - as an interim step, add a basic alert for large or unusual outbound data transfers using what's already being collected, rather than waiting on a dedicated exfiltration-monitoring tool."
        : "As an interim step, check whether your firewall, hosting provider, or cloud platform already logs outbound traffic volume by default - many do, and enabling an alert on unusually large transfers is often a configuration change, not a new purchase.",
  },
  backupTest: {
    technique: t("T1486", "Data Encrypted for Impact"),
    explain: "This is the ransomware technique - and an untested backup is a backup whose recoverability is simply unknown until the day it matters most.",
    compensatingControl: (a) =>
      a.backupIsolation === 2
        ? "Backups are at least isolated from the production network, which is the part that matters most against ransomware specifically - test-restore a single file or system now for a first real data point."
        : "As an immediate step, manually test-restore a single file or one low-priority system this week - a small real test now beats a large untested backup indefinitely.",
  },
  backupIsolation: {
    technique: t("T1490", "Inhibit System Recovery"),
    explain: "Ransomware operators specifically target connected backup systems and shadow copies to prevent recovery, not just the primary systems - a backup reachable from the production network can be encrypted or deleted right alongside everything else.",
    compensatingControl: (a) =>
      a.backupTest === 2
        ? "Backups are tested regularly, which confirms they work - the remaining risk is that they're reachable from production. As an interim step, move at least the most recent backup set to an offline or immutable copy even before the whole backup system is re-architected."
        : "As an interim step, prioritize moving just the most recent backup set to an offline or immutable copy - the full re-architecture can follow, but one truly isolated recent copy is what actually matters in a live ransomware scenario.",
  },
  vendorCount: {
    technique: t("T1195", "Supply Chain Compromise"),
    explain: "Unreviewed third-party access is a way for risk to enter through a trusted vendor rather than a direct attack on you.",
    compensatingControl: (a) =>
      a.assetInv !== 0
        ? "Use your existing asset inventory to identify which vendors touch your most sensitive systems or data, and review just that short list manually as an interim step."
        : "Start with a short list - which vendors have access to your most sensitive systems or data, not all of them - and review just those manually as a realistic interim step.",
  },
};

export function guidanceForFlag(flag, answers) {
  const g = FLAG_GUIDANCE[flag.id];
  if (!g) return null;
  return {
    technique: g.technique,
    explain: g.explain,
    control: g.compensatingControl(answers),
  };
}

export function guidanceForGapItem(item, answers) {
  const g = QUESTION_GUIDANCE[item.id];
  if (!g) return null;
  return {
    technique: g.technique,
    explain: g.explain,
    control: g.compensatingControl(answers),
  };
}
