// The assessment wizard UI: scope selection -> profile screens -> six
// scored categories -> results. Adapted from the original renderScope/
// renderPre/renderStep/renderRail/renderResults, rebuilt on the graph
// engine so profile screens can branch (§5.2) and gate visibility (§5.5)
// instead of walking a fixed PRE_STEPS array. Markup/class names are kept
// identical to the original wherever the behavior didn't need to change,
// per CLAUDE.md's "preserve the design system" rule.
import { visibleNodes, resolveNext, isNodeHidden } from "../engine/graph.js";
import { recordAnswer, createSessionState } from "../engine/state.js";
import { INDUSTRIES } from "../data/industries.js";
import { REGIONS } from "../data/regions.js";
import { COUNTRIES } from "../data/countries.js";
import { FRAMEWORKS } from "../data/frameworks.js";
import { PROFILE_SCREENS } from "../data/profile-flow.js";
import { ASSESSMENT_FLOW } from "../data/assessment-flow.js";
import { FUNCTIONS, FUNC_COLORS, FUNC_DISPLAY, FUNC_REF } from "../data/categories.js";
import { scoreFunction, computeFuncScores, computeOverall, computeFlags, computeGapItems, computePriorities, verdictLabel } from "../engine/scoring.js";
import { matchedVendorNotes } from "../data/vendor-notes.js";
import { snapshotRows } from "./snapshot.js";
import { OTHER as OTHER_VALUE } from "../data/vendors.js";
import { computeFrameworkRecommendations } from "../engine/framework-guidance.js";
import { guidanceForFlag, guidanceForGapItem } from "../engine/mitre-guidance.js";
import { buildAssessmentPdf } from "../engine/pdf-report.js";
import { saveProgress, loadProgress, clearProgress, hasSeenSaveNotice, markSaveNoticeSeen } from "../engine/local-save.js";
import { showToast } from "./toast.js";
import { matchOtherText } from "../engine/other-text-match.js";
import { SAMPLE_ANSWERS, SAMPLE_AI_INSIGHTS } from "../data/sample-scenario.js";

// ASSESSMENT-EXPERIENCE-BRIEF.md §4: brief, warm section-transition lines -
// no points/badges/streaks, just tone consistent with About/Core Principles.
// Keyed by the screen/category id just completed, shown once at the top of
// the next screen's render then cleared (see ui.transitionNote below).
const SECTION_TRANSITIONS = {
  profile: "Org profile done - let's talk about your team.",
  team: "Team structure done - now the technology itself.",
  infra: "Infrastructure covered - a couple of adjacent areas next.",
  containerization: "Containers and virtualization done - almost through setup.",
  devsecops: "Nearly there - just Operational Technology left, if it applies to you.",
  ot: "Setup's done. Now the actual six-function assessment.",
  Govern: "Governance done - next, what you actually have to protect.",
  Identify: "Identify done - now the safeguards standing in an attacker's way.",
  Protect: "Protect done - how would you even know if something went wrong?",
  Detect: "Detect done - the first hour of a real incident, next.",
  Respond: "Respond done - last section: getting back to normal.",
};

