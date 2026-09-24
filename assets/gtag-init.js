// Google Analytics, only with consent.
//
// Google Consent Mode v2 defaults are set to "denied" before anything else,
// and Google's script (gtag.js) is not even requested until the visitor
// chooses "Allow analytics" in the site's cookie banner (src/ui/privacy.js).
// Until then no request goes to Google and no analytics cookie is set.
// Choosing "No thanks" later deletes the _ga cookies and reloads the page so
// the already-loaded script stops.
//
// Kept as a separate file (not inline) so the Content-Security-Policy in
// _headers can use script-src 'self' without an inline-script hash.
window.dataLayer = window.dataLayer || [];
function gtag() {
  window.dataLayer.push(arguments);
}
window.gtag = gtag;
gtag("consent", "default", {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});

(function () {
  var KEY = "simplifiedcs:consent:analytics";
  var ID = "G-M10MSC9BG2";
  var loaded = false;

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function write(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {
      /* the choice then applies to this page view only */
    }
  }
  function load() {
    if (loaded) return;
    loaded = true;
    gtag("consent", "update", { analytics_storage: "granted" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("config", ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  }
  function deleteGaCookies() {
    var host = location.hostname;
    var domains = ["", host, "." + host, "." + host.split(".").slice(-2).join(".")];
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name.indexOf("_ga") !== 0) return;
      domains.forEach(function (d) {
        document.cookie = name + "=; Max-Age=0; path=/" + (d ? "; domain=" + d : "");
      });
    });
  }

  window.scsAnalytics = {
    choice: read,
    grant: function () {
      write("granted");
      load();
    },
    deny: function () {
      var wasLoaded = loaded;
      write("denied");
      gtag("consent", "update", { analytics_storage: "denied" });
      deleteGaCookies();
      if (wasLoaded) location.reload();
    },
  };

  if (read() === "granted") load();
})();
