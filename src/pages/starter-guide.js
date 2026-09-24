// Starter Guide page (/starter-guide).
import { wireAccordions } from "../ui/a11y.js";
import { pathForTab, wireNavLinksByDataset } from "../router.js";
import { icon, accentIconStyle } from "./shared.js";

// STARTER-GUIDE-BRIEF.md: a narrative, in-order on-ramp for someone starting
// from zero - deliberately not the Glossary (alphabetical lookup). Content
// is finished/research-grounded per the brief; this only builds the page
// and cross-links it doesn't rewrite the substance. Sections 1-8 render as
// collapsible accordions (matching Runbooks/Playbooks' .acc-card pattern,
// all-collapsed by default - the established default elsewhere on the
// site); section 9 (Further Reading) is deliberately NOT an accordion,
// styled instead as always-visible .start-link cards like Home's "Things
// to get you started", per the brief's own "End of page" framing.
const STARTER_GUIDE_SECTIONS = [
  { id:'sg-audience', icon:'route', title:'Who this page is for', body:`
    <p class="body-text">New to cybersecurity? Just took on IT for a company that never had a dedicated setup before? This page is the on-ramp - the foundational concepts worth understanding before you touch the actual assessment, written in plain language, in an order that actually makes sense to read top to bottom. If you already know this material, the <a href="${pathForTab('assessment')}" class="inline-link sg-crosslink" data-tab="assessment">assessment</a> itself and the <a href="${pathForTab('glossary')}" class="inline-link sg-crosslink" data-tab="glossary">Glossary</a> will serve you better than this page will.</p>
  `},
  { id:'sg-identity', icon:'key', title:'Identity & Access', body:`
    <p class="body-text">Access control decides who can do what - and it's the foundation everything else sits on, because a strong password policy doesn't matter if the wrong person already has admin rights they never needed.</p>
    <p class="body-text"><b>The principle of least privilege</b> means giving people access to exactly what their role requires, nothing more. An access control list (ACL) is the practical mechanism for this - a defined set of permissions attached to a system, file, or resource, specifying exactly who can read, write, or execute it. See the <a href="${pathForTab('glossary', 'gl-L')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-L">Glossary</a> for more on least privilege specifically.</p>
    <p class="body-text"><b>Password policy</b> is more than "make it long." A genuinely useful policy covers minimum length (current guidance favors length over complex character requirements), discouraging reuse across systems, and - critically - requiring multi-factor authentication (<a href="${pathForTab('glossary', 'gl-M')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-M">MFA</a>) wherever it's available, since a strong password alone is no longer considered sufficient on its own.</p>
    <p class="body-text"><b>Passkeys</b> are a newer, stronger alternative to passwords entirely. Instead of a shared secret you type in (which can be phished, guessed, or leaked in a breach), a passkey uses public-key cryptography tied to your device - you approve a login with your fingerprint, face, or device PIN, and there's no password for an attacker to steal in the first place. They're built on the FIDO Alliance's open standard and are increasingly supported across major platforms (Microsoft, Google, Apple accounts all support them today).</p>
    <p class="body-text"><b>Identity management</b> is how an organization handles all of this at scale - who has an account, what they can access, and how that access changes as people join, move roles, or leave. Larger organizations typically centralize this through an identity provider (IdP) with single sign-on (SSO), so access can be granted or revoked from one place rather than chasing down permissions system by system.</p>
  `},
  { id:'sg-devices', icon:'device', title:'Devices & Data', body:`
    <p class="body-text"><b>Device management</b> covers every laptop, phone, and workstation that touches company data. The key question: is a device company-owned and centrally managed, or is it an employee's personal device being used for work (BYOD - "bring your own device")? Company-owned devices are far easier to secure consistently; BYOD introduces real tradeoffs between employee flexibility and the organization's ability to enforce security settings. Mobile Device Management (MDM) tools exist specifically to apply consistent security policy - screen locks, encryption, remote wipe - across a fleet of devices regardless of who owns them.</p>
    <p class="body-text"><b>Data classification</b> means knowing what kind of data you actually have before you can protect it properly. Not all data carries the same risk - personally identifiable information (PII), financial records, and health data typically demand stronger protection than, say, public marketing material. Classifying data (even informally, as "sensitive" vs. "general") is what makes the rest of your security decisions possible to prioritize correctly.</p>
    <p class="body-text"><b>Encryption</b> protects data in two different states, and both matter: encryption <i>at rest</i> protects data sitting on a disk or in a database; encryption <i>in transit</i> protects data as it moves across a network. A system can have one without the other, and both gaps are real.</p>
  `},
  { id:'sg-infrastructure', icon:'cloud', title:'Infrastructure & Services', body:`
    <p class="body-text">Where does your organization's technology actually live? <b>Cloud vs. on-premises</b> is the first fork - and most organizations today run a mix of both, not a clean either/or.</p>
    <p class="body-text">Within cloud services, it helps to know the three common models: <b>SaaS</b> (Software as a Service - you use a finished application, like email or CRM, and the provider manages everything underneath it), <b>PaaS</b> (Platform as a Service - you deploy your own code onto infrastructure the provider manages), and <b>IaaS</b> (Infrastructure as a Service - you manage the operating system and everything above it, on infrastructure the provider hosts). Each model shifts a different amount of security responsibility onto you versus the provider - worth knowing which model you're actually using for a given system.</p>
    <p class="body-text"><b>Basic network concepts</b> worth understanding early: a firewall controls what traffic is allowed in or out of a network based on rules; a VPN (virtual private network) creates an encrypted tunnel for remote access; network <a href="${pathForTab('glossary', 'gl-S')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-S">segmentation</a> means dividing a network into smaller, isolated zones so that a compromise in one area doesn't automatically grant access to everything else.</p>
  `},
  { id:'sg-protecting', icon:'backup', title:'Protecting What You Have', body:`
    <p class="body-text"><b>Backups</b> are the single most consistently under-tested control in most organizations. The well-established guideline is the <b>3-2-1 rule</b>: keep at least 3 copies of your data, on 2 different types of storage media, with at least 1 copy stored offsite. Critically - a backup that has never been tested for restoration isn't a real backup, it's an assumption. Ransomware specifically targets backups when it can reach them, which is exactly why the offsite/isolated copy matters most.</p>
    <p class="body-text"><b>Patching</b> means applying vendor-released updates that fix known vulnerabilities. The gap between a patch being released and it actually being applied is exactly the window attackers look for - this is why frameworks like NIST CSF and tools like CISA's <a href="${pathForTab('exploits')}" class="inline-link sg-crosslink" data-tab="exploits">Known Exploited Vulnerabilities catalog</a> exist to help prioritize which patches matter most urgently, not just track that patches exist.</p>
    <p class="body-text"><b>Endpoint protection</b> (antivirus, and its more capable modern successor, <a href="${pathForTab('glossary', 'gl-E')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-E">EDR</a> - endpoint detection and response) is the layer watching individual devices for malicious activity, not just blocking known-bad files but detecting suspicious behavior in real time.</p>
  `},
  { id:'sg-people', icon:'people', title:'People Matter Too', body:`
    <p class="body-text">Technology alone doesn't secure an organization - the people using it are part of the system, for better or worse.</p>
    <p class="body-text"><b>Security awareness training</b> teaches staff to recognize real threats (<a href="${pathForTab('glossary', 'gl-P')}" class="inline-link sg-crosslink" data-tab="glossary" data-anchor="gl-P">phishing</a> emails, social engineering attempts, unsafe practices) - but training without reinforcement fades. That's why <b>phishing simulation</b> exists: periodically sending realistic, safe test phishing emails to see who clicks, then using that as a coaching opportunity rather than a punishment.</p>
    <p class="body-text"><b>Incident response</b>, at a foundational level, just means having a plan <i>before</i> something goes wrong - who gets notified, who has authority to make decisions, and what the first steps are. This page won't go deep here; the site's <a href="${pathForTab('runbook')}" class="inline-link sg-crosslink" data-tab="runbook">Runbooks</a> are built specifically for that level of detail once you need it.</p>
  `},
  { id:'sg-tools', icon:'checklist', title:'Tools That Help', body:`
    <p class="body-text">None of the above requires expensive tooling to start doing well, but the right category of tool makes consistency much easier at any real scale. Presented here at a category level, not as endorsements of specific products:</p>
    <ul>
      <li><b>Password managers</b> - generate and store strong, unique passwords per site/system, removing the human tendency to reuse passwords across services.</li>
      <li><b>MDM platforms</b> - apply and enforce device security policy across a fleet, rather than trusting each device to be configured correctly by hand.</li>
      <li><b>Identity/IAM platforms</b> - centralize who has access to what, with single sign-on and centralized deprovisioning when someone leaves.</li>
      <li><b>Backup solutions</b> - automate the 3-2-1 pattern rather than relying on someone remembering to do it manually.</li>
    </ul>
  `},
  { id:'sg-nextsteps', icon:'link', title:'Where to go from here', links:[
    { title:'Take the assessment', desc:'See where your organization actually stands against these fundamentals, scored and prioritized.', tab:'assessment', icon:'checklist' },
    { title:'Glossary', desc:'Look up any term from this page (or anywhere else on the site) in plain language.', tab:'glossary', icon:'register' },
    { title:'Core Principles', desc:'The philosophy behind why this site\'s recommendations are structured the way they are.', tab:'coreprinciples', icon:'hiw-lightbulb' },
    { title:'Methodology', desc:'How scoring actually works, and which frameworks ground every question.', tab:'methodology', icon:'route' },
    { title:'Runbooks', desc:'Step-by-step incident response guidance, once you need more depth than this page covers.', tab:'runbook', icon:'document' },
  ]},
];

