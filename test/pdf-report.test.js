// PDF-EXPORT-BRIEF.md: "test with a real completed assessment... to
// confirm the PDF actually renders all sections correctly and page
// breaks don't mangle content, not just that the button produces a
// file." doc.save() needs a browser's download machinery, so this tests
// buildAssessmentPdfDoc() directly via doc.output(...) - real PDF bytes,
// no DOM needed - walking the actual engine (not hand-built fixtures) so
// this exercises the same code path renderResults() does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, visibleNodes } from "../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../src/engine/state.js";
import { ASSESSMENT_FLOW } from "../src/data/assessment-flow.js";
import { TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES } from "../src/data/team-structure.js";
import { ORG_PROFILE_ORDER, ORG_PROFILE_NODES, INFRA_ORDER, INFRA_NODES, DEVSEC_ORDER, DEVSEC_NODES, OT_ORDER, OT_NODES } from "../src/data/profile-questions.js";
import { CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES } from "../src/data/containerization.js";
import { computeFuncScores, computeOverall, computeFlags, computePriorities } from "../src/engine/scoring.js";
import { matchedVendorNotes } from "../src/data/vendor-notes.js";
import { computeFrameworkRecommendations } from "../src/engine/framework-guidance.js";
import { buildAssessmentPdfDoc } from "../src/engine/pdf-report.js";

function answer(state, f, id, value) {
  recordAnswer(state, f.index.get(id), value);
}

function profileFlows() {
  return {
    org: buildFlow(ORG_PROFILE_ORDER, ORG_PROFILE_NODES),
    team: buildFlow(TEAM_STRUCTURE_ORDER, TEAM_STRUCTURE_NODES),
    infra: buildFlow(INFRA_ORDER, INFRA_NODES),
    container: buildFlow(CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES),
    devsec: buildFlow(DEVSEC_ORDER, DEVSEC_NODES),
    ot: buildFlow(OT_ORDER, OT_NODES),
  };
}

// Every visible NIST question answered with its lowest-scoring option -
// maximizes compounding-risk flags and gap items, the same worst-case
// shape used to stress-test multi-page pagination live this session.
function answerAllWorst(state) {
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const q of visibleNodes(ASSESSMENT_FLOW, state)) {
      if (state.answers[q.id] === undefined) {
        recordAnswer(state, q, Math.min(...q.options.map((o) => o.v)));
        progressed = true;
      }
    }
  }
}

function computeResultsCtx(session) {
  const funcScores = computeFuncScores(session);
  const overall = computeOverall(funcScores);
  const flags = computeFlags(session);
  const priorities = computePriorities(session);
  const vendorNotes = matchedVendorNotes(session.answers);
  const frameworkRecs = computeFrameworkRecommendations(session);
  return { session, funcScores, overall, flags, priorities, vendorNotes, frameworkRecs };
}

function assertRealPdf(doc, { minPages = 1 } = {}) {
  const bytes = doc.output("arraybuffer");
  assert.ok(bytes.byteLength > 1000, `expected a real PDF, got ${bytes.byteLength} bytes`);
  const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
  assert.equal(header, "%PDF-", "output should start with a valid PDF file header");
  const pageCount = doc.internal.getNumberOfPages();
  assert.ok(pageCount >= minPages, `expected at least ${minPages} page(s), got ${pageCount}`);
}

