# Review remediation status

Finding-by-finding evidence matrix for the implementation prompt
(`claude-code-implementation-prompt.md`, review of commit `97238c9`, 24 Sep 2026).

- **Baseline for this work:** `main` @ `3ac7a24` (includes PRs #111–#114, merged and deployed
  24 Sep 2026 after the original review). Working branch: `remediation/review-2026-09` (local only,
  not pushed).
- **Status values:** Already fixed · Partially fixed · Still present · Not applicable / original
  finding not supported · Cannot verify with current access. Rows changed by this branch are
  marked **Changed now** in "Current status" below; the baseline matrix at the end is kept as
  found.
- **Related documents:** `docs/methodology.md` (methodology 2.0 + change note),
  `docs/rollout.md` (setup, staged rollout, rollback), `docs/engineering-case-study.md`,
  `docs/future-multi-tenant.md`.
- **Evidence kinds** are kept separate: *source* (code inspection), *local* (tests/reproductions on
  this machine), *deployed* (checked against https://simplifiedcs.net or the live Supabase/Netlify
  project with read-only access).

## Baseline checks (before any change on this branch)

| Check | Result |
|---|---|
| Git | `main` = `origin/main` = `3ac7a24`, clean tree, no stashes. |
| Tests | `npm test`: **106 pass, 0 fail** (was 80 at the reviewed commit; +26 from #111–#114). |
| Build | `npm run build` succeeds on this machine (the earlier Windows sandbox directory error did not reproduce here; build behaviour unchanged). |
| Prerender | `node scripts/prerender.js` succeeds (20 routes). |
| Reproducibility | Fresh build + prerender differ from committed files only by line endings (`git diff` empty for `assets/app.js`, `history.html`); `exploits.html`/`news.html` differ only by the live-feed snapshot they capture. Deployed `/assets/app.js` is byte-identical to the fresh local build after `\r\n`→`\n` normalization. |
| Bundle | `assets/app.js` 2,965,898 bytes unminified; 610,574 bytes brotli as served; `Cache-Control: max-age=0, must-revalidate`, no content hash. |
| Dependency audit | `npm audit`: 5 findings (1 moderate, 4 high). esbuild ≤0.24.2 (GHSA-67mh-4wv8-2f99, dev-server only); extract-zip via puppeteer 23 → @puppeteer/browsers (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3). All development-only; `npm audit --omit=dev` = 0. |
| Live headers | Enforced CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (Netlify). |
| Supabase (read-only) | RLS enabled on all 5 public tables; only SELECT policies (anon/authenticated) on 4 tables, none on `case_study_fetch_log`. **But** `anon`/`authenticated` still hold Supabase's default table grants including INSERT/UPDATE/DELETE/**TRUNCATE** (TRUNCATE is not governed by RLS; not reachable through PostgREST, still excess privilege). No public RPC functions, no storage buckets. 5 applied migrations exist in the project but **none were in the repository**. Edge functions deployed: `fetch-news` v6, `fetch-exploits` v12 (`verify_jwt: true`); **`fetch-case-studies` is not deployed**. |
| Netlify (read-only connector) | Project `simplifiedcs`; **Forms: not enabled** (the feedback form therefore cannot be collecting submissions). Environment-variable scopes and deploy-preview settings are not exposed by the available connector. |

## Plain-language summary

**What changed.** The assessment now tells the truth about what it knows. "Not sure" is its own
answer instead of counting as "No"; a missing critical control (for example MFA) produces
"Critical gaps found" no matter how good the percentage looks; weak answers about software
delivery, secrets, containers and OT are scored instead of ignored; and the report lists every
gap as a ranked action with an owner role, effort, a 30/60/90-day target and the evidence that
shows it's done - exportable to CSV/JSON and trackable in the browser. Quick mode is now a real
14-answer screening. Answers are native form controls that work with a keyboard.

On the security side: feed content is sanitized at ingestion and render; the AI features only run
after an explicit agreement that shows exactly what will be sent, are protected by atomic rate
limits and a daily budget that fail closed, and can only cite public vulnerability records the
server itself retrieved; scheduled jobs need a private secret and can't overlap; the database's
browser roles lose write privileges; Google Analytics loads only if the visitor allows it; and
there's a privacy page with a "clear all my data" control. The site loads faster (initial script
543 KB minified instead of 3 MB unminified, with the PDF and feed libraries loaded on demand) and
has CI.

