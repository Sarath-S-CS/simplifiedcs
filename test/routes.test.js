// Adding a page touches several lists that can't import each other (the
// router runs in the browser, the prerender script and sitemap don't). These
// checks fail if a page is missing from one of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PAGE_DESCRIPTIONS } from "../src/ui/page-meta.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function routesIn(source, file) {
  const block = /const ROUTES = \{([\s\S]*?)\n\};/.exec(source);
  assert.ok(block, `ROUTES block in ${file}`);
  const entries = [...block[1].matchAll(/^\s*["']?([\w/-]+)["']?\s*:\s*["']([\w/-]+)["']/gm)].map((m) => [m[1], m[2]]);
  assert.ok(entries.length > 5, `parsed ROUTES in ${file}`);
  return entries;
}

// tab id -> path, from the app's router
const appRoutes = Object.fromEntries(routesIn(read("src/router.js"), "src/router.js"));
// path -> tab id, from the prerender script
const prerendered = Object.fromEntries(routesIn(read("scripts/prerender.js"), "scripts/prerender.js"));
const sitemap = new Set([...read("sitemap.xml").matchAll(/<loc>https:\/\/simplifiedcs\.net([^<]*)<\/loc>/g)].map((m) => m[1]));

// Not snapshotted: a feedback page and a stateful wizard have nothing crawlable.
const NOT_PRERENDERED = new Set(["/feedback", "/assessment"]);
// Not in the sitemap: feedback, and history (noindex - it shows this browser's own reports).
const NOT_IN_SITEMAP = new Set(["/feedback", "/history"]);

test("every page has a description for search engines and link previews", () => {
  for (const tab of Object.keys(appRoutes)) assert.ok(PAGE_DESCRIPTIONS[tab], `PAGE_DESCRIPTIONS.${tab}`);
});

test("every page is prerendered under the same tab id", () => {
  for (const [tab, path] of Object.entries(appRoutes)) {
    if (NOT_PRERENDERED.has(path)) continue;
    assert.equal(prerendered[path], tab, `scripts/prerender.js ROUTES["${path}"]`);
  }
});

test("every indexable page is in the sitemap, and the sitemap has no unknown pages", () => {
  const known = new Set([...Object.values(appRoutes), "/assessment/sample"]);
  for (const path of Object.values(appRoutes)) {
    if (!NOT_IN_SITEMAP.has(path)) assert.ok(sitemap.has(path), `sitemap.xml has ${path}`);
  }
  for (const path of sitemap) assert.ok(known.has(path), `sitemap.xml entry ${path} is a real page`);
});
