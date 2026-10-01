// The feedback form (src/pages/feedback.js): what it checks before sending,
// and exactly what it sends to Netlify Forms. Kept free of the DOM so it can
// be tested directly. The field names must match the hidden static copy of
// the form in src/shell-body.html - that copy is how Netlify detects the form
// at deploy time (test/feedback.test.js checks the two agree).
export const FEEDBACK_FORM_NAME = "feedback";
export const FEEDBACK_FIELDS = ["form-name", "topic", "message", "email", "bot-field"];
export const MESSAGE_MAX = 2000;

export const FEEDBACK_TOPICS = [
  { id: "broken", label: "Something's broken" },
  { id: "idea", label: "An idea or missing feature" },
  { id: "question", label: "A question" },
  { id: "other", label: "Other" },
];

// A simple shape check, not full RFC validation: it catches typos like a
// missing "@" without rejecting real addresses.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns { field: message } for each problem; empty when the form can be sent.
export function validateFeedback({ topic, message, email } = {}) {
  const errors = {};
  if (!FEEDBACK_TOPICS.some((t) => t.id === topic)) errors.topic = "Choose what this is about.";
  const text = String(message ?? "").trim();
  if (!text) errors.message = "Write a message.";
  else if (text.length > MESSAGE_MAX) errors.message = `Keep it to ${MESSAGE_MAX} characters - it's ${text.length} now.`;
  const address = String(email ?? "").trim();
  if (address && !EMAIL_SHAPE.test(address)) errors.email = "That email address doesn't look right. Check it, or leave it blank.";
  return errors;
}

// The request body Netlify Forms expects (URL-encoded, with form-name). The
// topic is sent as its readable label so submissions make sense in Netlify.
export function encodeFeedback({ topic, message, email, botField } = {}) {
  return new URLSearchParams({
    "form-name": FEEDBACK_FORM_NAME,
    topic: FEEDBACK_TOPICS.find((t) => t.id === topic)?.label ?? String(topic ?? ""),
    message: String(message ?? "").trim(),
    email: String(email ?? "").trim(),
    "bot-field": String(botField ?? ""),
  }).toString();
}
