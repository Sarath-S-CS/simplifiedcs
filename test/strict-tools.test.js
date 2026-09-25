// The model is called with strict tool use (grammar-constrained sampling),
// so its tool input always matches the schema. Without it, a live request
// on 25 Sep 2026 came back with advisories/patterns not as arrays and the
// whole answer was discarded (502). Strict mode only accepts a subset of
// JSON Schema (platform.claude.com/docs/en/build-with-claude/structured-outputs,
// "JSON Schema limitations"): every object needs additionalProperties:false,
// and maxItems / minLength / maxLength / pattern / numeric bounds aren't
// supported - the server enforces those limits itself when validating.
import { test } from "node:test";
import assert from "node:assert/strict";
import { INSIGHTS_TOOL } from "../netlify/lib/insights.ts";
import { INTERPRET_TOOL } from "../netlify/lib/interpret.ts";

const UNSUPPORTED = ["maxItems", "minLength", "maxLength", "pattern", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"];

function problems(schema, path = "input_schema") {
  const out = [];
  if (!schema || typeof schema !== "object") return out;
  for (const k of UNSUPPORTED) if (k in schema) out.push(`${path}.${k} isn't supported in strict mode`);
  if ("minItems" in schema && ![0, 1].includes(schema.minItems)) out.push(`${path}.minItems must be 0 or 1`);
  if (schema.type === "object") {
    if (schema.additionalProperties !== false) out.push(`${path} needs additionalProperties: false`);
    for (const [name, sub] of Object.entries(schema.properties || {})) out.push(...problems(sub, `${path}.${name}`));
  }
  if (schema.type === "array") out.push(...problems(schema.items, `${path}[]`));
  return out;
}

for (const tool of [INSIGHTS_TOOL, INTERPRET_TOOL]) {
  test(`${tool.name} uses strict tool use with a schema strict mode accepts`, () => {
    assert.equal(tool.strict, true);
    assert.deepEqual(problems(tool.input_schema), []);
  });
}
