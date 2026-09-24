// The controls catalog must stay complete and truthful: every scored
// question has catalog metadata and guidance, every framework reference is a
// real, current identifier, every MITRE ATT&CK technique is current, and
// every setup question has an explicit designation (so no answer can
// silently fall out of the report).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NIST_QUESTIONS } from "../src/data/nist-questions.js";
import { CONTROL_META, PROFILE_CONTROLS, FINDING_ITEMS, PROFILE_DESIGNATIONS, INFORMATIONAL_NOTES } from "../src/data/controls.js";
import { CSF_SUBCATEGORIES, CSF_CATEGORIES } from "../src/data/references/csf-2.0.js";
import { CIS_SAFEGUARDS } from "../src/data/references/cis-v8.1.js";
import { FUNC_REF, FUNCTIONS } from "../src/data/categories.js";
import { PROFILE_SCREENS } from "../src/data/profile-flow.js";
import { FLAG_GUIDANCE, QUESTION_GUIDANCE } from "../src/engine/mitre-guidance.js";
import { FLAG_INPUTS } from "../src/engine/scoring.js";

const ATTACK = JSON.parse(readFileSync(new URL("./fixtures/attack-enterprise-techniques.json", import.meta.url), "utf8")).techniques;

const allCatalog = () => [
  ...Object.entries(CONTROL_META),
  ...Object.entries(PROFILE_CONTROLS),
  ...Object.entries(FINDING_ITEMS),
];

test("reference lists match the official counts (CSF 2.0: 22 categories, 106 subcategories; CIS v8.1: 153 safeguards)", () => {
  assert.equal(Object.keys(CSF_CATEGORIES).length, 22);
  assert.equal(Object.keys(CSF_SUBCATEGORIES).length, 106);
  assert.equal(Object.keys(CIS_SAFEGUARDS).length, 153);
  // Withdrawn CSF 1.1 categories must not be treated as current.
  for (const gone of ["PR.AC", "PR.IP", "RS.RP", "DE.DP", "ID.BE"]) assert.ok(!(gone in CSF_CATEGORIES), gone);
});

test("every scored question has catalog metadata, and every catalog entry is a real question", () => {
  const ids = new Set(NIST_QUESTIONS.map((q) => q.id));
  for (const q of NIST_QUESTIONS) assert.ok(CONTROL_META[q.id], `no catalog entry for ${q.id}`);
  for (const id of Object.keys(CONTROL_META)) assert.ok(ids.has(id), `catalog entry ${id} has no question`);
});

test("every CSF and CIS reference in the catalog is a real, current identifier", () => {
  for (const [id, entry] of allCatalog()) {
    for (const ref of entry.csf) assert.ok(CSF_SUBCATEGORIES[ref], `${id}: ${ref} is not a current CSF 2.0 subcategory`);
    for (const ref of entry.cis) assert.ok(CIS_SAFEGUARDS[ref], `${id}: ${ref} is not a CIS v8.1 safeguard`);
    assert.ok([1, 2, 3].includes(entry.weight), `${id}: weight`);
    assert.ok(entry.action?.title && entry.action.role && entry.action.effort && entry.action.evidence, `${id}: action metadata`);
  }
});

test("each section's CSF reference line names only current CSF 2.0 categories", () => {
  for (const fn of FUNCTIONS) {
    const cats = FUNC_REF[fn].replace(/^NIST CSF 2\.0 · /, "").split(" / ");
    for (const c of cats) assert.ok(CSF_CATEGORIES[c], `${fn}: ${c}`);
  }
});

test("every setup-screen question has a designation, and every designation is used", () => {
  const nodeIds = PROFILE_SCREENS.flatMap((s) => [...s.flow.index.keys()]);
  for (const id of nodeIds) assert.ok(PROFILE_DESIGNATIONS[id], `setup question ${id} has no designation in controls.js`);
  for (const id of Object.keys(PROFILE_DESIGNATIONS)) assert.ok(nodeIds.includes(id), `designation for unknown question ${id}`);
  for (const [id, d] of Object.entries(PROFILE_DESIGNATIONS)) {
    if (d === "control") assert.ok(PROFILE_CONTROLS[id], `${id} designated control but not in PROFILE_CONTROLS`);
    if (d === "finding") assert.ok(FINDING_ITEMS[id], `${id} designated finding but not in FINDING_ITEMS`);
    if (d === "informational") assert.ok(INFORMATIONAL_NOTES[id], `${id} designated informational but has no note`);
  }
});

test("profile controls map every graded option of their question to a status", () => {
  const nodes = new Map(PROFILE_SCREENS.flatMap((s) => [...s.flow.index.values()].map((n) => [n.id, n])));
  for (const [id, pc] of Object.entries(PROFILE_CONTROLS)) {
    const node = nodes.get(id);
    assert.ok(node, id);
    for (const opt of node.options) {
      if (opt === "Not sure") continue;
      assert.ok(pc.status[opt], `${id}: option "${opt}" has no status`);
    }
  }
});

test("every scored question offers 'Not sure', and no graded option hides a 'not sure'", () => {
  for (const q of NIST_QUESTIONS) {
    assert.ok(q.options.some((o) => o.v === "unknown"), `${q.id} has no Not sure option`);
    for (const o of q.options.filter((x) => typeof x.v === "number")) assert.ok(!/not sure|unsure/i.test(o.t), `${q.id}: "${o.t}" merges an answer with not sure`);
  }
});

test("guidance exists for every scored question, profile control and combined finding", () => {
  for (const q of NIST_QUESTIONS) assert.ok(QUESTION_GUIDANCE[q.id], `no guidance for ${q.id}`);
  for (const id of Object.keys(PROFILE_CONTROLS)) assert.ok(QUESTION_GUIDANCE[id], `no guidance for ${id}`);
  for (const id of Object.keys(FLAG_INPUTS)) assert.ok(FLAG_GUIDANCE[id], `no guidance for flag ${id}`);
});

test("every MITRE ATT&CK technique cited is current in ATT&CK Enterprise and correctly named", () => {
  const cited = [...Object.values(FLAG_GUIDANCE), ...Object.values(QUESTION_GUIDANCE)].map((g) => g.technique).filter(Boolean);
  assert.ok(cited.length > 20);
  for (const t of cited) {
    assert.ok(ATTACK[t.id], `${t.id} is not a current ATT&CK technique`);
    assert.ok(t.name === ATTACK[t.id] || t.name.endsWith(ATTACK[t.id]), `${t.id}: "${t.name}" vs "${ATTACK[t.id]}"`);
  }
});
