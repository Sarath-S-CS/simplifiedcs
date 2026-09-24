// Small accessibility helpers shared by the assessment and the content
// pages.

let accordionSeq = 0;

// Accordion headers are block elements (icon, heading, sub-line, chevron).
// Following the WAI-ARIA accordion pattern, the heading's text is wrapped in
// a real <button> that carries the expanded state - so screen-reader users
// can still jump between the headings, and the button is announced with its
// title only. (Putting role="button" on the whole header, as before, turned
// the heading inside it into plain text.) The button is styled to look like
// the heading it replaces, and a click anywhere on the header still toggles.
// Headers without a heading fall back to making the header itself a button.
export function wireAccordion(head) {
  if (head.dataset.accWired) return;
  head.dataset.accWired = "1";
  const card = head.parentElement;
  const body = card.querySelector(".acc-body");
  if (body && !body.id) body.id = `acc-body-${++accordionSeq}`;
  const heading = head.querySelector("h2, h3, h4, h5, h6");
  let control;
  if (heading && !heading.querySelector("a, button, input, select, textarea")) {
    control = document.createElement("button");
    control.type = "button";
    control.className = "acc-toggle";
    control.append(...heading.childNodes);
    heading.append(control);
  } else {
    control = head;
    head.setAttribute("role", "button");
    head.setAttribute("tabindex", "0");
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(e);
      }
    });
  }
  if (body) control.setAttribute("aria-controls", body.id);
  const sync = () => control.setAttribute("aria-expanded", card.classList.contains("open") ? "true" : "false");
  sync();
  function toggle(e) {
    // Other interactive children (links, form fields, buttons) keep their own behavior.
    const onControl = control !== head && control.contains(e.target);
    if (e.target !== head && !onControl && e.target.closest("a, button, input, select, textarea, label")) return;
    card.classList.toggle("open");
    sync();
  }
  head.addEventListener("click", toggle);
  // Cards are also opened from elsewhere (anchor links, the table of
  // contents, re-renders); keep the announced state in step with those too.
  if (typeof MutationObserver === "function") new MutationObserver(sync).observe(card, { attributes: true, attributeFilter: ["class"] });
}

export function wireAccordions(container) {
  container.querySelectorAll(".acc-head").forEach(wireAccordion);
}

// Pages that redraw themselves - a live feed arriving after the page has
// opened, or a filter button re-rendering the list - replace the element
// that had keyboard focus, which drops focus to the top of the document.
// Call before redrawing; the returned function puts focus back on the
// element with the same data-fkey, or on the new page heading if the old
// heading had focus (as it does right after navigating to the page).
export function keepFocusAcrossRedraw(root) {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (!root || !active || active === root || !root.contains(active)) return () => {};
  const key = active.getAttribute("data-fkey");
  const heading = !key && /^H[1-6]$/.test(active.tagName) ? active.tagName.toLowerCase() : null;
  return () => {
    const target = key ? root.querySelector(`[data-fkey="${CSS.escape(key)}"]`) : heading ? root.querySelector(heading) : null;
    if (!target) return;
    if (heading && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };
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
