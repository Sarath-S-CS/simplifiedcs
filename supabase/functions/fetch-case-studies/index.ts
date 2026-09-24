// Triggered manually via .github/workflows/fetch-case-studies.yml (same
// thin-POST pattern as fetch-news/fetch-exploits - GitHub Actions just
// triggers this, all the real work happens here) - deliberately
// workflow_dispatch only, no `schedule:` cron, run whenever the site owner
// decides there's a need rather than automatically. Unlike fetch-news/
// fetch-exploits, there is no free, structured, machine-readable feed of
// "major global cyber incidents with narrative detail" the way there is for
// CISA KEV/NVD - writing a genuine "what happened / how / what was
// exfiltrated / lesson / safeguard" summary is inherently research-and-
// synthesis work, not field reformatting. This function therefore calls the
// Claude API (with its server-side web search tool) to research and draft
// candidate incidents, then applies its own defensive validation before
// writing anything.
//
// This is NOT a $0 job like its siblings - every real run that reaches the
// Claude call costs a genuine API call, win or lose (found something or
// not) - part of why it's manual-only rather than scheduled. That tradeoff
// was an explicit, informed choice by the site owner: there is no free
// structured alternative that can produce this depth of content, and the
// conservative reporting bar below (skip anything not clearly verifiable)
// was also their explicit choice over "publish whatever is found".
//
// Requires the ANTHROPIC_API_KEY Supabase Edge Function secret (Project
// Settings > Edge Functions > Secrets in the dashboard - never committed to
// this repo, same pattern as VULNCHECK_API_KEY in fetch-exploits). This
// function no-ops cleanly if it isn't set, same as fetchVulncheck() does in
// fetch-exploits.
//
// Writes with the service-role key, bypassing RLS - the public only ever
// gets read access (see the "Public read access" policy in the
// create_case_studies migration).

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifySchedulerRequest } from "../_shared/scheduler-auth.ts";
import { runWithJobLease, type JobOutcome } from "../_shared/job-lease.ts";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-opus-5";
const CLAUDE_TIMEOUT_MS = 110_000; // web search + synthesis takes meaningfully longer than a plain completion
const CLAUDE_MAX_TOKENS = 8000;
const WEB_SEARCH_MAX_USES = 12;

// Cost-runaway guard: at most one attempt per MIN_RUN_INTERVAL_HOURS,
// counted from when the last attempt *started* (not from a successful
// write - the expected common outcome is finding nothing). Enforced by the
// atomic job lease (public.try_acquire_job_lease, min-since-start), which
// also stops two overlapping invocations from both paying for a model call.
// Callers must also present the private scheduler secret. case_study_fetch_log
// is kept as the audit trail of attempts and their errors.
// Short, not the ~20h the daily feeds use - this job is run manually, and
// the site owner may legitimately want to re-run it soon after a fix.
const MIN_RUN_INTERVAL_HOURS = 1;
// Case studies are a curated, high-bar list (nine hand-picked watershed
// incidents at the time this was built), not an ever-growing headline feed
// like news_items - cap retention generously above that so genuine growth
// over the coming months/years isn't truncated, without being unbounded.
const RETENTION_CAP = 40;

function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

type Candidate = {
  external_id?: string;
  year?: string;
  incident_date?: string;
  title?: string;
  href?: string;
  source_name?: string;
  summary_what?: string;
  summary_how?: string;
  summary_impact?: string;
  summary_lesson?: string;
  summary_safeguard?: string;
};

