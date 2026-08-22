// ASSESSMENT-EXPERIENCE-BRIEF.md §2: "a small, non-blocking toast... must
// not be a blocking modal - it should appear briefly and get out of the
// way". Deliberately not the accordion/panel patterns used elsewhere in
// this codebase, since those are meant to stay open until dismissed - this
// is meant to be missable without breaking anything.
export function showToast(message) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.className = "save-toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${message}</span><button type="button" class="save-toast-close" aria-label="Dismiss">×</button>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("visible"));

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    el.classList.remove("visible");
    setTimeout(() => el.remove(), 300);
  };
  el.querySelector(".save-toast-close").addEventListener("click", dismiss);
  setTimeout(dismiss, 7000);
}
