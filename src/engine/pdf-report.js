// The PDF export: a real, programmatically-built document (jsPDF text/layout
// APIs, not a screenshot) so it is selectable, searchable and small. It
// renders the shared report model (./report-model.js) - the same object the
// web report and History use - so the PDF can't disagree with the page.
//
// Pagination rules (test/pdf-report.test.js checks them on generated
// documents):
//   - nothing is drawn below the bottom margin, except the page footer
//   - a section heading is never the last thing on a page (it keeps with
//     at least the first lines of its content)
//   - an item's heading and the start of its body stay together; a block
//     that fits on one page is moved whole rather than split
import { jsPDF } from "jspdf";
import { FUNCTIONS, FUNC_DISPLAY } from "../data/categories.js";
import { WEIGHT_LABELS } from "../data/controls.js";

const PAGE_W = 612; // US Letter, pt
const PAGE_H = 792;
const MARGIN = 48;
const BOTTOM = PAGE_H - MARGIN;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 13;

const COLOR_HEADING = [21, 66, 73];
const COLOR_TEXT = [35, 35, 35];
const COLOR_MUTED = [105, 105, 105];
const COLOR_RULE = [205, 205, 205];
const COLOR_CRITICAL = [168, 43, 43];

// Resolved from src/styles/app.css (the site uses a CSS variable for Protect).
const FUNC_COLORS_RESOLVED = { Govern: "#B48EC7", Identify: "#E0A94A", Protect: "#01A982", Detect: "#6FA8DC", Respond: "#D6685F", Recover: "#3FC7C0" };

// jsPDF's built-in Helvetica covers Latin-1 (WinAnsi) only. Map common
// typographic characters to ASCII and drop anything else, for every string
// - answers and AI text can contain characters the font can't draw.
export function pdfSafe(s) {
  return String(s ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[→⇒]/g, "->")
    .replace(/[•·]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/[^\u0000-ÿ]/g, "");
}

class Writer {
  constructor(doc) {
    this.doc = doc;
    this.y = MARGIN;
    this.pending = null; // a section heading waiting to be placed with its first block
  }
  style({ fontSize = 10, color = COLOR_TEXT, style = "normal" } = {}) {
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(...color);
  }
  // Measured in the font style it will be drawn in: bold is wider, and
  // measuring bold text as regular let long headings run past the margin.
  lines(text, width, fontSize = 10, style = "normal") {
    this.doc.setFont("helvetica", style);
    this.doc.setFontSize(fontSize);
    return this.doc.splitTextToSize(pdfSafe(text), width);
  }
  height(text, width, fontSize = 10, lineHeight = LINE_H, style = "normal") {
    return this.lines(text, width, fontSize, style).length * lineHeight;
  }
  newPage() {
    this.doc.addPage();
    this.y = MARGIN;
  }
  // Moves to a new page unless `needed` points fit below the cursor.
  ensure(needed) {
    if (this.pending) return this.flush(needed);
    if (this.y + needed > BOTTOM) this.newPage();
  }
  // Keeps a block together when it can fit on a page at all.
  keep(needed) {
    if (this.pending) return this.flush(needed);
    if (needed <= BOTTOM - MARGIN) this.ensure(needed);
    else this.ensure(LINE_H * 3);
  }
  // Section headings are drawn lazily, by the first block that follows, so
  // the heading can move to the next page together with that block instead
  // of being left behind at the bottom of this one.
  flush(needed) {
    const title = this.pending;
    this.pending = null;
    const HEAD = 30;
    const room = BOTTOM - MARGIN;
    if (HEAD + needed <= room) this.ensure(HEAD + needed);
    else this.ensure(HEAD + LINE_H * 3);
    this.style({ fontSize: 13, style: "bold", color: COLOR_HEADING });
    this.doc.text(pdfSafe(title).toUpperCase(), MARGIN, this.y);
    this.y += 6;
    this.doc.setDrawColor(...COLOR_RULE);
    this.doc.setLineWidth(1);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 18;
  }
  text(text, { x = MARGIN, width = CONTENT_W, fontSize = 10, lineHeight = LINE_H, style = "normal", color = COLOR_TEXT, after = 0 } = {}) {
    const lines = this.lines(text, width, fontSize, style);
    if (this.pending) this.flush(Math.min(lines.length, 3) * lineHeight);
    this.style({ fontSize, color, style });
    for (const line of lines) {
      this.ensure(lineHeight);
      this.doc.text(line, x, this.y);
      this.y += lineHeight;
    }
    this.y += after;
  }
  rule(gapBefore = 4, gapAfter = 14) {
    this.y += gapBefore;
    this.doc.setDrawColor(...COLOR_RULE);
    this.doc.setLineWidth(0.75);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += gapAfter;
  }
  // Starts a section; the heading is placed with the section's first block.
  section(title) {
    if (this.pending) this.flush(0);
    this.y += 12;
    this.pending = title;
  }
  bar(label, pct, colorHex, note) {
    const barH = 12;
    const labelW = 150;
    const pctW = 110;
    const barX = MARGIN + labelW;
    const barW = CONTENT_W - labelW - pctW;
    this.ensure(barH + 10);
    this.style({ fontSize: 9.5 });
    this.doc.text(pdfSafe(label), MARGIN, this.y + barH - 3);
    this.doc.setFillColor(232, 232, 232);
    this.doc.rect(barX, this.y, barW, barH, "F");
    if (pct !== null && pct > 0) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(colorHex.slice(i, i + 2), 16));
      this.doc.setFillColor(r, g, b);
      this.doc.rect(barX, this.y, (barW * Math.min(100, pct)) / 100, barH, "F");
    }
    this.style({ fontSize: 9, style: "bold" });
    this.doc.text(pdfSafe(note), PAGE_W - MARGIN, this.y + barH - 3, { align: "right" });
    this.y += barH + 8;
  }
}

