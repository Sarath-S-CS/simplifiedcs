// Generic decision-graph traversal, shared by the unscored "profile" flow
// (org/team/vendor/infra questions - replaces PRE_STEPS) and the scored
// "assessment" flow (the six NIST-function questions - replaces STEPS).
//
// A flow is an ordered array of node ids (the default path) plus a Map of
// id -> node. Any node may override where the flow goes next via
// `next(answers)`; when that returns `undefined` the engine falls through to
// the next id in the flow's default order. Returning `null` explicitly ends
// the flow early (e.g. "no dedicated team" skipping the rest of a branch).
//
// This satisfies CLAUDE.md §6's requested shape: id, prompt/type/options,
// nextNode(answers) (a function of everything answered so far), scoresTo.
import { adoptDedupedAnswer } from "./state.js";

export function buildFlow(order, nodes) {
  const index = new Map(nodes.map((n) => [n.id, n]));
  return { order, index };
}

export function getNode(flow, id) {
  return flow.index.get(id);
}

function defaultNextId(flow, id) {
  const pos = flow.order.indexOf(id);
  if (pos === -1 || pos === flow.order.length - 1) return null;
  return flow.order[pos + 1];
}

function isAnswered(state, nodeId) {
  const v = state.answers[nodeId];
  return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
}

// Given the flow and the id of the node just answered (or null for "start
// of flow"), returns the next node the user should actually see - skipping
// any nodes whose visibleIf() fails, and auto-resolving (without prompting)
// any node whose dedupeKey already has a value collected elsewhere.
export function resolveNext(flow, currentId, state) {
  let id = currentId === null ? flow.order[0] : nextIdFrom(flow, currentId, state);
  while (id !== null) {
    const node = getNode(flow, id);
    if (!node) return null;
    if (node.visibleIf && !node.visibleIf(state.answers)) {
      id = nextIdFrom(flow, id, state);
      continue;
    }
    // Only adopt a deduped value for a node that hasn't been answered
    // itself - otherwise the very node that originally set dedupeKey's
    // value would immediately "adopt" its own answer and skip itself.
    if (!isAnswered(state, node.id) && adoptDedupedAnswer(state, node)) {
      id = nextIdFrom(flow, id, state);
      continue;
    }
    return id;
  }
  return null;
}

function nextIdFrom(flow, id, state) {
  const node = getNode(flow, id);
  if (node && typeof node.next === "function") {
    const explicit = node.next(state.answers);
    if (explicit !== undefined) return explicit;
  }
  return defaultNextId(flow, id);
}

// All nodes actually reachable given current answers, in flow order - used
// for progress rails, "all answered" checks, and scoring aggregation. This
// is the graph-native replacement for the old visibleQuestions()/fieldVisible().
//
// Required nodes with a custom next() are sequential/branch points - what
// comes after them is only meaningful once they're actually answered, so
// the walk stops there (the node itself is still included, so it renders
// and can be answered). Optional nodes with a next() (e.g. a free-text
// provider-name field the user may legitimately leave blank) don't block -
// their next() is a fixed hop, not a real branch, so the chain keeps moving
// even while they're empty. Nodes using plain default ordering (no next()
// override at all, just visibleIf - e.g. containerization.js's linear
// checklist) have no such ambiguity either, so the walk keeps going
// regardless of whether earlier ones are answered yet - that's what lets a
// screen show several fields together as one form, same as the original
// PRE_STEPS fields did.
export function visibleNodes(flow, state) {
  const result = [];
  let id = resolveNext(flow, null, state);
  const seen = new Set();
  while (id !== null && !seen.has(id)) {
    seen.add(id);
    const node = getNode(flow, id);
    result.push(node);
    if (typeof node.next === "function" && node.required !== false && !isAnswered(state, node.id)) break;
    id = resolveNext(flow, id, state);
  }
  return result;
}
