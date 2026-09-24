// Canonical product identities for the vendor/product names the assessment
// collects (src/data/vendors.js dropdowns, plus free-text "Other" entries).
// Used by the AI-insights retrieval step (AI-2) to match public
// vulnerability data to what the organisation actually named - and, just as
// importantly, to say when a match is only at the vendor level.
//
// kevVendors are CISA KEV `vendorProject` spellings as they appear in the
// live catalog (checked against catalogVersion 2026.09.23 when this file was
// written). Vendors that have no KEV entries at all are listed under their
// common name; they simply produce "checked - no match".
// kevProduct matches KEV `product` for that vendor; an entry for the same
// vendor that doesn't match is a vendor-only ("product not confirmed") hit.
// nvdTerm is a keyword search against NVD descriptions.
//
// kind:
//   software        - a product the organisation runs and patches
//   vendor-family   - a vendor name that spans many products (e.g. "SonicWall")
//   managed-service - SaaS / cloud / managed provider: vulnerabilities are
//                     remediated by the provider and rarely appear in KEV/NVD
//                     as customer-actionable items, so it isn't checked -
//                     and the report says so instead of implying "clean".

export type ProductKind = "software" | "vendor-family" | "managed-service";

export type CatalogEntry = {
  label: string;
  kind: ProductKind;
  kevVendors: string[];
  kevProduct?: RegExp;
  nvdTerm?: string;
};

const E = (label: string, kind: ProductKind, kevVendors: string[], kevProduct?: RegExp, nvdTerm?: string): CatalogEntry => ({ label, kind, kevVendors, kevProduct, nvdTerm });

