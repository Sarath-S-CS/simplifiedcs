// Ported verbatim from the original index.html VENDOR_NOTES array -
// illustrative only, well-documented historical exploitation patterns for
// named products. Intentionally NOT a live CVE feed or vulnerability
// scanner (see §7 of CLAUDE.md - a real RAG-backed version is future scope,
// not this phase).
export const VENDOR_NOTES = [
  { keywords: ["fortinet", "fortigate", "fortios"], vendor: "Fortinet", note: "Fortinet's FortiOS/FortiGate line has had multiple critical, actively-exploited authentication-bypass and RCE vulnerabilities in recent years. Regardless of current patch level: confirm firmware is on a currently-supported, patched release; avoid exposing the management interface to the internet; and enforce MFA on SSL-VPN." },
  { keywords: ["citrix", "netscaler"], vendor: "Citrix", note: "Citrix NetScaler/ADC and Gateway appliances have repeatedly been targeted by actively-exploited critical vulnerabilities (the \"Citrix Bleed\" family among them). Keep firmware current, terminate active sessions after any patch, and restrict management access to trusted networks only." },
  { keywords: ["ivanti", "pulse secure"], vendor: "Ivanti / Pulse Secure", note: "Ivanti Connect Secure and Pulse Secure VPN appliances have seen sustained, actively-exploited zero-days. Treat any Ivanti/Pulse edge device as a high-priority, frequent patch target and consider added network-layer restrictions on management access." },
  { keywords: ["cisco asa", "cisco ios", "cisco"], vendor: "Cisco", note: "Cisco ASA and IOS/IOS XE devices have had multiple actively-exploited RCE and privilege-escalation vulnerabilities. Disable the web management UI on internet-facing interfaces where not strictly required, and check Cisco's PSIRT advisories directly for your specific model." },
  { keywords: ["exchange"], vendor: "Microsoft Exchange (on-prem)", note: "On-premises Exchange servers have been a recurring target for critical, chained RCE vulnerabilities. If still running on-prem Exchange, treat it as a high-priority, closely-monitored patch target regardless of current version." },
  { keywords: ["vcenter", "esxi", "vmware"], vendor: "VMware", note: "VMware vCenter and ESXi have had several critical, actively-exploited RCE vulnerabilities. Ensure management interfaces are never internet-facing, and patching stays current." },
  { keywords: ["moveit"], vendor: "MOVEit / Progress", note: "MOVEit Transfer was the subject of a major mass-exploitation event via a since-patched critical vulnerability. Confirm you're on a current, fully-patched release and review file-transfer logs for the historical exposure window." },
  { keywords: ["sonicwall"], vendor: "SonicWall", note: "SonicWall firewall/VPN appliances have had repeated critical, actively-exploited vulnerabilities. Confirm firmware is current and management access is restricted." },
  { keywords: ["barracuda"], vendor: "Barracuda", note: "Barracuda's Email Security Gateway was subject to a critical zero-day serious enough that Barracuda recommended full hardware replacement for affected units. If you run Barracuda ESG appliances, verify directly with Barracuda whether your hardware was affected." },
  { keywords: ["proofpoint"], vendor: "Proofpoint", note: "Proofpoint's email security and security-awareness products are widely deployed - confirm URL Defense/attachment sandboxing are actually enabled (not just licensed), and that simulated-phishing results are being reviewed and acted on, not just collected." },
  { keywords: ["mimecast"], vendor: "Mimecast", note: "Mimecast email security deployments are commonly found with misconfigured DMARC alignment or impersonation-protection settings left at default - confirm these are actively enforced, not merely available in the license." },
  { keywords: ["knowbe4"], vendor: "KnowBe4", note: "Awareness platforms like KnowBe4 are only as effective as their completion and simulated-phishing-failure rates are actually reviewed by someone - track those metrics on a schedule, don't just deploy the training and move on." },
  { keywords: ["defender for office", "office 365 atp", "microsoft 365 defender"], vendor: "Microsoft Defender for Office 365", note: "Defender for Office 365 requires Safe Links and Safe Attachments to be explicitly enabled per the licensing tier - confirm these are actually turned on, not just included in the plan you're paying for." },
];

export function matchedVendorNotes(answers) {
  const haystack = [
    answers.edgeDeviceVendor,
    answers.sdwanVendor,
    answers.edrVendor,
    answers.hostingProvider,
    answers.webServerStack,
    answers.dlpVendor,
    answers.cloudProvider,
    answers.emailSecurityVendor,
    answers.awarenessLms,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack) return [];
  const seen = new Set();
  const matches = [];
  VENDOR_NOTES.forEach((v) => {
    if (v.keywords.some((k) => haystack.includes(k)) && !seen.has(v.vendor)) {
      seen.add(v.vendor);
      matches.push(v);
    }
  });
  return matches;
}
