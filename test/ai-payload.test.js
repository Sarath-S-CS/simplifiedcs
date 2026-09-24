// The browser's AI request must match what the server accepts - checked
// against the server's own validator, so the two can't drift apart - and
// must never include identifying report-page fields or stale answers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsightsPayload, namedProducts } from "../src/engine/ai-payload.js";
import { AI_CONSENT_VERSION } from "../src/engine/ai-consent.js";
import { buildReport } from "../src/engine/report-model.js";
import { validateInsightsRequest, CONSENT_VERSION } from "../netlify/lib/insights.ts";
import { validateInterpretRequest } from "../netlify/lib/interpret.ts";
import { runScenario, WEAK_ANSWERS } from "./helpers/scenarios.js";
import { INFRA_NODES, INFRA_ORDER } from "../src/data/profile-questions.js";
import { consentHtml, applicabilityText, aiResultHtml } from "../src/ui/ai-panel.js";

function weakState(extra = {}) {
  const state = runScenario(WEAK_ANSWERS, { scope: { industry: "manufacturing", regions: ["eu"], iso27001: true } });
  Object.assign(state.answers, { companyName: "Acme Confidential Ltd", reportRequestedBy: "Jane Doe, CISO" }, extra);
  return state;
}

test("the client and server agree on the consent notice version", () => {
  assert.equal(AI_CONSENT_VERSION, CONSENT_VERSION);
});

test("the insights payload passes the server's own request validation", () => {
  const state = weakState();
  const report = buildReport(state);
  const payload = buildInsightsPayload(state, report, { snapshotId: "rabc123", consentVersion: AI_CONSENT_VERSION });
  assert.equal(validateInsightsRequest(payload), null);
  assert.equal(payload.snapshotId, "rabc123");
  assert.ok(payload.products.length >= 5);
  assert.deepEqual(payload.platforms, ["Windows", "Linux"]);
});

test("the payload never contains company name, requester, or answers to questions that no longer apply", () => {
  const state = weakState();
  state.answers.externalWebsite = "No"; // makes webDb + database answers stale
  const payload = buildInsightsPayload(state, buildReport(state), { consentVersion: AI_CONSENT_VERSION });
  const text = JSON.stringify(payload);
  assert.doesNotMatch(text, /Acme Confidential|Jane Doe/);
  assert.ok(!payload.scoredAnswers.some((s) => /database encrypted at rest/i.test(s.q)));
  assert.ok(!payload.profileAnswers.some((p) => /backend database/i.test(p.q)));
});

test("'Not sure' answers are sent as unknown, not as failures", () => {
  const state = weakState({ siem: "unknown" });
  const payload = buildInsightsPayload(state, buildReport(state), { consentVersion: AI_CONSENT_VERSION });
  const siem = payload.scoredAnswers.find((s) => /centralized logging/i.test(s.q));
  assert.equal(siem.status, "unknown");
});

test("named products are de-duplicated, skip blanks and 'Other' placeholders, and are capped", () => {
  const products = namedProducts({ edrVendor: "CrowdStrike Falcon", antivirusVendor: "crowdstrike falcon", dlpVendor: "__other__", hostingProvider: "" });
  assert.deepEqual(products, [{ category: "antivirus", name: "crowdstrike falcon" }]);
  const many = Object.fromEntries(["antivirusVendor", "edrVendor", "emailSecurityVendor", "dlpVendor", "sdwanVendor", "edgeDeviceVendor", "hostingProvider", "cloudProvider", "awarenessLms", "otVendor", "webServerStack", "mdrProviderName", "msspProviderName", "fullMspProviderName"].map((k, i) => [k, `Product ${i}`]));
  assert.equal(namedProducts(many).length, 14);
});

test("a payload without consent is rejected by the server validator", () => {
  const state = weakState();
  const payload = buildInsightsPayload(state, buildReport(state), { consentVersion: AI_CONSENT_VERSION });
  payload.consent.accepted = false;
  assert.notEqual(validateInsightsRequest(payload), null);
});

test("the Other-text interpretation request shape is accepted by the server", () => {
  assert.equal(validateInterpretRequest({ consent: { version: AI_CONSENT_VERSION, accepted: true }, items: [{ fieldLabel: "How is cybersecurity managed day to day?", freeText: "a part-time vCISO" }] }), null);
});

