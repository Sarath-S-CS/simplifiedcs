// PDF export, checked on the generated document itself: every page's text
// is parsed back out of the PDF (jsPDF writes uncompressed content streams),
// so these assertions are about where text actually landed on each page -
// not just that a file was produced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAssessmentPdfDoc } from "../src/engine/pdf-report.js";
import { buildReport } from "../src/engine/report-model.js";
import { SAMPLE_SCENARIOS } from "../src/data/sample-scenario.js";
import { runScenario, WEAK_ANSWERS, bestAnswer } from "./helpers/scenarios.js";
import { jsPDF } from "jspdf";

// jsPDF registers the standard Helvetica faces in this order.
const FONT_STYLE = { F1: "normal", F2: "bold", F3: "italic", F4: "bolditalic" };
const measurer = new jsPDF({ unit: "pt", format: "letter" });
function textWidth(text, font, size) {
  measurer.setFont("helvetica", FONT_STYLE[font] || "normal");
  measurer.setFontSize(size);
  return measurer.getTextWidth(text);
}

const PAGE_H = 792;
const BOTTOM = 744;
const FOOTER_Y = 768;

function unescape(s) {
  return s.replace(/\\([()\\])/g, "$1");
}

// Returns [{ page, items: [{ y, size, text }] }] with y measured from the top.
function pages(doc) {
  const out = doc.output();
  const result = [];
  const pageRe = /\/Type \/Page\n[\s\S]*?stream\n([\s\S]*?)endstream/g;
  let m;
  while ((m = pageRe.exec(out))) {
    const items = [];
    const textRe = /\/(F\d+) ([\d.]+) Tf[\s\S]*?([\d.-]+) ([\d.-]+) Td\n\(((?:\\.|[^\\)])*)\) Tj/g;
    let t;
    while ((t = textRe.exec(m[1]))) items.push({ font: t[1], size: Number(t[2]), x: Number(t[3]), y: PAGE_H - Number(t[4]), text: unescape(t[5]) });
    result.push({ page: result.length + 1, items });
  }
  return result;
}

function checkLayout(doc) {
  const ps = pages(doc);
  assert.equal(ps.length, doc.internal.getNumberOfPages());
  for (const p of ps) {
    const body = p.items.filter((i) => Math.abs(i.y - FOOTER_Y) > 1);
    const footer = p.items.filter((i) => Math.abs(i.y - FOOTER_Y) <= 1);
    assert.ok(footer.some((i) => i.text === `Page ${p.page} of ${ps.length}`), `page ${p.page} footer`);
    for (const i of body) assert.ok(i.y <= BOTTOM + 0.5 && i.y >= 40, `page ${p.page}: "${i.text.slice(0, 40)}" drawn at y=${i.y}, outside the margins`);
    for (const i of p.items) {
      const right = i.x + textWidth(i.text, i.font, i.size);
      assert.ok(i.x >= 47.5 && right <= 612 - 48 + 1, `page ${p.page}: "${i.text.slice(0, 50)}" runs from x=${i.x.toFixed(1)} to ${right.toFixed(1)}, outside the side margins`);
    }
    // A section heading (13pt) must be followed by content on the same page.
    body.forEach((i, idx) => {
      if (i.size === 13) assert.ok(body.length - idx - 1 >= 2, `page ${p.page}: heading "${i.text}" is stranded at the bottom of the page`);
    });
  }
  return ps;
}

const allText = (ps) => ps.flatMap((p) => p.items.map((i) => i.text)).join("\n");

function weakReport({ quick = false } = {}) {
  const state = runScenario(WEAK_ANSWERS, { quickMode: quick, scope: { industry: "finance", regions: ["na"], pcidss: true, hipaa: true, companyName: "Example Co (fictional)", reportRequestedBy: "Test Reader" }, fallback: (n) => (n.kind === "scored" ? 0 : undefined) });
  return buildReport(state, { generatedAt: "2026-09-24T12:00:00.000Z" });
}

function strongReport({ quick = false } = {}) {
  const profile = { employeeCount: "1–10", teamDedicated: "Yes, only a dedicated IT team maintaining infrastructure", itOnlyHeadcount: "1–2", dayToDay: ["inhouse-all"], inhouseSocCapability: "Yes, all three in-house", vendorCount: "None", hasAntivirus: "Yes", dlpUsed: "Yes", deployModel: "On-premises only", sdwanUsed: "No", networkArch: "Segmented (VLANs / zones)", externalDevices: "No", externalWebsite: "No", usesContainers: "No", usesVirtualization: "No / cloud-native only", developsSoftware: "No", aiUsage: "No, not currently" };
  const state = runScenario(profile, { quickMode: quick, fallback: bestAnswer });
  return buildReport(state, { generatedAt: "2026-09-24T12:00:00.000Z" });
}

