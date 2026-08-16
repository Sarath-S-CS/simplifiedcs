// The assessment wizard UI: scope selection -> profile screens -> six
// scored categories -> results. Adapted from the original renderScope/
// renderPre/renderStep/renderRail/renderResults, rebuilt on the graph
// engine so profile screens can branch (§5.2) and gate visibility (§5.5)
// instead of walking a fixed PRE_STEPS array. Markup/class names are kept
// identical to the original wherever the behavior didn't need to change,
// per CLAUDE.md's "preserve the design system" rule.
import { visibleNodes, resolveNext } from "../engine/graph.js";
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

export function createAssessmentController({ getPanel, getRail, icon, pathForTab, wireNavLink, storage, exportProgressJson }) {
  const session = createSessionState();
  const ui = { phase: "scope", screenIndex: 0, categoryIndex: 0 };

  function panel() {
    return getPanel();
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
      items
        .map((label, i) => {
          let cls = "node";
          if (i < activeIdx) cls += " done";
          if (i === activeIdx) cls += " active";
          return `<div class="${cls}"><div class="dot"></div><div class="label">${label}</div></div>`;
        })
        .join("");
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
      <div class="step-eyebrow">Scope</div>
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
        <div></div>
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
      return `
        <div class="field">
          <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
          <select data-fid="${node.id}">
            <option value="" ${val === "" ? "selected" : ""} disabled>Select…</option>
            ${node.options.map((o) => `<option value="${o}" ${val === o ? "selected" : ""}>${o}</option>`).join("")}
          </select>
        </div>`;
    }
    if (node.type === "multiselect") {
      const selected = Array.isArray(val) ? val : [];
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
          </div>
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
          ${isOther ? `<input type="text" data-vendor-other-fid="${node.id}" value="${!node.vendorOptions.includes(val) ? val : ""}" placeholder="Please specify">` : ""}
        </div>`;
    }
    // text
    return `
      <div class="field">
        <label>${node.text}${node.required ? "" : ' <span class="opt-tag">optional</span>'}</label>
        <input type="text" data-fid="${node.id}" value="${val}" placeholder="${node.placeholder || ""}">
      </div>`;
  }

  function screenComplete(screen) {
    return visibleNodes(screen.flow, session).every((n) => !n.required || (session.answers[n.id] !== undefined && session.answers[n.id] !== "" && !(Array.isArray(session.answers[n.id]) && session.answers[n.id].length === 0)));
  }

  function renderProfileScreen() {
    const screen = PROFILE_SCREENS[ui.screenIndex];
    const p = panel();
    const nodes = visibleNodes(screen.flow, session);
    const isLastVisible = nextVisibleScreenIndex(ui.screenIndex) >= PROFILE_SCREENS.length;
    p.innerHTML = `
      <div class="step-eyebrow">Pre-Assessment</div>
      <h2 class="step-title">${screen.title}</h2>
      <p class="step-sub">${screen.sub}</p>
      ${nodes.map(fieldHtml).join("")}
      <div class="nav">
        <button id="backBtn">← Back</button>
        <button id="saveProgressBtn">Save progress ↓</button>
        <button class="primary" id="nextBtn" ${screenComplete(screen) ? "" : "disabled"}>${isLastVisible ? "Continue to assessment →" : "Continue →"}</button>
      </div>
    `;

    document.getElementById("saveProgressBtn").addEventListener("click", () => exportProgressJson(null));

    function refreshNext() {
      document.getElementById("nextBtn").disabled = !screenComplete(screen);
    }

    p.querySelectorAll("select[data-fid]").forEach((el) => {
      el.addEventListener("change", () => {
        const node = screen.flow.index.get(el.dataset.fid);
        recordAnswer(session, node, el.value);
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

    refreshNext();

    document.getElementById("nextBtn").addEventListener("click", () => {
      const nxt = nextVisibleScreenIndex(ui.screenIndex);
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
    const fn = FUNCTIONS[ui.categoryIndex];
    const p = panel();
    const qs = categoryQuestions(fn);
    p.innerHTML = `
      <div class="step-eyebrow">${FUNC_REF[fn]}</div>
      <h2 class="step-title">${FUNC_DISPLAY[fn]}</h2>
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
        <button id="saveProgressBtn2">Save progress ↓</button>
        <button class="primary" id="nextBtn" ${categoryAnswered(fn) ? "" : "disabled"}>${ui.categoryIndex === FUNCTIONS.length - 1 ? "Generate reading" : "Continue →"}</button>
      </div>
    `;

    document.getElementById("saveProgressBtn2").addEventListener("click", () => exportProgressJson(null));

    p.querySelectorAll(".option").forEach((el) => {
      el.addEventListener("click", () => {
        const qid = el.dataset.qid;
        const node = ASSESSMENT_FLOW.index.get(qid);
        recordAnswer(session, node, Number(el.dataset.val));
        renderAssessmentCategory();
      });
    });

    document.getElementById("nextBtn").addEventListener("click", () => {
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
  function mitrePanel(guidance, panelId) {
    if (!guidance) return "";
    const techLine = guidance.technique
      ? `<li><b>Attack pattern:</b> ${guidance.technique.name} (MITRE ATT&CK ${guidance.technique.id}) - ${guidance.explain}</li>`
      : `<li><b>Why it matters:</b> ${guidance.explain}</li>`;
    return `
      <div class="acc-card mitre-panel" data-id="${panelId}">
        <div class="acc-head">
          <div><h4>Why this matters, and what to do now</h4></div>
          <div class="acc-chevron">▸</div>
        </div>
        <div class="acc-body">
          <ul>
            ${techLine}
            <li><b>Interim step:</b> ${guidance.control}</li>
          </ul>
        </div>
      </div>`;
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

    const conic = (() => {
      const slice = 360 / funcScores.length;
      let acc = 0;
      const parts = funcScores.map((f) => {
        const start = acc;
        acc += slice;
        return `${FUNC_COLORS[f.fn]} ${start}deg ${acc}deg`;
      });
      return `conic-gradient(${parts.join(",")})`;
    })();

    const delta = prevRun ? overall - prevRun.overall : null;

    p.innerHTML = `
      <div class="step-eyebrow">Synthesis - all functions considered jointly</div>
      <h2 class="step-title">Health Reading</h2>
      <p class="step-sub">Assessed against: NIST CSF 2.0 + CIS Controls v8${FRAMEWORKS.filter((f) => session.answers[f.id]).map((f) => " + " + f.name).join("")}${session.answers.industry ? " · " + INDUSTRIES.find((i) => i.id === session.answers.industry).label : ""}</p>

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

      <div class="snapshot">
        <h3>Infrastructure snapshot (self-reported)</h3>
        ${snapshotRows(session.answers)
          .map(([k, v]) => `<div class="snapshot-row"><div class="skey">${k}</div><div>${v}</div></div>`)
          .join("")}
      </div>

      <div class="gauge-row">
        <div class="gauge" style="background:${conic}">
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
          ${mitrePanel(guidanceForFlag(f, session.answers), `flag-${f.id}`)}
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
                ? `<div class="fw-gap-list">${r.gaps.map((g) => `<div class="fw-gap-item">Gap: <i>${g.question}</i> - currently: "${g.chosen}"</div>`).join("")}</div>`
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
          ${mitrePanel(guidanceForGapItem(p2, session.answers), `gap-${p2.id}`)}
        `
          )
          .join("")}
      </div>

      <div class="note-box">
        <b>Prototype note -</b> the flags and priority list above are produced by a rules engine for this demo.
        In the live version, this panel is where the Claude API call plugs in: it receives the full answer set
        plus retrieved remediation content from the knowledge base, and writes the actual narrative report.
        The vendor/product fields in the snapshot above (EDR, email security, SD-WAN, hosting/web stack) are
        exactly what a live lookup would key off - and that lookup is designed to check sources in a specific
        order: the vendor's own official website or security-advisories page first, then CISA's KEV catalog and
        NVD, rather than a generic web search. What's shown here is illustrative pattern-matching for named
        vendors, not a live fetch, but it's built to reflect that same source priority.
        <br><br>
        This run was just saved using Claude's artifact storage (private to your account) - that's what powers
        the history/delta view above. That storage is specific to this Claude environment; the production
        deployment needs a real database (e.g., Supabase) doing the same job.
      </div>

      <div class="nav">
        <button id="backBtn2">← Review answers</button>
        <button id="exportJsonBtn">Export as JSON ↓</button>
        <a id="viewHistoryBtn" href="${pathForTab("history")}">View history (${historyCount + 1}) →</a>
      </div>
    `;
    p.querySelectorAll(".acc-head").forEach((el) => {
      el.addEventListener("click", () => el.parentElement.classList.toggle("open"));
    });
    document.getElementById("backBtn2").addEventListener("click", () => {
      ui.phase = "wizard";
      ui.categoryIndex = FUNCTIONS.length - 1;
      renderRail();
      renderAssessmentCategory();
    });
    wireNavLink(document.getElementById("viewHistoryBtn"), "history");
    document.getElementById("exportJsonBtn").addEventListener("click", () => exportProgressJson(overall));
  }

  // Used by the Transform tab's "upload a previous export" feature - restores
  // a prior run's answers and resets to the scope screen so the user can
  // review/adjust before re-running. Accepts both the current export shape
  // (everything under `answers`) and the pre-rebuild shape (separate
  // `scope`/`answers`) so older downloaded exports still load.
  function loadExport(data) {
    Object.keys(session.answers).forEach((k) => delete session.answers[k]);
    Object.assign(session.answers, data.scope || {}, data.answers || {});
    if (!Array.isArray(session.answers.regions)) session.answers.regions = [];
    session.asked = [];
    session.dedupe = {};
    ui.phase = "scope";
    ui.screenIndex = 0;
    ui.categoryIndex = 0;
  }

  return {
    get phase() {
      return ui.phase;
    },
    session,
    loadExport,
    renderRail,
    renderScope,
    renderProfileScreen,
    renderAssessmentCategory,
    renderResults,
    // entry point used by renderActiveTab() when switching into the assessment tab
    renderCurrentPhase() {
      updateSerial();
      renderRail();
      if (ui.phase === "scope") renderScope();
      else if (ui.phase === "profile") renderProfileScreen();
      else if (ui.phase === "wizard") renderAssessmentCategory();
      else renderResults();
    },
  };
}
