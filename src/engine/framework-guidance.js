// §5.6 — turns a selected compliance framework into actual results-page
// guidance: a short, accurate summary of what that framework specifically
// requires, plus the concrete gaps found in that framework's own injected
// questions (not generic boilerplate - tied to what was actually answered).
import { FRAMEWORKS } from "../data/frameworks.js";
import { NIST_QUESTIONS } from "../data/nist-questions.js";
import { STATUS } from "../data/controls.js";
import { effectiveState, scoredStatus, chosenOptionLabel } from "./answers.js";

const FRAMEWORK_SUMMARY = {
  iso27001:
    "ISO 27001 certification requires a functioning ISMS with periodic management review and a documented risk assessment - both are exactly what the two ISO-tagged questions in this assessment measure.",
  nis2: "NIS2 carries personal liability for management bodies and a strict 24-hour early-warning notification duty - the NIS2-tagged questions above are among the most commonly failed requirements in early readiness assessments.",
  soc2: "A SOC 2 Type II audit specifically tests whether your change-management and evidence-logging controls operated effectively over the review period, not just whether they exist on paper.",
  hipaa:
    "HIPAA's Security Rule requires a documented risk analysis, executed Business Associate Agreements with every vendor touching PHI, and encryption of PHI - gaps in any of these are among the most commonly cited findings in HHS OCR enforcement actions.",
  gdpr: "GDPR requires a documented lawful basis for processing (a ROPA), a working data-subject-rights process, and the ability to notify a supervisory authority within 72 hours of a breach.",
  sox: "SOX Section 404 requires effective internal controls over financial reporting - segregation of duties, periodic access reviews, and tamper-evident audit trails on financial systems are the IT general controls auditors test first.",
  cyberessentials:
    "Cyber Essentials certification is scored against five specific technical control themes. The questions tagged for it here cover the two themes not already assessed elsewhere in this instrument (boundary firewalls and secure configuration) - malware protection and patch management are covered by the Endpoint and Patching questions above.",
  pcidss:
    "PCI DSS compliance hinges on keeping the cardholder data environment segmented, never retaining prohibited authentication data post-authorization, and running the required quarterly ASV scans.",
};

// Gaps are definite "not in place" / "partly in place" answers; "Not sure"
// answers are listed separately so they aren't presented as failures.
export function computeFrameworkRecommendations(state) {
  const answers = effectiveState(state).answers;
  return FRAMEWORKS.filter((f) => answers[f.id]).map((f) => {
    const questions = NIST_QUESTIONS.filter((q) => q.framework === f.id);
    const gaps = [];
    const unknown = [];
    for (const q of questions) {
      const status = scoredStatus(q, answers[q.id]);
      // `id` lets the report reuse the same QUESTION_GUIDANCE entry as the
      // findings register, so a compliance gap gets identical guidance.
      const item = { id: q.id, question: q.text, chosen: chosenOptionLabel(q, answers[q.id]), status };
      if (status === STATUS.GAP || status === STATUS.PARTIAL) gaps.push(item);
      else if (status === STATUS.UNKNOWN) unknown.push(item);
    }
    return {
      id: f.id,
      name: f.name,
      summary: FRAMEWORK_SUMMARY[f.id] || f.desc,
      gaps,
      unknown,
      questionCount: questions.length,
    };
  });
}
