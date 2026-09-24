// Scoring, methodology 2.0.0 (see METHODOLOGY_VERSION in ../data/controls.js
// and docs/methodology.md for the visitor-facing explanation).
//
// What changed from 1.x, and why:
//   - Coverage and completeness are separate numbers. Coverage is how much of
//     the protection you told us about is in place; completeness is how much
//     of the applicable assessment you could answer. 1.x folded unanswered
//     and "not sure" into the same zero as "No".
//   - Critical gaps decide the verdict before any percentage does. In 1.x a
//     cloud organization with no MFA, and every other answer at best, scored
//     99% "Strong health".
//   - Every security-relevant answer is a scored control, a finding-only
//     item, or an explicitly unscored designation (controls.js). 1.x ignored
//     weak DevSecOps, container and OT answers entirely (100%, no gaps).
//   - Weights are applied inside the percentage, so one critical gap counts
//     for more than one standard gap. The overall figure is computed across
//     all controls, not averaged across the six areas (which let a two-
//     question area count as much as a twenty-question one).
//   - Everything runs on effectiveState() answers (./answers.js), so answers
//     to questions that no longer apply can't affect anything.
import { ASSESSMENT_FLOW } from "../data/assessment-flow.js";
import { PROFILE_SCREENS } from "../data/profile-flow.js";
import { FUNCTIONS, FUNC_DISPLAY } from "../data/categories.js";
import { CONTROL_META, PROFILE_CONTROLS, FINDING_ITEMS, STATUS, STATUS_LABELS, METHODOLOGY_VERSION } from "../data/controls.js";
import {
  reachableNodeIds,
  effectiveState,
  scoredStatus,
  profileControlStatus,
  isKnown,
  chosenOptionLabel,
  internetExposure,
  STATUS_POINTS,
} from "./answers.js";

export { METHODOLOGY_VERSION };

const PROFILE_NODE_INDEX = new Map(PROFILE_SCREENS.flatMap((s) => [...s.flow.index.values()].map((n) => [n.id, n])));

const CLOUD = (a) => a.deployModel === "Cloud-only" || a.deployModel === "Hybrid (on-prem + cloud)";

// ---------- critical rules ----------
// A critical gap is a weak answer on a control that, on its own, commonly
// decides whether an attack succeeds or an organization can recover. Any
// critical gap sets the verdict to "Critical gaps found", whatever the
// percentage. Each rule returns the reason shown to the visitor, or null.
const CRITICAL_RULES = {
  mfa: (status, a) => {
    if (status === STATUS.GAP) return "MFA isn't enforced for remote or admin access, so a single leaked or guessed password is enough to log in.";
    if (status === STATUS.PARTIAL && internetExposure(a) === "yes")
      return "MFA covers admin accounts only, and you have internet-reachable services (cloud or remote access), so ordinary accounts can be taken over with a password alone.";
    return null;
  },
  rdpExposed: (status) => (status === STATUS.GAP ? "Remote-admin access is reachable directly from the internet - one of the most common ransomware entry points." : null),
  backupIsolation: (status) => (status === STATUS.GAP ? "Backups aren't offline or immutable, so ransomware that reaches the network can encrypt or delete them too." : null),
  backupTest: (status) => (status === STATUS.GAP ? "Backups have never been test-restored, so recovery after an incident is unproven." : null),
  endpoint: (status) => (status === STATUS.GAP ? "Devices have no endpoint protection to detect or stop malware and ransomware." : null),
  patching: (status, a) => {
    if (status !== STATUS.GAP) return null;
    const exposure = internetExposure(a);
    if (exposure === "none") return null;
    return exposure === "yes"
      ? "Patching is ad hoc while systems are reachable from the internet - known, already-fixed flaws stay exploitable."
      : "Patching is ad hoc, and internet exposure wasn't ruled out - known, already-fixed flaws may stay exploitable.";
  },
  privAccountMgmt: (status) => (status === STATUS.GAP ? "Privileged accounts are shared or long-standing with no formal management." : null),
  otSegregation: (status) => (status === STATUS.GAP ? "The OT network shares a flat network with corporate IT, so an ordinary IT compromise can reach industrial systems." : null),
  otRemoteAccess: (status) => (status === STATUS.GAP ? "Remote access reaches OT systems without a dedicated, monitored gateway." : null),
};

export const CRITICAL_CONTROL_IDS = Object.keys(CRITICAL_RULES);

