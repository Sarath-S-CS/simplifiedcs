// Admission control for the metered AI endpoints (SEC-2a).
//
// Replaces the old per-IP "write a key, then count keys" limiter, which was
// not atomic (concurrent requests all counted before seeing each other),
// failed OPEN when storage errored, had no app-wide budget, no concurrency
// bound and no duplicate detection.
//
// Everything here is a compare-and-swap on Netlify Blobs using its
// conditional writes (`onlyIfNew` / `onlyIfMatch` on an ETag - available in
// @netlify/blobs >= 10; this repo pins 11.x). A lost race simply re-reads
// and retries, so each counter increments exactly once per admitted request.
//
// Layers, cheapest rejection first:
//   1. read-only pre-check of the client's window and the daily budget
//   2. duplicate lock   - one identical request per client at a time (409)
//   3. concurrency slot - at most N upstream calls in flight site-wide (503)
//   4. client window    - per-client hourly + daily caps (429)
//   5. daily budget     - site-wide request count and token budget (429)
// The token budget is an estimate reserved up front and corrected with the
// provider's reported usage afterwards. It is a request/token ceiling, NOT a
// currency cap - keep the provider-side monthly spend limit configured too.
//
// Any storage failure raises AdmissionUnavailable; callers must answer 503
// and make no upstream call (fail closed). The rules-only report never
// depends on these endpoints, so it stays fully usable.

export interface CasStore {
  getWithMetadata(key: string, opts: { type: "json" }): Promise<{ data: any; etag?: string } | null>;
  setJSON(key: string, value: unknown, opts?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean; etag?: string }>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
}

export type Policy = {
  name: string;
  perClientPerHour: number;
  perClientPerDay: number;
  globalRequestsPerDay: number;
  globalTokensPerDay: number;
  maxConcurrent: number;
  leaseMs: number; // must exceed the endpoint's worst-case run time
};

export type Ticket = {
  policy: Policy;
  budgetKey: string;
  reservedTokens: number;
  slotKey: string;
  dedupeKey: string;
  holder: string;
};

export type Rejection = { ok: false; status: 409 | 429 | 503; code: string; message: string; retryAfterSeconds: number };
export type AdmissionResult = { ok: true; ticket: Ticket } | Rejection;

export class AdmissionUnavailable extends Error {
  constructor(reason: string) {
    super(`admission control unavailable: ${reason}`);
    this.name = "AdmissionUnavailable";
  }
}

const HOUR = 3_600_000;

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

type Decision<T> = { next: T } | { reject: Rejection } | { skip: true };

// Read-modify-write with an ETag precondition; retries on a lost race.
async function casUpdate<T>(
  store: CasStore,
  key: string,
  mutate: (current: T | null) => Decision<T>,
  sleep: (ms: number) => Promise<void>,
  maxAttempts = 10,
): Promise<{ ok: true; value: T } | Rejection | { skipped: true }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let current: { data: any; etag?: string } | null;
    try {
      current = await store.getWithMetadata(key, { type: "json" });
    } catch (e) {
      throw new AdmissionUnavailable(`read failed (${(e as Error).message})`);
    }
    const decision = mutate(current ? (current.data as T) : null);
    if ("reject" in decision) return decision.reject;
    if ("skip" in decision) return { skipped: true };
    let result: { modified: boolean } | undefined;
    try {
      result = current
        ? await store.setJSON(key, decision.next, { onlyIfMatch: current.etag })
        : await store.setJSON(key, decision.next, { onlyIfNew: true });
    } catch (e) {
      throw new AdmissionUnavailable(`write failed (${(e as Error).message})`);
    }
    if (!result || typeof result.modified !== "boolean") throw new AdmissionUnavailable("store does not support conditional writes");
    if (result.modified) return { ok: true, value: decision.next };
    await sleep(3 + Math.random() * 15 * (attempt + 1));
  }
  throw new AdmissionUnavailable("too much contention");
}

