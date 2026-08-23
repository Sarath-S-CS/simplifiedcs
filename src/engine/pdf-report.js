// PDF-EXPORT-BRIEF.md: a real, programmatically-built report (jsPDF's
// text/layout APIs, not html2canvas) so the output is selectable/
// searchable text, a small file, and a clean light/print layout
// regardless of which theme the site is currently in. Reuses exactly
// the data renderResults() already computed for the on-screen report -
// this module doesn't recompute scoring/flags/vendor-notes itself.
import { jsPDF } from "jspdf";
import { INDUSTRIES } from "../data/industries.js";
import { REGIONS } from "../data/regions.js";
import { FRAMEWORKS } from "../data/frameworks.js";
import { FUNC_DISPLAY } from "../data/categories.js";
// FUNC_COLORS' Protect entry is "var(--accent-signal)" - a CSS custom
// property, meaningless outside a DOM/computed-style context. jsPDF just
// needs real RGB, so this resolves all six to the literal hex values
// currently defined in src/styles/app.css (--accent-signal: #01A982),
// keeping the PDF's bar colors visually consistent with the site's own
// per-function color coding rather than picking new ones.
const FUNC_COLORS_RESOLVED = {
  Govern: "#B48EC7",
  Identify: "#E0A94A",
  Protect: "#01A982",
  Detect: "#6FA8DC",
  Respond: "#D6685F",
  Recover: "#3FC7C0",
};
import { verdictLabel } from "./scoring.js";
import { guidanceForFlag, guidanceForGapItem } from "./mitre-guidance.js";
import { snapshotRows } from "../ui/snapshot.js";

const PAGE_W = 612; // US Letter, pt
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 13;

const COLOR_HEADING = [21, 66, 73];
const COLOR_TEXT = [35, 35, 35];
const COLOR_MUTED = [110, 110, 110];
const COLOR_RULE = [205, 205, 205];

function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function setStyle(doc, { fontSize = 10, color = COLOR_TEXT, style = "normal" } = {}) {
  doc.setFont("helvetica", style);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
}

