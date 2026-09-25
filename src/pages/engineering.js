// Engineering case study page (/engineering): what an external review
// found, what changed, and how each change was checked - the page version of
// docs/engineering-case-study.md. Keep the two in step, and keep every claim
// checkable: no usage figures, outcomes or certifications.
import { pathForTab, wireNavLinksByDataset } from "../router.js";

const REPO = "https://github.com/Sarath-S-CS/simplifiedcs/blob/main/";

const SECURITY_ROWS = [
  {
    found: "News and exploit items are third-party text; one field was rendered through a hand-written HTML allowlist.",
    changed: "Text is decoded then escaped when it's stored and escaped again when it's shown; the one rich field goes through DOMPurify, with links limited to http(s).",
    checked: "Fixtures with encoded tags, event attributes and <code>javascript:</code> links, run from ingestion to stored row to page (<code>test/feed-ingestion.test.js</code>, <code>test/html-safety.test.js</code>).",
  },
  {
    found: "The AI endpoints' rate limit counted by listing keys, which races, and let requests through when its store failed.",
    changed: "Admission uses Netlify Blobs conditional writes: per-visitor windows, a site-wide daily request and token budget, bounded concurrency and a duplicate-request lock. If the store fails, requests are refused.",
    checked: "Concurrency tests against an in-memory compare-and-set store; four of them fail against the old approach (<code>test/ai-admission.test.js</code>).",
  },
  {
    found: "The scheduled feed jobs could be called with the public key, by any HTTP method, with nothing stopping overlapping runs.",
    changed: "POST only, a private scheduler secret compared in constant time, and a database lease so runs can't overlap or repeat too soon.",
    checked: "<code>test/scheduled-jobs.test.js</code>; in production, a request without the secret gets 401 and a GET gets 405.",
  },
  {
    found: "The browser-facing database roles held default privileges beyond reading (including TRUNCATE), and the migrations weren't in the repository.",
    changed: "The five applied migrations committed as they were, plus a least-privilege grants migration.",
    checked: "Permission tests on an in-process Postgres (PGlite) that fail without the migration (<code>test/supabase-policies.test.js</code>); in production, a write with the public key is refused.",
  },
  {
    found: "\"Other\" answers were sent to the AI automatically, there was no privacy page, and analytics loaded for everyone.",
    changed: "Nothing AI-related runs without an explicit, versioned agreement that shows exactly what's sent; a <a href=\"/privacy\" class=\"inline-link\" data-tab=\"privacy\">privacy page</a>; Google Analytics loads only after \"Allow\".",
    checked: "The server refuses requests without the agreement (<code>test/ai-endpoints.test.js</code>); no Google script before consent (<code>test/privacy.test.js</code>); both checked again on the live site.",
  },
];

const PRODUCTION_ROWS = [
  ["Database", "Browser-facing roles can only read the three public feed tables; a write with the public key returns 401. The job-lease functions can only be run by the server role."],
  ["Feed jobs", "Redeployed. Without the scheduler secret: 401. Manual runs refreshed 79 news items and 102 exploit records with no errors, and both leases were released."],
  ["Site", "Security headers enforced (Content-Security-Policy, HSTS, frame blocking); built files cached for a year because their names change with their content."],
  ["AI endpoints", "An empty request gets 400 (agreement required) and no model call. One authorized test with the fictional IT-services example answers returned in 22 seconds: a source status for each of the 6 named products, 4 possible vulnerabilities each citing a retrieved CISA KEV or NVD record, and nothing dropped by validation."],
  ["In the browser", "No console errors; before consent, no request goes to Google Analytics; the News page loads 75 items; a Quick screening runs end to end and keeps the AI button disabled until the visitor agrees. Test data was cleared afterwards."],
];

const NOT_VERIFIED = [
  "<b>Screen-reader testing</b> hasn't been done. Keyboard use was tested with real key presses, and an automated audit covers every page; the manual checklist is <a class=\"inline-link\" href=\"" + REPO + "docs/screen-reader-check.md\" target=\"_blank\" rel=\"noopener noreferrer\">docs/screen-reader-check.md</a>.",
  "<b>The AI panel in the live page</b> wasn't used for a real request - the one paid test called the endpoint directly. The panel's rendering is covered by local tests with the same response shape.",
  "<b>Hosting settings:</b> the Anthropic API key can't be limited to server functions on the site's current Netlify plan. It isn't used by any build step and never reaches the browser.",
  "<b>Version matching</b> checks a stated firewall or web server version against NVD's list for that exact version only for FortiOS, PAN-OS, SonicOS, Junos, WatchGuard Fireware, nginx, Apache HTTP Server and Tomcat; other products' matches stay \"potential\".",
];

