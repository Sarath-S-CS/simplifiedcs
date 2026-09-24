// Server-controlled evidence for AI insights (AI-2..AI-5).
//
// The model never supplies links or vulnerability facts on its own: this
// module turns public CISA KEV / NVD data into evidence records with stable
// ids (E1, E2, ...), authoritative URLs, dates and applicability metadata,
// plus an explicit status for every named product and source. The model may
// only cite these ids; the response validator (insights.ts) drops anything
// else. A source outage or an unchecked product is reported as such - never
// as a clean result.
import type { ResolvedProduct } from "./product-catalog.ts";
import type { Cached } from "./public-cache.ts";

export type KevEntry = {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  knownRansomwareCampaignUse?: string;
};

export type NvdVuln = {
  id: string;
  published: string;
  description: string;
  severity: string | null;
  cpes: { criteria: string; vulnerable: boolean; versionEndExcluding?: string; versionEndIncluding?: string; versionStartIncluding?: string }[];
};

export type Match = "product" | "vendor-only";
export type Platform = "Windows" | "macOS" | "Linux" | "iOS" | "Android";
export const PLATFORMS: Platform[] = ["Windows", "macOS", "Linux", "iOS", "Android"];

export type EvidenceRecord = {
  id: string;
  source: "CISA KEV" | "NVD";
  cveId: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string; // KEV dateAdded or NVD published
  retrievedAt: string;
  productKey: string;
  productName: string;
  match: Match;
  platforms: Platform[]; // platforms the advisory is limited to ([] = not stated)
  versionInfo: string | null;
  ransomware: boolean;
  applicability: Applicability;
};

export type Applicability = "potential-match" | "vendor-only" | "platform-not-indicated";

export type SourceStatus =
  | "checked-no-match"
  | "potential-match"
  | "ambiguous-product"
  | "source-unavailable"
  | "not-checked-budget"
  | "not-applicable";

export type ProductStatus = {
  productKey: string;
  name: string;
  category: string;
  kind: ResolvedProduct["kind"];
  kev: SourceStatus;
  nvd: SourceStatus;
  notes: string[];
};

export type EvidenceBundle = { evidence: EvidenceRecord[]; statuses: ProductStatus[]; limitations: string[] };

const CVE_RE = /^CVE-\d{4}-\d{4,}$/;
const MAX_PER_PRODUCT_PER_SOURCE = 3;
const MAX_EVIDENCE = 24;

export function nvdUrl(cveId: string): string {
  return `https://nvd.nist.gov/vuln/detail/${cveId}`;
}

function norm(s: string): string {
  return (s || "").toLowerCase().trim();
}

// Platforms an NVD record is limited to, from its CPE configuration
// (operating-system CPEs, vulnerable or "running on"), falling back to the
// description. [] means the advisory doesn't restrict platform.
export function nvdPlatforms(v: NvdVuln): Platform[] {
  const found = new Set<Platform>();
  for (const c of v.cpes) {
    const parts = c.criteria.split(":");
    if (parts[2] !== "o" && parts[2] !== "a") continue;
    const vendor = parts[3];
    const product = parts[4] || "";
    if (vendor === "apple" && product === "macos") found.add("macOS");
    else if (vendor === "apple" && (product === "iphone_os" || product === "ipados")) found.add("iOS");
    else if (vendor === "microsoft" && product.startsWith("windows")) found.add("Windows");
    else if (vendor === "linux" && product === "linux_kernel") found.add("Linux");
    else if (vendor === "google" && product === "android") found.add("Android");
  }
  if (!found.size) {
    const d = v.description;
    const onlyOn = d.match(/\bon (macOS|Windows|Linux|Android|iOS)\b/i) || d.match(/\bfor (macOS|Windows|Linux|Android|iOS)\b/i);
    if (onlyOn) {
      const p = onlyOn[1].toLowerCase();
      found.add(p === "macos" ? "macOS" : p === "windows" ? "Windows" : p === "linux" ? "Linux" : p === "android" ? "Android" : "iOS");
    }
  }
  return [...found];
}