// Draws left-flowing wrapped text, page-breaking between lines as needed,
// and returns the y position just below the last line drawn.
function drawWrapped(doc, text, x, y, maxWidth, opts = {}) {
  const { lineHeight = LINE_H } = opts;
  setStyle(doc, opts);
  const lines = doc.splitTextToSize(String(text), maxWidth);
  let cy = y;
  for (const line of lines) {
    cy = ensureSpace(doc, cy, lineHeight);
    doc.text(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

function measureWrappedHeight(doc, text, maxWidth, opts = {}) {
  const { fontSize = 10, lineHeight = LINE_H } = opts;
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(String(text), maxWidth).length * lineHeight;
}

function drawSectionHeading(doc, title, y) {
  y = ensureSpace(doc, y, 34);
  setStyle(doc, { fontSize: 13, style: "bold", color: COLOR_HEADING });
  doc.text(title.toUpperCase(), MARGIN, y);
  y += 6;
  doc.setDrawColor(...COLOR_RULE);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 18;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

// One function's score as a horizontal bar: label, a full-width gray
// track, a colored fill proportional to pct, and the number at the end.
// Plain rects, not rounded - a rounded fill at a very low pct would just
// render as a small blob rather than a clean bar.
function drawFunctionBar(doc, label, pct, colorHex, y) {
  const barH = 14;
  const labelW = 150;
  const pctW = 34;
  const barX = MARGIN + labelW;
  const barW = CONTENT_W - labelW - pctW;
  y = ensureSpace(doc, y, barH + 8);

  setStyle(doc, { fontSize: 10, color: COLOR_TEXT });
  doc.text(label, MARGIN, y + barH - 4);

  doc.setFillColor(232, 232, 232);
  doc.rect(barX, y, barW, barH, "F");
  const fillW = Math.max(0, Math.min(barW, (barW * pct) / 100));
  if (fillW > 0) {
    doc.setFillColor(...hexToRgb(colorHex));
    doc.rect(barX, y, fillW, barH, "F");
  }
  doc.setDrawColor(...COLOR_RULE);
  doc.setLineWidth(0.5);
  doc.rect(barX, y, barW, barH, "S");

  setStyle(doc, { fontSize: 10, style: "bold", color: COLOR_TEXT });
  doc.text(`${pct}%`, barX + barW + pctW, y + barH - 4, { align: "right" });

  return y + barH + 9;
}

// A single labeled row: bold-ish label in a fixed-width left column, the
// (possibly wrapped) value in the remaining width, a thin rule under the
// taller of the two, page-breaking the whole row together rather than
// splitting a label from its value across a page boundary.
function drawKeyValueRow(doc, label, value, y) {
  const labelW = 172;
  const valueX = MARGIN + labelW + 10;
  const valueW = CONTENT_W - labelW - 10;
  const rowHeight = Math.max(LINE_H, measureWrappedHeight(doc, value || "-", valueW));
  y = ensureSpace(doc, y, rowHeight + 8);
  setStyle(doc, { fontSize: 9.5, style: "bold", color: COLOR_MUTED });
  doc.text(label, MARGIN, y);
  drawWrapped(doc, value || "-", valueX, y, valueW, { fontSize: 10, color: COLOR_TEXT });
  y += rowHeight + 6;
  doc.setDrawColor(...COLOR_RULE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4);
  return y + 4;
}

// ASSESSMENT-REPORT-DEPTH-BRIEF.md §6/§9: the PDF gets the same five-part
// treatment as the on-screen report (always the "full" shape - a PDF export
// has no Quick/Full rendering distinction of its own to condense for),
// measured as a whole so the block page-breaks as a unit when it fits on a
// fresh page, rather than splitting mid-explanation whenever avoidable.
function measureGuidanceHeight(doc, guidance) {
  if (!guidance) return 0;
  let h = 0;
  if (guidance.traceability) h += measureWrappedHeight(doc, `Why this was flagged: ${guidance.traceability}`, CONTENT_W - 14, { fontSize: 9.5 }) + 4;
  h += LINE_H + 4; // technique line
  h += measureWrappedHeight(doc, `What could go wrong: ${guidance.explain}`, CONTENT_W - 14, { fontSize: 9.5 }) + 4;
  if (guidance.control) h += measureWrappedHeight(doc, `Interim step: ${guidance.control}`, CONTENT_W - 14, { fontSize: 9.5 }) + 4;
  if (guidance.remediation) h += measureWrappedHeight(doc, `How to fix it: ${guidance.remediation}`, CONTENT_W - 14, { fontSize: 9.5 }) + 4;
  if (guidance.reference) h += measureWrappedHeight(doc, `Reference: ${guidance.reference.label} (${guidance.reference.url})`, CONTENT_W - 14, { fontSize: 9.5 }) + 4;
  return h;
}

function drawGuidance(doc, guidance, y) {
  const x = MARGIN + 14;
  const w = CONTENT_W - 14;
  if (guidance.traceability) {
    y = drawWrapped(doc, `Why this was flagged: ${guidance.traceability}`, x, y, w, { fontSize: 9.5, color: COLOR_TEXT }) + 4;
  }
  const techniqueLabel = guidance.technique ? `MITRE ATT&CK: ${guidance.technique.id} - ${guidance.technique.name}` : "Not mapped to a specific ATT&CK technique - this is a program-level gap, not a single attacker technique.";
  y = ensureSpace(doc, y, LINE_H + 4);
  setStyle(doc, { fontSize: 9.5, style: "italic", color: COLOR_MUTED });
  doc.text(techniqueLabel, x, y);
  y += LINE_H + 4;
  y = drawWrapped(doc, `What could go wrong: ${guidance.explain}`, x, y, w, { fontSize: 9.5, color: COLOR_TEXT }) + 4;
  if (guidance.control) y = drawWrapped(doc, `Interim step: ${guidance.control}`, x, y, w, { fontSize: 9.5, color: COLOR_TEXT }) + 4;
  if (guidance.remediation) y = drawWrapped(doc, `How to fix it: ${guidance.remediation}`, x, y, w, { fontSize: 9.5, color: COLOR_TEXT }) + 4;
  if (guidance.reference) y = drawWrapped(doc, `Reference: ${guidance.reference.label} - ${guidance.reference.url}`, x, y, w, { fontSize: 9.5, color: COLOR_MUTED }) + 4;
  return y;
}

function slugify(s) {
  return (s || "General").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "General";
}

// Builds the jsPDF document and returns it (plus the filename it should be
// saved as) without triggering a download - split out from
// buildAssessmentPdf() specifically so it can be tested directly (via
// doc.output(...)) without needing a browser's download machinery, per
// CLAUDE.md's "test before you ship, not just a manual click-through".
// ctx mirrors exactly what renderResults() already has in scope: session,
// funcScores, overall, flags, priorities, vendorNotes, frameworkRecs.
export function buildAssessmentPdfDoc(ctx) {
  const { session, funcScores, overall, flags, priorities, vendorNotes, frameworkRecs } = ctx;
  const answers = session.answers;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN;

  // --- Header ---
  setStyle(doc, { fontSize: 22, style: "bold", color: COLOR_HEADING });
  doc.text("SimplifiedCS", MARGIN, y);
  y += 26;
  setStyle(doc, { fontSize: 13, style: "normal", color: COLOR_TEXT });
  doc.text("Cybersecurity Posture Assessment Report", MARGIN, y);
  y += 22;

  const companyName = (answers.companyName || "").trim();
  const requestedBy = (answers.reportRequestedBy || "").trim();
  if (companyName) {
    setStyle(doc, { fontSize: 11.5, style: "bold", color: COLOR_TEXT });
    doc.text(`Prepared for: ${companyName}`, MARGIN, y);
    y += LINE_H + 6;
  }

  const generatedOn = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const industryLabel = INDUSTRIES.find((i) => i.id === answers.industry)?.label;
  const regionLabels = (answers.regions || []).map((id) => REGIONS.find((r) => r.id === id)?.label).filter(Boolean);
  const countryLabels = answers.countries || [];
  const frameworksAssessed = "NIST CSF 2.0 + CIS Controls v8" + FRAMEWORKS.filter((f) => answers[f.id]).map((f) => " + " + f.name).join("");

  setStyle(doc, { fontSize: 9.5, color: COLOR_MUTED });
  doc.text(`Generated: ${generatedOn}`, MARGIN, y);
  y += LINE_H + 2;
  if (requestedBy) {
    y = drawWrapped(doc, `Requested by: ${requestedBy}`, MARGIN, y, CONTENT_W, { fontSize: 9.5, color: COLOR_MUTED });
  }
  y = drawWrapped(doc, `Industry: ${industryLabel || "Not specified"}`, MARGIN, y, CONTENT_W, { fontSize: 9.5, color: COLOR_MUTED });
  const regionsText = regionLabels.length ? regionLabels.join(", ") + (countryLabels.length ? ` (specific countries: ${countryLabels.join(", ")})` : "") : "Not specified";
  y = drawWrapped(doc, `Regions: ${regionsText}`, MARGIN, y, CONTENT_W, { fontSize: 9.5, color: COLOR_MUTED });
  y = drawWrapped(doc, `Assessed against: ${frameworksAssessed}`, MARGIN, y, CONTENT_W, { fontSize: 9.5, color: COLOR_MUTED });
  y += 6;
  doc.setDrawColor(...COLOR_RULE);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 24;

  // --- Overall score + per-function breakdown ---
  y = drawSectionHeading(doc, "Overall Score", y);
  // ASSESSMENT-REPORT-DEPTH-BRIEF.md §9: same one-time, prominent
  // clarification as the on-screen report - stated once here, not
  // repeated next to every function bar below.
  y = drawWrapped(
    doc,
    "Higher percentages mean a stronger security posture - not compliance completeness, not exposure level. 100% would mean every control this assessment checks for is fully in place; it doesn't mean risk-free.",
    MARGIN,
    y,
    CONTENT_W,
    { fontSize: 9, style: "italic", color: COLOR_MUTED }
  );
  y += 14;
  setStyle(doc, { fontSize: 28, style: "bold", color: COLOR_HEADING });
  doc.text(`${overall}%`, MARGIN, y + 6);
  setStyle(doc, { fontSize: 13, style: "normal", color: COLOR_TEXT });
  doc.text(verdictLabel(overall), MARGIN + 90, y + 4);
  y += 32;
  for (const f of funcScores) {
    y = drawFunctionBar(doc, FUNC_DISPLAY[f.fn], f.pct, FUNC_COLORS_RESOLVED[f.fn], y);
  }
  y += 14;

  // --- Infrastructure snapshot ---
  y = drawSectionHeading(doc, "Infrastructure Snapshot (self-reported)", y);
  for (const [key, value] of snapshotRows(answers)) {
    y = drawKeyValueRow(doc, key, String(value), y);
  }
  y += 10;

  // --- Compounding-risk findings ---
  if (flags.length) {
    y = drawSectionHeading(doc, "Compounding Risk - Patterns Across Steps", y);
    flags.forEach((flag, i) => {
      const guidance = guidanceForFlag(flag, answers);
      const headingText = `${i + 1}. ${flag.text}`;
      const blockHeight = measureWrappedHeight(doc, headingText, CONTENT_W, { fontSize: 10.5 }) + measureGuidanceHeight(doc, guidance) + 14;
      if (blockHeight <= PAGE_H - MARGIN * 2) y = ensureSpace(doc, y, blockHeight);
      y = drawWrapped(doc, headingText, MARGIN, y, CONTENT_W, { fontSize: 10.5, style: "bold", color: COLOR_TEXT });
      y += 3;
      if (guidance) y = drawGuidance(doc, guidance, y);
      y += 10;
    });
  }

  // --- Vendor-specific mitigation notes ---
  if (vendorNotes.length) {
    y = drawSectionHeading(doc, "Vendor-Specific Mitigation Notes", y);
    for (const v of vendorNotes) {
      y = drawWrapped(doc, `${v.vendor} - ${v.note}`, MARGIN, y, CONTENT_W, { fontSize: 10 });
      y += 10;
    }
    y = drawWrapped(
      doc,
      "Illustrative, based on well-documented historical exploitation patterns for named products - not a live feed. This tool intentionally doesn't do vulnerability scanning; treat this as a prompt to check current vendor advisories for your exact version, not a substitute for doing so.",
      MARGIN,
      y,
      CONTENT_W,
      { fontSize: 8.5, style: "italic", color: COLOR_MUTED }
    );
    y += 14;
  }

  // --- Compliance considerations ---
  if (frameworkRecs.length) {
    y = drawSectionHeading(doc, "Compliance Considerations", y);
    for (const r of frameworkRecs) {
      y = drawWrapped(doc, `${r.name} - ${r.summary}`, MARGIN, y, CONTENT_W, { fontSize: 10, style: "bold" });
      y += 3;
      if (r.gaps.length) {
        for (const g of r.gaps) {
          const gapGuidance = guidanceForGapItem(g, answers);
          y = drawWrapped(doc, `Gap: ${g.question} - currently: "${g.chosen}"`, MARGIN + 14, y, CONTENT_W - 14, { fontSize: 9.5 });
          y += 2;
          if (gapGuidance) y = drawGuidance(doc, gapGuidance, y);
          y += 6;
        }
      } else if (r.questionCount) {
        y = drawWrapped(doc, `No gaps flagged in the ${r.name}-specific questions above.`, MARGIN + 14, y, CONTENT_W - 14, { fontSize: 9.5, color: COLOR_MUTED });
      }
      y += 10;
    }
    y = drawWrapped(doc, "This is pattern-based guidance from your own answers, not a certification audit or legal compliance determination.", MARGIN, y, CONTENT_W, {
      fontSize: 8.5,
      style: "italic",
      color: COLOR_MUTED,
    });
    y += 14;
  }

  // --- Priority-ranked action list ---
  y = drawSectionHeading(doc, "Where To Act First, Ranked", y);
  if (priorities.length) {
    priorities.forEach((p, i) => {
      const guidance = guidanceForGapItem(p, answers);
      const headingText = `${String(i + 1).padStart(2, "0")}. ${FUNC_DISPLAY[p.fn]}: ${p.gap}`;
      const blockHeight = measureWrappedHeight(doc, headingText, CONTENT_W, { fontSize: 10.5 }) + measureGuidanceHeight(doc, guidance) + 14;
      if (blockHeight <= PAGE_H - MARGIN * 2) y = ensureSpace(doc, y, blockHeight);
      y = drawWrapped(doc, headingText, MARGIN, y, CONTENT_W, { fontSize: 10.5, style: "bold", color: COLOR_TEXT });
      y += 3;
      if (guidance) y = drawGuidance(doc, guidance, y);
      y += 10;
    });
  } else {
    y = drawWrapped(doc, "No priority gaps identified - every assessed question scored at maximum coverage.", MARGIN, y, CONTENT_W, { fontSize: 10, color: COLOR_MUTED });
    y += 10;
  }

  // --- Footer / disclaimer ---
  y = drawSectionHeading(doc, "About This Report", y);
  y = drawWrapped(
    doc,
    "This report is produced by SimplifiedCS, a portfolio project - not affiliated with NIST, CIS, ISO, or CISA. The findings, flags, and priority list above are generated by a rules engine, illustrative pattern-matching based on your own answers - not a live vulnerability feed, a penetration test, or a certification audit. Treat this as a starting point for prioritizing real work, not a substitute for professional security or compliance advice.",
    MARGIN,
    y,
    CONTENT_W,
    { fontSize: 9, color: COLOR_MUTED }
  );

  // --- Page numbers, added last since the total page count isn't known until here ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setStyle(doc, { fontSize: 8, color: COLOR_MUTED });
    doc.text(`SimplifiedCS Assessment Report`, MARGIN, PAGE_H - 24);
    doc.text(`Page ${p} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `SimplifiedCS-Assessment-${slugify(industryLabel)}-${dateSlug}.pdf`;
  return { doc, filename };
}

// The actual button click-handler entry point - builds the doc, then
// triggers the browser download.
export function buildAssessmentPdf(ctx) {
  const { doc, filename } = buildAssessmentPdfDoc(ctx);
  doc.save(filename);
}