export function renderEngineeringTab(container){
  container.innerHTML = `
    <div class="page eng-page">
      <div class="page-intro">
        <div class="page-eyebrow">Engineering</div>
        <h2 class="page-title">Acting on an external review</h2>
        <p class="page-lede">In September 2026 an external review of SimplifiedCS's code and live site raised issues in four areas. This page sets out what it found, what was changed, and how each change was checked. The changes went live on 24 September 2026. No usage figures or business outcomes are claimed.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Starting point</h3>
        <p class="body-text">SimplifiedCS is a static single-page site (plain JavaScript, bundled with esbuild) hosted on Netlify. Two server functions call the Anthropic API for the optional AI insights, and scheduled Supabase functions fill the public News and Exploit feeds. The review covered the code and the live site.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Security</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Found</th><th scope="col">Changed</th><th scope="col">Checked by</th></tr></thead>
            <tbody>
              ${SECURITY_ROWS.map(r=>`<tr><td class="dt-title">${r.found}</td><td>${r.changed}</td><td>${r.checked}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Honest scoring</h3>
        <p class="body-text">The review showed that a cloud-only organization with no multi-factor authentication, and every other answer at its best, scored <b>99% "Strong health"</b>, and that weak DevSecOps, secrets and container answers scored 100% with no gaps. <a href="${pathForTab('methodology')}" class="inline-link" data-tab="methodology">Methodology 2.0</a> separates "Not sure" from "No", scores the setup answers that describe controls, lets critical gaps decide the reading before any percentage, ignores answers to questions that no longer apply, and ranks every finding with visible reasons. Each failure the review reproduced is now a regression test.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">AI output tied to evidence</h3>
        <p class="body-text">The AI response used to accept whatever links and claims the model returned. Now the server retrieves the public records itself (CISA's Known Exploited Vulnerabilities catalog and NIST's National Vulnerability Database), gives each one an ID, and the model may only cite those IDs; anything uncited, or cited against the wrong product, is dropped. Each product gets a status per source - "checked, no match", "source unavailable", "not checked, lookup limit reached" - so an outage can't look like a clean result. Tests cover prompt-like answer text, source outages, cross-product citations, cut-off and refused model replies, and valid empty results, all with fictional CVE IDs and a simulated model.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Product quality</h3>
        <ul class="tech-highlights-list">
          <li><b>Quick mode</b> needed about 52 answers; it's now a 14-answer screening, with a test that walks every path through it.</li>
          <li><b>Accessibility:</b> answers are native radio buttons and checkboxes in labelled groups, and keyboard focus is kept when the page redraws. An automated audit (axe-core, WCAG 2.2 A and AA) runs on every page and assessment screen in both themes and now passes; it found text colours in the light theme that were too pale, since fixed.</li>
          <li><b>Framework references:</b> section labels used NIST CSF 1.1 codes in a "CSF 2.0" interface. Every framework reference is now checked against the official identifier lists, and every MITRE ATT&amp;CK technique against ATT&amp;CK v19.2 - which caught one deprecated technique.</li>
          <li><b>PDF reports</b> are built from the same report model as the page. Rendering them to images showed bold headings running past the right margin; a test now checks every line against both margins using the same font measurements.</li>
          <li><b>Speed and upkeep:</b> the initial script went from 3.0 MB unminified to 543 KB minified, with the PDF generator and database client loaded only when needed. The 4,400-line main script now has one module per page. Every change runs the tests, checks the published build matches the source, and audits production dependencies.</li>
        </ul>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Verified in production (24 September 2026)</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th scope="col">Area</th><th scope="col">Result</th></tr></thead>
            <tbody>
              ${PRODUCTION_ROWS.map(([area, result])=>`<tr><td class="dt-title">${area}</td><td>${result}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="body-text">Before release, the automated test suite had grown from 106 to 199 tests, all passing, and browser checks had run against a local server that applies the production security headers.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Not verified yet</h3>
        <ul class="tech-highlights-list">
          ${NOT_VERIFIED.map(item=>`<li>${item}</li>`).join('')}
        </ul>
        <p class="body-text">The full finding-by-finding record, with file references, is in <a class="inline-link" href="${REPO}docs/review-remediation-status.md" target="_blank" rel="noopener noreferrer">docs/review-remediation-status.md</a>.</p>
      </div>
    </div>
  `;
  wireNavLinksByDataset(container, 'a.inline-link[data-tab]');
}
