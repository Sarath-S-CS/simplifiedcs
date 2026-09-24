// Card templates for the three live Supabase feeds (News, Exploits, Case
// Studies). Moved out of main.js so the exact markup the site renders can be
// exercised by test/feed-ingestion.test.js with storage-shaped rows.
//
// Every field is third-party text (RSS feeds, CISA/VulnCheck/EUVD catalogs,
// a web-searching model), so: plain text always goes through escapeHtml(),
// links through safeHttpUrl(), and the one field stored as HTML
// (exploit_items.safe_guidance) through sanitizeGuidanceHtml(). Static,
// hand-written fallback content (NEWS_ITEMS, CASE_STUDIES) takes the same
// path - it's plain text too.
import { escapeHtml, safeHttpUrl, sanitizeGuidanceHtml } from "./html-safety.js";

function formatDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function percent(value) {
  const n = Number(value);
  return value == null || !Number.isFinite(n) ? null : (n * 100).toFixed(1);
}

// n: { headline, body, source, sourceUrl, cveId, cat, publishedAt }
// opts.categoryLabel(id) -> label; opts.exploitHref(cveId) -> site path
export function newsCardHtml(n, { categoryLabel, exploitHref }) {
  const sourceHref = safeHttpUrl(n.sourceUrl);
  // Only KEV-sourced items are guaranteed to actually have a matching entry
  // on Exploits (which tracks confirmed actively-exploited CVEs
  // specifically, not every high-CVSS NVD disclosure) - checking source
  // here, not just presence of a CVE id, avoids linking NVD items through to
  // an Exploits card that may not exist. See §1 of EXPLOITS-FIX-BRIEF.md.
  const source =
    n.cveId && n.source === "CISA KEV Catalog"
      ? `<a class="news-source-exploit-link" href="${escapeHtml(exploitHref(n.cveId))}" data-goto-exploit="${escapeHtml(n.cveId)}">${escapeHtml(n.source)} - full detail on Exploits →</a>`
      : sourceHref
        ? `<a href="${escapeHtml(sourceHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.source)}</a>`
        : escapeHtml(n.source);
  return `
            <div class="news-card">
              <div class="news-meta"><span>${escapeHtml(formatDate(n.publishedAt))}</span><span class="news-cat">${escapeHtml(categoryLabel(n.cat) || n.cat)}</span></div>
              <h4>${escapeHtml(n.headline)}</h4>
              <p>${escapeHtml(n.body)}</p>
              <div class="news-source">${source}</div>
            </div>
          `;
}

// item: an exploit_items row as returned by Supabase.
export function exploitCardHtml(item) {
  const sourceHref = safeHttpUrl(item.source_url);
  const epssPct = percent(item.epss_score);
  const percentilePct = percent(item.epss_percentile);
  const dateAdded = formatDate(item.date_added);
  const dueDate = item.due_date ? formatDate(item.due_date) : "";
  return `
                <div class="exploit-card" id="exploit-${escapeHtml(item.cve_id)}">
                  <div class="exploit-meta">
                    <span class="exploit-cve">${escapeHtml(item.cve_id)}</span>
                    ${item.is_ransomware === true ? '<span class="exploit-ransomware-badge">Ransomware-Linked</span>' : ""}
                  </div>
                  <h4>${escapeHtml(item.headline)}</h4>
                  <div class="exploit-vendor">${escapeHtml(item.vendor)} · ${escapeHtml(item.product)}</div>
                  ${
                    epssPct != null
                      ? `
                    <div class="exploit-scores">
                      <div class="exploit-score-box">
                        <span class="exploit-score-value">${epssPct}%</span>
                        <span class="exploit-score-label">EPSS score - probability of exploitation in the next 30 days</span>
                      </div>
                      <div class="exploit-score-box">
                        <span class="exploit-score-value">${percentilePct ?? "-"}%</span>
                        <span class="exploit-score-label">EPSS percentile - riskier than this share of all scored CVEs</span>
                      </div>
                    </div>
                  `
                      : ""
                  }
                  <div class="exploit-sectors">${(Array.isArray(item.sectors_impacted) ? item.sectors_impacted : []).map((s) => `<span class="exploit-sector-chip">${escapeHtml(s)}</span>`).join("")}</div>
                  <p>${escapeHtml(item.description)}</p>
                  <p>${escapeHtml(item.explainer)}</p>
                  <p class="exploit-safety"><b>Staying safe:</b> ${sanitizeGuidanceHtml(item.safe_guidance)}</p>
                  <div class="exploit-footer">
                    <span class="exploit-dates">Added to KEV catalog ${escapeHtml(dateAdded)}${dueDate ? ` · CISA remediation due ${escapeHtml(dueDate)}` : ""}</span>
                    ${sourceHref ? `<a href="${escapeHtml(sourceHref)}" target="_blank" rel="noopener noreferrer">View on NVD →</a>` : ""}
                  </div>
                </div>
              `;
}

// c: { year, title, href, sourceName, summaryWhat, summaryHow, summaryImpact, lesson, summarySafeguard }
// Original explanation + lesson stay visible; the how/impact detail sits
// behind a native <details> disclosure. externalIcon is the site's icon()
// SVG markup (trusted, authored in this repo).
export function caseStudyCardHtml(c, { externalIcon = "" } = {}) {
  const href = safeHttpUrl(c.href);
  return `
    <div class="case-card">
      <div class="case-year">${escapeHtml(c.year)}</div>
      <h4>${escapeHtml(c.title)}</h4>
      <p>${escapeHtml(c.summaryWhat)}</p>
      <div class="case-lesson"><b>Why it's here -</b> ${escapeHtml(c.lesson)}</div>
      <div class="case-section"><b>How to safeguard against it</b>${escapeHtml(c.summarySafeguard)}</div>
      <details class="case-detail">
        <summary>Summary</summary>
        <div class="case-section"><b>How it happened</b>${escapeHtml(c.summaryHow)}</div>
        <div class="case-section"><b>Impact</b>${escapeHtml(c.summaryImpact)}</div>
      </details>
      ${href ? `<a class="case-link link-pill" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span class="link-pill-icon">${externalIcon}</span>Read more${c.sourceName ? ` - ${escapeHtml(c.sourceName)}` : ""}</a>` : ""}
    </div>
  `;
}
