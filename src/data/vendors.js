// §5.3 — real, well-known vendor lists for the dropdown+"Other" pattern.
// Every name below is a genuine, currently-marketed product. Lists are
// deliberately not exhaustive (a handful of the most recognizable options
// per category, covering enterprise and SMB-oriented products) - "Other"
// with free text covers everything else, so nothing is lost by keeping
// each list short and real rather than padded out.
export const ANTIVIRUS_VENDORS = [
  "Microsoft Defender Antivirus",
  "Norton",
  "McAfee",
  "Bitdefender",
  "Kaspersky",
  "ESET",
  "Trend Micro",
  "Sophos",
  "Avast Business",
  "Webroot",
];

export const EDR_VENDORS = [
  "CrowdStrike Falcon",
  "Microsoft Defender for Endpoint",
  "SentinelOne",
  "Sophos Intercept X",
  "Trend Micro Vision One",
  "Trellix Endpoint Security",
  "Cybereason",
  "ESET PROTECT",
  "Bitdefender GravityZone",
  "Palo Alto Networks Cortex XDR",
];

export const EMAIL_SECURITY_VENDORS = [
  "Proofpoint",
  "Mimecast",
  "Microsoft Defender for Office 365",
  "Barracuda Email Protection",
  "Abnormal Security",
  "Cisco Secure Email",
  "Trend Micro Email Security",
  "Google Workspace (built-in)",
];

export const DLP_VENDORS = [
  "Microsoft Purview",
  "Forcepoint DLP",
  "Symantec DLP (Broadcom)",
  "Digital Guardian",
  "Netskope",
  "Trellix DLP",
  "Proofpoint DLP",
];

export const SDWAN_VENDORS = [
  "Cisco Meraki",
  "Fortinet Secure SD-WAN",
  "VMware VeloCloud",
  "Palo Alto Networks Prisma SD-WAN",
  "Cato Networks",
  "Aryaka",
  "Aruba (HPE) EdgeConnect",
];

export const EDGE_DEVICE_VENDORS = [
  "Fortinet FortiGate",
  "Palo Alto Networks",
  "Cisco ASA / Firepower",
  "SonicWall",
  "Check Point",
  "Juniper Networks SRX",
  "WatchGuard",
  "Ubiquiti",
];

// How each edge vendor writes a software version, for the optional version
// question's placeholder. Only the version is typed; the product name in
// brackets says which version is meant (a FortiGate runs FortiOS, etc.).
export const EDGE_VERSION_EXAMPLES = {
  "Fortinet FortiGate": "e.g. 7.4.3 (FortiOS)",
  "Palo Alto Networks": "e.g. 11.1.2-h3 (PAN-OS)",
  "Cisco ASA / Firepower": "e.g. 9.18.3 (ASA software)",
  SonicWall: "e.g. 7.0.1-5145 (SonicOS)",
  "Check Point": "e.g. R81.20",
  "Juniper Networks SRX": "e.g. 22.4R3-S2 (Junos)",
  WatchGuard: "e.g. 12.10.3 (Fireware)",
  Ubiquiti: "e.g. 4.0.6 (UniFi OS)",
};

export const HOSTING_PROVIDERS = [
  "Amazon Web Services (AWS)",
  "Microsoft Azure",
  "Google Cloud Platform",
  "GoDaddy",
  "Bluehost",
  "DigitalOcean",
  "Rackspace Technology",
  "OVHcloud",
  "Hetzner",
  "Self-hosted / on-premises",
];

export const CLOUD_PROVIDERS = [
  "Amazon Web Services (AWS)",
  "Microsoft Azure",
  "Google Cloud Platform",
  "Oracle Cloud Infrastructure",
  "IBM Cloud",
  "Alibaba Cloud",
];

export const AWARENESS_LMS_VENDORS = [
  "KnowBe4",
  "Proofpoint Security Awareness Training",
  "SANS Security Awareness",
  "Infosec IQ",
  "Mimecast Awareness Training",
  "Hoxhunt",
  "Living Security",
];

export const MSP_VENDORS = [
  "Kyndryl",
  "Rackspace Technology",
  "Accenture",
  "IBM Managed Infrastructure Services",
  "NTT DATA",
  "A local/regional MSP",
];

export const MDR_VENDORS = [
  "CrowdStrike Falcon Complete",
  "Red Canary",
  "Arctic Wolf",
  "Sophos MDR",
  "eSentire",
  "Expel",
];

export const MSSP_VENDORS = [
  "Secureworks",
  "Trustwave",
  "IBM Security Services",
  "Verizon Managed Security Services",
  "NTT Security",
  "Wipro Cybersecurity & Risk Services",
];

export const OT_ICS_VENDORS = [
  "Siemens",
  "Rockwell Automation / Allen-Bradley",
  "Schneider Electric",
  "Honeywell",
  "ABB",
  "Emerson",
  "GE Vernova",
  "Yokogawa",
  "Mitsubishi Electric",
];

export const OTHER = "__other__";
