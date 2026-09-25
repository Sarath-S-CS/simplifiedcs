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
// versionCpe (AI-2) is how NVD names the product in CPE form, so a stated
// version can be looked up exactly (cpeName + isVulnerable: "which CVEs does
// NVD list as affecting this version?"). Only products whose naming was
// checked against live NVD lookups (24 Sep 2026) have one. Cisco ASA and IIS
// are deliberately absent: NVD returned nothing for real versions of both,
// which would read as a clean result.
//
// kind:
//   software        - a product the organisation runs and patches
//   vendor-family   - a vendor name that spans many products (e.g. "SonicWall")
//   managed-service - SaaS / cloud / managed provider: vulnerabilities are
//                     remediated by the provider and rarely appear in KEV/NVD
//                     as customer-actionable items, so it isn't checked -
//                     and the report says so instead of implying "clean".

export type ProductKind = "software" | "vendor-family" | "managed-service";

// A stated version split into NVD's CPE "version" and "update" components,
// or null when the text isn't a version of this product.
type VersionParse = (v: string) => { version: string; update?: string } | null;

export type VersionCpe = { part: "o" | "a"; vendor: string; product: string; parse: VersionParse };

export type CatalogEntry = {
  label: string;
  kind: ProductKind;
  kevVendors: string[];
  kevProduct?: RegExp;
  nvdTerm?: string;
  versionCpe?: VersionCpe;
  // Other ways people write this product in an "Other" edge-device answer.
  alias?: RegExp;
  // Count only product-level KEV matches: for a vendor with many unrelated
  // products (F5 for nginx, the Apache Software Foundation), "same vendor"
  // hits are noise rather than a prompt worth checking.
  kevProductOnly?: boolean;
};

const E = (label: string, kind: ProductKind, kevVendors: string[], kevProduct?: RegExp, nvdTerm?: string): CatalogEntry => ({ label, kind, kevVendors, kevProduct, nvdTerm });

// Strips the product name and "v"/"version" people often type before a
// version, and anything after it that the parser allows (e.g. a build).
const bare = (v: string, names: RegExp) => v.trim().replace(names, "").replace(/^(version|ver\.?)\s*/i, "").replace(/^v(?=\d)/i, "").trim();
const whole = (re: RegExp, v: string) => re.exec(v);
const VERSION_PARSERS: Record<string, VersionParse> = {
  fortios: (v) => {
    const m = whole(/^(\d+\.\d+\.\d+)(?:[\s,]*(?:build|b)\s*\d+)?$/i, bare(v, /^forti(os|gate)\s*/i));
    return m ? { version: m[1] } : null;
  },
  panos: (v) => {
    const m = whole(/^(\d+\.\d+\.\d+)(?:-(h\d+))?$/i, bare(v, /^pan-?os\s*/i));
    return m ? { version: m[1], update: m[2]?.toLowerCase() } : null;
  },
  sonicos: (v) => {
    const m = whole(/^(\d+\.\d+\.\d+(?:\.\d+)?(?:-\d+)?)$/, bare(v, /^sonicos\s*/i));
    return m ? { version: m[1] } : null;
  },
  junos: (v) => {
    const m = whole(/^(\d+\.\d+)R(\d+)(?:-S(\d+))?$/i, bare(v, /^junos(\s+os)?\s*/i));
    return m ? { version: m[1], update: `r${m[2]}${m[3] ? `-s${m[3]}` : ""}` } : null;
  },
  fireware: (v) => {
    const m = whole(/^(\d+\.\d+(?:\.\d+)?)$/, bare(v, /^fireware(\s+os)?\s*/i));
    return m ? { version: m[1] } : null;
  },
  threePart: (v) => {
    const m = whole(/^(\d+\.\d+\.\d+)$/, v.trim());
    return m ? { version: m[1] } : null;
  },
};
const edge = (entry: CatalogEntry, versionCpe: VersionCpe, alias: RegExp): CatalogEntry => ({ ...entry, versionCpe, alias });

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
  edge(E("Fortinet FortiGate", "software", ["Fortinet"], /fortios|fortigate|multiple products/i, "FortiOS"), { part: "o", vendor: "fortinet", product: "fortios", parse: VERSION_PARSERS.fortios }, /\bforti(gate|os)\b/i),
  edge(E("Palo Alto Networks", "software", ["Palo Alto Networks"], /pan-os/i, "PAN-OS"), { part: "o", vendor: "paloaltonetworks", product: "pan-os", parse: VERSION_PARSERS.panos }, /\b(palo alto|pan-?os)\b/i),
  E("Cisco ASA / Firepower", "software", ["Cisco"], /adaptive security appliance|\basa\b|firepower|firewall threat defense|secure firewall/i, "Cisco Adaptive Security Appliance"),
  edge(E("SonicWall", "vendor-family", ["SonicWall"], /sonicos|sma|firewall/i, "SonicWall"), { part: "o", vendor: "sonicwall", product: "sonicos", parse: VERSION_PARSERS.sonicos }, /\bsonic(wall|os)\b/i),
  E("Check Point", "vendor-family", ["Check Point"], /security gateway|quantum|multiple products/i, "Check Point Security Gateway"),
  edge(E("Juniper Networks SRX", "software", ["Juniper"], /junos/i, "Junos OS SRX"), { part: "o", vendor: "juniper", product: "junos", parse: VERSION_PARSERS.junos }, /\b(juniper|junos|srx)\b/i),
  edge(E("WatchGuard", "software", ["WatchGuard"], /firebox/i, "WatchGuard Firebox"), { part: "o", vendor: "watchguard", product: "fireware", parse: VERSION_PARSERS.fireware }, /\b(watchguard|firebox|fireware)\b/i),
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

