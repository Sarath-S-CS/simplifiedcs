// Pure parsing/scoring for fetch-news: turns feed XML into news_items rows.
// No network, no Deno or Supabase imports - index.ts does the fetching and
// storage, and the Node test suite (test/feed-ingestion.test.js) imports this
// file directly, so the rows the tests inspect are produced by the code that
// ships.
import { pickRssField, isHttpUrl } from "../_shared/feed-text.ts";

export const CATEGORIES = ["vuln", "ot", "ai", "landscape"];

const OT_KEYWORDS = [
  "siemens", "rockwell", "allen-bradley", "schneider electric", "honeywell",
  "abb ", "emerson", "ge vernova", "yokogawa", "mitsubishi electric",
  "scada", " ics ", " plc ", "industrial control", "programmable logic controller",
];
const AI_PATTERN = /\b(ai|artificial intelligence|llm|large language model|agentic|chatbot|genai|generative ai)\b/i;
const VULN_PATTERN = /\b(cve-|vulnerability|vulnerabilities|exploit|patch|flaw|rce|zero-day|0-day|remote code execution)\b/i;
// CONSOLIDATED-WORK-BRIEF.md §1c: categorize() used to fall through to
// "landscape" unconditionally for anything that didn't match AI/OT/VULN -
// not a filter at all, just a default bucket. Confirmed live: BleepingComputer's
// feed is site-wide (Security, Gaming, Deals, general tech...), not a
// security-only feed, so unrelated stories (a Windows gaming bug, a ChatGPT
// outage, an Anthropic pricing change, a piracy sentencing) were landing in
// "Threat Landscape" by default. This is the actual relevance gate that was
// missing - "landscape" now requires a genuine threat/incident signal
// instead of being the catch-all for "matched nothing else."
const LANDSCAPE_PATTERN = /\b(breach(ed)?|hack(ed|er|ing)?|cyberattack|cyber[- ]attack|ransomware|malware|spyware|phishing|threat actor|nation[- ]state|espionage|data leak|data breach|compromised|infosec|cybersecurity|cyber security|security incident|intrusion|backdoor|botnet|ddos|denial[- ]of[- ]service|apt\d|threat intelligence|dark web|extortion|credential stuffing|social engineering|supply chain attack|cybercrime|cyber crime|stolen data|hacktivis|state-sponsored)\b/i;

export function detectOt(text: string): boolean {
  const lower = text.toLowerCase();
  return OT_KEYWORDS.some((k) => lower.includes(k));
}

export function categorize(title: string, body: string): string | null {
  const text = `${title} ${body}`;
  if (AI_PATTERN.test(text)) return "ai";
  if (detectOt(text)) return "ot";
  if (VULN_PATTERN.test(text)) return "vuln";
  if (LANDSCAPE_PATTERN.test(text)) return "landscape";
  return null;
}

export function recencyBonus(dateStr: string, maxBonus: number, decayDays: number): number {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
  return Math.max(0, maxBonus * (1 - days / decayDays));
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export function parseRssItems(xml: string, source: string, maxItems: number) {
  const items: any[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of itemBlocks.slice(0, maxItems)) {
    const pick = (tag: string) => pickRssField(block, tag);
    const title = pick("title");
    const link = pick("link");
    const pubDate = pick("pubDate");
    const description = pick("description");
    if (!title || !link || !pubDate || !isHttpUrl(link)) continue;
    const published = new Date(pubDate);
    if (isNaN(published.getTime())) continue;
    const category = categorize(title, description);
    if (!category) continue; // not security-relevant - see categorize()'s comment
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

// OT-dedicated sources: every item is forced into "ot", bypassing
// categorize()'s relevance gate (see the source list in index.ts for why).
// fallbackBody covers feeds whose items have no <description> at all.
export function parseOtDedicatedItems(xml: string, source: string, maxItems: number, linkMustInclude?: string, fallbackBody?: string) {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const items: any[] = [];
  for (const block of itemBlocks) {
    if (items.length >= maxItems) break;
    const pick = (tag: string) => pickRssField(block, tag);
    const title = pick("title");
    const link = pick("link");
    const pubDate = pick("pubDate");
    const description = pick("description");
    if (!title || !link || !pubDate || !isHttpUrl(link)) continue;
    if (linkMustInclude && !link.includes(linkMustInclude)) continue;
    const published = new Date(pubDate);
    if (isNaN(published.getTime())) continue;
    const priority = 40 + recencyBonus(published.toISOString(), 15, 14);
    items.push({
      external_id: `rss:${link}`,
      headline: truncate(title, 200),
      body: truncate(description || fallbackBody || title, 500),
      source,
      source_url: link,
      category: "ot",
      published_at: published.toISOString(),
      priority_score: Math.round(priority),
    });
  }
  return items;
}
