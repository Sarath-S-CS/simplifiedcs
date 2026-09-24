// Everything SimplifiedCS keeps in this browser, in one place - listed on
// the privacy page and removed by "Clear all data stored by this site".
// Nothing here is ever sent to a server by the site itself; the only thing
// that leaves the browser is an AI request the visitor explicitly sends.
export const LOCAL_DATA = [
  { key: "simplifiedcs:assessment:v1", what: "Your in-progress assessment answers, so you can resume" },
  { key: "simplifiedcs:runs:v2", what: "Completed assessments: answers, a summary of each report, and any AI insights you requested" },
  { key: "simplifiedcs:runs:v1", what: "Completed assessments saved before September 2026" },
  { key: "simplifiedcs:action-tracking:v1", what: "Action-plan tracking you entered (owners, dates, status, notes)" },
  { key: "simplifiedcs:hasSeenSaveNotice", what: "Whether you've seen the 'saved in this browser' notice" },
  { key: "simplifiedcs:consent:analytics", what: "Your analytics cookie choice" },
  { key: "simplifiedcs:consent:ai", what: "Whether you agreed to send assessment details for AI processing, and which notice version" },
  { key: "simplifiedcs:theme", what: "Light or dark theme" },
];

export const LOCAL_DATA_KEYS = LOCAL_DATA.map((d) => d.key);
const PREFIX = "simplifiedcs:";

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
