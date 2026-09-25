// Server-controlled evidence for AI insights (AI-2..AI-5).
//
// The model never supplies links or vulnerability facts on its own: this
// module turns public CISA KEV / NVD data into evidence records with stable
// ids (E1, E2, ...), authoritative URLs, dates and applicability metadata,
// plus an explicit status for every named product and source. The model may
// only cite these ids; the response validator (insights.ts) drops anything
// else. A source outage or an unchecked product is reported as such - never
// as a clean result.
import { versionLookupFor, type ResolvedProduct } from "./product-catalog.ts";
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
  severity: string | null; // NVD severity, used only to order advisories
};

// affects-stated-version: NVD's exact-version lookup lists the version the
//   organisation stated as affected.
// version-not-listed: a known-exploited item for the product, but NVD's
//   lookup doesn't list the stated version (NVD can lag, and a mistyped
//   version changes the answer - so it stays visible, never "safe").
export type Applicability = "affects-stated-version" | "potential-match" | "version-not-listed" | "vendor-only" | "platform-not-indicated";

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

// NVD's answer to one exact-version lookup: every CVE it lists as affecting
// that version (total may exceed the records returned in one page).
export type NvdVersionResult = { total: number; vulns: NvdVuln[] };

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
  if (product.kevProduct && product.kevProduct.test(e.product)) return "product";
  return product.kevProductOnly ? null : "vendor-only";
}

function nvdMatchFor(product: ResolvedProduct, v: NvdVuln): Match | null {
  const text = norm(v.description) + " " + v.cpes.map((c) => norm(c.criteria)).join(" ");
  const vendorTokens = (product.kevVendors.length ? product.kevVendors : [product.nvdTerm || product.name]).map((s) => norm(s).split(/\s+/)[0]).filter(Boolean);
  if (!vendorTokens.some((t) => text.includes(t))) return null; // unrelated keyword hit
  if (product.kind === "vendor-family") return "vendor-only";
  return product.kevProduct && product.kevProduct.test(v.description) ? "product" : "vendor-only";
}

type Draft = Omit<EvidenceRecord, "id">;

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const severityRank = (s: string | null) => (s && s in SEVERITY_ORDER ? SEVERITY_ORDER[s] : 4);
// Most certain first, for ordering evidence within a source.
const APPLICABILITY_ORDER: Record<Applicability, number> = { "affects-stated-version": 0, "potential-match": 1, "version-not-listed": 2, "platform-not-indicated": 3, "vendor-only": 4 };
const VERSION_LABELS: Applicability[] = ["affects-stated-version", "version-not-listed"];

