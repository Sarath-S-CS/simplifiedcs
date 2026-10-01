// Feedback form (Netlify Forms). Checks what's sent, that the hidden static
// form Netlify detects matches the visible one, and the page's behaviour:
// errors are shown and nothing is sent; "sent" appears only when Netlify
// accepts the submission; a failure keeps the message so it isn't lost.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { validateFeedback, encodeFeedback, FEEDBACK_FIELDS, FEEDBACK_TOPICS, MESSAGE_MAX } from "../src/engine/feedback.js";

test("validation: a topic and a message are required; email is optional but must look like one", () => {
  assert.deepEqual(validateFeedback({ topic: "idea", message: "Add dark mode to the PDF." }), {});
  assert.deepEqual(validateFeedback({ topic: "idea", message: "Hi", email: "me@example.com" }), {});
  const empty = validateFeedback({});
  assert.ok(empty.topic && empty.message && !empty.email);
  assert.ok(validateFeedback({ topic: "idea", message: "   " }).message, "whitespace isn't a message");
  assert.match(validateFeedback({ topic: "idea", message: "x".repeat(MESSAGE_MAX + 1) }).message, /2000/);
  assert.ok(validateFeedback({ topic: "idea", message: "Hi", email: "me@example" }).email);
  assert.ok(validateFeedback({ topic: "made-up", message: "Hi" }).topic);
});

test("the request body is what Netlify Forms expects, with the topic as a readable label", () => {
  const body = new URLSearchParams(encodeFeedback({ topic: "broken", message: "  The PDF button does nothing.  ", email: " me@example.com " }));
  assert.equal(body.get("form-name"), "feedback");
  assert.equal(body.get("topic"), "Something's broken");
  assert.equal(body.get("message"), "The PDF button does nothing.");
  assert.equal(body.get("email"), "me@example.com");
  assert.equal(body.get("bot-field"), "");
  assert.deepEqual([...body.keys()].sort(), [...FEEDBACK_FIELDS].sort());
});

test("the hidden static form Netlify detects has the same name and fields", () => {
  const shell = readFileSync(new URL("../src/shell-body.html", import.meta.url), "utf8");
  const form = shell.match(/<form[^>]*name="feedback"[^>]*>([\s\S]*?)<\/form>/);
  assert.ok(form, "hidden feedback form in src/shell-body.html");
  assert.match(form[0], /data-netlify="true"/);
  assert.match(form[0], /netlify-honeypot="bot-field"/);
  assert.match(form[0], /\shidden[\s>]/);
  const names = [...form[1].matchAll(/name="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(names, [...FEEDBACK_FIELDS].sort());
});

// ---------------- the page, in a simulated browser ----------------

const dom = new JSDOM("<!doctype html><html><body><main id='tabContent'></main></body></html>", { url: "https://simplifiedcs.net/feedback" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history, HTMLElement: dom.window.HTMLElement, Event: dom.window.Event });
const { renderFeedbackPage } = await import("../src/pages/feedback.js");

const tick = () => new Promise((r) => setTimeout(r, 0));
function mountPage() {
  const container = document.getElementById("tabContent");
  renderFeedbackPage(container);
  return container;
}
function fill(c, { topic, message = "", email = "" }) {
  if (topic) c.querySelector(`input[name="topic"][value="${topic}"]`).click();
  c.querySelector("#fbMessage").value = message;
  c.querySelector("#fbEmail").value = email;
}
const submit = (c) => c.querySelector("#feedbackForm").dispatchEvent(new dom.window.Event("submit", { cancelable: true, bubbles: true }));

test("the page offers every topic as a radio button in a labelled group", () => {
  const c = mountPage();
  const radios = [...c.querySelectorAll('input[type="radio"][name="topic"]')];
  assert.deepEqual(radios.map((r) => r.value), FEEDBACK_TOPICS.map((t) => t.id));
  assert.match(c.querySelector("fieldset legend").textContent, /What's this about/);
  assert.equal(c.querySelector('label[for="fbMessage"]').textContent.trim().startsWith("Message"), true);
  assert.equal(c.querySelector("#fbMessage").getAttribute("maxlength"), String(MESSAGE_MAX));
});

test("invalid input shows the errors, marks the fields, focuses the first one, and sends nothing", async () => {
  const c = mountPage();
  let sent = 0;
  globalThis.fetch = async () => { sent++; return new Response("", { status: 200 }); };
  fill(c, { message: "", email: "nope" });
  submit(c);
  await tick();
  assert.equal(sent, 0);
  assert.match(c.querySelector("#err-topic").textContent, /Choose/);
  assert.match(c.querySelector("#err-message").textContent, /Write a message/);
  assert.match(c.querySelector("#err-email").textContent, /doesn't look right/);
  assert.equal(c.querySelector("#fbMessage").getAttribute("aria-invalid"), "true");
  assert.equal(document.activeElement, c.querySelector('input[name="topic"]'));
});

test("'sent' appears only when Netlify accepts the submission", async () => {
  const c = mountPage();
  let request;
  globalThis.fetch = async (url, init) => { request = { url, init }; return new Response("", { status: 200 }); };
  fill(c, { topic: "idea", message: "More frameworks, please.", email: "me@example.com" });
  submit(c);
  await tick();
  await tick();
  assert.equal(request.url, "/");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["Content-Type"], "application/x-www-form-urlencoded");
  assert.equal(new URLSearchParams(request.init.body).get("message"), "More frameworks, please.");
  assert.ok(!c.querySelector("#feedbackForm"), "the form is replaced by the confirmation");
  assert.match(c.querySelector("#fbDone").textContent, /Thanks/);
  assert.equal(document.activeElement, c.querySelector("#fbDone"));
});

test("a failed submission says so, keeps the message, and points to the alternative", async () => {
  for (const failure of [async () => new Response("", { status: 500 }), async () => { throw new TypeError("network"); }]) {
    const c = mountPage();
    globalThis.fetch = failure;
    fill(c, { topic: "broken", message: "The PDF button does nothing." });
    submit(c);
    await tick();
    await tick();
    assert.ok(c.querySelector("#feedbackForm"), "form still there");
    assert.equal(c.querySelector("#fbMessage").value, "The PDF button does nothing.");
    assert.match(c.querySelector("#fbStatus").textContent, /didn't send/);
    assert.match(c.querySelector("#fbStatus").textContent, /GitHub/);
    assert.equal(c.querySelector("#fbSubmit").disabled, false);
  }
});
