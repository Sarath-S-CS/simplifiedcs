// About page (/about).
import { wireNavLinksByDataset } from "../router.js";

// Feedback and Privacy pages: ./ui/privacy.js.

export function renderAboutTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">About</div>
        <h2 class="page-title">About this project</h2>
        <div class="about-narrative">
          <p class="page-lede">Hey there - my name is Sarath, creator of SimplifiedCS. I built this site with one goal: making cybersecurity accessible to everyone.</p>
          <p class="page-lede">With over 9 years of experience in cybersecurity and IT, I've seen the hurdles most companies actually run into firsthand, and wanted to design a simpler workflow for getting past them. This isn't meant to be a last-resort or final solution for every cyber need you have - the goal is to minimize risk as much as realistically possible, using existing tools and minimal cost, not to replace a real security program entirely.</p>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">A few technical highlights</h3>
        <div class="about-narrative">
          <ul class="tech-highlights-list">
            <li>An <b>adaptive decision-graph engine</b>, not a static form - questions branch on industry, region, infrastructure, and prior answers, with a session-wide <b>de-duplication system</b> so the same fact isn't asked for twice</li>
            <li><b>Compounding-risk detection</b> that flags dangerous <i>combinations</i> of gaps, not just individual weak answers - each one mapped to a real <b>MITRE ATT&amp;CK technique</b>, not a generic warning</li>
            <li>A deliberate <b>hybrid AI architecture</b>: a tested, deterministic scoring engine at the core (same answers, same report), with an optional live layer checking named vendors against current threat data on top of it</li>
            <li><b>Live threat intelligence</b> pulled from CISA's KEV catalog, VulnCheck, ENISA, and NVD, scored by real-world exploitation likelihood via FIRST.org's <b>EPSS</b> model</li>
            <li>An <b>AI Readiness &amp; Governance</b> question track following EC-Council's Adopt/Defend/Govern framework - scoped to how AI actually shows up in your environment, scored by the same engine, with real MITRE ATT&amp;CK/ATLAS mapping for AI-specific techniques like prompt injection</li>
            <li>A programmatically-built, <b>selectable-text PDF export</b>, and a real <b>client-side router</b> with working back/forward navigation and shareable URLs - not the "everything is one page pretending to be many" shortcut it's easy to settle for</li>
          </ul>
          <p class="body-text">What an external review found in September 2026, what changed, and how each change was checked: <a href="/engineering" class="inline-link" data-tab="engineering">engineering case study</a>.</p>
        </div>
      </div>

      <div class="section-tile">
        <div class="about-narrative">
          <p class="page-lede">This is a work in progress, and feedback is genuinely welcome - if you think a feature is missing or something could work better, I'd like to hear about it.</p>
          <p class="page-lede">This project is an <b>adaptive</b> cybersecurity assessment and compliance-readiness platform designed for small and medium-sized businesses. It helps organizations understand their current security posture, identify weaknesses, and receive practical recommendations to strengthen their cybersecurity defenses.</p>
          <p class="page-lede">The platform is based primarily on the NIST Cybersecurity Framework and CIS Critical Security Controls v8. It guides organizations through structured assessments, highlights security gaps, and provides actionable suggestions to improve their overall resilience.</p>
          <p class="page-lede">In addition to security assessments, the platform supports compliance-readiness initiatives across <b>eight frameworks</b> - ISO/IEC 27001, NIS2, SOC 2, HIPAA, GDPR, SOX, Cyber Essentials, and PCI DSS - layered in based on your industry and the regions you operate in, with more frameworks planned as the tool grows. Its long-term goal is to provide businesses with a centralized solution for continuously monitoring, improving, and demonstrating their security and compliance posture.</p>
          <p class="page-lede">Most recently, the platform added a <b>hybrid AI layer</b> to the results. Every report is still built first by the same tested, deterministic scoring engine the assessment has run on from the start - that part doesn't change, and it's already complete and accurate on its own. On top of it, an optional live pass checks your named vendors and products against current CISA and NVD vulnerability data, and looks for patterns in your specific answers the fixed rule set wasn't built to anticipate. It's clearly labeled wherever it appears, and it's additive, not a replacement. The assessment itself grew alongside that: a dedicated <b>AI Readiness &amp; Governance</b> track now scores how AI actually shows up in your own environment and how prepared you are against AI-powered attacks, whether or not you've adopted AI yourself - so this site both uses AI carefully in how it builds your report, and assesses how carefully <i>you're</i> using (or defending against) AI in the first place.</p>
        </div>
      </div>

      <div class="section-tile">
        <h3 class="section-h">The idea behind the mark</h3>
        <div class="about-narrative">
          <p class="body-text">Fragments, scattered and disconnected, converging into a single, complete shield. That's meant to mirror what this tool actually does - individually small, disconnected gaps (a missing control here, an unpatched system there) assembling into your real security posture once they're identified and addressed together.</p>
        </div>
        <div class="logo-assembly-wrap" id="logoAssemblyWrap"></div>
      </div>
    </div>
  `;
  wireNavLinksByDataset(container, 'a.inline-link[data-tab]');
  renderLogoAssembly();
}

function renderLogoAssembly(){
  const wrap = document.getElementById('logoAssemblyWrap');
  if(!wrap) return;
  const logoSrc = document.querySelector('.brand-logo')?.src || '';
  // Fixed set of fragment offsets/timings for a consistent, repeatable assembly animation
  const fragments = [
    {x:-180,y:-90,size:14,delay:0.0},{x:-210,y:-30,size:10,delay:0.35},{x:-170,y:40,size:16,delay:0.7},
    {x:-140,y:-120,size:8,delay:1.05},{x:-230,y:70,size:12,delay:0.23},{x:-100,y:100,size:9,delay:1.17},
    {x:-190,y:110,size:11,delay:0.58},{x:-240,y:-60,size:13,delay:0.82},{x:-120,y:-70,size:10,delay:1.28},
    {x:-160,y:-160,size:9,delay:0.47},{x:-250,y:10,size:15,delay:0.93},{x:-90,y:-140,size:8,delay:1.4},
  ];
  wrap.innerHTML = `
    <div class="logo-assembly-stage">
      ${fragments.map(f=>`<div class="assembly-fragment" style="--fx:${f.x}px; --fy:${f.y}px; --fdelay:${f.delay}s; width:${f.size}px; height:${f.size}px;"></div>`).join('')}
      <img src="${logoSrc}" alt="SimplifiedCS logo" class="assembly-logo">
    </div>
  `;
}