// ---------- controls ----------
// Every control in scope for this run, with its status. Framework questions
// for frameworks not selected are out of scope and omitted entirely.
export function assessControls(state) {
  const { ids } = reachableNodeIds(state);
  const eff = effectiveState(state);
  const a = eff.answers;
  const out = [];

  for (const id of ASSESSMENT_FLOW.order) {
    const q = ASSESSMENT_FLOW.index.get(id);
    if (q.framework && !a[q.framework]) continue;
    const meta = CONTROL_META[id];
    let status;
    if (ids.has(id)) status = scoredStatus(q, a[id]);
    else if (state.quickMode && !q.quick && (!q.visibleIf || q.visibleIf(a))) status = STATUS.NOT_ASKED;
    else status = STATUS.NA;
    out.push(controlResult({ id, source: "question", fn: q.fn, text: q.text, meta, status, value: a[id], chosen: chosenOptionLabel(q, a[id]), quick: q.quick }, a));
  }

  for (const [id, pc] of Object.entries(PROFILE_CONTROLS)) {
    const node = PROFILE_NODE_INDEX.get(id);
    if (!node) continue;
    let status;
    if (ids.has(id)) status = profileControlStatus(id, a[id]);
    else if (state.quickMode) continue; // applicability depends on setup questions Quick doesn't ask
    else status = STATUS.NA;
    const chosen = status === STATUS.UNANSWERED ? "Not answered" : a[id + "__isOther"] ? `Other: ${a[id]}` : String(a[id] ?? "");
    out.push(controlResult({ id, source: "profile", fn: pc.fn, text: pc.text, question: node.text, meta: pc, status, value: a[id], chosen, quick: Boolean(node.quick) }, a));
  }
  return out;
}

function controlResult({ id, source, fn, text, question, meta, status, value, chosen, quick }, answers) {
  const rule = CRITICAL_RULES[id];
  const criticalReason = rule ? rule(status, answers) : null;
  return {
    id,
    source,
    fn,
    area: FUNC_DISPLAY[fn],
    text,
    question: question || text,
    weight: meta.weight,
    status,
    statusLabel: STATUS_LABELS[status],
    value: value === undefined ? null : value,
    chosen,
    csf: meta.csf,
    cis: meta.cis,
    quick: Boolean(quick),
    critical: Boolean(criticalReason),
    criticalReason,
    criticalControl: Boolean(rule),
  };
}

// ---------- coverage / completeness ----------
function summarize(controls) {
  const counts = { met: 0, partial: 0, gap: 0, unknown: 0, "not-applicable": 0, "not-asked": 0, unanswered: 0 };
  let got = 0;
  let max = 0;
  for (const c of controls) {
    counts[c.status]++;
    if (isKnown(c.status)) {
      got += c.weight * STATUS_POINTS[c.status];
      max += c.weight * 2;
    }
  }
  const known = counts.met + counts.partial + counts.gap;
  const applicable = known + counts.unknown + counts.unanswered;
  return {
    counts,
    known,
    applicable,
    coverage: max ? Math.round((got / max) * 100) : null,
    completeness: applicable ? known / applicable : null,
  };
}

export function computeAreaScores(controls) {
  return FUNCTIONS.map((fn) => ({ fn, area: FUNC_DISPLAY[fn], ...summarize(controls.filter((c) => c.fn === fn)) }));
}

export function computeOverallScore(controls) {
  return summarize(controls);
}

// ---------- verdict ----------
// Deliberately rule-ordered, not just banded: a percentage can't outvote a
// critical gap, an unverified critical control, or a mostly-unanswered
// assessment.
export const VERDICTS = {
  insufficient: "Not enough information",
  "critical-gaps": "Critical gaps found",
  verify: "Verification needed",
  screened: "No critical gaps in this screening",
  incomplete: "Incomplete picture",
  strong: "Strong foundations",
  moderate: "Moderate exposure",
  elevated: "Elevated exposure",
  high: "High exposure",
};

