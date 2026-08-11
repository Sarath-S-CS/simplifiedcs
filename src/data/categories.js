// §5.9 — business-facing category labels, mapped 1:1 onto the six NIST CSF
// functions. The underlying scoring key (`fn`) is always one of these six
// NIST function ids — only the *display* label changes. Mapping rationale
// (NIST CSF 2.0 category scope in parentheses):
//   Govern   -> "Your Team & Vendors"   (GV.RR roles/responsibilities, GV.SC supply chain/vendor risk)
//   Identify -> "Data & Systems"        (ID.AM asset management, ID.RA risk assessment)
//   Protect  -> "Access & Identity"     (PR.AA identity/access mgmt, PR.AT awareness training)
//   Detect   -> "Detection & Monitoring"(DE.CM continuous monitoring, DE.AE adverse event analysis)
//   Respond  -> "Incident Readiness"    (RS.MA/RS.AN/RS.CO incident management)
//   Recover  -> "Recovery & Continuity" (RC.RP recovery planning, RC.CO communication)
export const FUNCTIONS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

export const FUNC_COLORS = {
  Govern: "#B48EC7",
  Identify: "#E0A94A",
  Protect: "var(--accent-signal)",
  Detect: "#6FA8DC",
  Respond: "#D6685F",
  Recover: "#3FC7C0",
};

// Business-friendly display label per NIST function. Used for wizard step
// titles, the rail nav, and the results func-bars/priority list. The NIST
// function name (`fn`) itself is never shown to the user, but stays the
// scoring/aggregation key everywhere internally.
export const FUNC_DISPLAY = {
  Govern: "Your Team & Vendors",
  Identify: "Data & Systems",
  Protect: "Access & Identity",
  Detect: "Detection & Monitoring",
  Respond: "Incident Readiness",
  Recover: "Recovery & Continuity",
};

// Preserved verbatim from the original STEPS[].ref values (index.html) —
// do not "correct" these to full NIST CSF 2.0 subcategory sets without
// checking with Sarath first, since they may be intentionally abbreviated.
export const FUNC_REF = {
  Govern: "NIST CSF · GV.PO / GV.RR / GV.SC",
  Identify: "NIST CSF · ID.AM / ID.RA",
  Protect: "NIST CSF · PR.AC / PR.DS",
  Detect: "NIST CSF · DE.CM",
  Respond: "NIST CSF · RS.RP / RS.CO",
  Recover: "NIST CSF · RC.RP",
};

export function displayLabel(fn) {
  return FUNC_DISPLAY[fn] || fn;
}
