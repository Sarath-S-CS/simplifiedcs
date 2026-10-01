// Captures a real, fully-rendered HTML snapshot of every route into a flat
// <route>.html file at the repo root - e.g. methodology.html,
// case-studies.html, assessment/sample.html. Netlify serves a literal file
// over the _redirects catch-all (/* /index.html 200) automatically, so
// these snapshots become what crawlers and link-preview bots (LinkedIn,
// Slack, WhatsApp, iMessage, Facebook, X - none of which execute
// JavaScript) see instead of the empty <div id="tabContent"></div> the raw
// SPA shell serves today. Real users are unaffected: the snapshot still
// carries the same inline JS bundle, which runs immediately and re-renders
// the tab exactly as the live SPA always has.
//
// Deliberately flat files, NOT <route>/index.html - an earlier version
// used that directory form, and live Netlify hosting (confirmed directly,
// not assumed - local testing never caught this since scripts/serve.js has
// no redirect logic at all) 301-redirects a bare request for an existing
// directory to its own trailing-slash form before anything else gets a
// say, e.g. /methodology -> /methodology/. Every prerendered page's own
// canonical tag pointed at the bare (pre-redirect) URL, so Google saw a
// page that redirects away from the exact URL it claims is canonical -
// Search Console's real "Duplicate without user-selected canonical" cause.
// Netlify's clean-URL resolution tries <path>.html before <path>/index.html
// for a request with no extension, so a flat file gets served directly at
// the bare URL with no redirect at all - the same reason the homepage
// (plain index.html, never a directory) never had this problem.
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

// Mirrors the ROUTES map in src/router.js - kept in sync by hand since this script
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
  "/privacy": "privacy",
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

// The app is a module script referenced by URL (scripts/build.js), so a
// snapshot never contains the bundle itself. Scripts the app injected at
// runtime (on-demand chunks, modulepreload hints) are dropped so each
// snapshot loads exactly what index.html loads.
function externalizeBundle(html) {
  return html.replace(/<link rel="modulepreload"[^>]*>/g, "");
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
  // (see src/pages/news.js and src/pages/case-studies.js) - a bare
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
    // Per-visitor UI (the analytics choice banner, screen-reader status
    // region) must never be baked into a static snapshot.
    html = await page.evaluate(() => {
      document.querySelectorAll("#cookieBanner, #sr-status").forEach((el) => el.remove());
      return document.documentElement.outerHTML;
    });
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
  // e.g. "/methodology" -> "methodology.html" (flat, at the repo root);
  // "/assessment/sample" -> "assessment/sample.html" (flat file inside the
  // assessment/ directory - that directory has no index.html of its own,
  // so bare /assessment still correctly falls through to the SPA shell,
  // unaffected by this route's own snapshot existing one level down).
  const relPath = `${routePath.slice(1)}.html`;
  const dir = path.dirname(path.join(root, relPath));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(root, relPath), html);
  return relPath;
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
