// Privacy: the /privacy page, the analytics cookie banner, and the one
// helper that sends analytics events (only after consent, never with
// answers). Keep the page text in step with what the code actually does -
// every claim here is checked against: assets/gtag-init.js (analytics),
// src/engine/local-data.js (browser storage), src/engine/ai-payload.js and
// netlify/lib/* (AI requests), src/data/supabase-client.js (public feeds).
import { LOCAL_DATA, clearAllLocalData } from "../engine/local-data.js";
import { withdrawAiConsent, hasAiConsent } from "../engine/ai-consent.js";
import { escapeHtml } from "./html-safety.js";

const e = escapeHtml;

function analytics() {
  return typeof window !== "undefined" ? window.scsAnalytics : null;
}

export function analyticsChoice() {
  return analytics()?.choice() || null;
}

// Minimal, consent-gated events: what kind of thing happened, never what
// anyone answered. Nothing is queued before consent (a queued event would
// be sent later if consent were given).
export function trackEvent(name, params = {}) {
  if (analyticsChoice() !== "granted" || typeof window.gtag !== "function") return;
  const safe = {};
  for (const [k, v] of Object.entries(params)) if (["mode", "format", "page"].includes(k) && typeof v === "string") safe[k] = v.slice(0, 40);
  window.gtag("event", name, safe);
}

// ---------- cookie banner ----------
export function showCookieBanner({ force = false } = {}) {
  if (typeof document === "undefined" || !analytics()) return;
  if (!force && analyticsChoice()) return;
  if (document.getElementById("cookieBanner")) return;
  const bar = document.createElement("section");
  bar.id = "cookieBanner";
  bar.className = "cookie-banner";
  bar.setAttribute("aria-label", "Analytics cookies");
  bar.innerHTML = `
    <p><b>Analytics cookies?</b> With your permission, SimplifiedCS uses Google Analytics to count visits and see which pages are used. It never receives your assessment answers. Nothing is sent to Google unless you allow it. <a href="/privacy" class="inline-link">Privacy</a></p>
    <div class="cookie-actions">
      <button type="button" id="cookieDeny">No thanks</button>
      <button type="button" class="primary" id="cookieAllow">Allow analytics</button>
    </div>`;
  document.body.appendChild(bar);
  const close = () => bar.remove();
  document.getElementById("cookieAllow").addEventListener("click", () => {
    analytics().grant();
    close();
  });
  document.getElementById("cookieDeny").addEventListener("click", () => {
    close();
    analytics().deny();
  });
  document.getElementById("cookieDeny").focus({ preventScroll: true });
}

export function wireCookieSettingsButton() {
  const btn = typeof document !== "undefined" ? document.getElementById("cookieSettingsBtn") : null;
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => showCookieBanner({ force: true }));
  }
}

