// Per-page description and social-preview metadata. Applied on every
// navigation, and captured into each prerendered page by
// scripts/prerender.js, so search engines and link previews (which don't run
// JavaScript) see a description that matches the page. Keep each one a
// factual summary of what's on that page.
const SITE = "https://simplifiedcs.net";

export const PAGE_DESCRIPTIONS = {
  home: "A free cybersecurity self-assessment for small and medium organizations: adaptive questions, a reading referenced to NIST CSF 2.0 and CIS Controls, and a ranked action plan. Runs in your browser.",
  methodology: "How the SimplifiedCS assessment works: what it asks, how answers are graded, how combined risks are detected, and how findings are ranked.",
  maturity: "A ten-phase cybersecurity maturity model, from asset discovery to continuous improvement, with what each phase produces and when it's done.",
  metrics: "Exactly how SimplifiedCS calculates coverage and completeness, and what each reading - from Critical gaps found to Strong foundations - means.",
  coreprinciples: "The principles behind SimplifiedCS: practical, prioritized cybersecurity guidance built on existing tools and minimal cost.",
  maturitymodel: "What SimplifiedCS is, who it's for, and what the assessment, reports and resources do - and don't - cover.",
  starterguide: "A plain-language starter guide to basic cybersecurity controls, before you take the assessment.",
  threatmodeling: "An introduction to threat modeling: identifying what you're protecting, from whom, and which controls matter most.",
  securitytools: "A curated list of security tools, open-source and commercial, grouped by what they help with.",
  roadmap: "What's shipped on SimplifiedCS, what's being built, and what's planned next.",
  runbook: "Step-by-step incident runbooks for common security incidents, written for small teams.",
  news: "Recent cybersecurity news and vulnerability updates, curated and categorized.",
  exploits: "Actively exploited vulnerabilities from public sources, with exploitation likelihood and practical guidance.",
  casestudy: "Real-world security incidents and what small and medium organizations can learn from them.",
  playbooks: "Security playbooks mapped to OWASP Top 10 and MITRE ATT&CK techniques, with prevention and response steps.",
  glossary: "Plain-language definitions of common cybersecurity terms.",
  references: "The standards, frameworks and sources SimplifiedCS draws on.",
  about: "About SimplifiedCS and its creator.",
  feedback: "Send feedback about SimplifiedCS.",
  privacy: "What SimplifiedCS stores, what an optional AI request sends and to whom, and how analytics work only with your permission.",
  assessment: "Take a 14-question Quick screening or a Full cybersecurity assessment, or view example reports for two fictional organizations.",
  history: "Assessments you've completed, saved in this browser only.",
};

function setMeta(selector, attr, value) {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export function applyPageMeta(tab, title, path) {
  if (typeof document === "undefined") return;
  const description = PAGE_DESCRIPTIONS[tab] || PAGE_DESCRIPTIONS.home;
  const url = SITE + (path === "/" ? "/" : path);
  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:url"]', "content", url);
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);
  // History only ever shows data from the visitor's own browser - nothing
  // there is worth indexing.
  let robots = document.head.querySelector('meta[name="robots"]');
  if (tab === "history") {
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex");
  } else if (robots) {
    robots.remove();
  }
}
