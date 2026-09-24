// SEC-2b: the scheduled Edge Functions refuse anything but an authenticated
// POST from the scheduler, and only do work while holding the atomic lease.
// The lease SQL itself is exercised against real Postgres in
// test/supabase-policies.test.js; these cover the request gate and the
// wrapper's behaviour for every lease outcome.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifySchedulerRequest, secretsMatch } from "../supabase/functions/_shared/scheduler-auth.ts";
import { runWithJobLease } from "../supabase/functions/_shared/job-lease.ts";

const SECRET = "s".repeat(48);
const req = (method = "POST", headers = {}) => new Request("https://project.example.test/functions/v1/fetch-news", { method, headers });

test("only an authenticated POST gets through", async () => {
  assert.equal((await verifySchedulerRequest(req("GET", { "x-cron-secret": SECRET }), SECRET)).status, 405);
  assert.equal((await verifySchedulerRequest(req("POST"), SECRET)).status, 401, "missing secret");
  assert.equal((await verifySchedulerRequest(req("POST", { "x-cron-secret": "wrong" }), SECRET)).status, 401, "wrong secret");
  assert.equal((await verifySchedulerRequest(req("POST", { "x-cron-secret": SECRET.slice(0, -1) + "t" }), SECRET)).status, 401, "near-miss secret");
  assert.equal(await verifySchedulerRequest(req("POST", { "x-cron-secret": SECRET }), SECRET), null);
});

test("an anon/publishable JWT alone is not enough", async () => {
  const r = await verifySchedulerRequest(req("POST", { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.anon.key" }), SECRET);
  assert.equal(r.status, 401);
});

test("missing or weak server-side secret fails closed with a visible 503", async () => {
  assert.equal((await verifySchedulerRequest(req("POST", { "x-cron-secret": "" }), undefined)).status, 503);
  assert.equal((await verifySchedulerRequest(req("POST", { "x-cron-secret": "short" }), "short")).status, 503);
});

test("secretsMatch compares full values", async () => {
  assert.equal(await secretsMatch("abc", "abc"), true);
  assert.equal(await secretsMatch("abc", "abd"), false);
  assert.equal(await secretsMatch("", "abc"), false);
});

function fakeRpc({ acquire, acquireError = null, releaseError = null }) {
  const calls = [];
  return {
    calls,
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      if (fn === "try_acquire_job_lease") return { data: acquireError ? null : acquire, error: acquireError };
      if (fn === "release_job_lease") return { data: !releaseError, error: releaseError };
      throw new Error("unexpected rpc " + fn);
    },
  };
}
const opts = { job: "fetch-news", leaseSeconds: 300, minSinceStartSeconds: 900, minSinceSuccessSeconds: 72000 };

test("lease held elsewhere: skip without doing the work", async () => {
  const client = fakeRpc({ acquire: false });
  let ran = false;
  const res = await runWithJobLease(client, opts, async () => ((ran = true), { ok: true, body: {} }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).skipped, true);
  assert.equal(ran, false);
  assert.equal(client.calls.length, 1, "no release when nothing was acquired");
});

test("lease store unavailable (or migration not applied): fail closed, no work", async () => {
  const client = fakeRpc({ acquireError: { message: "function public.try_acquire_job_lease does not exist" } });
  let ran = false;
  const res = await runWithJobLease(client, opts, async () => ((ran = true), { ok: true, body: {} }));
  assert.equal(res.status, 503);
  assert.equal(ran, false);
});

test("successful run releases with ok; failed or throwing run releases with error", async () => {
  const ok = fakeRpc({ acquire: true });
  assert.equal((await runWithJobLease(ok, opts, async () => ({ ok: true, body: { upserted: 3 } }))).status, 200);
  assert.deepEqual(ok.calls.map((c) => c.fn), ["try_acquire_job_lease", "release_job_lease"]);
  assert.equal(ok.calls[1].args.p_status, "ok");
  assert.equal(ok.calls[0].args.p_holder, ok.calls[1].args.p_holder, "released by the same holder that acquired");
  assert.equal(ok.calls[0].args.p_min_since_success, 72000);

  const failed = fakeRpc({ acquire: true });
  assert.equal((await runWithJobLease(failed, opts, async () => ({ ok: false, body: {} }))).status, 500);
  assert.equal(failed.calls[1].args.p_status, "error");

  const thrown = fakeRpc({ acquire: true });
  const res = await runWithJobLease(thrown, opts, async () => {
    throw new Error("upstream exploded with secret-ish detail");
  });
  assert.equal(res.status, 500);
  assert.equal(thrown.calls[1].args.p_status, "error");
  assert.ok(!(await res.text()).includes("secret-ish"), "internal error detail is not echoed to the caller");
});

test("each invocation uses a fresh holder id", async () => {
  const a = fakeRpc({ acquire: false });
  const b = fakeRpc({ acquire: false });
  await runWithJobLease(a, opts, async () => ({ ok: true, body: {} }));
  await runWithJobLease(b, opts, async () => ({ ok: true, body: {} }));
  assert.notEqual(a.calls[0].args.p_holder, b.calls[0].args.p_holder);
});