// ---------- page ----------
export function renderPrivacyPage(container) {
  const choice = analyticsChoice();
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Privacy</div>
        <h2 class="page-title" tabindex="-1">Privacy and your data</h2>
        <p class="page-lede">Short version: the assessment runs in your browser. Your answers stay in this browser unless you choose to send them for AI insights. Analytics only run if you allow them.</p>
      </div>

      <div class="section-tile privacy-page">
        <h3 class="section-h">Your assessment answers</h3>
        <p class="body-text">Questions are scored in your browser. Answers are not sent to SimplifiedCS or anyone else, with one exception you control: if you ask for <b>AI-enhanced insights</b> on a report (or AI interpretation of your "Other" answers), the details listed next to that button are sent - after you tick the agreement - to SimplifiedCS's server function, which looks up the products you named in two public sources (CISA's Known Exploited Vulnerabilities catalog and NIST's National Vulnerability Database) and sends the request and those public records to Anthropic's Claude API to generate the text. Company name and "report requested by" are never included. You can see exactly what will be sent before sending it.</p>
        <p class="body-text">SimplifiedCS doesn't store the content of AI requests. Server logs record technical details only (timing, sizes, error types). To prevent abuse, a salted one-way hash of your IP address is counted in a per-day rate-limit counter; counters older than a day are deleted automatically as the service is used. Anthropic processes the request under <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer">its commercial terms</a> and <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.</p>
        <p class="body-text">Your AI choice is currently: <b>${hasAiConsent() ? "agreed (for the current notice)" : "not given"}</b>. ${hasAiConsent() ? `<button type="button" id="withdrawAi" class="link-btn">Withdraw it</button> - you'll be asked again before any future request.` : "You'll be asked on the report page before anything is sent."}</p>

        <h3 class="section-h">What's stored in this browser</h3>
        <p class="body-text">These are kept in your browser's local storage for this site only. They are never sent to a server by SimplifiedCS. On a shared computer, clear them when you're done.</p>
        <ul class="privacy-list">${LOCAL_DATA.map((d) => `<li><b>${e(d.what)}</b></li>`).join("")}</ul>
        <div class="cta-row"><button type="button" class="cta-btn secondary" id="privacyClearAll">Clear all data stored by this site</button></div>
        <p class="scope-hint" id="privacyClearResult" role="status"></p>

        <h3 class="section-h">Analytics</h3>
        <p class="body-text">If you allow it, Google Analytics 4 records page views and a few coarse events (an assessment was started or completed, in which mode; a report was exported, in which format) using cookies. It never receives answers, scores or report content. Google signals and ad personalization are turned off. If you don't allow it, Google's script isn't loaded at all.</p>
        <p class="body-text">Your analytics choice is currently: <b>${choice === "granted" ? "allowed" : choice === "denied" ? "declined" : "not made yet (off)"}</b>.</p>
        <div class="cta-row">
          <button type="button" class="cta-btn secondary" id="privacyAnalyticsAllow" ${choice === "granted" ? "disabled" : ""}>Allow analytics</button>
          <button type="button" class="cta-btn secondary" id="privacyAnalyticsDeny" ${choice === "denied" ? "disabled" : ""}>Turn analytics off</button>
        </div>

        <h3 class="section-h">Live feeds</h3>
        <p class="body-text">The News, Exploit Tracker and Case Studies pages read public data from SimplifiedCS's Supabase database. Those requests contain nothing about you beyond what any web request contains.</p>

        <h3 class="section-h">Hosting</h3>
        <p class="body-text">The site is hosted on Netlify, which - like any web host - processes standard request information such as IP addresses to deliver pages and protect the service.</p>

        <h3 class="section-h">Questions</h3>
        <p class="body-text">See the <a href="/about" class="inline-link">About page</a> for how to reach the creator. This page describes how the site works; it isn't legal advice.</p>
      </div>
    </div>`;
  const clearBtn = container.querySelector("#privacyClearAll");
  clearBtn.addEventListener("click", () => {
    if (!confirm("Remove everything SimplifiedCS has stored in this browser - saved reports, in-progress answers, action tracking, and your cookie and AI choices? This can't be undone.")) return;
    const n = clearAllLocalData();
    container.querySelector("#privacyClearResult").textContent = n ? `Removed ${n} stored item${n === 1 ? "" : "s"}.` : "There was nothing stored to remove.";
  });
  const withdraw = container.querySelector("#withdrawAi");
  if (withdraw)
    withdraw.addEventListener("click", () => {
      withdrawAiConsent();
      renderPrivacyPage(container);
    });
  container.querySelector("#privacyAnalyticsAllow").addEventListener("click", () => {
    analytics()?.grant();
    renderPrivacyPage(container);
  });
  container.querySelector("#privacyAnalyticsDeny").addEventListener("click", () => {
    analytics()?.deny();
    renderPrivacyPage(container);
  });
}

// ---------- feedback ----------
// Netlify Forms isn't enabled for this site, so the old form's messages were
// never delivered. Until it is, feedback goes to places that actually work.
export function renderFeedbackPage(container) {
  const issueUrl = "https://github.com/Sarath-S-CS/simplifiedcs/issues/new?title=" + encodeURIComponent("Feedback: ") + "&body=" + encodeURIComponent("What happened, or what would you like to see?\n\n(Please don't include anything confidential - GitHub issues are public.)\n");
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Feedback</div>
        <h2 class="page-title" tabindex="-1">Send feedback</h2>
        <p class="page-lede">Found something broken, confusing or missing? Feedback is read and shapes what gets worked on next.</p>
      </div>
      <div class="section-tile">
        <div class="cta-row">
          <a class="cta-btn" href="${issueUrl}" target="_blank" rel="noopener noreferrer">Open a GitHub issue →</a>
          <a class="cta-btn secondary" href="https://www.linkedin.com/in/sarath-surendran/" target="_blank" rel="noopener noreferrer">Message on LinkedIn</a>
        </div>
        <p class="scope-hint">GitHub issues are public - please don't include anything confidential, such as your assessment answers. A GitHub account is needed to open an issue.</p>
      </div>
    </div>`;
}
