// Completed-assessment history, kept in this browser's localStorage - the
// same no-account, no-backend approach local-save.js already uses for
// in-progress answers. This replaces window.storage, which only ever
// existed inside the Claude.ai artifact preview the site was first built
// in: on the real site every history read/write silently failed, so the
// "change since your last assessment" view never appeared and History
// always said "0 assessments saved" - while the results page claimed the
// run had just been saved.
//
// Each run keeps its answers, so a past report can be re-rendered exactly
// (History's "View report", and "View your last report" on the assessment
// landing screen - which is also what makes a completed report survive a
// page reload). Capped so it can't grow without bound.
const RUNS_KEY = "simplifiedcs:runs:v1";
export const MAX_RUNS = 25;

function readRuns() {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.ts === "number" && typeof r.overall === "number") : [];
  } catch {
    return [];
  }
}

function writeRuns(runs) {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
    return true;
  } catch {
    // Private browsing, quota, or storage disabled - history is a
    // convenience, so the report itself carries on without it.
    return false;
  }
}

// Oldest first.
export function listRuns() {
  return readRuns().sort((a, b) => a.ts - b.ts);
}

export function getRun(ts) {
  return listRuns().find((r) => r.ts === ts) || null;
}

// Returns whether the run was actually persisted.
export function saveRun(run) {
  const runs = listRuns().filter((r) => r.ts !== run.ts);
  runs.push(run);
  runs.sort((a, b) => a.ts - b.ts);
  return writeRuns(runs.slice(-MAX_RUNS));
}

export function clearRuns() {
  try {
    localStorage.removeItem(RUNS_KEY);
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
