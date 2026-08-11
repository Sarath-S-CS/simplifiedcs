// Session-scoped state for the adaptive assessment (§5.10 de-duplication memory).
// A plain, serializable object so it can round-trip through the existing
// window.storage save/export mechanism unchanged.
export function createSessionState() {
  return {
    answers: {},   // nodeId -> answer value (number for scored questions, string/array otherwise)
    asked: [],     // ordered list of node ids actually shown to the user, for progress/back-nav
    dedupe: {},    // dedupeKey -> value already collected under a different node id
  };
}

export function recordAnswer(state, node, value) {
  state.answers[node.id] = value;
  if (!state.asked.includes(node.id)) state.asked.push(node.id);
  if (node.dedupeKey) state.dedupe[node.dedupeKey] = value;
}

export function hasDedupeValue(state, dedupeKey) {
  return Boolean(dedupeKey) && Object.prototype.hasOwnProperty.call(state.dedupe, dedupeKey);
}

export function getDedupeValue(state, dedupeKey) {
  return state.dedupe[dedupeKey];
}

// Carries a value collected under one node's dedupeKey forward onto another
// node id without re-prompting the user (§5.10: "carrying the already-provided
// answer forward into scoring/results instead of re-prompting").
export function adoptDedupedAnswer(state, node) {
  if (!node.dedupeKey || !hasDedupeValue(state, node.dedupeKey)) return false;
  state.answers[node.id] = getDedupeValue(state, node.dedupeKey);
  if (!state.asked.includes(node.id)) state.asked.push(node.id);
  return true;
}