test("long report (worst case, two frameworks): multi-page, nothing outside the margins, no stranded headings", () => {
  const report = weakReport();
  assert.ok(report.actions.length > 30 && report.flags.length >= 8, "fixture exercises a long report");
  const { doc, filename } = buildAssessmentPdfDoc(report);
  const ps = checkLayout(doc);
  assert.ok(ps.length >= 6, `expected a long document, got ${ps.length} pages`);
  const text = allText(ps);
  assert.match(text, /Critical gaps found/);
  assert.match(text, /Prepared for: Example Co \(fictional\)/);
  for (const a of report.actions) assert.ok(text.includes(a.id), `action ${a.id} is in the PDF`);
  assert.match(text, /Within 30 days/);
  assert.match(filename, /^SimplifiedCS-Assessment-Financial-Services-2026-09-24\.pdf$/);
});

test("short report (everything in place): valid, and says there's nothing to do rather than inventing items", () => {
  const report = strongReport();
  assert.equal(report.actions.length, 0);
  const ps = checkLayout(buildAssessmentPdfDoc(report).doc);
  const text = allText(ps);
  assert.match(text, /Strong foundations/);
  assert.match(text, /No actions: every applicable control is in place/);
});

test("Quick screening PDF: says it's a screening, shows counts not a percentage, and lists what wasn't asked", () => {
  const report = weakReport({ quick: true });
  const ps = checkLayout(buildAssessmentPdfDoc(report).doc);
  const text = allText(ps);
  assert.match(text, /Quick Screening Report/);
  assert.match(text, /not asked/);
  assert.doesNotMatch(text, /Coverage: \d+%/);
  assert.match(text, /Quick screening asked \d+ of \d+ baseline controls/);
});

test("'Not sure' and not-applicable answers are reported as such", () => {
  const state = runScenario({ ...WEAK_ANSWERS, mfa: "unknown", emailAuth: "na" }, { scope: { industry: "manufacturing" } });
  const report = buildReport(state);
  const text = allText(checkLayout(buildAssessmentPdfDoc(report).doc));
  assert.match(text, /Find out: Is multi-factor authentication enforced/);
  assert.match(text, /answered "Not sure" and (is|are) excluded from the coverage percentage/);
  assert.doesNotMatch(text, /A-emailAuth/);
});

test("AI section: absent unless requested; success cites evidence; failure is stated; text is PDF-safe", () => {
  const report = weakReport();
  assert.doesNotMatch(allText(pages(buildAssessmentPdfDoc(report).doc)), /AI-ENHANCED INSIGHTS/);

  const ai = {
    schemaVersion: 2,
    generatedAt: "2026-09-24T12:05:00.000Z",
    model: "claude-sonnet-5",
    promptVersion: "insights-2026-09-v2",
    sourceStatus: [{ productKey: "p0-fortinet", name: "Fortinet", category: "edge device / firewall", kind: "vendor-family", kev: "potential-match", nvd: "source-unavailable", notes: [] }],
    advisories: [
      {
        productKey: "p0-fortinet",
        productName: "Fortinet",
        summary: "A fictional test advisory — check the firmware → now.",
        verification: "Compare the installed firmware with the fixed version.",
        applicability: "vendor-only",
        evidence: [{ id: "E1", source: "CISA KEV", cveId: "CVE-2099-0001", title: "Test", url: "https://nvd.nist.gov/vuln/detail/CVE-2099-0001", publishedAt: "2099-01-01", match: "vendor-only", platforms: [], versionInfo: null, ransomware: true }],
      },
    ],
    patterns: [{ finding: "A “pattern”", why: "Because.", basedOn: ["q"] }],
    narrative: "Narrative text.",
    limitations: ["NVD was unavailable during this check."],
  };
  const text = allText(checkLayout(buildAssessmentPdfDoc(report, { aiInsights: ai }).doc));
  assert.match(text, /AI-ENHANCED INSIGHTS/);
  assert.match(text, /CVE-2099-0001 \(CISA KEV, known ransomware use\)/);
  assert.match(text, /vendor match only - product not confirmed/);
  assert.match(text, /A fictional test advisory - check the firmware -> now\./);
  assert.match(text, /A "pattern"/);
  assert.match(text, /NVD - source unavailable/);

  const failed = allText(checkLayout(buildAssessmentPdfDoc(report, { aiError: "the AI service didn't respond in time" }).doc));
  assert.match(failed, /AI insights were requested but not produced: the AI service didn't respond in time/);
});

test("example reports are labelled as fictional in the PDF", () => {
  const sample = SAMPLE_SCENARIOS.saas;
  const state = runScenario(sample.answers, { scope: { industry: "saas", regions: ["eu", "na"], soc2: true, gdpr: true, companyName: sample.answers.companyName } });
  const report = buildReport(state, { sample: sample.id });
  const text = allText(checkLayout(buildAssessmentPdfDoc(report, { aiInsights: sample.ai }).doc));
  assert.match(text, /EXAMPLE REPORT - fictional organization/);
  assert.match(text, /not checked \(example report\)/);
});
