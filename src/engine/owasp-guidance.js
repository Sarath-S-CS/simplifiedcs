// CONSOLIDATED-WORK-BRIEF.md §2: a narrow, conditional OWASP Top 10
// cross-check - deliberately NOT applied to every finding. OWASP Top 10 is
// specifically about web application vulnerabilities; most of this
// assessment's findings (backup practices, MFA, training) have nothing to
// do with a web application, and forcing an OWASP tag onto them would
// repeat a mistake already corrected once for MITRE mapping earlier in
// this project. This only ever fires when the organization indicated it
// develops custom/web-facing software (answers.developsSoftware === "Yes")
// - the same gate this brief names explicitly - regardless of whether the
// specific flag/question being tagged is itself about the dev/DevSecOps
// branch (e.g. an exposed-database finding still only gets tagged when
// the org also builds its own software, since OWASP's domain is
// vulnerabilities in software an organization builds, not one it merely
// operates).
//
// Deliberately small and high-confidence rather than exhaustive: only
// flags/questions genuinely about a web-application-layer concern got a
// mapping. Each points to the exact Playbooks entry (by its real `ref`,
// e.g. "A02:2021") that already carries the MITRE mapping and concrete
// steps for that category - this doesn't duplicate that content, it
// links to it, the same way Home's How It Works section already says
// fixes get implemented "using the matching Runbook or Playbook."
export const OWASP_FLAG_MAP = {
  "hardcoded-secrets-no-gates": { ref: "A08:2021", title: "Software and Data Integrity Failures" },
  "exposed-db-app-no-monitoring": { ref: "A09:2021", title: "Security Logging and Monitoring Failures" },
  "db-unencrypted-weak-access": { ref: "A02:2021", title: "Cryptographic Failures" },
};

export const OWASP_QUESTION_MAP = {
  dbEncryption: { ref: "A02:2021", title: "Cryptographic Failures" },
  dbAccessControl: { ref: "A01:2021", title: "Broken Access Control" },
  dbPatching: { ref: "A06:2021", title: "Vulnerable and Outdated Components" },
};

function developsSoftware(answers) {
  return answers?.developsSoftware === "Yes";
}

export function owaspForFlag(flagId, answers) {
  if (!developsSoftware(answers)) return null;
  return OWASP_FLAG_MAP[flagId] || null;
}

export function owaspForQuestion(questionId, answers) {
  if (!developsSoftware(answers)) return null;
  return OWASP_QUESTION_MAP[questionId] || null;
}