function nvdVersionInfo(v: NvdVuln): string | null {
  const vul = v.cpes.find((c) => c.vulnerable && (c.versionEndExcluding || c.versionEndIncluding));
  if (!vul) return null;
  if (vul.versionEndExcluding) return `affected versions are before ${vul.versionEndExcluding}${vul.versionStartIncluding ? ` (from ${vul.versionStartIncluding})` : ""}`;
  return `affected versions are up to and including ${vul.versionEndIncluding}`;
}

function applicabilityOf(match: Match, platforms: Platform[], orgPlatforms: Platform[] | null): Applicability {
  if (match === "vendor-only") return "vendor-only";
  if (platforms.length && orgPlatforms && orgPlatforms.length && !platforms.some((p) => orgPlatforms.includes(p))) return "platform-not-indicated";
  return "potential-match";
}

function kevMatchFor(product: ResolvedProduct, e: KevEntry): Match | null {
  const vendors = product.kevVendors.map(norm);
  if (!vendors.length) return null;
  const vp = norm(e.vendorProject);
  if (!vendors.some((v) => v && (vp === v || vp.startsWith(v + " ") || v.startsWith(vp + " ")))) return null;
  if (product.kind === "vendor-family") return "vendor-only";
  return product.kevProduct && product.kevProduct.test(e.product) ? "product" : "vendor-only";
}

function nvdMatchFor(product: ResolvedProduct, v: NvdVuln): Match | null {
  const text = norm(v.description) + " " + v.cpes.map((c) => norm(c.criteria)).join(" ");
  const vendorTokens = (product.kevVendors.length ? product.kevVendors : [product.nvdTerm || product.name]).map((s) => norm(s).split(/\s+/)[0]).filter(Boolean);
  if (!vendorTokens.some((t) => text.includes(t))) return null; // unrelated keyword hit
  if (product.kind === "vendor-family") return "vendor-only";
  return product.kevProduct && product.kevProduct.test(v.description) ? "product" : "vendor-only";
}

type Draft = Omit<EvidenceRecord, "id">;

export type GatherInput = {
  products: ResolvedProduct[];
  orgPlatforms: Platform[] | null;
  loadKev: () => Promise<Cached<KevEntry[]>>;
  searchNvd: (term: string) => Promise<Cached<NvdVuln[]>>;
  maxNvdQueries: number;
  now?: number;
};

