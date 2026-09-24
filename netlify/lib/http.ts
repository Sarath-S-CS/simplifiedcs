// HTTP helpers shared by the Netlify Functions (ai-insights,
// other-text-interpret). Pure Web-platform code (Request/Response/streams),
// no Netlify imports, so the Node test suite can exercise it directly.

export const BASE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function jsonResponse(status: number, body: unknown, requestId: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "x-request-id": requestId, ...extraHeaders },
  });
}

// One error shape for every failure: a stable machine-readable code, a short
// human message, the request id for support, and Retry-After when waiting
// will actually help. Never includes upstream response bodies or stack
// traces.
export function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  retryAfterSeconds?: number,
): Response {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds && retryAfterSeconds > 0) headers["retry-after"] = String(Math.ceil(retryAfterSeconds));
  return jsonResponse(status, { error: { code, message, retryAfterSeconds: retryAfterSeconds ? Math.ceil(retryAfterSeconds) : undefined }, requestId }, requestId, headers);
}

export type BodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

// Reads and parses a JSON body with a hard byte cap enforced while streaming
// - Content-Length is only used to reject early, never trusted to bound the
// read. Invalid UTF-8 and malformed JSON are 400s; oversize is 413; a
// non-JSON content type is 415.
export async function readJsonBody(req: Request, maxBytes: number, requestId: string): Promise<BodyResult> {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) {
    return { ok: false, response: errorResponse(415, "unsupported_media_type", "Send the request body as application/json.", requestId) };
  }
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: errorResponse(413, "body_too_large", `Request body exceeds ${maxBytes} bytes.`, requestId) };
  }
  if (!req.body) {
    return { ok: false, response: errorResponse(400, "empty_body", "Request body is required.", requestId) };
  }
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, response: errorResponse(413, "body_too_large", `Request body exceeds ${maxBytes} bytes.`, requestId) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: errorResponse(400, "unreadable_body", "Request body could not be read.", requestId) };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, response: errorResponse(400, "invalid_encoding", "Request body must be UTF-8.", requestId) };
  }
  if (!text.trim()) {
    return { ok: false, response: errorResponse(400, "empty_body", "Request body is required.", requestId) };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: errorResponse(400, "malformed_json", "Request body is not valid JSON.", requestId) };
  }
}

// fetch() with a timeout whose timer is always cleared, and an abort that
// surfaces as a recognisable TimeoutError.
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw new TimeoutError(new URL(url).hostname, ms);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Hashes a client identifier (IP) with a server-side salt so rate-limit keys
// never store raw addresses.
export async function hashClient(identifier: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${identifier}`));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
