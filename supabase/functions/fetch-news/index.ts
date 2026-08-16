// Scheduled by .github/workflows/fetch-news.yml (a thin GitHub Action that
// just POSTs here - all the real work happens inside Supabase, so content
// updates never touch the Netlify build pipeline). Pulls from CISA's KEV
// catalog, NVD, and two security RSS feeds, scores each item by
// actively-exploited status / CVSS severity / source authority / recency,
// upserts into news_items, then trims to the top-N by priority so the table
// doesn't grow unbounded.
//
// Writes with the service-role key (auto-provisioned to every Edge
// Function - see Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') below), which
// bypasses RLS. The public only ever gets read access (see the "Public read
// access" policy in the news_items migration).

import { createClient } from "npm:@supabase/supabase-js@2";

const RETENTION_CAP = 75;
const CATEGORY_FLOOR = 10; // reserve up to this many of each category before filling remaining slots by pure priority - otherwise high-CVSS vuln items (which score far higher than narrative RSS content) crowd out ai/ot/landscape entirely
const MIN_RUN_INTERVAL_HOURS = 20; // cheap abuse guard - see checkRateLimit()
const CATEGORIES = ["vuln", "ot", "ai", "landscape"];

const OT_KEYWORDS = [
  "siemens", "rockwell", "allen-bradley", "schneider electric", "honeywell",
  "abb ", "emerson", "ge vernova", "yokogawa", "mitsubishi electric",
  "scada", " ics ", " plc ", "industrial control", "programmable logic controller",
];
const AI_PATTERN = /\b(ai|artificial intelligence|llm|large language model|agentic|chatbot|genai|generative ai)\b/i;
const VULN_PATTERN = /\b(cve-|vulnerability|vulnerabilities|exploit|patch|flaw|rce|zero-day|0-day|remote code execution)\b/i;

function detectOt(text: string): boolean {
  const lower = text.toLowerCase();
  return OT_KEYWORDS.some((k) => lower.includes(k));
}

function categorize(title: string, body: string): string {
  const text = `${title} ${body}`;
  if (AI_PATTERN.test(text)) return "ai";
  if (detectOt(text)) return "ot";
  if (VULN_PATTERN.test(text)) return "vuln";
  return "landscape";
}

