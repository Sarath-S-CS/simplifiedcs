// Shared output-encoding helpers for every place this app interpolates data
// it didn't author itself into an innerHTML template string. Two sources of
// that exist: assessment answers typed by the visitor (see assessment.js),
// and the live Supabase feeds - news_items, exploit_items, case_studies -
// whose text is scraped from RSS feeds, CISA/VulnCheck/EUVD catalogs, or
// written by a web-searching model (supabase/functions/*). None of those are
// ours to trust, so their text is always escaped at render time and their
// links always pass through safeHttpUrl(). Static, hand-written content in
// src/ (NEWS_ITEMS, CASE_STUDIES, ...) is plain text too, so escaping it
// alongside the live rows is harmless - "&" still renders as "&".

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Only http(s) links survive - a javascript:/data: URL from any of the
// sources above would otherwise execute on click. Returns the URL's own
// serialized form (which percent-encodes quotes and angle brackets), or
// null. Callers still pass the result through escapeHtml() before putting
// it in an attribute - cheap, and it keeps the rule "every interpolation is
// escaped" free of exceptions.
export function safeHttpUrl(url) {
  if (url == null || url === "") return null;
  try {
    const base = typeof location !== "undefined" ? location.href : "https://simplifiedcs.net/";
    const u = new URL(String(url), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// exploit_items.safe_guidance is the one live field that legitimately
// carries markup: fetch-exploits turns CISA's "(see URL in Notes)"
// placeholders into real <a> links. Rather than trusting that markup as-is,
// re-build it from a parse: text nodes are escaped, <a> elements keep only
// a validated http(s) href (and get this site's standard target/rel), and
// every other element is dropped while keeping its text. Parsing happens in
// an inert <template>, so nothing in the input can run or load while it's
// being inspected.
export function sanitizeLinksOnlyHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html ?? "");
  const out = [];
  const walk = (parent) => {
    for (const node of parent.childNodes) {
      if (node.nodeType === 3) {
        out.push(escapeHtml(node.nodeValue));
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toUpperCase();
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE") continue;
        const href = tag === "A" ? safeHttpUrl(node.getAttribute("href")) : null;
        if (href) out.push(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">`);
        walk(node);
        if (href) out.push("</a>");
      }
    }
  };
  walk(tpl.content);
  return out.join("");
}
