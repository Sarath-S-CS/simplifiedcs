// Authentication for the scheduled Edge Functions (fetch-news,
// fetch-exploits, fetch-case-studies).
//
// verify_jwt stays on, but the only JWT the scheduler has is the project's
// public anon key - which is also embedded in the website, so it proves
// nothing about the caller. These jobs run with the service role and (for
// fetch-case-studies) spend money, so they additionally require a private
// scheduler credential: the CRON_SECRET Edge Function secret, sent by the
// GitHub Actions workflows in an `x-cron-secret` header from the
// SUPABASE_CRON_SECRET repository secret. CORS/Origin checks are not
// authentication and are not used here.
//
// If CRON_SECRET isn't configured the jobs refuse to run (503) rather than
// falling back to "anyone may trigger" - the workflows use --fail-with-body,
// so a missing secret shows up as a failed Actions run, not a silent stop.

const encoder = new TextEncoder();

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

// Compares fixed-length digests byte-by-byte without early exit, so response
// timing doesn't reveal how much of a guess was right.
export async function secretsMatch(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function json(status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extraHeaders } });
}

// Returns a ready-to-send error Response when the request must be refused,
// or null when the caller is the authorised scheduler.
export async function verifySchedulerRequest(req: Request, configuredSecret: string | undefined): Promise<Response | null> {
  if (req.method !== "POST") {
    return json(405, { error: "method not allowed" }, { allow: "POST" });
  }
  if (!configuredSecret || configuredSecret.length < 32) {
    return json(503, { error: "scheduler secret not configured" });
  }
  const provided = req.headers.get("x-cron-secret") || "";
  if (!provided || !(await secretsMatch(provided, configuredSecret))) {
    return json(401, { error: "unauthorized" });
  }
  return null;
}
