// The assessment UI: mode choice -> scope -> setup screens -> six scored
// sections -> report. Question logic lives in ../engine (graph traversal,
// statuses, scoring, report model); this file only renders and wires input.
//
// Accessibility: every answer is a native radio button or checkbox inside a
// <fieldset> with a <legend>, so it works with a keyboard and screen
// readers; screens re-render after each answer, so focus is restored to the
// same control (a11y.js preserveFocus); accordions are keyboard-operable.
import { visibleNodes, isNodeHidden } from "../engine/graph.js";
import { recordAnswer, createSessionState } from "../engine/state.js";
import { INDUSTRIES } from "../data/industries.js";
import { REGIONS } from "../data/regions.js";
import { COUNTRIES } from "../data/countries.js";
import { FRAMEWORKS } from "../data/frameworks.js";
import { PROFILE_SCREENS } from "../data/profile-flow.js";
import { ASSESSMENT_FLOW } from "../data/assessment-flow.js";
import { FUNCTIONS, FUNC_DISPLAY, FUNC_REF } from "../data/categories.js";
import { UNKNOWN, NOT_APPLICABLE, METHODOLOGY_VERSION } from "../data/controls.js";
import { OTHER as OTHER_VALUE } from "../data/vendors.js";
import { SAMPLE_SCENARIOS, DEFAULT_SAMPLE } from "../data/sample-scenario.js";
import { buildReport } from "../engine/report-model.js";
import { effectiveState, isAnswered } from "../engine/answers.js";
import { migrateAnswers } from "../engine/migrate.js";
import { buildAssessmentPdf } from "../engine/pdf-report.js";
import { actionsToCsv, actionsToJson } from "../engine/actions.js";
import { loadTracking, updateTracking } from "../engine/action-tracking.js";
import { saveProgress, loadProgress, clearProgress, hasSeenSaveNotice, markSaveNoticeSeen, watchExternalChanges } from "../engine/local-save.js";
import { listRuns, getRun, saveRun, attachAiResult, sameAnswers, summarizeReport, newRunId } from "../engine/run-history.js";
import { buildInsightsPayload } from "../engine/ai-payload.js";
import { AI_CONSENT_VERSION, hasAiConsent, recordAiConsent } from "../engine/ai-consent.js";
import { matchOtherText } from "../engine/other-text-match.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./html-safety.js";
import { reportBodyHtml } from "./report-view.js";
import { consentHtml, aiResultHtml, aiErrorText } from "./ai-panel.js";
import { wireAccordions, preserveFocus, announce } from "./a11y.js";
import { trackEvent } from "./privacy.js";

const e = escapeHtml;

const SECTION_TRANSITIONS = {
  profile: "Org profile done - let's talk about your team.",
  team: "Team structure done - now the technology itself.",
  infra: "Infrastructure covered - a couple of adjacent areas next.",
  containerization: "Containers and virtualization done - almost through setup.",
  devsecops: "Nearly there - just the last setup sections left.",
  ai: "AI section done.",
  ot: "Setup's done. Now the six scored sections.",
  Govern: "Governance done - next, what you actually have to protect.",
  Identify: "Identify done - now the safeguards standing in an attacker's way.",
  Protect: "Protect done - how would you even know if something went wrong?",
  Detect: "Detect done - the first hour of a real incident, next.",
  Respond: "Respond done - last section: getting back to normal.",
};

const ASSESSMENT_PATH = "/assessment";
const ASSESSMENT_SAMPLE_PATH = "/assessment/sample";
function currentPathIsSample() {
  return location.pathname.replace(/\/+$/, "") === ASSESSMENT_SAMPLE_PATH;
}

