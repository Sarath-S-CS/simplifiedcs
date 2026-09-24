# SimplifiedCS assessment methodology

**Methodology 2.0.0 · question set 2026-09** (constants `METHODOLOGY_VERSION` and
`QUESTION_SET_VERSION` in `src/data/controls.js`). Every report records both.

SimplifiedCS is a structured **self-assessment**. It grades what an organization says about
itself; it does not scan, test or audit anything, and it is not a compliance determination.

## 1. What each answer means

Every answer resolves to exactly one status (`src/engine/answers.js`):

| Status | Meaning | Counts toward coverage? |
|---|---|---|
| In place (met) | Strongest graded option | Yes - 2 points |
| Partly in place (partial) | Any graded option between strongest and weakest | Yes - 1 point |
| Not in place (gap) | Weakest graded option | Yes - 0 points |
| Not sure (unknown) | "Not sure" - offered on every scored question | No - listed as something to confirm |
| Not applicable | An explicit, justified "Not applicable" option, or a question hidden because an earlier answer rules it out | No |
| Not asked | Quick screening didn't ask it | No |
| Not answered | Required question left empty | No - counts against completeness |

"Not sure" is never treated as "No". Old combined options such as "No / not sure" were split.

**Stale answers.** If a later answer makes an earlier question irrelevant (for example "no public
web service" after answering the database questions), the earlier answer stays in the session
but is ignored everywhere - scores, findings, the AI request and saved history - and the report
says how many were ignored. Visibility is recomputed to a fixed point, so a chain of dependent
questions is dropped together.

## 2. What is scored

- **Scored questions** in six areas aligned to the NIST CSF 2.0 functions (`src/data/nist-questions.js`).
- **Setup answers that describe a control** are scored the same way (`PROFILE_CONTROLS` in
  `src/data/controls.js`): network segmentation, DevSecOps pipeline gates, secrets handling,
  container image scanning, container host hardening, hypervisor patching (only for on-premises
  hypervisors), workload segmentation, OT segregation, OT remote access, OT patching, OT monitoring.
- **Finding-only items** go into the findings register and action plan without changing coverage:
  no one owns post-incident recovery; IT/security support with no formal arrangement.
- **Every other setup answer** has an explicit designation - context (decides what applies or sets
  exposure), vendor (names a product), or informational (a context note in the report). A test
  (`test/control-catalog.test.js`) fails if a question is added without one.

## 3. Weights and critical controls

Weights are priority tiers, following the order of CISA's Cross-Sector Cybersecurity Performance
Goals and the CISA/MS-ISAC #StopRansomware Guide: **3** critical, **2** high impact, **1** standard.

A **critical gap** is a critical control that is not in place:

| Control | Critical when |
|---|---|
| MFA for remote/admin access | Not enforced; or admin-only while the organization is internet-reachable (cloud/hybrid, external devices or public services) |
| Remote-admin exposure | RDP or similar reachable directly from the internet |
| Endpoint protection | None |
| Patching | Ad hoc, unless internet exposure is ruled out (on-premises only, no external devices, no public services) |
| Privileged accounts | Shared or long-standing with no formal management |
| Backup isolation | No offline or immutable copy |
| Backup restore testing | Never tested |
| OT segregation | OT on a flat network with corporate IT |
| OT remote access | Remote access without a dedicated, monitored gateway |

## 4. Coverage, completeness and the reading

- **Coverage** = Σ(weight × points) / Σ(weight × 2), over controls with a definite answer. It is
  computed over all controls at once (areas are shown separately but the overall figure is not an
  average of area percentages, which let a two-question area count as much as a twenty-question one).
- **Completeness** = definite answers / applicable questions.

The reading is decided by rules **in this order** (`computeVerdict` in `src/engine/scoring.js`):

1. No definite answers → **Not enough information** (no percentage).
2. Any critical gap → **Critical gaps found**, whatever the coverage.
3. Any critical control answered "Not sure" → **Verification needed**.
4. Quick screening → **No critical gaps in this screening** (never a band).
5. Completeness below 60% → **Incomplete picture**.
6. Coverage bands: ≥85% **Strong foundations**, 65-84% **Moderate exposure**, 40-64% **Elevated
   exposure**, below 40% **High exposure**.

## 5. Combined findings

22 rules flag risky combinations of definite answers (for example no MFA plus unreviewed third
parties; a flat network plus backups that aren't isolated; untested backups plus incomplete
endpoint protection). They fire only on definite answers - "Not sure" never triggers a finding
that claims something is missing. Each has guidance: what could go wrong, a MITRE ATT&CK
technique where one genuinely applies, an interim step and a durable fix.

## 6. Findings register, ranking and action plan

Every gap, partial answer, "Not sure" and finding-only item is in the register - nothing is cut
off at a top five. Ranking (`computeFindings`) is additive and every factor becomes a visible
reason:

- base = weight × (1 for a gap, 0.5 for partial, 0.4 for "Not sure")
- +2 if it is a critical gap; +1 if it is a critical control answered "Not sure"
- +0.5 if it feeds a combined finding that fired
- ties keep questionnaire order

Each finding becomes an **action** with a stable ID (`A-<control>`), so tracking carries across
reports: title, trigger, why it ranks there, what could go wrong, interim step, durable fix,
suggested owner role, effort (Low: days / Medium: weeks / High: months), a target of **30 days**
(critical items, critical-weight controls, anything to confirm), **60 days** (high impact) or
**90 days** (standard), the evidence that shows it's done, and framework references. Actions export
to CSV (formula-injection safe) and JSON. Owner, due date, status, evidence notes, risk acceptance
and retest date can be tracked in the browser; tracking never changes answers or scores.

## 7. Quick screening

An allow-list of 14 required responses (`quick: true` in the data): industry, employee count,
deployment model, and 11 controls covering all six areas - role assignment, third-party review,
asset inventory, MFA, patching, endpoint protection, remote-admin exposure, detection time,
incident response plan, backup isolation, backup restore testing. A test walks every Quick path
and fails above 15. The screening report shows counts, not a percentage, and says how many
baseline controls were not asked. "Continue to the Full assessment" keeps every answer (the
questions and options are the same ones Full asks).

## 8. Framework references

Each control lists NIST CSF 2.0 subcategory IDs and CIS Controls v8.1 safeguard IDs. **These are
SimplifiedCS's own editorial alignment, not an official NIST or CIS crosswalk**, and not a
statement of compliance. Where no clean match exists the list is left empty rather than forced.
Every ID is checked against the official identifier lists stored in `src/data/references/`:

- NIST CSF 2.0 reference data export (NIST CPRT, `csf_2_0_0` JSON), retrieved 2026-09-24; 22
  categories and 106 current subcategories (withdrawn ones excluded).
- CIS Controls v8.1 Assessment Specification (cas.docs.cisecurity.org), retrieved 2026-09-24; 153
  safeguards.
- MITRE ATT&CK techniques are checked against ATT&CK Enterprise v19.2 (`test/fixtures/`).

Section labels use current CSF 2.0 categories; the old "PR.AC" and "RS.RP" labels (CSF 1.1
categories that don't exist in CSF 2.0) were replaced.

## 9. Versioning and history

Saved reports store the answers and a compact summary of the report as produced, including the
methodology version. Reports are compared ("change since last time") only with the previous
report of the same methodology and mode. Reports from methodology 1.x are listed with their
original result and, when opened, are rebuilt from their answers under 2.0 and clearly labelled
as recalculated. Saved answers from 1.x are migrated with notes shown to the visitor
(`src/engine/migrate.js`).

## 10. Change note: methodology 1.x → 2.0.0 (September 2026)

| 1.x behaviour | Problem | 2.0 |
|---|---|---|
| Unanswered and "not sure" counted as 0, same as "No" | A gap of knowledge looked like a gap of control | Separate statuses; coverage over definite answers; completeness shown |
| Overall % = average of six area percentages; verdict from % alone | A cloud org with no MFA and every other answer at best scored 99% "Strong health" | Weighted coverage over all controls; critical gaps decide the reading first |
| Setup answers (DevSecOps, secrets, containers, hypervisors, OT) never scored | Weak answers there scored 100% with no gaps | Scored as controls; every setup answer has a designation |
| "How many vendors" and "are they reviewed" merged; "None" scored best | A count isn't a control | Vendor count is context; third-party review is scored (N/A with no third parties) |
| AI governance asked of everyone | Organizations not using AI had no truthful answer | Asked only when AI use isn't ruled out |
| Hypervisor patching asked for cloud VMs | Scored orgs on something their provider operates | On-premises hypervisors only |
| Stale answers from hidden questions still fired findings | Contradictory reports | Effective answers only, computed to a fixed point |
| Top-five priorities, ties in question order | Governance paperwork outranked exposed RDP | Explainable ranking of every finding with reasons |
| Quick = Full minus vendor names (~52 responses) | Not quick; claimed "full strength" | 14-response screening with an honest screening result |
| CSF 1.1 codes (PR.AC, RS.RP) in a "CSF 2.0" UI | Inaccurate references | Verified CSF 2.0 / CIS v8.1 IDs per control |

## 11. Limitations

- Self-reported answers; optimism and misunderstanding aren't detectable beyond the listed
  contradiction checks.
- Weights and critical rules are judgments informed by CISA guidance, not measured risk.
- Framework references are an alignment aid, not audit coverage.
- The AI section is optional, AI-generated and can be wrong; vulnerability items are limited to
  public records the server retrieved and cited.
