// Runbooks page (/runbooks). RUNBOOKS is also indexed by the site search.
import { wireAccordions } from "../ui/a11y.js";
import { pathForTab, wireNavLink } from "../router.js";
import { icon, buildLifecycleSvg, accentIconStyle } from "./shared.js";

// --- Foundational documents (referenced from the Runbooks tab) ---
const FOUNDATIONAL_DOCS = [
  { id:'irplan', icon:'shield', title:'Incident Response Plan',
    points:[
      'Roles and a clear chain of command (who declares an incident, who leads response, who has final say to shut something down)',
      'Severity classification - not every incident needs the same response tier',
      'Communication plan: internal escalation, legal/regulatory notification obligations, and what (if anything) goes to customers or the public',
      'Evidence preservation steps, so forensic investigation isn\'t compromised by an eager cleanup',
      'A named post-incident review process - the plan should explicitly require updating itself after every real incident',
    ]},
  { id:'backupdr', icon:'backup', title:'Backup & Disaster Recovery Plan',
    points:[
      'Follow the 3-2-1 rule as a baseline: 3 copies of data, on 2 different media types, with 1 copy offline or immutable',
      'Define RTO (how fast you must be back up) and RPO (how much data loss is tolerable) per system - not every system needs the same targets',
      'Isolate backups from the production network so a ransomware event can\'t encrypt the recovery path along with everything else',
      'Test restores on a real schedule - a backup that has never been restored is a hypothesis, not a plan',
      'Document a failover/DR site or cloud region if uptime requirements demand it, and test that failover too',
    ]},
  { id:'policy', icon:'document', title:'Cybersecurity Policy Document',
    points:[
      'Scope: which systems, data, and people the policy governs',
      'Acceptable use, access control, and data classification rules stated plainly enough that non-security staff can follow them',
      'Named roles and responsibilities (ties directly to Phase 3 of the Maturity Model - governance has to exist before policy means anything)',
      'A mandatory review cadence - annually at minimum, and after any material change to infrastructure or the threat landscape',
    ]},
  { id:'riskreg', icon:'register', title:'Risk Register',
    points:[
      'One row per identified risk: description, likelihood, impact, and a calculated or assigned risk rating',
      'A named owner per risk - an unowned risk is a risk nobody is actually managing',
      'Treatment plan and status: accept, mitigate, transfer (insurance), or avoid - and what\'s actually being done about it',
      'A review date per entry, not just a review date for the whole register - old risks silently going stale is the most common failure mode',
    ]},
  { id:'bcp', icon:'cycle', title:'Business Continuity Plan',
    points:[
      'Distinct from the Backup/DR plan: this covers how the *business* keeps operating, not just how IT recovers systems',
      'Identify critical business functions and their maximum tolerable downtime - not every process is equally urgent',
      'Named alternate processes (manual workarounds, alternate suppliers, alternate premises) for when primary systems are unavailable',
      'A communication tree for staff, customers, and suppliers that doesn\'t depend on the systems that might be down',
      'Tested via exercises, not just written - a plan that has only ever been read is unproven',
    ]},
  { id:'iam', icon:'key', title:'Access Control / IAM Policy',
    points:[
      'Least-privilege as the default: access granted for a specific need, not by default "in case it\'s useful"',
      'A defined joiner/mover/leaver process - access granted on day one and revoked the moment someone leaves or changes role',
      'Privileged/admin access kept separate from everyday accounts, with additional approval and logging requirements',
      'Periodic access reviews - confirming people still need what they were granted, not just granting once and forgetting',
    ]},
  { id:'vendor', icon:'link', title:'Third-Party / Vendor Risk Policy',
    points:[
      'A required security review before any vendor gets access to systems or data - not after the contract is signed',
      'Minimum security requirements scaled to what the vendor can actually touch (a payroll processor needs more scrutiny than a stock-photo subscription)',
      'A record of what each vendor can access, so a vendor breach (like the Salesloft/Drift incident referenced in the News tab) can be scoped quickly',
      'A defined offboarding step for vendors too - revoking access when a contract ends, not just for employees',
    ]},
  { id:'training', icon:'people', title:'Security Awareness Training Program',
    points:[
      'Recurring, not one-time - a single onboarding session is well-documented to fade within months',
      'Scenario-based content (real phishing simulations, not just slideshows) tends to change behavior more than lecture-style training',
      'Role-specific modules - finance staff need BEC/wire-fraud training that a warehouse employee doesn\'t, and vice versa',
      'Tracked completion and a non-punitive reporting culture - see the Phishing runbook for why blame reduces future self-reporting',
    ]},
];