export type GatherInput = {
  products: ResolvedProduct[];
  orgPlatforms: Platform[] | null;
  loadKev: () => Promise<Cached<KevEntry[]>>;
  searchNvd: (term: string) => Promise<Cached<NvdVuln[]>>;
  lookupNvdVersion: (cpeName: string) => Promise<Cached<NvdVersionResult>>;
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
    if (p.version && p.kind !== "managed-service" && !versionLookupFor(p)) {
      statuses
        .get(p.key)!
        .notes.push(
          p.versionCpe
            ? `Version ${p.version} was not compared: it isn't in the form NVD uses for this product.`
            : `Version ${p.version} was not compared: NVD's exact-version lookup isn't available for this product, so advisories below are prompts to check your version.`,
        );
    }
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
            severity: null,
          });
        }
        if (hits.length > MAX_PER_PRODUCT_PER_SOURCE) st.notes.push(`CISA KEV: ${hits.length - MAX_PER_PRODUCT_PER_SOURCE} older catalog entries for this vendor not shown.`);
      }
    } catch {
      for (const p of checkable) statuses.get(p.key)!.kev = "source-unavailable";
      limitations.push("CISA KEV could not be reached, so no known-exploited check was possible this time.");
    }
  }

  // NVD - a bounded number of queries per report. A product with a stated,
  // supported version gets NVD's exact-version lookup instead of a keyword
  // search (more precise, same cost). Products are prioritised so input
  // order can't starve specific ones: versioned products first, then catalog
  // software, free-text software, vendor families; duplicate queries are
  // shared. Anything beyond the budget is marked, not silently skipped.
  type Query = { kind: "version"; key: string; version: string } | { kind: "keyword"; key: string };
  const queryFor = (p: ResolvedProduct): Query | null => {
    const target = versionLookupFor(p);
    if (target) return { kind: "version", key: target.cpeName, version: target.version };
    return p.nvdTerm ? { kind: "keyword", key: norm(p.nvdTerm) } : null;
  };
  const rank = (p: ResolvedProduct) => (versionLookupFor(p) ? -1 : p.kind === "software" ? (p.origin === "catalog" ? 0 : 1) : 2);
  const queue = checkable.filter((p) => queryFor(p)).sort((a, b) => rank(a) - rank(b));
  const planned = new Map<string, Query>();
  for (const p of queue) {
    const q = queryFor(p)!;
    if (!planned.has(q.key) && planned.size < input.maxNvdQueries) planned.set(q.key, q);
  }
  const keywordResults = new Map<string, Cached<NvdVuln[]> | null>();
  const versionResults = new Map<string, Cached<NvdVersionResult> | null>();
  await Promise.all(
    [...planned.values()].map(async (q) => {
      try {
        if (q.kind === "version") versionResults.set(q.key, await input.lookupNvdVersion(q.key));
        else keywordResults.set(q.key, await input.searchNvd(q.key));
      } catch {
        (q.kind === "version" ? versionResults : keywordResults).set(q.key, null);
      }
    }),
  );
  let unchecked = 0;
  const compared: string[] = [];
  for (const p of checkable) {
    const st = statuses.get(p.key)!;
    const q = queryFor(p);
    if (!q) {
      st.nvd = "not-applicable";
      continue;
    }
    if (!planned.has(q.key)) {
      st.nvd = "not-checked-budget";
      unchecked++;
      continue;
    }

    if (q.kind === "version") {
      const r = versionResults.get(q.key);
      if (!r) {
        st.nvd = "source-unavailable";
        st.notes.push(`NVD: the exact-version lookup for ${q.version} was unavailable, so known-exploited items below aren't matched to your version.`);
        continue;
      }
      if (r.stale) st.notes.push(`NVD: live lookup unavailable; used a cached result from ${r.fetchedAt}.`);
      compared.push(`${p.name} (${q.version})`);
      const { total, vulns } = r.data;
      const listed = new Set(vulns.map((v) => v.id));
      if (vulns.length) {
        st.nvd = "potential-match";
        st.notes.push(`NVD lists ${total} vulnerabilit${total === 1 ? "y" : "ies"} affecting version ${q.version}${total > vulns.length ? ` (${vulns.length} were checked)` : ""}. The most severe are shown.`);
      } else {
        st.nvd = "checked-no-match";
        st.notes.push(`NVD lists no vulnerabilities affecting version ${q.version}. That answer depends on the version being written exactly as the vendor writes it - check it on the device.`);
      }
      // Known-exploited items for this product: does NVD list the stated version?
      for (const d of drafts) {
        if (d.productKey !== p.key || d.source !== "CISA KEV") continue;
        if (listed.has(d.cveId)) Object.assign(d, { match: "product", applicability: "affects-stated-version", versionInfo: `NVD lists version ${q.version} as affected` });
        else if (d.match === "product") Object.assign(d, { applicability: "version-not-listed", versionInfo: `NVD doesn't list version ${q.version} as affected` });
      }
      const ordered = vulns
        .filter((v) => CVE_RE.test(v.id))
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.published.localeCompare(a.published));
      for (const v of ordered.slice(0, MAX_PER_PRODUCT_PER_SOURCE)) {
        const platforms = nvdPlatforms(v);
        const platformMismatch = applicabilityOf("product", platforms, input.orgPlatforms) === "platform-not-indicated";
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
          match: "product",
          platforms,
          versionInfo: `NVD lists version ${q.version} as affected`,
          ransomware: false,
          applicability: platformMismatch ? "platform-not-indicated" : "affects-stated-version",
          severity: v.severity,
        });
      }
      continue;
    }

    const r = keywordResults.get(q.key);
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
        severity: v.severity,
      });
    }
  }
  if (unchecked) limitations.push(`NVD: ${unchecked} named product${unchecked === 1 ? " was" : "s were"} not checked this time (request budget of ${input.maxNvdQueries} searches per report).`);

  // One record per (product, CVE); KEV wins over NVD for the same CVE but
  // inherits NVD's platform/version detail. Newest first within each source.
  // A version-derived label (from the exact-version lookup) is kept over one
  // recomputed from match and platform alone, unless the platform rules it out.
  const combine = (kev: Draft, nvd: Draft): Draft => {
    const platforms = kev.platforms.length ? kev.platforms : nvd.platforms;
    const base = applicabilityOf(kev.match, platforms, input.orgPlatforms);
    const label = VERSION_LABELS.includes(kev.applicability) && base !== "platform-not-indicated" ? kev.applicability : base;
    return { ...kev, platforms, versionInfo: kev.versionInfo ?? nvd.versionInfo, applicability: label, severity: kev.severity ?? nvd.severity };
  };
  const merged = new Map<string, Draft>();
  for (const d of drafts) {
    const k = `${d.productKey}|${d.cveId}`;
    const prev = merged.get(k);
    if (!prev) merged.set(k, d);
    else if (prev.source === "NVD" && d.source === "CISA KEV") merged.set(k, combine(d, prev));
    else if (prev.source === "CISA KEV" && d.source === "NVD") merged.set(k, combine(prev, d));
  }
  // Most certain first (an item NVD lists for the stated version outranks a
  // same-vendor guess, whatever its source); then KEV before NVD; then, for
  // version lookups, the most severe; then newest. The report shows at most
  // six advisories, so this order decides what's in front of the model.
  const ordered = [...merged.values()].sort(
    (a, b) =>
      APPLICABILITY_ORDER[a.applicability] - APPLICABILITY_ORDER[b.applicability] ||
      (a.source === b.source ? 0 : a.source === "CISA KEV" ? -1 : 1) ||
      (a.applicability === "affects-stated-version" && b.applicability === "affects-stated-version" ? severityRank(a.severity) - severityRank(b.severity) : 0) ||
      b.publishedAt.localeCompare(a.publishedAt),
  );
  if (ordered.length > MAX_EVIDENCE) limitations.push(`${ordered.length - MAX_EVIDENCE} lower-priority advisories were omitted to keep the report focused.`);
  const evidence = ordered.slice(0, MAX_EVIDENCE).map((d, i) => ({ id: `E${i + 1}`, ...d }));
  if (!input.orgPlatforms || !input.orgPlatforms.length) limitations.push("Endpoint operating systems weren't provided, so platform-specific advisories can't be ruled in or out.");
  if (compared.length) limitations.push(`Stated versions were compared with NVD's exact-version lookup for: ${compared.join(", ")}. Other advisories are prompts to check your version - not findings that you are vulnerable.`);
  else limitations.push("Installed versions aren't collected, so every advisory below is a prompt to check your version - not a finding that you are vulnerable.");
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

export function parseNvdVersionResponse(json: any): NvdVersionResult {
  const vulns = parseNvdResponse(json);
  const total = Number.isInteger(json?.totalResults) && json.totalResults >= vulns.length ? json.totalResults : vulns.length;
  return { total, vulns };
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