export const CATALOG: CatalogEntry[] = [
  // Antivirus
  E("Microsoft Defender Antivirus", "software", ["Microsoft"], /defender|malware protection engine/i, "Microsoft Defender Antivirus"),
  E("Norton", "software", ["NortonLifeLock", "Symantec"], /norton/i, "Norton Antivirus"),
  E("McAfee", "vendor-family", ["McAfee", "Trellix"], undefined, "McAfee"),
  E("Bitdefender", "vendor-family", ["Bitdefender"], undefined, "Bitdefender"),
  E("Kaspersky", "vendor-family", ["Kaspersky"], undefined, "Kaspersky"),
  E("ESET", "vendor-family", ["ESET"], undefined, "ESET"),
  E("Trend Micro", "vendor-family", ["Trend Micro"], undefined, "Trend Micro"),
  E("Sophos", "vendor-family", ["Sophos"], undefined, "Sophos"),
  E("Avast Business", "software", ["Avast"], /avast/i, "Avast"),
  E("Webroot", "software", ["Webroot", "OpenText"], /webroot/i, "Webroot"),
  // EDR
  E("CrowdStrike Falcon", "software", ["CrowdStrike"], /falcon/i, "CrowdStrike Falcon"),
  E("Microsoft Defender for Endpoint", "software", ["Microsoft"], /defender for endpoint|defender/i, "Defender for Endpoint"),
  E("SentinelOne", "software", ["SentinelOne"], /singularity|agent|sentinelone/i, "SentinelOne"),
  E("Sophos Intercept X", "software", ["Sophos"], /intercept x|endpoint/i, "Sophos Intercept X"),
  E("Trend Micro Vision One", "software", ["Trend Micro"], /vision one|apex one/i, "Trend Micro Vision One"),
  E("Trellix Endpoint Security", "software", ["Trellix", "McAfee"], /endpoint/i, "Trellix Endpoint Security"),
  E("Cybereason", "software", ["Cybereason"], undefined, "Cybereason"),
  E("ESET PROTECT", "software", ["ESET"], /protect/i, "ESET PROTECT"),
  E("Bitdefender GravityZone", "software", ["Bitdefender"], /gravityzone/i, "GravityZone"),
  E("Palo Alto Networks Cortex XDR", "software", ["Palo Alto Networks"], /cortex xdr/i, "Cortex XDR"),
  // Email security
  E("Proofpoint", "managed-service", []),
  E("Mimecast", "managed-service", []),
  E("Microsoft Defender for Office 365", "managed-service", []),
  E("Barracuda Email Protection", "software", ["Barracuda Networks"], /email security gateway|esg/i, "Barracuda Email Security Gateway"),
  E("Abnormal Security", "managed-service", []),
  E("Cisco Secure Email", "software", ["Cisco"], /secure email|email security appliance/i, "Cisco Secure Email"),
  E("Trend Micro Email Security", "managed-service", []),
  E("Google Workspace (built-in)", "managed-service", []),
  // DLP
  E("Microsoft Purview", "managed-service", []),
  E("Forcepoint DLP", "software", ["Forcepoint"], /dlp|data loss/i, "Forcepoint DLP"),
  E("Symantec DLP (Broadcom)", "software", ["Symantec", "Broadcom"], /data loss|dlp/i, "Symantec Data Loss Prevention"),
  E("Digital Guardian", "software", ["Digital Guardian", "Fortra"], /digital guardian/i, "Digital Guardian"),
  E("Netskope", "managed-service", []),
  E("Trellix DLP", "software", ["Trellix", "McAfee"], /dlp|data loss/i, "Trellix DLP"),
  E("Proofpoint DLP", "managed-service", []),
  // SD-WAN
  E("Cisco Meraki", "software", ["Cisco"], /meraki/i, "Cisco Meraki"),
  E("Fortinet Secure SD-WAN", "software", ["Fortinet"], /fortios|sd-wan|multiple products/i, "FortiOS SD-WAN"),
  E("VMware VeloCloud", "software", ["VMware", "Broadcom"], /sd-wan|velocloud/i, "VMware SD-WAN"),
  E("Palo Alto Networks Prisma SD-WAN", "software", ["Palo Alto Networks"], /prisma sd-wan|ion/i, "Prisma SD-WAN"),
  E("Cato Networks", "managed-service", []),
  E("Aryaka", "managed-service", []),
  E("Aruba (HPE) EdgeConnect", "software", ["Hewlett Packard Enterprise (HPE)", "Aruba Networks"], /edgeconnect/i, "Aruba EdgeConnect"),
  // Edge devices (firewall / VPN)
  E("Fortinet FortiGate", "software", ["Fortinet"], /fortios|fortigate|multiple products/i, "FortiOS"),
  E("Palo Alto Networks", "software", ["Palo Alto Networks"], /pan-os/i, "PAN-OS"),
  E("Cisco ASA / Firepower", "software", ["Cisco"], /adaptive security appliance|\basa\b|firepower|firewall threat defense|secure firewall/i, "Cisco Adaptive Security Appliance"),
  E("SonicWall", "vendor-family", ["SonicWall"], /sonicos|sma|firewall/i, "SonicWall"),
  E("Check Point", "vendor-family", ["Check Point"], /security gateway|quantum|multiple products/i, "Check Point Security Gateway"),
  E("Juniper Networks SRX", "software", ["Juniper"], /junos/i, "Junos OS SRX"),
  E("WatchGuard", "software", ["WatchGuard"], /firebox/i, "WatchGuard Firebox"),
  E("Ubiquiti", "vendor-family", ["Ubiquiti"], undefined, "Ubiquiti UniFi"),
  // Hosting / cloud providers
  E("Amazon Web Services (AWS)", "managed-service", []),
  E("Microsoft Azure", "managed-service", []),
  E("Google Cloud Platform", "managed-service", []),
  E("GoDaddy", "managed-service", []),
  E("Bluehost", "managed-service", []),
  E("DigitalOcean", "managed-service", []),
  E("Rackspace Technology", "managed-service", []),
  E("OVHcloud", "managed-service", []),
  E("Hetzner", "managed-service", []),
  E("Self-hosted / on-premises", "managed-service", []),
  E("Oracle Cloud Infrastructure", "managed-service", []),
  E("IBM Cloud", "managed-service", []),
  E("Alibaba Cloud", "managed-service", []),
  // Awareness / MSP / MDR / MSSP - services, not software you patch
  ...["KnowBe4", "Proofpoint Security Awareness Training", "SANS Security Awareness", "Infosec IQ", "Mimecast Awareness Training", "Hoxhunt", "Living Security"].map((l) => E(l, "managed-service", [])),
  ...["Kyndryl", "Accenture", "IBM Managed Infrastructure Services", "NTT DATA", "A local/regional MSP"].map((l) => E(l, "managed-service", [])),
  ...["CrowdStrike Falcon Complete", "Red Canary", "Arctic Wolf", "Sophos MDR", "eSentire", "Expel"].map((l) => E(l, "managed-service", [])),
  ...["Secureworks", "Trustwave", "IBM Security Services", "Verizon Managed Security Services", "NTT Security", "Wipro Cybersecurity & Risk Services"].map((l) => E(l, "managed-service", [])),
  // OT / ICS - vendor families spanning many product lines
  E("Siemens", "vendor-family", ["Siemens"], undefined, "Siemens SIMATIC"),
  E("Rockwell Automation / Allen-Bradley", "vendor-family", ["Rockwell", "Rockwell Automation"], undefined, "Rockwell Automation"),
  E("Schneider Electric", "vendor-family", ["Schneider Electric"], undefined, "Schneider Electric"),
  E("Honeywell", "vendor-family", ["Honeywell"], undefined, "Honeywell"),
  E("ABB", "vendor-family", ["ABB"], undefined, "ABB"),
  E("Emerson", "vendor-family", ["Emerson"], undefined, "Emerson"),
  E("GE Vernova", "vendor-family", ["GE Vernova", "General Electric"], undefined, "GE Vernova"),
  E("Yokogawa", "vendor-family", ["Yokogawa"], undefined, "Yokogawa"),
  E("Mitsubishi Electric", "vendor-family", ["Mitsubishi Electric"], undefined, "Mitsubishi Electric"),
];

