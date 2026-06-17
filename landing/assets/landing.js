// ============================================================================
// CivicVois — Landing page
// ============================================================================

// ►► LINK STORE — quando avrai gli URL reali, sostituisci '#' qui sotto.
//    Appena un URL è diverso da '#', il bottone si attiva automaticamente
//    (niente più stato "in arrivo").
var APP_STORE_URL = "#"; // es: "https://apps.apple.com/app/idXXXXXXXXX"
var PLAY_STORE_URL = "#"; // es: "https://play.google.com/store/apps/details?id=it.civicvois.app"

// ---------------------------------------------------------------------------
// Render badge store
// ---------------------------------------------------------------------------
var APPLE_GLYPH =
  '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M16.36 12.78c.02 2.45 2.15 3.27 2.18 3.28-.02.06-.34 1.17-1.12 2.31-.67.99-1.37 1.97-2.47 1.99-1.08.02-1.43-.64-2.66-.64-1.24 0-1.62.62-2.64.66-1.06.04-1.87-1.07-2.55-2.05-1.38-2-2.44-5.66-1.02-8.13.7-1.23 1.96-2 3.33-2.02 1.04-.02 2.02.7 2.66.7.63 0 1.83-.86 3.08-.74.53.02 2 .21 2.95 1.6-.08.05-1.76 1.03-1.74 3.07M14.4 6.07c.56-.68.94-1.62.84-2.57-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.56-.85 2.48.9.07 1.82-.46 2.38-1.13"/></svg>';
var PLAY_GLYPH =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#22d3ee" d="M3.6 2.3 13.5 12 3.6 21.7c-.36-.18-.6-.55-.6-1V3.3c0-.45.24-.82.6-1z"/><path fill="#10b981" d="M16.8 8.7 13.5 12 16.8 15.3 20.5 13.2c.7-.4.7-1.4 0-1.8L16.8 8.7z"/><path fill="#fff" d="M3.6 2.3c.16-.08.34-.13.53-.13.18 0 .37.05.54.15L16.8 8.7 13.5 12 3.6 2.3z"/><path fill="#cbd5e1" d="M13.5 12l3.3 3.3-12.13 6.4c-.17.1-.36.15-.54.15-.19 0-.37-.05-.53-.13L13.5 12z"/></svg>';

function storeBadge(opts) {
  var enabled = opts.url && opts.url !== "#";
  var a = document.createElement("a");
  a.className = "store-badge";
  if (enabled) {
    a.href = opts.url;
    a.target = "_blank";
    a.rel = "noopener";
  } else {
    a.setAttribute("data-disabled", "true");
    a.setAttribute("role", "link");
    a.setAttribute("aria-disabled", "true");
    a.addEventListener("click", function (e) { e.preventDefault(); });
  }
  a.innerHTML =
    opts.glyph +
    '<span><span class="s-top">' + opts.top + '</span>' +
    '<span class="s-main">' + opts.main + "</span></span>" +
    (enabled ? "" : '<span class="soon">In arrivo</span>');
  return a;
}

function renderBadges(container) {
  if (!container) return;
  container.appendChild(storeBadge({ url: APP_STORE_URL, glyph: APPLE_GLYPH, top: "Scaricala su", main: "App Store" }));
  container.appendChild(storeBadge({ url: PLAY_STORE_URL, glyph: PLAY_GLYPH, top: "Disponibile su", main: "Google Play" }));
}

renderBadges(document.getElementById("badges-hero"));
renderBadges(document.getElementById("badges-cta"));

// Anno footer
var yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// ---------------------------------------------------------------------------
// Pulizia del vecchio service worker della web app (PWA)
// Chi aveva visitato/installato la vecchia web app ha un service worker
// registrato su civicvois.it che potrebbe servire la vecchia app dalla cache.
// Qui lo disregistriamo e svuotiamo le cache, così resta solo la landing.
// (Il kill-switch in /service-worker.js fa lo stesso lato worker.)
// ---------------------------------------------------------------------------
(function cleanupOldServiceWorker() {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      }).catch(function () {});
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) { caches.delete(k); });
      }).catch(function () {});
    }
  } catch (e) { /* no-op */ }
})();
