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
import DOMPurify from "dompurify";

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
// placeholders into real <a> links. That markup is never trusted as-is - it
// goes through DOMPurify (a maintained sanitizer) restricted to exactly what
// the field needs: <a> elements with an http(s) href. Every other element is
// removed (its text kept), every other attribute dropped, and surviving
// links get this site's standard target/rel.
let purifier = null;
function guidancePurifier() {
  if (purifier) return purifier;
  // Bound to whichever window exists at first use (the page, or jsdom in the
  // Node tests), so importing this module never requires a DOM.
  purifier = DOMPurify(globalThis.window);
  purifier.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      const href = safeHttpUrl(node.getAttribute("href"));
      if (!href) {
        node.removeAttribute("href");
        return;
      }
      node.setAttribute("href", href);
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  return purifier;
}

const GUIDANCE_CONFIG = {
  ALLOWED_TAGS: ["a"],
  ALLOWED_ATTR: ["href"],
  ALLOWED_URI_REGEXP: /^https?:\/\//i,
  KEEP_CONTENT: true,
};

export function sanitizeGuidanceHtml(html) {
  const clean = guidancePurifier().sanitize(String(html ?? ""), GUIDANCE_CONFIG);
  // A link whose href was rejected has no destination - unwrap it to text
  // rather than leave a dead, clickable-looking anchor.
  return clean.replace(/<a>([\s\S]*?)<\/a>/g, "$1");
}
