// ASSESSMENT-EXPERIENCE-BRIEF.md §2: same-device save/resume, deliberately
// just the browser's own localStorage - no backend record, no token
// entropy requirements, no Row-Level Security to configure. Survives
// closing the tab/browser/restarting the device; only ever resumes on the
// same browser/device that saved it. That's an accepted, deliberate
// tradeoff, not a gap - genuine cross-device resume is separate, later
// scope (see the Roadmap's "Cross-Device Resume" planned entry).
const SAVE_KEY = "simplifiedcs:assessment:v1";
const NOTICE_KEY = "simplifiedcs:hasSeenSaveNotice";

function storageAvailable() {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

// localStorage can throw (private/incognito browsing, quota exceeded, a
// site setting that disables it) - failing to persist a save is never worse
// than the pre-§2 behavior of not persisting at all, so every operation
// here is silently best-effort rather than surfacing an error to the user.
export function saveProgress(session, ui) {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        answers: session.answers,
        asked: session.asked,
        dedupe: session.dedupe,
        quickMode: session.quickMode,
        ui,
        savedAt: Date.now(),
      })
    );
  } catch {
    /* best-effort - see comment above */
  }
}

export function loadProgress() {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.answers || !data.ui) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearProgress() {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* best-effort - see comment above */
  }
}

// The one-time toast (ASSESSMENT-EXPERIENCE-BRIEF.md §2): shown the first
// time a save actually happens in a given browser, never again after that -
// not once per session, once ever per browser.
export function hasSeenSaveNotice() {
  if (!storageAvailable()) return true; // no storage -> nothing to notice about
  try {
    return localStorage.getItem(NOTICE_KEY) === "true";
  } catch {
    return true;
  }
}

export function markSaveNoticeSeen() {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(NOTICE_KEY, "true");
  } catch {
    /* best-effort - see comment above */
  }
}