const REPORT_TOOL = {
  name: "report_case_study_candidates",
  description:
    "Report any genuinely major, watershed-caliber cybersecurity incidents you found via web search that are not already in the existing list, each backed by a real, verifiable, non-Wikipedia authoritative source. Call this exactly once, as your final action, even when candidates is empty.",
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description:
          "Zero or more qualifying incidents. An empty array is the correct, expected result on most runs - never invent or guess at an incident just to avoid returning empty.",
        items: {
          type: "object",
          properties: {
            external_id: { type: "string", description: "Stable kebab-case slug, e.g. 'company-name-2026'." },
            year: { type: "string" },
            incident_date: { type: "string", description: "YYYY-MM-DD if confidently known from a source, else an empty string." },
            title: { type: "string" },
            href: {
              type: "string",
              description:
                "A real, authoritative, non-Wikipedia source URL you actually found via search - an official government advisory, the affected organization's or a directly-involved vendor's own incident disclosure, or a highly reputable security-journalism outlet.",
            },
            source_name: { type: "string", description: "e.g. 'CISA', 'Krebs on Security'." },
            summary_what: { type: "string", description: "2-3 sentences: what happened, factual, past tense." },
            summary_how: { type: "string", description: "2-3 sentences: the technical/procedural root cause." },
            summary_impact: { type: "string", description: "1-3 sentences: what data was exfiltrated, or the attacker's motive/damage if no data was stolen." },
            summary_lesson: { type: "string", description: "1-2 sentences: the core risk pattern this incident illustrates." },
            summary_safeguard: { type: "string", description: "1-2 sentences: concrete, practical advice written from the perspective of the organization that was actually attacked/breached - what specifically that victim could have done differently to prevent or contain this exact attack pattern, not generic security advice." },
          },
          required: [
            "external_id", "year", "incident_date", "title", "href", "source_name",
            "summary_what", "summary_how", "summary_impact", "summary_lesson", "summary_safeguard",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["candidates"],
    additionalProperties: false,
  },
  strict: true,
};

function buildPrompt(existingTitles: string[]): string {
  return `You are researching cybersecurity incidents for the Case Studies page of SimplifiedCS, a cybersecurity self-assessment platform aimed at small/medium businesses.

Use web search to look for major cybersecurity incidents - data breaches, ransomware attacks, supply-chain compromises, nation-state campaigns, or similarly significant events - disclosed or substantially updated anywhere in the world in roughly the last two weeks.

Already listed on the page (never propose a duplicate of any of these):
${existingTitles.map((t) => `- ${t}`).join("\n")}

Apply a strict, conservative bar. Only report an incident if BOTH are true:
1. It is genuinely watershed-caliber - comparable in significance to Stuxnet, the Equifax breach, WannaCry, SolarWinds, or the Colonial Pipeline attack: the kind of incident that becomes a named, widely-referenced event people still discuss years later, not a routine breach or an ordinary ransomware hit on one mid-size company.
2. You can verify it with a real, authoritative, non-Wikipedia source you actually found via search: an official government advisory (CISA, GAO, NAO, FBI, NCSC, etc.), the affected organization's or a directly-involved vendor's own official incident disclosure, or a highly reputable security-journalism outlet (Krebs on Security, BleepingComputer, Wired's security desk).

If you are not fully confident an incident meets both bars, do not report it. An empty result is the normal, correct outcome on most runs - do not invent, guess, or stretch a minor incident to fill the list. When you are done searching, call report_case_study_candidates exactly once, even if candidates is empty.`;
}

// POST-only, private scheduler credential, then an atomic lease that allows
// at most one attempt per MIN_RUN_INTERVAL_HOURS regardless of outcome (each
// attempt is a paid model call) - see ../_shared/scheduler-auth.ts and
// ../_shared/job-lease.ts.
Deno.serve(async (req) => {
  const denied = await verifySchedulerRequest(req, Deno.env.get("CRON_SECRET"));
  if (denied) return denied;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return runWithJobLease(
    supabase,
    { job: "fetch-case-studies", leaseSeconds: 180, minSinceStartSeconds: MIN_RUN_INTERVAL_HOURS * 3600 },
    () => refreshCaseStudies(supabase),
  );
});

async function refreshCaseStudies(supabase: ReturnType<typeof createClient>): Promise<JobOutcome> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    await logAttempt(supabase, 0, ["ANTHROPIC_API_KEY not configured"]);
    return { ok: false, body: { skipped: true, reason: "ANTHROPIC_API_KEY not configured" } };
  }

  const { data: existing } = await supabase.from("case_studies").select("title, external_id");
  const existingTitles = (existing ?? []).map((r) => r.title as string);
  const existingIds = new Set((existing ?? []).map((r) => r.external_id as string));

  const errors: string[] = [];
  let candidates: Candidate[] = [];
  try {
    candidates = await callClaude(buildPrompt(existingTitles), apiKey);
  } catch (e) {
    errors.push(`claude call: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Defensive validation - never trust the model's own self-filtering
  // alone, even though it was instructed to apply it. Reject anything
  // missing a required field, any Wikipedia source, any malformed or
  // non-http(s) URL (the model reads arbitrary web pages via web_search, so
  // a prompt-injected javascript:/data: link is a real possibility), or any
  // external_id that collides with an existing row. Text fields are stored
  // as-is: the site escapes every case-study field at render
  // (src/ui/html-safety.js).
  const clean = candidates.map(validCandidate).filter((c): c is Candidate => c !== null).filter((c) => !existingIds.has(c.external_id!));

  let upserted = 0;
  if (clean.length) {
    const rows = clean.map((c) => ({
      external_id: c.external_id,
      year: c.year,
      incident_date: c.incident_date || null,
      title: c.title,
      href: c.href,
      source_name: c.source_name,
      summary_what: c.summary_what,
      summary_how: c.summary_how,
      summary_impact: c.summary_impact,
      summary_lesson: c.summary_lesson,
      summary_safeguard: c.summary_safeguard,
      fetched_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("case_studies").upsert(rows, { onConflict: "external_id" });
    if (error) errors.push(`upsert: ${error.message}`);
    else upserted = rows.length;
  }

  // Retention: keep only the most recent RETENTION_CAP rows by incident
  // year (then fetch time as a tiebreak) - a curated, bounded list, not an
  // ever-growing archive. Existing rows are never touched otherwise, per
  // "retain the existing information".
  const { data: all } = await supabase
    .from("case_studies")
    .select("id, year, fetched_at")
    .order("year", { ascending: false })
    .order("fetched_at", { ascending: false });
  let deleted = 0;
  if (all && all.length > RETENTION_CAP) {
    const toDelete = all.slice(RETENTION_CAP).map((r) => r.id);
    const { error, count } = await supabase.from("case_studies").delete({ count: "exact" }).in("id", toDelete);
    if (error) errors.push(`retention delete: ${error.message}`);
    else deleted = count ?? 0;
  }

  await logAttempt(supabase, candidates.length, errors);

  // Full error detail (including upstream API response bodies) goes only to
  // case_study_fetch_log, which RLS keeps private - this endpoint is
  // triggerable by anyone holding the public anon key, so the response
  // itself just reports how many steps failed.
  if (errors.length) console.error("fetch-case-studies:", errors);
  return {
    // "Found nothing" is a normal, successful outcome; a failed model call
    // or failed write is not.
    ok: errors.length === 0,
    body: {
      candidatesFound: candidates.length,
      accepted: clean.length,
      upserted,
      deleted,
      errorCount: errors.length,
    },
  };
}

// Model output is untrusted (it read arbitrary pages via web_search): every
// field must be a bounded string of the expected shape, the link must be
// http(s) and not Wikipedia, dates must be well-formed. Anything else is
// dropped rather than repaired.
const FIELD_LIMITS: Record<string, number> = {
  external_id: 80, year: 4, incident_date: 10, title: 160, href: 500, source_name: 120,
  summary_what: 900, summary_how: 900, summary_impact: 700, summary_lesson: 500, summary_safeguard: 600,
};
function validCandidate(c: unknown): Candidate | null {
  if (!c || typeof c !== "object") return null;
  const r = c as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    const v = r[field];
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    if (trimmed.length > max) return null;
    if (!trimmed && field !== "incident_date") return null;
    out[field] = trimmed;
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(out.external_id)) return null;
  if (!/^(19|20)\d{2}$/.test(out.year)) return null;
  if (out.incident_date && !/^\d{4}-\d{2}-\d{2}$/.test(out.incident_date)) return null;
  if (/wikipedia\.org/i.test(out.href)) return null;
  try {
    const u = new URL(out.href);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return out as Candidate;
}

async function callClaude(prompt: string, apiKey: string): Promise<Candidate[]> {
  const res = await fetchWithTimeout(CLAUDE_API_URL, CLAUDE_TIMEOUT_MS, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: WEB_SEARCH_MAX_USES },
        REPORT_TOOL,
      ],
      // auto, not forced - forcing tool_choice to the report tool would
      // block the model from ever invoking web_search first. The prompt
      // itself instructs the model to always call report_case_study_
      // candidates as its final action.
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude API returned ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  // A truncated reply or one that never reached the report tool is a failed
  // run, not "nothing found" - reporting it as empty would hide the failure.
  if (data.stop_reason === "max_tokens") throw new Error("model reply hit max_tokens");
  const content = (data.content ?? []) as Array<Record<string, unknown>>;
  const toolUse = content.find((b) => b.type === "tool_use" && b.name === "report_case_study_candidates");
  if (!toolUse) throw new Error(`model ended without calling the report tool (stop_reason=${data.stop_reason})`);
  const input = toolUse.input as { candidates?: unknown };
  if (!Array.isArray(input.candidates)) throw new Error("report tool input had no candidates array");
  return input.candidates as Candidate[];
}

async function logAttempt(supabase: ReturnType<typeof createClient>, foundCount: number, errors: string[]): Promise<void> {
  await supabase.from("case_study_fetch_log").insert({ found_count: foundCount, errors: errors.length ? errors : null });
}
