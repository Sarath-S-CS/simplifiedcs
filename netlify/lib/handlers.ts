// Request handlers for the two AI endpoints, written against injected
// dependencies (stores, fetch, env, clock) so the full request path -
// validation, consent, admission, retrieval, model call, output validation,
// settlement - runs under test with no network and no Netlify runtime.
// netlify/functions/*.mts only wire in the real dependencies.
import { errorResponse, jsonResponse, newRequestId, readJsonBody, hashClient, sha256Hex, fetchWithTimeout } from "./http.ts";
import { admit, settle, cleanup, estimateTokens, AdmissionUnavailable, type CasStore, type Policy, type Ticket } from "./admission.ts";
import { cachedJson, type JsonKv } from "./public-cache.ts";
import { callClaudeTool, UpstreamError, upstreamErrorResponseParts } from "./claude.ts";
import { resolveProduct } from "./product-catalog.ts";
import { gatherEvidence, parseKevCatalog, parseNvdResponse, type Platform } from "./evidence.ts";
import { validateInsightsRequest, buildInsightsPrompt, INSIGHTS_TOOL, validateInsightsOutput, assembleInsightsResponse, InvalidOutput, type InsightsRequest } from "./insights.ts";
import { validateInterpretRequest, buildInterpretPrompt, INTERPRET_TOOL, validateInterpretOutput, InvalidInterpretation, type InterpretRequest } from "./interpret.ts";

export type Deps = {
  env: (name: string) => string | undefined;
  clientIp: string;
  admissionStore: () => CasStore;
  cacheStore: () => JsonKv | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export const MODEL = "claude-sonnet-5";
const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const NVD_LOOKBACK_DAYS = 120; // NVD's maximum publish-date window per query

export const INSIGHTS_POLICY: Policy = {
  name: "ai-insights",
  perClientPerHour: 6,
  perClientPerDay: 15,
  globalRequestsPerDay: 300,
  globalTokensPerDay: 3_000_000,
  maxConcurrent: 4,
  leaseMs: 60_000,
};
export const INTERPRET_POLICY: Policy = {
  name: "other-text-interpret",
  perClientPerHour: 10,
  perClientPerDay: 30,
  globalRequestsPerDay: 500,
  globalTokensPerDay: 1_000_000,
  maxConcurrent: 4,
  leaseMs: 40_000,
};

const INSIGHTS_MAX_BODY = 96 * 1024;
const INTERPRET_MAX_BODY = 16 * 1024;
const INSIGHTS_MAX_TOKENS = 3000;
const INTERPRET_MAX_TOKENS = 900;

function log(fn: string, requestId: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ fn, requestId, ...fields }));
}

// Canonical JSON (sorted keys) so the duplicate-request lock matches
// logically identical bodies regardless of key order.
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

type Admitted = { store: CasStore; ticket: Ticket };
async function admitOrRespond(fn: string, deps: Deps, policy: Policy, body: unknown, estimated: number, requestId: string): Promise<{ response: Response } | Admitted> {
  const salt = deps.env("RATE_LIMIT_SALT") || "simplifiedcs-rate-limit";
  const clientHash = await hashClient(deps.clientIp || "unknown", salt);
  const requestHash = (await sha256Hex(canonical(body))).slice(0, 32);
  let store: CasStore;
  try {
    store = deps.admissionStore();
    const result = await admit(store, policy, { clientHash, requestHash, estimatedTokens: estimated, now: deps.now?.(), sleep: deps.sleep });
    if (!result.ok) {
      log(fn, requestId, { event: "rejected", code: result.code });
      return { response: errorResponse(result.status, result.code, result.message, requestId, result.retryAfterSeconds) };
    }
    return { store, ticket: result.ticket };
  } catch (e) {
    // Fail closed: if limits can't be checked, no metered call is made.
    log(fn, requestId, { event: "admission_unavailable", reason: e instanceof AdmissionUnavailable ? e.message : "unexpected" });
    return { response: errorResponse(503, "limits_unavailable", "AI features are temporarily unavailable because usage limits can't be checked. The rest of your report is unaffected.", requestId, 30) };
  }
}

