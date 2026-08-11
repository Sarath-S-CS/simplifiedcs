// Ported from the original scoreFunction/computeFlags/computeGapItems/
// computePriorities, adapted to read from session state + the graph engine
// instead of module-level `answers`/`STEPS` globals. Flag wording is
// preserved verbatim; only the answer-id references that changed because of
// the §5.2/§5.5 rebuild were updated (noted inline).
import { visibleNodes } from "./graph.js";
import { ASSESSMENT_FLOW } from "../data/assessment-flow.js";
import { FUNCTIONS } from "../data/categories.js";

export function scoreFunction(fn, state) {
  const qs = visibleNodes(ASSESSMENT_FLOW, state).filter((q) => q.fn === fn);
  if (qs.length === 0) return 0;
  const max = qs.length * 2;
  const got = qs.reduce((sum, q) => sum + (state.answers[q.id] ?? 0), 0);
  return Math.round((got / max) * 100);
}

export function computeFuncScores(state) {
  return FUNCTIONS.map((fn) => ({ fn, pct: scoreFunction(fn, state) }));
}

export function computeOverall(funcScores) {
  return Math.round(funcScores.reduce((a, f) => a + f.pct, 0) / funcScores.length);
}

export function computeFlags(state) {
  const answers = state.answers;
  const flags = [];
  if (answers.mfa === 0 && answers.vendorCount === 0) {
    flags.push("No MFA combined with 6+ unreviewed third-party vendors means any single leaked vendor credential grants direct, unmonitored access - this is a materially higher-risk combination than either gap alone.");
  }
  if (answers.siem === 0 && answers.irPlan !== 2) {
    flags.push("No centralized logging paired with an untested (or absent) incident response plan means a breach would likely be discovered late, by someone else, with no rehearsed process to contain it.");
  }
  if (answers.backupTest === 0 && answers.endpoint !== 2) {
    flags.push("Untested backups combined with incomplete endpoint protection is the specific combination that turns a routine ransomware infection into an unrecoverable one.");
  }
  if (answers.training === 0 && answers.mfa !== 2) {
    flags.push("No security awareness training alongside partial MFA coverage means phishing is both more likely to succeed and more likely to reach an unprotected account.");
  }
  if (answers.govRiskDecisions === 0 && answers.vendorCount === 0) {
    flags.push("Cybersecurity risk isn't factored into vendor decisions, and you already have 6+ vendors that were never formally reviewed - this is exactly how supply-chain risk enters unnoticed rather than through a single dramatic failure.");
  }
  if (answers.govPolicy === 0 && answers.irPlan !== 2) {
    flags.push("No leadership-approved security policy alongside no tested incident response plan means there's no top-down mandate driving readiness - response capability depends on individual initiative rather than an accountable program.");
  }
  if (answers.externalWebsite === "Yes" && answers.webDb === "Yes" && (answers.siem === 0 || answers.exfil === 0)) {
    flags.push("A public-facing web app that connects to a backend database, without centralized logging or outbound-traffic monitoring, is precisely the setup where a SQL injection or similar attack goes unnoticed long enough to exfiltrate the entire database.");
  }
  // Adapted for §5.2's team-structure rebuild: the direct equivalent of the
  // old "0 in-house staff + no formal management" combination is "outsourced
  // with no internal team, and not even a formal outsourced arrangement".
  if (
    answers.teamDedicated === "IT services outsourced with no internal IT team" &&
    answers.outsourcedStructure === "No formal outsourced arrangement - handled ad hoc"
  ) {
    flags.push("No internal IT/security team and no formal outsourced arrangement either means, in practice, no one is accountable for noticing or acting on any of the findings in this report.");
  }
  if ((answers.deployModel === "Cloud-only" || answers.deployModel === "Hybrid (on-prem + cloud)") && answers.mfa === 0) {
    flags.push("Cloud or hybrid infrastructure without MFA enforced is a materially larger exposure than the same gap on a purely on-premises setup - cloud admin consoles are reachable from anywhere a leaked password reaches.");
  }
  if (answers.rdpExposed === 0 && (answers.backupTest === 0 || answers.endpoint !== 2)) {
    flags.push("Remote admin access reachable directly from the internet is, on its own, one of the most common real-world ransomware entry points. Paired with the backup or endpoint gaps flagged elsewhere here, it meaningfully raises the odds of a successful, damaging intrusion - this exact combination appears repeatedly in ransomware case studies.");
  }
  if (answers.emailAuth === 0 && answers.training === 0) {
    flags.push("No enforced email authentication (SPF/DKIM/DMARC) combined with no security awareness training means phishing and business email compromise attempts are both more likely to arrive successfully and more likely to fool the person who receives them.");
  }
  if (answers.training !== 0 && answers.phishingSim === 0) {
    flags.push("Training is happening, but without simulated phishing tests there's no actual evidence it's working - the two are meant to reinforce each other, and skipping simulation means the training's real effectiveness is unmeasured.");
  }
  if (answers.hasOT === "Yes" && answers.otSegregation === "No - flat/shared network") {
    flags.push("An OT/ICS environment sharing a flat network with corporate IT means a routine IT compromise (phishing, ransomware) can pivot directly into industrial control systems - this is one of the most consequential architecture gaps an OT environment can have.");
  }
  if (answers.hasOT === "Yes" && answers.otRemoteAccess === "Yes, but not via a dedicated secure gateway") {
    flags.push("Remote access into OT systems without a dedicated, monitored gateway is a direct path from any compromised remote user's device straight into industrial control systems.");
  }
  if (answers.developsSoftware === "Yes" && answers.devsecopsMaturity === "No formal practice - security reviewed late, if at all" && answers.secretsManagement === "Hardcoded or stored in plain config files") {
    flags.push("No security gates in the software delivery pipeline, combined with hardcoded secrets in code or config files, is one of the most common ways credentials end up leaked in a public repository or a compromised build artifact.");
  }
  // Adapted for §5.5: containerUse/imageRegistry renamed usesContainers/containerImageScanning.
  if (answers.usesContainers && answers.usesContainers !== "No" && answers.containerImageScanning === "No") {
    flags.push("Running containerized workloads without scanning images for known vulnerabilities means you could be deploying publicly known, already-patched CVEs into production without realizing it.");
  }
  return flags;
}

export function computeGapItems(state) {
  const items = [];
  visibleNodes(ASSESSMENT_FLOW, state).forEach((q) => {
    const val = state.answers[q.id];
    const maxOpt = Math.max(...q.options.map((o) => o.v));
    if (val === undefined || val < maxOpt) {
      items.push({ fn: q.fn, gap: q.text, severity: maxOpt - (val ?? 0) });
    }
  });
  return items;
}

export function computePriorities(state) {
  return computeGapItems(state)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5);
}

export function verdictLabel(pct) {
  if (pct >= 80) return "Strong health";
  if (pct >= 55) return "Moderate exposure";
  if (pct >= 30) return "Elevated exposure";
  return "Critical exposure";
}
