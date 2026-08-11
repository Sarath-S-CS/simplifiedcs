// The scored, six-NIST-function flow (replaces STEPS). Framework-tagged
// questions are only visible when that framework was selected on the scope
// screen - same gating behavior as the original visibleQuestions() helper,
// just expressed as a graph visibleIf.
import { buildFlow } from "../engine/graph.js";
import { NIST_QUESTIONS } from "./nist-questions.js";

const ASSESSMENT_NODES = NIST_QUESTIONS.map((q) =>
  q.framework ? { ...q, visibleIf: (answers) => Boolean(answers[q.framework]) } : q
);

export const ASSESSMENT_ORDER = ASSESSMENT_NODES.map((q) => q.id);
export const ASSESSMENT_FLOW = buildFlow(ASSESSMENT_ORDER, ASSESSMENT_NODES);
