// SEC-1 end-to-end: third-party feed content goes through the real ingestion
// code (supabase/functions/fetch-news/parse.ts, fetch-exploits/rows.ts -
// the same files the Edge Functions run) into storage-shaped rows, then
// through the real card templates (src/ui/feed-cards.js) into a DOM. The
// payloads are harmless markers; nothing here touches the network or any
// production table.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { parseRssItems, parseOtDedicatedItems } from "../supabase/functions/fetch-news/parse.ts";
import { buildRow, kevRecordToRawItem } from "../supabase/functions/fetch-exploits/rows.ts";
import { newsCardHtml, exploitCardHtml, caseStudyCardHtml } from "../src/ui/feed-cards.js";
import { sanitizeGuidanceHtml } from "../src/ui/html-safety.js";

let dom;
before(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
});

function render(html) {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

// Nothing in rendered feed markup may be able to run code or load an
// unexpected resource.
function assertInert(host) {
  for (const el of host.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    assert.ok(!["script", "iframe", "object", "embed", "img", "svg", "style", "form", "input", "base", "meta", "link"].includes(tag), `unexpected <${tag}> in ${host.innerHTML.slice(0, 200)}`);
    for (const attr of el.attributes) {
      assert.ok(!/^on/i.test(attr.name), `event-handler attribute ${attr.name} survived`);
      if (attr.name === "href") assert.match(attr.value, /^(https?:\/\/|\/)/i, `unsafe href ${attr.value}`);
      assert.ok(!/javascript:|data:/i.test(attr.value), `script URL in ${attr.name}`);
    }
  }
}

const newsOpts = { categoryLabel: (id) => id, exploitHref: (cve) => `/exploits#exploit-${cve}` };
const rss = (items) => `<?xml version="1.0"?><rss><channel>${items.map((i) => `<item>${i}</item>`).join("")}</channel></rss>`;
const NOW = new Date().toUTCString();

test("encoded tags in an RSS title/description never become markup", () => {
  const xml = rss([
    `<title>Attackers abuse &lt;img src=x onerror=alert(1)&gt; in phishing</title><link>https://news.example.test/a</link><pubDate>${NOW}</pubDate><description>&lt;p onclick="alert(2)"&gt;Ransomware &lt;b&gt;crew&lt;/b&gt;&lt;/p&gt;</description>`,
    `<title>Double-encoded &amp;lt;script&amp;gt;alert(3)&amp;lt;/script&amp;gt; exploit</title><link>https://news.example.test/b</link><pubDate>${NOW}</pubDate>`,
    `<title><![CDATA[<a href="javascript:alert(4)">Breach</a> hits retailer]]></title><link>https://news.example.test/c</link><pubDate>${NOW}</pubDate><description><![CDATA[<img src=x onerror=alert(5)>Data breach details]]></description>`,
    `<title>Malformed <img src=x onerror=alert(6) ransomware</title><link>https://news.example.test/d</link><pubDate>${NOW}</pubDate>`,
  ]);
  const rows = parseRssItems(xml, "Example Feed", 20);
  assert.equal(rows.length, 4, "all four items are security-relevant and should be kept");
  for (const row of rows) {
    const host = render(newsCardHtml({ headline: row.headline, body: row.body, source: row.source, sourceUrl: row.source_url, cat: row.category, publishedAt: row.published_at }, newsOpts));
    assertInert(host);
  }
  // Legitimate text survives, and a literal "<script>" mentioned in a title
  // is shown as text rather than dropped or executed.
  const double = render(newsCardHtml({ headline: rows[1].headline, body: "", source: "x", cat: "vuln", publishedAt: NOW }, newsOpts));
  assert.match(double.querySelector("h4").textContent, /<script>alert\(3\)<\/script>/);
  assert.equal(rows[2].headline, "Breach hits retailer");
});

test("unsafe feed links are dropped at ingestion; odd-but-valid ones are neutralized at render", () => {
  const xml = rss([
    `<title>Ransomware one</title><link>javascript:alert(1)</link><pubDate>${NOW}</pubDate>`,
    `<title>Ransomware two</title><link>data:text/html,&lt;script&gt;alert(2)&lt;/script&gt;</link><pubDate>${NOW}</pubDate>`,
    `<title>Ransomware three</title><link>https://news.example.test/x"&gt;&lt;svg onload=alert(3)&gt;</link><pubDate>${NOW}</pubDate>`,
    `<title>Patch Tuesday fixes zero-days &amp; more</title><link>https://news.example.test/ok</link><pubDate>${NOW}</pubDate>`,
  ]);
  const rows = parseRssItems(xml, "Example Feed", 20);
  assert.deepEqual(rows.map((r) => r.headline), ["Ransomware three", "Patch Tuesday fixes zero-days & more"]);
  for (const row of rows) {
    const host = render(newsCardHtml({ headline: row.headline, body: row.body, source: row.source, sourceUrl: row.source_url, cat: row.category, publishedAt: row.published_at }, newsOpts));
    assertInert(host);
    assert.equal(host.querySelectorAll("a").length, 1, "the source link still renders");
  }
  const ok = render(newsCardHtml({ headline: rows[1].headline, body: "", source: "Example Feed", sourceUrl: rows[1].source_url, cat: "vuln", publishedAt: NOW }, newsOpts));
  assert.equal(ok.querySelector("a").getAttribute("href"), "https://news.example.test/ok");
  assert.equal(ok.querySelector("h4").textContent, "Patch Tuesday fixes zero-days & more");
});

test("OT-dedicated feed items get the same treatment", () => {
  const xml = rss([`<title>&lt;iframe src=//evil.example.test&gt;&lt;/iframe&gt;ICS advisory</title><link>https://www.cisa.gov/news-events/ics-advisories/icsa-00-000-00</link><pubDate>${NOW}</pubDate>`]);
  const rows = parseOtDedicatedItems(xml, "CISA ICS Advisories", 10, "/news-events/ics-advisories/");
  assert.equal(rows.length, 1);
  assertInert(render(newsCardHtml({ headline: rows[0].headline, body: rows[0].body, source: rows[0].source, sourceUrl: rows[0].source_url, cat: "ot", publishedAt: NOW }, newsOpts)));
});

test("CISA KEV fields and notes links are escaped/validated before storage and again at render", () => {
  const kev = {
    cveID: "CVE-0000-0001",
    vendorProject: "Example<script>alert(1)</script>",
    product: "Widget",
    vulnerabilityName: "Widget <img src=x onerror=alert(2)> Remote Code Execution",
    shortDescription: "Remote code execution in Widget.",
    requiredAction: "Apply mitigations <b onclick=alert(3)>now</b> (see URL in Notes) or discontinue (see URL in Notes).",
    // A quote-breaking URL with no spaces does get extracted as a link
    // candidate (the dangerous case); the javascript: entry never matches.
    notes: 'BOD 26-04: https://www.cisa.gov/bod"><svg/onload=alert(4)>; Vendor: javascript:alert(5)',
    dateAdded: "2026-09-01",
    knownRansomwareCampaignUse: "Unknown",
  };
  const row = buildRow(kevRecordToRawItem(kev), new Map());
  // Storage-shaped row: safe_guidance's only markup is our own link.
  assert.ok(!/<(img|b|script|svg)\b/i.test(row.safe_guidance), row.safe_guidance);
  assert.match(row.safe_guidance, /<a href="https:\/\/www\.cisa\.gov\/bod%22%3E%3Csvg\/onload=alert\(4\)%3E" target="_blank" rel="noopener noreferrer">see guidance<\/a>/);
  assert.equal((row.safe_guidance.match(/<a /g) || []).length, 1, "the javascript: note never became a link");
  const host = render(exploitCardHtml(row));
  assertInert(host);
  assert.equal(host.querySelector(".exploit-safety a").getAttribute("rel"), "noopener noreferrer");
  assert.match(host.querySelector("h4").textContent, /<img src=x onerror=alert\(2\)>/, "the name is shown as text");
});

test("a tampered stored row can't smuggle markup through safe_guidance", () => {
  const tampered = {
    cve_id: 'CVE-0000-0002" onmouseover="alert(1)',
    vendor: "V", product: "P", headline: "H", description: "D", explainer: "E",
    safe_guidance: '<a href="javascript:alert(1)">click</a><img src=x onerror=alert(2)><b onclick="alert(3)">bold</b><a href="https://ok.example.test/" onclick="alert(4)">ok</a><svg><script>alert(5)</script></svg>',
    sectors_impacted: ['<i onmouseover="alert(6)">x</i>'], is_ransomware: "yes", epss_score: "0.5<script>", epss_percentile: null,
    source_url: "javascript:alert(7)", date_added: "2026-09-01", due_date: null,
  };
  const host = render(exploitCardHtml(tampered));
  assertInert(host);
  assert.equal(host.querySelector(".exploit-footer a"), null, "unsafe source link is not rendered");
  const links = host.querySelectorAll(".exploit-safety a");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), "https://ok.example.test/");
  assert.match(host.querySelector(".exploit-safety").textContent, /click.*bold.*ok/s, "text of removed markup is kept");
  assert.equal(host.querySelector(".exploit-ransomware-badge"), null, "only a real boolean shows the badge");
});

test("sanitizeGuidanceHtml keeps the real fetch-exploits link shape", () => {
  const html = 'Apply mitigations (<a href="https://www.cisa.gov/bod-26-04" target="_blank" rel="noopener noreferrer">see guidance</a>) now.';
  assert.equal(sanitizeGuidanceHtml(html), html);
});

test("case-study rows: model-written fields are text, links http(s) only", () => {
  const bad = render(caseStudyCardHtml({ year: "2026", title: "<img src=x onerror=alert(1)>Breach", href: "javascript:alert(2)", sourceName: "<b>x</b>", summaryWhat: "w", summaryHow: "h", summaryImpact: "i", lesson: "l", summarySafeguard: "s" }));
  assertInert(bad);
  assert.equal(bad.querySelector("a"), null);
  const good = render(caseStudyCardHtml({ year: "2026", title: "Real incident", href: "https://www.cisa.gov/advisory", sourceName: "CISA", summaryWhat: "w", summaryHow: "h", summaryImpact: "i", lesson: "l", summarySafeguard: "s" }));
  assert.equal(good.querySelector("a").getAttribute("href"), "https://www.cisa.gov/advisory");
});
