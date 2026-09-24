// Small accessibility helpers shared by the assessment and the content
// pages.

let accordionSeq = 0;

// Accordion headers are block elements containing a heading, which a native
// <button> can't validly contain, so they get the ARIA button pattern:
// focusable, announced as a button with its expanded state, and operable
// with Enter/Space as well as a click.
export function wireAccordion(head) {
  if (head.dataset.accWired) return;
  head.dataset.accWired = "1";
  const card = head.parentElement;
  const body = card.querySelector(".acc-body");
  if (body && !body.id) body.id = `acc-body-${++accordionSeq}`;
  head.setAttribute("role", "button");
  head.setAttribute("tabindex", "0");
  if (body) head.setAttribute("aria-controls", body.id);
  const sync = () => head.setAttribute("aria-expanded", card.classList.contains("open") ? "true" : "false");
  sync();
  const toggle = (e) => {
    // Interactive children (links, form fields, buttons) keep their own behavior.
    if (e.target !== head && e.target.closest("a, button, input, select, textarea, label")) return;
    card.classList.toggle("open");
    sync();
  };
  head.addEventListener("click", toggle);
  head.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(e);
    }
  });
}

export function wireAccordions(container) {
  container.querySelectorAll(".acc-head").forEach(wireAccordion);
}

// Screens re-render their whole panel after each answer. Without this,
// keyboard and screen-reader users lose their place on every choice. Call
// before re-rendering; the returned function puts focus back on the
// element with the same data-fkey (or the given fallback) afterwards.
export function preserveFocus(root) {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  const key = active && root && root.contains(active) ? active.getAttribute("data-fkey") : null;
  return (fallbackSelector) => {
    if (!root) return;
    const target = (key && root.querySelector(`[data-fkey="${CSS.escape(key)}"]`)) || (fallbackSelector && root.querySelector(fallbackSelector));
    if (target && typeof target.focus === "function") target.focus({ preventScroll: Boolean(key) });
  };
}

// Politely announces a status message to screen readers.
export function announce(message) {
  if (typeof document === "undefined") return;
  let region = document.getElementById("sr-status");
  if (!region) {
    region = document.createElement("div");
    region.id = "sr-status";
    region.className = "sr-only";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  region.textContent = "";
  setTimeout(() => {
    region.textContent = message;
  }, 50);
}
