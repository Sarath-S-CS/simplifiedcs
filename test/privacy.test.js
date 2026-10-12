// Analytics now load for every visitor (no consent gate), but events must
// still never carry assessment content and must use analytics-only settings.
// assets/gtag-init.js is a plain browser script, so it's run here in a small
// sandbox with stand-in DOM objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const GTAG_INIT = readFileSync(new URL("../assets/gtag-init.js", import.meta.url), "utf8");

function runGtagInit() {
  const appended = [];
  const ctx = {
    window: {},
    document: { head: { appendChild: (el) => appended.push(el) }, createElement: () => ({}) },
  };
  ctx.window.dataLayer = [];
  vm.createContext(ctx);
  vm.runInContext(GTAG_INIT, ctx);
  return { ctx, appended, dataLayer: ctx.window.dataLayer };
}

test("gtag-init loads Google's analytics script once, for all visitors", () => {
  const { appended } = runGtagInit();
  assert.equal(appended.length, 1);
  assert.match(appended[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-/);
});

test("gtag-init pushes js + config and turns Google signals / ad personalization off", () => {
  const { dataLayer } = runGtagInit();
  assert.ok([...dataLayer].some((a) => a[0] === "js"), "gtag('js', ...) present");
  const config = [...dataLayer].find((a) => a[0] === "config");
  assert.ok(config, "gtag('config', ...) present");
  assert.match(config[1], /^G-/);
  assert.equal(config[2].allow_google_signals, false);
  assert.equal(config[2].allow_ad_personalization_signals, false);
});

test("trackEvent forwards only coarse allow-listed fields, nothing without gtag, and returns falsy", async () => {
  const { trackEvent } = await import("../src/ui/privacy.js");

  // No gtag available: sends nothing, returns undefined (falsy).
  globalThis.window = {};
  assert.equal(trackEvent("assessment_complete", { mode: "full" }), undefined);

  // gtag available: forwards the event, stripping any non-allow-listed field
  // (answers, verdict, company name must never leave). Still returns falsy so
  // callers' `trackEvent(...) || download(...)` pattern keeps working.
  const calls = [];
  globalThis.window = { gtag: (...a) => calls.push(a) };
  const r = trackEvent("assessment_complete", { mode: "full", answers: { mfa: 0 }, verdict: "Critical gaps found", companyName: "Acme" });
  assert.equal(r, undefined);
  assert.deepEqual(calls, [["event", "assessment_complete", { mode: "full" }]]);
  delete globalThis.window;
});
