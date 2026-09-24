// The daily retention job must remove old per-client counters (salted IP
// hashes) for both AI endpoints, whatever the traffic, and keep what the
// rolling limits still need.
import { test } from "node:test";
import assert from "node:assert/strict";
import { admit } from "../netlify/lib/admission.ts";
import { INSIGHTS_POLICY, INTERPRET_POLICY } from "../netlify/lib/handlers.ts";
import { runDailyCleanup } from "../netlify/lib/cleanup-job.ts";
import { casStore } from "./helpers/stores.js";

const NOW = Date.UTC(2026, 8, 24, 12);
const DAY = 24 * 3600_000;
const noSleep = async () => {};

test("deletes counters older than yesterday for both endpoints, keeps today's and yesterday's", async () => {
  const store = casStore();
  for (const policy of [INSIGHTS_POLICY, INTERPRET_POLICY]) {
    for (const [client, at] of [["tenDaysAgo", NOW - 10 * DAY], ["threeDaysAgo", NOW - 3 * DAY], ["yesterday", NOW - DAY], ["today", NOW]]) {
      const r = await admit(store, policy, { clientHash: `${policy.name}-${client}`, requestHash: `r-${client}`, estimatedTokens: 1, now: at, sleep: noSleep });
      assert.ok(r.ok, `${policy.name}/${client} admitted`);
    }
  }
  const deleted = await runDailyCleanup(store, NOW);
  assert.ok(deleted[INSIGHTS_POLICY.name] >= 2 && deleted[INTERPRET_POLICY.name] >= 2, JSON.stringify(deleted));
  const clientKeys = [...store.data.keys()].filter((k) => k.includes("/client/"));
  for (const policy of [INSIGHTS_POLICY, INTERPRET_POLICY]) {
    assert.ok(!clientKeys.some((k) => k.endsWith(`${policy.name}-tenDaysAgo`) || k.endsWith(`${policy.name}-threeDaysAgo`)), `${policy.name}: old counters removed`);
    assert.ok(clientKeys.some((k) => k.endsWith(`${policy.name}-yesterday`)), `${policy.name}: yesterday kept`);
    assert.ok(clientKeys.some((k) => k.endsWith(`${policy.name}-today`)), `${policy.name}: today kept`);
  }
});

test("an empty store is a no-op", async () => {
  const deleted = await runDailyCleanup(casStore(), NOW);
  assert.deepEqual(Object.values(deleted), [0, 0]);
});