function maybeCleanup(deps: Deps, store: CasStore, policy: Policy) {
  if ((deps.random ?? Math.random)() < 0.04) void cleanup(store, policy, deps.now?.()).catch(() => {});
}

export async function handleInsights(req: Request, deps: Deps): Promise<Response> {
  const fn = "ai-insights";
  const requestId = newRequestId();
  const started = (deps.now ?? Date.now)();
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Use POST.", requestId);
  const apiKey = deps.env("ANTHROPIC_API_KEY");
  if (!apiKey) return errorResponse(503, "not_configured", "AI insights are not configured on this deployment.", requestId);

  const parsed = await readJsonBody(req, INSIGHTS_MAX_BODY, requestId);
  if (!parsed.ok) return parsed.response;
  const invalid = validateInsightsRequest(parsed.value);
  if (invalid) {
    const consent = invalid.startsWith("body.consent");
    return errorResponse(400, consent ? "consent_required" : "invalid_request", consent ? "AI processing needs your explicit consent first." : invalid, requestId);
  }
  const body = parsed.value as InsightsRequest;

  const products = body.products.map((p, i) => resolveProduct(p.category, p.name, i));
  const estimated = estimateTokens(JSON.stringify(body).length + 8000, INSIGHTS_MAX_TOKENS);
  const admission = await admitOrRespond(fn, deps, INSIGHTS_POLICY, body, estimated, requestId);
  if ("response" in admission) return admission.response;
  const { store, ticket } = admission;

  let tokensUsed = 0;
  try {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const cache = deps.cacheStore();
    const nowMs = (deps.now ?? Date.now)();
    const bundle = await gatherEvidence({
      products,
      orgPlatforms: (body.platforms as Platform[] | undefined) ?? null,
      maxNvdQueries: 4,
      now: nowMs,
      loadKev: () =>
        cachedJson(cache, "cisa-kev-v1", 6 * 3600_000, 7 * 24 * 3600_000, async () => {
          const res = await fetchWithTimeout(KEV_URL, 6000, {}, fetchImpl);
          if (!res.ok) throw new Error(`KEV ${res.status}`);
          return parseKevCatalog(await res.json());
        }, nowMs),
      searchNvd: async (term) => {
        const key = `nvd-v1/${(await sha256Hex(term)).slice(0, 24)}`;
        return cachedJson(cache, key, 12 * 3600_000, 3 * 24 * 3600_000, async () => {
          const end = new Date(nowMs);
          const start = new Date(nowMs - NVD_LOOKBACK_DAYS * 86_400_000);
          const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, "Z");
          const url = `${NVD_URL}?keywordSearch=${encodeURIComponent(term)}&pubStartDate=${iso(start)}&pubEndDate=${iso(end)}&resultsPerPage=20`;
          const res = await fetchWithTimeout(url, 6000, { headers: { accept: "application/json" } }, fetchImpl);
          if (!res.ok) throw new Error(`NVD ${res.status}`);
          return parseNvdResponse(await res.json());
        }, nowMs);
      },
    });
    const prompt = buildInsightsPrompt(body, products, bundle);
    const result = await callClaudeTool({ apiKey, model: MODEL, maxTokens: INSIGHTS_MAX_TOKENS, prompt, tool: INSIGHTS_TOOL, timeoutMs: 25_000, requestId, label: fn, fetchImpl });
    tokensUsed = result.inputTokens + result.outputTokens;
    const validated = validateInsightsOutput(result.input, bundle, products);
    log(fn, requestId, {
      event: "done",
      evidence: bundle.evidence.length,
      advisories: validated.advisories.length,
      patterns: validated.patterns.length,
      dropped: validated.dropped,
      ms: (deps.now ?? Date.now)() - started,
    });
    return jsonResponse(200, assembleInsightsResponse({ requestId, model: MODEL, snapshotId: body.snapshotId, bundle, validated, now: nowMs }), requestId);
  } catch (e) {
    if (e instanceof UpstreamError) {
      tokensUsed = e.tokensUsed;
      const parts = upstreamErrorResponseParts(e);
      return errorResponse(parts.status, parts.code, parts.message, requestId, parts.retryAfterSeconds);
    }
    if (e instanceof InvalidOutput) {
      log(fn, requestId, { event: "invalid_output", reason: e.message });
      return errorResponse(502, "output_invalid", "The AI response was incomplete or malformed, so it was discarded. Try again.", requestId);
    }
    log(fn, requestId, { event: "error", name: (e as Error)?.name });
    return errorResponse(500, "internal_error", "Something went wrong generating AI insights.", requestId);
  } finally {
    const settleError = await settle(store, ticket, tokensUsed, deps.sleep);
    if (settleError) log(fn, requestId, { event: "settle_failed", reason: settleError });
    maybeCleanup(deps, store, INSIGHTS_POLICY);
  }
}