function recencyBonus(dateStr: string, maxBonus: number, decayDays: number): number {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
  return Math.max(0, maxBonus * (1 - days / decayDays));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

// KEV_NEWS_LIMIT is deliberately small: this feed is meant to surface a
// curated handful of genuinely notable exploited-vulnerability items as
// news-style context, not the full KEV catalog - that's what the dedicated
// Exploits tab is for (see supabase/functions/fetch-exploits). Before this
// was capped, both tabs independently pulled the same ~40 raw KEV entries
// with the same embedded mitigation text, which read as duplicated content
// once Exploits existed. Selecting the top N *by this feed's own priority
// score* (not just most-recent) means what actually surfaces here is
// ransomware-linked or freshly-added, the same signal already used to rank
// the rest of the News feed.
const KEV_NEWS_LIMIT = 8;
const KEV_POOL_SIZE = 60; // broader pool to rank within before taking the curated top N

async function fetchKev() {
  const res = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json");
  if (!res.ok) throw new Error(`CISA KEV fetch failed: ${res.status}`);
  const data = await res.json();
  const pool = (data.vulnerabilities ?? [])
    .sort((a: any, b: any) => b.dateAdded.localeCompare(a.dateAdded))
    .slice(0, KEV_POOL_SIZE);
  const scored = pool.map((v: any) => {
    const isRansomware = v.knownRansomwareCampaignUse === "Known";
    const priority = 75 + (isRansomware ? 15 : 0) + recencyBonus(v.dateAdded, 10, 30);
    return { v, isRansomware, priority };
  });
  scored.sort((a, b) => b.priority - a.priority);
  return scored.slice(0, KEV_NEWS_LIMIT).map(({ v, isRansomware, priority }) => {
    // No mitigation/technical detail here by design - that's the Exploits
    // tab's job (see the "See full detail on Exploits" link the client adds
    // for KEV-sourced items). Embedding CISA's full requiredAction text
    // here is exactly what caused this feed and Exploits to show near-
    // identical content for the same CVE.
    const body = truncate(
      `${v.shortDescription}${isRansomware ? " Known to be used in ransomware campaigns." : ""}`,
      500
    );
    return {
      external_id: `cve:${v.cveID}`,
      // CISA's vulnerabilityName already reads as "Vendor Product
      // Vulnerability Type" - prefixing vendorProject/product again just
      // duplicates it (e.g. "SonicWall SMA1000: SonicWall SMA1000 SSRF...").
      headline: v.vulnerabilityName,
      body,
      source: "CISA KEV Catalog",
      source_url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
      category: detectOt(`${v.vendorProject} ${v.product}`) ? "ot" : "vuln",
      published_at: new Date(v.dateAdded).toISOString(),
      priority_score: Math.round(priority),
    };
  });
}

async function fetchNvd() {
  const end = new Date();
  const start = new Date(end.getTime() - 3 * 86_400_000); // last 3 days, overlap covers scheduling drift
  const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
  url.searchParams.set("lastModStartDate", start.toISOString());
  url.searchParams.set("lastModEndDate", end.toISOString());
  url.searchParams.set("resultsPerPage", "50");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NVD fetch failed: ${res.status}`);
  const data = await res.json();
  const out = [];
  for (const entry of data.vulnerabilities ?? []) {
    const cve = entry.cve;
    const metrics = cve.metrics?.cvssMetricV31?.[0] ?? cve.metrics?.cvssMetricV30?.[0] ?? cve.metrics?.cvssMetricV2?.[0];
    const score = metrics?.cvssData?.baseScore;
    if (!score || score < 7.0) continue; // HIGH/CRITICAL only - keep signal high
    const desc = cve.descriptions?.find((d: any) => d.lang === "en")?.value ?? "No description available.";
    const priority = score * 7 + recencyBonus(cve.published, 10, 14);
    out.push({
      external_id: `cve:${cve.id}`,
      headline: `${cve.id}: CVSS ${score.toFixed(1)} vulnerability disclosed`,
      body: truncate(desc, 500),
      source: "NVD",
      source_url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      category: detectOt(desc) ? "ot" : "vuln",
      published_at: new Date(cve.published).toISOString(),
      priority_score: Math.round(priority),
    });
  }
  return out;
}

function parseRssItems(xml: string, source: string, sourceUrl: string, maxItems: number) {
  const items: any[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of itemBlocks.slice(0, maxItems)) {
    const pick = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      if (!m) return "";
      return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#8217;/g, "'")
        .replace(/&#8220;|&#8221;/g, '"')
        .trim();
    };
    const title = pick("title");
    const link = pick("link");
    const pubDate = pick("pubDate");
    const description = pick("description");
    if (!title || !link || !pubDate) continue;
    const published = new Date(pubDate);
    if (isNaN(published.getTime())) continue;
    const category = categorize(title, description);
    const priority = 35 + recencyBonus(published.toISOString(), 15, 10) + (category === "ai" ? 5 : 0);
    items.push({
      external_id: `rss:${link}`,
      headline: truncate(title, 200),
      body: truncate(description || title, 500),
      source,
      source_url: link,
      category,
      published_at: published.toISOString(),
      priority_score: Math.round(priority),
    });
  }
  return items;
}

async function fetchRss(feedUrl: string, source: string, maxItems: number) {
  const res = await fetch(feedUrl, { headers: { "User-Agent": "SimplifiedCS-NewsFetch/1.0 (+https://simplifiedcs.net)" } });
  if (!res.ok) throw new Error(`RSS fetch failed for ${source}: ${res.status}`);
  const xml = await res.text();
  return parseRssItems(xml, source, feedUrl, maxItems);
}

Deno.serve(async (_req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const rateLimited = await checkRateLimit(supabase);
  if (rateLimited) {
    return Response.json({ skipped: true, reason: "ran within the last day already" });
  }

  const results = await Promise.allSettled([
    fetchKev(),
    fetchNvd(),
    fetchRss("https://www.bleepingcomputer.com/feed/", "BleepingComputer", 15),
    fetchRss("https://krebsonsecurity.com/feed/", "Krebs on Security", 15),
  ]);

  const errors: string[] = [];
  const [kev, nvd, bleeping, krebs] = results.map((r, i) => {
    if (r.status === "rejected") {
      errors.push(`source ${i}: ${r.reason}`);
      return [];
    }
    return r.value;
  });

  // KEV first (highest-signal), NVD/RSS with onConflict ignore so a CVE
  // already present via KEV doesn't get downgraded by a plainer NVD entry.
  let inserted = 0;
  if (kev.length) {
    const { error } = await supabase.from("news_items").upsert(kev, { onConflict: "external_id" });
    if (error) errors.push(`kev upsert: ${error.message}`);
    else inserted += kev.length;
  }
  const rest = [...nvd, ...bleeping, ...krebs];
  if (rest.length) {
    const { error } = await supabase.from("news_items").upsert(rest, { onConflict: "external_id", ignoreDuplicates: true });
    if (error) errors.push(`rest upsert: ${error.message}`);
    else inserted += rest.length;
  }

  // Retention: keep the top N overall by priority, but reserve a floor per
  // category first - otherwise confirmed-exploited/high-CVSS vuln items
  // (which score far higher than narrative RSS content) crowd every other
  // category out of the cap entirely, leaving those filter tabs empty.
  const { data: all } = await supabase
    .from("news_items")
    .select("id, category, priority_score, published_at")
    .order("priority_score", { ascending: false })
    .order("published_at", { ascending: false });
  let deleted = 0;
  if (all && all.length > RETENTION_CAP) {
    const keepIds = new Set<number>();
    for (const cat of CATEGORIES) {
      all.filter((r) => r.category === cat).slice(0, CATEGORY_FLOOR).forEach((r) => keepIds.add(r.id as number));
    }
    for (const r of all) {
      if (keepIds.size >= RETENTION_CAP) break;
      keepIds.add(r.id as number);
    }
    const toDelete = all.filter((r) => !keepIds.has(r.id as number)).map((r) => r.id);
    if (toDelete.length) {
      const { error, count } = await supabase.from("news_items").delete({ count: "exact" }).in("id", toDelete);
      if (error) errors.push(`retention delete: ${error.message}`);
      else deleted = count ?? 0;
    }
  }

  return Response.json({
    fetched: { kev: kev.length, nvd: nvd.length, bleeping: bleeping.length, krebs: krebs.length },
    upserted: inserted,
    deleted,
    errors,
  });
});

// Cheap abuse guard: this function is invoked with the project's public
// anon key (same pattern as the existing keep-alive job - no new secret
// needed), which is enough to pass verify_jwt but is still a key anyone
// could extract from this public repo. Real work (4 external fetches) only
// runs if the most recent fetched_at is more than MIN_RUN_INTERVAL_HOURS
// old, so repeated/malicious invocations are cheap no-ops instead of
// hammering CISA/NVD/RSS sources or burning function time.
async function checkRateLimit(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data } = await supabase
    .from("news_items")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  const hoursSince = (Date.now() - new Date(data.fetched_at).getTime()) / 3_600_000;
  return hoursSince < MIN_RUN_INTERVAL_HOURS;
}
