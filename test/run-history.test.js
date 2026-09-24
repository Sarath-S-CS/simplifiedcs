// History is browser-local (localStorage) - these run against an in-memory
// localStorage stand-in, including private browsing (storage throws) and a
// full quota.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { listRuns, getRun, saveRun, clearRuns, deleteRun, attachAiResult, sameAnswers, summarizeReport, MAX_RUNS, RUNS_KEY } from "../src/engine/run-history.js";
import { loadProgress, saveProgress, SAVE_KEY } from "../src/engine/local-save.js";
import { loadTracking, updateTracking } from "../src/engine/action-tracking.js";
import { clearAllLocalData, LOCAL_DATA_KEYS } from "../src/engine/local-data.js";
import { buildReport } from "../src/engine/report-model.js";
import { SAMPLE_SCENARIOS } from "../src/data/sample-scenario.js";
import { runScenario } from "./helpers/scenarios.js";

function memoryStorage({ limit = Infinity } = {}) {
  const m = new Map();
  const size = () => [...m.entries()].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const prev = m.get(k);
      m.set(k, String(v));
      if (size() > limit) {
        if (prev === undefined) m.delete(k);
        else m.set(k, prev);
        const e = new Error("quota");
        e.name = "QuotaExceededError";
        throw e;
      }
    },
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

const sample = SAMPLE_SCENARIOS.itServices;
const REPORT = buildReport(runScenario(sample.answers, { scope: { industry: "itservices", soc2: true } }));
const run = (ts, extra = {}) => ({ id: `r${ts}`, ts, mode: "full", methodologyVersion: REPORT.methodologyVersion, answers: { mfa: 0 }, summary: summarizeReport(REPORT), ai: null, ...extra });

test("saves (confirmed by read-back) and lists runs oldest-first, and finds one by id", () => {
  assert.deepEqual(saveRun(run(300)), { ok: true, evicted: 0 });
  saveRun(run(100));
  saveRun(run(200));
  assert.deepEqual(listRuns().map((r) => r.ts), [100, 200, 300]);
  assert.equal(getRun("r200").ts, 200);
  assert.equal(getRun("nope"), null);
});

test("the stored summary is compact and keeps the original result", () => {
  const s = summarizeReport(REPORT);
  assert.ok(JSON.stringify(s).length < 12000, `summary is ${JSON.stringify(s).length} chars`);
  assert.equal(s.verdict.key, REPORT.verdict.key);
  assert.equal(s.coverage, REPORT.overall.coverage);
  assert.equal(s.methodologyVersion, REPORT.methodologyVersion);
  assert.equal(s.actions.length, REPORT.actions.length);
});

test("re-saving the same id replaces rather than duplicates", () => {
  saveRun(run(100));
  saveRun(run(100, { mode: "quick" }));
  assert.equal(listRuns().length, 1);
  assert.equal(listRuns()[0].mode, "quick");
});

test(`keeps only the newest ${MAX_RUNS} runs`, () => {
  for (let i = 1; i <= MAX_RUNS + 5; i++) saveRun(run(i));
  const runs = listRuns();
  assert.equal(runs.length, MAX_RUNS);
  assert.equal(runs[0].ts, 6);
});

test("a full storage quota evicts the oldest runs and says so", () => {
  globalThis.localStorage = memoryStorage({ limit: JSON.stringify(run(1)).length * 3.5 });
  for (let i = 1; i <= 3; i++) assert.equal(saveRun(run(i)).ok, true);
  const result = saveRun(run(4));
  assert.equal(result.ok, true);
  assert.ok(result.evicted >= 1);
  assert.equal(listRuns().at(-1).ts, 4);
});

test("storage that throws (private browsing) degrades to no history, never an exception", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); },
  };
  assert.deepEqual(listRuns(), []);
  assert.equal(saveRun(run(1)).ok, false);
  assert.doesNotThrow(() => clearRuns());
  assert.equal(saveProgress({ answers: {}, asked: [], dedupe: {}, quickMode: false }, { phase: "wizard" }).ok, false);
});

test("legacy v1 runs are listed read-only with their original percentage, never re-scored in place", () => {
  localStorage.setItem("simplifiedcs:runs:v1", JSON.stringify([{ ts: 5, overall: 99, gapTexts: ["x"], answers: { mfa: 0, vendorCount: 0 } }, { ts: "bad" }]));
  const [legacy] = listRuns();
  assert.equal(legacy.legacy, true);
  assert.equal(legacy.legacyOverall, 99);
  assert.equal(legacy.methodologyVersion, "1.x");
  assert.equal(legacy.summary, null);
  assert.ok(deleteRun(legacy.id));
  assert.deepEqual(listRuns(), []);
});

test("corrupt data reads as empty history instead of throwing", () => {
  localStorage.setItem(RUNS_KEY, "{not json");
  assert.deepEqual(listRuns(), []);
});

test("AI results attach to the run they were generated for", () => {
  saveRun(run(1));
  const ai = { snapshotId: "r1", generatedAt: "2026-09-24T00:00:00Z", promptVersion: "insights-2026-09-v2", result: { advisories: [] } };
  assert.equal(attachAiResult("r1", ai).ok, true);
  assert.equal(getRun("r1").ai.snapshotId, "r1");
  assert.equal(attachAiResult("missing", ai).ok, false);
});

test("in-progress saves record their schema, and old saves are migrated on resume", () => {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ answers: { vendorCount: 1 }, ui: { phase: "wizard" }, asked: [], dedupe: {} }));
  const loaded = loadProgress();
  assert.equal(loaded.answers.vendorCount, "1–5");
  assert.equal(loaded.answers.vendorAccessReview, 1);
  assert.ok(loaded.migrationNotes.length >= 1);
  assert.equal(saveProgress({ answers: { mfa: 2 }, asked: [], dedupe: {}, quickMode: false }, { phase: "wizard" }).ok, true);
  assert.equal(JSON.parse(localStorage.getItem(SAVE_KEY)).answerSchema, 2);
});

test("action tracking is stored separately from answers and only keeps known, bounded fields", () => {
  assert.equal(updateTracking("A-mfa", { owner: "=HYPERLINK(evil)", status: "done", due: "2026-10-01", bogus: 1, riskAcceptance: "x".repeat(900) }).ok, true);
  assert.equal(updateTracking("A-mfa", { due: "tomorrow" }).ok, true);
  const t = loadTracking()["A-mfa"];
  assert.equal(t.status, "done");
  assert.equal(t.due, "2026-10-01", "invalid dates are ignored");
  assert.equal(t.bogus, undefined);
  assert.equal(t.riskAcceptance.length, 500);
  assert.equal(updateTracking("<script>", {}).ok, false);
});

test("clear-all removes every SimplifiedCS key and nothing else", () => {
  saveRun(run(1));
  saveProgress({ answers: { mfa: 2 }, asked: [], dedupe: {}, quickMode: false }, { phase: "wizard" });
  updateTracking("A-mfa", { status: "open" });
  localStorage.setItem("someone-elses-key", "keep");
  const removed = clearAllLocalData();
  assert.ok(removed >= 3);
  for (const k of LOCAL_DATA_KEYS) assert.equal(localStorage.getItem(k), null, k);
  assert.equal(localStorage.getItem("someone-elses-key"), "keep");
});

test("sameAnswers ignores report-page fields and key order", () => {
  assert.ok(sameAnswers({ mfa: 0, siem: 2, companyName: "Acme" }, { siem: 2, mfa: 0 }));
  assert.ok(!sameAnswers({ mfa: 0 }, { mfa: 1 }));
});
