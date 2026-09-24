// Automated accessibility audit (development only - nothing here ships to
// visitors). Starts the local server (scripts/serve.js, which applies the
// production security headers), opens each page and each assessment state in
// headless Chrome, and runs axe-core (Deque) against WCAG 2.2 A/AA rules, in
// both the dark (default) and light themes.
//
// Usage: npm run build && npm run prerender && npm run a11y (CI runs it too).
// Exits non-zero if any WCAG violation is found. Automated checks catch only
// part of what matters - see docs/screen-reader-check.md for the manual pass.
import puppeteer from "puppeteer";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const PORT = 5391;
const BASE = `http://localhost:${PORT}`;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Each scenario: a start path and optional steps run in the page to reach a
// particular state (the assessment is one route with many screens).
// Content pages: the same list scripts/prerender.js renders.
const PAGES = [
  "/", "/methodology", "/maturity-model", "/metrics", "/core-principles", "/what-is-simplifiedcs",
  "/starter-guide", "/threat-modeling", "/security-tools-repository", "/roadmap", "/runbooks",
  "/exploits", "/case-studies", "/glossary", "/references", "/about", "/privacy", "/history",
];
const openFirstAccordion = () => document.querySelector(".acc-head")?.click();

const SCENARIOS = [
  ...PAGES.map((p) => ({ name: p, path: p, steps: [openFirstAccordion] })),
  { name: "/news (live feed)", path: "/news", settle: 3000 },
  { name: "/playbooks (accordion open)", path: "/playbooks", steps: [openFirstAccordion] },
  { name: "assessment landing", path: "/assessment" },
  { name: "example report", path: "/assessment/sample", steps: [() => document.querySelector(".action-card .acc-head")?.click()] },
  { name: "quick: scope", path: "/assessment", steps: [() => document.getElementById("modeQuick").click()] },
  {
    name: "quick: setup screen",
    path: "/assessment",
    steps: [
      () => document.getElementById("modeQuick").click(),
      () => document.querySelector('input[name="industry"][value="saas"]').click(),
      () => document.getElementById("scopeNext").click(),
    ],
  },
  {
    name: "full: team screen (checkboxes, other text)",
    path: "/assessment",
    steps: [
      () => document.getElementById("modeFull").click(),
      () => document.querySelector('input[name="industry"][value="saas"]').click(),
      () => document.getElementById("scopeNext").click(),
      () => document.querySelector('input[name="p-employeeCount"]').click(),
      () => document.getElementById("nextBtn").click(),
      () => document.querySelector('input[name="p-teamDedicated"]').click(),
    ],
  },
  {
    name: "quick: report with consent panel",
    path: "/assessment",
    steps: [
      () => document.getElementById("modeQuick").click(),
      () => document.querySelector('input[name="industry"][value="saas"]').click(),
      () => document.getElementById("scopeNext").click(),
      // Answer every visible question with its first option, screen by screen.
      async () => {
        for (let guard = 0; guard < 20 && document.getElementById("nextBtn"); guard++) {
          for (;;) {
            const name = [...new Set([...document.querySelectorAll("input[type=radio]")].map((i) => i.name))].find((n) => !document.querySelector(`input[name="${n}"]:checked`));
            if (!name) break;
            document.querySelector(`input[name="${name}"]`).click();
            await new Promise((r) => setTimeout(r, 30));
          }
          document.getElementById("nextBtn").click();
          await new Promise((r) => setTimeout(r, 150));
        }
      },
      () => document.querySelector(".action-card .acc-head")?.click(),
    ],
  },
];

async function audit(browser, scenario, theme) {
  const page = await browser.newPage();
  await page.setBypassCSP(true); // lets the audit inject axe; the site itself keeps its CSP
  await page.setViewport({ width: 1280, height: 900 });
  // Reduced motion shows every tile at once (otherwise tiles below the fold
  // stay transparent until scrolled to, and axe would skip them).
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.evaluateOnNewDocument((t) => {
    try {
      localStorage.setItem("simplifiedcs:theme", t);
      localStorage.setItem("simplifiedcs:consent:analytics", "denied"); // keep the banner out of every page but one
    } catch {}
  }, theme);
  await page.goto(BASE + scenario.path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#tabContent > *", { timeout: 15000 });
  await wait(scenario.settle || 500);
  for (const step of scenario.steps || []) {
    await page.evaluate(step);
    await wait(250);
  }
  // Measure final colours, not a frame of a fade or colour transition.
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;}" });
  await wait(100);
  await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => {
        const d = n.any[0]?.data;
        // For contrast failures, show the colours and ratio - that's what a fix needs.
        const detail = d?.contrastRatio ? ` (${d.fgColor} on ${d.bgColor}: ${d.contrastRatio}, needs ${d.expectedContrastRatio})` : "";
        return { target: n.target.join(" ") + detail };
      }),
    }));
  }, TAGS);
  await page.close();
  return results;
}

async function main() {
  const server = spawn(process.execPath, [path.join(root, "scripts/serve.js")], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  await wait(800);
  const browser = await puppeteer.launch();
  let total = 0;
  try {
    for (const theme of ["dark", "light"]) {
      for (const scenario of SCENARIOS) {
        const violations = await audit(browser, scenario, theme);
        total += violations.length;
        console.log(`${violations.length ? "FAIL" : "ok  "}  [${theme}] ${scenario.name}${violations.length ? ` - ${violations.length} rule(s)` : ""}`);
        for (const v of violations) {
          console.log(`        ${v.id} (${v.impact}): ${v.help} - ${v.nodes.length} element(s)`);
          for (const n of v.nodes.slice(0, process.env.A11Y_ALL ? Infinity : 3)) console.log(`          ${n.target}`);
        }
      }
    }
    // The cookie banner, once, in a fresh profile (the runs above stored a
    // choice, which hides the banner).
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setBypassCSP(true);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#cookieBanner", { timeout: 15000 });
    await page.addScriptTag({ path: AXE_PATH });
    const bannerViolations = await page.evaluate(async (tags) => (await window.axe.run("#cookieBanner", { runOnly: { type: "tag", values: tags } })).violations.map((v) => `${v.id}: ${v.help}`), TAGS);
    total += bannerViolations.length;
    console.log(`${bannerViolations.length ? "FAIL" : "ok  "}  cookie banner${bannerViolations.length ? "\n        " + bannerViolations.join("\n        ") : ""}`);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(total ? `\n${total} violation group(s) found.` : "\nNo WCAG 2.2 A/AA violations found by axe-core.");
  process.exitCode = total ? 1 : 0;
}

main();