// ---------------- product versions (AI-2) ----------------

test("the firewall's stated version travels with it, only when given, and passes server validation", () => {
  assert.deepEqual(namedProducts({ edgeDeviceVendor: "Fortinet FortiGate", edgeDeviceVersion: " 7.4.3 " }), [{ category: "edge device / firewall", name: "Fortinet FortiGate", version: "7.4.3" }]);
  assert.deepEqual(namedProducts({ edgeDeviceVendor: "Fortinet FortiGate", edgeDeviceVersion: "" }), [{ category: "edge device / firewall", name: "Fortinet FortiGate" }]);
  assert.deepEqual(namedProducts({ edgeDeviceVersion: "7.4.3" }), [], "a version without a product isn't sent");
  assert.equal(namedProducts({ edgeDeviceVendor: "SonicWall", edgeDeviceVersion: "7".repeat(80) })[0].version.length, 40);
  const state = weakState({ externalDevices: "Yes", edgeDeviceVendor: "Palo Alto Networks", edgeDeviceVersion: "11.1.2-h3" });
  const payload = buildInsightsPayload(state, buildReport(state), { consentVersion: AI_CONSENT_VERSION });
  assert.equal(validateInsightsRequest(payload), null);
  assert.equal(payload.products.find((p) => p.name === "Palo Alto Networks").version, "11.1.2-h3");
});

test("the version question appears only once a firewall is named, with that vendor's example", () => {
  const q = INFRA_NODES.find((n) => n.id === "edgeDeviceVersion");
  assert.ok(q, "question exists");
  assert.equal(q.required, false);
  assert.equal(q.visibleIf({ externalDevices: "No", edgeDeviceVendor: "Fortinet FortiGate" }), false);
  assert.equal(q.visibleIf({ externalDevices: "Yes" }), false);
  assert.equal(q.visibleIf({ externalDevices: "Yes", edgeDeviceVendor: "Fortinet FortiGate" }), true);
  assert.equal(q.visibleIf({ externalDevices: "Yes", edgeDeviceVendor: "", edgeDeviceVendor__isOther: true }), true, "shown while an Other name is being typed");
  assert.equal(q.placeholder({ edgeDeviceVendor: "Palo Alto Networks" }), "e.g. 11.1.2-h3 (PAN-OS)");
  assert.equal(q.placeholder({ edgeDeviceVendor: "Acme Firewall" }), "e.g. 7.4.3");
  assert.deepEqual(INFRA_NODES.find((n) => n.id === "edgeDeviceVendor").resets, ["edgeDeviceVersion"], "changing the vendor clears the version");
  assert.ok(INFRA_ORDER.indexOf("edgeDeviceVersion") === INFRA_ORDER.indexOf("edgeDeviceVendor") + 1);
});

test("the consent notice lists versions, and each match label quotes the stated version", () => {
  const html = consentHtml({ products: [{ category: "edge device / firewall", name: "Fortinet FortiGate", version: "7.4.3" }, { category: "EDR", name: "CrowdStrike Falcon" }] });
  assert.match(html, /with a version where you gave one/);
  assert.match(html, /Fortinet FortiGate, version 7\.4\.3 \(edge device \/ firewall\)/);
  assert.match(html, /CrowdStrike Falcon \(EDR\)/);
  assert.equal(applicabilityText({ applicability: "affects-stated-version", version: "7.4.33" }), "Listed by NVD as affecting your version (7.4.33)");
  assert.equal(applicabilityText({ applicability: "version-not-listed", version: "7.4.3" }), "NVD doesn't list your version (7.4.3) as affected - confirm with the vendor");
  assert.equal(applicabilityText({ applicability: "potential-match", version: null }), "Potential match - confirm your version");
  const shown = aiResultHtml({ generatedAt: "2026-09-24T12:00:00Z", sourceStatus: [], advisories: [{ productName: "Fortinet FortiGate", applicability: "affects-stated-version", version: "7.4.3", summary: "S.", verification: "V.", evidence: [] }], patterns: [], limitations: [] });
  assert.match(shown, /gap-tier-3">Listed by NVD as affecting your version \(7\.4\.3\)/);
});