function pct(n) {
  return n === null || n === undefined ? "n/a" : `${n}%`;
}

function areaNote(a, quick) {
  if (quick) return a.counts.met + a.counts.gap + a.counts.partial + a.counts.unknown ? `${a.counts.gap} not in place, ${a.counts.partial} partly, ${a.counts.unknown} not sure, ${a.counts.met} in place` : "not asked in this screening";
  if (a.coverage === null) return a.applicable ? "not enough answers" : "not applicable";
  return `${a.coverage}%  (${a.known}/${a.applicable} answered)`;
}

function drawAction(w, a, { detailed }) {
  const head = `${a.id}  ${a.title}`;
  const meta = `${a.area} | ${a.critical ? "CRITICAL | " : ""}${WEIGHT_LABELS[a.weight]} | Owner: ${a.role} | Effort: ${a.effortLabel} | Target: ${a.timeframeDays} days`;
  const body = [
    ["Trigger", a.trigger],
    a.criticalReason ? ["Why critical", a.criticalReason] : null,
    detailed && a.rationale ? ["Why it matters", a.rationale] : null,
    a.interim ? ["Interim step", a.interim] : null,
    a.durableFix ? ["Durable fix", a.durableFix] : null,
    ["Evidence it's done", a.evidence],
    detailed && a.technique ? ["MITRE ATT&CK", `${a.technique.id} - ${a.technique.name}`] : null,
    a.csf.length || a.cis.length ? ["References", [a.csf.length ? `NIST CSF 2.0 ${a.csf.join(", ")}` : "", a.cis.length ? `CIS v8.1 ${a.cis.join(", ")}` : ""].filter(Boolean).join("; ")] : null,
  ].filter(Boolean);
  const x = MARGIN + 14;
  const width = CONTENT_W - 14;
  const bodyH = body.reduce((h, [k, v]) => h + w.height(`${k}: ${v}`, width, 9) + 2, 0);
  const headH = w.height(head, CONTENT_W, 10.5, LINE_H, "bold") + w.height(meta, width, 8.5);
  // Heading + meta + at least the first two body lines together; the whole
  // item together when it fits.
  w.keep(headH + Math.min(bodyH, BOTTOM - MARGIN - headH - 1) + 8);
  w.text(head, { fontSize: 10.5, style: "bold", color: a.critical ? COLOR_CRITICAL : COLOR_TEXT });
  w.text(meta, { x, width, fontSize: 8.5, color: COLOR_MUTED, after: 2 });
  for (const [k, v] of body) w.text(`${k}: ${v}`, { x, width, fontSize: 9, after: 2 });
  w.y += 8;
}

