# Engineering case study: acting on an external review (September 2026)

A factual account of what an external review of SimplifiedCS found, what was changed, and how
each change was checked. No usage figures or outcomes are claimed - the changes had not been
deployed when this was written.

## Starting point

SimplifiedCS is a static single-page site (vanilla JavaScript, esbuild) on Netlify, with two
Netlify Functions calling the Anthropic API and three Supabase Edge Functions filling public
threat-intelligence feeds. A review of the code and the live site raised issues in four groups.

## 1. Security

| Found | Changed | Checked by |
|---|---|---|
| Feed items (news, exploits) are third-party text; one field was rendered through a hand-written HTML allowlist | Text is decoded then escaped at ingestion and escaped again at render; the one rich field goes through DOMPurify with links restricted to http(s) | Fixtures with encoded tags, event attributes and `javascript:` links run through ingestion → stored row → render (`test/feed-ingestion.test.js`, `test/html-safety.test.js`) |
| AI endpoints' rate limiting counted by listing keys (racy) and allowed requests when the store failed | Admission uses Netlify Blobs conditional writes: per-client windows, a site-wide daily request and token budget, bounded concurrency, a duplicate-request lock; it fails closed | Concurrency tests with an in-memory compare-and-set store; 4 of them fail against the old approach (`test/ai-admission.test.js`) |
| Scheduled feed jobs were callable with the public key, any HTTP method, no overlap protection | POST only, a private scheduler secret compared in constant time, and a Postgres lease so runs can't overlap or repeat too soon | `test/scheduled-jobs.test.js` |
| Browser roles held default table privileges beyond read (including TRUNCATE); migrations weren't in the repo | The five applied migrations committed verbatim; a least-privilege grants migration | Policy tests on an in-process Postgres (PGlite) that fail without the migration (`test/supabase-policies.test.js`) |
| Answers were sent to the AI automatically for "Other" text; no privacy page; analytics loaded for everyone | Nothing AI-related runs without an explicit, versioned agreement showing exactly what's sent; `/privacy`; Google Analytics loads only after "Allow" | `test/ai-endpoints.test.js` (consent required server-side), `test/privacy.test.js` (no Google script before consent) |

## 2. Honest scoring

The review reproduced a cloud-only organization with no MFA and every other answer at its best
scoring **99% "Strong health"**, and weak DevSecOps, secrets and container answers scoring 100%
with no gaps. Methodology 2.0 (see `docs/methodology.md`) separates "Not sure" from "No", scores
setup answers that describe controls, lets critical gaps decide the reading before any
percentage, ignores answers to questions that no longer apply, and ranks every finding with
visible reasons. Each reproduced failure is now a regression test (`test/scoring.test.js`,
"review: ..." cases).

## 3. AI output tied to evidence

The AI response used to accept whatever URLs and claims the model returned. Now the server
retrieves public records (CISA KEV, NVD) itself, gives each an ID, and the model may only cite
those IDs; anything uncited, or cited against the wrong product, is dropped. Each product gets a
per-source status ("checked - no match", "source unavailable", "not checked - lookup limit"), so
an outage can't look like a clean result. Fixtures cover prompt-like answer text, source outages,
cross-product citations, truncated and refused model replies, and valid empty results
(`test/ai-endpoints.test.js`, all with fictional CVE IDs and a mocked model).

## 4. Product quality

- Quick mode was ~52 required answers; it's now a 14-answer screening with a test that walks every
  path.
- Answers are native radio buttons and checkboxes in fieldsets; focus is kept across re-renders;
  checked with real keyboard input in a browser. An automated axe-core audit of every page in
  both themes (`npm run a11y`) found only colour-contrast failures in the light theme, now fixed.
  No screen-reader testing has been done yet; `docs/screen-reader-check.md` is the checklist for it.
- Section labels used NIST CSF 1.1 codes in a "CSF 2.0" UI; every framework reference is now
  checked against official identifier lists, and every MITRE ATT&CK technique against ATT&CK
  v19.2 (one deprecated technique was caught and replaced).
- The PDF is built from the same report model as the page. Rendering generated PDFs to images
  found bold headings running past the right margin; a test now checks every text run against
  both margins using the same font metrics.
- The initial script went from 3.0 MB unminified to 543 KB minified, with the PDF generator and
  database client loaded on demand and content-hashed files cached for a year. CI runs the tests,
  checks the committed build matches the sources, and audits production dependencies.

## Verification summary

199 automated tests across 24 files pass locally (106 before this work). Browser checks were run
against a local server that applies the production security headers. Not yet verified: anything
in production (not deployed), Netlify environment-variable scopes (not visible with the access
used), and assistive-technology behaviour beyond keyboard use.
