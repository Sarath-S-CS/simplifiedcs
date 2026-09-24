// "AI-enhanced insights": optional, and never automatic. Before anything is
// sent the visitor sees what will be sent and who processes it, and ticks an
// explicit agreement (../engine/ai-consent.js). Results are rendered from
// the server's validated response: vulnerability items always show the
// public records they cite, and the status of each source per product is
// shown so "nothing found" is never implied when nothing was checked.
import { escapeHtml, safeHttpUrl } from "./html-safety.js";
import { hasAiConsent } from "../engine/ai-consent.js";

const e = escapeHtml;

export const SOURCE_STATUS_TEXT = {
  "checked-no-match": "Checked - no match",
  "potential-match": "Potential match (see below)",
  "ambiguous-product": "Too ambiguous to check",
  "source-unavailable": "Source unavailable - not checked",
  "not-checked-budget": "Not checked (lookup limit reached)",
  "not-applicable": "Not checked - managed service",
  "not-checked-example": "Not checked (example report)",
};

const APPLICABILITY_TEXT = {
  "potential-match": "Potential match - confirm your version",
  "platform-not-indicated": "Potential match - platform not stated in the record",
  "vendor-only": "Vendor match only - this product isn't confirmed",
};

export function consentHtml(payload) {
  const remembered = hasAiConsent();
  const productList = payload.products.length ? payload.products.map((p) => `${e(p.name)} (${e(p.category)})`).join(", ") : "none named";
  return `
    <div class="ai-consent">
      <h4>Before you send anything</h4>
      <ul class="ai-consent-list">
        <li><b>What's sent:</b> your industry, regions and frameworks; the reading and findings above; each answer (question, option chosen, status); and the products you named: ${productList}. <b>Not sent:</b> company name, "requested by", or anything else you typed on this page.</li>
        <li><b>Who processes it:</b> SimplifiedCS's server checks the named products against two public sources - CISA's Known Exploited Vulnerabilities catalog and NIST's National Vulnerability Database - then sends the request and those public records to Anthropic's Claude API to write the insights. <a href="https://www.anthropic.com/legal/commercial-terms" target="_blank" rel="noopener noreferrer">Anthropic's commercial terms</a> apply to that processing.</li>
        <li><b>What SimplifiedCS keeps:</b> nothing from the request content. Server logs record only technical details (timing, sizes, error types). For rate limiting, a salted one-way hash of your IP address is kept in a per-day counter; counters older than a day are deleted automatically as the service is used. The result is stored only in this browser, with this report. <a href="/privacy" class="inline-link">Privacy details</a></li>
        <li><b>Limits:</b> AI output can be wrong. Vulnerability items only ever come from the public records shown with them; confirm against your vendor before acting.</li>
      </ul>
      <details class="ai-payload-preview">
        <summary>Show exactly what will be sent</summary>
        <pre>${e(JSON.stringify(payload, null, 2))}</pre>
      </details>
      <label class="ai-consent-check">
        <input type="checkbox" id="aiConsentCheck" data-fkey="aiConsentCheck" ${remembered ? "checked" : ""}>
        <span>I agree to send these assessment details for AI processing as described above.</span>
      </label>
    </div>`;
}

export function aiErrorText(status, body) {
  const msg = body?.error?.message;
  const retry = body?.error?.retryAfterSeconds;
  const wait = retry ? ` You can try again in about ${retry >= 120 ? `${Math.ceil(retry / 60)} minutes` : `${retry} seconds`}.` : "";
  if (msg) return `${msg}${wait}`;
  if (status === 0) return "Couldn't reach the AI service (network error or timeout). The rest of this report is unaffected.";
  if (status >= 200 && status < 300) return "The AI service sent back a response this page doesn't recognise, so nothing is shown. Try again later.";
  return `The AI service returned an error (HTTP ${status}). The rest of this report is unaffected.`;
}

function sourceStatusHtml(result) {
  if (!result.sourceStatus?.length) return `<p class="body-text">No products were named in this assessment, so no vulnerability sources were checked.</p>`;
  return `
    <div class="table-scroll">
      <table class="ai-status-table">
        <caption>Vulnerability sources checked, per product</caption>
        <thead><tr><th scope="col">Product</th><th scope="col">CISA KEV</th><th scope="col">NVD</th></tr></thead>
        <tbody>
          ${result.sourceStatus
            .map(
              (s) => `<tr><th scope="row">${e(s.name)} <span class="scope-hint">${e(s.category)}</span>${(s.notes || []).length ? `<div class="scope-hint">${s.notes.map(e).join(" ")}</div>` : ""}</th>
                <td>${e(SOURCE_STATUS_TEXT[s.kev] || s.kev)}</td><td>${e(SOURCE_STATUS_TEXT[s.nvd] || s.nvd)}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function advisoriesHtml(result) {
  if (!result.advisories?.length) return "";
  return `
    <h4>Possible vulnerabilities in named products</h4>
    ${result.advisories
      .map(
        (a) => `
      <div class="vendor-note-item ai-advisory">
        <b>${e(a.productName)}</b> <span class="gap-tier gap-tier-2">${e(APPLICABILITY_TEXT[a.applicability] || a.applicability)}</span>
        <p>${e(a.summary)}</p>
        <p><b>How to check:</b> ${e(a.verification)}</p>
        <ul class="ai-evidence">
          ${a.evidence
            .map((ev) => {
              const url = safeHttpUrl(ev.url);
              return `<li>${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${e(ev.cveId)}</a>` : e(ev.cveId)} - ${e(ev.source)}, ${e(ev.publishedAt)}${ev.ransomware ? " · known ransomware use" : ""}${ev.versionInfo ? ` · ${e(ev.versionInfo)}` : ""}${ev.platforms?.length ? ` · platforms: ${ev.platforms.map(e).join(", ")}` : ""}</li>`;
            })
            .join("")}
        </ul>
      </div>`
      )
      .join("")}`;
}

function patternsHtml(result) {
  if (!result.patterns?.length) return "";
  return `
    <h4>Patterns across your answers</h4>
    ${result.patterns
      .map(
        (p) => `
      <div class="vendor-note-item">
        <b>${e(p.finding)}</b><br>${e(p.why)}
        ${p.basedOn?.length ? `<div class="scope-hint">Based on: ${p.basedOn.map((b) => `"${e(b)}"`).join("; ")}</div>` : ""}
      </div>`
      )
      .join("")}`;
}

export function aiResultHtml(result, { stale = false } = {}) {
  const when = result.example ? "Illustrative example - no live lookup was run." : `Generated ${e(new Date(result.generatedAt).toLocaleString())}${result.model ? ` by ${e(result.model)}` : ""}.`;
  return `
    ${stale ? `<div class="stale-banner" role="note"><b>Out of date:</b> these insights were generated for an earlier version of this report. Your answers have changed since - request new insights to match the current report.</div>` : ""}
    <p class="scope-hint">${when} AI-generated - it can be wrong.</p>
    <h4>Sources checked</h4>
    ${sourceStatusHtml(result)}
    ${advisoriesHtml(result)}
    ${patternsHtml(result)}
    ${result.narrative ? `<h4>Summary</h4><p class="body-text">${e(result.narrative)}</p>` : ""}
    ${(result.limitations || []).length ? `<ul class="limitations">${result.limitations.map((l) => `<li>${e(l)}</li>`).join("")}</ul>` : ""}
    ${!result.advisories?.length && !result.example ? `<p class="scope-hint">No vulnerability item is shown unless a public record supports it. "Checked - no match" means the source had no record for that product name, not that the product is free of vulnerabilities.</p>` : ""}`;
}
