// Security Tools Repository page (/security-tools-repository).
import { wireAccordions } from "../ui/a11y.js";
import { icon, accentIconStyle } from "./shared.js";

// CLAUDE-CODE-INTEGRATION.md / security-tools-hub.md: a categorised,
// practical reference of security tooling across identity, endpoints,
// cloud, M365, containers, pipelines and code - content is finished/
// given verbatim in the brief, this only builds the page and wires it
// into the site. Reuses existing patterns rather than inventing new
// ones: the Starter Guide's accordion-per-topic layout (one .acc-card
// per numbered category, all collapsed by default, TOC-click opens the
// target accordion), and the Maturity Model's .table-wrap/.data-table
// for each category's tool table. Licence/Phase tags reuse .stage-chip
// (already used for Maturity's stage badges) with distinct colors per
// tag rather than introducing new badge CSS.
function stLicenceChip(tag, note){
  const color = { FOSS:'--accent-signal', Free:'--accent-secure', Commercial:'--accent-amber' }[tag] || '--accent-secure';
  return `<span class="stage-chip" style="--stage-color:var(${color});--stage-ink:var(${color}-ink)">${tag}</span>${note ? ` ${note}` : ''}`;
}
function stPhaseChip(tags){
  const color = { Assess:'--accent-violet', Harden:'--accent-signal', Monitor:'--accent-secure', Test:'--accent-critical' };
  return tags.split(' / ').map(t=>{ const c = color[t.trim()] || '--accent-secure'; return `<span class="stage-chip" style="--stage-color:var(${c});--stage-ink:var(${c}-ink)">${t.trim()}</span>`; }).join(' ');
}
function stTable(rows){
  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Tool</th><th>Type</th><th>Licence</th><th>Phase</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr><td class="dt-title">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const SECURITY_TOOLS_SECTIONS = [
  { id:'st-ad', title:'Active Directory & On-Prem Identity', body:`
    <p class="body-text">Active Directory (AD) is still the control plane for most enterprises - compromise it and an attacker owns the estate. These tools find weak configurations, dangerous permissions and attack paths before an adversary does.</p>
    ${stTable([
      ['PingCastle', 'AD posture / risk scoring', stLicenceChip('Free', '(Non-Profit OSL 3.0)'), stPhaseChip('Assess')],
      ['Purple Knight', 'AD & Entra ID indicator scan', stLicenceChip('Free'), stPhaseChip('Assess')],
      ['BloodHound CE', 'Attack-path mapping', stLicenceChip('FOSS'), stPhaseChip('Assess / Test')],
      ['ADRecon', 'AD data collection & reporting', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Locksmith', 'AD Certificate Services (ADCS) misconfig', stLicenceChip('FOSS'), stPhaseChip('Assess / Harden')],
      ['Group3r', 'GPO security analysis', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['ADeleg', 'Delegation review', stLicenceChip('FOSS'), stPhaseChip('Assess')],
    ])}
    <h4>PingCastle</h4>
    <p class="body-text">Now maintained by Netwrix under the Non-Profit Open Software License 3.0. It runs unprivileged LDAP/WMI queries and produces a risk score across stale objects, privileged accounts, trusts and anomalies, mapped to MITRE and ANSSI controls.</p>
    <p class="body-text"><b>When:</b> You need a fast, defensible baseline of AD security health (a first-day assessment, or a recurring quarterly check).</p>
    <p class="body-text"><b>Why:</b> Gives an executive-friendly score plus prioritised, actionable findings without needing domain admin.</p>
    <p class="body-text"><b>How:</b> Download the binary, run <code>PingCastle.exe --healthcheck</code> from a domain-joined machine with a standard user account; review the HTML report. Internal use is free even in for-profit companies; you may <b>not</b> resell it as a paid service (that needs a commercial licence).</p>
    <h4>Purple Knight (Semperis)</h4>
    <p class="body-text">Free point-in-time assessment for AD and Entra ID that scores indicators of exposure and compromise (IOEs/IOCs).</p>
    <p class="body-text"><b>When:</b> You want a second, identity-focused lens alongside PingCastle, especially for hybrid AD + Entra.</p>
    <p class="body-text"><b>Why:</b> Strong at surfacing security indicators (e.g. risky Kerberos, delegation, AD CS) with remediation guidance.</p>
    <p class="body-text"><b>How:</b> Download, run from a domain-connected host, export the report. Pairs well with PingCastle - overlap is healthy, gaps differ.</p>
    <h4>BloodHound Community Edition (SpecterOps)</h4>
    <p class="body-text">The modern, containerised rewrite (v8.x) with a web UI, Postgres + Neo4j back end, and <b>OpenGraph</b> so it now maps attack paths beyond AD/Azure into other identity platforms. Data is collected by <b>SharpHound</b> (AD) and <b>AzureHound</b> (Entra).</p>
    <p class="body-text"><b>When:</b> You need to see privilege-escalation and lateral-movement paths to Domain/Enterprise Admin - for both red-team planning and blue-team remediation.</p>
    <p class="body-text"><b>Why:</b> Graph theory turns thousands of ACLs and group memberships into concrete "shortest path to Domain Admin" answers you can actually cut.</p>
    <p class="body-text"><b>How:</b> <code>curl -L https://ghst.ly/getbhce | docker compose ...</code> (official one-liner) to stand up the containers, run SharpHound/AzureHound to collect, upload the JSON/zip, then explore pre-built queries. (Legacy BloodHound v4 is deprecated - use CE.)</p>
    <h4>ADRecon</h4>
    <p class="body-text">PowerShell/.NET collector that dumps AD into a formatted Excel/CSV report (users, groups, GPOs, trusts, ACLs, Kerberos policies).</p>
    <p class="body-text"><b>When:</b> You want a comprehensive inventory and offline artefact for an audit. <b>Why:</b> One command, broad coverage, easy to hand to auditors.</p>
    <h4>Locksmith</h4>
    <p class="body-text">Focused scanner for the eight common AD Certificate Services escalation paths (ESC1-ESC8).</p>
    <p class="body-text"><b>When:</b> ADCS is deployed (it usually is) and you need to know if it's an escalation shortcut. <b>Why:</b> AD CS misconfigurations are a top real-world escalation route; Locksmith both finds and can help remediate them.</p>
    <h4>Group3r / ADeleg</h4>
    <p class="body-text">Group3r audits GPOs for security-relevant settings and findings; ADeleg reviews AD delegation and permissions for over-privilege. Use them to close the gaps the scanners above flag.</p>
  `},
  { id:'st-entra', title:'Entra ID, Microsoft 365 & Azure Configuration', body:`
    <p class="body-text">Identity moved to the cloud; so did the attack surface. These tools assess Microsoft 365 / Entra ID / Azure against recognised baselines and turn configuration into something you can test like code.</p>
    ${stTable([
      ['CISA ScubaGear', 'M365 baseline assessment', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['CISA ScubaGoggles', 'Google Workspace baseline', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Maester', 'M365 security-as-code test framework', stLicenceChip('FOSS'), stPhaseChip('Assess / Monitor')],
      ['ORCA', 'Exchange Online / Defender for O365 config', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['365Inspect (Soteria)', 'M365 security assessment', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Monkey365', 'M365 & Azure CIS/CISA assessment', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['PSRule for Azure', 'Azure resource best-practice tests', stLicenceChip('FOSS'), stPhaseChip('Assess / Harden')],
      ['AzureHound', 'Entra attack-path collection (feeds BloodHound)', stLicenceChip('FOSS'), stPhaseChip('Assess / Test')],
      ['Microsoft Secure Score', 'Built-in posture scoring', stLicenceChip('Free'), stPhaseChip('Assess / Monitor')],
      ['Microsoft Purview Compliance Manager', 'Regulatory/compliance assessment scoring', stLicenceChip('Free', '(deeper templates need a Purview licence)'), stPhaseChip('Assess / Monitor')],
      ['Configuration Analyzer for Threat Policies', 'Exchange Online / Defender for O365 policy vs. Standard/Strict presets', stLicenceChip('Free'), stPhaseChip('Assess / Harden')],
    ])}
    <h4>CISA ScubaGear</h4>
    <p class="body-text">CISA's PowerShell tool that checks an M365 tenant against the <b>SCuBA</b> Secure Configuration Baselines. It queries M365 APIs, evaluates them with Open Policy Agent (Rego) and reports in HTML/JSON/CSV. Controls are mapped to NIST SP 800-53 and MITRE ATT&amp;CK, and it now ships a GUI for building the YAML config. (Companion tools: <b>ScubaGoggles</b> for Google Workspace, <b>ScubaConnect</b> for automated, multi-tenant runs.)</p>
    <p class="body-text"><b>When:</b> You need an authoritative, government-grade M365 hardening assessment (Entra ID, Exchange, SharePoint, Teams, Defender, Power Platform).</p>
    <p class="body-text"><b>Why:</b> It's the reference implementation of the SCuBA baselines - great for regulated environments and for a defensible "are we configured securely?" answer.</p>
    <p class="body-text"><b>How:</b> <code>Install-Module ScubaGear</code>, then <code>Invoke-SCuBA -ProductNames *</code>. Some checks assume Entra ID P2 / Defender for Office 365 licences.</p>
    <h4>Maester</h4>
    <p class="body-text">Open-source, Pester-based <b>security-as-code</b> framework for Microsoft 365. It wires together EIDSCA, CISA SCuBA, CIS Microsoft 365 and ORCA checks into one test suite, can simulate Conditional Access changes with Graph "what-if", and runs in CI for continuous monitoring.</p>
    <p class="body-text"><b>When:</b> You want configuration drift treated as a failing test, not a once-a-year surprise - daily posture reports, CA policy safety nets, privileged-role assertions.</p>
    <p class="body-text"><b>Why:</b> Turns static baselines into executable, version-controlled tests; excellent for DevSecOps-minded teams and MSPs (multi-tenant).</p>
    <p class="body-text"><b>How:</b> <code>Install-Module Maester</code>, scaffold a tests repo, connect to Graph/Exchange, run <code>Invoke-Maester</code>; schedule it in a pipeline for continuous checks.</p>
    <h4>ORCA (Office 365 Recommended Configuration Analyzer)</h4>
    <p class="body-text">PowerShell module (by Cam Murray) that analyses <b>Exchange Online Protection</b> and <b>Defender for Office 365</b> configuration against Microsoft's recommendations.</p>
    <p class="body-text"><b>When:</b> You specifically want mail-flow / anti-phishing / anti-malware hygiene reviewed. <b>Why:</b> Concise, focused, early guidance on EOP/MDO settings; its controls are also surfaced inside Maester.</p>
    <p class="body-text"><b>How:</b> <code>Install-Module ORCA</code>, then <code>Get-ORCAReport</code>.</p>
    <h4>365Inspect (Soteria)</h4>
    <p class="body-text">Open-source PowerShell utility that audits an M365 tenant against best practices and produces an HTML report with remediation advice. (Note: its commercial successor line - 365Inspect+ &rarr; M365SAT - has moved to a paid model; the original 365Inspect remains free.)</p>
    <h4>Monkey365</h4>
    <p class="body-text">PowerShell tool that assesses M365 and Azure subscriptions against CIS and other benchmarks, with rich HTML/Excel reporting. Good when you want one tool spanning both M365 workloads and Azure IaaS/PaaS.</p>
    <h4>PSRule for Azure</h4>
    <p class="body-text">Test framework that validates Azure resources (and Bicep/ARM/Terraform-produced resources) against the Azure Well-Architected Framework and security best practices. Straddles this section and IaC (see Infrastructure as Code below) - run it both pre-deploy on templates and post-deploy on live resources.</p>
    <h4>AzureHound</h4>
    <p class="body-text">The Entra ID collector for BloodHound; use it to map cloud attack paths (app registrations, role assignments, ownership chains). See Active Directory &amp; On-Prem Identity above for BloodHound itself.</p>
    <h4>Microsoft Secure Score</h4>
    <p class="body-text">Built into the Microsoft 365 Defender / Entra portals. Free with your tenant, it gives an ongoing posture score and improvement actions. Use it as the always-on baseline; use ScubaGear/Maester for depth and rigour.</p>
    <h4>Microsoft Purview Compliance Manager</h4>
    <p class="body-text">Microsoft's own compliance posture tool inside the Purview portal. It scores your tenant against a library of regulatory and standards templates (GDPR, HIPAA, ISO 27001, NIST, PCI DSS and more), turns each requirement into a tracked, assignable improvement action, and gives auditors a documented trail of what's implemented versus outstanding.</p>
    <p class="body-text"><b>When:</b> You need to demonstrate compliance progress against a named regulation or standard, not just general security hygiene.</p>
    <p class="body-text"><b>Why:</b> It's the vendor-native way to map Microsoft 365/Purview configuration directly to compliance obligations, with built-in scoring and evidence-gathering rather than a manual spreadsheet.</p>
    <p class="body-text"><b>How:</b> In the Microsoft Purview portal, go to Compliance Manager, add an assessment from the regulation/standard template library, and work through the scored improvement actions it generates.</p>
    <h4>Configuration Analyzer for Threat Policies (Defender for Office 365)</h4>
    <p class="body-text">Built into the Microsoft Defender portal. It compares your live anti-spam, anti-malware, anti-phishing, Safe Links and Safe Attachments policies against Microsoft's Standard and Strict preset security profiles, flags anywhere you're configured less securely than the presets, and lets you apply the recommended setting directly.</p>
    <p class="body-text"><b>When:</b> You want a fast, authoritative check that mail-flow protection hasn't drifted below Microsoft's own recommended baseline. <b>Why:</b> It's first-party, always current with Microsoft's own recommendations, and pairs well with ORCA above (ORCA gives the standalone report; Configuration Analyzer gives the live, in-portal comparison with one-click remediation).</p>
    <p class="body-text"><b>How:</b> In the Microsoft Defender portal, go to Email &amp; collaboration &rarr; Policies &amp; rules &rarr; Threat policies &rarr; Configuration analyzer.</p>
  `},
  { id:'st-cloud', title:'Multi-Cloud Security Posture (AWS / Azure / GCP)', body:`
    <p class="body-text">Cloud Security Posture Management (CSPM) tools scan cloud accounts for misconfigurations, over-broad IAM and compliance gaps across providers.</p>
    ${stTable([
      ['Prowler', 'Multi-cloud CSPM & compliance', stLicenceChip('FOSS'), stPhaseChip('Assess / Monitor')],
      ['ScoutSuite', 'Multi-cloud auditing', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['CloudSploit', 'Cloud misconfig scanning', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Steampipe / Powerpipe', 'Query cloud as SQL + benchmarks', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['CloudFox', 'Cloud attack-surface enumeration', stLicenceChip('FOSS'), stPhaseChip('Assess / Test')],
      ['Microsoft Defender for Cloud - Secure Score', 'Built-in Azure posture scoring', stLicenceChip('Free', '(paid Defender plans add more checks)'), stPhaseChip('Assess / Monitor')],
    ])}
    <h4>Prowler</h4>
    <p class="body-text">The de-facto open-source CSPM. Hundreds of checks across AWS, Azure, GCP, Kubernetes and Microsoft 365, mapped to CIS, NIST, PCI, HIPAA, GDPR, ISO and more.</p>
    <p class="body-text"><b>When:</b> You need a broad, compliance-mapped scan of one or many cloud accounts, ad hoc or scheduled.</p>
    <p class="body-text"><b>Why:</b> Huge check coverage, framework mappings out of the box, active development, HTML/JSON/CSV output.</p>
    <p class="body-text"><b>How:</b> <code>pip install prowler</code>, then <code>prowler aws</code> / <code>prowler azure</code> / <code>prowler gcp</code> with appropriate read-only credentials.</p>
    <h4>ScoutSuite (NCC Group)</h4>
    <p class="body-text">Collects configuration from cloud provider APIs and produces an offline HTML report highlighting risk across services.</p>
    <p class="body-text"><b>When:</b> You want a multi-cloud auditing snapshot with a clean, navigable report to review with stakeholders. <b>Why:</b> Read-only, quick to run, good for point-in-time reviews and client assessments.</p>
    <h4>CloudSploit / Steampipe + Powerpipe</h4>
    <p class="body-text">CloudSploit provides open-source misconfiguration scans. Steampipe lets you query your cloud as SQL and, with Powerpipe, run packaged CIS/NIST benchmark dashboards - powerful for custom checks and reporting.</p>
    <h4>CloudFox</h4>
    <p class="body-text">Enumerates exploitable attack surface in a cloud account (roles, secrets, endpoints) from an offensive perspective - pair with Prowler's defensive view.</p>
    <h4>Microsoft Defender for Cloud - Secure Score</h4>
    <p class="body-text">Azure's own risk-based posture score, applying the Microsoft Cloud Security Benchmark (MCSB) by default the moment Defender for Cloud is turned on for a subscription. It aggregates findings into a single score, weighted by asset risk and criticality, with a ready-made workbook for tracking the score over time.</p>
    <p class="body-text"><b>When:</b> Your workloads are primarily Azure and you want the vendor-native posture score alongside (not instead of) Prowler/ScoutSuite's broader multi-cloud, framework-mapped view.</p>
    <p class="body-text"><b>Why:</b> Free baseline coverage with zero setup once Defender for Cloud is enabled, and it stays current with Microsoft's own benchmark without needing a separate tool to maintain.</p>
    <p class="body-text"><b>How:</b> In the Azure or Microsoft Defender portal, open Defender for Cloud and review the Secure Score / Security posture page; drill into individual recommendations to remediate.</p>
  `},
  { id:'st-endpoint', title:'Endpoint, EDR & Host Visibility', body:`
    <p class="body-text">You can't defend what you can't see. These give telemetry, detection and response on Windows/Linux/macOS endpoints and servers.</p>
    ${stTable([
      ['Wazuh', 'Open-source XDR/SIEM + HIDS', stLicenceChip('FOSS'), stPhaseChip('Monitor')],
      ['osquery', 'Endpoint state as SQL', stLicenceChip('FOSS'), stPhaseChip('Assess / Monitor')],
      ['Velociraptor', 'DFIR & endpoint hunting', stLicenceChip('FOSS'), stPhaseChip('Monitor / Test')],
      ['Sysmon (Sysinternals)', 'Deep Windows event logging', stLicenceChip('Free'), stPhaseChip('Monitor')],
      ['Microsoft Defender for Endpoint', 'EDR', stLicenceChip('Commercial'), stPhaseChip('Monitor')],
      ['OSSEC', 'Host intrusion detection', stLicenceChip('FOSS'), stPhaseChip('Monitor')],
    ])}
    <h4>Wazuh</h4>
    <p class="body-text">Open-source security platform combining host-based intrusion detection, log analysis, file-integrity monitoring, vulnerability detection and compliance reporting, with a central manager and dashboards.</p>
    <p class="body-text"><b>When:</b> You need SIEM/XDR-style visibility and detection without licensing costs - endpoints, servers, cloud workloads, containers.</p>
    <p class="body-text"><b>Why:</b> One platform for detection, FIM, compliance (PCI/CIS) and alerting; large ruleset and community.</p>
    <p class="body-text"><b>How:</b> Deploy the Wazuh manager + indexer + dashboard (Docker or packages), roll out agents to hosts, tune rules.</p>
    <h4>osquery (Meta)</h4>
    <p class="body-text">Exposes the OS as a relational database you query with SQL ("select * from processes where ...").</p>
    <p class="body-text"><b>When:</b> You want live or scheduled fleet questions - "which hosts have this process / listening port / vulnerable package?" <b>Why:</b> Lightweight, cross-platform, scriptable; underpins many detection and inventory workflows (pair with Fleet for management).</p>
    <h4>Velociraptor (Rapid7)</h4>
    <p class="body-text">Endpoint DFIR and hunting at scale using its VQL query language; collect artefacts, hunt IOCs, respond across thousands of hosts.</p>
    <p class="body-text"><b>When:</b> Incident response, threat hunting, or targeted forensic collection. <b>Why:</b> Fast, flexible, purpose-built for hunting and IR without heavyweight infrastructure.</p>
    <h4>Sysmon</h4>
    <p class="body-text">Free Sysinternals driver that logs rich process, network and file/registry events to the Windows Event Log - the raw material for most Windows detections (feed it to Wazuh/your SIEM and pair with Sigma rules, see Detection Engineering &amp; Threat Hunting below).</p>
  `},
  { id:'st-container', title:'Container & Kubernetes Security', body:`
    <p class="body-text">Containers and Kubernetes add layers - images, registries, manifests, the control plane and runtime. Scan each, and enforce policy at admission.</p>
    ${stTable([
      ['Trivy', 'Image/IaC/K8s/secret scanner', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Grype + Syft', 'Vuln scan + SBOM generation', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['kube-bench', 'CIS Kubernetes Benchmark', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Kubescape', 'K8s posture vs NSA/CIS/MITRE', stLicenceChip('FOSS'), stPhaseChip('Assess / Monitor')],
      ['Falco', 'Runtime threat detection', stLicenceChip('FOSS'), stPhaseChip('Monitor')],
      ['Polaris', 'Manifest best-practice checks', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['kubeaudit', 'K8s workload auditing', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['OPA Gatekeeper', 'Policy admission control', stLicenceChip('FOSS'), stPhaseChip('Harden')],
      ['Kyverno', 'Kubernetes-native policy', stLicenceChip('FOSS'), stPhaseChip('Harden')],
      ['Docker Bench', 'Docker host CIS checks', stLicenceChip('FOSS'), stPhaseChip('Assess')],
    ])}
    <h4>Trivy (Aqua)</h4>
    <p class="body-text">The Swiss-army scanner: container images, filesystems, Git repos, Kubernetes clusters, IaC/misconfiguration, secrets and SBOMs, all in one binary. (It absorbed the retired <b>tfsec</b> engine - see Infrastructure as Code below.)</p>
    <p class="body-text"><b>When:</b> Almost any "is this artefact vulnerable/misconfigured?" question in a pipeline or on a cluster.</p>
    <p class="body-text"><b>Why:</b> Broad coverage, fast, CI-friendly (SARIF output), single tool to learn.</p>
    <p class="body-text"><b>How:</b> <code>trivy image &lt;name&gt;</code>, <code>trivy fs .</code>, <code>trivy k8s cluster</code>, <code>trivy config &lt;dir&gt;</code>.</p>
    <h4>Grype + Syft (Anchore)</h4>
    <p class="body-text">Syft generates a Software Bill of Materials (SBOM); Grype scans it (or an image) for known vulnerabilities. Use them when SBOM generation and supply-chain transparency are the goal.</p>
    <h4>kube-bench</h4>
    <p class="body-text">Checks a cluster against the CIS Kubernetes Benchmark (control plane, nodes, policies). Run after any cluster build or upgrade to prove baseline hardening.</p>
    <h4>Kubescape (CNCF)</h4>
    <p class="body-text">Scans manifests, Helm charts and live clusters against the NSA/CISA hardening guidance, CIS Benchmark and MITRE ATT&amp;CK for Kubernetes, with a risk score and CI integration.</p>
    <h4>Falco (CNCF)</h4>
    <p class="body-text">Runtime security: watches syscalls/kernel events and alerts on suspicious behaviour (shell in a container, unexpected outbound connections, sensitive file reads).</p>
    <p class="body-text"><b>When:</b> You need runtime detection, not just build-time scanning. <b>Why:</b> The reference open-source K8s runtime detection engine; rules map to real attacker behaviour.</p>
    <h4>Polaris / kubeaudit</h4>
    <p class="body-text">Static best-practice and security checks on workloads (resource limits, privilege, securityContext). Good pre-deployment gates.</p>
    <h4>OPA Gatekeeper vs Kyverno</h4>
    <p class="body-text">Admission controllers that enforce policy (block privileged pods, require signed images, enforce labels). Gatekeeper uses Rego/OPA; Kyverno uses Kubernetes-native YAML policies (gentler learning curve). Choose one to move from finding to preventing misconfiguration.</p>
  `},
  { id:'st-appsec', title:'Application Security, CI/CD & Secure SDLC', body:`
    <p class="body-text">Shift security left: scan code, dependencies, secrets and running apps inside the pipeline so issues are caught before release.</p>
    ${stTable([
      ['Semgrep', 'SAST (static analysis)', stLicenceChip('FOSS') + ' / ' + stLicenceChip('Free') + ' tier', stPhaseChip('Assess')],
      ['CodeQL', 'Semantic code analysis', stLicenceChip('Free', '(open-source repos)'), stPhaseChip('Assess')],
      ['SonarQube', 'Code quality + security', stLicenceChip('FOSS', '(Community)'), stPhaseChip('Assess')],
      ['Bandit', 'Python SAST', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Gitleaks', 'Secret detection', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['TruffleHog', 'Secret detection + verification', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['OWASP Dependency-Check', 'SCA (known-vuln deps)', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['OWASP ZAP', 'DAST (running app)', stLicenceChip('FOSS'), stPhaseChip('Assess / Test')],
      ['Nuclei', 'Template-based scanning', stLicenceChip('FOSS'), stPhaseChip('Assess / Test')],
      ['Dependabot / Renovate', 'Dependency updates', stLicenceChip('Free') + ' / ' + stLicenceChip('FOSS'), stPhaseChip('Harden')],
      ['Sigstore / cosign', 'Artefact signing', stLicenceChip('FOSS'), stPhaseChip('Harden')],
      ['Snyk', 'SCA/SAST platform', stLicenceChip('Commercial', '(free tier)'), stPhaseChip('Assess')],
    ])}
    <h4>Semgrep</h4>
    <p class="body-text">Fast, rule-based static analysis across many languages; write custom rules in a readable pattern syntax. Great first SAST gate in CI.</p>
    <p class="body-text"><b>How:</b> <code>semgrep --config auto .</code> locally or in a pipeline; SARIF output for PR annotations.</p>
    <h4>CodeQL (GitHub)</h4>
    <p class="body-text">Treats code as data you query for vulnerability patterns; powers GitHub code scanning. Free for open-source and available in GitHub Advanced Security. Deep, semantic, lower false-positive rate.</p>
    <h4>SonarQube Community</h4>
    <p class="body-text">Self-hosted static analysis for quality and security hotspots across many languages; the Community edition is open source. Use as the central code-health gate.</p>
    <h4>Bandit</h4>
    <p class="body-text">Targeted Python SAST for common insecure patterns (eval, weak crypto, hardcoded secrets). Cheap to add to any Python repo.</p>
    <h4>Gitleaks / TruffleHog</h4>
    <p class="body-text">Detect secrets (keys, tokens, credentials) in code and history. TruffleHog additionally verifies whether found credentials are live. Run as a pre-commit hook <b>and</b> in CI.</p>
    <h4>OWASP Dependency-Check</h4>
    <p class="body-text">Software Composition Analysis: flags dependencies with known CVEs. Complement with Dependabot/Renovate to actually raise the update PRs.</p>
    <h4>OWASP ZAP</h4>
    <p class="body-text">The leading open-source DAST proxy; spider and actively scan a running web app for injection, auth and config flaws. Automatable in CI (baseline scan) or driven manually for deeper testing.</p>
    <h4>Nuclei (ProjectDiscovery)</h4>
    <p class="body-text">Runs a huge community library of YAML templates against targets to find known vulns, misconfigurations and exposures - fast, and easy to fold into pipelines or recon.</p>
    <h4>Sigstore / cosign</h4>
    <p class="body-text">Sign and verify container images and artefacts to secure the supply chain (provenance, tamper-evidence). Enforce signature checks at admission with Kyverno/Gatekeeper (see Container &amp; Kubernetes Security above).</p>
  `},
  { id:'st-iac', title:'Infrastructure as Code, Bicep & Terraform Security', body:`
    <p class="body-text">Catch misconfigurations in Terraform, Bicep, ARM, CloudFormation, Kubernetes and Dockerfiles before they're deployed.</p>
    ${stTable([
      ['Checkov', 'Multi-format IaC scanner', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Trivy (config)', 'IaC + misconfig scanner', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['KICS (Checkmarx)', 'Multi-format IaC queries', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['PSRule for Azure', 'Azure/Bicep/ARM best practice', stLicenceChip('FOSS'), stPhaseChip('Assess / Harden')],
      ['Bicep linter', 'Native Bicep analysis', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Azure Policy', 'Deploy-time & runtime governance', stLicenceChip('Free', '(with Azure)'), stPhaseChip('Harden / Monitor')],
    ])}
    <p class="body-text"><b>Consolidation note (important):</b> <b>tfsec</b> is deprecated - its checks were merged into <b>Trivy</b> (same <code>AVD-...</code> check IDs), so use <code>trivy config</code>. <b>Terrascan</b> was archived by Tenable in November 2025 and is read-only - don't start new pipelines on it. The maintained open-source choices today are <b>Checkov</b>, <b>Trivy</b> and <b>KICS</b>.</p>
    <h4>Checkov (Palo Alto / Prisma Cloud)</h4>
    <p class="body-text">1,000+ built-in policies across Terraform, CloudFormation, Kubernetes, Helm, ARM, Bicep and Dockerfiles, with graph-based checks that follow references between resources. Frequent releases.</p>
    <p class="body-text"><b>When:</b> Your primary IaC gate - especially Terraform-heavy estates.</p>
    <p class="body-text"><b>How:</b> <code>pip install checkov</code>, then <code>checkov -d .</code>; wire into pre-commit and CI with SARIF output.</p>
    <h4>Trivy config</h4>
    <p class="body-text">The same Trivy binary from Container &amp; Kubernetes Security scans IaC and misconfigurations, inheriting the tfsec ruleset. Handy when you already use Trivy for images and want one tool.</p>
    <h4>KICS (Checkmarx)</h4>
    <p class="body-text">~2,000 queries (Rego) across Terraform, Kubernetes, Docker, CloudFormation, Ansible, Helm and OpenAPI. Good when you want one scanner spanning config formats beyond IaC.</p>
    <h4>PSRule for Azure</h4>
    <p class="body-text">Purpose-built for Azure: validates <b>Bicep</b>, ARM and Terraform-produced Azure resources against the Well-Architected Framework and security rules. The strongest choice specifically for Bicep/Azure teams; run pre-deploy in CI and post-deploy against live resources.</p>
    <h4>Bicep linter</h4>
    <p class="body-text">Built into the Bicep tooling/CLI; catches syntax, best-practice and some security issues as you author. First line of defence - free, instant, in-editor.</p>
    <h4>Azure Policy</h4>
    <p class="body-text">Governance at the platform level: audit or deny non-compliant resources at deploy time and flag drift continuously (e.g. "no public storage", "encryption required"). This is how you enforce what the scanners above only detect.</p>
  `},
  { id:'st-vuln', title:'Vulnerability Management & Network Scanning', body:`
    <p class="body-text">Find hosts, open services and known vulnerabilities across the network.</p>
    ${stTable([
      ['Nmap', 'Network discovery & port scan', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['OpenVAS / Greenbone CE', 'Vulnerability scanner', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Nessus Essentials', 'Vulnerability scanner', stLicenceChip('Free', '(&le;16 IPs)'), stPhaseChip('Assess')],
      ['OWASP ZAP / Nuclei', 'Web/app scanning', stLicenceChip('FOSS'), stPhaseChip('Assess')],
      ['Edgescan', 'Managed vuln scanning / PTaaS', stLicenceChip('Commercial'), stPhaseChip('Assess / Monitor')],
    ])}
    <h4>Nmap</h4>
    <p class="body-text">The foundational network mapper: host discovery, port/service/version detection and the NSE scripting engine for light vulnerability checks.</p>
    <p class="body-text"><b>How:</b> <code>nmap -sV -sC &lt;target&gt;</code>; use NSE scripts for targeted checks. Only scan authorised ranges.</p>
    <h4>OpenVAS / Greenbone Community Edition</h4>
    <p class="body-text">Full open-source vulnerability scanner with a large, updated feed of network vulnerability tests. The free path to authenticated and unauthenticated vuln scanning at scale.</p>
    <h4>Nessus Essentials (Tenable)</h4>
    <p class="body-text">Free tier of the industry-standard scanner, limited to 16 IPs. Great for labs and small environments; the commercial tiers remove the limit.</p>
    <h4>Edgescan</h4>
    <p class="body-text">Commercial vulnerability-management / penetration-testing-as-a-service platform combining automated scanning with human validation (low false positives), triage, reporting and remediation tracking through a portal. Listed because it's a common enterprise requirement; the open-source stack above (Nmap + OpenVAS + ZAP/Nuclei) covers much of the scanning function if budget is the constraint.</p>
  `},
  { id:'st-offensive', title:'Offensive Security & Penetration Testing', body:`
    <div class="sample-banner"><b>&#9888; Responsible use</b> Authorisation in writing is mandatory before use. Offensive and assessment tools must only be run against systems you own or are explicitly authorised (in writing) to test. Unauthorised scanning or exploitation is illegal in most jurisdictions.</div>
    <p class="body-text">Validate defences by thinking like an attacker.</p>
    ${stTable([
      ['Metasploit Framework', 'Exploitation framework', stLicenceChip('FOSS'), stPhaseChip('Test')],
      ['Burp Suite Community', 'Web app testing proxy', stLicenceChip('Free'), stPhaseChip('Test')],
      ['NetExec (nxc)', 'AD/network exploitation', stLicenceChip('FOSS'), stPhaseChip('Test')],
      ['Impacket', 'Python network protocol toolkit', stLicenceChip('FOSS'), stPhaseChip('Test')],
      ['Responder', 'LLMNR/NBT-NS poisoning', stLicenceChip('FOSS'), stPhaseChip('Test')],
      ['Mimikatz', 'Windows credential extraction', stLicenceChip('FOSS'), stPhaseChip('Test')],
      ['Hashcat / John', 'Password cracking', stLicenceChip('FOSS'), stPhaseChip('Test')],
      ['Kali / Parrot OS', 'Pentest distributions', stLicenceChip('FOSS'), stPhaseChip('Test')],
    ])}
    <h4>Metasploit Framework</h4>
    <p class="body-text">The standard open-source exploitation platform: modules for scanning, exploitation, post-exploitation and payloads. Use for validating that known vulnerabilities are actually exploitable in your environment.</p>
    <h4>Burp Suite Community (PortSwigger)</h4>
    <p class="body-text">Intercepting proxy for manual web app testing (repeater, decoder, basic scanner). The free edition is the entry point for web pen testing; Professional adds an active scanner.</p>
    <h4>NetExec (nxc)</h4>
    <p class="body-text">The maintained successor to CrackMapExec: sweep and exploit AD/SMB/WinRM/LDAP at scale (auth spraying, share enumeration, command execution). Core AD pen-test tooling.</p>
    <h4>Impacket</h4>
    <p class="body-text">Python classes for network protocols (SMB, Kerberos, MSRPC) powering many well-known scripts (<code>secretsdump.py</code>, <code>psexec.py</code>, <code>GetUserSPNs.py</code> for Kerberoasting). The building blocks of AD attacks.</p>
    <h4>Responder</h4>
    <p class="body-text">Poisons LLMNR/NBT-NS/mDNS to capture hashes on a LAN - demonstrates a classic, still-common internal weakness.</p>
    <h4>Mimikatz</h4>
    <p class="body-text">Extracts credentials/tickets from Windows memory (pass-the-hash, pass-the-ticket, golden tickets). Included so defenders understand the technique; expect EDR to flag it.</p>
    <h4>Hashcat / John the Ripper</h4>
    <p class="body-text">GPU/CPU password cracking to test password policy strength against captured hashes.</p>
    <h4>Kali / Parrot OS</h4>
    <p class="body-text">Security distributions bundling hundreds of the above tools - the usual working environment for testing.</p>
  `},
  { id:'st-awareness', title:'Security Awareness, Phishing Simulation & Tabletop', body:`
    <p class="body-text">The human layer. Train users, simulate attacks and rehearse incident response.</p>
    ${stTable([
      ['Gophish', 'Phishing simulation', stLicenceChip('FOSS'), stPhaseChip('Test / Assess')],
      ['KnowBe4', 'Awareness training + phishing', stLicenceChip('Commercial'), stPhaseChip('Test / Monitor')],
      ['Microsoft Attack Simulation Training', 'Phishing simulation (M365)', stLicenceChip('Commercial', '(E5/add-on)'), stPhaseChip('Test')],
      ['CISA Tabletop Exercise Packages (CTEP)', 'IR rehearsal scenarios', stLicenceChip('Free'), stPhaseChip('Test')],
    ])}
    <h4>Gophish</h4>
    <p class="body-text">Open-source phishing framework: build campaigns, landing pages and track click/credential rates with dashboards.</p>
    <p class="body-text"><b>When:</b> You want to run your own phishing simulations without per-user licensing.</p>
    <p class="body-text"><b>Why:</b> Full control, self-hosted, good reporting; the free path to measuring susceptibility.</p>
    <p class="body-text"><b>How:</b> Deploy the single binary, configure sending profile and templates, launch a campaign against a consented user list.</p>
    <h4>KnowBe4</h4>
    <p class="body-text">Commercial awareness platform with a large training library and automated phishing simulations, reporting and risk scoring. Listed because it's a frequent enterprise standard; Gophish covers the simulation half if you build/curate training separately.</p>
    <h4>Microsoft Attack Simulation Training</h4>
    <p class="body-text">Built into Defender for Office 365 (E5 / add-on); runs realistic simulations and assigns training within the M365 admin experience.</p>
    <h4>CISA Tabletop Exercise Packages (CTEP)</h4>
    <p class="body-text">Free, ready-made scenario packs (ransomware, insider threat, ICS, etc.) to run discussion-based incident-response rehearsals. Pair with the design of your own tabletop exercises to test the response plan, not just the tools.</p>
  `},
  { id:'st-grc', title:'GRC, Compliance & Audit', body:`
    <p class="body-text">Prove and manage security against frameworks (CIS, NIST, ISO 27001, SOC 2, PCI, GDPR).</p>
    ${stTable([
      ['OpenSCAP', 'Config compliance vs SCAP baselines', stLicenceChip('FOSS'), stPhaseChip('Assess / Harden')],
      ['Wazuh (compliance)', 'CIS/PCI compliance monitoring', stLicenceChip('FOSS'), stPhaseChip('Monitor')],
      ['Eramba (Community)', 'GRC / risk management', stLicenceChip('FOSS'), stPhaseChip('Monitor')],
      ['OneTrust', 'Privacy / GRC platform', stLicenceChip('Commercial'), stPhaseChip('Monitor')],
      ['Vanta / Drata', 'Compliance automation (SOC 2/ISO)', stLicenceChip('Commercial'), stPhaseChip('Monitor')],
    ])}
    <h4>OpenSCAP</h4>
    <p class="body-text">Scans systems against SCAP-format baselines (CIS, DISA STIG, etc.) and can generate remediation. The open-source way to prove OS-level hardening for audits.</p>
    <p class="body-text"><b>How:</b> <code>oscap xccdf eval --profile &lt;cis|stig&gt; --results out.xml &lt;datastream&gt;</code>.</p>
    <h4>Wazuh (compliance mode)</h4>
    <p class="body-text">Beyond detection (see Endpoint, EDR &amp; Host Visibility above), Wazuh maps checks to PCI-DSS, CIS, GDPR and NIST and produces compliance dashboards - a free continuous-compliance option.</p>
    <h4>Eramba Community</h4>
    <p class="body-text">Open-source GRC: risk register, control management, policy lifecycle and audit tracking. A starting point for a formal GRC programme without licensing cost.</p>
    <h4>OneTrust / Vanta / Drata</h4>
    <p class="body-text">Commercial platforms. OneTrust centres on privacy/GRC (assessments, data mapping, vendor risk); Vanta and Drata automate evidence collection for SOC 2 / ISO 27001 audits. Listed because they're common requirements; the open-source options above cover assessment and risk tracking if you're building in-house.</p>
  `},
  { id:'st-detection', title:'Detection Engineering & Threat Hunting', body:`
    <p class="body-text">Turn telemetry into detections and hunt for what got through.</p>
    ${stTable([
      ['Sigma', 'Vendor-neutral detection rules', stLicenceChip('FOSS'), stPhaseChip('Monitor')],
      ['YARA', 'Malware/file pattern matching', stLicenceChip('FOSS'), stPhaseChip('Monitor / Test')],
      ['MITRE ATT&CK / Navigator', 'Adversary technique knowledge base', stLicenceChip('Free'), stPhaseChip('Assess')],
      ['Atomic Red Team', 'Detection validation tests', stLicenceChip('FOSS'), stPhaseChip('Test')],
      ['Wazuh / OpenSearch', 'SIEM back end', stLicenceChip('FOSS'), stPhaseChip('Monitor')],
    ])}
    <h4>Sigma</h4>
    <p class="body-text">A generic, YAML-based detection-rule format you write once and convert to your SIEM's query language (Splunk, Elastic, Sentinel, etc.). The community ruleset gives you a running start on detections.</p>
    <h4>YARA</h4>
    <p class="body-text">Rule language for identifying files/malware by patterns; used across IR, hunting and sandboxing.</p>
    <h4>MITRE ATT&amp;CK &amp; Navigator</h4>
    <p class="body-text">The shared map of adversary tactics and techniques. Use it to prioritise detections, measure coverage (Navigator heatmaps) and structure red/blue exercises.</p>
    <h4>Atomic Red Team</h4>
    <p class="body-text">Small, mapped tests that execute individual ATT&amp;CK techniques so you can confirm your detections actually fire. Closes the loop between offence (see Offensive Security &amp; Penetration Testing above) and detection.</p>
    <h4>Wazuh + OpenSearch</h4>
    <p class="body-text">A fully open-source SIEM stack for collecting, searching and alerting on the telemetry from Sysmon, osquery, cloud logs and more.</p>
  `},
  { id:'st-labs', title:'Practice Labs & Learning Environments', body:`
    <p class="body-text">Safe places to learn and validate the tools above.</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Resource</th><th>What it is</th><th>Licence</th></tr></thead>
        <tbody>
          <tr><td class="dt-title">GOAD (Game of Active Directory)</td><td>Deliberately vulnerable AD lab</td><td>${stLicenceChip('FOSS')}</td></tr>
          <tr><td class="dt-title">DetectionLab</td><td>Pre-built detection/telemetry lab</td><td>${stLicenceChip('FOSS')}</td></tr>
          <tr><td class="dt-title">OWASP Juice Shop</td><td>Vulnerable web app for AppSec practice</td><td>${stLicenceChip('FOSS')}</td></tr>
          <tr><td class="dt-title">DVWA / WebGoat</td><td>Classic vulnerable web apps</td><td>${stLicenceChip('FOSS')}</td></tr>
          <tr><td class="dt-title">TryHackMe / Hack The Box</td><td>Guided hands-on labs</td><td>${stLicenceChip('Free')} / ${stLicenceChip('Commercial')}</td></tr>
        </tbody>
      </table>
    </div>
    <h4>GOAD</h4>
    <p class="body-text">Multi-machine vulnerable AD environment for practising the identity attacks and defences from Active Directory &amp; On-Prem Identity and Offensive Security &amp; Penetration Testing above, safely.</p>
    <h4>DetectionLab</h4>
    <p class="body-text">Spins up a Windows domain wired with Sysmon, Wazuh/Velociraptor and logging so you can practise detection engineering (see Detection Engineering &amp; Threat Hunting above) end to end.</p>
    <h4>OWASP Juice Shop / DVWA / WebGoat</h4>
    <p class="body-text">Intentionally vulnerable apps to practise ZAP, Burp and secure-coding concepts (see Application Security, CI/CD &amp; Secure SDLC above).</p>
  `},
];

export function renderSecurityToolsTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Learn</div>
        <h2 class="page-title">Security Tooling Repository</h2>
        <p class="page-lede">A practical, categorised reference of tools you can use to raise an organization's security posture across every layer - identity, endpoints, cloud, Microsoft 365, containers, pipelines and code. Each tool is tagged by licence and lifecycle phase, with a short When / Why / How so you know not just what it is but when to reach for it.</p>
        <div class="info-box"><b>How to read this page.</b> Tools are grouped by the technology they apply to. Within each group you get a scan-friendly table, then per-tool notes. Use the licence and phase tags to filter for what you can actually deploy.</div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Legend</h3>
        <div class="osint-grid">
          <div class="osint-item"><b>${stLicenceChip('FOSS')}</b><span>Free and open source. Deploy freely, inspect the code, self-host.</span></div>
          <div class="osint-item"><b>${stLicenceChip('Free')}</b><span>Free to use (free tier, community edition, or free binary) but not fully open source. Check the specific licence for commercial-use limits.</span></div>
          <div class="osint-item"><b>${stLicenceChip('Commercial')}</b><span>Paid product. Listed for completeness / because it's a common requirement; a free trial or limited community edition may exist.</span></div>
          <div class="osint-item"><b>${stPhaseChip('Assess')}</b><span>Point-in-time discovery of misconfigurations, gaps or risk.</span></div>
          <div class="osint-item"><b>${stPhaseChip('Harden')}</b><span>Helps you fix / enforce a secure configuration.</span></div>
          <div class="osint-item"><b>${stPhaseChip('Monitor')}</b><span>Continuous detection of drift, threats or changes.</span></div>
          <div class="osint-item"><b>${stPhaseChip('Test')}</b><span>Offensive / validation testing (attack simulation, pen testing).</span></div>
        </div>
        <div class="sample-banner" style="margin-top:16px;"><b>&#9888; Responsible use</b> Offensive and assessment tools must only be run against systems you own or are explicitly authorised (in writing) to test. Unauthorised scanning or exploitation is illegal in most jurisdictions.</div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Quick navigation</h3>
        <ul class="toc-list">
          ${SECURITY_TOOLS_SECTIONS.map(s=>`<li><a href="#${s.id}" class="st-toc-link" data-target="${s.id}">${s.title}</a></li>`).join('')}
          <li><a href="#st-blueprint" class="st-toc-link" data-target="st-blueprint">Putting it together: a starter blueprint</a></li>
        </ul>
      </div>

      <div class="section-tile">
        <div id="securityToolsAccordions"></div>
      </div>

      <div class="section-tile" id="st-blueprint">
        <h3 class="section-h">Putting it together: a starter blueprint</h3>
        <p class="body-text">A pragmatic, low/zero-cost adoption order for most organizations:</p>
        <ol class="ordered-list">
          <li><b>See your identity risk first.</b> Run PingCastle + Purple Knight (on-prem) and ScubaGear + Maester (M365/Entra). Identity is where breaches escalate.</li>
          <li><b>Baseline the endpoints.</b> Deploy Wazuh with Sysmon for visibility, detection and continuous compliance.</li>
          <li><b>Scan the cloud.</b> Run Prowler across every cloud account, mapped to your target framework.</li>
          <li><b>Shift left in the pipeline.</b> Add Trivy (images/IaC), Checkov/PSRule for Azure (IaC/Bicep), Semgrep (SAST), Gitleaks (secrets) and OWASP Dependency-Check (SCA) to CI.</li>
          <li><b>Enforce, don't just find.</b> Move detections into prevention with Azure Policy, Kyverno/Gatekeeper and signed artefacts (cosign).</li>
          <li><b>Test and rehearse.</b> Validate with authorised BloodHound/NetExec exercises, Atomic Red Team and Gophish, and rehearse response with CISA CTEP.</li>
          <li><b>Prove it.</b> Track compliance with OpenSCAP/Wazuh and manage risk in Eramba.</li>
        </ol>
        <p class="body-text">Free and open-source tooling can cover the large majority of assessment, hardening and monitoring needs; reserve commercial spend (Edgescan, KnowBe4, OneTrust, Defender EDR, Vanta/Drata) for where managed validation, scale, or audit-automation genuinely pay for themselves.</p>
        <div class="note-box">This page is a living reference - tool status, licences and versions change. Verify the current licence terms and latest release for any tool before deploying it in production, and only run assessment/offensive tooling against systems you are authorised to test.</div>
      </div>
    </div>
  `;

  const stContainer = document.getElementById('securityToolsAccordions');
  stContainer.innerHTML = SECURITY_TOOLS_SECTIONS.map((s,i)=>`
    <div class="acc-card" data-id="${s.id}">
      <div class="acc-head" id="${s.id}">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon('checklist')}</div>
        <div><h4>${s.title}</h4></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body">${s.body}</div>
    </div>
  `).join('');
  wireAccordions(stContainer);

  // Jumping to a specific section from Quick navigation while every
  // accordion starts collapsed would land on an empty header - open the
  // target accordion (if it isn't already) before letting the native
  // #anchor scroll happen. Matches the same pattern used on Starter Guide.
  container.querySelectorAll('.st-toc-link').forEach(link=>{
    link.addEventListener('click', (e)=>{
      const card = document.querySelector(`.acc-card[data-id="${link.dataset.target}"]`);
      if(card && !card.classList.contains('open')){
        e.preventDefault();
        card.classList.add('open');
        requestAnimationFrame(()=> card.scrollIntoView({ behavior:'smooth', block:'start' }));
      }
    });
  });
}
