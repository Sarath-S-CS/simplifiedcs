// Optional AI-enhanced insights for a completed assessment report.
//
// Everything substantive lives in ../lib (tested in Node under test/):
//   handlers.ts   request flow: validation -> consent -> admission ->
//                 evidence retrieval -> model call -> output validation
//   admission.ts  atomic per-client / site-wide limits, concurrency slots,
//                 duplicate lock; fails closed if Blobs is unavailable
//   evidence.ts   CISA KEV + NVD evidence records and per-product status
//   insights.ts   request schema, prompt, output validation
//
// This file only binds the Netlify runtime: env, client IP and Blobs stores.
// Production and non-production (branch/preview) deploys use separate
// stores so test traffic never shares counters or cache with production.
import { getStore, getDeployStore } from "@netlify/blobs";
import type { Context, Config } from "@netlify/functions";
import { handleInsights } from "../lib/handlers.ts";

const isProduction = () => Netlify.context?.deploy?.context === "production";

function store(name: string, strong: boolean) {
  const consistency = strong ? ("strong" as const) : ("eventual" as const);
  return isProduction() ? getStore({ name, consistency }) : getDeployStore({ name, consistency });
}

export default async (req: Request, context: Context) =>
  handleInsights(req, {
    env: (name) => Netlify.env.get(name),
    clientIp: context.ip || "unknown",
    admissionStore: () => store("ai-admission", true) as any,
    cacheStore: () => {
      try {
        return store("ai-public-cache", false) as any;
      } catch {
        return null;
      }
    },
  });

export const config: Config = {
  path: "/.netlify/functions/ai-insights",
};
