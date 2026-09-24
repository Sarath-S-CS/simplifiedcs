// Progress tracking for the action plan, kept only in this browser.
//
// Tracking is deliberately separate from answers: marking an action "done"
// or recording a risk acceptance never changes a score or a finding. The
// report stays a record of what was answered; the way to show a fix is to
// retest (re-run the assessment), which the retest date field is for.
// Keyed by stable action id (actions.js), so tracking carries across runs.
const KEY = "simplifiedcs:action-tracking:v1";

export const TRACKING_STATUSES = ["open", "in-progress", "done", "risk-accepted"];
export const TRACKING_STATUS_LABELS = { open: "Open", "in-progress": "In progress", done: "Done - awaiting retest", "risk-accepted": "Risk accepted" };

const TEXT_LIMIT = 500;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadTracking() {
  const s = storage();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Keeps only known fields with sane values - this is read back into the
// page and into CSV exports.
export function cleanTracking(patch) {
  const out = {};
  for (const f of ["owner", "evidenceNote", "riskAcceptance"]) {
    if (typeof patch[f] === "string") out[f] = patch[f].slice(0, TEXT_LIMIT);
  }
  for (const f of ["due", "retest"]) {
    if (typeof patch[f] === "string" && (patch[f] === "" || DATE.test(patch[f]))) out[f] = patch[f];
  }
  if (TRACKING_STATUSES.includes(patch.status)) out.status = patch.status;
  return out;
}

export function updateTracking(actionId, patch) {
  const s = storage();
  if (!s) return { ok: false, reason: "unavailable" };
  if (!/^A-[A-Za-z0-9]+$/.test(actionId)) return { ok: false, reason: "invalid" };
  const all = loadTracking();
  all[actionId] = { ...(all[actionId] || {}), ...cleanTracking(patch), updatedAt: new Date().toISOString() };
  try {
    s.setItem(KEY, JSON.stringify(all));
    return { ok: true, value: all[actionId] };
  } catch (e) {
    const quota = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
    return { ok: false, reason: quota ? "quota" : "unavailable" };
  }
}

export function clearTracking() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}