const BY_LABEL = new Map(CATALOG.map((e) => [e.label.toLowerCase(), e]));

export type ResolvedProduct = CatalogEntry & {
  key: string; // stable id used by evidence records and model citations
  category: string;
  name: string; // what the organisation typed/selected
  origin: "catalog" | "free-text";
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "product";
}

// Maps a (category, name) pair to a canonical identity. Free-text names that
// don't match the catalog are treated conservatively: a single word is a
// vendor family (product unknown); longer text is searched as-is but still
// only ever produces "potential" matches.
export function resolveProduct(category: string, rawName: string, index: number): ResolvedProduct {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 150);
  const key = `p${index}-${slug(name)}`;
  const exact = BY_LABEL.get(name.toLowerCase());
  if (exact) return { ...exact, key, category, name, origin: "catalog" };
  const contained = CATALOG.find((e) => e.kind !== "managed-service" && e.label.length >= 5 && name.toLowerCase().includes(e.label.toLowerCase()));
  if (contained) return { ...contained, key, category, name, origin: "free-text" };
  const words = name.split(" ").filter(Boolean);
  const first = words[0] || name;
  if (words.length === 1) {
    return { label: name, kind: "vendor-family", kevVendors: [first], nvdTerm: first, key, category, name, origin: "free-text" };
  }
  const product = words.slice(1).filter((w) => w.length > 2 && !/^(on|the|and|with|for|running)$/i.test(w));
  return {
    label: name,
    kind: "software",
    kevVendors: [first],
    kevProduct: product.length ? new RegExp(product.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : undefined,
    nvdTerm: words.slice(0, 4).join(" "),
    key,
    category,
    name,
    origin: "free-text",
  };
}
