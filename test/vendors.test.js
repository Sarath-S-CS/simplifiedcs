import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFILE_SCREENS } from "../src/data/profile-flow.js";

const PROFILE_NODES = PROFILE_SCREENS.flatMap((s) => s.flow.order.map((id) => s.flow.index.get(id)));

test("§5.3: every vendor-type node has a real, non-empty option list", () => {
  const vendorNodes = PROFILE_NODES.filter((n) => n.type === "vendor");
  assert.ok(vendorNodes.length >= 10, "expected the antivirus/EDR/email/DLP/SD-WAN/edge/hosting/cloud/awareness/MSP/MDR/MSSP/OT fields to all be vendor-type");
  for (const n of vendorNodes) {
    assert.ok(Array.isArray(n.vendorOptions) && n.vendorOptions.length >= 3, `${n.id} should have a real vendor option list`);
    for (const v of n.vendorOptions) {
      assert.equal(typeof v, "string");
      assert.ok(v.length > 1, `${n.id} has a suspiciously short vendor name: "${v}"`);
    }
    assert.equal(new Set(n.vendorOptions).size, n.vendorOptions.length, `${n.id} has duplicate vendor options`);
  }
});

test("§5.3: antivirus is asked as its own step before EDR", () => {
  const antivirus = PROFILE_NODES.find((n) => n.id === "antivirusVendor");
  const edr = PROFILE_NODES.find((n) => n.id === "edrVendor");
  assert.ok(antivirus && edr);
  const order = PROFILE_NODES.map((n) => n.id);
  assert.ok(order.indexOf("hasAntivirus") < order.indexOf("edrVendor"));
});