// --- Incident runbooks ---
export const RUNBOOKS = [
  { id:'ransomware', icon:'ransomware', title:'Ransomware', sub:'Encryption event / extortion attempt',
    steps:[
      'Isolate affected systems immediately: disable the NIC (Disable-NetAdapter in PowerShell, or "Disable" in Network Connections) or pull the network cable rather than powering off, to preserve memory-resident evidence. If EDR is deployed (CrowdStrike, Defender for Endpoint, SentinelOne), use its console isolation action instead of touching the machine directly - it\'s logged and reversible',
      'Take file servers, NAS/SAN volumes, and mapped network drives offline immediately even if not yet visibly affected - ransomware actively hunts for and encrypts every reachable network share, so isolating shared storage buys time before individual endpoints are triaged',
      'Activate the incident response team and open an incident bridge; determine true scope by querying your EDR console for other endpoints showing the same process tree or mass file-rename/encryption behavior, rather than assuming it\'s limited to what was visibly reported',
      'Preserve evidence before any cleanup: capture memory on at least one representative infected host if tooling exists (EDR live-response, or a tool like Magnet RAM Capture), and export EDR/SIEM logs covering the prior 30 days - dwell time before the encryption trigger is commonly days to weeks',
      'Identify the ransomware family from the ransom note and check it against a known-decryptor list at nomoreransom.org (the Europol-backed No More Ransom project) before assuming payment or full rebuild is the only path - free decryptors exist for dozens of older families',
      'Notify legal counsel, cyber insurance, and any regulators your jurisdiction/sector requires - breach-notification clocks (e.g. GDPR\'s 72-hour window) start from discovery, so this runs in parallel with containment, not after it',
      'Verify backup integrity before relying on it: check backup job logs for gaps around the incident window, and check for shadow-copy deletion (`vssadmin list shadows`) - `vssadmin delete shadows /all` run by the attacker is a documented, common step specifically meant to block easy recovery',
      'Restore from the most recent clean, verified-isolated backup into a sandboxed/isolated network segment first, scan it, and only then reconnect to production - restoring into a still-compromised network just re-triggers the same event',
      'Reset credentials for every account with plausible exposure, not just visibly-affected ones - domain admin, service accounts, and local admin passwords (via LAPS if deployed) - before reconnecting restored systems, since credential theft typically precedes the encryption trigger by days',
      'Run a post-incident review and feed findings back into Phase 10 of the Maturity Model - the same gap that let this in will let the next one in too',
    ]},
  { id:'phishing', icon:'phishing', title:'Phishing / BEC', sub:'Credential compromise or business email compromise',
    steps:[
      'Have a one-click reporting mechanism for users - the built-in "Report Message" add-in in Outlook/Microsoft 365, or Google Workspace\'s built-in phishing report action - the first report is often the only warning before it spreads',
      'Quarantine the message organization-wide: in Microsoft 365, search by sender/subject in Threat Explorer (Defender portal) and run "Purge" across all mailboxes; in Google Workspace, use the Investigation Tool to search and bulk-delete. Block the sending domain and any malicious URLs/attachment hashes via the Tenant Allow/Block List (Microsoft) or equivalent gateway rule',
      'For any account that clicked through or entered credentials: force an immediate password reset AND separately revoke active sessions/refresh tokens - a password reset alone does not invalidate an already-issued session. In Entra ID this is "Revoke sessions" on the user\'s page (or Revoke-MgUserSignInSession via the Microsoft Graph PowerShell SDK); in Google Workspace, "Sign out of all sessions" in the Admin console',
      'Check for persistence set up while the attacker had access: review inbox rules for auto-forward or delete-on-arrival rules (Get-InboxRule in Exchange Online PowerShell), check for newly-granted OAuth app consents on the account (Enterprise Applications in Entra ID, or third-party access in Google Workspace), and check tenant-level mail-flow rules for anything unfamiliar',
      'If this looks like BEC (a request to change payment details, redirect a wire, or an urgent executive ask): before any funds move, verbally confirm the request via a phone number you already had on file - never one supplied in the suspect email - and alert finance/AP immediately so any pending transfer can be held',
      'Search for other recipients of the same or a similar message using Threat Explorer / Google Vault, rather than relying solely on self-reporting to find everyone who received it',
      'Follow up with the affected user and team without blame - punitive responses reliably reduce future self-reporting, and the goal is faster reporting next time, not less reporting out of fear',
    ]},
  { id:'ddos', icon:'ddos', title:'DDoS', sub:'Availability / denial-of-service attack',
    steps:[
      'Confirm it\'s actually an attack, not a legitimate spike or misconfiguration: check for genuine traffic-volume anomalies correlated with unusual source-IP diversity/geography or protocol anomalies in your CDN/WAF dashboard (Cloudflare Analytics, AWS Shield/CloudFront metrics) rather than reacting to a single alert threshold breach - a real product launch or press mention can look identical to a volumetric attack at a glance',
      'Identify the attack layer, since response differs completely: volumetric (L3/4 - UDP/ICMP flood or reflection/amplification) needs upstream scrubbing; application-layer (L7 - an HTTP flood against a specific endpoint) needs WAF/rate-limiting closer to the app. Check your provider\'s traffic breakdown by protocol, port, and request pattern to tell which you\'re facing',
      'Engage your upstream provider, CDN, or dedicated scrubbing service immediately (Cloudflare, AWS Shield Advanced, Akamai, or your ISP\'s DDoS mitigation service if contracted) - most effective volumetric mitigation happens outside your own network edge, since your own bandwidth is what\'s being exhausted',
      'If a CDN/Anycast layer already sits in front of production, verify it\'s actually switched into an aggressive "under attack" or challenge mode (e.g. Cloudflare\'s "I\'m Under Attack" mode) rather than left on default settings, which are tuned for normal traffic, not an active flood',
      'Apply traffic filtering and rate-limiting rules specific to the observed pattern - block by source ASN/geography if the attack is concentrated, rate-limit the specific endpoint under an L7 flood - rather than a broad block that also drops legitimate users',
      'If the attack is DNS-based or a reflection/amplification attack abusing your own exposed services (open DNS resolvers, NTP, memcached), check for and lock down any misconfigured services of your own that could be contributing to amplification, separate from defending against the inbound flood itself',
      'Keep stakeholders and customers informed during the outage via a status page (StatusPage, Instatus, or equivalent) with a realistic, regularly-updated cadence - silence during an outage erodes trust faster than the outage itself',
      'After the fact, review whether current bandwidth capacity, scrubbing contracts, and rate-limit thresholds were actually sized for the attack you just saw, and adjust based on what worked or didn\'t in the real event',
    ]},
  { id:'lateral', icon:'lateral', title:'Lateral Movement', sub:'Active intrusion spreading internally',
    steps:[
      'Use EDR to isolate the specific affected endpoints individually (the network-isolation action in CrowdStrike/Defender for Endpoint/SentinelOne) rather than shutting down broad network segments where avoidable, to contain spread while preserving business continuity elsewhere',
      'Where individual-endpoint isolation isn\'t available or the intrusion has already crossed multiple segments, isolate the affected VLAN/subnet at the switch or firewall level as a broader containment step while investigation continues',
      'Hunt for the specific technique in use before assuming it\'s stopped: check for anomalous use of legitimate admin tools (PsExec, WMI, PowerShell remoting/WinRM, RDP) between hosts that don\'t normally talk to each other - this "living off the land" pattern is how most real intrusions actually spread, not custom malware',
      'Rotate credentials for every account observed or plausibly used by the intruder - assume more were touched than confirmed, and check EDR telemetry for LSASS memory-access indicators (a Mimikatz-style credential-dumping signature), since an attacker who reached lateral-movement stage has likely harvested credentials beyond the first compromised account',
      'Threat-hunt for persistence across every host the intruder plausibly touched, not just the originally-identified one: new scheduled tasks (Get-ScheduledTask), new local/domain admin accounts, unfamiliar services (Get-Service), and new or modified Group Policy Objects - the initial entry point is rarely the only foothold left behind',
      'Check Active Directory specifically for privilege-escalation and persistence indicators: new members added to Domain Admins/Enterprise Admins, Kerberoasting-pattern ticket requests, or Golden/Silver Ticket indicators if you have the logging to detect them - lateral movement frequently aims at AD compromise as the actual objective',
      'Maintain chain of custody on any forensic evidence gathered (exported logs, memory captures, disk images) with documented collection time, method, and handler, in case of later legal, insurance, or regulatory review',
      'Once contained, rebuild affected hosts from known-clean images rather than just removing identified malware - a host that hosted an active intruder shouldn\'t be trusted back into production based on cleanup alone',
    ]},
  { id:'cloudcompromise', icon:'cloud', title:'Cloud Account Compromise', sub:'Compromised AWS/Azure/GCP credentials or console access',
    steps:[
      'Revoke or rotate the compromised credentials/API keys immediately - for AWS, deactivate the IAM access key first (`aws iam update-access-key --status Inactive`) rather than deleting it outright, so it remains available for forensic review; use the equivalent key-disable action in Azure/GCP',
      'Invalidate active sessions and tokens separately from rotating the credential - a rotated password or disabled key doesn\'t retroactively kill an already-issued session token or STS credential still within its validity window',
      'Check for new IAM users, roles, access keys, or federated identity providers the attacker may have created to maintain access after the original credential is fixed - this is the most common way cloud intrusions survive an initial "fix," and it\'s worth checking even before full scope is confirmed',
      'Review CloudTrail (AWS) / Activity Log (Azure) / Audit Logs (GCP) specifically for CreateUser, CreateAccessKey, AttachUserPolicy, and PutRolePolicy events (or provider equivalents) during the suspected compromise window - these are the specific actions an attacker uses to establish persistent access',
      'Review billing and resource-creation logs for unauthorized compute spun up for cryptomining or further attack infrastructure - a sudden spike in a region you don\'t normally use, or an unusually large instance type, is the classic signature of this monetization move',
      'Check for modified security groups, NACLs, storage bucket policies (S3/Blob/GCS), or public-exposure changes made during the intrusion window - an attacker will often open a bucket or security-group rule to exfiltrate data or maintain reach even after the original credential path is closed',
      'Preserve cloud provider audit logs before any retention window expires - export CloudTrail/Activity Log/Audit Logs to storage outside the affected account if there\'s any chance the attacker had permissions broad enough to disable or delete logging',
      'Once contained, review the IAM policy that was actually exploited - was the compromised credential over-privileged relative to its function? - and tighten it; the fix isn\'t complete if the same identity goes back into production with the same excess permissions it had before',
    ]},
  { id:'insider', icon:'exfil', title:'Insider Threat / Data Exfiltration', sub:'Suspected internal actor or unusual data movement',
    steps:[
      'Involve HR and legal before taking any action against a specific person, not just IT - this category carries employment-law and privacy exposure others don\'t, and premature unilateral IT action (disabling an account, searching a device) without sign-off can itself create liability or taint the investigation',
      'Preserve access logs, file-activity logs, and DLP alerts immediately, before anything ages out of retention - pull authentication logs, file-server/SharePoint access logs, and any DLP alert history covering as far back as is available, not just the triggering event',
      'Restrict access proportionate to the actual evidence rather than making a visible change to the person\'s access or alerting them directly - a sudden access change tips off a genuinely malicious insider to destroy evidence or accelerate exfiltration before scope is understood',
      'Where legally and technically feasible, place a covert monitoring hold on the account (enhanced logging, mail/file-activity alerting) rather than an overt lockout, until HR/legal confirm the investigation approach - coordinate this specifically with legal, since monitoring an employee carries its own compliance requirements depending on jurisdiction',
      'Review exactly what data was accessed or moved, and to where: unusual volume downloads, access outside the person\'s normal role/project scope, removable-media activity if endpoint logging captures it, and uploads to personal cloud storage or personal email - to scope actual exposure rather than assuming worst case',
      'Cross-reference the timeline against known triggers - a resignation, a performance issue, or an upcoming termination are the most common precursors to a real insider incident, and knowing the timeline shapes both urgency and the legal approach',
      'Once evidence supports action, coordinate access revocation and any device/account preservation with HR and legal as a single planned action, typically timed with any employment action, rather than staggered steps that could tip off the individual',
      'Close the loop afterward - most insider incidents trace back to an offboarding gap, an access-review gap, or overly broad access the Risk Register should already have flagged; feed the specific gap back into that process, not just this one case',
    ]},
  { id:'supplychain', icon:'link', title:'Supply Chain / Third-Party Compromise', sub:'A vendor or integration you depend on gets breached',
    steps:[
      'Identify exactly what that vendor/integration could access - this is only fast if a current access record exists (the Vendor Risk Policy\'s inventory on this site\'s Runbooks tab is built for exactly this); if it doesn\'t exist yet, pull every API key, OAuth grant, and account associated with the vendor\'s name directly from your identity provider and integration settings',
      'Revoke or rotate any credentials, API keys, or OAuth tokens shared with the affected vendor immediately - don\'t wait for the vendor\'s own all-clear or root-cause confirmation, since their compromise-timeline assessment is often incomplete or delayed relative to yours',
      'For OAuth/SaaS-to-SaaS integrations specifically, revoke the app\'s consent/grant at the identity-provider level (Enterprise Applications in Entra ID, connected apps in the Google Workspace admin console, or the equivalent app-authorization list) - disabling the vendor\'s own login doesn\'t necessarily kill a previously-granted OAuth token',
      'Check your own logs for activity from the vendor\'s integration during the suspected compromise window - API access logs, webhook activity, or logins attributable to the integration - rather than relying solely on the vendor\'s stated scope of impact',
      'If the vendor had write access to your systems (not just read), specifically review what was created, modified, or deleted during the window - a compromised vendor integration with write access is a path for an attacker to plant persistence directly in your environment, not just read your data',
      'Notify your own downstream customers if their data could plausibly have been exposed through the chain - the obligation doesn\'t stop at your vendor, and NotPetya-style incidents (see Case Studies) show how far a single compromised update can propagate',
      'Coordinate with legal on notification timing and content - a third-party-caused incident can still trigger your own regulatory notification duties depending on what data was involved and your jurisdiction',
      'Reassess whether that vendor\'s access level was appropriate in the first place, and tighten it regardless of fault - this is the step most organizations skip once the immediate incident is closed, and it\'s exactly what lets the same exposure recur with the next vendor',
    ]},
  { id:'zeroday', icon:'urgent', title:'Zero-Day / Actively Exploited Vulnerability', sub:'A critical flaw in something you run is being exploited in the wild',
    steps:[
      'Check CISA\'s Known Exploited Vulnerabilities (KEV) catalog and the vendor\'s own security advisory immediately to confirm exploitation status, affected versions, and known indicators of compromise - KEV entries specifically flag confirmed real-world exploitation, not just theoretical severity',
      'Inventory every instance of the affected product across the environment before patching anything - including instances you don\'t normally think of as "that product" (embedded components, a vendor appliance running the same library, dev/test/staging copies) - partial patching, as seen in real incidents like the SharePoint on-prem RCE chain, leaves real exposure even after the "main" instance is fixed',
      'Apply the vendor patch as the primary fix as soon as it\'s validated in a non-production environment; if no patch exists yet, apply the vendor\'s documented interim mitigation (disabling a specific feature, restricting network access to the affected service/port) immediately rather than waiting for a patch timeline',
      'If the vulnerability is remotely exploitable and no patch or mitigation is immediately deployable, apply temporary compensating controls: a WAF virtual-patching rule if a signature exists for the specific CVE, or restricting network reachability to the affected service via firewall rule until a real fix is in place',
      'Hunt for indicators of prior compromise before assuming patching alone resolves it - actively-exploited flaws are frequently used against a target before a patch exists or before the organization is even aware of the CVE, so check logs covering the period before public disclosure, not just after',
      'Check the affected systems specifically for webshells, unexpected scheduled tasks, or new admin accounts if the vulnerability class is remote code execution - these are the persistence mechanisms attackers typically plant immediately after successful exploitation, and a clean patch doesn\'t remove them retroactively',
      'Validate the patch actually closed the gap - re-scan the specific instance with a vulnerability scanner or the vendor\'s own detection guidance, since some patches require an additional configuration step beyond just installing the update to be fully effective',
      'Track time-to-patch as a real metric from disclosure/KEV-listing to remediation - this is exactly what Phase 9 (Auditing & Validation) of the Maturity Model should be measuring over time, and the Equifax case (see Case Studies) is the clearest illustration of why this metric matters more than most',
    ]},
];

