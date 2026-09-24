// The visitor's explicit choice to send assessment details for AI
// processing. Nothing AI-related is ever called without it (both the
// insights request and the "Other" free-text interpretation check it), and
// the version below must match the server's CONSENT_VERSION
// (netlify/lib/insights.ts) - a server that has moved on to a new notice
// rejects requests carrying an old version, so the visitor is asked again.
export const AI_CONSENT_VERSION = "ai-processing-2026-09";
const KEY = "simplifiedcs:consent:ai";

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function hasAiConsent() {
  const s = storage();
  if (!s) return false;
  try {
    const v = JSON.parse(s.getItem(KEY) || "null");
    return Boolean(v && v.accepted === true && v.version === AI_CONSENT_VERSION);
  } catch {
    return false;
  }
}

// Remembering is a convenience only; if storage is unavailable the choice
// simply applies to this one request.
export function recordAiConsent() {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY, JSON.stringify({ version: AI_CONSENT_VERSION, accepted: true, at: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function withdrawAiConsent() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}
