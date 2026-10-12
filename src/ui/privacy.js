// Privacy: the /privacy page. Keep the page text in step with what the code
// actually does - every claim here is checked against: src/head.html
// (Cloudflare Web Analytics), src/engine/local-data.js (browser storage),
// src/engine/ai-payload.js and netlify/lib/* (AI requests),
// src/data/supabase-client.js (public feeds).
import { LOCAL_DATA, clearAllLocalData } from "../engine/local-data.js";
import { withdrawAiConsent, hasAiConsent } from "../engine/ai-consent.js";
import { escapeHtml } from "./html-safety.js";

const e = escapeHtml;

// ---------- page ----------
export function renderPrivacyPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Privacy</div>
        <h2 class="page-title" tabindex="-1">Privacy and your data</h2>
        <p class="page-lede">Short version: the assessment runs in your browser and your answers stay in this browser unless you choose to send them for AI insights. The site uses cookieless analytics to understand overall usage.</p>
      </div>

      <div class="section-tile privacy-page">
        <h3 class="section-h">Your assessment answers</h3>
        <p class="body-text">Questions are scored in your browser. Answers are not sent to SimplifiedCS or anyone else, with one exception you control: if you ask for <b>AI-enhanced insights</b> on a report (or AI interpretation of your "Other" answers), the details listed next to that button are sent - after you tick the agreement - to SimplifiedCS's server function, which looks up the products you named (with their versions, if you gave them) in two public sources (CISA's Known Exploited Vulnerabilities catalog and NIST's National Vulnerability Database) and sends the request and those public records to Anthropic's Claude API to generate the text. Company name and "report requested by" are never included. You can see exactly what will be sent before sending it.</p>
        <p class="body-text">SimplifiedCS doesn't store the content of AI requests. Server logs record technical details only (timing, sizes, error types). To prevent abuse, a salted one-way hash of your IP address is counted in a per-day rate-limit counter; counters are deleted by a daily cleanup job once they are more than a day old. Anthropic processes the request under <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer">its commercial terms</a> and <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.</p>
        <p class="body-text">Your AI choice is currently: <b>${hasAiConsent() ? "agreed (for the current notice)" : "not given"}</b>. ${hasAiConsent() ? `<button type="button" id="withdrawAi" class="link-btn">Withdraw it</button> - you'll be asked again before any future request.` : "You'll be asked on the report page before anything is sent."}</p>

        <h3 class="section-h">What's stored in this browser</h3>
        <p class="body-text">These are kept in your browser's local storage for this site only. They are never sent to a server by SimplifiedCS. On a shared computer, clear them when you're done.</p>
        <ul class="privacy-list">${LOCAL_DATA.map((d) => `<li><b>${e(d.what)}</b></li>`).join("")}</ul>
        <div class="cta-row"><button type="button" class="cta-btn secondary" id="privacyClearAll">Clear all data stored by this site</button></div>
        <p class="scope-hint" id="privacyClearResult" role="status"></p>

        <h3 class="section-h">Analytics</h3>
        <p class="body-text">The site uses Cloudflare Web Analytics to understand overall usage - page views, referrers, and coarse browser and country information. It is cookieless: it sets no cookies, stores nothing on your device, and uses no fingerprinting, so there is no cross-site tracking and no personal profile. It never receives your answers, scores or report content.</p>
        <p class="body-text">Because it stores nothing on your device and builds no profile of you, no cookie or consent banner is needed. To opt out entirely, use your browser's privacy settings or an analytics blocker, which this site does not try to defeat.</p>

        <h3 class="section-h">Feedback form</h3>
        <p class="body-text">If you use the form on the <a href="/feedback" class="inline-link">Feedback page</a>, what you choose as the topic, your message and - only if you give one - your email address are sent to Netlify, the site's host, which stores them in Netlify Forms and screens them for spam using Akismet. Only the site's creator reads them, to understand the feedback and to reply if you left an address. Nothing from your assessment is attached. To have a message deleted, get in touch through the <a href="/about" class="inline-link">About page</a>.</p>

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
    if (!confirm("Remove everything SimplifiedCS has stored in this browser - saved reports, in-progress answers, action tracking, and your AI choice? This can't be undone.")) return;
    const n = clearAllLocalData();
    container.querySelector("#privacyClearResult").textContent = n ? `Removed ${n} stored item${n === 1 ? "" : "s"}.` : "There was nothing stored to remove.";
  });
  const withdraw = container.querySelector("#withdrawAi");
  if (withdraw)
    withdraw.addEventListener("click", () => {
      withdrawAiConsent();
      renderPrivacyPage(container);
    });
}