// Verified against each source directly (not guessed) per the brief's own
// implementation note - see STARTER-GUIDE-BRIEF.md §9.
const STARTER_GUIDE_FURTHER_READING = [
  { title:'Microsoft Learn - Microsoft 365 security best practices', desc:'Practical, vendor-maintained guidance for organizations on Microsoft\'s ecosystem specifically.', href:'https://learn.microsoft.com/en-us/microsoft-365/admin/security-and-compliance/m365b-security-best-practices?view=o365-worldwide' },
  { title:'CISA - Cyber Guidance for Small Businesses', desc:'The U.S. government\'s own small-business-focused starting point, including the Cyber Essentials starter kit.', href:'https://www.cisa.gov/cyber-guidance-small-businesses' },
  { title:'NIST - Small Business Cybersecurity Corner', desc:'Genuinely well-matched, since this site\'s own assessment is built on NIST CSF already - includes the CSF 2.0 Small Business Quick-Start Guide.', href:'https://www.nist.gov/itl/smallbusinesscyber' },
  { title:'FIDO Alliance - Passkeys', desc:'The actual industry standards body for passkeys, the right source for that concept specifically.', href:'https://fidoalliance.org/passkeys/' },
];

export function renderStarterGuideTab(container){
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">On-Ramp</div>
        <h2 class="page-title">Starter Guide</h2>
        <p class="page-lede">A guided, in-order read for anyone starting from zero - new to cybersecurity, or standing up IT/security for a new company for the first time. Explains why each thing matters and how the pieces connect, before you touch the actual assessment.</p>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Contents</h3>
        <ul class="toc-list">
          ${STARTER_GUIDE_SECTIONS.map(s=>`<li><a href="#${s.id}" class="sg-toc-link" data-target="${s.id}">${s.title}</a></li>`).join('')}
          <li><a href="#sg-further-reading">Further reading</a></li>
        </ul>
      </div>

      <div class="section-tile">
        <div id="sgAccordions"></div>
      </div>

      <div class="section-tile" id="sg-further-reading">
        <h3 class="section-h">Further reading</h3>
        <p class="body-text">Real, current sources beyond this site's own content - each verified directly before being listed here.</p>
        <div class="start-links">
          ${STARTER_GUIDE_FURTHER_READING.map(r=>`
            <a class="start-link" href="${r.href}" target="_blank" rel="noopener noreferrer">
              <div class="icon-badge">${icon('external')}</div>
              <div><h4>${r.title}</h4><p>${r.desc}</p></div>
              <span class="ext-mark">↗</span>
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const accContainer = document.getElementById('sgAccordions');
  accContainer.innerHTML = STARTER_GUIDE_SECTIONS.map((s,i)=>`
    <div class="acc-card" data-id="${s.id}">
      <div class="acc-head" id="${s.id}">
        <div class="icon-badge" ${accentIconStyle(i)}>${icon(s.icon)}</div>
        <div><h4>${s.title}</h4></div>
        <div class="acc-chevron">▸</div>
      </div>
      <div class="acc-body">
        ${s.links ? `
          <div class="start-links">
            ${s.links.map(l=>`
              <a class="start-link" href="${pathForTab(l.tab)}" data-tab="${l.tab}">
                <div class="icon-badge">${icon(l.icon)}</div>
                <div><h4>${l.title}</h4><p>${l.desc}</p></div>
              </a>
            `).join('')}
          </div>
        ` : s.body}
      </div>
    </div>
  `).join('');
  wireAccordions(accContainer);

  wireNavLinksByDataset(accContainer, '.start-link[data-tab]');
  wireNavLinksByDataset(accContainer, '.sg-crosslink');

  // Jumping to a specific section from the TOC while every accordion
  // starts collapsed would land on an empty header - open the target
  // accordion (if it isn't already) before letting the native #anchor
  // scroll happen.
  container.querySelectorAll('.sg-toc-link').forEach(link=>{
    link.addEventListener('click', (e)=>{
      const card = document.querySelector(`.acc-card[data-id="${link.dataset.target}"]`);
      if(card && !card.classList.contains('open')){
        e.preventDefault();
        card.classList.add('open');
        requestAnimationFrame(()=> card.scrollIntoView({ behavior:'smooth', block:'start' }));
      }
    });
  });
}
