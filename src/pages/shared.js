// Helpers used by more than one page (and by the shell): the inline icon
// set, stage metadata and illustrations, framework stamps, the shared SVG
// diagrams, icon accent colours, and the scroll-reveal observer.

// --- Original inline icon set (no external images - avoids stock-photo look and any licensing question) ---
export function icon(name){
  const common = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    shield: `<svg ${common}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 8v4"/><circle cx="12" cy="15" r="0.6" fill="currentColor"/></svg>`,
    backup: `<svg ${common}><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/><path d="M18.5 9.5a3 3 0 1 1-1-2.3" transform="translate(0,-1)"/></svg>`,
    document: `<svg ${common}><path d="M7 2.5h7l3.5 3.5V21H7z"/><path d="M14 2.5V6h3.5"/><path d="M9.3 12h5.4M9.3 15h5.4M9.3 18h3.4"/></svg>`,
    register: `<svg ${common}><rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M3.5 9h17M3.5 14h17M9 4v16"/></svg>`,
    ransomware: `<svg ${common}><rect x="6" y="10.5" width="12" height="9" rx="1.2"/><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5"/><path d="M12 14v2.4"/><path d="M4 4l16 16" opacity="0.55"/></svg>`,
    phishing: `<svg ${common}><rect x="3.2" y="6" width="17.6" height="12.5" rx="1.2"/><path d="M3.2 7l8.8 6 8.8-6"/><path d="M15.5 15.5c2-1.6 2-4 .3-5.3" opacity="0.7"/></svg>`,
    ddos: `<svg ${common}><rect x="8.5" y="9" width="7" height="7" rx="1"/><path d="M12 9V4M12 20v-5M5 12H2M22 12h-3M6.5 6.5 4.5 4.5M17.5 6.5l2-2M6.5 17.5l-2 2M17.5 17.5l2 2"/></svg>`,
    lateral: `<svg ${common}><circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M6.8 7.6 10.3 16.2M17.2 7.6 13.7 16.2" stroke-dasharray="3 2.5"/></svg>`,
    cycle: `<svg ${common}><path d="M4 12a8 8 0 0 1 14-5.2M20 12a8 8 0 0 1-14 5.2"/><path d="M18.5 4v3.2H15.3M5.5 20v-3.2H8.7"/></svg>`,
    key: `<svg ${common}><circle cx="8" cy="8.5" r="4"/><path d="M11 11.5l9 9M15.5 16l2.5-2.5M18 18.5l2.5-2.5"/></svg>`,
    link: `<svg ${common}><circle cx="9.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/></svg>`,
    people: `<svg ${common}><circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-3.3 2.5-5.5 5.5-5.5S14 15.7 14 19"/><circle cx="16.5" cy="9" r="2.4"/><path d="M14.8 19c0-2.6 1.8-4.4 3.9-4.4"/></svg>`,
    cloud: `<svg ${common}><path d="M7 17a4 4 0 0 1 .3-8 5.5 5.5 0 0 1 10.6 1.8A3.5 3.5 0 0 1 17 17z"/><path d="M12 20v-3M10 19l2-2 2 2" opacity="0.75"/></svg>`,
    exfil: `<svg ${common}><path d="M7 2.5h7l3.5 3.5V21H7z"/><path d="M14 2.5V6h3.5"/><path d="M9.5 15l4.5-4.5M10 10.5h4.5V15" opacity="0.85"/></svg>`,
    urgent: `<svg ${common}><path d="M12 3l9 15.5H3z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor"/></svg>`,
    route: `<svg ${common}><path d="M5 21V3"/><path d="M5 4.5c3-2 5 2 8 0s5 2 8 0v9c-3 2-5-2-8 0s-5-2-8 0"/></svg>`,
    signal: `<svg ${common}><path d="M12 19.3v.01"/><path d="M8.2 15.8a5.2 5.2 0 0 1 7.6 0"/><path d="M5 12.3a9.2 9.2 0 0 1 14 0"/></svg>`,
    analysis: `<svg ${common}><path d="M4 20V10M9 20V4M14 20v-9M19 20V13"/><path d="M4 9.5l5-4 5 4.5 5-6.5" opacity="0.55"/></svg>`,
    checklist: `<svg ${common}><rect x="6" y="4" width="12" height="17" rx="1.4"/><rect x="9" y="2.3" width="6" height="3" rx="1"/><path d="M9 12l1.8 1.8L15 10" /></svg>`,
    ranked: `<svg ${common}><path d="M4 6h16M4 12h11M4 18h6"/></svg>`,
    clock: `<svg ${common}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2.3h6M12 2.3V5"/></svg>`,
    sun: `<svg ${common}><circle cx="12" cy="12" r="4.3"/><path d="M12 3v2.3M12 18.7V21M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M3 12h2.3M18.7 12H21M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`,
    moon: `<svg ${common}><path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2z"/></svg>`,
    external: `<svg ${common}><path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/><path d="M14 4h6v6"/><path d="M20 4 11 13"/></svg>`,
    arrowright: `<svg ${common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    'hiw-clipboard': `<svg ${common}><rect x="6" y="4" width="12" height="17" rx="1.5"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M8.5 11l2 2 4-4.5"/><path d="M8.5 16.5h5.5"/></svg>`,
    'hiw-magnify': `<svg ${common}><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/><path d="M7.5 10.5h6M10.5 7.5v6"/></svg>`,
    'hiw-lightbulb': `<svg ${common}><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.7v.5h6v-.5c0-.7.3-1.3.8-1.7A6.5 6.5 0 0 0 12 3z"/></svg>`,
    'hiw-transform': `<svg ${common}><path d="M4 14a8 8 0 0 1 14-5.2"/><path d="M17 4v3.2h-3.2"/><path d="M20 10a8 8 0 0 1-14 5.2"/><path d="M7 20v-3.2h3.2"/></svg>`,
    card: `<svg ${common}><rect x="2.5" y="5.5" width="19" height="13" rx="1.6"/><path d="M2.5 9.5h19"/><path d="M6 14.5h4"/></svg>`,
    device: `<svg ${common}><rect x="3" y="4.5" width="18" height="12" rx="1.3"/><path d="M8 20h8M12 16.5V20"/></svg>`,
    home: `<svg ${common}><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-6h4v6"/></svg>`,
    menu: `<svg ${common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>`,
    close: `<svg ${common}><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  };
  return icons[name] || '';
}

export const STAGE_META = {
  discovery: { label:'Discovery', range:'Phases 1–4', color:'var(--accent-signal)', ink:'var(--accent-signal-ink)',
    blurb:'You don\'t have a security program yet so much as a starting point - the goal is visibility: what exists, where it\'s exposed, and who owns fixing it.' },
  transformation: { label:'Transformation', range:'Phases 5–7', color:'var(--accent-secure)', ink:'var(--accent-secure-ink)',
    blurb:'Findings become controls, and controls become documented, rehearsed processes - this is where most of the actual engineering and writing happens.' },
  optimization: { label:'Optimization', range:'Phases 8–10', color:'var(--accent-violet)', ink:'var(--accent-violet-ink)',
    blurb:'The program runs continuously - monitored, tested, and adjusted as the environment and threat landscape change, rather than declared "done."' },
};

export function observeReveals(){
  const els = document.querySelectorAll('.section-tile, .page-intro');
  if(!('IntersectionObserver' in window)){
    els.forEach(el=>el.classList.add('revealed'));
    return;
  }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold:0, rootMargin:'0px 0px -40px 0px' });
  // threshold must stay 0 (any visible pixel), not a ratio like 0.06 - a
  // ratio is measured against the target's OWN height, and a tile that
  // grows past ~15-16k px (e.g. the live News grid with 75 cards) can
  // never show 6% of itself in one viewport, so it would silently never
  // reveal. This bit the News tab directly once the live feed grew past a
  // handful of items.
  els.forEach(el=> io.observe(el));
}

export function stageIllustration(stageId){
  const svgs = {
    discovery: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs><radialGradient id="gDisc" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stop-color="var(--accent-signal)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-signal)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gDisc)"/>
        <circle cx="30" cy="26" r="3" fill="var(--accent-signal)" opacity="0.6"/>
        <circle cx="72" cy="30" r="2.4" fill="var(--accent-signal)" opacity="0.5"/>
        <circle cx="68" cy="70" r="3" fill="var(--accent-signal)" opacity="0.6"/>
        <circle cx="24" cy="66" r="2" fill="var(--accent-signal)" opacity="0.5"/>
        <circle cx="43" cy="43" r="17" fill="none" stroke="var(--accent-signal)" stroke-width="4.5"/>
        <line x1="55" y1="55" x2="74" y2="74" stroke="var(--accent-signal)" stroke-width="5.5" stroke-linecap="round"/>
      </svg>`,
    transformation: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs>
          <radialGradient id="gTrans" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="var(--accent-secure)" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="var(--accent-secure)" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="gTransFlow" x1="30" y1="50" x2="62" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="var(--accent-amber)"/>
            <stop offset="100%" stop-color="var(--accent-secure)"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="url(#gTrans)"/>
        <!-- scattered, disconnected findings on the left... -->
        <circle cx="26" cy="38" r="3.5" fill="var(--accent-amber)" opacity="0.85"/>
        <circle cx="23" cy="53" r="3" fill="var(--accent-critical)" opacity="0.75"/>
        <circle cx="29" cy="66" r="3" fill="var(--accent-pop)" opacity="0.8"/>
        <!-- ...flowing through the transformation... -->
        <path d="M33 52 Q45 44 58 50" fill="none" stroke="url(#gTransFlow)" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M52 44l8 6-8 6" fill="none" stroke="var(--accent-secure)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <!-- ...into one verified, engineered control on the right -->
        <path d="M68 37l11 6.5v13l-11 6.5-11-6.5v-13z" fill="var(--accent-secure)"/>
        <path d="M62 50l4.5 4.5 9-9" fill="none" stroke="var(--text-on-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    optimization: `
      <svg viewBox="0 0 100 100" width="72" height="72">
        <defs><radialGradient id="gOpt" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="var(--accent-violet)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--accent-violet)" stop-opacity="0"/>
        </radialGradient></defs>
        <circle cx="50" cy="50" r="46" fill="url(#gOpt)"/>
        <rect x="24" y="55" width="10" height="21" fill="var(--accent-violet)" opacity="0.55"/>
        <rect x="45" y="40" width="10" height="36" fill="var(--accent-violet)" opacity="0.78"/>
        <rect x="66" y="24" width="10" height="52" fill="var(--accent-violet)"/>
        <path d="M22 50l16-14 12 8 24-22" fill="none" stroke="var(--accent-violet)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
  };
  return svgs[stageId] || '';
}

