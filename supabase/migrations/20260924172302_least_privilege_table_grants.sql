-- Least-privilege table grants for the public API roles.
--
-- Supabase grants anon/authenticated ALL privileges on new public tables by
-- default and relies on RLS to block writes. RLS does block INSERT/UPDATE/
-- DELETE here (only SELECT policies exist), but TRUNCATE, TRIGGER and
-- REFERENCES are not governed by RLS at all. None of them are reachable
-- through PostgREST today, yet nothing the site does needs them, so remove
-- them rather than depend on that. Verified against the live project
-- (read-only) on 2026-09-24: every public table carried the full default
-- grant set for both roles.
--
-- What the site actually needs:
--   * browser (anon key): SELECT on news_items, exploit_items, case_studies
--   * keep-alive workflow (anon key): SELECT on keepalive
--   * Edge Functions: service_role (bypasses RLS; unaffected by this file)
--
-- Rollback: re-grant the Supabase defaults, e.g.
--   grant all on table public.<table> to anon, authenticated;

revoke all on table public.news_items, public.exploit_items, public.case_studies,
  public.keepalive, public.case_study_fetch_log
  from anon, authenticated;

grant select on table public.news_items, public.exploit_items, public.case_studies
  to anon, authenticated;

grant select on table public.keepalive to anon;

-- case_study_fetch_log: internal only - no grants to API roles at all.
