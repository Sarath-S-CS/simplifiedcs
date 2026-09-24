// Answers that can't all be true at once (or are very unlikely to be).
// They don't change any score - the report lists them under "Answers worth
// double-checking" so the reader knows which parts of the picture may be
// off, and the contradiction count is part of the report's limitations.
// Always run on effectiveState() answers, so a stale hidden answer can't
// create a false contradiction.

import { OTHER } from "../data/vendors.js";

const HEADCOUNT_FIELDS = ["itOnlyHeadcount", "itHeadcountSeparate", "cybersecHeadcount", "combinedHeadcount"];

export function findContradictions(answers) {
  const out = [];
  const add = (id, text, fields) => out.push({ id, text, fields });

  const d = Array.isArray(answers.dayToDay) ? answers.dayToDay : [];
  if (d.includes("inhouse-all") && d.some((x) => x !== "inhouse-all" && x !== OTHER)) {
    add(
      "inhouse-and-outsourced",
      'Day-to-day security is described both as "managed entirely in-house, nothing outsourced" and as partly outsourced. Follow-up questions for both were asked; check which describes your setup.',
      ["dayToDay"]
    );
  }

  if (answers.irPlan === 2 && answers.irTeam === 0) {
    add("tested-ir-plan-no-contact", "The incident response plan is described as tested annually, but there is no designated incident response contact or team. A tested plan normally names who leads the response.", ["irPlan", "irTeam"]);
  }

  if (answers.employeeCount === "1–10" && HEADCOUNT_FIELDS.some((f) => answers[f] === "10+")) {
    add("team-larger-than-org", "The IT or security team is described as 10+ people in an organization of 1-10 employees/users.", ["employeeCount", ...HEADCOUNT_FIELDS.filter((f) => answers[f] === "10+")]);
  }

  if ((answers.phishingSim === 1 || answers.phishingSim === 2) && answers.training === 0) {
    add("phishing-sim-without-training", "Phishing simulations are run, but security awareness training is never provided. Simulations usually sit inside a training program; if training does exist, update that answer.", ["phishingSim", "training"]);
  }

  if (answers.backupTest === 2 && answers.bcdr === 0 && answers.backupIsolation === 0) {
    add(
      "restore-tests-without-recovery-basics",
      "Backups are restore-tested quarterly, yet there is no continuity/recovery plan and backups aren't isolated. That combination is possible but unusual - worth confirming.",
      ["backupTest", "bcdr", "backupIsolation"]
    );
  }
  return out;
}
