// Scheduled once a day: deletes rate-limit counters (salted IP hashes) older
// than yesterday, expired budget buckets and abandoned duplicate-request
// locks from the AI endpoints' store. See ../lib/cleanup-job.ts.
//
// Scheduled functions only run on the published production deploy, so this
// always cleans the production store (the one ai-insights.mts and
// other-text-interpret.mts use in production).
import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { runDailyCleanup } from "../lib/cleanup-job.ts";

export default async () => {
  try {
    const deleted = await runDailyCleanup(getStore({ name: "ai-admission", consistency: "strong" }) as any);
    console.log(JSON.stringify({ fn: "ai-limits-cleanup", event: "done", deleted }));
  } catch (e) {
    console.log(JSON.stringify({ fn: "ai-limits-cleanup", event: "failed", error: (e as Error).name }));
  }
};

export const config: Config = {
  schedule: "@daily",
};