export async function gatherEvidence(input: GatherInput): Promise<EvidenceBundle> {
  const retrievedAt = new Date(input.now ?? Date.now()).toISOString();
  const limitations: string[] = [];
  const statuses = new Map<string, ProductStatus>();
  const drafts: Draft[] = [];
  const checkable = input.products.filter((p) => p.kind !== "managed-service");

  for (const p of input.products) {
    statuses.set(p.key, {
      productKey: p.key,
      name: p.name,
      category: p.category,
      kind: p.kind,
      kev: p.kind === "managed-service" ? "not-applicable" : "checked-no-match",
      nvd: p.kind === "managed-service" ? "not-applicable" : "checked-no-match",
      notes: p.kind === "managed-service" ? ["Managed/cloud service: the provider remediates its own vulnerabilities, so public catalogs rarely list customer-actionable items. Not checked."] : [],
    });
  }

  // CISA KEV - one catalog fetch (cached), matched per product.
  if (checkable.length) {
    try {
      const kev = await input.loadKev();
      if (kev.stale) limitations.push(`CISA KEV: live catalog unavailable; used a cached copy from ${kev.fetchedAt}.`);
      for (const p of checkable) {
        const hits = kev.data
          .map((e) => ({ e, m: kevMatchFor(p, e) }))
          .filter((x): x is { e: KevEntry; m: Match } => x.m !== null && CVE_RE.test(x.e.cveID))
          .sort((a, b) => (a.m === b.m ? b.e.dateAdded.localeCompare(a.e.dateAdded) : a.m === "product" ? -1 : 1));
        const st = statuses.get(p.key)!;
        if (hits.some((h) => h.m === "product")) st.kev = "potential-match";
        else if (hits.length) st.kev = "ambiguous-product";
        for (const { e, m } of hits.slice(0, MAX_PER_PRODUCT_PER_SOURCE)) {
          drafts.push({
            source: "CISA KEV",
            cveId: e.cveID,
            title: e.vulnerabilityName,
            summary: e.shortDescription,
            url: nvdUrl(e.cveID),
            publishedAt: e.dateAdded,
            retrievedAt,
            productKey: p.key,
            productName: p.name,
            match: m,
            platforms: [],
            versionInfo: null,
            ransomware: e.knownRansomwareCampaignUse === "Known",
            applicability: applicabilityOf(m, [], input.orgPlatforms),
          });
        }
        if (hits.length > MAX_PER_PRODUCT_PER_SOURCE) st.notes.push(`CISA KEV: ${hits.length - MAX_PER_PRODUCT_PER_SOURCE} older catalog entries for this vendor not shown.`);
      }
    } catch {
      for (const p of checkable) statuses.get(p.key)!.kev = "source-unavailable";
      limitations.push("CISA KEV could not be reached, so no known-exploited check was possible this time.");
    }
  }

  // NVD - bounded number of keyword queries. Products are prioritised so
  // input order can't starve specific products: catalog software first,
  // then free-text software, then vendor families; duplicate terms share a
  // query. Anything beyond the budget is marked, not silently skipped.
  const rank = (p: ResolvedProduct) => (p.kind === "software" ? (p.origin === "catalog" ? 0 : 1) : 2);
  const queue = checkable.filter((p) => p.nvdTerm).sort((a, b) => rank(a) - rank(b));
  const terms: string[] = [];
  for (const p of queue) {
    const t = norm(p.nvdTerm!);
    if (!terms.includes(t) && terms.length < input.maxNvdQueries) terms.push(t);
  }
  const results = new Map<string, Cached<NvdVuln[]> | null>();
  await Promise.all(
    terms.map(async (t) => {
      try {
        results.set(t, await input.searchNvd(t));
      } catch {
        results.set(t, null);
      }
    }),
  );
  let unchecked = 0;
  for (const p of checkable) {
    const st = statuses.get(p.key)!;
    if (!p.nvdTerm) {
      st.nvd = "not-applicable";
      continue;
    }
    const t = norm(p.nvdTerm);
    if (!results.has(t)) {
      st.nvd = "not-checked-budget";
      unchecked++;
      continue;
    }
    const r = results.get(t);
    if (!r) {
      st.nvd = "source-unavailable";
      continue;
    }
    if (r.stale) st.notes.push(`NVD: live search unavailable; used a cached result from ${r.fetchedAt}.`);
    const hits = r.data
      .map((v) => ({ v, m: nvdMatchFor(p, v) }))
      .filter((x): x is { v: NvdVuln; m: Match } => x.m !== null && CVE_RE.test(x.v.id))
      .sort((a, b) => (a.m === b.m ? b.v.published.localeCompare(a.v.published) : a.m === "product" ? -1 : 1));
    if (hits.some((h) => h.m === "product")) st.nvd = "potential-match";
    else if (hits.length) st.nvd = "ambiguous-product";
    for (const { v, m } of hits.slice(0, MAX_PER_PRODUCT_PER_SOURCE)) {
      const platforms = nvdPlatforms(v);
      drafts.push({
        source: "NVD",
        cveId: v.id,
        title: `${v.id}${v.severity ? ` (${v.severity})` : ""}`,
        summary: v.description,
        url: nvdUrl(v.id),
        publishedAt: v.published,
        retrievedAt,
        productKey: p.key,
        productName: p.name,
        match: m,
        platforms,
        versionInfo: nvdVersionInfo(v),
        ransomware: false,
        applicability: applicabilityOf(m, platforms, input.orgPlatforms),
      });
    }
  }
  if (unchecked) limitations.push(`NVD: ${unchecked} named product${unchecked === 1 ? " was" : "s were"} not checked this time (request budget of ${input.maxNvdQueries} searches per report).`);

  // One record per (product, CVE); KEV wins over NVD for the same CVE but
  // inherits NVD's platform/version detail. Newest first within each source.
  const merged = new Map<string, Draft>();
  for (const d of drafts) {
    const k = `${d.productKey}|${d.cveId}`;
    const prev = merged.get(k);
    if (!prev) merged.set(k, d);
    else if (prev.source === "NVD" && d.source === "CISA KEV") merged.set(k, { ...d, platforms: prev.platforms, versionInfo: prev.versionInfo, applicability: applicabilityOf(d.match, prev.platforms, input.orgPlatforms) });
    else if (prev.source === "CISA KEV" && d.source === "NVD" && !prev.platforms.length) merged.set(k, { ...prev, platforms: d.platforms, versionInfo: d.versionInfo, applicability: applicabilityOf(prev.match, d.platforms, input.orgPlatforms) });
  }
  const ordered = [...merged.values()].sort((a, b) => (a.source === b.source ? b.publishedAt.localeCompare(a.publishedAt) : a.source === "CISA KEV" ? -1 : 1));
  if (ordered.length > MAX_EVIDENCE) limitations.push(`${ordered.length - MAX_EVIDENCE} lower-priority advisories were omitted to keep the report focused.`);
  const evidence = ordered.slice(0, MAX_EVIDENCE).map((d, i) => ({ id: `E${i + 1}`, ...d }));
  if (!input.orgPlatforms || !input.orgPlatforms.length) limitations.push("Endpoint operating systems weren't provided, so platform-specific advisories can't be ruled in or out.");
  limitations.push("Installed versions aren't collected, so every advisory below is a prompt to check your version - not a finding that you are vulnerable.");
  return { evidence, statuses: [...statuses.values()], limitations };
}

