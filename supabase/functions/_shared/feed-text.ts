// Text/link handling shared by the feed Edge Functions (fetch-news,
// fetch-exploits). Kept free of Deno/Supabase imports and non-erasable
// TypeScript so the exact same file runs in Deno and is imported directly by
// the Node test suite (test/feed-ingestion.test.js) - the ingestion code the
// tests exercise is the code that ships.
//
// Output contract: every field stored by the feeds is PLAIN TEXT, except
// exploit_items.safe_guidance, which is a small, fully-escaped HTML fragment
// whose only markup is "see guidance" links built here. The site escapes all
// plain-text fields and re-sanitizes safe_guidance at render
// (src/ui/html-safety.js), so neither side trusts the other.

// One decode pass over the entities RSS feeds actually use. &amp; goes LAST,
// so a double-encoded "&amp;lt;" becomes the literal text "&lt;" rather than
// cascading all the way into a real "<".
export function decodeEntities(s: string): string {
  const cp = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");
  return s
    .replace(/&#(\d+);/g, (_m: string, d: string) => cp(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m: string, h: string) => cp(parseInt(h, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// An RSS <title>/<description> is XML text whose content is usually itself
// entity-encoded HTML ("&lt;p&gt;Patch now&lt;/p&gt;"). Unwrap CDATA (raw
// HTML, not entity-encoded) or decode the XML entities, strip the resulting
// tags, then decode the HTML's own entities once. What's left is plain text
// that may still legitimately contain "<" (an article about <script> tags) -
// correct and safe, because it is stored and rendered as text.
export function rssText(raw: string): string {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  const html = cdata ? cdata[1] : decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
  return decodeEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function pickRssField(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? rssText(m[1]) : "";
}

// Links are rendered on the site - only http(s) is ever stored, so a feed
// can't smuggle in a javascript:/data: URL.
export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function httpUrlOrNull(s: string | undefined | null): string | null {
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function escapeHtml(s: unknown): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, (c: string) => map[c]);
}

// CISA's notes field is a semicolon-separated list whose labeled entries look
// like "BOD 26-04: https://...", in the same order as the "(see URL in
// Notes)" placeholders that reference them.
export function extractNotesUrls(notes: string): string[] {
  const urls: string[] = [];
  for (const segment of (notes || "").split(";")) {
    const m = segment.match(/:\s*(https?:\/\/\S+)\s*$/);
    if (m) urls.push(m[1].trim());
  }
  return urls;
}

// Takes and returns HTML: the caller passes requiredAction already escaped,
// and each URL is re-validated as http(s) and attribute-escaped here, since
// extractNotesUrls()'s \S+ would otherwise let a '"' in the notes text break
// out of the href attribute.
export function resolveNotesPlaceholders(requiredActionHtml: string, notes: string): string {
  const urls = extractNotesUrls(notes);
  let i = 0;
  return requiredActionHtml.replace(/\(see URL in Notes\)/gi, () => {
    const url = httpUrlOrNull(urls[i++]);
    return url ? `(<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">see guidance</a>)` : "";
  });
}

// Plain-text required action + optional CISA notes -> the escaped HTML
// fragment stored in exploit_items.safe_guidance's first half.
export function requiredActionHtml(text: string, notes?: string): string {
  const escaped = escapeHtml(text);
  return notes && /\(see URL in Notes\)/i.test(text) ? resolveNotesPlaceholders(escaped, notes) : escaped;
}