export async function handleInterpret(req: Request, deps: Deps): Promise<Response> {
  const fn = "other-text-interpret";
  const requestId = newRequestId();
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Use POST.", requestId);
  const apiKey = deps.env("ANTHROPIC_API_KEY");
  if (!apiKey) return errorResponse(503, "not_configured", "AI interpretation is not configured on this deployment.", requestId);

  const parsed = await readJsonBody(req, INTERPRET_MAX_BODY, requestId);
  if (!parsed.ok) return parsed.response;
  const invalid = validateInterpretRequest(parsed.value);
  if (invalid) {
    const consent = invalid.startsWith("body.consent");
    return errorResponse(400, consent ? "consent_required" : "invalid_request", consent ? "AI processing needs your explicit consent first." : invalid, requestId);
  }
  const body = parsed.value as InterpretRequest;
  const prompt = buildInterpretPrompt(body.items);
  const admission = await admitOrRespond(fn, deps, INTERPRET_POLICY, body, estimateTokens(prompt.length, INTERPRET_MAX_TOKENS), requestId);
  if ("response" in admission) return admission.response;
  const { store, ticket } = admission;

  let tokensUsed = 0;
  try {
    const result = await callClaudeTool({ apiKey, model: MODEL, maxTokens: INTERPRET_MAX_TOKENS, prompt, tool: INTERPRET_TOOL, timeoutMs: 15_000, requestId, label: fn, fetchImpl: deps.fetchImpl });
    tokensUsed = result.inputTokens + result.outputTokens;
    const interpretations = validateInterpretOutput(result.input, body.items.length);
    return jsonResponse(200, { schemaVersion: 1, requestId, model: MODEL, interpretations }, requestId);
  } catch (e) {
    if (e instanceof UpstreamError) {
      tokensUsed = e.tokensUsed;
      const parts = upstreamErrorResponseParts(e);
      return errorResponse(parts.status, parts.code, parts.message, requestId, parts.retryAfterSeconds);
    }
    if (e instanceof InvalidInterpretation) {
      log(fn, requestId, { event: "invalid_output", reason: e.message });
      return errorResponse(502, "output_invalid", "The AI interpretation was incomplete or malformed, so it was discarded.", requestId);
    }
    log(fn, requestId, { event: "error", name: (e as Error)?.name });
    return errorResponse(500, "internal_error", "Something went wrong interpreting your text.", requestId);
  } finally {
    const settleError = await settle(store, ticket, tokensUsed, deps.sleep);
    if (settleError) log(fn, requestId, { event: "settle_failed", reason: settleError });
    maybeCleanup(deps, store, INTERPRET_POLICY);
  }
}