type Lease = { holder: string; expiresAt: number };
type ClientWindow = { hour: number[]; day: number };
type Budget = { requests: number; tokens: number };

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Takes a lease key if it's free or expired. Returns true when this holder
// now owns it.
async function takeLease(store: CasStore, key: string, holder: string, now: number, leaseMs: number, sleep: (ms: number) => Promise<void>): Promise<{ taken: true } | { taken: false; expiresAt: number }> {
  let heldUntil = 0;
  const r = await casUpdate<Lease>(
    store,
    key,
    (cur) => {
      if (cur && cur.expiresAt > now) {
        heldUntil = cur.expiresAt;
        return { skip: true };
      }
      return { next: { holder, expiresAt: now + leaseMs } };
    },
    sleep,
  );
  return "skipped" in r ? { taken: false, expiresAt: heldUntil } : { taken: true };
}

// Releases a lease only if this holder still owns it (an expired lease that
// someone else took over is left alone).
async function releaseLease(store: CasStore, key: string, holder: string, sleep: (ms: number) => Promise<void>): Promise<void> {
  await casUpdate<Lease>(store, key, (cur) => (cur && cur.holder === holder ? { next: { holder, expiresAt: 0 } } : { skip: true }), sleep);
}

export type AdmitInput = {
  clientHash: string;
  requestHash: string;
  estimatedTokens: number;
  now?: number;
  sleep?: (ms: number) => Promise<void>;
};

export async function admit(store: CasStore, policy: Policy, input: AdmitInput): Promise<AdmissionResult> {
  const now = input.now ?? Date.now();
  const sleep = input.sleep ?? defaultSleep;
  const day = utcDay(now);
  const clientKey = `${policy.name}/client/${day}/${input.clientHash}`;
  const budgetKey = `${policy.name}/budget/${day}`;
  const dedupeKey = `${policy.name}/inflight/${input.clientHash}-${input.requestHash}`;
  const holder = crypto.randomUUID();
  const untilMidnight = secondsUntilUtcMidnight(now);

  const dailyCapacity: Rejection = { ok: false, status: 429, code: "daily_capacity_reached", message: "AI features have reached today's usage limit. The rest of your report is unaffected; try again tomorrow.", retryAfterSeconds: untilMidnight };
  const clientRejection = (w: ClientWindow): Rejection | null => {
    const recent = (w.hour || []).filter((t) => t > now - HOUR);
    if ((w.day || 0) >= policy.perClientPerDay) {
      return { ok: false, status: 429, code: "client_daily_limit", message: "You've reached today's limit for this AI feature. Try again tomorrow.", retryAfterSeconds: untilMidnight };
    }
    if (recent.length >= policy.perClientPerHour) {
      const retry = Math.ceil((Math.min(...recent) + HOUR - now) / 1000);
      return { ok: false, status: 429, code: "client_hourly_limit", message: "Too many requests from your connection this hour. Try again later.", retryAfterSeconds: Math.max(1, retry) };
    }
    return null;
  };
  const budgetExceeded = (b: Budget) => b.requests + 1 > policy.globalRequestsPerDay || b.tokens + input.estimatedTokens > policy.globalTokensPerDay;

  // 1. Read-only pre-check: reject obvious over-limit callers without writing.
  let pre: [{ data: any } | null, { data: any } | null];
  try {
    pre = await Promise.all([store.getWithMetadata(clientKey, { type: "json" }), store.getWithMetadata(budgetKey, { type: "json" })]);
  } catch (e) {
    throw new AdmissionUnavailable(`read failed (${(e as Error).message})`);
  }
  const preClient = pre[0] ? clientRejection(pre[0].data as ClientWindow) : null;
  if (preClient) return preClient;
  if (pre[1] && budgetExceeded(pre[1].data as Budget)) return dailyCapacity;

  // 2. Duplicate lock (same client + same request body).
  const dup = await takeLease(store, dedupeKey, holder, now, policy.leaseMs, sleep);
  if (!dup.taken) {
    return { ok: false, status: 409, code: "duplicate_in_progress", message: "An identical request is already being processed. Wait for it to finish.", retryAfterSeconds: Math.max(1, Math.ceil((dup.expiresAt - now) / 1000)) };
  }

  const releaseAll = async (slotKey?: string) => {
    if (slotKey) await releaseLease(store, slotKey, holder, sleep);
    await releaseLease(store, dedupeKey, holder, sleep);
  };

  // 3. Concurrency slot.
  let slotKey: string | undefined;
  for (let i = 0; i < policy.maxConcurrent && !slotKey; i++) {
    const key = `${policy.name}/slot/${i}`;
    if ((await takeLease(store, key, holder, now, policy.leaseMs, sleep)).taken) slotKey = key;
  }
  if (!slotKey) {
    await releaseAll();
    return { ok: false, status: 503, code: "busy", message: "The AI service is busy right now. Try again in a few seconds.", retryAfterSeconds: 5 };
  }

  // 4. Per-client window (atomic increment).
  const client = await casUpdate<ClientWindow>(
    store,
    clientKey,
    (cur) => {
      const w = cur ?? { hour: [], day: 0 };
      const rej = clientRejection(w);
      if (rej) return { reject: rej };
      return { next: { hour: [...(w.hour || []).filter((t) => t > now - HOUR), now], day: (w.day || 0) + 1 } };
    },
    sleep,
  );
  if (!("value" in client)) {
    await releaseAll(slotKey);
    return client as Rejection;
  }

  // 5. Site-wide daily budget (atomic reservation).
  const budget = await casUpdate<Budget>(
    store,
    budgetKey,
    (cur) => {
      const b = cur ?? { requests: 0, tokens: 0 };
      if (budgetExceeded(b)) return { reject: dailyCapacity };
      return { next: { requests: b.requests + 1, tokens: b.tokens + input.estimatedTokens } };
    },
    sleep,
  );
  if (!("value" in budget)) {
    await releaseAll(slotKey);
    return budget as Rejection;
  }

  return { ok: true, ticket: { policy, budgetKey, reservedTokens: input.estimatedTokens, slotKey, dedupeKey, holder } };
}