export function computeVerdict({ overall, criticalGaps, verification, quickMode }) {
  const v = (key, summary) => ({ key, label: VERDICTS[key], summary });
  if (!overall.known) return v("insufficient", "No control was answered with a definite answer, so there is nothing to score yet.");
  if (criticalGaps.length)
    return v("critical-gaps", `${criticalGaps.length} critical control${criticalGaps.length === 1 ? " is" : "s are"} not in place. Fix ${criticalGaps.length === 1 ? "it" : "these"} first - the percentage alone understates the risk.`);
  if (verification.length)
    return v("verify", `${verification.length} critical control${verification.length === 1 ? " was" : "s were"} answered "Not sure". Confirm ${verification.length === 1 ? "it" : "them"} before relying on this reading.`);
  if (quickMode) return v("screened", "Quick screening checks only a small set of core controls. It is not a full reading - run the Full assessment for coverage of every area.");
  if (overall.completeness < 0.6) return v("incomplete", `Only ${Math.round(overall.completeness * 100)}% of applicable questions have a definite answer, so the percentage may not reflect your real posture.`);
  if (overall.coverage >= 85) return v("strong", "Core controls are in place with no critical gaps. Keep verifying they work as described.");
  if (overall.coverage >= 65) return v("moderate", "No critical gaps, but several important controls are missing or partial.");
  if (overall.coverage >= 40) return v("elevated", "No critical gaps, but many controls are missing or partial.");
  return v("high", "No single critical gap, but most controls are missing or partial.");
}

// ---------- combined findings (compounding-risk flags) ----------
// Flags fire only on definite answers: "Not sure" never triggers a finding
// that claims something is missing.
export function computeFlags(state) {
  const eff = effectiveState(state);
  const a = eff.answers;
  const idx = ASSESSMENT_FLOW.index;
  const st = (id) => (idx.has(id) ? scoredStatus(idx.get(id), a[id]) : profileControlStatus(id, a[id]));
  const is = (id, ...statuses) => statuses.includes(st(id));
  const G = STATUS.GAP;
  const P = STATUS.PARTIAL;
  const M = STATUS.MET;
  const flags = [];
  const add = (id, text) => flags.push({ id, text, inputs: FLAG_INPUTS[id] || [] });

  if (is("mfa", G) && is("vendorAccessReview", G))
    add("mfa-vendor-exposure", "No MFA combined with third parties whose access is never reviewed means any single leaked vendor credential grants direct, unmonitored access - a materially higher-risk combination than either gap alone.");
  if (is("siem", G) && is("irPlan", G, P))
    add("no-logging-no-ir", "No centralized logging paired with an untested (or absent) incident response plan means a breach would likely be discovered late, by someone else, with no rehearsed process to contain it.");
  if (is("backupTest", G) && is("endpoint", G, P))
    add("untested-backup-weak-endpoint", "Untested backups combined with incomplete endpoint protection is the specific combination that turns a routine ransomware infection into an unrecoverable one.");
  if (is("training", G) && is("mfa", G, P))
    add("no-training-partial-mfa", "No security awareness training alongside missing or partial MFA means phishing is both more likely to succeed and more likely to reach an account with no second factor.");
  if (is("govRiskDecisions", G) && is("vendorAccessReview", G))
    add("no-vendor-risk-review", "Cybersecurity risk isn't factored into vendor decisions, and third parties that already have access were never reviewed - this is how supply-chain risk enters unnoticed rather than through a single dramatic failure.");
  if (is("govPolicy", G) && is("irPlan", G, P))
    add("no-policy-no-ir", "No leadership-approved security policy alongside no tested incident response plan means there's no top-down mandate driving readiness - response capability depends on individual initiative rather than an accountable program.");
  if (a.externalWebsite === "Yes" && a.webDb === "Yes" && (is("siem", G) || is("exfil", G))) {
    const missing = [is("siem", G) && "centralized logging", is("exfil", G) && "outbound-traffic monitoring"].filter(Boolean).join(" or ");
    add("exposed-db-app-no-monitoring", `A public-facing web app that connects to a backend database, without ${missing}, is the setup where a SQL injection or similar attack can go unnoticed long enough to exfiltrate the database.`);
  }
  if (a.webDb === "Yes" && is("dbEncryption", G) && is("dbAccessControl", G))
    add("db-unencrypted-weak-access", "A database that isn't encrypted at rest, combined with routine application access through shared or admin credentials rather than least-privilege accounts, means a single leaked credential - or a misplaced backup - exposes the entire dataset in plain, readable form, not just whatever the compromised account was meant to touch.");
  if (a.aiCustomAppRAG === "Yes" && is("aiRagPermissions", G) && is("aiRiskOwnership", G))
    add("ai-rag-no-ownership", "A custom AI application retrieves your own internal documents without respecting the access permissions those documents already have, and there's no named owner for AI-related risk - meaning this over-exposure is both actively happening and unlikely to be noticed by anyone specifically responsible for catching it.");
  if (a.teamDedicated === "IT services outsourced with no internal IT team" && a.outsourcedStructure === "No formal outsourced arrangement - handled ad hoc")
    add("no-accountability", "No internal IT/security team and no formal outsourced arrangement either means, in practice, no one is accountable for noticing or acting on any of the findings in this report.");
  if (CLOUD(a) && is("mfa", G))
    add("cloud-no-mfa", "Cloud or hybrid infrastructure without MFA enforced is a materially larger exposure than the same gap on a purely on-premises setup - cloud admin consoles are reachable from anywhere a leaked password reaches.");
  if (is("rdpExposed", G) && (is("backupTest", G) || is("endpoint", G, P)))
    add("rdp-exposed-ransomware-path", "Remote admin access reachable directly from the internet is, on its own, one of the most common real-world ransomware entry points. Paired with untested backups or incomplete endpoint protection, it meaningfully raises the odds of a successful, damaging intrusion.");
  if (is("emailAuth", G) && is("training", G))
    add("no-email-auth-no-training", "No enforced email authentication (SPF/DKIM/DMARC) combined with no security awareness training means phishing and business email compromise attempts are both more likely to arrive successfully and more likely to fool the person who receives them.");
  if (is("training", M, P) && is("phishingSim", G))
    add("training-no-phishing-sim", "Training is happening, but without simulated phishing tests there's no actual evidence it's working - the two are meant to reinforce each other, and skipping simulation means the training's real effectiveness is unmeasured.");
  if (is("otSegregation", G))
    add("ot-flat-network", "An OT/ICS environment sharing a flat network with corporate IT means a routine IT compromise (phishing, ransomware) can pivot directly into industrial control systems - one of the most consequential architecture gaps an OT environment can have.");
  if (is("otRemoteAccess", G))
    add("ot-remote-access-unsecured", "Remote access into OT systems without a dedicated, monitored gateway is a direct path from any compromised remote user's device straight into industrial control systems.");
  if (a.developsSoftware === "Yes" && is("devsecopsMaturity", G) && is("secretsManagement", G))
    add("hardcoded-secrets-no-gates", "No security gates in the software delivery pipeline, combined with hardcoded secrets in code or config files, is one of the most common ways credentials end up leaked in a public repository or a compromised build artifact.");
  if (is("containerImageScanning", G))
    add("unscanned-container-images", "Running containerized workloads without scanning images for known vulnerabilities means you could be deploying publicly known, already-patched CVEs into production without realizing it.");
  if (is("networkArch", G) && is("backupIsolation", G))
    add("flat-network-backups-exposed", "A flat network combined with backups that aren't offline or immutable means ransomware that lands on any one machine can usually reach - and encrypt or delete - the backups as well.");
  if (is("aiDeepfakeTraining", G) && is("aiVerificationStep", G))
    add("deepfake-no-verification", "Staff haven't been trained on AI-generated phishing or voice/video impersonation, and payment changes or other sensitive requests don't require out-of-band verification - so a convincing impersonation can go straight from a fake call or message to a real payment.");
  if (a.externalDevices === "Yes" && is("vulnScanning", G))
    add("exposed-devices-no-scanning", "Internet-facing VPN gateways, firewalls or remote-access appliances with no vulnerability scanning means a newly disclosed flaw in those devices - a frequent ransomware entry point - can go unnoticed until it's exploited.");
  if (is("privAccountMgmt", G) && is("privSeparation", G))
    add("shared-admin-no-separation", "Privileged accounts are shared or long-standing, and admins use the same account for everyday work - so one phished inbox or infected laptop can hand over administrator access directly, with no reliable way to tell who did what.");
  return flags;
}