// Builds the document without downloading it (so it can be tested).
export function buildAssessmentPdfDoc(report, { aiInsights = null, aiError = null } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const w = new Writer(doc);
  const quick = report.mode === "quick";

  // --- Header ---
  w.style({ fontSize: 22, style: "bold", color: COLOR_HEADING });
  doc.text("SimplifiedCS", MARGIN, w.y);
  w.y += 26;
  w.text(quick ? "Cybersecurity Quick Screening Report" : "Cybersecurity Posture Assessment Report", { fontSize: 13, after: 6 });
  if (report.sample) w.text("EXAMPLE REPORT - fictional organization and answers, not a real assessment.", { fontSize: 10, style: "bold", color: COLOR_CRITICAL, after: 4 });
  if (report.context.companyName) w.text(`Prepared for: ${report.context.companyName}`, { fontSize: 11.5, style: "bold", after: 4 });
  const generated = new Date(report.generatedAt);
  const meta = [
    `Generated: ${generated.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    report.context.requestedBy ? `Requested by: ${report.context.requestedBy}` : null,
    `Industry: ${report.context.industry || "Not specified"}`,
    `Regions: ${report.context.regions.length ? report.context.regions.join(", ") : "Not specified"}`,
    `Reference frameworks: NIST CSF 2.0, CIS Controls v8.1${report.context.frameworks.length ? ` | Also in scope: ${report.context.frameworks.join(", ")}` : ""}`,
    `Mode: ${quick ? "Quick screening" : "Full assessment"} | Methodology ${report.methodologyVersion} | Question set ${report.questionSetVersion}`,
  ].filter(Boolean);
  for (const m of meta) w.text(m, { fontSize: 9.5, color: COLOR_MUTED });
  w.rule(6, 18);

  // --- Verdict ---
  w.section("Reading");
  w.text(report.verdict.label, { fontSize: 18, style: "bold", color: report.verdict.key === "critical-gaps" ? COLOR_CRITICAL : COLOR_HEADING, lineHeight: 22 });
  w.text(report.verdict.summary, { fontSize: 10, after: 6 });
  const o = report.overall;
  if (quick) {
    w.text(`Screening results: ${o.counts.met} in place, ${o.counts.partial} partly in place, ${o.counts.gap} not in place, ${o.counts.unknown} not sure, ${o.counts["not-asked"]} not asked.`, { fontSize: 10, after: 4 });
  } else {
    w.text(`Coverage: ${pct(o.coverage)} of the protection you told us about is in place (weighted by control importance).`, { fontSize: 10 });
    w.text(`Completeness: ${o.known} of ${o.applicable} applicable questions have a definite answer${o.completeness !== null ? ` (${Math.round(o.completeness * 100)}%)` : ""}.`, { fontSize: 10, after: 4 });
  }
  if (!quick) w.text("Coverage measures how much of what was asked is in place - it is not a compliance score, and 100% does not mean risk-free.", { fontSize: 8.5, style: "italic", color: COLOR_MUTED, after: 6 });

  if (report.criticalGaps.length) {
    w.section(`Critical gaps (${report.criticalGaps.length})`);
    for (const c of report.criticalGaps) {
      w.keep(w.height(c.reason, CONTENT_W - 14, 9.5) + LINE_H * 2);
      w.text(`${c.area}: ${c.text}`, { fontSize: 10, style: "bold", color: COLOR_CRITICAL });
      w.text(c.reason, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9.5, after: 6 });
    }
  }
  if (report.verification.length) {
    w.section("Critical controls to verify");
    for (const v of report.verification) w.text(`${v.area}: ${v.text} - answered "Not sure"`, { fontSize: 9.5, after: 3 });
  }

  // --- Areas ---
  w.section(quick ? "Results by area (screening counts)" : "Coverage by area");
  for (const fn of FUNCTIONS) {
    const a = report.areas.find((x) => x.fn === fn);
    if (quick) w.text(`${FUNC_DISPLAY[fn]}: ${areaNote(a, true)}`, { fontSize: 9.5, after: 3 });
    else w.bar(FUNC_DISPLAY[fn], a.coverage, FUNC_COLORS_RESOLVED[fn], areaNote(a, false));
  }

  // --- Action plan ---
  const byId = new Map(report.actions.map((a) => [a.id, a]));
  w.section(`Action plan (${report.actions.length} actions)`);
  w.text("Ranked by risk. Each action lists why it ranks where it does, an interim step, the durable fix, a suggested owner, effort, a target timeframe and the evidence that shows it's done. Timeframes are suggestions, not deadlines.", { fontSize: 8.5, style: "italic", color: COLOR_MUTED, after: 8 });
  if (!report.actions.length) w.text("No actions: every applicable control is in place.", { fontSize: 10, color: COLOR_MUTED });
  for (const days of [30, 60, 90]) {
    const ids = report.plan[days];
    if (!ids.length) continue;
    w.ensure(LINE_H * 6);
    w.text(`Within ${days} days (${ids.length})`, { fontSize: 11.5, style: "bold", color: COLOR_HEADING, after: 4 });
    for (const id of ids) {
      const a = byId.get(id);
      drawAction(w, a, { detailed: a.rank <= 5 });
    }
  }

  // --- Combined findings ---
  if (report.flags.length) {
    w.section(`Combined findings (${report.flags.length})`);
    report.flags.forEach((f, i) => {
      const g = f.guidance;
      const parts = g ? [g.technique ? `MITRE ATT&CK: ${g.technique.id} - ${g.technique.name}` : "Program-level gap (no single ATT&CK technique)", `What could go wrong: ${g.explain}`, g.control ? `Interim step: ${g.control}` : null, g.remediation ? `How to fix it: ${g.remediation}` : null].filter(Boolean) : [];
      const h = w.height(`${i + 1}. ${f.text}`, CONTENT_W, 10) + parts.reduce((s, p) => s + w.height(p, CONTENT_W - 14, 9) + 2, 0);
      w.keep(h + 8);
      w.text(`${i + 1}. ${f.text}`, { fontSize: 10, style: "bold", after: 2 });
      for (const p of parts) w.text(p, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9, after: 2 });
      w.y += 8;
    });
  }

  if (report.contradictions.length) {
    w.section("Answers worth double-checking");
    for (const c of report.contradictions) w.text(`- ${c.text}`, { fontSize: 9.5, after: 4 });
  }
  if (report.informational.length) {
    w.section("Context notes (not scored)");
    for (const n of report.informational) w.text(`- ${n.text}`, { fontSize: 9.5, after: 4 });
  }

  if (report.frameworkRecs.length) {
    w.section("Compliance considerations");
    for (const r of report.frameworkRecs) {
      w.keep(LINE_H * 4);
      w.text(`${r.name} - ${r.summary}`, { fontSize: 10, style: "bold", after: 3 });
      if (r.gaps.length) for (const g of r.gaps) w.text(`Gap: ${g.question} - answered "${g.chosen}" (see ${"A-" + g.id} in the action plan)`, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9, after: 2 });
      if (r.unknown.length) for (const g of r.unknown) w.text(`Not sure: ${g.question}`, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9, after: 2 });
      if (!r.gaps.length && !r.unknown.length) w.text(`No gaps in the ${r.name}-specific questions.`, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9, color: COLOR_MUTED });
      w.y += 8;
    }
    w.text("Pattern-based guidance from your own answers - not a certification audit or legal compliance determination.", { fontSize: 8.5, style: "italic", color: COLOR_MUTED, after: 6 });
  }

  if (report.vendorNotes.length) {
    w.section("Vendor-specific notes");
    for (const v of report.vendorNotes) w.text(`${v.vendor} - ${v.note}`, { fontSize: 9.5, after: 6 });
    w.text("General guidance about named products, written in advance - not a live feed or a check of your versions. Confirm against the vendor's current advisories.", { fontSize: 8.5, style: "italic", color: COLOR_MUTED, after: 6 });
  }

  // --- AI insights, only when requested (or a sample) ---
  if (aiInsights || aiError) drawAi(w, aiInsights, aiError, report);

  // --- Snapshot ---
  w.section("Environment snapshot (self-reported)");
  for (const [k, v] of report.snapshot) {
    const vh = w.height(String(v), CONTENT_W - 182, 9.5);
    w.ensure(vh + 6);
    w.style({ fontSize: 9, style: "bold", color: COLOR_MUTED });
    doc.text(pdfSafe(k), MARGIN, w.y);
    const top = w.y;
    w.text(String(v), { x: MARGIN + 182, width: CONTENT_W - 182, fontSize: 9.5 });
    w.y = Math.max(w.y, top + LINE_H) + 3;
  }

  // --- Limitations + about ---
  w.section("Limitations and method");
  for (const l of report.limitations) w.text(`- ${l}`, { fontSize: 9, after: 3 });
  w.y += 4;
  w.text(
    `Methodology ${report.methodologyVersion}: each answer is graded in place / partly in place / not in place, or recorded as "Not sure" or not applicable (both excluded from coverage). Coverage weights critical controls 3x and high-impact controls 2x. Any critical gap sets the reading to "Critical gaps found" regardless of percentage. Full method: simplifiedcs.net/methodology.`,
    { fontSize: 9, color: COLOR_MUTED, after: 6 }
  );
  w.text(
    "SimplifiedCS is an independent educational project, not affiliated with NIST, CIS, CISA or MITRE. This report is a structured self-assessment from your own answers - not a penetration test, audit, certification or legal advice.",
    { fontSize: 9, color: COLOR_MUTED }
  );

  // --- Footer ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    w.style({ fontSize: 8, color: COLOR_MUTED });
    doc.text(`SimplifiedCS ${quick ? "Quick Screening" : "Assessment"} Report | Methodology ${report.methodologyVersion}`, MARGIN, PAGE_H - 24);
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }

  const slug = (report.context.industry || "General").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "General";
  const filename = `SimplifiedCS-${quick ? "Screening" : "Assessment"}-${slug}-${report.generatedAt.slice(0, 10)}.pdf`;
  return { doc, filename };
}

const SOURCE_STATUS_TEXT = {
  "checked-no-match": "checked - no match",
  "potential-match": "potential match",
  "ambiguous-product": "product too ambiguous to check",
  "source-unavailable": "source unavailable",
  "not-checked-budget": "not checked (lookup limit)",
  "not-applicable": "not applicable (managed service)",
  "not-checked-example": "not checked (example report)",
};

function drawAi(w, ai, error, report) {
  w.section("AI-enhanced insights (AI-generated)");
  if (error) {
    w.text(`AI insights were requested but not produced: ${error}. The rest of this report doesn't depend on them.`, { fontSize: 9.5, after: 6 });
    return;
  }
  const stale = ai.snapshotId && report.snapshotId && ai.snapshotId !== report.snapshotId;
  w.text(
    `${ai.example ? "Illustrative example - no live lookup was run." : `Generated ${new Date(ai.generatedAt).toLocaleString("en-US")} by ${ai.model || "an AI model"} (prompt ${ai.promptVersion || "n/a"}).`}${stale ? " These insights were generated for an earlier version of this report." : ""} AI output can be wrong; every vulnerability item below cites the public record it came from.`,
    { fontSize: 8.5, style: "italic", color: COLOR_MUTED, after: 6 }
  );
  if (ai.sourceStatus?.length) {
    w.text("Products checked", { fontSize: 10.5, style: "bold", after: 2 });
    for (const s of ai.sourceStatus) w.text(`${s.name} (${s.category}): CISA KEV - ${SOURCE_STATUS_TEXT[s.kev] || s.kev}; NVD - ${SOURCE_STATUS_TEXT[s.nvd] || s.nvd}`, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9, after: 2 });
    w.y += 6;
  }
  if (ai.advisories?.length) {
    w.text("Vulnerability advisories", { fontSize: 10.5, style: "bold", after: 2 });
    for (const a of ai.advisories) {
      const ev = a.evidence.map((e) => `${e.cveId} (${e.source}${e.ransomware ? ", known ransomware use" : ""}) ${e.url}`).join("; ");
      w.keep(LINE_H * 5);
      w.text(`${a.productName} - ${a.applicability === "potential-match" ? "potential match" : a.applicability === "vendor-only" ? "vendor match only - product not confirmed" : "platform not indicated"}`, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9.5, style: "bold" });
      w.text(a.summary, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9 });
      w.text(`Verify: ${a.verification}`, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9 });
      w.text(`Sources: ${ev}`, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 8.5, color: COLOR_MUTED, after: 6 });
    }
  }
  if (ai.patterns?.length) {
    w.text("Patterns across your answers", { fontSize: 10.5, style: "bold", after: 2 });
    for (const p of ai.patterns) {
      w.keep(LINE_H * 4);
      w.text(p.finding, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9.5, style: "bold" });
      w.text(p.why, { x: MARGIN + 14, width: CONTENT_W - 14, fontSize: 9, after: 5 });
    }
  }
  if (ai.narrative) {
    w.text("Summary", { fontSize: 10.5, style: "bold", after: 2 });
    w.text(ai.narrative, { fontSize: 9.5, after: 6 });
  }
  for (const l of ai.limitations || []) w.text(`- ${l}`, { fontSize: 8.5, color: COLOR_MUTED, after: 2 });
}

// The button's click handler - builds the document, then downloads it.
export function buildAssessmentPdf(report, opts) {
  const { doc, filename } = buildAssessmentPdfDoc(report, opts);
  doc.save(filename);
}
