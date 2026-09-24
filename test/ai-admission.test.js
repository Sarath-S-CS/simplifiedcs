// SEC-2a: admission control for the metered AI endpoints. The fake store
// implements Netlify Blobs' conditional-write semantics (onlyIfNew /
// onlyIfMatch on an ETag) and yields between every read and write, so
// concurrent admissions genuinely interleave - the races these tests check
// for are real, not serialized away.
import { test } from "node:test";
import assert from "node:assert/strict";
import { admit, settle, cleanup, utcDay, AdmissionUnavailable } from "../netlify/lib/admission.ts";

function casStore({ failReads = false, failWrites = false } = {}) {
  const data = new Map();
  let etagSeq = 0;
  const tick = () => new Promise((r) => setImmediate(r));
  return {
    data,
    async getWithMetadata(key) {
      await tick();
      if (failReads) throw new Error("blobs unavailable");
      const e = data.get(key);
      return e ? { data: JSON.parse(e.json), etag: e.etag } : null;
    },
    async setJSON(key, value, opts = {}) {
      await tick();
      if (failWrites) throw new Error("blobs unavailable");
      const cur = data.get(key);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch !== undefined && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = `e${++etagSeq}`;
      data.set(key, { json: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
    async delete(key) {
      await tick();
      data.delete(key);
    },
    async list({ prefix }) {
      await tick();
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

const policy = (over = {}) => ({ name: "t", perClientPerHour: 5, perClientPerDay: 8, globalRequestsPerDay: 100, globalTokensPerDay: 1_000_000, maxConcurrent: 50, leaseMs: 60_000, ...over });
const noSleep = () => new Promise((r) => setImmediate(r));
const NOW = Date.UTC(2026, 8, 24, 12, 0, 0);

test("concurrent requests from one client: exactly the hourly limit is admitted", async () => {
  const store = casStore();
  const p = policy({ perClientPerHour: 5 });
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => admit(store, p, { clientHash: "c1", requestHash: `r${i}`, estimatedTokens: 100, now: NOW, sleep: noSleep })),
  );
  assert.equal(results.filter((r) => r.ok).length, 5);
  for (const r of results.filter((x) => !x.ok)) {
    assert.equal(r.status, 429);
    assert.equal(r.code, "client_hourly_limit");
    assert.ok(r.retryAfterSeconds > 0);
  }
  const stored = JSON.parse(store.data.get(`t/client/${utcDay(NOW)}/c1`).json);
  assert.equal(stored.hour.length, 5, "counter incremented exactly once per admitted request");
});

test("site-wide request budget holds under concurrency across many clients", async () => {
  const store = casStore();
  const p = policy({ globalRequestsPerDay: 7 });
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) => admit(store, p, { clientHash: `c${i}`, requestHash: "r", estimatedTokens: 10, now: NOW, sleep: noSleep })),
  );
  assert.equal(results.filter((r) => r.ok).length, 7);
  assert.ok(results.filter((r) => !r.ok).every((r) => r.code === "daily_capacity_reached" && r.status === 429));
});

test("token budget: reservation blocks overspend, settle refunds unused tokens", async () => {
  const store = casStore();
  const p = policy({ globalTokensPerDay: 1000 });
  const a = await admit(store, p, { clientHash: "a", requestHash: "1", estimatedTokens: 600, now: NOW, sleep: noSleep });
  assert.ok(a.ok);
  const b = await admit(store, p, { clientHash: "b", requestHash: "1", estimatedTokens: 600, now: NOW, sleep: noSleep });
  assert.equal(b.ok, false, "second reservation would exceed the token budget");
  assert.equal(await settle(store, a.ticket, 200, noSleep), null);
  const c = await admit(store, p, { clientHash: "c", requestHash: "1", estimatedTokens: 600, now: NOW, sleep: noSleep });
  assert.ok(c.ok, "after settling actual usage (200), 600 more fits");
});

test("a failed upstream call refunds its whole reservation", async () => {
  const store = casStore();
  const p = policy();
  const a = await admit(store, p, { clientHash: "a", requestHash: "1", estimatedTokens: 5000, now: NOW, sleep: noSleep });
  await settle(store, a.ticket, 0, noSleep);
  const budget = JSON.parse(store.data.get(`t/budget/${utcDay(NOW)}`).json);
  assert.equal(budget.tokens, 0);
  assert.equal(budget.requests, 1, "the attempt still counts as a request");
});

test("identical concurrent requests from one client: one proceeds, the rest get 409", async () => {
  const store = casStore();
  const results = await Promise.all(
    Array.from({ length: 6 }, () => admit(store, policy(), { clientHash: "c1", requestHash: "same", estimatedTokens: 10, now: NOW, sleep: noSleep })),
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.ok(results.filter((r) => !r.ok).every((r) => r.status === 409 && r.code === "duplicate_in_progress"));
});

test("the duplicate lock is released after settle, so a retry is admitted", async () => {
  const store = casStore();
  const first = await admit(store, policy(), { clientHash: "c1", requestHash: "same", estimatedTokens: 10, now: NOW, sleep: noSleep });
  await settle(store, first.ticket, 10, noSleep);
  const again = await admit(store, policy(), { clientHash: "c1", requestHash: "same", estimatedTokens: 10, now: NOW + 1000, sleep: noSleep });
  assert.ok(again.ok);
});

test("concurrency slots cap simultaneous upstream calls; expired slots are reclaimed", async () => {
  const store = casStore();
  const p = policy({ maxConcurrent: 2, leaseMs: 30_000 });
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) => admit(store, p, { clientHash: `c${i}`, requestHash: "r", estimatedTokens: 10, now: NOW, sleep: noSleep })),
  );
  const admitted = results.filter((r) => r.ok);
  assert.equal(admitted.length, 2);
  assert.ok(results.filter((r) => !r.ok).every((r) => r.status === 503 && r.code === "busy" && r.retryAfterSeconds > 0));
  // A crashed request never settles; its slot becomes available after the lease expires.
  const later = await admit(store, p, { clientHash: "late", requestHash: "r", estimatedTokens: 10, now: NOW + 31_000, sleep: noSleep });
  assert.ok(later.ok);
});

