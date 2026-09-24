// What the "Get AI-Enhanced Insights" request tells the model about this
// organization. The prompt (netlify/functions/ai-insights.mts) asks the
// model to look at "the full combination of answers" for patterns the rules
// engine doesn't cover - which it can only do if it actually receives the
// answers. Before this digest existed it got only the flag text and the top
// five priorities, so its long-tail pass had nothing to work with and its
// narrative could contradict the answers (a flag phrased "without logging or
// outbound monitoring" read as "no logging" even when SIEM was "Yes").
//
// Plain labels only - no internal ids, and nothing identifying (company
// name / "report requested by" are results-page fields, not flow nodes, so
// they're never included). The server re-caps every field regardless.
import { visibleNodes } from "./graph.js";
import { PROFILE_SCREENS } from "../data/profile-flow.js";
import { ASSESSMENT_FLOW } from "../data/assessment-flow.js";
import { FUNC_DISPLAY } from "../data/categories.js";
import { OTHER } from "../data/vendors.js";

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

// Every profile question actually shown on this run (branching means each
// org sees a different subset), with its answer. Skipped/unanswered and
// informational nodes are left out.
export function profileAnswerDigest(state) {
  const out = [];
  for (const screen of PROFILE_SCREENS) {
    for (const node of visibleNodes(screen.flow, state)) {
      if (node.type === "info") continue;
      const a = profileAnswerText(node, state.answers);
      if (a) out.push({ q: node.text, a });
    }
  }
  return out;
}

// Every scored question on this run with the option chosen, and whether it
// fell short of the strongest option - the same definition of "gap" that
// computeGapItems() in scoring.js uses.
export function scoredAnswerDigest(state) {
  return visibleNodes(ASSESSMENT_FLOW, state)
    .filter((q) => q.fn)
    .map((q) => {
      const val = state.answers[q.id];
      const maxOpt = Math.max(...q.options.map((o) => o.v));
      const chosen = q.options.find((o) => o.v === val);
      return { fn: FUNC_DISPLAY[q.fn], q: q.text, a: chosen ? chosen.t : "Not answered", gap: val === undefined || val < maxOpt };
    });
}
