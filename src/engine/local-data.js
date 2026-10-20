// Everything SimplifiedCS keeps in this browser, in one place - listed on
// the privacy page and removed by "Clear all data stored by this site".
// Nothing here is ever sent to a server by the site itself; the only thing
// that leaves the browser is an AI request the visitor explicitly sends.
export const LOCAL_DATA = [
  { key: "simplifiedcs:assessment:v1", what: "Your in-progress assessment answers, so you can resume" },
  { key: "simplifiedcs:hasSeenSaveNotice", what: "Whether you've seen the 'saved in this browser' notice" },
  { key: "simplifiedcs:consent:ai", what: "Whether you agreed to send assessment details for AI processing, and which notice version" },
  { key: "simplifiedcs:theme", what: "Light or dark theme" },
];

export const LOCAL_DATA_KEYS = LOCAL_DATA.map((d) => d.key);
const PREFIX = "simplifiedcs:";

// Keys written by features that no longer exist (completed-assessment history
// and action-plan tracking). The site no longer keeps completed reports, so
// any of these left over from an earlier version are purged on load - nothing
// reads them, and leaving them would contradict "nothing is kept".
const REMOVED_KEYS = ["simplifiedcs:runs:v2", "simplifiedcs:runs:v1", "simplifiedcs:action-tracking:v1"];

export function purgeRemovedFeatureData() {
  let s;
  try {
    s = typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    s = null;
  }
  if (!s) return;
  for (const k of REMOVED_KEYS) {
    try {
      s.removeItem(k);
    } catch {
      /* best-effort */
    }
  }
}

// Removes every key this site stored (anything under the "simplifiedcs:"
// prefix, including keys from older versions). Returns how many were removed.
export function clearAllLocalData() {
  let s;
  try {
    s = typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    s = null;
  }
  if (!s) return 0;
  let removed = 0;
  try {
    const keys = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      s.removeItem(k);
      removed++;
    }
  } catch {
    /* storage became unavailable mid-way; report what was removed */
  }
  return removed;
}
