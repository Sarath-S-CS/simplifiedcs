import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, visibleNodes } from "../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../src/engine/state.js";
import { CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES } from "../src/data/containerization.js";
import { DEVSEC_ORDER, DEVSEC_NODES } from "../src/data/profile-questions.js";

test("§5.5: containerization question appears with no developsSoftware answer at all", () => {
  const f = buildFlow(CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES);
  const state = createSessionState(); // developsSoftware never answered
  const ids = visibleNodes(f, state).map((n) => n.id);
  assert.ok(ids.includes("usesContainers"), "containerization must not be gated behind custom software development");
});

test("§5.5: container follow-ups only appear once containers are actually in use", () => {
  const f = buildFlow(CONTAINERIZATION_ORDER, CONTAINERIZATION_NODES);
  const state = createSessionState();
  recordAnswer(state, f.index.get("usesContainers"), "No");
  let ids = visibleNodes(f, state).map((n) => n.id);
  assert.ok(!ids.includes("containerOrchestration"));
  assert.ok(!ids.includes("containerImageScanning"));

  recordAnswer(state, f.index.get("usesContainers"), "Yes, some workloads");
  ids = visibleNodes(f, state).map((n) => n.id);
  assert.ok(ids.includes("containerOrchestration"));
  assert.ok(ids.includes("containerImageScanning"));
});

test("§5.5: DevSecOps questions remain gated on developsSoftware specifically (unchanged behavior)", () => {
  const f = buildFlow(DEVSEC_ORDER, DEVSEC_NODES);
  const state = createSessionState();
  recordAnswer(state, f.index.get("developsSoftware"), "No");
  let ids = visibleNodes(f, state).map((n) => n.id);
  assert.ok(!ids.includes("devsecopsMaturity"));
  assert.ok(!ids.includes("secretsManagement"));

  recordAnswer(state, f.index.get("developsSoftware"), "Yes");
  ids = visibleNodes(f, state).map((n) => n.id);
  assert.ok(ids.includes("devsecopsMaturity"));
});
