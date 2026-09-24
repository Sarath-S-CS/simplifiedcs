// src/ui/a11y.js. Accordions: the heading stays a heading, a real button
// inside it carries the expanded state, and the state stays correct however
// the card is opened. Redraws: keyboard focus survives a page re-rendering
// itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
// jsdom has no CSS.escape; the keys used below need no escaping.
globalThis.CSS ??= { escape: (v) => String(v) };
const { wireAccordions, keepFocusAcrossRedraw } = await import("../src/ui/a11y.js");

const tick = () => new Promise((r) => setTimeout(r, 0));

function mount(html) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  wireAccordions(root);
  return root;
}

const CARD = `
  <div class="acc-card">
    <div class="acc-head">
      <div class="icon-badge">1</div>
      <div><h4>Patch internet-facing systems <span class="q-badge">P1</span></h4><div class="acc-sub">Protect</div></div>
      <div class="acc-chevron">▸</div>
    </div>
    <div class="acc-body"><p>Details</p></div>
  </div>`;

test("the heading keeps its role and holds a real button with the title", () => {
  const root = mount(CARD);
  const head = root.querySelector(".acc-head");
  const btn = root.querySelector("h4 > button.acc-toggle");
  assert.ok(btn, "button inside the heading");
  assert.equal(btn.type, "button");
  assert.equal(btn.textContent, "Patch internet-facing systems P1");
  assert.equal(head.getAttribute("role"), null, "header is no longer role=button");
  assert.equal(head.getAttribute("tabindex"), null);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(btn.getAttribute("aria-controls"), root.querySelector(".acc-body").id);
});

test("clicking the button or anywhere on the header toggles, once per click", () => {
  const root = mount(CARD);
  const card = root.querySelector(".acc-card");
  const btn = root.querySelector(".acc-toggle");
  btn.click();
  assert.ok(card.classList.contains("open"));
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  root.querySelector(".acc-chevron").click();
  assert.ok(!card.classList.contains("open"));
  assert.equal(btn.getAttribute("aria-expanded"), "false");
});

test("opening the card from elsewhere (anchor, table of contents) updates aria-expanded", async () => {
  const root = mount(CARD);
  root.querySelector(".acc-card").classList.add("open");
  await tick();
  assert.equal(root.querySelector(".acc-toggle").getAttribute("aria-expanded"), "true");
});

test("links inside the header keep their own behaviour", () => {
  const root = mount(`
    <div class="acc-card">
      <div class="acc-head"><div><h4>Title</h4><a href="#x" class="inline-link">source</a></div></div>
      <div class="acc-body"></div>
    </div>`);
  root.querySelector("a").addEventListener("click", (e) => e.preventDefault());
  root.querySelector("a").click();
  assert.ok(!root.querySelector(".acc-card").classList.contains("open"));
});

test("a header without a heading falls back to a keyboard-operable role=button", () => {
  const root = mount(`
    <div class="acc-card">
      <div class="acc-head"><div class="label">No heading here</div></div>
      <div class="acc-body"></div>
    </div>`);
  const head = root.querySelector(".acc-head");
  assert.equal(head.getAttribute("role"), "button");
  assert.equal(head.getAttribute("tabindex"), "0");
  head.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(head.getAttribute("aria-expanded"), "true");
  head.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
  assert.equal(head.getAttribute("aria-expanded"), "false");
});

test("wiring twice does nothing the second time", () => {
  const root = mount(CARD);
  wireAccordions(root);
  assert.equal(root.querySelectorAll(".acc-toggle").length, 1);
});

test("a redraw keeps focus on the page heading when the heading had it", () => {
  const root = mount(`<div class="page"><h2 class="page-title" tabindex="-1">News</h2><p>Loading…</p></div>`);
  root.querySelector("h2").focus();
  const restore = keepFocusAcrossRedraw(root);
  root.innerHTML = `<div class="page"><h2 class="page-title">News</h2><button>Filter</button></div>`;
  restore();
  assert.equal(document.activeElement, root.querySelector("h2"));
  assert.equal(root.querySelector("h2").getAttribute("tabindex"), "-1");
});

test("a redraw keeps focus on the same filter button (data-fkey)", () => {
  const html = (active) => `<h2>Exploits</h2><button data-fkey="exploit-filter-all">All</button><button data-fkey="exploit-filter-ot" class="${active}">OT</button>`;
  const root = mount(html(""));
  root.querySelector('[data-fkey="exploit-filter-ot"]').focus();
  const restore = keepFocusAcrossRedraw(root);
  root.innerHTML = html("active");
  restore();
  assert.equal(document.activeElement, root.querySelector('[data-fkey="exploit-filter-ot"]'));
});

test("a redraw leaves focus alone when it was somewhere else on the page", () => {
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const root = mount("<h2>Case Studies</h2>");
  const restore = keepFocusAcrossRedraw(root);
  root.innerHTML = "<h2>Case Studies</h2>";
  restore();
  assert.equal(document.activeElement, outside);
});
