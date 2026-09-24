// Analytics must stay off until the visitor allows them, and events must
// never carry assessment content. assets/gtag-init.js is a plain browser
// script, so it's run here in a small sandbox with stand-in DOM objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const GTAG_INIT = readFileSync(new URL("../assets/gtag-init.js", import.meta.url), "utf8");

function sandbox(stored) {
  const appended = [];
  const store = new Map(stored ? [["simplifiedcs:consent:analytics", stored]] : []);
  const ctx = {
    window: {},
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    document: {
      cookie: "_ga=GA1.1.123; other=1",
      head: { appendChild: (el) => appended.push(el) },
      createElement: () => ({}),
    },
    location: { hostname: "simplifiedcs.net", reload: () => (ctx.reloaded = true) },
  };
  ctx.window.dataLayer = [];
  vm.createContext(ctx);
  vm.runInContext(GTAG_INIT, ctx);
  return { ctx, appended, store, dataLayer: ctx.window.dataLayer };
}

test("no choice yet: Google's script is not loaded and consent defaults are denied", () => {
  const { appended, dataLayer } = sandbox(null);
  assert.equal(appended.length, 0);
  const def = [...dataLayer].find((a) => a[0] === "consent" && a[1] === "default");
  assert.equal(def[2].analytics_storage, "denied");
  assert.equal(def[2].ad_storage, "denied");
});

test("declined: still not loaded", () => {
  assert.equal(sandbox("denied").appended.length, 0);
});

test("allowed: loads gtag.js once, with Google signals and ad personalization off", () => {
  const { appended, dataLayer, ctx } = sandbox("granted");
  assert.equal(appended.length, 1);
  assert.match(appended[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-/);
  const config = [...dataLayer].find((a) => a[0] === "config");
  assert.equal(config[2].allow_google_signals, false);
  ctx.window.scsAnalytics.grant();
  assert.equal(appended.length, 1, "not loaded twice");
});

test("withdrawing consent records it, deletes _ga cookies and reloads to stop the loaded script", () => {
  const { ctx, store } = sandbox("granted");
  const writes = [];
  Object.defineProperty(ctx.document, "cookie", { get: () => "_ga=GA1.1.123; _ga_ABC=x; other=1", set: (v) => writes.push(v) });
  ctx.window.scsAnalytics.deny();
  assert.equal(store.get("simplifiedcs:consent:analytics"), "denied");
  assert.ok(writes.some((w) => w.startsWith("_ga=;") && w.includes("Max-Age=0")));
  assert.ok(writes.some((w) => w.startsWith("_ga_ABC=;")));
  assert.ok(!writes.some((w) => w.startsWith("other=")));
  assert.equal(ctx.reloaded, true);
});

test("trackEvent sends nothing without consent, and only coarse allow-listed fields with it", async () => {
  const calls = [];
  globalThis.window = { gtag: (...a) => calls.push(a), scsAnalytics: { choice: () => null } };
  const { trackEvent } = await import("../src/ui/privacy.js");
  trackEvent("assessment_complete", { mode: "full" });
  assert.equal(calls.length, 0);
  window.scsAnalytics.choice = () => "granted";
  trackEvent("assessment_complete", { mode: "full", answers: { mfa: 0 }, verdict: "Critical gaps found", companyName: "Acme" });
  assert.deepEqual(calls, [["event", "assessment_complete", { mode: "full" }]]);
  delete globalThis.window;
});
