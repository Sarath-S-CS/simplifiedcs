// AI interpretation of unmatched "Other" free-text answers.
//
// Called only after the visitor makes the explicit AI-processing choice on
// the results page (the same consent record as AI insights) - never
// automatically. The interpretation is shown as a labelled AI reading and is
// never mapped onto a scored answer. Request flow and limits: see
// ../lib/handlers.ts and ../lib/interpret.ts.
import { getStore, getDeployStore } from "@netlify/blobs";
import type { Context, Config } from "@netlify/functions";
import { handleInterpret } from "../lib/handlers.ts";

const isProduction = () => Netlify.context?.deploy?.context === "production";

export default async (req: Request, context: Context) =>
  handleInterpret(req, {
    env: (name) => Netlify.env.get(name),
    clientIp: context.ip || "unknown",
    admissionStore: () => (isProduction() ? getStore({ name: "ai-admission", consistency: "strong" }) : getDeployStore({ name: "ai-admission", consistency: "strong" })) as any,
    cacheStore: () => null,
  });

export const config: Config = {
  path: "/.netlify/functions/other-text-interpret",
};
