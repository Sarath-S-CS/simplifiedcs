// Runs a scheduled job's body only while holding an atomic lease
// (public.try_acquire_job_lease / release_job_lease - see
// supabase/migrations/20260924172314_job_leases.sql). Overlapping or
// repeated invocations get a cheap "skipped" instead of doing the work twice.

export type LeaseOptions = {
  job: string;
  leaseSeconds: number; // crash safety: an abandoned lease can be taken over after this
  minSinceStartSeconds?: number; // cost guard (paid jobs)
  minSinceSuccessSeconds?: number; // cadence guard (daily feeds)
};

export type JobOutcome = { ok: boolean; body: Record<string, unknown> };

// Minimal slice of the supabase-js client this needs - lets the Node tests
// pass a fake without pulling in the real client.
export type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function runWithJobLease(client: RpcClient, opts: LeaseOptions, work: () => Promise<JobOutcome>): Promise<Response> {
  const holder = crypto.randomUUID();
  const acquire = await client.rpc("try_acquire_job_lease", {
    p_job: opts.job,
    p_holder: holder,
    p_lease_seconds: opts.leaseSeconds,
    p_min_since_start: opts.minSinceStartSeconds ?? 0,
    p_min_since_success: opts.minSinceSuccessSeconds ?? 0,
  });
  if (acquire.error) {
    // Fail closed: without a lease there is no guarantee against a
    // concurrent run, so don't do the work. (Also what happens if the
    // job_leases migration hasn't been applied yet - visible, not silent.)
    console.error(`${opts.job}: lease unavailable:`, acquire.error.message);
    return json(503, { error: "job lease unavailable" });
  }
  if (acquire.data !== true) {
    return json(200, { skipped: true, reason: "another run is in progress or the job ran recently" });
  }

  let outcome: JobOutcome;
  try {
    outcome = await work();
  } catch (e) {
    console.error(`${opts.job}: failed:`, e);
    outcome = { ok: false, body: { error: "job failed" } };
  }
  const released = await client.rpc("release_job_lease", { p_job: opts.job, p_holder: holder, p_status: outcome.ok ? "ok" : "error" });
  if (released.error) console.error(`${opts.job}: lease release failed:`, released.error.message);
  return json(outcome.ok ? 200 : 500, outcome.body);
}
