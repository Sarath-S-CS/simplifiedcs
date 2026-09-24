// What an "AI-Enhanced Insights" request contains - built only after the
// visitor has made the explicit AI-processing choice (ai-consent.js), and
// shown to them before sending ("What will be sent").
//
// Included: industry, regions and frameworks; the products named in the
// assessment (to check against public vulnerability data); operating
// systems, if given; the deterministic findings; and each answer as
// question + chosen option + status. Never included: company name, the
// "report requested by" field, or anything typed into the report page.
// The server (netlify/lib/insights.ts) validates this exact shape - unknown
// fields are rejected - so this file and INSIGHTS_REQUEST change together.
import { PROFILE_SCREENS } from "../data/profile-flow.js";
import { visibleNodes } from "./graph.js";
import { effectiveState } from "./answers.js";
import { OTHER } from "../data/vendors.js";

export const AI_PLATFORMS = ["Windows", "macOS", "Linux", "iOS", "Android"];
const SCORED_STATUSES = new Set(["met", "partial", "gap", "unknown", "not-applicable"]);

const clip = (s, max) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
};

// Products named anywhere in the assessment, one entry per distinct name.
export function namedProducts(answers) {
  const msp = [answers.outsourcedMspName, answers.fullMspProviderName, answers.mixedMspProviderName, answers.mdrMspProviderName].find(Boolean);
  const pairs = [
    ["antivirus", answers.antivirusVendor],
    ["EDR", answers.edrVendor],
    ["email security", answers.emailSecurityVendor],
    ["DLP", answers.dlpVendor],
    ["SD-WAN", answers.sdwanVendor],
    ["edge device / firewall", answers.edgeDeviceVendor],
    ["hosting provider", answers.hostingProvider],
    ["cloud provider", answers.cloudProvider],
    ["security awareness / LMS", answers.awarenessLms],
    ["OT/ICS platform", answers.otVendor],
    ["web server stack", answers.webServerStack],
    ["MSP", msp],
    ["MDR", answers.mdrProviderName],
    ["MSSP", answers.msspProviderName],
  ];
  const seen = new Set();
  const out = [];
  for (const [category, raw] of pairs) {
    const name = clip(raw, 150);
    if (!name || name === OTHER || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ category, name });
  }
  return out.slice(0, 20);
}

function profileAnswerText(node, answers) {
  const val = answers[node.id];
  if (node.type === "multiselect") {
    if (!Array.isArray(val) || !val.length) return "";
    const labels = val.filter((id) => id !== OTHER).map((id) => node.options.find((o) => o.id === id)?.label || id);
    const other = val.includes(OTHER) ? (answers[node.id + "__otherText"] || "").trim() : "";
    if (other) labels.push(`Other: ${other}`);
    return labels.join("; ");
  }
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

// Setup-screen answers actually shown on this run.
export function profileAnswerDigest(state) {
  const eff = effectiveState(state);
  const out = [];
  for (const screen of PROFILE_SCREENS) {
    if (screen.skipIf && screen.skipIf(eff.answers)) continue;
    for (const node of visibleNodes(screen.flow, eff)) {
      const a = profileAnswerText(node, eff.answers);
      if (a) out.push({ q: clip(node.text, 300), a: clip(a, 300) });
    }
  }
  return out.slice(0, 80);
}

export function buildInsightsPayload(state, report, { snapshotId, consentVersion }) {
  const a = effectiveState(state).answers;
  const platforms = Array.isArray(a.endpointOs) ? a.endpointOs.filter((p) => AI_PLATFORMS.includes(p)) : [];
  const payload = {
    consent: { version: consentVersion, accepted: true },
    profile: {
      industry: clip(report.context.industry || "Not specified", 100),
      regions: report.context.regions.map((r) => clip(r, 60)).slice(0, 20),
      frameworks: report.context.frameworks.map((f) => clip(f, 60)).slice(0, 20),
      mode: report.mode,
      verdict: clip(report.verdict.label, 80),
    },
    products: namedProducts(a),
    findings: {
      critical: report.criticalGaps.slice(0, 20).map((c) => ({ id: clip(c.id, 80), text: clip(c.reason, 500) })),
      flags: report.flags.slice(0, 30).map((f) => ({ id: clip(f.id, 80), text: clip(f.text, 600) })),
      priorities: report.findings.slice(0, 10).map((f) => ({ id: clip(f.id, 80), area: clip(f.area, 60), gap: clip(f.title, 400) })),
    },
    profileAnswers: profileAnswerDigest(state),
    scoredAnswers: report.controls
      // A control that doesn't apply (hidden by an earlier answer) isn't an
      // answer at all; only an explicit "Not applicable" answer is sent.
      .filter((c) => SCORED_STATUSES.has(c.status) && !(c.status === "not-applicable" && c.chosen === "Not answered"))
      .slice(0, 140)
      .map((c) => ({ area: clip(c.area, 60), q: clip(c.text, 400), a: clip(c.chosen || c.statusLabel, 200), status: c.status })),
  };
  if (snapshotId) payload.snapshotId = snapshotId;
  if (report.overall.coverage !== null) payload.profile.coverage = report.overall.coverage;
  if (platforms.length) payload.platforms = platforms;
  return payload;
}