// Which controls feed each combined finding. A gap that is part of a flag
// that fired gets a ranking boost - it's doing double duty in this
// organization's risk picture.
export const FLAG_INPUTS = {
  "mfa-vendor-exposure": ["mfa", "vendorAccessReview"],
  "no-logging-no-ir": ["siem", "irPlan"],
  "untested-backup-weak-endpoint": ["backupTest", "endpoint"],
  "no-training-partial-mfa": ["training", "mfa"],
  "no-vendor-risk-review": ["govRiskDecisions", "vendorAccessReview"],
  "no-policy-no-ir": ["govPolicy", "irPlan"],
  "exposed-db-app-no-monitoring": ["siem", "exfil"],
  "db-unencrypted-weak-access": ["dbEncryption", "dbAccessControl"],
  "ai-rag-no-ownership": ["aiRagPermissions", "aiRiskOwnership"],
  "no-accountability": ["outsourcedStructure"],
  "cloud-no-mfa": ["mfa"],
  "rdp-exposed-ransomware-path": ["rdpExposed", "backupTest", "endpoint"],
  "no-email-auth-no-training": ["emailAuth", "training"],
  "training-no-phishing-sim": ["phishingSim"],
  "ot-flat-network": ["otSegregation"],
  "ot-remote-access-unsecured": ["otRemoteAccess"],
  "hardcoded-secrets-no-gates": ["devsecopsMaturity", "secretsManagement"],
  "unscanned-container-images": ["containerImageScanning"],
  "flat-network-backups-exposed": ["networkArch", "backupIsolation"],
  "deepfake-no-verification": ["aiDeepfakeTraining", "aiVerificationStep"],
  "exposed-devices-no-scanning": ["vulnScanning"],
  "shared-admin-no-separation": ["privAccountMgmt", "privSeparation"],
};