// ---- raw source parsing (network code lives in the function) ----

export function parseKevCatalog(json: any): KevEntry[] {
  const list = Array.isArray(json?.vulnerabilities) ? json.vulnerabilities : [];
  return list
    .filter((v: any) => v && typeof v.cveID === "string" && typeof v.vendorProject === "string" && typeof v.product === "string")
    .map((v: any) => ({
      cveID: v.cveID,
      vendorProject: String(v.vendorProject).trim(),
      product: String(v.product).trim(),
      vulnerabilityName: String(v.vulnerabilityName || "").slice(0, 300),
      dateAdded: String(v.dateAdded || ""),
      shortDescription: String(v.shortDescription || "").slice(0, 600),
      knownRansomwareCampaignUse: v.knownRansomwareCampaignUse,
    }));
}

export function parseNvdResponse(json: any): NvdVuln[] {
  const list = Array.isArray(json?.vulnerabilities) ? json.vulnerabilities : [];
  return list
    .map((x: any) => x?.cve)
    .filter((c: any) => c && typeof c.id === "string")
    .map((c: any) => {
      const desc = (c.descriptions || []).find((d: any) => d.lang === "en")?.value || "";
      const m = c.metrics || {};
      const severity = m.cvssMetricV40?.[0]?.cvssData?.baseSeverity || m.cvssMetricV31?.[0]?.cvssData?.baseSeverity || m.cvssMetricV30?.[0]?.cvssData?.baseSeverity || null;
      const cpes: NvdVuln["cpes"] = [];
      for (const conf of c.configurations || []) {
        for (const node of conf.nodes || []) {
          for (const cm of node.cpeMatch || []) {
            if (typeof cm.criteria === "string") {
              cpes.push({ criteria: cm.criteria, vulnerable: !!cm.vulnerable, versionEndExcluding: cm.versionEndExcluding, versionEndIncluding: cm.versionEndIncluding, versionStartIncluding: cm.versionStartIncluding });
            }
          }
        }
      }
      return { id: c.id, published: String(c.published || ""), description: String(desc).slice(0, 800), severity, cpes: cpes.slice(0, 40) };
    });
}
