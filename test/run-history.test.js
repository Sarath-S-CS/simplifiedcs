// History is browser-local (localStorage) - these run against an in-memory
// localStorage stand-in, including the "storage throws" case that private
// browsing produces.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { listRuns, getRun, saveRun, clearRuns, sameAnswers, MAX_RUNS } from "../src/engine/run-history.js";

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

const run = (ts, overall = 50, answers = { mfa: 0 }) => ({ ts, overall, gapTexts: [], industry: "health", quickMode: false, answers });

test("saves and lists runs oldest-first, and finds one by timestamp", () => {
  assert.equal(saveRun(run(300)), true);
  saveRun(run(100));
  saveRun(run(200));
  assert.deepEqual(listRuns().map((r) => r.ts), [100, 200, 300]);
  assert.equal(getRun(200).ts, 200);
  assert.equal(getRun(999), null);
});

test("re-saving the same timestamp replaces rather than duplicates", () => {
  saveRun(run(100, 40));
  saveRun(run(100, 60));
  assert.equal(listRuns().length, 1);
  assert.equal(listRuns()[0].overall, 60);
});

test(`keeps only the newest ${MAX_RUNS} runs`, () => {
  for (let i = 1; i <= MAX_RUNS + 5; i++) saveRun(run(i));
  const runs = listRuns();
  assert.equal(runs.length, MAX_RUNS);
  assert.equal(runs[0].ts, 6);
  assert.equal(runs.at(-1).ts, MAX_RUNS + 5);
});

test("clearRuns empties history", () => {
  saveRun(run(1));
  clearRuns();
  assert.deepEqual(listRuns(), []);
});

test("corrupt or foreign data reads as empty history instead of throwing", () => {
  localStorage.setItem("simplifiedcs:runs:v1", "{not json");
  assert.deepEqual(listRuns(), []);
  localStorage.setItem("simplifiedcs:runs:v1", JSON.stringify([{ ts: "x" }, null, run(5)]));
  assert.deepEqual(listRuns().map((r) => r.ts), [5]);
});

test("storage that throws (private browsing) degrades to no history, never an exception", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); },
  };
  assert.deepEqual(listRuns(), []);
  assert.equal(saveRun(run(1)), false);
  assert.doesNotThrow(() => clearRuns());
});

test("sameAnswers ignores report-page fields and key order", () => {
  assert.ok(sameAnswers({ mfa: 0, siem: 2, companyName: "Acme" }, { siem: 2, mfa: 0 }));
  assert.ok(!sameAnswers({ mfa: 0 }, { mfa: 1 }));
});
