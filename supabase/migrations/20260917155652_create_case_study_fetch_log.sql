-- Internal operational log for fetch-case-studies, kept separate from
-- case_studies itself: the expected common outcome is "found nothing",
-- which writes zero case_studies rows, so the rate-limit guard needs its
-- own append-only record of every attempt (not just successful writes) to
-- avoid re-running (and re-billing the LLM call) on every invocation.
-- RLS is enabled with no policies at all - this is a purely internal log,
-- not user-facing data, so nothing needs public read access; only the
-- Edge Function's service-role key (which bypasses RLS) ever touches it.
create table public.case_study_fetch_log (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),
  found_count integer not null default 0,
  errors text[]
);

alter table public.case_study_fetch_log enable row level security;
