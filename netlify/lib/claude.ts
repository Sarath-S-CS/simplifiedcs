// One forced tool call to the Anthropic Messages API, with every way it can
// go wrong surfaced as a typed UpstreamError instead of being normalised into
// an "empty" success (SEC-4b / AI-0: a truncated tool call used to come back
// as {} and be shown as "nothing found").
//
// Logging is operational metadata only (request id, status, stop reason,
// token counts, latency) - never prompt or response content, which contains
// the visitor's assessment answers.
import { fetchWithTimeout, TimeoutError } from "./http.ts";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };

export type ClaudeCall = {
  apiKey: string;
  model: string;
  maxTokens: number;
  prompt: string;
  tool: ToolSpec;
  timeoutMs: number;
  requestId: string;
  label: string; // function name, for logs
  fetchImpl?: typeof fetch;
};

export type ClaudeResult = { input: unknown; inputTokens: number; outputTokens: number; stopReason: string };

export type UpstreamKind = "timeout" | "http" | "truncated" | "no_tool" | "refusal" | "bad_response";

export class UpstreamError extends Error {
  kind: UpstreamKind;
  status: number | undefined;
  tokensUsed: number;
  constructor(kind: UpstreamKind, message: string, status?: number, tokensUsed = 0) {
    super(message);
    this.name = "UpstreamError";
    this.kind = kind;
    this.status = status;
    this.tokensUsed = tokensUsed;
  }
}

function log(call: ClaudeCall, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: call.label, requestId: call.requestId, event: "upstream", ...fields }));
}

export async function callClaudeTool(call: ClaudeCall): Promise<ClaudeResult> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      ANTHROPIC_URL,
      call.timeoutMs,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": call.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: call.model,
          max_tokens: call.maxTokens,
          messages: [{ role: "user", content: call.prompt }],
          tools: [call.tool],
          tool_choice: { type: "tool", name: call.tool.name },
        }),
      },
      call.fetchImpl,
    );
  } catch (e) {
    const kind: UpstreamKind = e instanceof TimeoutError ? "timeout" : "http";
    log(call, { outcome: kind, ms: Date.now() - started });
    throw new UpstreamError(kind, kind === "timeout" ? "model request timed out" : "model request failed");
  }
  if (!res.ok) {
    // Body intentionally not read into logs or errors - it can echo input.
    await res.body?.cancel().catch(() => {});
    log(call, { outcome: "http", status: res.status, ms: Date.now() - started });
    throw new UpstreamError("http", `model API returned ${res.status}`, res.status);
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    log(call, { outcome: "bad_response", ms: Date.now() - started });
    throw new UpstreamError("bad_response", "model API returned unreadable JSON");
  }
  const inputTokens = Number(data?.usage?.input_tokens) || 0;
  const outputTokens = Number(data?.usage?.output_tokens) || 0;
  const tokensUsed = inputTokens + outputTokens;
  const stopReason = String(data?.stop_reason ?? "");
  log(call, { outcome: "ok", stopReason, inputTokens, outputTokens, ms: Date.now() - started });

  if (stopReason === "max_tokens") throw new UpstreamError("truncated", "model reply was cut off before finishing", undefined, tokensUsed);
  if (stopReason === "refusal") throw new UpstreamError("refusal", "model declined to answer", undefined, tokensUsed);
  const toolUse = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === "tool_use" && b?.name === call.tool.name) : undefined;
  if (!toolUse || toolUse.input === null || typeof toolUse.input !== "object") {
    throw new UpstreamError("no_tool", "model reply did not contain the expected structured result", undefined, tokensUsed);
  }
  return { input: toolUse.input, inputTokens, outputTokens, stopReason };
}

// Client-facing error for each upstream failure kind (no internals).
export function upstreamErrorResponseParts(e: UpstreamError): { status: number; code: string; message: string; retryAfterSeconds?: number } {
  switch (e.kind) {
    case "timeout":
      return { status: 504, code: "upstream_timeout", message: "The AI service took too long to respond. Try again in a moment.", retryAfterSeconds: 10 };
    case "http":
      return e.status === 429 || e.status === 529 || (e.status ?? 0) >= 500
        ? { status: 503, code: "upstream_unavailable", message: "The AI service is temporarily unavailable. Try again shortly.", retryAfterSeconds: 30 }
        : { status: 502, code: "upstream_error", message: "The AI service rejected the request." };
    case "truncated":
      return { status: 502, code: "output_truncated", message: "The AI response was cut off before it finished, so it was discarded. Try again." };
    case "refusal":
      return { status: 502, code: "output_refused", message: "The AI service declined to produce insights for this report." };
    default:
      return { status: 502, code: "output_invalid", message: "The AI response was incomplete or malformed, so it was discarded. Try again." };
  }
}
