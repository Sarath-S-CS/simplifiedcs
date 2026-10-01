// Feedback page (/feedback): a short form delivered through Netlify Forms,
// with a GitHub issue or LinkedIn as alternatives. Netlify detects the form
// from the hidden static copy in src/shell-body.html; this visible one posts
// to it with fetch. "Thanks, sent" appears only when Netlify accepts the
// submission - a failure keeps the message on screen. What it sends and why
// is in src/engine/feedback.js; /privacy explains it to visitors.
import { FEEDBACK_TOPICS, MESSAGE_MAX, validateFeedback, encodeFeedback } from "../engine/feedback.js";
import { trackEvent } from "../ui/privacy.js";
import { escapeHtml } from "../ui/html-safety.js";
import { wireNavLinksByDataset } from "../router.js";

const e = escapeHtml;
const ISSUE_URL =
  "https://github.com/Sarath-S-CS/simplifiedcs/issues/new?title=" +
  encodeURIComponent("Feedback: ") +
  "&body=" +
  encodeURIComponent("What happened, or what would you like to see?\n\n(Please don't include anything confidential - GitHub issues are public.)\n");

const FIELD_FOCUS = { topic: 'input[name="topic"]', message: "#fbMessage", email: "#fbEmail" };

export function renderFeedbackPage(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-intro">
        <div class="page-eyebrow">Feedback</div>
        <h2 class="page-title" tabindex="-1">Send feedback</h2>
        <p class="page-lede">Found something broken, confusing or missing? Feedback is read and shapes what gets worked on next.</p>
      </div>

      <div class="section-tile" id="fbTile">
        <form id="feedbackForm" class="feedback-form" name="feedback" method="POST" action="/" novalidate>
          <input type="hidden" name="form-name" value="feedback">
          <p hidden><label>Leave this empty: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>

          <fieldset class="question" aria-describedby="err-topic">
            <legend>What's this about?</legend>
            <div class="options">
              ${FEEDBACK_TOPICS.map(
                (t) => `<label class="option"><input type="radio" class="sr-only" name="topic" value="${e(t.id)}"><span class="radio" aria-hidden="true"></span><span>${e(t.label)}</span></label>`
              ).join("")}
            </div>
            <p class="field-error" id="err-topic"></p>
          </fieldset>

          <div class="field">
            <label for="fbMessage">Message</label>
            <p class="scope-hint" id="fbMessageHint">Please don't include anything confidential, such as your assessment answers or details of your organisation's security.</p>
            <textarea id="fbMessage" name="message" rows="6" maxlength="${MESSAGE_MAX}" aria-describedby="fbMessageHint fbMessageCount err-message"></textarea>
            <p class="scope-hint feedback-count" id="fbMessageCount">0 / ${MESSAGE_MAX}</p>
            <p class="field-error" id="err-message"></p>
          </div>

          <div class="field">
            <label for="fbEmail">Email <span class="opt-tag">optional</span></label>
            <p class="scope-hint" id="fbEmailHint">Only if you'd like a reply. It isn't used for anything else.</p>
            <input type="email" id="fbEmail" name="email" autocomplete="email" maxlength="200" aria-describedby="fbEmailHint err-email">
            <p class="field-error" id="err-email"></p>
          </div>

          <div class="cta-row"><button type="submit" class="cta-btn" id="fbSubmit">Send feedback</button></div>
          <p class="scope-hint" id="fbStatus" role="status"></p>
          <p class="scope-hint">Sent through Netlify, the site's host. What's kept and who reads it: <a href="/privacy" class="inline-link" data-tab="privacy">Privacy</a>.</p>
        </form>
      </div>

      <div class="section-tile">
        <h3 class="section-h">Prefer GitHub or LinkedIn?</h3>
        <div class="cta-row">
          <a class="cta-btn secondary" href="${ISSUE_URL}" target="_blank" rel="noopener noreferrer">Open a GitHub issue →</a>
          <a class="cta-btn secondary" href="https://www.linkedin.com/in/sarath-surendran/" target="_blank" rel="noopener noreferrer">Message on LinkedIn</a>
        </div>
        <p class="scope-hint">GitHub issues are public - please don't include anything confidential. A GitHub account is needed to open an issue.</p>
      </div>
    </div>`;
  wireFeedbackForm(container);
  wireNavLinksByDataset(container, "a.inline-link[data-tab]");
}

function wireFeedbackForm(container) {
  const form = container.querySelector("#feedbackForm");
  const message = form.querySelector("#fbMessage");
  const count = form.querySelector("#fbMessageCount");
  const status = form.querySelector("#fbStatus");
  const button = form.querySelector("#fbSubmit");

  form.querySelectorAll('input[name="topic"]').forEach((radio) =>
    radio.addEventListener("change", () => {
      form.querySelectorAll(".option").forEach((o) => o.classList.toggle("selected", o.contains(radio) && radio.checked));
    })
  );
  message.addEventListener("input", () => {
    count.textContent = `${message.value.length} / ${MESSAGE_MAX}`;
  });

  const showErrors = (errors) => {
    for (const field of ["topic", "message", "email"]) {
      form.querySelector(`#err-${field}`).textContent = errors[field] || "";
      form.querySelectorAll(field === "topic" ? 'input[name="topic"]' : FIELD_FOCUS[field]).forEach((el) => {
        if (errors[field]) el.setAttribute("aria-invalid", "true");
        else el.removeAttribute("aria-invalid");
      });
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = {
      topic: form.querySelector('input[name="topic"]:checked')?.value,
      message: message.value,
      email: form.querySelector("#fbEmail").value,
      botField: form.querySelector('input[name="bot-field"]').value,
    };
    const errors = validateFeedback(values);
    showErrors(errors);
    const first = ["topic", "message", "email"].find((f) => errors[f]);
    if (first) {
      status.textContent = "Please fix the highlighted field" + (Object.keys(errors).length > 1 ? "s." : ".");
      form.querySelector(FIELD_FOCUS[first]).focus();
      return;
    }

    button.disabled = true;
    status.textContent = "Sending…";
    let ok = false;
    let detail = "a network problem";
    try {
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeFeedback(values),
      });
      ok = res.ok;
      if (!ok) detail = `error ${res.status}`;
    } catch {
      /* network failure: reported below */
    }
    if (!ok) {
      button.disabled = false;
      status.textContent = `Your feedback didn't send (${detail}). Your message is still here - try again in a moment, or open a GitHub issue instead.`;
      return;
    }
    trackEvent("feedback_sent");
    const tile = container.querySelector("#fbTile");
    tile.innerHTML = `
      <div id="fbDone" tabindex="-1" role="status">
        <h3 class="section-h">Thanks - your feedback was sent.</h3>
        <p class="body-text">${values.email.trim() ? "If a reply is useful, it'll go to the email address you gave." : "You didn't leave an email address, so there won't be a reply - but it will be read."}</p>
      </div>`;
    tile.querySelector("#fbDone").focus();
  });
}
