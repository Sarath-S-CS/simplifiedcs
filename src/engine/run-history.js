// Completed-assessment history, kept only in this browser's localStorage.
//
// Version 2 (methodology 2.0) stores, per run:
//   - the effective answers (answer schema 2) - enough to rebuild the full
//     report exactly while the methodology is unchanged
//   - a compact summary of the report as produced (verdict, coverage per
//     area, critical gaps, findings and actions by id) - what History lists,
//     what comparisons use, and what proves the original result if the
//     methodology changes later. A full report is ~100 KB; the summary is a
//     few KB, which is what keeps 25 runs inside browser storage limits.
//   - the AI-insights result, if any, with the report snapshot it belongs to
//
// Version 1 runs (key "simplifiedcs:runs:v1": overall %, gap texts, answers)
// are still listed, marked legacy, and are never silently re-scored: opening
// one migrates its answers and labels the result as recalculated under the
// current methodology, alongside the original percentage.
//
// Every write is read back before it is reported as saved, and a full
// storage quota evicts the oldest runs first (the caller is told how many).
import { ANSWER_SCHEMA_VERSION } from "./migrate.js";

const RUNS_KEY_V1 = "simplifiedcs:runs:v1";
export const RUNS_KEY = "simplifiedcs:runs:v2";
export const MAX_RUNS = 25;

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readJson(key) {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readV2() {
  const parsed = readJson(RUNS_KEY);
  return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === "string" && typeof r.ts === "number" && r.summary) : [];
}

function readV1() {
  const parsed = readJson(RUNS_KEY_V1);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((r) => r && typeof r.ts === "number" && typeof r.overall === "number")
    .map((r) => ({
      id: `legacy-${r.ts}`,
      ts: r.ts,
      legacy: true,
      mode: r.quickMode ? "quick" : "full",
      methodologyVersion: "1.x",
      answerSchema: 1,
      answers: r.answers || null,
      legacyOverall: r.overall,
      legacyGapCount: Array.isArray(r.gapTexts) ? r.gapTexts.length : null,
      industry: r.industry || null,
      summary: null,
      ai: null,
    }));
}

// Oldest first.
export function listRuns() {
  return [...readV1(), ...readV2()].sort((a, b) => a.ts - b.ts);
}

export function getRun(id) {
  return listRuns().find((r) => r.id === id) || null;
}

export function newRunId(now = Date.now()) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `r${now.toString(36)}${rand}`;
}

// The compact, durable record of a report as produced.
export function summarizeReport(report) {
  return {
    methodologyVersion: report.methodologyVersion,
    questionSetVersion: report.questionSetVersion,
    mode: report.mode,
    generatedAt: report.generatedAt,
    industry: report.context.industry,
    frameworks: report.context.frameworks,
    verdict: { key: report.verdict.key, label: report.verdict.label },
    coverage: report.overall.coverage,
    completeness: report.overall.completeness,
    counts: report.overall.counts,
    areas: report.areas.map((a) => ({ fn: a.fn, coverage: a.coverage, completeness: a.completeness })),
    criticalGaps: report.criticalGaps.map((c) => c.id),
    findings: report.findings.map((f) => ({ id: f.id, status: f.status, rank: f.rank, critical: f.critical, title: f.title })),
    flags: report.flags.map((f) => f.id),
    actions: report.actions.map((a) => ({ id: a.id, title: a.title, timeframeDays: a.timeframeDays })),
  };
}

function write(runs) {
  const s = storage();
  if (!s) return { ok: false, reason: "unavailable" };
  try {
    s.setItem(RUNS_KEY, JSON.stringify(runs));
    return { ok: true };
  } catch (e) {
    const quota = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    return { ok: false, reason: quota ? "quota" : "unavailable" };
  }
}

// Saves (or replaces) a run. Returns { ok, reason?, evicted } - ok only once
// the run has been read back from storage.
export function saveRun(run) {
  const others = readV2().filter((r) => r.id !== run.id);
  let runs = [...others, { ...run, answerSchema: ANSWER_SCHEMA_VERSION }].sort((a, b) => a.ts - b.ts);
  let evicted = Math.max(0, runs.length - MAX_RUNS);
  runs = runs.slice(-MAX_RUNS);
  let result = write(runs);
  while (!result.ok && result.reason === "quota" && runs.length > 1) {
    runs = runs.filter((r) => r.id !== runs.find((x) => x.id !== run.id).id);
    evicted++;
    result = write(runs);
  }
  if (!result.ok) return { ...result, evicted: 0 };
  const saved = readV2().some((r) => r.id === run.id);
  return saved ? { ok: true, evicted } : { ok: false, reason: "unavailable", evicted: 0 };
}

// Attaches (or replaces) the AI result on a saved run.
export function attachAiResult(id, ai) {
  const run = readV2().find((r) => r.id === id);
  if (!run) return { ok: false, reason: "missing" };
  return saveRun({ ...run, ai });
}

export function deleteRun(id) {
  const s = storage();
  if (!s) return false;
  try {
    if (id.startsWith("legacy-")) {
      const ts = Number(id.slice(7));
      const v1 = readJson(RUNS_KEY_V1);
      if (Array.isArray(v1)) s.setItem(RUNS_KEY_V1, JSON.stringify(v1.filter((r) => r.ts !== ts)));
    } else {
      s.setItem(RUNS_KEY, JSON.stringify(readV2().filter((r) => r.id !== id)));
    }
    return true;
  } catch {
    return false;
  }
}

export function clearRuns() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(RUNS_KEY);
    s.removeItem(RUNS_KEY_V1);
  } catch {
    /* nothing to clear */
  }
}

// Report-page fields typed after the fact (company name, requested-by)
// aren't part of the assessment itself, so they don't make two runs
// different.
const NON_ASSESSMENT_KEYS = new Set(["companyName", "reportRequestedBy"]);
function assessmentAnswers(answers) {
  return Object.fromEntries(
    Object.entries(answers || {})
      .filter(([k]) => !NON_ASSESSMENT_KEYS.has(k))
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

export function sameAnswers(a, b) {
  return JSON.stringify(assessmentAnswers(a)) === JSON.stringify(assessmentAnswers(b));
}