// Parses a radio value back to its stored type: graded options are numbers,
// "Not sure" / "Not applicable" are strings.
function parseScoredValue(raw) {
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createAssessmentController({ getPanel, getRail, icon, pathForTab, wireNavLink }) {
  const session = createSessionState();
  const ui = { phase: "landing", screenIndex: 0, categoryIndex: 0, transitionNote: null, resultRunId: null, sampleId: DEFAULT_SAMPLE };
  // The report on screen (results or example) and its AI state.
  let current = null; // { report, run, ai, aiError, migrationNotes, recalculated }
  let lastAi = null; // most recent AI result this visit, to show as out of date after edits
  let saveWarningShown = false;
  let autosavePaused = false;

  const panel = () => getPanel();

  function resetSession() {
    Object.keys(session.answers).forEach((k) => delete session.answers[k]);
    session.asked = [];
    session.dedupe = {};
    session.quickMode = false;
    ui.resultRunId = null;
    autosavePaused = false;
  }

  // ---------- saving in-progress answers ----------
  function persistProgress() {
    if (!["scope", "profile", "wizard"].includes(ui.phase) || autosavePaused) return;
    const result = saveProgress(session, { phase: ui.phase, screenIndex: ui.screenIndex, categoryIndex: ui.categoryIndex });
    if (result.ok) {
      if (Object.keys(session.answers).length > 0 && !hasSeenSaveNotice()) {
        showToast("Saved in this browser only - you can close the tab and resume here later, but not on another device.");
        markSaveNoticeSeen();
      }
    } else if (!saveWarningShown) {
      saveWarningShown = true;
      showToast(result.reason === "quota" ? "Your progress can't be saved: this browser's storage for the site is full. Clear old reports in History to free space." : "Your progress isn't being saved (private browsing or site storage turned off). Finish in this tab, or it will be lost.");
    }
  }

  // Another tab of this browser saved (or cleared) the same in-progress
  // assessment. Pause saving here so the two tabs don't overwrite each other,
  // and let the visitor choose.
  let conflictData = null;
  watchExternalChanges((data) => {
    if (!["scope", "profile", "wizard"].includes(ui.phase)) return;
    autosavePaused = true;
    conflictData = data;
    showConflictBanner();
  });
  // Re-shown after every re-render while saving is paused.
  function showConflictBanner() {
    const p = panel();
    const data = conflictData;
    if (!p || document.getElementById("tabConflict")) return;
    const bar = document.createElement("div");
    bar.id = "tabConflict";
    bar.className = "resume-banner";
    bar.setAttribute("role", "alert");
    bar.innerHTML = `
      <div class="resume-banner-text"><b>This assessment was changed in another tab.</b> Saving here is paused so the two don't overwrite each other.</div>
      <div class="resume-banner-actions">
        ${data ? `<button type="button" id="loadOtherTab">Load the other tab's answers</button>` : ""}
        <button type="button" class="primary" id="keepThisTab">Keep this tab's answers</button>
      </div>`;
    p.prepend(bar);
    const load = document.getElementById("loadOtherTab");
    if (load) load.addEventListener("click", () => resumeFromSave(loadProgress()));
    document.getElementById("keepThisTab").addEventListener("click", () => {
      autosavePaused = false;
      bar.remove();
      persistProgress();
    });
  }

  // ---------- progress ----------
  function visibleProfileScreens() {
    return PROFILE_SCREENS.filter((s) => (!s.skipIf || !s.skipIf(session.answers)) && (!session.quickMode || visibleNodes(s.flow, session).length > 0));
  }
  function visibleCategories() {
    return FUNCTIONS.filter((fn) => !session.quickMode || categoryQuestions(fn).length > 0);
  }
  function allKnownNodes() {
    return [...PROFILE_SCREENS.flatMap((s) => [...s.flow.index.values()]), ...ASSESSMENT_FLOW.index.values()];
  }
  function answeredCount() {
    const eff = effectiveState(session).answers;
    return allKnownNodes().filter((n) => isAnswered(eff[n.id])).length;
  }
  function progressMetaHtml() {
    const screens = visibleProfileScreens();
    const total = screens.length + visibleCategories().length;
    let position = 1;
    if (ui.phase === "profile") position = screens.indexOf(PROFILE_SCREENS[ui.screenIndex]) + 1;
    else if (ui.phase === "wizard") position = screens.length + visibleCategories().indexOf(FUNCTIONS[ui.categoryIndex]) + 1;
    const skipped = session.quickMode ? 0 : allKnownNodes().filter((n) => isNodeHidden(n, session)).length;
    return `
      <div class="progress-meta"><b>Section ${position} of ${total}</b> · ${answeredCount()} answered${session.quickMode ? " · Quick screening" : ""}</div>
      ${skipped > 0 ? `<p class="skip-note">Based on your answers, ${skipped} question${skipped === 1 ? " doesn't" : "s don't"} apply to your setup and won't be asked.</p>` : ""}`;
  }
  function transitionNoteHtml() {
    if (!ui.transitionNote) return "";
    const text = ui.transitionNote;
    ui.transitionNote = null;
    return `<p class="section-transition">${e(text)}</p>`;
  }

  function nextScreenIndex(from) {
    const vis = visibleProfileScreens();
    for (let i = from + 1; i < PROFILE_SCREENS.length; i++) if (vis.includes(PROFILE_SCREENS[i])) return i;
    return PROFILE_SCREENS.length;
  }
  function prevScreenIndex(from) {
    const vis = visibleProfileScreens();
    for (let i = from - 1; i >= 0; i--) if (vis.includes(PROFILE_SCREENS[i])) return i;
    return -1;
  }
  function nextCategoryIndex(from) {
    const vis = visibleCategories();
    for (let i = from + 1; i < FUNCTIONS.length; i++) if (vis.includes(FUNCTIONS[i])) return i;
    return FUNCTIONS.length;
  }
  function prevCategoryIndex(from) {
    const vis = visibleCategories();
    for (let i = from - 1; i >= 0; i--) if (vis.includes(FUNCTIONS[i])) return i;
    return -1;
  }

  // ---------- rail ----------
  function renderRail() {
    const rail = getRail();
    if (!rail) return;
    if (ui.phase === "landing" || ui.phase === "sample") {
      rail.innerHTML = "";
      rail.classList.add("rail-empty");
      return;
    }
    rail.classList.remove("rail-empty");
    const screens = visibleProfileScreens();
    const cats = visibleCategories();
    const items = ["Scope", ...screens.map((s) => s.title), ...cats.map((fn) => FUNC_DISPLAY[fn]), "Report"];
    let activeIdx;
    if (ui.phase === "scope") activeIdx = 0;
    else if (ui.phase === "profile") activeIdx = 1 + Math.max(0, screens.indexOf(PROFILE_SCREENS[ui.screenIndex]));
    else if (ui.phase === "wizard") activeIdx = 1 + screens.length + Math.max(0, cats.indexOf(FUNCTIONS[ui.categoryIndex]));
    else activeIdx = items.length - 1;
    rail.innerHTML =
      '<div class="rail-line" aria-hidden="true"></div>' +
      '<ol class="rail-dots" aria-label="Assessment progress">' +
      items
        .map((label, i) => `<li class="node${i < activeIdx ? " done" : ""}${i === activeIdx ? " active" : ""}"${i === activeIdx ? ' aria-current="step"' : ""}><div class="dot" aria-hidden="true"></div><div class="label">${e(label)}</div></li>`)
        .join("") +
      "</ol>" +
      `<div class="rail-active-label" aria-hidden="true">${e(items[activeIdx])}</div>`;
  }

  // ---------- landing ----------
  function startFresh(quickMode) {
    resetSession();
    clearProgress();
    session.quickMode = quickMode;
    trackEvent("assessment_start", { mode: quickMode ? "quick" : "full" });
    ui.phase = "scope";
    renderRail();
    renderScope();
    focusHeading();
  }

  function resumeFromSave(saved) {
    if (!saved) return;
    resetSession();
    Object.assign(session.answers, saved.answers || {});
    session.asked = Array.isArray(saved.asked) ? saved.asked : [];
    session.dedupe = saved.dedupe && typeof saved.dedupe === "object" ? saved.dedupe : {};
    session.quickMode = Boolean(saved.quickMode);
    const s = saved.ui || {};
    ui.phase = ["scope", "profile", "wizard"].includes(s.phase) ? s.phase : "scope";
    ui.screenIndex = Number.isInteger(s.screenIndex) ? s.screenIndex : 0;
    ui.categoryIndex = Number.isInteger(s.categoryIndex) ? s.categoryIndex : 0;
    if (saved.migrationNotes?.length) showToast(saved.migrationNotes.join(" "));
    renderRail();
    dispatchPhase();
  }

  function requestLanding() {
    const midAssessment = ["scope", "profile", "wizard"].includes(ui.phase) && Object.keys(session.answers).length > 0;
    if (midAssessment && !confirm("Leave this assessment? Your answers so far stay saved in this browser, and you can resume from the Assessment page.")) return false;
    resetSession();
    if (currentPathIsSample()) history.pushState({}, "", ASSESSMENT_PATH);
    ui.phase = "landing";
    ui.screenIndex = 0;
    ui.categoryIndex = 0;
    ui.transitionNote = null;
    renderRail();
    renderLanding();
    return true;
  }

  function lastReportRun() {
    return listRuns().filter((r) => r.answers).pop() || null;
  }

  function renderLanding() {
    const p = panel();
    const saved = loadProgress();
    const lastRun = saved ? null : lastReportRun();
    const lastLabel = lastRun ? (lastRun.summary ? `${lastRun.summary.verdict.label}${lastRun.summary.coverage !== null && lastRun.mode === "full" ? `, ${lastRun.summary.coverage}% coverage` : ""}` : `${lastRun.legacyOverall}% under the earlier method`) : "";
    p.innerHTML = `
      <div class="step-eyebrow">Assessment</div>
      <h2 class="step-title" tabindex="-1">Choose how to start</h2>
      <p class="step-sub">A structured self-assessment against NIST CSF 2.0 and CIS Controls v8.1, built from your own answers. It runs in your browser: your answers aren't sent anywhere unless you choose to request AI insights at the end. <a href="/methodology" class="inline-link">How it's scored</a> · <a href="/privacy" class="inline-link">Privacy</a></p>
      ${
        saved
          ? `<div class="resume-banner">
               <div class="resume-banner-text">You have an <b>in-progress ${saved.quickMode ? "Quick screening" : "Full assessment"}</b> saved in this browser.</div>
               <div class="resume-banner-actions">
                 <button type="button" id="discardResumeBtn">Discard it</button>
                 <button type="button" class="primary" id="resumeBtn">Resume →</button>
               </div>
             </div>`
          : lastRun
            ? `<div class="resume-banner">
                 <div class="resume-banner-text">Your <b>last report</b> (${e(new Date(lastRun.ts).toLocaleDateString())}, ${e(lastLabel)}) is saved in this browser.</div>
                 <div class="resume-banner-actions"><button type="button" class="primary" id="viewLastReportBtn">View report →</button></div>
               </div>`
            : ""
      }
      <div class="mode-grid">
        <button type="button" class="mode-card" id="modeQuick">
          <span class="mode-card-time">${icon("clock")} 14 questions</span>
          <span class="mode-card-title">Quick screening</span>
          <span class="mode-card-body">Checks 11 core controls across all six areas and flags critical gaps. A screening, not a full reading - you can continue into the Full assessment afterwards without re-answering.</span>
          <span class="mode-card-cta">Start screening →</span>
        </button>
        <button type="button" class="mode-card" id="modeFull">
          <span class="mode-card-time">${icon("clock")} Adapts to your setup</span>
          <span class="mode-card-title">Full assessment</span>
          <span class="mode-card-body">Every question that applies to your organization, with coverage and completeness by area, a ranked action plan, compliance considerations and product-specific notes.</span>
          <span class="mode-card-cta">Start full assessment →</span>
        </button>
        <button type="button" class="mode-card" id="modeSample">
          <span class="mode-card-title">See example reports</span>
          <span class="mode-card-body">Two fictional organizations - an IT services firm and a SaaS company - run through the real scoring engine. Nothing to fill in.</span>
          <span class="mode-card-cta">View examples →</span>
        </button>
      </div>`;
    document.getElementById("modeQuick").addEventListener("click", () => startFresh(true));
    document.getElementById("modeFull").addEventListener("click", () => startFresh(false));
    document.getElementById("modeSample").addEventListener("click", () => {
      ui.phase = "sample";
      if (!currentPathIsSample()) history.pushState({}, "", ASSESSMENT_SAMPLE_PATH);
      renderRail();
      renderSampleReport();
      focusHeading();
    });
    const resumeBtn = document.getElementById("resumeBtn");
    if (resumeBtn) resumeBtn.addEventListener("click", () => resumeFromSave(saved));
    const viewLastBtn = document.getElementById("viewLastReportBtn");
    if (viewLastBtn) viewLastBtn.addEventListener("click", () => openRun(lastRun.id) && (renderRail(), dispatchPhase()));
    const discardBtn = document.getElementById("discardResumeBtn");
    if (discardBtn)
      discardBtn.addEventListener("click", () => {
        if (!confirm("Discard the saved in-progress assessment? This can't be undone.")) return;
        clearProgress();
        renderLanding();
      });
  }

  function focusHeading() {
    const h = panel()?.querySelector(".step-title");
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus({ preventScroll: false });
    }
  }

  // ---------- scope ----------
  function updateSerial() {
    const el = document.getElementById("serial");
    if (!el) return;
    const extra = FRAMEWORKS.filter((f) => session.answers[f.id]).map((f) => f.name);
    el.textContent = `SIMPLIFIEDCS · NIST CSF 2.0 · CIS Controls v8.1${extra.length ? " + " + extra.join(" + ") : ""}`;
  }

  function renderScope() {
    persistProgress();
    const restore = preserveFocus(panel());
    const p = panel();
    const quick = session.quickMode;
    const ind = session.answers.industry ? INDUSTRIES.find((i) => i.id === session.answers.industry) : null;
    const selectedRegions = session.answers.regions || [];
    const selectedCountries = session.answers.countries || [];
    const reasons = {};
    const addReason = (fid, r) => (reasons[fid] = [...(reasons[fid] || []), r]);
    if (ind?.topPriority) addReason(ind.topPriority, { type: "top", label: `Commonly the first framework for ${ind.label}` });
    (ind?.alsoRelevant || []).forEach((fid) => addReason(fid, { type: "industry", label: `Commonly relevant for ${ind.label}` }));
    selectedRegions.forEach((rid) => {
      const r = REGIONS.find((x) => x.id === rid);
      if (r) r.frameworks.forEach((fid) => addReason(fid, { type: "region", label: `Relevant for ${r.label} operations` }));
    });
    const highlightedFw = FRAMEWORKS.filter((f) => reasons[f.id]);
    const otherFw = FRAMEWORKS.filter((f) => !reasons[f.id]);
    const fwCheck = (f) => `
      <label class="fw-card ${session.answers[f.id] ? "selected" : ""}">
        <input type="checkbox" class="sr-only" data-fw="${f.id}" data-fkey="fw-${f.id}" ${session.answers[f.id] ? "checked" : ""}>
        <span class="fw-card-text">
          <span class="fw-name">${e(f.name)}</span>
          ${(reasons[f.id] || []).map((r) => `<span class="priority-tag">${e(r.label)}</span>`).join("")}
          <span class="fw-desc">${e(f.desc)}</span>
        </span>
        <span class="checkbox" aria-hidden="true"></span>
      </label>`;

    p.innerHTML = `
      <div class="step-eyebrow">Scope · ${quick ? "Quick screening" : "Full assessment"}</div>
      <h2 class="step-title" tabindex="-1">Before we start</h2>
      <p class="step-sub">${quick ? "Quick screening needs just your industry here. Region and compliance-framework questions are part of the Full assessment." : "Every assessment is measured against NIST CSF 2.0 and CIS Controls v8.1. Add any compliance standards that apply - none are selected automatically."}</p>

      <fieldset class="scope-group">
        <legend class="fw-section-label">Industry <span class="req-tag">required</span></legend>
        <div class="industry-grid">
          ${INDUSTRIES.map(
            (i) => `<label class="industry-card ${session.answers.industry === i.id ? "selected" : ""}"><input type="radio" class="sr-only" name="industry" value="${i.id}" data-fkey="industry-${i.id}" ${session.answers.industry === i.id ? "checked" : ""}>${e(i.label)}</label>`
          ).join("")}
        </div>
      </fieldset>

      ${
        !ind || quick
          ? ""
          : ind.otDefault === "skip"
            ? `<div class="ot-skip-note">Based on <b>${e(ind.label)}</b>, we've assumed no dedicated OT/ICS environment and will skip those questions.
                 <label class="ot-override-label"><input type="checkbox" id="otOverrideCheck" data-fkey="otOverride" ${session.answers.otOverride ? "checked" : ""}> Include OT questions anyway</label></div>`
            : ind.otDefault === "likely"
              ? `<div class="ot-likely-note">OT/ICS environments are common in <b>${e(ind.label)}</b>, so those questions are included. Answer "No" if it doesn't apply.</div>`
              : ""
      }

      ${
        quick
          ? ""
          : `
      <fieldset class="scope-group">
        <legend class="fw-section-label">Where do you operate? <span class="opt-tag">optional</span></legend>
        <p class="scope-hint">Select every region you're registered or operate in - this highlights the frameworks commonly required there.</p>
        <div class="region-grid">
          ${REGIONS.map(
            (r) => `<label class="region-chip ${selectedRegions.includes(r.id) ? "selected" : ""}"><input type="checkbox" class="sr-only" data-region="${r.id}" data-fkey="region-${r.id}" ${selectedRegions.includes(r.id) ? "checked" : ""}><span class="checkbox" aria-hidden="true"></span>${e(r.label)}</label>`
          ).join("")}
        </div>
        ${selectedRegions.map((rid) => REGIONS.find((x) => x.id === rid)).filter(Boolean).map((r) => `<div class="region-note"><b>${e(r.label)}:</b> ${e(r.note)}</div>`).join("")}
        <details class="acc-details" ${selectedCountries.length ? "open" : ""}>
          <summary>Select specific countries <span class="opt-tag">${selectedCountries.length ? `${selectedCountries.length} selected` : "optional"}</span></summary>
          <div class="country-checklist">
            ${COUNTRIES.map((c) => `<label class="country-check-item"><input type="checkbox" data-country="${e(c)}" ${selectedCountries.includes(c) ? "checked" : ""}> ${e(c)}</label>`).join("")}
          </div>
        </details>
      </fieldset>

      <fieldset class="scope-group">
        <legend class="fw-section-label">Compliance frameworks <span class="opt-tag">optional</span></legend>
        <div class="fw-baseline"><b>Always included:</b> NIST CSF 2.0 + CIS Controls v8.1 (the reference this assessment is aligned to)</div>
        ${highlightedFw.map(fwCheck).join("")}
        <details class="acc-details" ${otherFw.some((f) => session.answers[f.id]) ? "open" : ""}>
          <summary>${otherFw.length} more standards</summary>
          ${otherFw.map(fwCheck).join("")}
        </details>
        <p class="scope-hint">Common patterns, not a legal determination - confirm exact obligations (for example NIS2 size and sector thresholds) with your regulatory counsel.</p>
      </fieldset>`
      }

      <div class="nav">
        <button type="button" id="backToLandingBtn">← Change assessment type</button>
        <button type="button" class="primary" id="scopeNext" ${session.answers.industry ? "" : "disabled"}>${session.answers.industry ? "Start →" : "Choose an industry to start"}</button>
      </div>`;

    p.querySelectorAll('input[name="industry"]').forEach((el) =>
      el.addEventListener("change", () => {
        session.answers.industry = el.value;
        renderScope();
      })
    );
    p.querySelectorAll("input[data-region]").forEach((el) =>
      el.addEventListener("change", () => {
        const set = new Set(session.answers.regions || []);
        el.checked ? set.add(el.dataset.region) : set.delete(el.dataset.region);
        session.answers.regions = [...set];
        renderScope();
      })
    );
    p.querySelectorAll("input[data-country]").forEach((el) =>
      el.addEventListener("change", () => {
        const set = new Set(session.answers.countries || []);
        el.checked ? set.add(el.dataset.country) : set.delete(el.dataset.country);
        session.answers.countries = [...set];
        persistProgress();
      })
    );
    p.querySelectorAll("input[data-fw]").forEach((el) =>
      el.addEventListener("change", () => {
        session.answers[el.dataset.fw] = el.checked;
        renderScope();
        updateSerial();
      })
    );
    const otCheck = document.getElementById("otOverrideCheck");
    if (otCheck) otCheck.addEventListener("change", () => ((session.answers.otOverride = otCheck.checked), renderScope()));
    document.getElementById("backToLandingBtn").addEventListener("click", () => {
      ui.phase = "landing";
      renderRail();
      renderLanding();
      focusHeading();
    });
    document.getElementById("scopeNext").addEventListener("click", () => {
      updateSerial();
      goToFirstScreen();
    });
    restore();
    if (autosavePaused) showConflictBanner();
  }

  function goToFirstScreen() {
    const idx = nextScreenIndex(-1);
    if (idx >= PROFILE_SCREENS.length) {
      ui.phase = "wizard";
      ui.categoryIndex = nextCategoryIndex(-1);
      renderRail();
      renderAssessmentCategory();
    } else {
      ui.phase = "profile";
      ui.screenIndex = idx;
      renderRail();
      renderProfileScreen();
    }
    focusHeading();
  }

  // ---------- setup screens ----------
  function optTag(node) {
    return node.required === false ? ' <span class="opt-tag">optional</span>' : "";
  }

  function fieldHtml(node) {
    const val = session.answers[node.id] ?? "";
    const id = node.id;
    if (node.type === "info") return `<div class="info-box">${e(node.text)}</div>`;
    if (node.type === "select") {
      const isOther = Boolean(node.allowOther && session.answers[id + "__isOther"]);
      const radio = (value, label) => `
        <label class="option ${(!isOther && val === value) || (isOther && value === OTHER_VALUE) ? "selected" : ""}">
          <input type="radio" class="sr-only" name="p-${id}" value="${e(value)}" data-fid="${id}" data-fkey="${id}:${e(value)}" ${(!isOther && val === value) || (isOther && value === OTHER_VALUE) ? "checked" : ""}>
          <span class="radio" aria-hidden="true"></span><span>${e(label)}</span>
        </label>`;
      return `
        <fieldset class="question">
          <legend>${e(node.text)}${optTag(node)}</legend>
          <div class="options">
            ${node.options.map((o) => radio(o, o)).join("")}
            ${node.allowOther ? radio(OTHER_VALUE, "Other") : ""}
          </div>
          ${isOther ? `<label class="other-input"><span class="sr-only">Describe your answer</span><input type="text" data-select-other-fid="${id}" data-fkey="${id}:other-text" value="${e(val)}" placeholder="${e(node.otherPlaceholder || "Please specify")}"></label>` : ""}
        </fieldset>`;
    }
    if (node.type === "multiselect") {
      const selected = Array.isArray(val) ? val : [];
      const otherChecked = selected.includes(OTHER_VALUE);
      const box = (optId, label) => `
        <label class="checkbox-option ${selected.includes(optId) ? "selected" : ""}">
          <input type="checkbox" data-multi-fid="${id}" value="${e(optId)}" data-fkey="${id}:${e(optId)}" ${selected.includes(optId) ? "checked" : ""}> ${e(label)}
        </label>`;
      return `
        <fieldset class="field">
          <legend>${e(node.text)}${optTag(node)}</legend>
          <div class="checkbox-group">
            ${node.options.map((o) => box(o.id, o.label)).join("")}
            ${node.allowOther ? box(OTHER_VALUE, "Other") : ""}
          </div>
          ${otherChecked ? `<label class="other-input"><span class="sr-only">Describe the other option</span><input type="text" data-fid-other="${id}" data-fkey="${id}:other-text" value="${e(session.answers[id + "__otherText"] || "")}" placeholder="${e(node.otherPlaceholder || "Please specify")}"></label>` : ""}
        </fieldset>`;
    }
    if (node.type === "vendor") {
      const isOther = session.answers[id + "__isOther"] || (val !== "" && !node.vendorOptions.includes(val));
      return `
        <div class="field">
          <label for="v-${id}">${e(node.text)}${optTag(node)}</label>
          <select id="v-${id}" data-vendor-fid="${id}" data-fkey="${id}:select">
            <option value="" ${val === "" && !isOther ? "selected" : ""}>Not specified</option>
            ${node.vendorOptions.map((v) => `<option value="${e(v)}" ${!isOther && val === v ? "selected" : ""}>${e(v)}</option>`).join("")}
            <option value="${OTHER_VALUE}" ${isOther ? "selected" : ""}>Other</option>
          </select>
          ${isOther ? `<label class="other-input"><span class="sr-only">Product or provider name</span><input type="text" data-vendor-other-fid="${id}" data-fkey="${id}:other-text" value="${e(!node.vendorOptions.includes(val) ? val : "")}" placeholder="Please specify"></label>` : ""}
        </div>`;
    }
    return `
      <div class="field">
        <label for="t-${id}">${e(node.text)}${optTag(node)}</label>
        <input type="text" id="t-${id}" data-text-fid="${id}" data-fkey="${id}:text" value="${e(val)}" placeholder="${e(node.placeholder || "")}">
      </div>`;
  }

  function screenComplete(screen) {
    return visibleNodes(screen.flow, session).every((n) => n.required === false || isAnswered(session.answers[n.id]));
  }

  function renderProfileScreen() {
    persistProgress();
    const restore = preserveFocus(panel());
    const screen = PROFILE_SCREENS[ui.screenIndex];
    const p = panel();
    const nodes = visibleNodes(screen.flow, session);
    const isLast = nextScreenIndex(ui.screenIndex) >= PROFILE_SCREENS.length;
    p.innerHTML = `
      <div class="step-eyebrow">Setup</div>
      <h2 class="step-title" tabindex="-1">${e(screen.title)}</h2>
      ${transitionNoteHtml()}
      ${progressMetaHtml()}
      <p class="step-sub">${e(screen.sub)}</p>
      ${nodes.map(fieldHtml).join("")}
      <div class="nav">
        <button type="button" id="backBtn">← Back</button>
        <button type="button" class="primary" id="nextBtn" ${screenComplete(screen) ? "" : "disabled"}>${isLast ? "Continue to the scored sections →" : "Continue →"}</button>
      </div>`;
    const node = (fid) => screen.flow.index.get(fid);
    const refreshNext = () => (document.getElementById("nextBtn").disabled = !screenComplete(screen));

    p.querySelectorAll("input[type=radio][data-fid]").forEach((el) =>
      el.addEventListener("change", () => {
        const n = node(el.dataset.fid);
        if (el.value === OTHER_VALUE) {
          session.answers[n.id + "__isOther"] = true;
          recordAnswer(session, n, "");
        } else {
          delete session.answers[n.id + "__isOther"];
          recordAnswer(session, n, el.value);
        }
        renderProfileScreen();
      })
    );
    p.querySelectorAll("input[data-select-other-fid]").forEach((el) => {
      el.addEventListener("input", () => {
        recordAnswer(session, node(el.dataset.selectOtherFid), el.value);
        refreshNext();
        persistProgress();
      });
      // A typed answer that matches an existing option becomes that option.
      el.addEventListener("blur", () => {
        const n = node(el.dataset.selectOtherFid);
        const text = String(session.answers[n.id] || "").trim();
        if (!text) return;
        const match = matchOtherText(text, n.options.map((o) => ({ id: o, label: o })));
        if (!match) return;
        delete session.answers[n.id + "__isOther"];
        recordAnswer(session, n, match.id);
        renderProfileScreen();
      });
    });
    p.querySelectorAll("input[data-text-fid]").forEach((el) =>
      el.addEventListener("input", () => {
        recordAnswer(session, node(el.dataset.textFid), el.value);
        refreshNext();
        persistProgress();
      })
    );
    p.querySelectorAll("select[data-vendor-fid]").forEach((el) =>
      el.addEventListener("change", () => {
        const n = node(el.dataset.vendorFid);
        if (el.value === OTHER_VALUE) {
          session.answers[n.id + "__isOther"] = true;
          recordAnswer(session, n, "");
        } else {
          delete session.answers[n.id + "__isOther"];
          recordAnswer(session, n, el.value);
        }
        renderProfileScreen();
      })
    );
    p.querySelectorAll("input[data-vendor-other-fid]").forEach((el) =>
      el.addEventListener("input", () => {
        recordAnswer(session, node(el.dataset.vendorOtherFid), el.value);
        refreshNext();
        persistProgress();
      })
    );
    p.querySelectorAll("input[data-multi-fid]").forEach((el) =>
      el.addEventListener("change", () => {
        const n = node(el.dataset.multiFid);
        const set = new Set(Array.isArray(session.answers[n.id]) ? session.answers[n.id] : []);
        el.checked ? set.add(el.value) : set.delete(el.value);
        recordAnswer(session, n, [...set]);
        renderProfileScreen();
      })
    );
    p.querySelectorAll("input[data-fid-other]").forEach((el) => {
      el.addEventListener("input", () => {
        session.answers[el.dataset.fidOther + "__otherText"] = el.value;
        refreshNext();
        persistProgress();
      });
      el.addEventListener("blur", () => {
        const n = node(el.dataset.fidOther);
        const text = String(session.answers[n.id + "__otherText"] || "").trim();
        if (!text) return;
        const match = matchOtherText(text, n.options);
        if (!match) return;
        const current = Array.isArray(session.answers[n.id]) ? [...session.answers[n.id]] : [];
        if (current.includes(match.id)) return;
        recordAnswer(session, n, [...current, match.id]);
        renderProfileScreen();
      });
    });

    document.getElementById("nextBtn").addEventListener("click", () => {
      const nxt = nextScreenIndex(ui.screenIndex);
      ui.transitionNote = SECTION_TRANSITIONS[screen.id] || null;
      if (nxt >= PROFILE_SCREENS.length) {
        ui.phase = "wizard";
        ui.categoryIndex = nextCategoryIndex(-1);
        renderRail();
        renderAssessmentCategory();
      } else {
        ui.screenIndex = nxt;
        renderRail();
        renderProfileScreen();
      }
      focusHeading();
    });
    document.getElementById("backBtn").addEventListener("click", () => {
      const prv = prevScreenIndex(ui.screenIndex);
      if (prv < 0) {
        ui.phase = "scope";
        renderRail();
        renderScope();
      } else {
        ui.screenIndex = prv;
        renderRail();
        renderProfileScreen();
      }
      focusHeading();
    });
    restore();
    if (autosavePaused) showConflictBanner();
  }

  // ---------- scored sections ----------
  function categoryQuestions(fn) {
    return visibleNodes(ASSESSMENT_FLOW, session).filter((q) => q.fn === fn);
  }
  function categoryAnswered(fn) {
    return categoryQuestions(fn).every((q) => isAnswered(session.answers[q.id]));
  }

  function renderAssessmentCategory() {
    persistProgress();
    const restore = preserveFocus(panel());
    const fn = FUNCTIONS[ui.categoryIndex];
    const p = panel();
    const qs = categoryQuestions(fn);
    const isLast = nextCategoryIndex(ui.categoryIndex) >= FUNCTIONS.length;
    p.innerHTML = `
      <div class="step-eyebrow">${e(FUNC_REF[fn])}</div>
      <h2 class="step-title" tabindex="-1">${e(FUNC_DISPLAY[fn])}</h2>
      ${transitionNoteHtml()}
      ${progressMetaHtml()}
      <p class="step-sub">If you don't know an answer, choose "Not sure" - it's recorded as unknown, not as a "No", and the report tells you what to confirm.</p>
      ${qs
        .map((q) => {
          const fw = q.framework ? FRAMEWORKS.find((f) => f.id === q.framework) : null;
          return `
        <fieldset class="question">
          <legend>${e(q.text)}${fw ? ` <span class="q-badge">${e(fw.name)}</span>` : ""}</legend>
          <div class="options">
            ${q.options
              .map((o) => {
                const checked = session.answers[q.id] === o.v;
                const extraCls = o.v === UNKNOWN ? " option-unknown" : o.v === NOT_APPLICABLE ? " option-na" : "";
                return `
              <label class="option${checked ? " selected" : ""}${extraCls}">
                <input type="radio" class="sr-only" name="q-${q.id}" value="${e(String(o.v))}" data-qid="${q.id}" data-fkey="${q.id}:${e(String(o.v))}" ${checked ? "checked" : ""}>
                <span class="radio" aria-hidden="true"></span><span>${e(o.t)}</span>
              </label>`;
              })
              .join("")}
          </div>
        </fieldset>`;
        })
        .join("")}
      <div class="nav">
        <button type="button" id="backBtn">← Back</button>
        <button type="button" class="primary" id="nextBtn" ${categoryAnswered(fn) ? "" : "disabled"}>${isLast ? "See the report →" : "Continue →"}</button>
      </div>`;

    p.querySelectorAll("input[data-qid]").forEach((el) =>
      el.addEventListener("change", () => {
        recordAnswer(session, ASSESSMENT_FLOW.index.get(el.dataset.qid), parseScoredValue(el.value));
        renderAssessmentCategory();
      })
    );
    document.getElementById("nextBtn").addEventListener("click", () => {
      ui.transitionNote = SECTION_TRANSITIONS[fn] || null;
      const nxt = nextCategoryIndex(ui.categoryIndex);
      if (nxt >= FUNCTIONS.length) {
        ui.phase = "results";
        renderRail();
        renderResults();
      } else {
        ui.categoryIndex = nxt;
        renderRail();
        renderAssessmentCategory();
      }
      focusHeading();
    });
    document.getElementById("backBtn").addEventListener("click", () => {
      const prv = prevCategoryIndex(ui.categoryIndex);
      if (prv >= 0) {
        ui.categoryIndex = prv;
        renderRail();
        renderAssessmentCategory();
      } else {
        const idx = prevScreenIndex(PROFILE_SCREENS.length);
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
      focusHeading();
    });
    restore();
    if (autosavePaused) showConflictBanner();
  }

  // ---------- results ----------
  function linksForReport() {
    return { playbook: (ref) => pathForTab("playbooks", ref) };
  }

  // Saves the current answers as a run (or finds the identical last one), and
  // returns { run, saved: {ok, reason, evicted} }.
  function saveCurrentRun(report) {
    const answers = effectiveState(session).answers;
    const runs = listRuns();
    let run = ui.resultRunId ? runs.find((r) => r.id === ui.resultRunId) : null;
    if (run) return { run, saved: { ok: true, evicted: 0, existing: true } };
    const latest = runs.filter((r) => !r.legacy).pop();
    if (latest && latest.answers && latest.mode === report.mode && latest.methodologyVersion === report.methodologyVersion && sameAnswers(latest.answers, answers)) {
      return { run: latest, saved: { ok: true, evicted: 0, existing: true } };
    }
    const id = newRunId();
    run = { id, ts: Date.now(), mode: report.mode, methodologyVersion: report.methodologyVersion, industry: answers.industry || null, answers, summary: null, ai: null };
    report.snapshotId = id;
    run.summary = summarizeReport(report);
    const saved = saveRun(run);
    trackEvent("assessment_complete", { mode: report.mode });
    return { run: saved.ok ? run : null, saved };
  }

  function renderResults() {
    clearProgress();
    const report = buildReport(session);
    const { run, saved } = saveCurrentRun(report);
    if (run) {
      ui.resultRunId = run.id;
      report.snapshotId = run.id;
    }
    const staleAi = lastAi && run && lastAi.snapshotId !== run.id ? lastAi : null;
    current = { report, run, ai: run?.ai?.result || null, aiError: null, staleAi, saved, migrationNotes: [], recalculated: null, interpretations: run?.otherInterpretations || null };
    renderReportPage();
  }

  // Opens a saved run (History, or the landing banner). Legacy runs and runs
  // from another methodology are rebuilt from their answers and clearly
  // labelled as recalculated, alongside the original result.
  function openRun(id) {
    const run = getRun(id);
    if (!run || !run.answers) return false;
    resetSession();
    const { answers, notes } = migrateAnswers(run.answers, run.answerSchema || (run.legacy ? 1 : 2));
    Object.assign(session.answers, answers);
    session.quickMode = run.mode === "quick";
    ui.phase = "results";
    ui.resultRunId = run.id;
    if (currentPathIsSample()) history.pushState({}, "", ASSESSMENT_PATH);
    const report = buildReport(session, { generatedAt: new Date(run.ts).toISOString() });
    report.snapshotId = run.id;
    const original = run.legacy
      ? { label: `${run.legacyOverall}% overall`, methodology: "1.x" }
      : run.summary && run.summary.methodologyVersion !== METHODOLOGY_VERSION
        ? { label: `${run.summary.verdict.label}${run.summary.coverage !== null ? `, ${run.summary.coverage}% coverage` : ""}`, methodology: run.summary.methodologyVersion }
        : null;
    current = { report, run, ai: run.ai?.result || null, aiError: null, staleAi: null, saved: { ok: true, existing: true }, migrationNotes: notes, recalculated: original, interpretations: run.otherInterpretations || null };
    return true;
  }

  function reportHeaderHtml(report) {
    const quick = report.mode === "quick";
    return `
      <div class="step-eyebrow">${quick ? "Quick screening result" : "Assessment report"}</div>
      <h2 class="step-title" tabindex="-1">${quick ? "Screening result" : "Your security reading"}</h2>
      <p class="step-sub">Measured against NIST CSF 2.0 and CIS Controls v8.1${report.context.frameworks.map((f) => " + " + e(f)).join("")}${report.context.industry ? " · " + e(report.context.industry) : ""}</p>`;
  }

  function savedNoticeHtml() {
    const { saved, recalculated, migrationNotes, report } = current;
    const notes = [];
    if (recalculated)
      notes.push(`<div class="stale-banner" role="note"><b>Recalculated.</b> This report was originally produced under methodology ${e(recalculated.methodology)} (result: ${e(recalculated.label)}). It's shown here rebuilt from your saved answers under methodology ${e(report.methodologyVersion)}, which scores differently - the two aren't directly comparable.</div>`);
    if (migrationNotes?.length) notes.push(`<div class="stale-banner" role="note">${migrationNotes.map(e).join(" ")}</div>`);
    if (saved && !saved.ok)
      notes.push(`<div class="stale-banner" role="alert"><b>Not saved.</b> ${saved.reason === "quota" ? "This browser's storage for the site is full." : "This browser isn't allowing the site to store data (private browsing, or site data blocked)."} Download the PDF or JSON below to keep a copy.</div>`);
    else if (saved?.evicted) notes.push(`<p class="scope-hint">Saved in this browser. To make room, the ${saved.evicted} oldest saved report${saved.evicted === 1 ? " was" : "s were"} removed from History.</p>`);
    return notes.join("");
  }

  // Change since the previous report - only against one produced by the same
  // methodology and mode, since anything else would compare different
  // scales. Findings are matched by stable control id.
  function deltaHtml() {
    const { run, report } = current;
    if (!run) return "";
    const prev = listRuns()
      .filter((r) => !r.legacy && r.id !== run.id && r.ts < run.ts && r.summary && r.summary.methodologyVersion === report.methodologyVersion && r.summary.mode === report.mode)
      .pop();
    if (!prev) return "";
    const before = new Map(prev.summary.findings.map((f) => [f.id, f]));
    const now = new Map(report.findings.map((f) => [f.id, f]));
    const resolved = [...before.keys()].filter((id) => !now.has(id));
    const added = [...now.keys()].filter((id) => !before.has(id));
    const cov = report.overall.coverage !== null && prev.summary.coverage !== null ? report.overall.coverage - prev.summary.coverage : null;
    const titleOf = (id) => e((now.get(id) || before.get(id)).title);
    return `
      <section class="delta-box" aria-labelledby="deltaTitle">
        <h3 id="deltaTitle">Change since your last ${report.mode === "quick" ? "screening" : "assessment"} (${e(new Date(prev.ts).toLocaleDateString())})</h3>
        ${cov !== null && report.mode === "full" ? `<div class="delta-score ${cov >= 0 ? "up" : "down"}">${cov >= 0 ? "+" : ""}${cov} points coverage</div>` : ""}
        <div>Reading then: <b>${e(prev.summary.verdict.label)}</b> · now: <b>${e(report.verdict.label)}</b></div>
        ${resolved.length ? `<div class="delta-resolved"><b>Resolved (${resolved.length}):</b> ${resolved.slice(0, 8).map(titleOf).join("; ")}${resolved.length > 8 ? " …" : ""}</div>` : ""}
        ${added.length ? `<div class="delta-new"><b>New (${added.length}):</b> ${added.slice(0, 8).map(titleOf).join("; ")}${added.length > 8 ? " …" : ""}</div>` : ""}
        ${!resolved.length && !added.length ? "<div>The same findings as last time.</div>" : ""}
      </section>`;
  }

  function quickFooterHtml(report) {
    if (report.mode !== "quick") return "";
    return `
      <div class="continue-full">
        <div><b>Want the full picture?</b> The Full assessment covers every applicable control. Every answer you've given here is kept - you'll only be asked what's missing.</div>
        <button type="button" class="primary" id="continueFullBtn">Continue to the Full assessment →</button>
      </div>`;
  }

  // "Other" answers the keyword matcher couldn't place. Shown as typed; an
  // AI reading is only fetched when the visitor asks (and has agreed).
  const OTHER_TEXT_FIELDS = [
    ["outsourcedFunctionBreakdown", "multi"],
    ["partialOutsourceFunctions", "multi"],
    ["mixedOtherProviderDetail", "multi"],
    ["dayToDay", "multi"],
    ["aiUsageTypes", "multi"],
    ["networkArch", "select"],
    ["devsecopsMaturity", "select"],
  ];
  function unresolvedOtherTexts(answers) {
    const nodes = new Map(PROFILE_SCREENS.flatMap((s) => [...s.flow.index.values()].map((n) => [n.id, n])));
    const items = [];
    for (const [id, kind] of OTHER_TEXT_FIELDS) {
      const node = nodes.get(id);
      if (!node) continue;
      const text = kind === "multi" ? (Array.isArray(answers[id]) && answers[id].includes(OTHER_VALUE) ? answers[id + "__otherText"] : "") : answers[id + "__isOther"] ? answers[id] : "";
      if (text && String(text).trim()) items.push({ fieldLabel: node.text.slice(0, 300), freeText: String(text).trim().slice(0, 500) });
    }
    return items;
  }

  function otherTextHtml(items, interpretations) {
    if (!items.length) return "";
    return `
      <section class="flags" aria-labelledby="otherTitle">
        <h3 id="otherTitle">Additional context you provided</h3>
        ${items
          .map((it, i) => {
            const interp = interpretations?.find((x) => x.index === i);
            return `<div class="vendor-note-item"><b>${e(it.fieldLabel)} -</b> "${e(it.freeText)}"${
              interp ? `<br><span class="ai-badge">AI reading</span> ${e(interp.interpretation)}` : `<br><span class="scope-hint">Recorded as typed. Free text isn't scored.</span>`
            }</div>`;
          })
          .join("")}
      </section>`;
  }

  function aiSectionHtml() {
    const { report, ai, aiError, staleAi, run } = current;
    const payload = buildInsightsPayload(session, report, { snapshotId: run?.id, consentVersion: AI_CONSENT_VERSION });
    const others = unresolvedOtherTexts(effectiveState(session).answers);
    let body;
    if (ai) body = aiResultHtml(ai);
    else
      body = `
        ${staleAi ? `<div class="ai-stale">${aiResultHtml(staleAi, { stale: true })}</div>` : ""}
        ${consentHtml(payload)}
        ${aiError ? `<p class="stale-banner" role="alert">${e(aiError)}</p>` : ""}
        <div class="ai-actions">
          <button type="button" id="aiInsightsBtn" ${hasAiConsent() ? "" : "disabled"}>Get AI-enhanced insights</button>
          ${others.length && !current.interpretations ? `<button type="button" id="aiInterpretBtn" ${hasAiConsent() ? "" : "disabled"}>Also interpret my ${others.length} "Other" answer${others.length === 1 ? "" : "s"}</button>` : ""}
        </div>`;
    return `
      <section class="ai-insights-section" aria-labelledby="aiTitle">
        <div class="ai-insights-intro">
          <div>
            <h3 id="aiTitle">AI-enhanced insights <span class="ai-badge">optional · AI-generated</span></h3>
            <p class="body-text">A check of the products you named against current public vulnerability records, plus a second look at your answers for combinations the rules above don't cover. Nothing is sent unless you choose to.</p>
          </div>
        </div>
        <div id="aiInsightsBody" aria-live="polite">${body}</div>
      </section>`;
  }

  function renderReportPage() {
    const p = panel();
    const { report } = current;
    const tracking = loadTracking();
    const others = unresolvedOtherTexts(effectiveState(session).answers);
    p.innerHTML = `
      ${reportHeaderHtml(report)}
      ${savedNoticeHtml()}
      <div class="report-meta-fields">
        <div class="field">
          <label for="reportCompanyName">Company / organization name <span class="opt-tag">optional - PDF only, never sent anywhere</span></label>
          <input type="text" id="reportCompanyName" placeholder="Shown on the PDF cover" value="${e(session.answers.companyName || "")}">
        </div>
        <div class="field">
          <label for="reportRequestedBy">Report requested by <span class="opt-tag">optional</span></label>
          <input type="text" id="reportRequestedBy" placeholder="Name and role" value="${e(session.answers.reportRequestedBy || "")}">
        </div>
      </div>
      ${deltaHtml()}
      <div id="reportBody">${reportBodyHtml(report, { tracking, interactive: true, links: linksForReport() })}</div>
      ${otherTextHtml(others, current.interpretations)}
      ${quickFooterHtml(report)}
      <div class="export-row" role="group" aria-label="Download this report">
        <button type="button" id="exportPdfBtn">Download PDF</button>
        <button type="button" id="exportCsvBtn" ${report.actions.length ? "" : "disabled"}>Action plan (CSV)</button>
        <button type="button" id="exportJsonBtn">Action plan (JSON)</button>
      </div>
      ${aiSectionHtml()}
      <div class="nav">
        <button type="button" id="backBtn2">← Review answers</button>
        <a id="viewHistoryBtn" href="${pathForTab("history")}">History (${listRuns().length}) →</a>
      </div>`;
    wireReportPage();
  }

  function wireReportPage() {
    const p = panel();
    const { report } = current;
    wireAccordions(p);
    document.getElementById("reportCompanyName").addEventListener("input", (ev) => {
      session.answers.companyName = ev.target.value;
      report.context.companyName = ev.target.value;
    });
    document.getElementById("reportRequestedBy").addEventListener("input", (ev) => {
      session.answers.reportRequestedBy = ev.target.value;
      report.context.requestedBy = ev.target.value;
    });
    p.querySelectorAll("[data-track]").forEach((el) =>
      el.addEventListener("change", () => {
        const result = updateTracking(el.dataset.track, { [el.dataset.field]: el.value });
        if (!result.ok) showToast("Couldn't save tracking in this browser.");
        else announce("Saved");
        if (el.dataset.field === "status") {
          const restore = preserveFocus(p);
          document.getElementById("reportBody").innerHTML = reportBodyHtml(report, { tracking: loadTracking(), interactive: true, links: linksForReport() });
          wireReportPage();
          const card = document.getElementById(el.dataset.track);
          if (card) card.classList.add("open"), card.querySelector(".acc-head")?.setAttribute("aria-expanded", "true");
          restore();
        }
      })
    );
    document.getElementById("backBtn2").addEventListener("click", () => {
      ui.resultRunId = null;
      if (current.ai) lastAi = { ...current.ai, snapshotId: current.run?.id };
      ui.phase = "wizard";
      ui.categoryIndex = prevCategoryIndex(FUNCTIONS.length);
      renderRail();
      renderAssessmentCategory();
      focusHeading();
    });
    const hist = document.getElementById("viewHistoryBtn");
    if (hist) wireNavLink(hist, "history");
    document.getElementById("exportPdfBtn").addEventListener("click", () => {
      trackEvent("report_export", { format: "pdf" });
      buildAssessmentPdf(report, { aiInsights: current.ai || null });
    });
    document.getElementById("exportCsvBtn").addEventListener("click", () => trackEvent("report_export", { format: "csv" }) || download(`SimplifiedCS-action-plan-${report.generatedAt.slice(0, 10)}.csv`, actionsToCsv(report.actions, loadTracking()), "text/csv;charset=utf-8"));
    document.getElementById("exportJsonBtn").addEventListener("click", () => trackEvent("report_export", { format: "json" }) || download(`SimplifiedCS-action-plan-${report.generatedAt.slice(0, 10)}.json`, actionsToJson(report, loadTracking()), "application/json"));
    const cont = document.getElementById("continueFullBtn");
    if (cont)
      cont.addEventListener("click", () => {
        session.quickMode = false;
        ui.resultRunId = null;
        ui.phase = "scope";
        renderRail();
        renderScope();
        focusHeading();
        announce("Continuing to the Full assessment. Your Quick answers are kept.");
      });
    wireAi();
  }

  function wireAi() {
    const check = document.getElementById("aiConsentCheck");
    const btn = document.getElementById("aiInsightsBtn");
    const interpretBtn = document.getElementById("aiInterpretBtn");
    if (check)
      check.addEventListener("change", () => {
        if (btn) btn.disabled = !check.checked;
        if (interpretBtn) interpretBtn.disabled = !check.checked;
      });
    if (btn) btn.addEventListener("click", () => check?.checked && requestAiInsights());
    if (interpretBtn) interpretBtn.addEventListener("click", () => check?.checked && requestInterpretation());
  }

  async function postJson(url, body, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      return { status: res.status, ok: res.ok, json };
    } catch {
      return { status: 0, ok: false, json: null };
    } finally {
      clearTimeout(timer);
    }
  }

  async function requestAiInsights() {
    const btn = document.getElementById("aiInsightsBtn");
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = "1";
    btn.disabled = true;
    btn.textContent = "Checking sources and generating…";
    recordAiConsent();
    const { report, run } = current;
    const payload = buildInsightsPayload(session, report, { snapshotId: run?.id, consentVersion: AI_CONSENT_VERSION });
    // Longer than the server's own worst case (lookups plus its model
    // timeout), so its own error message arrives before the browser gives up.
    const res = await postJson("/.netlify/functions/ai-insights", payload, 45_000);
    if (res.ok && res.json && res.json.schemaVersion === 2) {
      current.ai = res.json;
      current.aiError = null;
      current.staleAi = null;
      lastAi = { ...res.json, snapshotId: run?.id };
      if (run) {
        const stored = attachAiResult(run.id, { snapshotId: run.id, generatedAt: res.json.generatedAt, promptVersion: res.json.promptVersion, model: res.json.model, result: res.json });
        if (!stored.ok) showToast("AI insights are shown, but couldn't be saved with this report in this browser.");
      }
      announce("AI insights ready");
    } else {
      current.aiError = aiErrorText(res.status, res.json);
    }
    const section = document.querySelector(".ai-insights-section");
    if (section) {
      section.outerHTML = aiSectionHtml();
      wireAccordions(panel());
      wireAi();
    }
  }

  async function requestInterpretation() {
    const btn = document.getElementById("aiInterpretBtn");
    if (!btn || btn.dataset.busy) return;
    btn.dataset.busy = "1";
    btn.disabled = true;
    btn.textContent = "Interpreting…";
    recordAiConsent();
    const items = unresolvedOtherTexts(effectiveState(session).answers).slice(0, 8);
    const res = await postJson("/.netlify/functions/other-text-interpret", { consent: { version: AI_CONSENT_VERSION, accepted: true }, items }, 25_000);
    if (res.ok && Array.isArray(res.json?.interpretations)) {
      current.interpretations = res.json.interpretations;
      if (current.run) saveRun({ ...getRun(current.run.id), otherInterpretations: res.json.interpretations });
      renderReportPage();
      announce("Interpretations added");
    } else {
      btn.textContent = "Interpretation unavailable";
      showToast(aiErrorText(res.status, res.json));
    }
  }

  // ---------- example reports ----------
  function renderSampleReport() {
    const p = panel();
    const sample = SAMPLE_SCENARIOS[ui.sampleId] || SAMPLE_SCENARIOS[DEFAULT_SAMPLE];
    const state = createSessionState();
    Object.assign(state.answers, sample.answers);
    const report = buildReport(state, { sample: sample.id });
    p.innerHTML = `
      <div class="sample-banner" role="note"><b>Example</b>&nbsp;A fictional organization and fictional answers, run through the real scoring engine - not a real assessment.</div>
      <div class="step-eyebrow">Example report</div>
      <h2 class="step-title" tabindex="-1">${e(sample.label)}</h2>
      <div class="sample-picker" role="group" aria-label="Choose an example">
        ${Object.values(SAMPLE_SCENARIOS).map((s) => `<button type="button" data-sample="${s.id}" aria-pressed="${s.id === sample.id}" class="${s.id === sample.id ? "primary" : ""}">${e(s.label)}</button>`).join("")}
      </div>
      <p class="step-sub">${e(sample.blurb)}</p>
      ${reportBodyHtml(report, { links: linksForReport() })}
      <section class="ai-insights-section" aria-labelledby="aiTitle">
        <h3 id="aiTitle">AI-enhanced insights <span class="ai-badge">example</span></h3>
        <p class="body-text">What the optional AI section looks like. For examples no request is made and no vulnerability source is queried, so no vulnerability items are shown.</p>
        ${aiResultHtml(sample.ai)}
      </section>
      <div class="nav">
        <button type="button" id="sampleBackBtn">← Back to assessment options</button>
        <button type="button" id="samplePdfBtn">Download this example as PDF</button>
      </div>`;
    wireAccordions(p);
    p.querySelectorAll("[data-sample]").forEach((b) =>
      b.addEventListener("click", () => {
        ui.sampleId = b.dataset.sample;
        renderSampleReport();
        focusHeading();
      })
    );
    document.getElementById("sampleBackBtn").addEventListener("click", () => {
      ui.phase = "landing";
      if (currentPathIsSample()) history.pushState({}, "", ASSESSMENT_PATH);
      renderRail();
      renderLanding();
      focusHeading();
    });
    document.getElementById("samplePdfBtn").addEventListener("click", () => buildAssessmentPdf(report, { aiInsights: sample.ai }));
  }

  function dispatchPhase() {
    if (ui.phase === "landing") renderLanding();
    else if (ui.phase === "scope") renderScope();
    else if (ui.phase === "profile") renderProfileScreen();
    else if (ui.phase === "wizard") renderAssessmentCategory();
    else if (ui.phase === "sample") renderSampleReport();
    else if (current) renderReportPage();
    else renderResults();
  }

  return {
    get phase() {
      return ui.phase;
    },
    session,
    renderRail,
    requestLanding,
    openRun,
    renderCurrentPhase() {
      if (currentPathIsSample() && ui.phase !== "sample") ui.phase = "sample";
      else if (!currentPathIsSample() && ui.phase === "sample") ui.phase = "landing";
      updateSerial();
      renderRail();
      dispatchPhase();
    },
  };
}
