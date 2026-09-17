// Captures a real, fully-rendered HTML snapshot of every route into
// <route>/index.html at the repo root - e.g. methodology/index.html,
// case-studies/index.html. Netlify serves a literal file over the
// _redirects catch-all (/* /index.html 200) automatically, so these
// snapshots become what crawlers and link-preview bots (LinkedIn, Slack,
// WhatsApp, iMessage, Facebook, X - none of which execute JavaScript) see
// instead of the empty <div id="tabContent"></div> the raw SPA shell
// serves today. Real users are unaffected: the snapshot still carries the
// same inline JS bundle, which runs immediately and re-renders the tab
// exactly as the live SPA always has.
//
// Manual, run alongside `npm run build` - not wired into CI. Re-run it
// after content changes worth re-snapshotting (copy edits, new case
// studies, etc.); news/exploits/case-studies snapshots freeze whatever
// Supabase returned at the moment this ran, same tradeoff as choosing not
// to automate it.
//
// Usage: npm run build && npm run prerender
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import puppeteer from "puppeteer";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE_ORIGIN = "https://simplifiedcs.net";
const PORT = 5299;

// Mirrors src/main.js's ROUTES map - kept in sync by hand since this script
// runs outside the esbuild bundle and can't import app code directly.
const ROUTES = {
  "/": "home",
  "/methodology": "methodology",
  "/maturity-model": "maturity",
  "/metrics": "metrics",
  "/core-principles": "coreprinciples",
  "/what-is-simplifiedcs": "maturitymodel",
  "/starter-guide": "starterguide",
  "/threat-modeling": "threatmodeling",
  "/security-tools-repository": "securitytools",
  "/roadmap": "roadmap",
  "/runbooks": "runbook",
  "/news": "news",
  "/exploits": "exploits",
  "/case-studies": "casestudy",
  "/playbooks": "playbooks",
  "/glossary": "glossary",
  "/references": "references",
  "/about": "about",
  "/history": "history",
  // /assessment/sample is the one sub-state of the assessment tab with a
  // real URL (src/ui/assessment.js's currentPathIsSample()) - fixed,
  // deterministic sample data, so unlike the wizard itself it's a real
  // shareable page worth a snapshot.
  "/assessment/sample": "assessment",
  // /feedback and bare /assessment deliberately excluded - a feedback form
  // and a stateful in-progress wizard have nothing crawlable to gain from a
  // frozen snapshot, same reasoning that already excluded /feedback from
  // sitemap.xml.
};

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain", ".xml": "application/xml" };

function startServer() {
  const server = createServer(async (req, res) => {
    let reqPath = decodeURIComponent(req.url.split("?")[0]);
    if (reqPath === "/") reqPath = "/index.html";
    try {
      const data = await readFile(path.join(root, reqPath));
      res.writeHead(200, { "Content-Type": MIME[path.extname(reqPath)] || "application/octet-stream" });
      res.end(data);
    } catch {
      try {
        const data = await readFile(path.join(root, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    }
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

// Rewrites <title> (belt-and-suspenders - main.js already sets the right
// document.title before this snapshot is taken, so the captured HTML
// should already have it) and <link rel="canonical"> to point at this
// route's own URL rather than the homepage. Every route currently shares
// one canonical tag pointing at "/" - left as-is, a prerendered subpage
// would tell Google it's a duplicate of the homepage and skip indexing it,
// exactly the opposite of the point of prerendering it. Inserts a
// canonical tag if head.html doesn't have one yet.
function setCanonical(html, routePath) {
  const canonicalUrl = `${SITE_ORIGIN}${routePath === "/" ? "/" : routePath}`;
  const canonicalTag = `<link rel="canonical" href="${canonicalUrl}">`;
  if (/<link rel="canonical"[^>]*>/.test(html)) {
    return html.replace(/<link rel="canonical"[^>]*>/, canonicalTag);
  }
  return html.replace(/<title>.*?<\/title>/, (m) => `${m}\n${canonicalTag}`);
}

// build.js inlines the whole ~2.8MB app bundle directly into index.html's
// <script> tag (see assembleHtml()) - captured verbatim, that would
// duplicate the bundle into every one of the 19 snapshot files, ~50MB of
// pure repeated bytes. /assets/app.js is already a real standalone file
// (esbuild's own output), so swapping the huge inline script for a src
// reference gives an identical result at runtime for a fraction of the
// weight. Threshold picks out the bundle specifically, not head.html's
// small inline gtag snippet.
function externalizeBundle(html) {
  return html.replace(/<script>([\s\S]*?)<\/script>/g, (match, body) =>
    body.length > 50000 ? '<script src="/assets/app.js"></script>' : match
  );
}

async function snapshotRoute(browser, routePath) {
  const page = await browser.newPage();
  // Not networkidle0: head.html's gtag.js keeps a connection alive past the
  // first page load, so "0 network connections" never actually happens
  // again after that and navigation just times out. domcontentloaded is
  // enough - the readiness check below is what actually waits for real
  // content, including the async Supabase-backed tabs.
  await page.goto(`http://localhost:${PORT}${routePath}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  // news/exploits/case-studies render a synchronous "Loading the latest…"
  // placeholder into #tabContent *before* their Supabase fetch resolves
  // (see renderNewsTab/renderCaseStudyTab in main.js) - a bare
  // children.length check resolves on that placeholder, not the real data.
  // Wait for the placeholder text to be gone too; tabs with no async fetch
  // satisfy both conditions on their first synchronous render.
  await page.waitForFunction(
    () => {
      const tc = document.getElementById("tabContent");
      return !!tc && tc.children.length > 0 && !tc.textContent.includes("Loading the latest");
    },
    { timeout: 15000 }
  );
  await new Promise((r) => setTimeout(r, 300));
  // Belt-and-suspenders: waitForFunction above has, in practice, resolved
  // once while the captured HTML moments later still showed the loading
  // placeholder (a one-off flake, not reproduced on retry - root cause
  // unconfirmed). Cheap enough to just double-check the actual captured
  // text before trusting it, since this script's whole job is not
  // snapshotting a placeholder.
  let html;
  for (let attempt = 0; attempt < 4; attempt++) {
    html = await page.evaluate(() => document.documentElement.outerHTML);
    if (!html.includes("Loading the latest")) break;
    if (attempt === 3) console.warn(`  WARNING: ${routePath} still shows a loading placeholder after retries`);
    await new Promise((r) => setTimeout(r, 750));
  }
  html = setCanonical(html, routePath);
  html = externalizeBundle(html);
  await page.close();
  return `<!DOCTYPE html>\n${html}\n`;
}

async function writeRoute(routePath, html) {
  if (routePath === "/") {
    await writeFile(path.join(root, "index.html"), html);
    return "index.html";
  }
  const dir = path.join(root, routePath.slice(1));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html);
  return `${routePath.slice(1)}/index.html`;
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch();
  console.log(`Prerendering ${Object.keys(ROUTES).length} routes...`);
  try {
    for (const routePath of Object.keys(ROUTES)) {
      const html = await snapshotRoute(browser, routePath);
      const written = await writeRoute(routePath, html);
      console.log(`  ${routePath.padEnd(30)} -> ${written}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log("Prerender complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
