// The site uses Cloudflare Web Analytics: a single cookieless beacon loaded
// from head.html, with no app-side analytics code and no consent gate. These
// checks pin that down against the static files so a stray Google Analytics
// reference (script, CSP host, or tracking code) can't creep back in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const HEAD = read("../src/head.html");
const HEADERS = read("../_headers");

// Anything Google-Analytics-shaped. If any of these turn up in the shipped
// head or CSP, the swap to Cloudflare has regressed.
const GA_MARKERS = [/gtag/i, /googletagmanager/i, /google-analytics/i, /analytics\.google/i, /G-M10MSC9BG2/];

test("head loads the Cloudflare Web Analytics beacon, once, with its token", () => {
  const beacons = HEAD.match(/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || [];
  assert.equal(beacons.length, 1, "exactly one Cloudflare beacon script");
  assert.match(HEAD, /data-cf-beacon=/, "beacon carries its data-cf-beacon config");
  assert.match(HEAD, /"token":\s*"1d7d0ef244814887b570a1f2754e0d8b"/, "configured with the site token");
});

test("head has no Google Analytics references", () => {
  for (const re of GA_MARKERS) assert.ok(!re.test(HEAD), `head.html must not reference ${re}`);
});

test("the old gtag-init loader is gone", () => {
  assert.equal(existsSync(new URL("../assets/gtag-init.js", import.meta.url)), false);
});

test("CSP allows the Cloudflare beacon and its reporting endpoint, and no Google hosts", () => {
  const csp = (HEADERS.match(/Content-Security-Policy:[^\n]*/) || [""])[0];
  assert.ok(csp, "a Content-Security-Policy line exists");
  assert.match(csp, /script-src[^;]*https:\/\/static\.cloudflareinsights\.com/, "beacon host allowed in script-src");
  assert.match(csp, /connect-src[^;]*https:\/\/cloudflareinsights\.com/, "reporting host allowed in connect-src");
  for (const re of GA_MARKERS) assert.ok(!re.test(csp), `CSP must not reference ${re}`);
});
