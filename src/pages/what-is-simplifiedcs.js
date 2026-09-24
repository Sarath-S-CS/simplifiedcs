// "What is SimplifiedCS?" page (/what-is-simplifiedcs).
import { pathForTab, wireNavLink, wireNavLinksByDataset } from "../router.js";

// CONSOLIDATED-WORK-BRIEF.md §6: complete content rewrite - the previous
// version predated nearly everything built this session (no mention of
// AI enrichment, RAG, PDF export, Exploits, Trends & News, Runbooks/
// Playbooks, Case Studies, or the assessment modes). Content below is
// the brief's own finished text; this only builds the page and wires in
// every link, it doesn't rewrite the substance. Deliberately does NOT
// re-explain Maturity Model or Exploits in any depth - links out to them
// instead, the same way this page already correctly links out rather
// than duplicating other pages' content. Keeps the page's existing
// single-scroll TOC layout (not the Starter Guide's accordion pattern) -
// this page's job is a quick, complete overview in a couple of minutes,
// not deep reading. Every internal link uses a shared .ws-link class +
// data-tab, wired in one wireNavLinksByDataset() pass at the bottom
// rather than one wireNavLink() call per link - the previous version's
// per-link wiring doesn't scale to how many real links this rewrite
// needs (13, once every mentioned page is a working link, per the
// brief's own build note).
export function renderMaturityModelTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Reference</div>
        <h2 class="page-title">What is SimplifiedCS?</h2>
        <p class="page-lede">Most security assessments ask every organization the same static list of questions, no matter what's actually true about their environment. This one doesn't. It's an adaptive engine that changes based on your industry, your infrastructure, your region, and your own answers as you give them - cross-referencing everything you provide to catch risk combinations a static form would never surface. What comes back is a report built to be used, not filed away: specific findings, mapped to specific frameworks, tied to real attacker behavior, with an optional AI layer checking your exact vendors against what's actively being exploited right now - and a dedicated AI Readiness &amp; Governance track scoring how prepared your own organization is against AI-specific risk. Here's a closer look at what it actually does.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Contents</h3>
        <ul class="toc-list">
          <li><a href="#ws-what">What this tool actually does</a></li>
          <li><a href="#ws-how">How an assessment works, start to finish</a></li>
          <li><a href="#ws-reasoning">What makes the reasoning genuinely good, not just automated</a></li>
          <li><a href="#ws-frameworks">Every framework and standard it's built on</a></li>
          <li><a href="#ws-rest">The rest of the site - reference material, live threat data, and where to start if you're new</a></li>
        </ul>
      </div>

      <div class="section-tile">
        <h3 class="section-h" id="ws-what">What this tool actually does</h3>
        <p class="body-text">SimplifiedCS is an adaptive cybersecurity self-assessment platform - pick your industry, answer questions that change based on what you've already said, and get back a scored, prioritized report on where your organization actually stands. It's built for small and medium businesses that need a real read on their security posture without hiring a consultant to get one.</p>

        <h3 class="section-h" id="ws-how">How an assessment works</h3>
        <p class="body-text">Three ways in, depending on what you need: a <b>~2-minute Quick assessment</b> covering the core NIST CSF scoring, a <b>~5-minute Full assessment</b> adding vendor-specific guidance for your exact products, or an <b>instant Sample Report</b> if you just want to see the depth before committing any time at all - start there.</p>
        <p class="body-text">Whichever you choose, your in-progress answers save automatically to your browser as you go, so closing the tab doesn't cost you anything. Once it's complete, export the whole thing as a real, selectable-text PDF - not a screenshot.</p>

        <h3 class="section-h" id="ws-reasoning">What makes the reasoning genuinely good</h3>
        <p class="body-text">This is the part that separates SimplifiedCS from a generic checklist, and it's worth being specific about:</p>
        <ul>
          <li><b>Compounding-risk detection</b> - answers get cross-referenced against each other, not scored in isolation. Two individually-minor gaps that combine into something genuinely dangerous get flagged as exactly that.</li>
          <li><b>Real MITRE ATT&amp;CK mapping</b> - findings name the attack technique they enable wherever one genuinely applies; governance gaps don't get an invented one.</li>
          <li><b>An AI Readiness &amp; Governance track</b> - scored questions following EC-Council's Adopt/Defend/Govern framework, scoped to how AI actually shows up in your environment, with real MITRE ATT&amp;CK/ATLAS mapping for AI-specific techniques like prompt injection.</li>
          <li><b>A hybrid AI architecture, done deliberately</b> - the core scoring and findings are produced by a tested, deterministic rules engine, so the same answers always produce the same report. On top of that, an optional <b>retrieval-augmented (RAG)</b> enrichment layer checks your specifically named vendors and products against live CISA and NVD threat intelligence - catching what a fixed rule set can't know by nature, clearly labeled wherever it appears, never replacing the deterministic core underneath it.</li>
          <li><b>Vendor-aware where it can be</b> - for products it recognises, notes are tailored to what you named rather than one-size-fits-all advice.</li>
        </ul>

        <h3 class="section-h" id="ws-frameworks">Every framework and standard it's built on</h3>
        <p class="body-text">The fixed baseline is NIST CSF 2.0 (all six functions) and CIS Controls v8, applied to everyone. Layered in based on your industry and region: ISO 27001, NIS2, SOC 2, HIPAA, GDPR, SOX, Cyber Essentials, and PCI DSS - with more frameworks planned as the tool grows. Dedicated tracks exist for Operational Technology/ICS and DevSecOps/cloud-native environments, shown only when actually relevant. See <a href="${pathForTab('methodology')}" class="inline-link ws-link" data-tab="methodology">Methodology</a> for exactly how scoring works, and <a href="${pathForTab('metrics')}" class="inline-link ws-link" data-tab="metrics">Metrics</a> for what every number on your results page actually means.</p>

        <h3 class="section-h" id="ws-rest">The rest of the site</h3>
        <p class="body-text">Everything else here, in one place:</p>
        <ul>
          <li><b><a href="${pathForTab('maturity')}" class="inline-link ws-link" data-tab="maturity">Maturity Model</a></b> - the ten-phase path a security program actually follows, and where a given score falls on it.</li>
          <li><b><a href="${pathForTab('exploits')}" class="inline-link ws-link" data-tab="exploits">Exploits</a></b> - actively-exploited vulnerabilities from CISA KEV, VulnCheck, and ENISA, scored by real-world exploitation likelihood.</li>
          <li><b><a href="${pathForTab('news')}" class="inline-link ws-link" data-tab="news">Trends &amp; News</a></b> - a daily-refreshed threat-landscape feed, not a static snapshot.</li>
          <li><b><a href="${pathForTab('runbook')}" class="inline-link ws-link" data-tab="runbook">Runbooks</a></b> and <b><a href="${pathForTab('playbooks')}" class="inline-link ws-link" data-tab="playbooks">Playbooks</a></b> - step-by-step incident response guidance and attack-pattern-specific response plans, mapped to MITRE ATT&amp;CK/ATLAS.</li>
          <li><b><a href="${pathForTab('casestudy')}" class="inline-link ws-link" data-tab="casestudy">Case Studies</a></b> - real incidents, each tied back to the specific gap this tool is built to catch.</li>
          <li><b><a href="${pathForTab('coreprinciples')}" class="inline-link ws-link" data-tab="coreprinciples">Core Principles</a></b> - the philosophy behind how every recommendation gets prioritized and explained.</li>
          <li><b><a href="${pathForTab('starterguide')}" class="inline-link ws-link" data-tab="starterguide">Starter Guide</a></b> - brand new to cybersecurity? Start here, not with the assessment.</li>
          <li><b><a href="${pathForTab('threatmodeling')}" class="inline-link ws-link" data-tab="threatmodeling">Threat Modeling &amp; Forensics</a></b> - how to think ahead of an attacker, and how to reconstruct what happened after one.</li>
          <li><b><a href="${pathForTab('glossary')}" class="inline-link ws-link" data-tab="glossary">Glossary</a></b> and <b><a href="${pathForTab('references')}" class="inline-link ws-link" data-tab="references">References</a></b> - term lookups and sourcing, whenever needed.</li>
        </ul>
        <p class="body-text">Take a look around. Most of what's here started as a real gap someone found in a real assessment - it keeps growing for exactly that reason.</p>
        <div class="cta-row">
          <a class="cta-btn" href="${pathForTab('assessment')}" id="ctaMMAssess">Start an assessment →</a>
        </div>
      </div>
    </div>
  `;
  wireNavLink(document.getElementById('ctaMMAssess'), 'assessment');
  wireNavLinksByDataset(container, '.ws-link');
}