export function renderRunbookTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Documentation & Runbooks</div>
        <h2 class="page-title">Runbooks your team can actually use</h2>
        <p class="page-lede">Guidance on the documents every program needs, and step-by-step runbooks for the incidents most likely to happen - ransomware, phishing, DDoS, and lateral movement.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Keeping documents alive, not just written</h3>
        <div class="lifecycle-row">
          <div class="lifecycle-text">
            <p class="body-text">A policy that's never reviewed is a policy that's already wrong. Every foundational document below should move through the same cycle continuously:</p>
            <p class="body-text">A document that was accurate the day it was written starts drifting the moment anything around it changes. An incident response plan naming a specific person as the point of contact is already wrong the day that person leaves the company; a backup runbook referencing a tool the organization decommissioned two years ago sends whoever's following it during an actual incident down a dead end - exactly when there's no time left to improvise.</p>
            <p class="body-text"><b>Periodic review means a real cadence on a real calendar, with a real owner.</b> Most organizations review foundational documents at least annually, and more often - quarterly, or after any significant infrastructure or staffing change - for anything genuinely operational, like an incident response plan or a backup/DR runbook. Ownership matters as much as cadence: a document with no named owner tends to drift indefinitely until an actual incident exposes how stale it's gotten. Assign a specific role, not just "the team," responsible for confirming it's still accurate on schedule, whether or not anything obviously changed in the meantime.</p>
          </div>
          <div class="lifecycle-wrap lifecycle-wrap--tall">${buildLifecycleSvg()}</div>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Foundational Documents</h3>
        <div id="docAccordions"></div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Incident Runbooks</h3>
        <p class="body-text">Each of these is meant to be printable and usable mid-incident - short, ordered, and specific enough that whoever's on call at 2am isn't improvising.</p>
        <div id="runbookAccordions"></div>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaDocsAssess">See where you stand first →</a>
        </div>
      </div>
    </div>
  `;

  const docContainer = document.getElementById('docAccordions');
  docContainer.innerHTML = FOUNDATIONAL_DOCS.map((d,i)=>`
    <div class="acc-card" data-id="${d.id}">
      <div class="acc-head">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon(d.icon)}</div>
        <div><h4>${d.title}</h4></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body"><ul>${d.points.map(pt=>`<li>${pt}</li>`).join('')}</ul></div>
    </div>
  `).join('');

  const runbookContainer = document.getElementById('runbookAccordions');
  runbookContainer.innerHTML = RUNBOOKS.map((r,i)=>`
    <div class="acc-card" data-id="${r.id}">
      <div class="acc-head">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon(r.icon)}</div>
        <div><h4>${r.title}</h4><div class="acc-sub">${r.sub}</div></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body"><ol>${r.steps.map(s=>`<li>${s}</li>`).join('')}</ol></div>
    </div>
  `).join('');

  wireAccordions(docContainer);
  wireAccordions(runbookContainer);
  wireNavLink(document.getElementById('ctaDocsAssess'), 'assessment');
}
