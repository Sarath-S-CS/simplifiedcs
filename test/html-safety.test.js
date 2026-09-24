// The live Supabase feeds (news, exploits, case studies) are scraped or
// model-written text rendered through innerHTML - these helpers are the
// only thing standing between that text and the page, so test the actual
// attack shapes, not just the happy path.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { escapeHtml, safeHttpUrl, sanitizeGuidanceHtml } from "../src/ui/html-safety.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;

test("escapeHtml neutralizes tags, attribute quotes, and ampersands", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.equal(escapeHtml("R&D's"), "R&amp;D&#39;s");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(42), "42");
});

test("safeHttpUrl keeps http(s) links and rejects script-capable schemes", () => {
  assert.equal(safeHttpUrl("https://www.cisa.gov/kev"), "https://www.cisa.gov/kev");
  assert.equal(safeHttpUrl("http://example.com/a b"), "http://example.com/a%20b");
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("  JaVaScRiPt:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(safeHttpUrl(""), null);
  assert.equal(safeHttpUrl(null), null);
});

test("safeHttpUrl output can't break out of a double-quoted attribute", () => {
  const href = safeHttpUrl('https://example.com/x"><script>alert(1)</script>');
  assert.ok(href);
  assert.ok(!href.includes('"') && !href.includes("<") && !href.includes(">"));
});

test("sanitizeGuidanceHtml keeps the real fetch-exploits link shape", () => {
  const input = 'Apply mitigations per vendor instructions (<a href="https://www.cisa.gov/bod-26-04" target="_blank" rel="noopener noreferrer">see guidance</a>) or discontinue use.';
  assert.equal(
    sanitizeGuidanceHtml(input),
    'Apply mitigations per vendor instructions (<a href="https://www.cisa.gov/bod-26-04" target="_blank" rel="noopener noreferrer">see guidance</a>) or discontinue use.'
  );
});

test("sanitizeGuidanceHtml strips executable markup but keeps readable text", () => {
  assert.equal(sanitizeGuidanceHtml('Patch now <img src=x onerror="alert(1)"> today'), "Patch now  today");
  assert.equal(sanitizeGuidanceHtml("<script>alert(1)</script>Update"), "Update");
  assert.equal(sanitizeGuidanceHtml('<b onclick="x()">Bold</b> text'), "Bold text");
  assert.equal(sanitizeGuidanceHtml('<a href="javascript:alert(1)">click</a>'), "click");
  assert.equal(sanitizeGuidanceHtml('<a href="https://ok.example/" onclick="x()">ok</a>'), '<a href="https://ok.example/" target="_blank" rel="noopener noreferrer">ok</a>');
});

test("sanitizeGuidanceHtml re-escapes decoded entities instead of reviving them", () => {
  assert.equal(sanitizeGuidanceHtml("versions &lt;script&gt; &amp; earlier"), "versions &lt;script&gt; &amp; earlier");
});
