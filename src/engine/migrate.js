// Brings answers saved by an earlier question set up to the current one.
// Used for in-progress saves (local-save.js) and saved reports opened from
// History (run-history.js). Each change is reported back as a plain-language
// note, shown with the report, so nothing is reinterpreted silently.
//
// Answer schema versions:
//   1 - methodology 1.x (before 2026-09). No "Not sure" option; some options
//       combined "No / not sure"; one scored question merged vendor count
//       with vendor review.
//   2 - methodology 2.0 (QUESTION_SET_VERSION "2026-09").
import { UNKNOWN } from "../data/controls.js";

export const ANSWER_SCHEMA_VERSION = 2;

// Questions whose v1 "No" option read "No / not sure" (or "No / unsure").
const V1_COMBINED_NO = ["dbEncryption", "emailAuth", "aiRagPermissions", "nis2Notify", "gdprBreach72h"];

export function migrateAnswers(answers, fromVersion = 1) {
  const out = JSON.parse(JSON.stringify(answers || {}));
  const notes = [];
  if (fromVersion >= ANSWER_SCHEMA_VERSION) return { answers: out, notes };

  // v1 vendorCount was scored: 2 "None", 1 "1-5, informally tracked",
  // 0 "6+, and not formally reviewed". It is now a context question plus a
  // separate scored review question.
  if (typeof out.vendorCount === "number") {
    const old = out.vendorCount;
    if (old === 2) {
      out.vendorCount = "None";
    } else if (old === 1) {
      out.vendorCount = "1–5";
      if (out.vendorAccessReview === undefined) out.vendorAccessReview = 1;
    } else {
      out.vendorCount = "6 or more";
      if (out.vendorAccessReview === undefined) out.vendorAccessReview = 0;
    }
    notes.push("Your earlier answer about third-party vendors has been split into two questions: how many have access, and whether they are reviewed. Both were filled in from your original answer.");
  }

  // v1 offered "Not sure" as a middle, partly-credited option here.
  if (out.pcidssSensitiveAuthData === 1) {
    out.pcidssSensitiveAuthData = UNKNOWN;
    notes.push('Your earlier "Not sure" answer about stored card authentication data is now recorded as "Not sure" instead of receiving partial credit.');
  }

  const combined = V1_COMBINED_NO.filter((id) => out[id] === 0);
  if (combined.length) {
    notes.push(`${combined.length} earlier answer${combined.length === 1 ? " was" : "s were"} "No / not sure", which is now two separate options. ${combined.length === 1 ? "It is" : "They are"} kept as "No" - change any that were really "Not sure".`);
  }
  return { answers: out, notes };
}
