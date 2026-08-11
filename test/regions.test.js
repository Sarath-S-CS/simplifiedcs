import { test } from "node:test";
import assert from "node:assert/strict";
import { REGIONS } from "../src/data/regions.js";

test("§5.1: Global is a standalone region, not mixed into the regular region list semantics", () => {
  const global = REGIONS.find((r) => r.id === "global");
  assert.ok(global, "a Global region option must exist");
  assert.equal(global.standalone, true);
});

test("§5.1: region set includes all six new/renamed regions plus Global", () => {
  const ids = REGIONS.map((r) => r.id);
  for (const expected of ["eu", "uk", "na", "southamerica", "middleeast", "africa", "global"]) {
    assert.ok(ids.includes(expected), `missing region: ${expected}`);
  }
  assert.ok(!ids.includes("us"), "the old 'us' id should be renamed to 'na' (North America), not duplicated");
});

test("§5.1: North America keeps the exact original US framework mapping (region input changed, mapping logic did not)", () => {
  const na = REGIONS.find((r) => r.id === "na");
  assert.deepEqual([...na.frameworks].sort(), ["hipaa", "pcidss", "sox"]);
});

test("§5.1: EU and UK framework mappings are unchanged from the original", () => {
  assert.deepEqual(REGIONS.find((r) => r.id === "eu").frameworks.sort(), ["gdpr", "nis2"]);
  assert.deepEqual(REGIONS.find((r) => r.id === "uk").frameworks, ["cyberessentials"]);
});
