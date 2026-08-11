import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, visibleNodes } from "../src/engine/graph.js";
import { createSessionState, recordAnswer } from "../src/engine/state.js";

function makeFlow() {
  const order = ["a", "b", "c"];
  const nodes = [
    {
      id: "a",
      required: true,
      options: ["x", "y"],
      next(answers) {
        if (answers.a === "x") return "b";
        if (answers.a === "y") return "c";
        return null; // unanswered
      },
    },
    // "b" is itself a required chain link (has its own next()), matching
    // e.g. team-structure.js's itOnlyHeadcount -> dayToDay - the walk must
    // wait for it to be answered too, not just for "a".
    { id: "b", required: true, options: ["1", "2"], next: () => "c" },
    { id: "c", required: true, options: ["1", "2"] },
  ];
  return buildFlow(order, nodes);
}

test("visibleNodes stops at an unanswered branch point instead of guessing a default path", () => {
  const flow = makeFlow();
  const state = createSessionState();
  const visible = visibleNodes(flow, state);
  assert.deepEqual(visible.map((n) => n.id), ["a"]);
});

test("visibleNodes proceeds down the branch once the branch point is answered, then stops at the next unanswered required link", () => {
  const flow = makeFlow();
  const state = createSessionState();
  recordAnswer(state, flow.index.get("a"), "x");
  const visible = visibleNodes(flow, state);
  assert.deepEqual(visible.map((n) => n.id), ["a", "b"]);
});

test("a required node WITHOUT a custom next() does not block advancement - flat-form fields render together", () => {
  const order = ["a", "flat1", "flat2"];
  const nodes = [
    { id: "a", required: true, options: ["x"], next: () => "flat1" },
    { id: "flat1", required: true, options: ["1", "2"] }, // no next() - plain default order
    { id: "flat2", required: true, options: ["1", "2"] },
  ];
  const flow = buildFlow(order, nodes);
  const state = createSessionState();
  recordAnswer(state, flow.index.get("a"), "x");
  const visible = visibleNodes(flow, state);
  assert.deepEqual(visible.map((n) => n.id), ["a", "flat1", "flat2"], "flat1/flat2 should render together even though neither is answered yet");
});

test("dedupe: a later node with the same dedupeKey is auto-skipped and adopts the earlier value", () => {
  const order = ["first", "second"];
  const nodes = [
    { id: "first", type: "text", dedupeKey: "shared", required: false },
    { id: "second", type: "text", dedupeKey: "shared", required: false },
  ];
  const flow = buildFlow(order, nodes);
  const state = createSessionState();
  recordAnswer(state, flow.index.get("first"), "Acme MSP");
  const visible = visibleNodes(flow, state);
  assert.deepEqual(visible.map((n) => n.id), ["first"]);
  assert.equal(state.answers.second, "Acme MSP", "the deduped value should be carried forward without prompting");
});

test("dedupe does not cause a node to skip itself once it has its own answer", () => {
  // Regression test: adoptDedupedAnswer used to fire for the very node that
  // originally set dedupeKey's value, making it vanish from its own screen.
  const order = ["only"];
  const nodes = [{ id: "only", type: "text", dedupeKey: "shared", required: false }];
  const flow = buildFlow(order, nodes);
  const state = createSessionState();
  recordAnswer(state, flow.index.get("only"), "Acme MSP");
  const visible = visibleNodes(flow, state);
  assert.deepEqual(visible.map((n) => n.id), ["only"]);
});

test("visibleIf hides a node until its condition is met, without blocking later default-order nodes", () => {
  const order = ["gate", "conditional", "always"];
  const nodes = [
    { id: "gate", type: "select", required: true, options: ["Yes", "No"] },
    { id: "conditional", type: "select", required: true, options: ["a"], visibleIf: (answers) => answers.gate === "Yes" },
    { id: "always", type: "select", required: true, options: ["a"] },
  ];
  const flow = buildFlow(order, nodes);
  const state = createSessionState();
  recordAnswer(state, flow.index.get("gate"), "No");
  const visible = visibleNodes(flow, state);
  assert.deepEqual(visible.map((n) => n.id), ["gate", "always"], "conditional should be skipped, and the walk should still reach the node after it");
});