export function createAssessmentController({ getPanel, getRail, icon, pathForTab, wireNavLink, storage }) {
  const session = createSessionState();
  const ui = { phase: "landing", screenIndex: 0, categoryIndex: 0, transitionNote: null };

  function panel() {
    return getPanel();
  }

  // Every dynamic string interpolated into innerHTML below - free-text
  // answers (vendor "Other" fields, company name, webServerStack) and
  // AI-Insights response fields - needs this. localStorage save/resume
  // (§2) doesn't change what needs escaping (that's an XSS-safety property
  // of rendering, not of persistence), but it's the reason this got a fresh
  // audit: a saved answer set now round-trips through this renderer many
  // more times per session (loaded fresh on every "Resume") than an
  // answer typed once and rendered once, so a missed spot fails more often.
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ---------- ASSESSMENT-EXPERIENCE-BRIEF.md §2: localStorage save/resume ----------
  // Fires after every answer - this IS the save mechanism (see the brief:
  // "no separate 'Save' vs 'Save & Next' button... one save mechanism, one
  // toast, shown once"). Only persists during the actual data-collection
  // phases; landing/results have nothing in-progress worth resuming into.
  function persistProgress() {
    if (ui.phase !== "scope" && ui.phase !== "profile" && ui.phase !== "wizard") return;
    saveProgress(session, ui);
    if (Object.keys(session.answers).length > 0 && !hasSeenSaveNotice()) {
      showToast("Saved to this browser — close the tab anytime, but this only resumes from the same browser and device.");
      markSaveNoticeSeen();
    }
  }

  // ---------- ASSESSMENT-EXPERIENCE-BRIEF.md §4: progress/skip UX ----------
  function allKnownNodes() {
    return [...PROFILE_SCREENS.flatMap((s) => Array.from(s.flow.index.values())), ...Array.from(ASSESSMENT_FLOW.index.values())];
  }
  function skippedCount() {
    return allKnownNodes().filter((n) => isNodeHidden(n, session)).length;
  }
  function progressInfo() {
    const totalSections = visibleProfileScreens().length + FUNCTIONS.length;
    let sectionIndex = 0;
    if (ui.phase === "profile") sectionIndex = visibleProfileScreens().indexOf(PROFILE_SCREENS[ui.screenIndex]);
    else if (ui.phase === "wizard") sectionIndex = visibleProfileScreens().length + ui.categoryIndex;
    const remaining = Math.max(0, totalSections - sectionIndex);
    const baseMinutes = session.quickMode ? 2 : 5;
    // UX-VISUAL-CREDIBILITY-BRIEF.md §2: this genuinely recalculates every
    // render (it's not a cached/one-time value) - the bug was Math.round()
    // plateauing across several sections before the displayed integer
    // finally ticked down (e.g. 12 sections into a 5-minute estimate: going
    // from 12/12 remaining to 11/12 remaining rounds 5.0 -> 4.58 -> still
    // "5"). Math.floor() instead guarantees the very first completed
    // section already reads as real, visible progress.
    const estimateMinutes = Math.max(1, Math.floor((baseMinutes * remaining) / totalSections));
    return { position: sectionIndex + 1, totalSections, estimateMinutes };
  }
  function progressMetaHtml() {
    const { position, totalSections, estimateMinutes } = progressInfo();
    const skipped = skippedCount();
    return `
      <div class="progress-meta"><b>${position} of ${totalSections}</b> sections · ~${estimateMinutes} minute${estimateMinutes === 1 ? "" : "s"} left</div>
      ${skipped > 0 ? `<p class="skip-note">Based on your answers, we've skipped ${skipped} question${skipped === 1 ? "" : "s"} that don't apply to your setup.</p>` : ""}
    `;
  }
  // Rendered once at the top of the next screen, then cleared so re-renders
  // of that same screen (e.g. after answering another question on it) don't
  // keep repeating it.
  function transitionNoteHtml() {
    if (!ui.transitionNote) return "";
    const text = ui.transitionNote;
    ui.transitionNote = null;
    return `<p class="section-transition">${text}</p>`;
  }

  // ---------- visibility helpers ----------
  function visibleProfileScreens() {
    return PROFILE_SCREENS.filter((s) => !s.skipIf || !s.skipIf(session.answers));
  }
  function firstVisibleScreenIndex() {
    const list = visibleProfileScreens();
    return list.length ? PROFILE_SCREENS.indexOf(list[0]) : PROFILE_SCREENS.length;
  }
  function nextVisibleScreenIndex(from) {
    let i = from + 1;
    while (i < PROFILE_SCREENS.length && PROFILE_SCREENS[i].skipIf && PROFILE_SCREENS[i].skipIf(session.answers)) i++;
    return i;
  }
  function prevVisibleScreenIndex(from) {
    let i = from - 1;
    while (i >= 0 && PROFILE_SCREENS[i].skipIf && PROFILE_SCREENS[i].skipIf(session.answers)) i--;
    return i;
  }
  function lastVisibleScreenIndex() {
    let i = PROFILE_SCREENS.length - 1;
    while (i >= 0 && PROFILE_SCREENS[i].skipIf && PROFILE_SCREENS[i].skipIf(session.answers)) i--;
    return i;
  }

  // ---------- rail ----------
  function renderRail() {
    const rail = getRail();
    if (!rail) return;
    if (ui.phase === "landing" || ui.phase === "sample") {
      // ASSESSMENT-REPORT-DEPTH-BRIEF.md §1: an empty rail still reserved
      // its 180px + 40px gap grid column (see .layout in app.css), which is
      // exactly the ~220px the panel sat shifted right by - .rail-empty
      // lets the grid collapse to a single column instead of leaving that
      // space allocated to nothing.
      rail.innerHTML = "";
      rail.classList.add("rail-empty");
      return;
    }
    rail.classList.remove("rail-empty");
    const visiblePre = visibleProfileScreens();
    const items = ["Scope", ...visiblePre.map((s) => s.title), ...FUNCTIONS.map((fn) => FUNC_DISPLAY[fn]), "Reading"];
    let activeIdx;
    if (ui.phase === "scope") activeIdx = 0;
    else if (ui.phase === "profile") {
      const posInVisible = visiblePre.indexOf(PROFILE_SCREENS[ui.screenIndex]);
      activeIdx = 1 + (posInVisible >= 0 ? posInVisible : 0);
    } else if (ui.phase === "wizard") activeIdx = 1 + visiblePre.length + ui.categoryIndex;
    else activeIdx = items.length - 1;
    rail.innerHTML =
      '<div class="rail-line"></div>' +
      '<div class="rail-dots">' +
      items
        .map((label, i) => {
          let cls = "node";
          if (i < activeIdx) cls += " done";
          if (i === activeIdx) cls += " active";
          return `<div class="${cls}"><div class="dot"></div><div class="label">${label}</div></div>`;
        })
        .join("") +
      "</div>" +
      // Only rendered below 720px (see .rail-active-label in app.css) - the
      // horizontal mobile rail hides each node's own label and shows this
      // one instead, since there's no room for 8-15+ of them at once.
      `<div class="rail-active-label">${items[activeIdx]}</div>`;
  }

  // ---------- ASSESSMENT-EXPERIENCE-BRIEF.md §5: mode-selection landing screen ----------
  function startFresh(quickMode) {
    session.quickMode = quickMode;
    ui.phase = "scope";
    renderRail();
    renderScope();
  }

  function resumeFromSave(saved) {
    Object.assign(session.answers, saved.answers || {});
    session.asked = Array.isArray(saved.asked) ? saved.asked : [];
    session.dedupe = saved.dedupe && typeof saved.dedupe === "object" ? saved.dedupe : {};
    session.quickMode = Boolean(saved.quickMode);
    Object.assign(ui, saved.ui || {});
    renderRail();
    dispatchPhase();
  }

  // ASSESSMENT-REPORT-DEPTH-BRIEF.md §2: the "Assessment" nav link is a
  // deliberate "start over" action - the landing screen (with its own
  // Resume banner) is the one true entry point, not a silent resume of
  // wherever the wizard was left. Only warn when that would actually
  // discard something real: genuine in-progress answers mid-scope/profile/
  // wizard. Sample Report, Results, and the landing screen itself have
  // nothing at risk, so they proceed with no prompt - this is also what
  // fixes "Assessment does nothing while viewing a Sample Report", since
  // that phase now actively resets to landing instead of re-rendering itself.
  function requestLanding() {
    const midAssessment = (ui.phase === "scope" || ui.phase === "profile" || ui.phase === "wizard") && Object.keys(session.answers).length > 0;
    if (midAssessment && !confirm("Starting a new assessment will discard your current progress. Continue?")) {
      return false;
    }
    Object.keys(session.answers).forEach((k) => delete session.answers[k]);
    session.asked = [];
    session.dedupe = {};
    session.quickMode = false;
    clearProgress();
    ui.phase = "landing";
    ui.screenIndex = 0;
    ui.categoryIndex = 0;
    ui.transitionNote = null;
    renderRail();
    renderLanding();
    return true;
  }

  function renderLanding() {
    const p = panel();
    const saved = loadProgress();
    p.innerHTML = `
      <div class="step-eyebrow">Assessment</div>
      <h2 class="step-title">Choose how to start</h2>
      <p class="step-sub">Every mode runs the same six-function NIST CSF scoring, compounding-risk detection, and MITRE ATT&CK mapping at full strength - Quick just collects less vendor-specific detail along the way.</p>
      ${
        saved
          ? `<div class="resume-banner">
               <div class="resume-banner-text">You have an <b>in-progress assessment</b> saved on this browser.</div>
               <div class="resume-banner-actions">
                 <button id="discardResumeBtn">Start fresh</button>
                 <button class="primary" id="resumeBtn">Resume →</button>
               </div>
             </div>`
          : ""
      }
      <div class="mode-grid">
        <div class="mode-card" id="modeQuick">
          <div class="mode-card-time">${icon("clock")} ~2 minutes</div>
          <h4>Quick Assessment</h4>
          <p>Core NIST function scoring across all six functions - skips vendor-specific detail like which product or provider you use.</p>
          <div class="mode-card-cta">Start Quick →</div>
        </div>
        <div class="mode-card" id="modeFull">
          <div class="mode-card-time">${icon("clock")} ~5 minutes</div>
          <h4>Full Assessment</h4>
          <p>Everything, including vendor-specific mitigation guidance for the exact products and providers in your environment.</p>
          <div class="mode-card-cta">Start Full →</div>
        </div>
        <div class="mode-card" id="modeSample">
          <h4>See a Sample Report</h4>
          <p>View a complete example report with no questions to answer - full depth, real scoring, nothing to fill in.</p>
          <div class="mode-card-cta">View sample →</div>
        </div>
      </div>
    `;
    document.getElementById("modeQuick").addEventListener("click", () => startFresh(true));
    document.getElementById("modeFull").addEventListener("click", () => startFresh(false));
    document.getElementById("modeSample").addEventListener("click", () => {
      ui.phase = "sample";
      renderRail();
      renderSampleReport();
    });
    const resumeBtn = document.getElementById("resumeBtn");
    if (resumeBtn) resumeBtn.addEventListener("click", () => resumeFromSave(saved));
    const discardBtn = document.getElementById("discardResumeBtn");
    if (discardBtn)
      discardBtn.addEventListener("click", () => {
        clearProgress();
        renderLanding();
      });
  }

  // ---------- scope screen (§5.1) ----------
  function updateSerial() {
    const el = document.getElementById("serial");
    if (!el) return;
    const extra = FRAMEWORKS.filter((f) => session.answers[f.id]).map((f) => f.name);
    const label = extra.length ? `NIST CSF 2.0 · CIS Controls v8 + ${extra.join(" + ")}` : "NIST CSF 2.0 · CIS Controls v8";
    el.innerHTML = `SIMPLIFIEDCS / PROTOTYPE&nbsp;v0.1 · ${label}`;
  }

  async function renderScope() {
    persistProgress();
    const p = panel();
    p.innerHTML = `<div class="step-eyebrow">Scope</div><h2 class="step-title">Before we start</h2>`;
    let historyCount = 0;
    try {
      const lr = await storage.list("runs:", false);
      historyCount = lr && lr.keys ? lr.keys.length : 0;
    } catch (e) {
      /* storage unavailable - proceed without history */
    }

    const ind = session.answers.industry ? INDUSTRIES.find((i) => i.id === session.answers.industry) : null;
    const selectedRegions = session.answers.regions || [];
    const selectedCountries = session.answers.countries || [];

    const reasons = {};
    const addReason = (fid, r) => {
      reasons[fid] = reasons[fid] || [];
      reasons[fid].push(r);
    };
    if (ind && ind.topPriority) addReason(ind.topPriority, { type: "top", label: `★ Top priority recommendation for ${ind.label}` });
    if (ind && ind.alsoRelevant) ind.alsoRelevant.forEach((fid) => addReason(fid, { type: "industry", label: `Commonly relevant for ${ind.label}` }));
    selectedRegions.forEach((rid) => {
      const r = REGIONS.find((x) => x.id === rid);
      if (r) r.frameworks.forEach((fid) => addReason(fid, { type: "region", label: `Relevant for ${r.label} operations` }));
    });
    const highlightedIds = Object.keys(reasons);
    const highlightedFw = FRAMEWORKS.filter((f) => highlightedIds.includes(f.id)).sort((a, b) => (a.id === ind?.topPriority ? -1 : 0) - (b.id === ind?.topPriority ? -1 : 0));
    const otherFw = FRAMEWORKS.filter((f) => !highlightedIds.includes(f.id));
    const regularRegions = REGIONS.filter((r) => !r.standalone);
    const globalRegion = REGIONS.find((r) => r.standalone);

    p.innerHTML = `
      <div class="step-eyebrow">Scope · ${session.quickMode ? "Quick Assessment" : "Full Assessment"}</div>
      <h2 class="step-title">Before we start</h2>
      <p class="step-sub">Every assessment includes the NIST CSF 2.0 + CIS Controls baseline. Add any compliance standards that apply to your organization - none are selected automatically, even if we flag one as relevant for your industry or region.</p>
      ${historyCount ? `<a class="history-link" id="historyLink" href="${pathForTab("history")}">You have ${historyCount} previous assessment${historyCount === 1 ? "" : "s"} saved on this account - <u>view history</u></a>` : ""}

      <div class="fw-section-label">Industry</div>
      <div class="industry-grid">
        ${INDUSTRIES.map((i) => `<div class="industry-card ${session.answers.industry === i.id ? "selected" : ""}" data-industry="${i.id}">${i.label}</div>`).join("")}
      </div>

      ${(() => {
        if (!ind) return "";
        if (ind.otDefault === "skip")
          return `<div class="ot-skip-note">
          Based on <b>${ind.label}</b>, we've assumed no dedicated OT/ICS environment and will skip those questions.
          <label class="ot-override-label"><input type="checkbox" id="otOverrideCheck" ${session.answers.otOverride ? "checked" : ""}> Include OT questions anyway</label>
        </div>`;
        if (ind.otDefault === "likely")
          return `<div class="ot-likely-note">
          OT/ICS environments are common in <b>${ind.label}</b> - we've kept those questions in your assessment by default. Answer "No" on that step if it genuinely doesn't apply to you.
        </div>`;
        return "";
      })()}

      <div class="fw-section-label">Where do you operate?</div>
      <p class="scope-hint" style="margin-top:-6px;">Select every region your organization is registered or operating in - this surfaces the specific frameworks mandated there. Choose Global if this doesn't apply, or narrow down to specific countries below.</p>

      <div class="region-global-standalone ${selectedRegions.includes(globalRegion.id) ? "selected" : ""}" data-region="${globalRegion.id}">
        <div class="checkbox"></div><b>${globalRegion.label}</b> - not tied to a specific region
      </div>

      <div class="region-grid">
        ${regularRegions
          .map(
            (r) => `
          <div class="region-chip ${selectedRegions.includes(r.id) ? "selected" : ""}" data-region="${r.id}">
            <div class="checkbox"></div>${r.label}
          </div>
        `
          )
          .join("")}
      </div>
      ${selectedRegions
        .map((rid) => {
          const r = REGIONS.find((x) => x.id === rid);
          return r ? `<div class="region-note"><b>${r.label}:</b> ${r.note}</div>` : "";
        })
        .join("")}

      <div class="acc-card ${selectedCountries.length ? "open" : ""}" style="margin-top:10px;">
        <div class="acc-head">
          <div class="icon-badge">${icon("register")}</div>
          <div><h4>Select specific countries</h4><div class="acc-sub">Optional - ${selectedCountries.length ? `${selectedCountries.length} selected` : "for granular, per-country tracking"}</div></div>
          <div class="acc-chevron">▸</div>
        </div>
        <div class="acc-body">
          <div class="country-checklist">
            ${COUNTRIES.map(
              (c) => `
              <label class="country-check-item">
                <input type="checkbox" data-country="${c}" ${selectedCountries.includes(c) ? "checked" : ""}> ${c}
              </label>
            `
            ).join("")}
          </div>
        </div>
      </div>

      <div class="fw-section-label">Frameworks</div>
      <div class="fw-baseline"><b>Always included:</b> NIST CSF 2.0 + CIS Controls v8 (the baseline this instrument is built on)</div>
      ${(() => {
        const hasOtherSelected = otherFw.some((f) => session.answers[f.id]);
        const fwCardHtml = (f) => `
          <div class="fw-card ${session.answers[f.id] ? "selected" : ""} ${reasons[f.id]?.some((r) => r.type === "top") ? "fw-top-priority" : ""}" data-fw="${f.id}">
            <div>
              <div class="fw-name">${f.name}</div>
              ${(reasons[f.id] || []).map((r) => `<div class="priority-tag">${r.label}</div>`).join("")}
              <div class="fw-desc">${f.desc}</div>
            </div>
            <div class="checkbox"></div>
          </div>
        `;
        return `
          ${highlightedFw.map(fwCardHtml).join("")}
          <div class="acc-card ${hasOtherSelected ? "open" : ""}" style="margin-top:10px;">
            <div class="acc-head">
              <div class="icon-badge">${icon("register")}</div>
              <div><h4>Additional Compliance & Regulatory Frameworks</h4><div class="acc-sub">${otherFw.length} more standards available - ${hasOtherSelected ? "you have one selected below" : "optional, select any that apply"}</div></div>
              <div class="acc-chevron">▸</div>
            </div>
            <div class="acc-body" style="padding-left:18px;">
              ${otherFw.map(fwCardHtml).join("")}
            </div>
          </div>
        `;
      })()}
      <p class="scope-hint">These are common patterns, not a legal determination - confirm exact obligations (especially NIS2 sector/size thresholds) with your regulatory counsel.</p>

      <div class="nav">
        <button id="backToLandingBtn">← Change assessment type</button>
        <button class="primary" id="scopeNext">Start assessment →</button>
      </div>
    `;

    p.querySelectorAll(".industry-card").forEach((el) => {
      el.addEventListener("click", () => {
        session.answers.industry = el.dataset.industry;
        renderScope();
      });
    });
    p.querySelectorAll(".region-chip, .region-global-standalone").forEach((el) => {
      el.addEventListener("click", () => {
        const rid = el.dataset.region;
        session.answers.regions = session.answers.regions || [];
        const i = session.answers.regions.indexOf(rid);
        if (i >= 0) session.answers.regions.splice(i, 1);
        else session.answers.regions.push(rid);
        renderScope();
      });
    });
    p.querySelectorAll("input[data-country]").forEach((el) => {
      el.addEventListener("change", () => {
        session.answers.countries = session.answers.countries || [];
        const c = el.dataset.country;
        const i = session.answers.countries.indexOf(c);
        if (el.checked && i < 0) session.answers.countries.push(c);
        else if (!el.checked && i >= 0) session.answers.countries.splice(i, 1);
      });
    });
    const otCheck = document.getElementById("otOverrideCheck");
    if (otCheck) {
      otCheck.addEventListener("change", () => {
        session.answers.otOverride = otCheck.checked;
        renderScope();
      });
    }
    const historyLinkEl = document.getElementById("historyLink");
    if (historyLinkEl) wireNavLink(historyLinkEl, "history");
    document.getElementById("backToLandingBtn").addEventListener("click", () => {
      ui.phase = "landing";
      renderRail();
      renderLanding();
    });
    p.querySelectorAll(".acc-head").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest(".fw-card")) return;
        el.parentElement.classList.toggle("open");
      });
    });
    p.querySelectorAll(".fw-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.fw;
        session.answers[id] = !session.answers[id];
        renderScope();
        updateSerial();
      });
    });
    document.getElementById("scopeNext").addEventListener("click", () => {
      updateSerial();
      const idx = firstVisibleScreenIndex();
      if (idx >= PROFILE_SCREENS.length) {
        ui.phase = "wizard";
        ui.categoryIndex = 0;
        renderRail();
        renderAssessmentCategory();
      } else {
        ui.phase = "profile";
        ui.screenIndex = idx;
        renderRail();
        renderProfileScreen();
      }
    });
  }

  // ---------- profile screens (§5.2/§5.3/§5.4/§5.5) ----------
  function fieldHtml(node) {
    const val = session.answers[node.id] ?? "";
    if (node.type === "info") return `<div class="info-box">${node.text}</div>`;
    if (node.type === "select") {
      // UX-VISUAL-CREDIBILITY-BRIEF.md §1: every profile "select" node has a
      // small, fixed option set (confirmed ≤5 across every data file) - a
      // single click beats open-then-pick, and reusing the same .question/
      // .options/.option/.radio pattern the scored NIST questions already
      // use keeps a consistent look across the whole wizard. Vendor fields
      // (type "vendor") keep the dropdown - open-ended, larger lists pair
      // better with a native select's own "Other" fallback than a wall of
      // radio buttons would.
      // ASSESSMENT-REPORT-DEPTH-BRIEF.md §5: "Other" added where a fixed
      // option set could genuinely miss a real answer - node.allowOther is
      // opt-in per question, not universal (a plain Yes/No has no
      // meaningful "Other"). Mirrors the vendor-field pattern: an __isOther
      // flag plus the main answer left blank/typed-text until something
      // real is entered, so a required field isn't "complete" on selecting
      // Other alone.
      const isOtherSelected = Boolean(node.allowOther && session.answers[node.id + "__isOther"]);
      return `
        <div class="question">
          <p>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</p>
          <div class="options">
            ${node.options
              .map(
                (o) => `
              <div class="option ${!isOtherSelected && val === o ? "selected" : ""}" data-fid="${node.id}" data-val="${escapeHtml(o)}">
                <div class="radio"></div><div>${escapeHtml(o)}</div>
              </div>
            `
              )
              .join("")}
            ${
              node.allowOther
                ? `
              <div class="option ${isOtherSelected ? "selected" : ""}" data-fid="${node.id}" data-val="${OTHER_VALUE}">
                <div class="radio"></div><div>Other</div>
              </div>`
                : ""
            }
          </div>
          ${isOtherSelected ? `<input type="text" data-select-other-fid="${node.id}" value="${escapeHtml(val)}" placeholder="${escapeHtml(node.otherPlaceholder || "Please specify")}" style="margin-top:10px;">` : ""}
        </div>`;
    }
    if (node.type === "multiselect") {
      const selected = Array.isArray(val) ? val : [];
      const otherChecked = selected.includes(OTHER_VALUE);
      const otherText = session.answers[node.id + "__otherText"] || "";
      return `
        <div class="field">
          <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
          <div class="checkbox-group" data-fid="${node.id}">
            ${node.options
              .map(
                (o) => `
              <label class="checkbox-option ${selected.includes(o.id) ? "selected" : ""}">
                <input type="checkbox" data-optid="${o.id}" ${selected.includes(o.id) ? "checked" : ""}> ${o.label}
              </label>
            `
              )
              .join("")}
            ${
              node.allowOther
                ? `
              <label class="checkbox-option ${otherChecked ? "selected" : ""}">
                <input type="checkbox" data-optid="${OTHER_VALUE}" ${otherChecked ? "checked" : ""}> Other
              </label>`
                : ""
            }
          </div>
          ${otherChecked ? `<input type="text" data-fid-other="${node.id}" value="${escapeHtml(otherText)}" placeholder="${escapeHtml(node.otherPlaceholder || "Please specify")}">` : ""}
        </div>`;
    }
    if (node.type === "vendor") {
      const isOther = session.answers[node.id + "__isOther"] || (val !== "" && !node.vendorOptions.includes(val));
      return `
        <div class="field">
          <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
          <select data-vendor-fid="${node.id}">
            <option value="" ${val === "" && !isOther ? "selected" : ""} disabled>Select…</option>
            ${node.vendorOptions.map((v) => `<option value="${v}" ${!isOther && val === v ? "selected" : ""}>${v}</option>`).join("")}
            <option value="${OTHER_VALUE}" ${isOther ? "selected" : ""}>Other</option>
          </select>
          ${isOther ? `<input type="text" data-vendor-other-fid="${node.id}" value="${escapeHtml(!node.vendorOptions.includes(val) ? val : "")}" placeholder="Please specify">` : ""}
        </div>`;
    }
    // text
    return `
      <div class="field">
        <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
        <input type="text" data-fid="${node.id}" value="${escapeHtml(val)}" placeholder="${escapeHtml(node.placeholder || "")}">
      </div>`;
  }

  function screenComplete(screen) {
    return visibleNodes(screen.flow, session).every((n) => !n.required || (session.answers[n.id] !== undefined && session.answers[n.id] !== "" && !(Array.isArray(session.answers[n.id]) && session.answers[n.id].length === 0)));
  }

  function renderProfileScreen() {
    persistProgress();
    const screen = PROFILE_SCREENS[ui.screenIndex];
    const p = panel();
    const nodes = visibleNodes(screen.flow, session);
    const isLastVisible = nextVisibleScreenIndex(ui.screenIndex) >= PROFILE_SCREENS.length;
    p.innerHTML = `
      <div class="step-eyebrow">Pre-Assessment</div>
      <h2 class="step-title">${screen.title}</h2>
      ${transitionNoteHtml()}
      ${progressMetaHtml()}
      <p class="step-sub">${screen.sub}</p>
      ${nodes.map(fieldHtml).join("")}
      <div class="nav">
        <button id="backBtn">← Back</button>
        <button class="primary" id="nextBtn" ${screenComplete(screen) ? "" : "disabled"}>${isLastVisible ? "Continue to assessment →" : "Continue →"}</button>
      </div>
    `;

    function refreshNext() {
      document.getElementById("nextBtn").disabled = !screenComplete(screen);
    }

    p.querySelectorAll(".option[data-fid]").forEach((el) => {
      el.addEventListener("click", () => {
        const node = screen.flow.index.get(el.dataset.fid);
        if (el.dataset.val === OTHER_VALUE) {
          session.answers[node.id + "__isOther"] = true;
          recordAnswer(session, node, "");
        } else {
          delete session.answers[node.id + "__isOther"];
          recordAnswer(session, node, el.dataset.val);
        }
        renderProfileScreen();
      });
    });
    p.querySelectorAll("input[data-select-other-fid]").forEach((el) => {
      el.addEventListener("input", () => {
        const node = screen.flow.index.get(el.dataset.selectOtherFid);
        recordAnswer(session, node, el.value);
        refreshNext();
      });
      // Same keyword-match-first principle as the multiselect handler above,
      // adapted for a single answer: a match converts the answer directly
      // to the existing option's own canonical value instead of adding to a
      // set, since a single-select only ever holds one.
      el.addEventListener("blur", () => {
        const node = screen.flow.index.get(el.dataset.selectOtherFid);
        const text = (session.answers[node.id] || "").trim();
        if (!text) return;
        const match = matchOtherText(text, node.options.map((o) => ({ id: o, label: o })));
        if (!match) return;
        delete session.answers[node.id + "__isOther"];
        recordAnswer(session, node, match.id);
        renderProfileScreen();
      });
    });
    p.querySelectorAll("input[type=text][data-fid]").forEach((el) => {
      el.addEventListener("input", () => {
        const node = screen.flow.index.get(el.dataset.fid);
        recordAnswer(session, node, el.value);
        refreshNext();
      });
    });
    p.querySelectorAll("select[data-vendor-fid]").forEach((el) => {
      el.addEventListener("change", () => {
        const node = screen.flow.index.get(el.dataset.vendorFid);
        if (el.value === OTHER_VALUE) {
          session.answers[node.id + "__isOther"] = true;
          recordAnswer(session, node, "");
        } else {
          delete session.answers[node.id + "__isOther"];
          recordAnswer(session, node, el.value);
        }
        renderProfileScreen();
      });
    });
    p.querySelectorAll("input[data-vendor-other-fid]").forEach((el) => {
      el.addEventListener("input", () => {
        const node = screen.flow.index.get(el.dataset.vendorOtherFid);
        recordAnswer(session, node, el.value);
        refreshNext();
      });
    });
    p.querySelectorAll(".checkbox-group[data-fid]").forEach((groupEl) => {
      groupEl.querySelectorAll("input[data-optid]").forEach((cb) => {
        cb.addEventListener("change", () => {
          const node = screen.flow.index.get(groupEl.dataset.fid);
          const current = Array.isArray(session.answers[node.id]) ? [...session.answers[node.id]] : [];
          const optId = cb.dataset.optid;
          const i = current.indexOf(optId);
          if (cb.checked && i < 0) current.push(optId);
          else if (!cb.checked && i >= 0) current.splice(i, 1);
          recordAnswer(session, node, current);
          renderProfileScreen();
        });
      });
    });
    p.querySelectorAll("input[data-fid-other]").forEach((el) => {
      el.addEventListener("input", () => {
        session.answers[el.dataset.fidOther + "__otherText"] = el.value;
        refreshNext();
      });
      // ASSESSMENT-REPORT-DEPTH-BRIEF.md §5: keyword-match first, checked
      // once typing pauses (blur) rather than per keystroke - a mid-word
      // partial match would flicker the checkbox state distractingly while
      // someone is still typing. A match silently also checks the existing
      // structured option (in addition to keeping their own typed text
      // intact) so downstream logic - dedupe, compounding-risk flags -
      // sees it exactly as if they'd picked it from the list, at zero cost.
      el.addEventListener("blur", () => {
        const node = screen.flow.index.get(el.dataset.fidOther);
        const text = (session.answers[node.id + "__otherText"] || "").trim();
        if (!text || node.type !== "multiselect") return;
        const match = matchOtherText(text, node.options);
        if (!match) return;
        const current = Array.isArray(session.answers[node.id]) ? [...session.answers[node.id]] : [];
        if (current.includes(match.id)) return;
        current.push(match.id);
        recordAnswer(session, node, current);
        renderProfileScreen();
      });
    });

    refreshNext();

    document.getElementById("nextBtn").addEventListener("click", () => {
      const nxt = nextVisibleScreenIndex(ui.screenIndex);
      ui.transitionNote = SECTION_TRANSITIONS[screen.id] || null;
      if (nxt >= PROFILE_SCREENS.length) {
        ui.phase = "wizard";
        ui.categoryIndex = 0;
        renderRail();
        renderAssessmentCategory();
      } else {
        ui.screenIndex = nxt;
        renderRail();
        renderProfileScreen();
      }
    });
    document.getElementById("backBtn").addEventListener("click", () => {
      const prv = prevVisibleScreenIndex(ui.screenIndex);
      if (prv < 0) {
        ui.phase = "scope";
        renderRail();
        renderScope();
      } else {
        ui.screenIndex = prv;
        renderRail();
        renderProfileScreen();
      }
    });
  }

  // ---------- scored assessment categories (six NIST functions) ----------
  function categoryQuestions(fn) {
    return visibleNodes(ASSESSMENT_FLOW, session).filter((q) => q.fn === fn);
  }
  function categoryAnswered(fn) {
    return categoryQuestions(fn).every((q) => session.answers[q.id] !== undefined);
  }

  function renderAssessmentCategory() {
    persistProgress();
    const fn = FUNCTIONS[ui.categoryIndex];
    const p = panel();
    const qs = categoryQuestions(fn);
    p.innerHTML = `
      <div class="step-eyebrow">${FUNC_REF[fn]}</div>
      <h2 class="step-title">${FUNC_DISPLAY[fn]}</h2>
      ${transitionNoteHtml()}
      ${progressMetaHtml()}
      <p class="step-sub"></p>
      ${qs
        .map(
          (q) => `
        <div class="question">
          <p>${q.text}${q.framework ? `<span class="q-badge">${FRAMEWORKS.find((f) => f.id === q.framework).name}</span>` : ""}</p>
          <div class="options">
            ${q.options
              .map(
                (o) => `
              <div class="option ${session.answers[q.id] === o.v ? "selected" : ""}" data-qid="${q.id}" data-val="${o.v}">
                <div class="radio"></div><div>${o.t}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("")}
      <div class="nav">
        <button id="backBtn">← Back</button>
        <button class="primary" id="nextBtn" ${categoryAnswered(fn) ? "" : "disabled"}>${ui.categoryIndex === FUNCTIONS.length - 1 ? "Generate reading" : "Continue →"}</button>
      </div>
    `;

    p.querySelectorAll(".option").forEach((el) => {
      el.addEventListener("click", () => {
        const qid = el.dataset.qid;
        const node = ASSESSMENT_FLOW.index.get(qid);
        recordAnswer(session, node, Number(el.dataset.val));
        renderAssessmentCategory();
      });
    });

    document.getElementById("nextBtn").addEventListener("click", () => {
      ui.transitionNote = SECTION_TRANSITIONS[fn] || null;
      if (ui.categoryIndex === FUNCTIONS.length - 1) {
        ui.phase = "results";
        renderRail();
        renderResults();
      } else {
        ui.categoryIndex++;
        renderRail();
        renderAssessmentCategory();
      }
    });
    document.getElementById("backBtn").addEventListener("click", () => {
      if (ui.categoryIndex > 0) {
        ui.categoryIndex--;
        renderRail();
        renderAssessmentCategory();
      } else {
        const idx = lastVisibleScreenIndex();
        if (idx < 0) {
          ui.phase = "scope";
          renderRail();
          renderScope();
        } else {
          ui.phase = "profile";
          ui.screenIndex = idx;
          renderRail();
          renderProfileScreen();
        }
      }
    });
  }

  // §2: one collapsed "Why this matters, and what to do now" expander per
  // compounding-risk flag / notably-low-scoring priority item that has a
  // confident MITRE ATT&CK mapping (see engine/mitre-guidance.js - items
  // without a genuine mapping simply don't get a panel, rather than
  // fabricating one). Reuses the existing acc-card/acc-head/acc-body
  // accordion pattern verbatim so the interaction matches Runbooks/Playbooks.
  // ASSESSMENT-REPORT-DEPTH-BRIEF.md §6/§7: renders whichever fields
  // guidanceForFlag()/guidanceForGapItem() actually returned - Full mode's
  // five parts (traceability, technique, consequence, interim step,
  // remediation, plus an optional verified reference link) or Quick
  // mode's condensed three (traceability, consequence, remediation), since
  // those functions were already called with `full = !session.quickMode`.
  // Escaped throughout: traceability in particular can echo a profile
  // "Other" free-text field (e.g. devsecopsMaturity) back into the page.
  function mitrePanel(guidance, panelId) {
    if (!guidance) return "";
    const rows = [];
    if (guidance.traceability) rows.push(`<li><b>Why this was flagged:</b> ${escapeHtml(guidance.traceability)}</li>`);
    if (guidance.technique) {
      rows.push(`<li><b>Attack pattern:</b> ${escapeHtml(guidance.technique.name)} (MITRE ATT&CK ${escapeHtml(guidance.technique.id)}) - ${escapeHtml(guidance.explain)}</li>`);
    } else {
      rows.push(`<li><b>What could go wrong:</b> ${escapeHtml(guidance.explain)}</li>`);
    }
    if (guidance.control) rows.push(`<li><b>Interim step:</b> ${escapeHtml(guidance.control)}</li>`);
    if (guidance.remediation) rows.push(`<li><b>How to fix it:</b> ${escapeHtml(guidance.remediation)}</li>`);
    if (guidance.reference) {
      const safeUrl = safeHttpUrl(guidance.reference.url);
      if (safeUrl) rows.push(`<li><b>Reference:</b> <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(guidance.reference.label)}</a></li>`);
    }
    return `
      <div class="acc-card mitre-panel" data-id="${panelId}">
        <div class="acc-head">
          <div><h4>Why this matters, and what to do now</h4></div>
          <div class="acc-chevron">▸</div>
        </div>
        <div class="acc-body">
          <ul>${rows.join("")}</ul>
        </div>
      </div>`;
  }

  // Conic-gradient string for the overall-score gauge - shared by the real
  // results screen and §6's Sample Report, since both render the same gauge.
  function conicFor(funcScores) {
    const slice = 360 / funcScores.length;
    let acc = 0;
    const parts = funcScores.map((f) => {
      const start = acc;
      acc += slice;
      return `${FUNC_COLORS[f.fn]} ${start}deg ${acc}deg`;
    });
    return `conic-gradient(${parts.join(",")})`;
  }

  // The deterministic report body - scores, snapshot, compounding-risk
  // flags, vendor notes, framework recommendations, and the ranked priority
  // list. ASSESSMENT-EXPERIENCE-BRIEF.md §6: the Sample Report must be
  // "generated by running a fixed, realistic set of sample answers through
  // the actual real engine... so it automatically stays correct as the
  // real scoring/rules logic evolves" rather than a second, hand-maintained
  // copy - so this is the one place that markup exists, shared by
  // renderResults() and renderSampleReport() alike.
  function reportBodyHtml({ session: s, funcScores, overall, flags, vendorNotes, frameworkRecs, priorities, otherTexts = [] }) {
    return `
      <div class="snapshot">
        <h3>Infrastructure snapshot (self-reported)</h3>
        ${snapshotRows(s.answers)
          .map(([k, v]) => `<div class="snapshot-row"><div class="skey">${k}</div><div>${escapeHtml(v)}</div></div>`)
          .join("")}
      </div>

      <p class="score-direction-legend">Higher percentages mean a <b>stronger security posture</b> - not compliance completeness, not exposure level. 100% would mean every control this assessment checks for is fully in place; it doesn't mean risk-free.</p>
      <div class="gauge-row">
        <div class="gauge" style="background:${conicFor(funcScores)}">
          <div class="gauge-inner">
            <div class="pct">${overall}%</div>
            <div class="verdict">${verdictLabel(overall)}</div>
          </div>
        </div>
        <div class="func-bars">
          ${funcScores
            .map(
              (f) => `
            <div class="func-bar-row">
              <div class="fname">${FUNC_DISPLAY[f.fn]}</div>
              <div class="func-bar-track"><div class="func-bar-fill" style="width:${f.pct}%; background:${FUNC_COLORS[f.fn]}"></div></div>
              <div class="fpct">${f.pct}%</div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>

      ${
        flags.length
          ? `
      <div class="flags">
        <h3>Compounding risk - patterns across steps</h3>
        ${flags
          .map(
            (f) => `
          <div class="flag-item"><b>Combined finding -</b> ${f.text}</div>
          ${mitrePanel(guidanceForFlag(f, s.answers, !s.quickMode), `flag-${f.id}`)}
        `
          )
          .join("")}
      </div>`
          : ""
      }

      ${
        vendorNotes.length
          ? `
      <div class="flags">
        <h3>Vendor-specific mitigation notes</h3>
        ${vendorNotes.map((v) => `<div class="vendor-note-item"><b>${v.vendor} -</b> ${v.note}</div>`).join("")}
        <p class="scope-hint">Illustrative, based on well-documented historical exploitation patterns for named products - not a live feed. This tool intentionally doesn't do vulnerability scanning; treat this as a prompt to check current vendor advisories for your exact version, not a substitute for doing so.</p>
      </div>`
          : ""
      }

      ${otherTextSectionHtml(otherTexts)}

      ${
        frameworkRecs.length
          ? `
      <div class="flags">
        <h3>Compliance considerations</h3>
        ${frameworkRecs
          .map(
            (r) => `
          <div class="vendor-note-item">
            <b>${r.name} -</b> ${r.summary}
            ${
              r.gaps.length
                ? `<div class="fw-gap-list">${r.gaps
                    .map(
                      (g) => `
                  <div class="fw-gap-item">Gap: <i>${g.question}</i> - currently: "${g.chosen}"</div>
                  ${mitrePanel(guidanceForGapItem(g, s.answers, !s.quickMode), `fwgap-${r.id}-${g.id}`)}
                `
                    )
                    .join("")}</div>`
                : r.questionCount
                  ? `<div class="fw-gap-list"><div class="fw-gap-item">No gaps flagged in the ${r.name}-specific questions above.</div></div>`
                  : ""
            }
          </div>
        `
          )
          .join("")}
        <p class="scope-hint">This is pattern-based guidance from your own answers, not a certification audit or legal compliance determination.</p>
      </div>`
          : ""
      }

      <div class="priorities">
        <h3>Where to act first, ranked</h3>
        ${priorities
          .map(
            (p2, i) => `
          <div class="priority-item">
            <div class="priority-rank">${String(i + 1).padStart(2, "0")}</div>
            <div><b>${FUNC_DISPLAY[p2.fn]}:</b> ${p2.gap}</div>
          </div>
          ${mitrePanel(guidanceForGapItem(p2, s.answers, !s.quickMode), `gap-${p2.id}`)}
        `
          )
          .join("")}
      </div>
    `;
  }

  // ---------- results ----------
  async function renderResults() {
    const p = panel();
    p.innerHTML = `<div class="step-eyebrow">Synthesis - all functions considered jointly</div><h2 class="step-title">Calculating your reading…</h2>`;

    const funcScores = computeFuncScores(session);
    const overall = computeOverall(funcScores);
    const flags = computeFlags(session);
    const gapItems = computeGapItems(session);
    const priorities = computePriorities(session);
    const vendorNotes = matchedVendorNotes(session.answers);
    const frameworkRecs = computeFrameworkRecommendations(session);
    const currentGapTexts = gapItems.map((i) => i.gap);
    // §2: the in-progress save exists to resume an incomplete run - once
    // it's actually complete, there's nothing left to resume into.
    clearProgress();

    // ASSESSMENT-REPORT-DEPTH-BRIEF.md §5: resolve any "Other" free text
    // keyword-matching couldn't place, before the report's first paint -
    // same reasoning as the history fetch below, this is data the initial
    // render needs, not a progressive enhancement bolted on after.
    const otherTexts = await interpretUnresolvedOtherTexts(collectUnresolvedOtherTexts(session.answers));

    let prevRun = null,
      historyCount = 0;
    try {
      const lr = await storage.list("runs:", false);
      if (lr && lr.keys && lr.keys.length) {
        historyCount = lr.keys.length;
        const gets = await Promise.all(lr.keys.map((k) => storage.get(k, false).catch(() => null)));
        const runs = gets
          .filter(Boolean)
          .map((g) => JSON.parse(g.value))
          .sort((a, b) => a.ts - b.ts);
        if (runs.length) prevRun = runs[runs.length - 1];
      }
    } catch (e) {
      /* storage unavailable - proceed without history */
    }

    let resolvedSincePrev = [],
      newSincePrev = [];
    if (prevRun && prevRun.gapTexts) {
      resolvedSincePrev = prevRun.gapTexts.filter((g) => !currentGapTexts.includes(g));
      newSincePrev = currentGapTexts.filter((g) => !prevRun.gapTexts.includes(g));
    }

    const runRecord = { ts: Date.now(), overall, gapTexts: currentGapTexts, industry: session.answers.industry };
    try {
      await storage.set(`runs:${runRecord.ts}`, JSON.stringify(runRecord), false);
    } catch (e) {
      /* ignore save failure */
    }

    const delta = prevRun ? overall - prevRun.overall : null;

    p.innerHTML = `
      <div class="step-eyebrow">Synthesis - all functions considered jointly</div>
      <h2 class="step-title">Health Reading</h2>
      <p class="step-sub">Assessed against: NIST CSF 2.0 + CIS Controls v8${FRAMEWORKS.filter((f) => session.answers[f.id]).map((f) => " + " + f.name).join("")}${session.answers.industry ? " · " + INDUSTRIES.find((i) => i.id === session.answers.industry).label : ""}</p>

      <div class="report-meta-fields">
        <div class="field">
          <label>Company / firm name <span class="opt-tag">optional</span></label>
          <input type="text" id="reportCompanyName" placeholder="e.g. Acme Corp" value="${escapeHtml(session.answers.companyName || "")}">
        </div>
        <div class="field">
          <label>Report requested by <span class="opt-tag">optional</span></label>
          <input type="text" id="reportRequestedBy" placeholder="e.g. Jane Smith, CISO" value="${escapeHtml(session.answers.reportRequestedBy || "")}">
        </div>
      </div>

      ${
        prevRun
          ? `
      <div class="delta-box">
        <h3>Change since your last assessment (${new Date(prevRun.ts).toLocaleDateString()})</h3>
        <div class="delta-score ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : ""}${delta}% overall</div>
        ${resolvedSincePrev.length ? `<div class="delta-resolved"><b>Resolved:</b> ${resolvedSincePrev.length} item(s) closed since last time</div>` : ""}
        ${newSincePrev.length ? `<div class="delta-new"><b>New:</b> ${newSincePrev.length} item(s) newly flagged</div>` : ""}
      </div>`
          : ""
      }

      ${reportBodyHtml({ session, funcScores, overall, flags, vendorNotes, frameworkRecs, priorities, otherTexts })}

      <div class="note-box">
        <b>About this report -</b> the flags and priority list above are produced by a deterministic rules
        engine, tested and running the same way for every assessment - nothing above this line depends on a
        live API call, and it renders instantly and for free, same as always.
        <br><br>
        The "Get AI-Enhanced Insights" button below is a separate, opt-in second pass: a live check of your
        named vendors/products (EDR, email security, hosting, cloud, and the rest of the snapshot above)
        against CISA's Known Exploited Vulnerabilities catalog and NVD's own CVE database for anything current
        the rules engine can't know by nature, plus a look at this specific combination of answers for anything
        genuinely outside a fixed rule set. It calls the Claude API, so it's triggered explicitly rather than
        automatically - the report above is already complete without it.
        <br><br>
        This run was just saved using Claude's artifact storage (private to your account) - that's what powers
        the history/delta view above. That storage is specific to this Claude environment; the production
        deployment needs a real database (e.g., Supabase) doing the same job.
      </div>

      <div class="ai-insights-section">
        <div class="ai-insights-intro">
          <div>
            <h3>AI-Enhanced Insights <span class="ai-badge">AI-generated</span></h3>
            <p class="body-text">A live check of your named vendors against current CVE data, plus a second pass for anything this specific answer combination raises that the rules engine above didn't anticipate.</p>
          </div>
          <button id="aiInsightsBtn">Get AI-Enhanced Insights ✨</button>
        </div>
        <div id="aiInsightsBody"></div>
      </div>

      <div class="nav">
        <button id="backBtn2">← Review answers</button>
        <button id="exportPdfBtn">Download as PDF ↓</button>
        <a id="viewHistoryBtn" href="${pathForTab("history")}">View history (${historyCount + 1}) →</a>
      </div>
    `;
    p.querySelectorAll(".acc-head").forEach((el) => {
      el.addEventListener("click", () => el.parentElement.classList.toggle("open"));
    });
    document.getElementById("reportCompanyName").addEventListener("input", (e) => {
      session.answers.companyName = e.target.value;
    });
    document.getElementById("reportRequestedBy").addEventListener("input", (e) => {
      session.answers.reportRequestedBy = e.target.value;
    });
    document.getElementById("backBtn2").addEventListener("click", () => {
      ui.phase = "wizard";
      ui.categoryIndex = FUNCTIONS.length - 1;
      renderRail();
      renderAssessmentCategory();
    });
    wireNavLink(document.getElementById("viewHistoryBtn"), "history");
    document.getElementById("exportPdfBtn").addEventListener("click", () => {
      buildAssessmentPdf({ session, funcScores, overall, flags, priorities, vendorNotes, frameworkRecs });
    });
    document.getElementById("aiInsightsBtn").addEventListener("click", () =>
      requestAiInsights({ session, overall, verdict: verdictLabel(overall), flags, priorities, vendorNotes, frameworkRecs })
    );
  }

  // ---------- ASSESSMENT-EXPERIENCE-BRIEF.md §6: Sample Report ----------
  // "A recruiter clicking 'See a Sample Report' should see full depth
  // instantly - vendor notes, MITRE mapping, AI-enhanced insights, the PDF
  // export - with zero clicks and zero wait." The deterministic portion
  // below runs the fixed SAMPLE_ANSWERS through the exact same scoring/
  // flags/vendor-notes/framework-guidance functions renderResults() uses
  // (via the shared reportBodyHtml() above), so it can never silently drift
  // out of sync with how a real report is produced. Only AI-Enhanced
  // Insights is static (SAMPLE_AI_INSIGHTS) - rendered through the same
  // aiInsightCardsHtml() formatter a live response would use, just without
  // ever calling the API, so the sample stays instant and free to view.
  function renderSampleReport() {
    const p = panel();
    const sampleSession = createSessionState();
    Object.assign(sampleSession.answers, SAMPLE_ANSWERS);

    const funcScores = computeFuncScores(sampleSession);
    const overall = computeOverall(funcScores);
    const flags = computeFlags(sampleSession);
    const priorities = computePriorities(sampleSession);
    const vendorNotes = matchedVendorNotes(sampleSession.answers);
    const frameworkRecs = computeFrameworkRecommendations(sampleSession);

    p.innerHTML = `
      <div class="sample-banner"><b>Sample</b>&nbsp;This is example data from a fixed, realistic answer set - not a real assessment result.</div>
      <div class="step-eyebrow">Synthesis - all functions considered jointly</div>
      <h2 class="step-title">Health Reading</h2>
      <p class="step-sub">Assessed against: NIST CSF 2.0 + CIS Controls v8${FRAMEWORKS.filter((f) => sampleSession.answers[f.id]).map((f) => " + " + f.name).join("")}${sampleSession.answers.industry ? " · " + INDUSTRIES.find((i) => i.id === sampleSession.answers.industry).label : ""}</p>

      ${reportBodyHtml({ session: sampleSession, funcScores, overall, flags, vendorNotes, frameworkRecs, priorities })}

      <div class="note-box">
        <b>About this report -</b> everything above is produced by running a fixed sample answer set through
        this site's real, deterministic scoring engine - the same one every actual assessment uses - so this
        sample stays accurate as that engine evolves, rather than being a separately-maintained mockup.
      </div>

      <div class="ai-insights-section">
        <div class="ai-insights-intro">
          <div>
            <h3>AI-Enhanced Insights <span class="ai-badge">AI-generated</span></h3>
            <p class="body-text">A static example of what the live, opt-in "Get AI-Enhanced Insights" pass on a real report looks like, shown here without an actual API call so the sample stays instant and free to view.</p>
          </div>
        </div>
        <div>${aiInsightCardsHtml(SAMPLE_AI_INSIGHTS)}</div>
      </div>

      <div class="nav">
        <button id="sampleBackBtn">← Back to assessment options</button>
        <button id="samplePdfBtn">Download as PDF ↓</button>
      </div>
    `;
    p.querySelectorAll(".acc-head").forEach((el) => {
      el.addEventListener("click", () => el.parentElement.classList.toggle("open"));
    });
    document.getElementById("sampleBackBtn").addEventListener("click", () => {
      ui.phase = "landing";
      renderRail();
      renderLanding();
    });
    document.getElementById("samplePdfBtn").addEventListener("click", () => {
      buildAssessmentPdf({ session: sampleSession, funcScores, overall, flags, priorities, vendorNotes, frameworkRecs });
    });
  }

  // ---------- ASSESSMENT-REPORT-DEPTH-BRIEF.md §5: "Other" free text ----------
  // Fields where "Other" answers a genuinely structured, closed question
  // (a category/function list) rather than naming a vendor/product - vendor
  // "Other" text is already handled by the existing matchedVendorNotes()
  // substring match plus the separate, already-opt-in AI-Insights recency
  // lookup, so it isn't duplicated here.
  const OTHER_TEXT_MULTISELECT_FIELDS = [
    { fieldId: "outsourcedFunctionBreakdown", label: "Which specific functions are handled by your outsourced provider(s)?" },
    { fieldId: "partialOutsourceFunctions", label: "Which specific functions are outsourced?" },
    { fieldId: "mixedOtherProviderDetail", label: "Which specific functions do those other outsourced providers handle?" },
    { fieldId: "dayToDay", label: "How is cybersecurity managed day to day?" },
  ];
  const OTHER_TEXT_SELECT_FIELDS = [
    { fieldId: "networkArch", label: "How would you describe your network architecture?" },
    { fieldId: "devsecopsMaturity", label: "How would you describe your DevSecOps practice?" },
  ];

  // Keyword matching (other-text-match.js) already runs the moment each
  // field is answered, converting a match into the real structured option
  // immediately - anything still sitting here as free text at report time
  // is exactly the "no reasonable match" case the brief scopes the AI
  // fallback to.
  function collectUnresolvedOtherTexts(answers) {
    const items = [];
    for (const f of OTHER_TEXT_MULTISELECT_FIELDS) {
      const selected = answers[f.fieldId];
      const text = answers[f.fieldId + "__otherText"];
      if (Array.isArray(selected) && selected.includes(OTHER_VALUE) && text && text.trim()) {
        items.push({ fieldLabel: f.label, freeText: text.trim() });
      }
    }
    for (const f of OTHER_TEXT_SELECT_FIELDS) {
      if (answers[f.fieldId + "__isOther"] && answers[f.fieldId] && String(answers[f.fieldId]).trim()) {
        items.push({ fieldLabel: f.label, freeText: String(answers[f.fieldId]).trim() });
      }
    }
    return items;
  }

  // Fires automatically as part of building the report - independent of
  // the separate, opt-in "Get AI-Enhanced Insights" button below, per the
  // brief ("it fires automatically when needed... The report should never
  // simply ignore or silently drop 'Other' text"). A failure here degrades
  // to showing the raw typed text unexplained, never to hiding it.
  async function interpretUnresolvedOtherTexts(items) {
    if (!items.length) return items.map((it) => ({ ...it, interpretation: null }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch("/.netlify/functions/other-text-interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`other-text-interpret returned ${res.status}`);
      const result = await res.json();
      const byIndex = new Map((result.interpretations || []).map((r) => [r.index, r.interpretation]));
      return items.map((it, i) => ({ ...it, interpretation: byIndex.get(i) || null }));
    } catch {
      return items.map((it) => ({ ...it, interpretation: null }));
    }
  }

  function otherTextSectionHtml(resolvedOtherTexts) {
    if (!resolvedOtherTexts.length) return "";
    return `
      <div class="flags">
        <h3>Additional context you provided</h3>
        ${resolvedOtherTexts
          .map(
            (it) => `
          <div class="vendor-note-item">
            <b>${escapeHtml(it.fieldLabel)} -</b> "${escapeHtml(it.freeText)}"
            ${it.interpretation ? `<br>${escapeHtml(it.interpretation)}` : `<br><span class="scope-hint">Noted, but not incorporated into the scoring or findings above.</span>`}
          </div>
        `
          )
          .join("")}
      </div>`;
  }

  // ---------- AI-Enhanced Insights (AI-RAG-HYBRID-BRIEF.md) ----------
  // Opt-in only - never called automatically on assessment completion. The
  // deterministic report above has already fully rendered before this can
  // even be triggered, so any failure here (network error, function
  // timeout, non-200 response, malformed JSON) is caught and scoped to
  // just #aiInsightsBody - it must never affect the rest of the page.
  function namedVendorsFor(answers) {
    const mspProvider =
      answers.outsourcedMspName || answers.fullMspProviderName || answers.mixedMspProviderName || answers.mdrMspProviderName || answers.mdrProviderName || answers.msspProviderName || "";
    return {
      "antivirus": answers.antivirusVendor || "",
      "EDR": answers.edrVendor || "",
      "email security": answers.emailSecurityVendor || "",
      "DLP": answers.dlpVendor || "",
      "SD-WAN": answers.sdwanVendor || "",
      "edge device / firewall": answers.edgeDeviceVendor || "",
      "hosting provider": answers.hostingProvider || "",
      "cloud provider": answers.cloudProvider || "",
      "security awareness / LMS": answers.awarenessLms || "",
      "OT/ICS platform": answers.otVendor || "",
      "MSP/MDR/MSSP provider": mspProvider,
    };
  }

  // Everything rendered here originated as a Claude API response, but that
  // response is built from a prompt containing this person's own free-text
  // answers (vendor "Other" fields, company name) submitted directly to a
  // public endpoint (netlify/functions/ai-insights.mts) that has no way to
  // know those values came from this site's own UI rather than a raw POST,
  // so this isn't purely a self-XSS case. escapeHtml() (defined above) is
  // used the same way any other server-sourced content would need.
  function safeHttpUrl(url) {
    try {
      const u = new URL(url, location.href);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
    } catch {
      return null;
    }
  }

  function aiInsightCardsHtml(result) {
    const hasAnything = (result.recency && result.recency.length) || (result.longTail && result.longTail.length) || (result.narrative && result.narrative.trim());
    if (!hasAnything) {
      return `<p class="body-text">No additional live findings beyond what's already in the report above - your named vendors/products didn't turn up anything current, and this specific answer combination didn't surface a pattern outside the rules engine's coverage.</p>`;
    }
    const recencyHtml = (result.recency || [])
      .map((r) => {
        const safeUrl = r.url ? safeHttpUrl(r.url) : null;
        return `
        <div class="vendor-note-item"><b>${escapeHtml(r.vendorOrProduct)} -</b> ${escapeHtml(r.finding)} <span class="ai-source">(${escapeHtml(r.source)}${safeUrl ? ` - <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">source</a>` : ""})</span></div>`;
      })
      .join("");
    const longTailHtml = (result.longTail || [])
      .map((l) => `<div class="vendor-note-item"><b>${escapeHtml(l.finding)}</b><br>${escapeHtml(l.why)}</div>`)
      .join("");
    return `
      ${recencyHtml ? `<h4>Live vendor/product check</h4>${recencyHtml}` : ""}
      ${longTailHtml ? `<h4>Beyond the rules engine</h4>${longTailHtml}` : ""}
      ${result.narrative && result.narrative.trim() ? `<h4>Synthesis</h4><p class="body-text">${escapeHtml(result.narrative)}</p>` : ""}
    `;
  }

  async function requestAiInsights({ session: s, overall, verdict, flags, priorities, vendorNotes, frameworkRecs }) {
    const btn = document.getElementById("aiInsightsBtn");
    const body = document.getElementById("aiInsightsBody");
    if (!btn || !body) return;
    btn.disabled = true;
    btn.textContent = "Getting insights…";
    body.innerHTML = `<p class="body-text">Checking your named vendors against current CVE data and looking for anything the rules engine above didn't anticipate…</p>`;

    const payload = {
      profile: {
        industry: s.answers.industry ? INDUSTRIES.find((i) => i.id === s.answers.industry)?.label || s.answers.industry : "",
        regions: (s.answers.regions || []).map((id) => REGIONS.find((r) => r.id === id)?.label || id),
        frameworks: FRAMEWORKS.filter((f) => s.answers[f.id]).map((f) => f.name),
        overall,
        verdict,
      },
      namedVendors: namedVendorsFor(s.answers),
      findings: {
        flags: flags.map((f) => ({ text: f.text })),
        priorities: priorities.map((p2) => ({ fn: FUNC_DISPLAY[p2.fn], gap: p2.gap })),
        vendorNotes: vendorNotes.map((v) => ({ vendor: v.vendor, note: v.note })),
        frameworkRecs: frameworkRecs.map((r) => ({ name: r.name, summary: r.summary, gaps: r.gaps })),
      },
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch("/.netlify/functions/ai-insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`ai-insights returned ${res.status}`);
      const result = await res.json();
      body.innerHTML = aiInsightCardsHtml(result);
      btn.remove();
    } catch (e) {
      body.innerHTML = `<p class="body-text">AI insights unavailable right now - the rest of this report is unaffected. You can try again below.</p>`;
      btn.disabled = false;
      btn.textContent = "Get AI-Enhanced Insights ✨";
    }
  }

  // Shared by the public renderCurrentPhase() entry point and §2's
  // resumeFromSave() - both need to render whatever ui.phase currently is.
  function dispatchPhase() {
    if (ui.phase === "landing") renderLanding();
    else if (ui.phase === "scope") renderScope();
    else if (ui.phase === "profile") renderProfileScreen();
    else if (ui.phase === "wizard") renderAssessmentCategory();
    else if (ui.phase === "sample") renderSampleReport();
    else renderResults();
  }

  return {
    get phase() {
      return ui.phase;
    },
    session,
    renderRail,
    renderScope,
    renderProfileScreen,
    renderAssessmentCategory,
    renderResults,
    requestLanding,
    // entry point used by renderActiveTab() when switching into the assessment tab
    renderCurrentPhase() {
      updateSerial();
      renderRail();
      dispatchPhase();
    },
  };
}