// Web servers named in the free-text "web server software" answer, with the
// version read from the same text (e.g. "nginx 1.24.0 on Ubuntu 22.04").
// Tomcat is checked before Apache HTTP Server ("Apache Tomcat 9.0.85").
// NVD now names nginx under F5 (the old nginx:nginx naming returns nothing).
// kevProductOnly: F5 and Apache have many unrelated products in KEV.
const WEB_SERVERS: { entry: CatalogEntry; detect: RegExp }[] = [
  { entry: { ...E("nginx", "software", ["F5", "Nginx"], /nginx/i, "nginx"), kevProductOnly: true, versionCpe: { part: "a", vendor: "f5", product: "nginx", parse: VERSION_PARSERS.threePart } }, detect: /\bnginx\b(?:[\s/v-]*(\d+\.\d+\.\d+)\b)?/i },
  { entry: { ...E("Apache Tomcat", "software", ["Apache"], /tomcat/i, "Apache Tomcat"), kevProductOnly: true, versionCpe: { part: "a", vendor: "apache", product: "tomcat", parse: VERSION_PARSERS.threePart } }, detect: /\btomcat\b(?:[\s/v-]*(\d+\.\d+\.\d+)\b)?/i },
  { entry: { ...E("Apache HTTP Server", "software", ["Apache"], /http server|httpd/i, "Apache HTTP Server"), kevProductOnly: true, versionCpe: { part: "a", vendor: "apache", product: "http_server", parse: VERSION_PARSERS.threePart } }, detect: /\b(?:apache(?:\s+http(?:\s+server)?)?|httpd)\b(?:[\s/v-]*(\d+\.\d+\.\d+)\b)?/i },
];

const EDGE_CATEGORY = "edge device / firewall";
const WEB_CATEGORY = "web server stack";

export type ResolvedProduct = CatalogEntry & {
  version?: string; // the version the organisation stated (or read from a web server answer)
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
export function resolveProduct(category: string, rawName: string, index: number, rawVersion?: string): ResolvedProduct {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 150);
  const key = `p${index}-${slug(name)}`;
  const stated = (rawVersion ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  const version = stated ? { version: stated } : {};
  const exact = BY_LABEL.get(name.toLowerCase());
  if (exact) return { ...exact, ...version, key, category, name, origin: "catalog" };
  if (category === WEB_CATEGORY) {
    for (const { entry, detect } of WEB_SERVERS) {
      const m = detect.exec(name);
      if (m) return { ...entry, ...(m[1] ? { version: m[1] } : {}), key, category, name, origin: "free-text" };
    }
  }
  if (category === EDGE_CATEGORY) {
    const aliased = CATALOG.find((e) => e.alias && e.alias.test(name));
    if (aliased) return { ...aliased, ...version, key, category, name, origin: "free-text" };
  }
  const contained = CATALOG.find((e) => e.kind !== "managed-service" && e.label.length >= 5 && name.toLowerCase().includes(e.label.toLowerCase()));
  if (contained) return { ...contained, ...version, key, category, name, origin: "free-text" };
  const words = name.split(" ").filter(Boolean);
  const first = words[0] || name;
  if (words.length === 1) {
    return { label: name, kind: "vendor-family", kevVendors: [first], nvdTerm: first, ...version, key, category, name, origin: "free-text" };
  }
  const product = words.slice(1).filter((w) => w.length > 2 && !/^(on|the|and|with|for|running)$/i.test(w));
  return {
    label: name,
    kind: "software",
    kevVendors: [first],
    kevProduct: product.length ? new RegExp(product.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : undefined,
    nvdTerm: words.slice(0, 4).join(" "),
    ...version,
    key,
    category,
    name,
    origin: "free-text",
  };
}

// The exact NVD lookup for a product's stated version, or null when there
// isn't one: no version, a product without verified NVD naming, or text that
// isn't a version of this product. Null means "not compared" - never "clean".
export type VersionTarget = { cpeName: string; version: string };

export function versionLookupFor(p: ResolvedProduct): VersionTarget | null {
  if (!p.version || !p.versionCpe) return null;
  const parsed = p.versionCpe.parse(p.version);
  if (!parsed) return null;
  const { part, vendor, product } = p.versionCpe;
  return { cpeName: `cpe:2.3:${part}:${vendor}:${product}:${parsed.version}:${parsed.update || "*"}:*:*:*:*:*:*`, version: p.version };
}
