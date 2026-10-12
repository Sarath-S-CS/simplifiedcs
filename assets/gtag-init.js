// Google Analytics 4 (gtag.js), loaded for all visitors.
//
// This is the standard Google tag, with no consent gate: gtag.js is requested
// and a page_view is sent on every page load. Google Signals and ad
// personalization are turned off, so this is analytics only (no advertising
// features), but analytics cookies are set and data is sent to Google for
// everyone. If analytics must instead require opt-in (e.g. for an EU/EEA
// audience under GDPR/ePrivacy), restore a consent gate here.
//
// Kept as a separate file (not inline) so the Content-Security-Policy in
// _headers can keep script-src 'self' without an inline-script hash.
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
window.gtag = gtag;

(function () {
  var ID = "G-M10MSC9BG2";
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);
  gtag("js", new Date());
  gtag("config", ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
})();
