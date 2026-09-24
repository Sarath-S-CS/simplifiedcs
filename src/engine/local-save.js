// Same-device save/resume of an in-progress assessment, in this browser's
// localStorage only - no account, nothing sent anywhere. Only ever resumes
// on the browser that saved it.
//
// saveProgress() reports what actually happened ({ ok, reason }) so the UI
// only says "saved" when it was, and can say why not otherwise (private
// browsing, storage full). Each save records the answer schema version, so
// a save made before methodology 2.0 is migrated on resume (./migrate.js),
// and the id of the tab that wrote it, so a second tab editing the same
// assessment can be detected (watchExternalChanges) instead of the two
// silently overwriting each other.
import { ANSWER_SCHEMA_VERSION, migrateAnswers } from "./migrate.js";

export const SAVE_KEY = "simplifiedcs:assessment:v1";
const NOTICE_KEY = "simplifiedcs:hasSeenSaveNotice";

const TAB_ID = Math.random().toString(36).slice(2, 10);

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveProgress(session, ui) {
  const s = storage();
  if (!s) return { ok: false, reason: "unavailable" };
  try {
    s.setItem(
      SAVE_KEY,
      JSON.stringify({
        answers: session.answers,
        asked: session.asked,
        dedupe: session.dedupe,
        quickMode: session.quickMode,
        ui,
        savedAt: Date.now(),
        answerSchema: ANSWER_SCHEMA_VERSION,
        tab: TAB_ID,
      })
    );
    return { ok: true };
  } catch (e) {
    const quota = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    return { ok: false, reason: quota ? "quota" : "unavailable" };
  }
}

// Returns the saved progress with answers migrated to the current schema,
// plus `migrationNotes` describing anything that changed.
export function loadProgress() {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.answers || !data.ui) return null;
    const { answers, notes } = migrateAnswers(data.answers, data.answerSchema || 1);
    return { ...data, answers, migrationNotes: notes };
  } catch {
    return null;
  }
}

export function clearProgress() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(SAVE_KEY);
  } catch {
    /* best-effort */
  }
}

// Calls onChange(saved) when another tab of this browser writes or clears
// the in-progress save. Returns an unsubscribe function.
export function watchExternalChanges(onChange) {
  if (typeof window === "undefined") return () => {};
  const handler = (e) => {
    if (e.key !== SAVE_KEY) return;
    let data = null;
    try {
      data = e.newValue ? JSON.parse(e.newValue) : null;
    } catch {
      data = null;
    }
    if (data && data.tab === TAB_ID) return;
    onChange(data);
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

// The one-time notice, shown the first time a save actually succeeds in a
// given browser.
export function hasSeenSaveNotice() {
  const s = storage();
  if (!s) return true;
  try {
    return s.getItem(NOTICE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markSaveNoticeSeen() {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(NOTICE_KEY, "true");
  } catch {
    /* best-effort */
  }
}