// Corrects the token reservation with actual usage (0 when the upstream
// call never happened) and releases the slot and duplicate lock. Failures
// are reported, never thrown - the response has already been decided.
export async function settle(store: CasStore, ticket: Ticket, actualTokens: number, sleep: (ms: number) => Promise<void> = defaultSleep): Promise<string | null> {
  try {
    const delta = Math.round(actualTokens - ticket.reservedTokens);
    if (delta !== 0) {
      await casUpdate<Budget>(store, ticket.budgetKey, (cur) => (cur ? { next: { requests: cur.requests, tokens: Math.max(0, cur.tokens + delta) } } : { skip: true }), sleep);
    }
    await releaseLease(store, ticket.slotKey, ticket.holder, sleep);
    await releaseLease(store, ticket.dedupeKey, ticket.holder, sleep);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// Bounded retention: per-client windows are bucketed by UTC day and deleted
// two days later; budget buckets after eight days; abandoned duplicate locks
// (a crashed request) once expired. Run occasionally, never awaited on the
// request path.
export async function cleanup(store: CasStore, policy: Policy, now = Date.now(), maxDeletes = 200): Promise<number> {
  let deleted = 0;
  const del = async (key: string) => {
    if (deleted >= maxDeletes) return;
    await store.delete(key);
    deleted++;
  };
  const twoDaysAgo = utcDay(now - 2 * 24 * HOUR);
  for (const b of (await store.list({ prefix: `${policy.name}/client/${twoDaysAgo}/` })).blobs) await del(b.key);
  for (let d = 8; d <= 14; d++) {
    const key = `${policy.name}/budget/${utcDay(now - d * 24 * HOUR)}`;
    if (await store.getWithMetadata(key, { type: "json" })) await del(key);
  }
  for (const b of (await store.list({ prefix: `${policy.name}/inflight/` })).blobs.slice(0, 50)) {
    const cur = await store.getWithMetadata(b.key, { type: "json" });
    if (cur && (cur.data as Lease).expiresAt < now - HOUR) await del(b.key);
  }
  return deleted;
}

export function estimateTokens(promptChars: number, maxOutputTokens: number): number {
  // ~3.5 characters per token for English prompt text, rounded up, plus the
  // full output allowance (the reservation must cover the worst case).
  return Math.ceil(promptChars / 3.5) + 600 + maxOutputTokens;
}