// ---------- findings register + ranking ----------
// Ranking, explainable by construction - each factor adds a reason the
// visitor sees:
//   base      = weight (1-3) x how far from in place (gap 1, partial 0.5,
//               "Not sure" 0.4 - an unverified control is a smaller but real
//               risk, ranked as a verification task)
//   + 2       if it is a critical gap
//   + 1       if it is a critical control answered "Not sure"
//   + 0.5     if it feeds a combined finding that fired
// Ties keep questionnaire order (Array.prototype.sort is stable).
const STATUS_FACTOR = { gap: 1, partial: 0.5, unknown: 0.4 };

export function computeFindings(state, controls = assessControls(state), flags = computeFlags(state)) {
  const eff = effectiveState(state).answers;
  const byInput = new Map();
  for (const f of flags) for (const id of f.inputs) byInput.set(id, [...(byInput.get(id) || []), f.id]);

  const items = [];
  for (const c of controls) {
    if (!(c.status in STATUS_FACTOR)) continue;
    const reasons = [];
    const inFlags = byInput.get(c.id) || [];
    let score = c.weight * STATUS_FACTOR[c.status];
    if (c.status === STATUS.UNKNOWN) reasons.push('Answered "Not sure" - confirm whether this is in place');
    else reasons.push(`Your answer: "${c.chosen}"`);
    if (c.weight === 3) reasons.push("Critical control (CISA Performance Goals / #StopRansomware priority)");
    else if (c.weight === 2) reasons.push("High-impact control");
    if (c.critical) {
      score += 2;
      reasons.push(c.criticalReason);
    }
    if (c.status === STATUS.UNKNOWN && c.criticalControl) {
      score += 1;
      reasons.push("Unverified critical control");
    }
    if (inFlags.length && c.status !== STATUS.UNKNOWN) {
      score += 0.5;
      reasons.push(`Part of ${inFlags.length} combined finding${inFlags.length === 1 ? "" : "s"} below`);
    }
    items.push({
      id: c.id,
      kind: c.status === STATUS.UNKNOWN ? "verify" : "control",
      fn: c.fn,
      area: c.area,
      title: c.text,
      question: c.question,
      status: c.status,
      statusLabel: c.statusLabel,
      chosen: c.chosen,
      weight: c.weight,
      critical: c.critical,
      criticalReason: c.criticalReason,
      csf: c.csf,
      cis: c.cis,
      inFlags,
      reasons,
      priorityScore: Math.round(score * 100) / 100,
    });
  }

  for (const [id, fi] of Object.entries(FINDING_ITEMS)) {
    if (!fi.when(eff[id])) continue;
    const inFlags = byInput.get(id) || [];
    const reasons = [`Your answer: "${eff[id]}"`, "Finding-only item - not part of the coverage percentage"];
    let score = fi.weight;
    if (inFlags.length) {
      score += 0.5;
      reasons.push(`Part of ${inFlags.length} combined finding${inFlags.length === 1 ? "" : "s"} below`);
    }
    items.push({
      id,
      kind: "finding",
      fn: fi.fn,
      area: FUNC_DISPLAY[fi.fn],
      title: fi.text,
      question: PROFILE_NODE_INDEX.get(id)?.text || fi.text,
      status: STATUS.GAP,
      statusLabel: "Finding",
      chosen: String(eff[id]),
      weight: fi.weight,
      critical: false,
      criticalReason: null,
      csf: fi.csf,
      cis: fi.cis,
      inFlags,
      reasons,
      priorityScore: score,
    });
  }

  return items.sort((x, y) => y.priorityScore - x.priorityScore).map((item, i) => ({ ...item, rank: i + 1 }));
}