test("a rejected request does not keep holding a slot or duplicate lock", async () => {
  const store = casStore();
  const p = policy({ maxConcurrent: 1, perClientPerHour: 1 });
  const a = await admit(store, p, { clientHash: "c1", requestHash: "1", estimatedTokens: 10, now: NOW, sleep: noSleep });
  await settle(store, a.ticket, 10, noSleep);
  const b = await admit(store, p, { clientHash: "c1", requestHash: "2", estimatedTokens: 10, now: NOW, sleep: noSleep });
  assert.equal(b.code, "client_hourly_limit");
  const c = await admit(store, p, { clientHash: "c2", requestHash: "1", estimatedTokens: 10, now: NOW, sleep: noSleep });
  assert.ok(c.ok, "the single slot is free again after c1's rejection");
});

test("daily per-client cap resets on the next UTC day", async () => {
  const store = casStore();
  const p = policy({ perClientPerHour: 100, perClientPerDay: 2 });
  for (let i = 0; i < 2; i++) {
    const r = await admit(store, p, { clientHash: "c", requestHash: `${i}`, estimatedTokens: 1, now: NOW + i, sleep: noSleep });
    await settle(store, r.ticket, 1, noSleep);
  }
  const blocked = await admit(store, p, { clientHash: "c", requestHash: "x", estimatedTokens: 1, now: NOW + 10, sleep: noSleep });
  assert.equal(blocked.code, "client_daily_limit");
  const tomorrow = await admit(store, p, { clientHash: "c", requestHash: "y", estimatedTokens: 1, now: NOW + 24 * 3600_000, sleep: noSleep });
  assert.ok(tomorrow.ok);
});

test("storage outage fails closed (throws AdmissionUnavailable, no admission)", async () => {
  await assert.rejects(() => admit(casStore({ failReads: true }), policy(), { clientHash: "c", requestHash: "r", estimatedTokens: 1, now: NOW, sleep: noSleep }), AdmissionUnavailable);
  await assert.rejects(() => admit(casStore({ failWrites: true }), policy(), { clientHash: "c", requestHash: "r", estimatedTokens: 1, now: NOW, sleep: noSleep }), AdmissionUnavailable);
});

test("a store without conditional-write support is treated as unavailable", async () => {
  const store = casStore();
  store.setJSON = async () => undefined;
  await assert.rejects(() => admit(store, policy(), { clientHash: "c", requestHash: "r", estimatedTokens: 1, now: NOW, sleep: noSleep }), AdmissionUnavailable);
});

test("cleanup removes old per-client windows and abandoned locks, keeps today's", async () => {
  const store = casStore();
  const p = policy();
  const old = NOW - 2 * 24 * 3600_000;
  await admit(store, p, { clientHash: "old", requestHash: "r", estimatedTokens: 1, now: old, sleep: noSleep });
  await admit(store, p, { clientHash: "today", requestHash: "r", estimatedTokens: 1, now: NOW, sleep: noSleep });
  const removed = await cleanup(store, p, NOW);
  assert.ok(removed >= 2, "the two-day-old window and its abandoned (never settled) lock are removed");
  assert.ok(![...store.data.keys()].some((k) => k.includes("/client/") && k.endsWith("/old")));
  assert.ok([...store.data.keys()].some((k) => k.endsWith("/today")));
});

test("cleanup also removes per-client windows older than two days (a quiet day doesn't strand them)", async () => {
  const store = casStore();
  const p = policy();
  await admit(store, p, { clientHash: "fiveDaysAgo", requestHash: "r", estimatedTokens: 1, now: NOW - 5 * 24 * 3600_000, sleep: noSleep });
  await admit(store, p, { clientHash: "yesterday", requestHash: "r2", estimatedTokens: 1, now: NOW - 24 * 3600_000, sleep: noSleep });
  await cleanup(store, p, NOW);
  const keys = [...store.data.keys()].filter((k) => k.includes("/client/"));
  assert.ok(!keys.some((k) => k.endsWith("/fiveDaysAgo")));
  assert.ok(keys.some((k) => k.endsWith("/yesterday")), "yesterday's window is still needed for the rolling limit");
});
