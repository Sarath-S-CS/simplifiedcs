# Rollout and rollback: `remediation/review-2026-09`

**Status: rolled out on 24 Sep 2026** (PR #115, merge `264ccb2`) - steps 1-5 below are done;
results are in `docs/review-remediation-status.md` under "Production verification". The steps are
kept as the reference for how it was done and for rollback.

## What changes where

| Where | Change | Needs |
|---|---|---|
| Site (Netlify, static files in the repo) | New assessment, report, privacy page, analytics consent, hashed build output | Merge to `main` (Netlify deploys the committed files; no build step) |
| Netlify Functions (`netlify/functions/`) | Rebuilt `ai-insights` and `other-text-interpret`: consent required, atomic limits, evidence-bound output | `ANTHROPIC_API_KEY` (already set), optional `RATE_LIMIT_SALT` (new) |
| Supabase database | 2 new migrations: least-privilege table grants; job-lease table + functions | `supabase db push` (or SQL editor) |
| Supabase Edge Functions | `fetch-news`, `fetch-exploits` (and optionally `fetch-case-studies`) require a scheduler secret and take a lease | `CRON_SECRET` function secret; redeploy |
| GitHub Actions | Feed workflows send `x-cron-secret`; new `ci.yml` | `SUPABASE_CRON_SECRET` repository secret |

## Step 1 - Create the secrets (before merging)

1. Generate one random value, at least 32 characters, e.g. `openssl rand -hex 32`. Don't paste it
   anywhere it will be committed or logged.
2. **Supabase:** Project `xufqgrcxufptlptpwlfi` → Edge Functions → Secrets (or
   `supabase secrets set CRON_SECRET=<value>`). Name: `CRON_SECRET`.
3. **GitHub:** repository `Sarath-S-CS/simplifiedcs` → Settings → Secrets and variables → Actions →
   New repository secret. Name: `SUPABASE_CRON_SECRET`, same value.
4. **Netlify (recommended):** Site configuration → Environment variables → add `RATE_LIMIT_SALT`
   (another random 32+ character value), scope **Functions**, all deploy contexts. Without it the
   code falls back to a fixed salt, which makes the stored IP hashes guessable.
5. ~~Scope `ANTHROPIC_API_KEY` to Functions only.~~ Not available on the site's current Netlify
   plan (it requires an upgrade), so this is an accepted limitation. The site has no Netlify build
   command, so the key isn't used during builds, and it is never sent to the browser.

If step 2 or 3 is skipped: the redeployed feed functions return 503 (secret not configured) or 401
(secret missing from the request), and the News / Exploit Tracker feeds stop updating. The site
keeps showing the last stored items.

## Step 2 - Apply the database migrations

**Done 2026-09-24** through the Supabase connector: both migrations applied and verified (anon /
authenticated hold SELECT only on the three feed tables and `keepalive`; the lease functions are
executable by `service_role` only; public reads return 200 and a write with the public key is
refused). The connector recorded them as versions `20260924172302` and `20260924172314`, and the
files were renamed to match, so `supabase migration list` shows local and remote in sync. The
commands below are kept for reference.

```bash
supabase link --project-ref xufqgrcxufptlptpwlfi
supabase migration list
```

The first five migrations in `supabase/migrations/` were copied verbatim from the project's own
migration history, so `migration list` should show them as already applied. Then:

```bash
supabase db push
```

This applies only:

- `20260924172302_least_privilege_table_grants.sql` - removes INSERT/UPDATE/DELETE/TRUNCATE (and
  other default privileges) from the `anon` and `authenticated` roles; keeps SELECT on the three
  public feed tables. The feed functions use the service role, so they're unaffected.
- `20260924172314_job_leases.sql` - `job_leases` table and `try_acquire_job_lease` /
  `release_job_lease` functions, executable by `service_role` only.

Check: `select * from job_leases;` works as service role; the site's News/Exploits/Case Studies
pages still load (they only read).

## Step 3 - Merge and deploy the site

Push the branch once, open a pull request (CI runs), and **squash-merge** it so `main` gets one
clean commit, as CLAUDE.md §4.6 asks (the branch keeps separate commits per area to make review
easier). Netlify deploys the committed files. Avoid repeated pushes - each can trigger a build.

## Step 4 - Deploy the Edge Functions (right after the merge)

```bash
supabase functions deploy fetch-news
supabase functions deploy fetch-exploits
```

The CLI bundles `supabase/functions/_shared/`. Keep "Verify JWT" on (the workflows still send the
publishable key as the bearer token; the scheduler secret is checked in addition).

`fetch-case-studies` was never deployed and calls the Anthropic API on each run. Deploy it only if
you want AI-generated case studies (it also needs `ANTHROPIC_API_KEY` as a Supabase secret);
otherwise consider disabling `.github/workflows/fetch-case-studies.yml`, which currently fails
because the function doesn't exist.

Between the merge and this step, a scheduled run of the old functions still works (the old
functions ignore the new header), so the order merge → deploy has no gap. Deploying the
functions before the merge would make scheduled runs fail with 401 until the merge.

## Step 5 - Verify production

1. Security headers: `curl -sI https://simplifiedcs.net/ | grep -i content-security-policy` and
   `curl -sI https://simplifiedcs.net/assets/build/<main file>` shows
   `cache-control: public, max-age=31536000, immutable`.
2. Browser console on `/`, `/assessment`, `/news`, `/privacy`: no CSP violations. The cookie banner
   appears; before choosing, no request goes to googletagmanager.com.
3. Quick screening end to end; Full assessment end to end; PDF download; CSV/JSON export;
   History shows the report; example reports at `/assessment/sample`.
4. AI endpoint, fictional data only (authorized small smoke test): run the IT-services example
   answers through a real assessment, tick the consent box, request insights once. Expect sources
   checked per product and either cited advisories or "Checked - no match". Then:
   `curl -s -X POST https://simplifiedcs.net/.netlify/functions/ai-insights -H 'content-type: application/json' -d '{}'`
   → 400 with a JSON error, no model call.
5. Scheduled jobs: GitHub → Actions → "fetch-news" → Run workflow → succeeds with either a
   refresh result or `{"skipped": true, ...}` (the lease skips a run if one started in the last
   15 minutes or succeeded in the last 20 hours - so a manual run on the same day as the
   scheduled one is expected to skip). A request without the header is refused:
   `curl -s -X POST https://xufqgrcxufptlptpwlfi.supabase.co/functions/v1/fetch-news -H "Authorization: Bearer <the anon JWT used in the workflow file>"` → 401.

## Rollback

| Part | How |
|---|---|
| Site + Netlify Functions | Netlify → Deploys → pick the previous production deploy → "Publish deploy". Or revert the merge commit on `main`. |
| Edge Functions | Check out `main` from before the merge and `supabase functions deploy fetch-news fetch-exploits` again. The old code ignores `CRON_SECRET`, so the secrets can stay. |
| Workflows | Reverting the merge restores the old workflow files; the extra header is harmless to old functions anyway. |
| Migrations | Each new migration ends with commented rollback SQL. Run it in the SQL editor, then `supabase migration repair --status reverted <version>`. Rolling back the grants migration restores the excess privileges - only do it if something that should read is failing. |
| Browser data | Nothing to roll back on the server. Visitors' saved v2 reports stay in their browsers; the old site ignores the new storage key (`simplifiedcs:runs:v2`) and still reads `simplifiedcs:runs:v1`. |

## Settings deliberately not changed

- DNS, domains, accounts, plans, Netlify Forms (still off; the feedback page no longer depends on it).
- Netlify environment-variable scopes (need a plan upgrade; accepted - see Step 1.5) and
  deploy-preview settings.
