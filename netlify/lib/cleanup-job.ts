// The daily retention job for the AI endpoints' rate-limit store.
//
// Per-client counters are keyed by a salted one-way hash of the visitor's IP
// address, bucketed by UTC day. The endpoints also clean up opportunistically
// (on a small share of requests), but that alone gives no deletion guarantee
// when the site is quiet - this job runs it once a day regardless of
// traffic (netlify/functions/ai-limits-cleanup.mts).
import { cleanup, type CasStore } from "./admission.ts";
import { INSIGHTS_POLICY, INTERPRET_POLICY } from "./handlers.ts";

// Generous per-run cap: a day's buckets for a small site are far below this,
// and a scheduled function has 30 seconds.
const MAX_DELETES_PER_POLICY = 2000;

export async function runDailyCleanup(store: CasStore, now = Date.now()): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  for (const policy of [INSIGHTS_POLICY, INTERPRET_POLICY]) {
    deleted[policy.name] = await cleanup(store, policy, now, MAX_DELETES_PER_POLICY);
  }
  return deleted;
}