// Original, text/icon-based "stamps" referencing the frameworks/principles
// this site draws on - deliberately not a reproduction of any organization's
// actual logo or mark, per VISUAL-UPDATE-BRIEF.md item 11's trademark note.
const FRAMEWORK_STAMPS = [
  { label:'Defense in Depth', icon:'shield', color:'--accent-signal' },
  { label:'ISO 27001', icon:'register', color:'--accent-secure' },
  { label:'SOC 2', icon:'checklist', color:'--accent-violet' },
  { label:'Cyber Essentials', icon:'key', color:'--accent-amber' },
  { label:'PCI DSS', icon:'card', color:'--accent-critical' },
];
export function buildFrameworkStamps(){
  return `
  <div class="stamp-row">
    ${FRAMEWORK_STAMPS.map(s=>`
      <div class="stamp" style="--stamp-color:var(${s.color});--stamp-ink:var(${s.color}-ink)" title="${s.label}">
        <div class="stamp-ring"></div>
        <span class="stamp-icon">${icon(s.icon)}</span>
        <span class="stamp-label">${s.label}</span>
      </div>
    `).join('')}
  </div>`;
}

// UX-VISUAL-CREDIBILITY-BRIEF.md §4: SVG-native SMIL animation
// (<animateMotion>) isn't CSS, so no @media (prefers-reduced-motion) rule
// can gate it - the two moving-dot diagrams below (Runbooks' lifecycle
// loop, Playbooks' flow) need this JS-level check instead, unlike every
// other animation on the site which is plain CSS and already covered by
// app.css's own reduced-motion blocks.
export function prefersReducedMotion(){
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function buildLifecycleSvg(){
  const stages = ['Draft','Review','Approve','Publish','Periodic Review'];
  const cx=200, cy=170, r=110;
  const pts = stages.map((s,i)=>{
    const a = (i/stages.length)*2*Math.PI - Math.PI/2;
    return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a), label:s };
  });
  const pathD = `M ${cx+r},${cy} A ${r},${r} 0 1,1 ${cx-r+0.01},${cy} A ${r},${r} 0 1,1 ${cx+r},${cy}`;
  // Static dot sits exactly on the path's own starting point (cx+r, cy)
  // when motion is reduced - a deliberate resting position, not a
  // truncated animation.
  const dot = prefersReducedMotion()
    ? `<circle cx="${(cx+r).toFixed(1)}" cy="${cy}" r="6" fill="var(--accent-signal)"/>`
    : `<circle r="6" fill="var(--accent-signal)"><animateMotion dur="9s" repeatCount="indefinite"><mpath href="#lifecyclePath"/></animateMotion></circle>`;
  return `
  <svg viewBox="-30 0 400 340" xmlns="http://www.w3.org/2000/svg">
    <path id="lifecyclePath" d="${pathD}" fill="none" stroke="var(--line)" stroke-width="1.5"/>
    ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="var(--surface)" stroke="var(--accent-secure)" stroke-width="1.6"/>`).join('')}
    ${pts.map(p=>{
      const labelY = p.y + (p.y > cy ? 22 : (p.y < cy - 5 ? -14 : 5));
      const anchor = p.x > cx+30 ? 'start' : p.x < cx-30 ? 'end' : 'middle';
      return `<text x="${p.x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" class="lifecycle-node-label">${p.label}</text>`;
    }).join('')}
    ${dot}
    <text x="200" y="175" text-anchor="middle" class="lifecycle-node-label" style="font-size:12px; letter-spacing:0.05em;">continuous, not one-and-done</text>
  </svg>`;
}

// METRICS-ANIMATION-REVISION-BRIEF.md: replaces the first pass (three
// static circles, no motion tying them together - too basic and, per
// direct review, "several disconnected static elements placed near each
// other"). The corrected concept is one connected composition telling
// the actual story of how Metrics works: individual 0/1/2 answers
// (small red/amber/green dots, each following its own short curved
// path via <animateMotion> - same SMIL technique buildLifecycleSvg
// already uses for its moving dot, staggered so they arrive in a
// flowing stream rather than all at once) converging into a radial
// gauge, which fills along a red-amber-green arc (matching the exact
// exposure-band language on this page's own "Reading your score"
// section) as a needle sweeps up and settles, with a percentage readout
// fading in at the same moment. Faint dashed trail lines behind each dot
// are always rendered (not just during motion) so the "many inputs feed
// one gauge" story still reads with reduced motion. SMIL isn't
// controllable via CSS media queries (see prefersReducedMotion()'s own
// comment above buildLifecycleSvg), so the dots are omitted entirely
// when motion is reduced, leaving only the gauge - itself CSS-driven and
// covered by app.css's own reduced-motion block, shown at its settled
// reading rather than hidden. Sits in .page-intro-row next to the page
// title on the standalone Metrics page; on Home it's placed inside the
// Risk Score Matrix section instead, alongside (not replacing) that
// section's existing interactive 1-10 scale.
export function buildScoringRubricSvg(){
  const dots = [
    { x:18, y:18, color:'--accent-critical' },
    { x:44, y:14, color:'--accent-signal' },
    { x:12, y:46, color:'--accent-amber' },
    { x:38, y:52, color:'--accent-signal' },
    { x:16, y:78, color:'--accent-critical' },
    { x:46, y:82, color:'--accent-amber' },
    { x:26, y:100, color:'--accent-signal' },
  ];
  const convergeX = 128, convergeY = 96;
  const n = dots.length;
  const reduced = prefersReducedMotion();
  const paths = dots.map(d=>{
    const midX = (d.x+convergeX)/2, midY = (d.y+convergeY)/2 - 10;
    return `M${d.x},${d.y} Q${midX},${midY} ${convergeX},${convergeY}`;
  });
  return `
  <svg viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="metricsArcGrad" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="var(--accent-critical)"/>
        <stop offset="50%" stop-color="var(--accent-amber)"/>
        <stop offset="100%" stop-color="var(--accent-signal)"/>
      </linearGradient>
    </defs>
    ${paths.map(p=>`<path d="${p}" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>`).join('')}
    ${reduced ? '' : dots.map((d,i)=>{
      const start = (i/n)*0.5;
      const end = start + 0.16;
      return `
        <circle r="3.2" fill="var(${d.color})">
          <animateMotion dur="5s" repeatCount="indefinite" calcMode="linear" path="${paths[i]}" keyPoints="0;0;1;1" keyTimes="0;${start.toFixed(2)};${end.toFixed(2)};1"/>
          <animate attributeName="opacity" dur="5s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;${(end-0.02).toFixed(2)};${end.toFixed(2)};1"/>
        </circle>`;
    }).join('')}
    <path d="M151,92 a34,34 0 0 1 68,0" fill="none" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/>
    <path class="metrics-gauge-arc" d="M151,92 a34,34 0 0 1 68,0" fill="none" stroke="url(#metricsArcGrad)" stroke-width="6" stroke-linecap="round" stroke-dasharray="107" stroke-dashoffset="107"/>
    <line class="metrics-gauge-needle" x1="185" y1="92" x2="185" y2="62" stroke="var(--text)" stroke-width="3" stroke-linecap="round" style="transform-origin:185px 92px;"/>
    <circle cx="185" cy="92" r="4" fill="var(--text)"/>
    <text class="metrics-gauge-readout" x="185" y="118" text-anchor="middle">76%</text>
  </svg>`;
}

// wireAccordions (./ui/a11y.js): keyboard-operable accordions with
// aria-expanded, shared with the assessment report.

// Scoped to the Runbooks and Playbooks pages specifically (per VISUAL-
// UPDATE-BRIEF.md items 8-9) via a --icon-accent custom property set
// inline per item, consumed by a var(--icon-accent, <original-default>)
// fallback added to the shared .icon-badge rule (see app.css) - .icon-badge
// itself stays the muted default everywhere else on the site (Home's site
// tiles, start-links, etc.) since nothing there ever sets the property.
// Deliberately not a literal inline color/border-color: that would win
// over the existing :hover rule's color change (inline specificity beats a
// class selector), which could make an icon the same color as its own
// hover background and disappear.
const ICON_ACCENT_CYCLE = ['--accent-signal','--accent-secure','--accent-violet','--accent-amber','--accent-critical','--accent-pop'];
export function accentIconStyle(i){
  const v = ICON_ACCENT_CYCLE[i % ICON_ACCENT_CYCLE.length];
  return `style="--icon-accent:var(${v});"`;
}