test("PDF export: worst-case, multi-framework, many-findings assessment renders a valid multi-page PDF", () => {
  const flows = profileFlows();
  const state = createSessionState();
  state.answers.industry = "finance";
  state.answers.regions = ["na"];
  state.answers.companyName = "Acme Financial Corp";
  state.answers.reportRequestedBy = "Jane Smith, CISO";
  state.answers.pcidss = true;
  state.answers.hipaa = true;

  answer(state, flows.org, "employeeCount", "51–200");
  answer(state, flows.team, "teamDedicated", "Yes, dedicated IT and cybersecurity team");
  answer(state, flows.team, "itHeadcountSeparate", "3–10");
  answer(state, flows.team, "cybersecHeadcount", "1–2");
  answer(state, flows.team, "dayToDay", ["partial-outsource"]);
  answer(state, flows.team, "partialOutsourceFunctions", ["patch-management"]);
  answer(state, flows.team, "socOwnership", "Fully in-house");
  answer(state, flows.infra, "hasAntivirus", "Yes");
  answer(state, flows.infra, "antivirusVendor", "CrowdStrike Falcon");
  answer(state, flows.infra, "edgeDeviceVendor", "Fortinet FortiGate");
  answer(state, flows.infra, "dlpUsed", "Yes");
  answer(state, flows.infra, "deployModel", "Hybrid (on-prem + cloud)");
  answer(state, flows.infra, "sdwanUsed", "No");
  answer(state, flows.infra, "networkArch", "Flat / mostly unsegmented");
  answer(state, flows.infra, "externalDevices", "Yes");
  answer(state, flows.infra, "externalWebsite", "Yes");
  answer(state, flows.infra, "webDb", "Yes");
  answer(state, flows.container, "usesContainers", "No");
  answer(state, flows.container, "usesVirtualization", "No / cloud-native only");
  answer(state, flows.devsec, "developsSoftware", "Yes");
  answer(state, flows.devsec, "devsecopsMaturity", "No formal practice - security reviewed late, if at all");
  answer(state, flows.devsec, "secretsManagement", "Hardcoded or stored in plain config files");
  answer(state, flows.ot, "hasOT", "No");

  answerAllWorst(state);
  const ctx = computeResultsCtx(state);

  // Sanity-check this scenario actually exercises what it's meant to,
  // before trusting the PDF assertions below to mean anything.
  assert.ok(ctx.flags.length >= 5, `expected several compounding-risk flags in this worst-case scenario, got ${ctx.flags.length}`);
  assert.ok(ctx.vendorNotes.length >= 1, "expected at least one vendor-note match (Fortinet)");
  assert.ok(ctx.frameworkRecs.length === 2, "expected PCI DSS + HIPAA framework recommendations");

  const { doc, filename } = buildAssessmentPdfDoc(ctx);
  assertRealPdf(doc, { minPages: 2 });
  assert.match(filename, /^SimplifiedCS-Assessment-Financial-Services-\d{4}-\d{2}-\d{2}\.pdf$/);
});

test("PDF export: minimal assessment (no frameworks, no flags, no vendors) omits optional sections without crashing", () => {
  const flows = profileFlows();
  const state = createSessionState();
  // No industry, no regions, no frameworks selected.

  answer(state, flows.org, "employeeCount", "1–10");
  answer(state, flows.team, "teamDedicated", "Yes, only a dedicated IT team maintaining infrastructure");
  answer(state, flows.team, "itOnlyHeadcount", "1–2");
  answer(state, flows.team, "dayToDay", ["inhouse-all"]);
  answer(state, flows.team, "inhouseSocCapability", "Yes, all three in-house");
  answer(state, flows.infra, "hasAntivirus", "No");
  answer(state, flows.infra, "dlpUsed", "No");
  answer(state, flows.infra, "deployModel", "On-premises only");
  answer(state, flows.infra, "sdwanUsed", "No");
  answer(state, flows.infra, "networkArch", "Segmented (VLANs / zones)");
  answer(state, flows.infra, "externalDevices", "No");
  answer(state, flows.infra, "externalWebsite", "No");
  answer(state, flows.container, "usesContainers", "No");
  answer(state, flows.container, "usesVirtualization", "No / cloud-native only");
  answer(state, flows.devsec, "developsSoftware", "No");
  answer(state, flows.ot, "hasOT", "No");

  // Every question answered at max score - no compounding-risk flags,
  // no priority gaps, and (with no frameworks selected and no vendor
  // fields filled in) no vendor notes or framework recommendations
  // either. This is the "everything optional is empty" edge case.
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const q of visibleNodes(ASSESSMENT_FLOW, state)) {
      if (state.answers[q.id] === undefined) {
        recordAnswer(state, q, Math.max(...q.options.map((o) => o.v)));
        progressed = true;
      }
    }
  }
  const ctx = computeResultsCtx(state);
  assert.equal(ctx.flags.length, 0);
  assert.equal(ctx.vendorNotes.length, 0);
  assert.equal(ctx.frameworkRecs.length, 0);

  const { doc, filename } = buildAssessmentPdfDoc(ctx);
  assertRealPdf(doc);
  // No industry selected - filename should fall back to "General", not throw or leave a blank segment.
  assert.match(filename, /^SimplifiedCS-Assessment-General-\d{4}-\d{2}-\d{2}\.pdf$/);
});