**How it was tested.** 199 automated tests (106 before), including a regression test for every
failure the review reproduced, tests that fail if a framework ID or ATT&CK technique isn't
current, a test that walks every Quick path, database permission tests on a local Postgres, and
PDF layout tests that read back where every line landed on every page. Browser checks ran against
a local server applying the production security headers: Quick and Full assessments, Continue to
Full, History and legacy reports, examples, privacy/consent, feeds, keyboard use, and phone width.
Generated PDFs were rendered to images and inspected.

**Not done / needs you.** Nothing is deployed or merged; production migrations, secrets and
function deploys are listed in `docs/rollout.md`. See "Unresolved and not verified" below.

## Current status (after this branch)

Evidence: *S* = source, *L* = local tests / local browser, *D* = deployed (none - not deployed).
Commits: `ae5653e` (feeds/jobs/grants), `4332d02` (AI endpoints), `35dfcbe` (scoring engine),
`c0d5594` (UI), `fd4ee97` (privacy/consent/copy), `2004cb6` (build/CI), `ba1713b` (home/SEO),
`7f63cc0` (main.js split), `2ac595b` (PDF margins), plus the final docs/artifacts commit.

| ID | Status now | Evidence | Remaining |
|---|---|---|---|
| SEC-1 | **Changed now** | S: `supabase/functions/_shared/feed-text.ts`, `src/ui/feed-cards.js`, DOMPurify in `src/ui/html-safety.js`. L: `test/feed-ingestion.test.js` (7), `test/html-safety.test.js` (6). | Redeploy feed functions (rollout step 4). |
| SEC-2a | **Changed now** | S: `netlify/lib/admission.ts`, `handlers.ts`. L: `test/ai-admission.test.js` (13; 4 fail against the old approach), `test/ai-endpoints.test.js` (18). | Deploy; set `RATE_LIMIT_SALT`. |
| SEC-2b | **Changed now** | S: `_shared/scheduler-auth.ts`, `_shared/job-lease.ts`, migration `20260924172314`, workflows. L: `test/scheduled-jobs.test.js` (8). | Secrets + migration + deploy (steps 1, 2, 4). |
| SEC-2c | **Changed now** | S: only public KEV/NVD data is cached (`netlify/lib/public-cache.ts`); duplicate-request keys derived server-side. L: endpoint tests. | - |
| SEC-3a | **Changed now** | S: no automatic AI calls; `src/engine/ai-consent.js`, `src/ui/ai-panel.js` (what's sent, preview, processors); server rejects requests without the versioned consent. L: browser check (button disabled until agreed); `test/ai-endpoints.test.js`, `test/ai-payload.test.js`. | - |
| SEC-3b | **Changed now** | S: `/privacy` (`src/ui/privacy.js`), `assets/gtag-init.js` (Consent Mode v2 defaults denied; gtag.js not loaded before "Allow"), clear-all control (`src/engine/local-data.js`), footer "Cookie settings". L: `test/privacy.test.js` (5); browser: no Google request before consent. | - |
| SEC-4a | **Changed now** | S: `netlify/lib/http.ts` (streamed byte cap), `schema.ts`. L: endpoint tests for null/wrong types/unknown fields/malformed/oversized/lying Content-Length. | - |
| SEC-4b | **Changed now** | S: `netlify/lib/insights.ts` / `interpret.ts` output validation; `claude.ts` honest failure codes. L: endpoint tests. | - |
| SEC-5a | **Already fixed; re-validated** | L: local server applies `_headers`; zero CSP errors across pages, lazy chunks, feeds, consent banner. Added immutable caching for `/assets/build/*`. | Re-check live after deploy (step 5). |
| SEC-5b | **Changed now** | L: `npm audit` 0 (all); CI audits production deps. | - |
| SEC-6 | **Changed now** (repo side) | S: 7 migrations in `supabase/migrations/`. L: `test/supabase-policies.test.js` (9, PGlite). | Apply 2 new migrations. Netlify env scopes/deploy previews: **cannot verify** with current access. |
| SCORE-1a | **Changed now** | S: `src/engine/scoring.js` (critical rules, rule-ordered verdict), `docs/methodology.md`. L: `test/scoring.test.js` "review:" cases (99%-Strong case now "Critical gaps found"). | - |
| SCORE-1b | **Changed now** | S: "Not sure" on every scored question, justified N/A where real, statuses in `answers.js`. L: scoring tests for unknown/N/A/all-unknown. | - |
| SCORE-1c | **Changed now** | S: `METHODOLOGY_VERSION`, run summaries, legacy runs labelled and never re-scored in place (`run-history.js`), comparisons only within version+mode. L: `test/run-history.test.js`; browser check of a legacy report. | - |
| SCORE-2 | **Changed now** | S: `PROFILE_CONTROLS`, `FINDING_ITEMS`, `PROFILE_DESIGNATIONS` in `src/data/controls.js`. L: catalog test fails if a setup question lacks a designation; register-completeness test. | - |
| SCORE-3a | **Changed now** | S: `computeFindings` reasons (weight, status, critical reason, exposure, combined findings, uncertainty). L: `test/priority-ranking.test.js` (6), scoring tests. | Exposure uses collected context only (no asset-level data exists). |
| SCORE-3b | **Changed now** | S: `src/engine/actions.js` (stable IDs, all fields, 30/60/90, CSV with formula-injection guard, JSON), `action-tracking.js`. L: tests; browser check of tracking. | - |
| QUICK-1 | **Changed now** | L: `test/quick-mode.test.js` walks all Quick paths (≤15; actual 14). Browser: 14 answers end to end. | - |
| QUICK-2 | **Changed now** | Quick asks no follow-ups; everything else is reported as "not asked" in the screening result and limitations. | - |
| QUICK-3 | **Changed now** | Screening verdict and counts, no percentage (web + PDF). | - |
| QUICK-4 | **Changed now** | Same question IDs/options; Continue to Full keeps answers (test + browser). | - |
| QUICK-5 | **Changed now** | Time claims and "full strength" claim removed; question counts and "Section X of Y" progress. | - |
| TRUTH-1 | **Changed now** | `aiToolGovernance` hidden (N/A) when AI use is "No, not currently". Test. | Optional readiness prompt not added (not needed: AI-risk ownership is still asked of everyone). |
| TRUTH-2 | **Changed now** | `vendorCount` (context) + `vendorAccessReview` (scored, N/A with none); v1 answers migrated. Tests. | - |
| TRUTH-3 | **Changed now** | See SCORE-1b. | - |
| TRUTH-4 | **Changed now** | Effective answers to a fixed point; 5 contradiction checks listed in the report. Tests (stale DB answers no longer fire findings). | More contradiction rules could be added over time. |
| TRUTH-5 | **Changed now** | Native radios/checkboxes in fieldsets/legends, buttons for mode cards, keyboard accordions with `aria-expanded`, focus restoration, live-region announcements. L: real keyboard input in the browser (Tab, arrows, Enter). | **Screen-reader testing not performed** - a step-by-step NVDA checklist is in `docs/screen-reader-check.md`. Automated: `npm run a11y` (axe-core, WCAG 2.2 A/AA, every page and assessment state, both themes) reports no violations after fixing light-theme text contrast, adding landmarks, a skip link and focus-on-navigation, and moving accordions to a real `<button>` inside each heading. |
| TRUTH-6 | **Changed now** | Per-control CSF 2.0 / CIS v8.1 IDs validated against official lists (`src/data/references/`); FUNC_REF uses current categories; ATT&CK checked against v19.2 (deprecated T1656 replaced). | Mapping is editorial, clearly labelled as such. |
| TRUTH-7 | **Changed now** | Metrics/Methodology/home/report/PDF copy aligned to 2.0; overclaims removed; two unverifiable vendor-note claims reworded. | - |
| AI-0 | **Already fixed; extended** | Request IDs + metadata-only logs (`netlify/lib/claude.ts`); test that logs carry no answers. | - |
| AI-1 | **Changed now** | Consent + exact preview; payload validated by the server's own schema in tests. | - |
| AI-2 | **Changed now** | `netlify/lib/product-catalog.ts` canonical products; optional OS question (`endpointOs`); applicability labels + verification steps. | Product versions aren't collected (only OS); results say "confirm your version". |
| AI-3 | **Changed now** | Evidence IDs; uncited / cross-product citations dropped server-side. Tests. | - |
| AI-4 | **Changed now** | Per-product KEV/NVD status in response, page and PDF. | - |
| AI-5 | **Changed now** | Prioritised, de-duplicated NVD queries within a budget; unchecked products disclosed; public data cached. Tests. | - |
| AI-6 | **Changed now** | Report model keeps deterministic findings, retrieved evidence and AI text separate; AI never changes scores. | - |
| AI-7 | **Changed now** | AI result stored with the report (snapshot ID); shown as out of date after edits; no re-request offered for a report that has one. | - |
| AI-8 | **Changed now** | Fixtures in `test/ai-endpoints.test.js`: prompt-like text, outages, stale cache, starvation, empty valid result, cross-product, truncated/malformed/refused/overloaded. Mocked model, fictional CVEs. | Live smoke test with fictional data is authorized but needs a deploy. |
| PERSIST-1 | **Changed now** | Save read back before "saved"; quota eviction reported; storage-off message; other-tab edits pause autosave with a choice. Tests + browser. | - |
| PERSIST-2 | **Changed now** | History v2 (answers + compact summary + AI), migration of v1 runs and in-progress saves with visible notes. | Full report is rebuilt on open (same methodology) rather than stored whole - 110 KB per report would not fit 25 reports in browser storage. |
| PERSIST-3 | **Changed now** | Clear-all on Privacy and History; per-report delete. | - |
| REPORT-1 | **Changed now** | `src/engine/report-model.js` feeds web, examples, PDF, History summary and AI payload. | - |
| PDF-1 | **Changed now** | Layout tests parse every page (margins, stranded headings); pages rendered to images and inspected (long/short/Quick/example, AI success/failure, unknown/N/A); bold-text overflow found and fixed. | - |
| PERF-1 | **Changed now** | Minified ESM with code splitting and hashed names; images out of CSS/HTML; 1-year immutable caching. Initial script 543 KB minified (before compression). | Further splitting of page content could shrink the initial script more. |
| MAINT-1 | **Partially fixed** | Assessment UI split into `report-view`, `ai-panel`, `history-view`, `privacy`, `a11y`, `page-meta`; content data moved to `src/content/`. `src/main.js` 4,395 → 3,691 lines. | Page renderers still live in `main.js`. |
| BUILD-1 | **Changed now** | Build output byte-identical across build dates (date moved to a meta tag); documented in `scripts/build.js`. | - |
| CI-1 | **Changed now** | `.github/workflows/ci.yml`: tests, build-matches-sources check, production audit; no secrets. | Runs once pushed. Prerender isn't run in CI (needs Chrome and live feeds). |
| PRODUCT-1 | **Changed now** | Home and assessment landing explain it's a self-assessment, with example/methodology/privacy links next to the call to action. | - |
| PRODUCT-2 | **Changed now** | Fictional IT-services and SaaS examples through the real engine; tests keep them complete and free of vulnerability claims. | - |
| SEO-1 | **Changed now** | Per-page descriptions and social metadata; example page title; History `noindex` and removed from sitemap; `/privacy` added. | - |
| CASE-1 | **Changed now** | `docs/engineering-case-study.md` (facts and tests only; no outcome claims). | Publishing it on the site is your call. |
| FEEDBACK-1 | **Changed now** | Feedback page points to a public GitHub issue or LinkedIn (Netlify Forms isn't enabled); consent-gated minimal events (mode/format only). | Enabling Netlify Forms is a production setting - not changed. |
| FUTURE-1 | **Changed now** | `docs/future-multi-tenant.md`. | - |

## Unresolved and not verified

1. **Nothing is deployed.** Every "Changed now" is verified in source and locally only. Deployed
   verification is listed in `docs/rollout.md` step 5.
2. **Screen-reader testing was not performed.** Keyboard operation was tested with real key input.
3. **Netlify environment-variable scopes and deploy-preview settings** couldn't be read with the
   available access; check `ANTHROPIC_API_KEY` is Functions-only (rollout step 1.5).
4. **Live AI smoke test** (authorized, fictional data) needs the new functions deployed.
5. **`fetch-case-studies`** is still not deployed; its workflow fails until it is deployed or
   disabled (decision needed: it makes paid AI calls on a schedule).
6. **IP-hash counter cleanup** runs opportunistically (4% of AI requests), so deletion after a day
   isn't time-guaranteed if the service is idle; the privacy text says so.
7. **Product versions** aren't collected, so vulnerability matches are always "potential" and ask
   the reader to confirm their version.
8. **`src/main.js`** is smaller but still holds all content-page renderers (MAINT-1 partial).
9. **CI** has not run yet (it runs on push/PR).

## Baseline matrix (as found, before changes)

### 3. Security and data handling

| ID | Requirement | Baseline status | Evidence (baseline) | Remaining action |
|---|---|---|---|---|
| SEC-1 | Safe rendering of external content | **Partially fixed** (#111) | *Source/local:* `src/ui/html-safety.js` escapes all feed fields at render; `fetch-news` decodes before stripping, http(s)-only links; `fetch-exploits` escapes before linkifying; 6 tests in `test/html-safety.test.js`. *Deployed:* both functions redeployed 24 Sep. Gaps: the one rich field (`safe_guidance`) uses a hand-written allowlist rebuild, not a maintained sanitizer; ingestion code (RSS parser, exploit linkifier) has no automated fixtures because it lives inside Deno entrypoints. | Move feed text/link helpers into a shared module testable from Node; add encoded-tag / event-attribute / malformed / unsafe-link fixtures through ingestion → storage-shaped rows → render; use DOMPurify (already in the dependency tree) for `safe_guidance`. |
| SEC-2a | AI endpoints: atomic admission, per-client bound, app-wide budget, concurrency, dedupe, degrade safely | **Still present** | *Source:* `netlify/functions/ai-insights.mts` / `other-text-interpret.mts` write a key before admission, count by listing (non-atomic), `catch { return true }` fails **open**, no global budget, no concurrency bound, no dedupe, cleanup only on later traffic from the same IP. | Shared admission library using Blobs conditional writes (`onlyIfNew`/`onlyIfMatch`, confirmed in installed `@netlify/blobs` 11.0.1): per-client sliding window + daily cap, daily request/token budget, bounded concurrency slots with expiry, in-flight dedupe; **fail closed** for metered calls with clear 429/503 + `Retry-After`. Local concurrency tests with a CAS fake. |
| SEC-2b | Scheduled jobs: private credential, method, atomic lease | **Still present** | *Source/deployed:* workflows POST with the public anon key only; functions accept any method; "rate limit" is a non-atomic `fetched_at` age check. | `x-cron-secret` (GitHub secret + Supabase function secret, constant-time compare), POST-only, Postgres lease function (`try_acquire_job_lease`) via a new migration; rollout doc so feeds don't silently stop. |
| SEC-2c | No cross-user cache of private results; scoped keys | **Not applicable at baseline** (no server-side result cache exists) | *Source:* no caching of AI results. | Keep private results out of server caches; add *public* feed caching (CISA KEV, NVD) only; dedupe keys derived server-side, never from client-supplied keys. |
| SEC-3a | Explicit AI choice before any AI processing, incl. "Other" text | **Still present** | *Source:* `renderResults()` calls `interpretUnresolvedOtherTexts()` automatically (`src/ui/assessment.js:1158`) → `other-text-interpret` sends free text to Claude with no choice; AI Insights button has no disclosure of what is sent. | Consent step covering both interpretation and enrichment, with exact data list; declined/default path makes zero AI requests and keeps original text; AI interpretations labelled, never scored. |
| SEC-3b | Privacy/data-handling page, analytics review, local-data clearing | **Still present** | *Source:* no privacy page; GA4 loads unconditionally (no consent mode); no single "clear my data" control. Analytics only sends default page views (routes contain no answers). | Factual `/privacy` page + links near assessment CTA and AI panel; Consent Mode v2 defaults denied with a small choice banner; "Clear all data in this browser" control; shared-device note. |
| SEC-4a | Request validation (bytes, JSON shape, types, lengths) | **Partially fixed** | *Source:* both functions call `req.json()` with no byte limit; `ai-insights` caps array lengths/strings when building the prompt but performs no shape/type validation (nulls, wrong types reach the prompt builder). | Shared validator: streamed byte cap (not Content-Length), JSON parse, typed schema with allowed values, bounded 400/413/415 errors. Tests for null, wrong types, null entries, malformed JSON, oversized bodies. |
| SEC-4b | Output schema validation, honest failures, timers | **Partially fixed** (#112) | *Source:* `ai-insights` now fails on `max_tokens` and empty narrative; array items are not validated, citations not checked; `other-text-interpret` normalizes malformed output to empty. | Full response-schema validation for both endpoints; citation validation against server evidence set (see AI-3); consistent timeout/cleanup helper. |
| SEC-5a | Security headers (CSP, anti-framing, nosniff, referrer) | **Already fixed** (#111) | *Deployed:* headers above; *local:* `scripts/serve.js` applies `_headers`; zero CSP violations across all routes, PDF export, GA, Supabase feeds (local + live). The prompt suggests report-only first: compatibility was validated before enforcement, so enforcement is retained (documented). | Re-validate after this branch's changes (new privacy page, lazy chunks, consent banner). |
| SEC-5b | Dependency audit and upgrades | **Still present** | *Local:* audit above. | Upgrade esbuild to ^0.25 and puppeteer to current (drops vulnerable extract-zip); verify build, prerender, PDF. |
| SEC-6 | Supabase schema/grants/RLS/functions captured and tested | **Partially fixed** | *Deployed (read-only):* RLS + SELECT policies confirmed; excess default grants; migrations missing from repo; `fetch-case-studies` undeployed. Storage: none. Netlify env scopes/deploy previews: **cannot verify** with current connector. | Commit the 5 applied migrations verbatim (retrieved from `supabase_migrations.schema_migrations`); add least-privilege grant migration + job-lease migration; local policy tests (PGlite) for anon/authenticated SELECT/INSERT/UPDATE/DELETE; instructions for dashboard-only checks. |

### 4. Assessment scoring and findings

| ID | Requirement | Baseline status | Evidence | Remaining action |
|---|---|---|---|---|
| SCORE-1a | Separate coverage / completeness / critical gaps; critical gap blocks reassuring headline | **Still present** | *Local repro:* cloud-only, every answer best except MFA=No → **99% "Strong health"** while `cloud-no-mfa` fires. | Documented critical rules in data; verdict driven by critical gaps first; coverage and completeness shown separately. |
| SCORE-1b | Unknown / No / N/A / Not asked distinct; all-unknown & all-N/A honest | **Still present** | *Source:* scored questions have no Unknown/N/A options; unanswered counts as 0 (`state.answers[q.id] ?? 0`). | Add Unknown and justified N/A options; exclude from coverage denominator appropriately; completeness metric; verification actions for unknown essentials; "insufficient evidence" states. |
| SCORE-1c | Versioned methodology/question set; no silent recalculation of history | **Still present** | *Source:* runs (#114) store answers and re-render with the current engine. | `METHODOLOGY_VERSION`; store the deterministic report snapshot with each run; compare only compatible versions/modes. |
| SCORE-2 | Every security-relevant answer has a consequence; complete findings register | **Partially fixed** (#113 added the full gap list) | *Local repro:* weak DevSecOps/secrets/container scanning/hypervisor patching → **100%, 0 gaps**; fixing them changes nothing. Profile answers never enter score or register. | Control catalog mapping profile answers to scored controls or explicit informational designations; avoid double counting. |
| SCORE-3a | Explainable ranking | **Partially fixed** (#113) | *Source:* ranking = shortfall × CISA-aligned tier + flag boost; explanation line in report. Not yet using affected service/data exposure, dependencies, or evidence uncertainty; no per-item "why ranked". | Extend factors with collected exposure context and uncertainty; per-item reason text; stable tie-break by catalog order. |
| SCORE-3b | Action register, 30/60/90 plan, export, local tracking | **Still present** | *Source:* gap list shows answer + "how to fix" only. | Action catalog (stable IDs, title, trigger, rationale, interim, durable fix, suggested role, effort, timeframe, evidence check); 30/60/90 plan; CSV/JSON export; local owner/due/status/evidence/risk-acceptance tracking. |

### 5. Quick assessment

| ID | Requirement | Baseline status | Evidence | Remaining action |
|---|---|---|---|---|
| QUICK-1 | ≤15 required responses on every Quick path | **Still present** | *Local:* Quick path = 2 scope + 13 required profile + 37 scored ≈ **52**. | Dedicated Quick screening set (setup + high-signal controls) with a worst-case path test. |
| QUICK-2 | Over-cap follow-ups become unresolved screening items | **Still present** | n/a | Screening items + "Continue to Full". |
| QUICK-3 | Screening report with limited-coverage labels | **Still present** | Quick report = Full report without vendor fields. | Screening report model. |
| QUICK-4 | Continue to Full with compatible answers only | **Still present** | no such flow | Quick questions reuse Full question IDs/options exactly; carry only those. |
| QUICK-5 | Remove unsupported time claims; real progress | **Still present** | "~2 minutes" / "~5 minutes" on mode cards; landing claims Quick has "MITRE ATT&CK mapping at full strength" (untrue: Quick strips it). | Question counts instead of times; truthful mode copy. |

### 6. Truthful answers, accessibility, framework accuracy

| ID | Requirement | Baseline status | Evidence | Remaining action |
|---|---|---|---|---|
| TRUTH-1 | No-AI adoption representable | **Still present** | `aiToolGovernance` options all presuppose use; asked even when AI use is "No"/"Not sure". | "We don't use AI tools" path, separate optional readiness prompt. |
| TRUTH-2 | Vendor count split from review quality | **Still present** | `vendorCount` options conflate size and review ("6+, not formally reviewed"). | Separate count (context) and review-practice (scored) questions. |
| TRUTH-3 | Unknown / justified N/A | **Still present** | see SCORE-1b | same |
| TRUTH-4 | Contradictions + stale branch answers | **Still present** | *Local repro:* `externalWebsite=No` with stale `webDb=Yes` still fires `db-unencrypted-weak-access`; multiselect allows "in-house manages everything" + "some outsourced". | Prune hidden answers on change; flags/notes read only effective (visible) answers; contradiction prompts. |
| TRUTH-5 | Accessible native controls, keyboard, focus | **Still present** | *Source:* scored/profile options are clickable `<div class="option">` (5 templates), industry/region/framework cards and accordions are `<div>`s; 0 fieldset/legend; re-render drops focus. | Native radios/checkboxes in fieldsets, buttons with `aria-expanded`, focus restoration, keyboard test. Screen-reader testing will be reported as not performed unless actually done. |
| TRUTH-6 | Current NIST CSF 2.0 references; published mappings | **Still present** | `src/data/categories.js` `FUNC_REF` uses CSF 1.1 codes **PR.AC** and **RS.RP** in a "CSF 2.0" UI. No question-to-outcome mapping published. | Verify against NIST CSWP 29; versioned per-question CSF 2.0 / CIS v8.1 mapping with sources; distinguish selective prompts from audit coverage. |
| TRUTH-7 | Consistent score meaning and no overclaims | **Partially fixed** | Score-direction legend exists; overclaims remain ("full strength" MITRE in Quick; history "saved on this account" fixed by #114). | Align homepage/methodology/report/sample copy after scoring redesign. |

### 7. AI insight reliability

| ID | Requirement | Baseline status | Evidence | Remaining action |
|---|---|---|---|---|
| AI-0 | Investigate "No additional live findings" | **Already fixed** (#112) | Cause established this week: prompt received no answers; with ≥7 vendors the forced tool call hit `max_tokens=1500` and returned `{}` which was normalized to "nothing found" (reproduced twice; single-vendor worked). *Deployed:* same Full scenario now returns vendor findings + 3 long-tail items + accurate synthesis (19 s). | Add request correlation IDs and structured diagnostics (no content). |
| AI-1 | Bounded, consented, structured context beyond top five | **Partially fixed** (#112) | Digest of all profile + scored answers is sent, but no consent step and no disclosure. | Tie to SEC-3 consent; disclose exactly what is sent. |
| AI-2 | Canonical vendor/product matching; OS/version; no "you are vulnerable" | **Still present** | Substring vendor matching; no OS/version; prompt forbids over-claiming but no structural guard. | Canonical product catalog, optional OS/version, applicability labels + verification steps. |
| AI-3 | Server-controlled evidence records; citation validation | **Still present** | Model may return any URL; client only scheme-checks. | Evidence IDs from retrieval; model must cite IDs; server drops unsupported claims/links. |
| AI-4 | Per-source/product status | **Still present** | none | checked/no match, potential match, ambiguous, unavailable, not checked (budget). |
| AI-5 | Recency sort, dedupe, rate limits, no input-order starvation | **Still present** | NVD queries only the first 4 terms in object order. | Dedupe + prioritise, cache public data, report unchecked products. |
| AI-6 | Separate deterministic / retrieved / AI inference | **Partially fixed** | Separate UI blocks, AI never alters score; long-tail may repeat findings. | Keep separation explicit in the shared report model. |
| AI-7 | Versioned results tied to snapshot; stale marking; no repeat paid calls | **Still present** | AI result held in memory only; re-render (tab switch) or reopen from History loses it → repeat paid call. | Persist with run snapshot + answer hash; stale when answers change. |
| AI-8 | Evaluation fixtures | **Still present** | none | Fixtures for irrelevant products, unknown versions, missing evidence, prompt-like text, retrieval failure, valid empty output, cross-product generalisation (mocked model). |

### 8. Persistence and reports

| ID | Requirement | Baseline status | Evidence | Remaining action |
|---|---|---|---|---|
| PERSIST-1 | Real, honestly described persistence | **Partially fixed** (#114) | *Deployed:* browser-local history works; copy says "saved in this browser". Save success is inferred from history count; no quota message; single in-progress key can be overwritten by a second tab. | Confirm-then-announce, visible save failure, multi-tab guard, bounded size. |
| PERSIST-2 | Versioned snapshots incl. deterministic report + consented AI | **Still present** | runs store answers only; reports recomputed on open. | Snapshot schema v2 + migration of v1 runs/in-progress saves. |
| PERSIST-3 | Understandable local-data removal | **Partially fixed** | History "Clear history" (confirm); no single clear-all. | Privacy page control (SEC-3b). |
| REPORT-1 | Shared report model for web/sample/PDF | **Partially fixed** | Web + sample share `reportBodyHtml`; PDF re-derives separately; no methodology version/limitations/completeness. | `buildReportModel()` consumed by all three. |
| PDF-1 | Pagination/readability verified on rendered pages | **Cannot verify at baseline without rendering** | Content tests exist (#112/#113); no rendered-page inspection yet. | Render pages from short/long fixtures and inspect; fix heading orphans, reference wrapping, rule overlaps. |

### 9. Performance, maintainability, product

| ID | Requirement | Baseline status | Evidence | Remaining action |
|---|---|---|---|---|
| PERF-1 | Measure, minify, lazy-load, hashed caching | **Still present** | 2.97 MB unminified, jsPDF stack eager, `max-age=0`. | Minify, ESM splitting with lazy PDF chunk, hashed assets + immutable caching. |
| MAINT-1 | Split `src/main.js` along useful boundaries | **Still present** | `src/main.js` ~4,500 lines. | Extract feeds/history/privacy modules touched by this work. |
| BUILD-1 | Reproducible documented build | **Already fixed (verified)** | see baseline. | Document pipeline; keep verified. |
| CI-1 | CI for tests/build/audit | **Still present** | `.github/workflows` has only feed jobs. | `ci.yml`: install, test, build, prerender smoke, audit; no secrets/paid AI. |
| PRODUCT-1 | Landing explains who benefits / what's self-reported; methodology & privacy links near CTA | **Partially fixed** | Some explanation exists; no privacy link; time claims. | Update assessment landing + homepage CTA area. |
| PRODUCT-2 | IT-services and SaaS example reports from fictional fixtures | **Still present** | one sample scenario. | Two maintained fixtures + prerendered routes. |
| SEO-1 | Page-specific metadata; sample discoverability; no private data indexed | **Partially fixed** | Per-route titles; canonical/OG; sample at `/assessment/sample`. | Per-route descriptions, new sample routes in sitemap; noindex for history. |
| CASE-1 | Truthful engineering case study | **Still present** | none | Short write-up of the stored-XSS/ranking/AI fixes with regression evidence. |
| FEEDBACK-1 | Optional privacy-conscious feedback + consent-aware events | **Still present** | Feedback posts to Netlify Forms, which is **not enabled** (submissions not collected). | Honest feedback path (mailto/GitHub issue) until Forms is enabled; consent-aware minimal events. |
| FUTURE-1 | Document multi-tenant/evidence-upload requirements | **Still present** | n/a | Section in methodology/change note. |
