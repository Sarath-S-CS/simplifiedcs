// What an answer means, independent of how it was collected.
//
// Two problems this module exists to prevent:
//   1. "Not sure" being scored as "No" (or as anything). Every answer
//      resolves to one status - met, partial, gap, unknown, not applicable,
//      not asked or unanswered - and only met/partial/gap are graded.
//   2. Stale answers. If someone answers "Does the web app use a database?
//      Yes", then goes back and says there is no web app, the database
//      answer is still in session state. Everything that builds the report
//      (scores, combined findings, snapshot, AI payload, saved history) reads
//      effectiveState(), which keeps only answers to questions that are
//      actually visible for the final set of answers.
import { visibleNodes } from "./graph.js";
import { PROFILE_SCREENS } from "../data/profile-flow.js";
import { ASSESSMENT_FLOW } from "../data/assessment-flow.js";
import { FRAMEWORKS } from "../data/frameworks.js";
import { STATUS, UNKNOWN, NOT_APPLICABLE, PROFILE_CONTROLS } from "../data/controls.js";

// Scope-screen and report-page fields: not graph nodes, always kept.
const SCOPE_KEYS = ["industry", "regions", "countries", "otOverride", "companyName", "reportRequestedBy", ...FRAMEWORKS.map((f) => f.id)];
// Companion keys the UI stores next to a node's own answer.
const COMPANION_SUFFIXES = ["__isOther", "__otherText"];

const DEDUPE_NODES = PROFILE_SCREENS.flatMap((s) => [...s.flow.index.values()]).filter((n) => n.dedupeKey);

// The dedupe map (which answers were carried over between questions) is
// derived from answers, so it can be rebuilt for answers that come from
// storage or an example - otherwise a carried-over answer (for example "who
// runs SOC monitoring", answered by the outsourced-functions checklist)
// would look unanswered and hide every question after it.
export function rebuildDedupe(answers, dedupe = {}) {
  const out = { ...dedupe };
  for (const node of DEDUPE_NODES) {
    if (Object.prototype.hasOwnProperty.call(out, node.dedupeKey) || !isAnswered(answers[node.id])) continue;
    const v = typeof node.dedupeValue === "function" ? node.dedupeValue(answers[node.id]) : answers[node.id];
    if (v !== undefined) out[node.dedupeKey] = v;
  }
  return out;
}

export function cloneState(state) {
  const answers = JSON.parse(JSON.stringify(state.answers || {}));
  return {
    answers,
    asked: [...(state.asked || [])],
    dedupe: rebuildDedupe(answers, state.dedupe || {}),
    quickMode: Boolean(state.quickMode),
  };
}

// visibleNodes() skips (on its first walk) any node whose answer it just
// carried over from an earlier node with the same dedupeKey. Walking twice
// includes those carried-over nodes too. Operates on a clone - never on the
// live session.
function reachableNodes(flow, state) {
  visibleNodes(flow, state);
  return visibleNodes(flow, state);
}

export function visibleProfileScreens(state) {
  return PROFILE_SCREENS.filter((s) => !s.skipIf || !s.skipIf(state.answers));
}

function walkIds(work) {
  const ids = new Set();
  for (const screen of visibleProfileScreens(work)) {
    for (const n of reachableNodes(screen.flow, work)) ids.add(n.id);
  }
  for (const n of reachableNodes(ASSESSMENT_FLOW, work)) ids.add(n.id);
  return ids;
}

function keepOnly(answers, ids) {
  const kept = {};
  for (const key of SCOPE_KEYS) if (answers[key] !== undefined) kept[key] = answers[key];
  for (const id of ids) {
    if (answers[id] !== undefined) kept[id] = answers[id];
    for (const suffix of COMPANION_SUFFIXES) if (answers[id + suffix] !== undefined) kept[id + suffix] = answers[id + suffix];
  }
  return kept;
}

// The node ids visible for this answer set, across every setup screen and
// the scored flow - computed to a fixed point, because dropping one stale
// answer can hide further questions (no public web service -> the "uses a
// database?" answer is stale -> the database questions it unlocked are
// stale too).
export function reachableNodeIds(state) {
  const work = cloneState(state);
  let ids = walkIds(work);
  for (let i = 0; i < 10; i++) {
    const pruned = keepOnly(work.answers, ids);
    const next = walkIds({ ...work, answers: pruned });
    work.answers = pruned;
    if (next.size === ids.size && [...next].every((id) => ids.has(id))) break;
    ids = next;
  }
  return { ids, answers: work.answers };
}

// A copy of the state whose answers contain only what the report may use.
export function effectiveState(state) {
  const { ids, answers } = reachableNodeIds(state);
  return { ...cloneState(state), answers: keepOnly(answers, ids) };
}

// Answer ids present in the session but dropped from the report because the
// question no longer applies - shown to the visitor, never silently lost.
export function staleAnswerIds(state) {
  const eff = effectiveState(state).answers;
  const nodeIds = new Set([...PROFILE_SCREENS.flatMap((s) => [...s.flow.index.keys()]), ...ASSESSMENT_FLOW.index.keys()]);
  return Object.keys(state.answers || {}).filter((k) => nodeIds.has(k) && !(k in eff) && isAnswered(state.answers[k]));
}

export function isAnswered(v) {
  return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
}

// Status of a scored question's stored value. Graded options are 0/1/2 (a
// few questions only have 0 and 2): the highest graded value is met, the
// lowest is a gap, anything between is partial.
export function scoredStatus(question, value) {
  if (!isAnswered(value)) return STATUS.UNANSWERED;
  if (value === UNKNOWN) return STATUS.UNKNOWN;
  if (value === NOT_APPLICABLE) return STATUS.NA;
  const graded = question.options.map((o) => o.v).filter((v) => typeof v === "number");
  if (typeof value !== "number" || !graded.includes(value)) return STATUS.UNKNOWN;
  if (value === Math.max(...graded)) return STATUS.MET;
  if (value === Math.min(...graded)) return STATUS.GAP;
  return STATUS.PARTIAL;
}

// Status of a profile-screen control's stored option string. Free text
// typed under "Other" can't be graded, so it counts as unknown.
export function profileControlStatus(id, value) {
  if (!isAnswered(value)) return STATUS.UNANSWERED;
  return PROFILE_CONTROLS[id]?.status[value] ?? STATUS.UNKNOWN;
}

export const STATUS_POINTS = { met: 2, partial: 1, gap: 0 };

export function isKnown(status) {
  return status === STATUS.MET || status === STATUS.PARTIAL || status === STATUS.GAP;
}

// "Is at least partly in place" for a scored value - the check guidance
// text uses before saying "you do have some X". Deliberately false for
// "Not sure", which the old `value !== 0` checks treated as "yes".
export function hasSome(value) {
  return value === 1 || value === 2;
}

// Label of the option chosen for a scored question.
export function chosenOptionLabel(question, value) {
  if (!isAnswered(value)) return "Not answered";
  const opt = question.options.find((o) => o.v === value);
  return opt ? opt.t : String(value);
}

// Where the organization is reachable from the internet: "yes" when any
// answer says so, "none" only when every relevant answer rules it out, and
// "unknown" otherwise (for example in Quick screening, which doesn't ask).
export function internetExposure(answers) {
  const cloud = answers.deployModel === "Cloud-only" || answers.deployModel === "Hybrid (on-prem + cloud)";
  if (cloud || answers.externalDevices === "Yes" || answers.externalWebsite === "Yes") return "yes";
  if (answers.deployModel === "On-premises only" && answers.externalDevices === "No" && answers.externalWebsite === "No") return "none";
  return "unknown";
}
