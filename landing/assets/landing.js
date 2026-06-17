// ============================================================================
// CivicVois — Landing page (interazioni 3D + config store + cleanup SW)
// ============================================================================

// ►► LINK STORE — quando avrai gli URL reali, sostituisci '#' qui sotto.
//    Appena un URL è diverso da '#', il bottone si attiva automaticamente
//    (niente più stato "In arrivo").
var APP_STORE_URL = "#"; // es: "https://apps.apple.com/app/idXXXXXXXXX"
var PLAY_STORE_URL = "#"; // es: "https://play.google.com/store/apps/details?id=it.civicvois.app"

var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;

// ---------------------------------------------------------------------------
// Badge store
// ---------------------------------------------------------------------------
var APPLE_GLYPH =
  '<svg class="glyph" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M16.36 12.78c.02 2.45 2.15 3.27 2.18 3.28-.02.06-.34 1.17-1.12 2.31-.67.99-1.37 1.97-2.47 1.99-1.08.02-1.43-.64-2.66-.64-1.24 0-1.62.62-2.64.66-1.06.04-1.87-1.07-2.55-2.05-1.38-2-2.44-5.66-1.02-8.13.7-1.23 1.96-2 3.33-2.02 1.04-.02 2.02.7 2.66.7.63 0 1.83-.86 3.08-.74.53.02 2 .21 2.95 1.6-.08.05-1.76 1.03-1.74 3.07M14.4 6.07c.56-.68.94-1.62.84-2.57-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.56-.85 2.48.9.07 1.82-.46 2.38-1.13"/></svg>';
var PLAY_GLYPH =
  '<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"><path fill="#2bd4ee" d="M3.6 2.3 13.5 12 3.6 21.7c-.36-.18-.6-.55-.6-1V3.3c0-.45.24-.82.6-1z"/><path fill="#19c08a" d="M16.8 8.7 13.5 12 16.8 15.3 20.5 13.2c.7-.4.7-1.4 0-1.8L16.8 8.7z"/><path fill="#fff" d="M3.6 2.3c.16-.08.34-.13.53-.13.18 0 .37.05.54.15L16.8 8.7 13.5 12 3.6 2.3z"/><path fill="#cbd5e1" d="M13.5 12l3.3 3.3-12.13 6.4c-.17.1-.36.15-.54.15-.19 0-.37-.05-.53-.13L13.5 12z"/></svg>';

function storeBadge(opts) {
  var enabled = opts.url && opts.url !== "#";
  var a = document.createElement("a");
  a.className = "store-badge";
  if (enabled) {
    a.href = opts.url; a.target = "_blank"; a.rel = "noopener";
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
function renderBadges(c) {
  if (!c) return;
  c.appendChild(storeBadge({ url: APP_STORE_URL, glyph: APPLE_GLYPH, top: "Scaricala su", main: "App Store" }));
  c.appendChild(storeBadge({ url: PLAY_STORE_URL, glyph: PLAY_GLYPH, top: "Disponibile su", main: "Google Play" }));
}
renderBadges(document.getElementById("badges-hero"));
renderBadges(document.getElementById("badges-cta"));

var yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// ---------------------------------------------------------------------------
// Scroll-reveal (IntersectionObserver). Con reduced-motion il contenuto è già
// visibile (vedi CSS) e non agganciamo nulla.
// ---------------------------------------------------------------------------
(function reveal() {
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  // Stagger tra fratelli nella stessa griglia
  items.forEach(function (el) {
    var sibs = el.parentElement ? Array.prototype.slice.call(el.parentElement.children).filter(function (c) { return c.hasAttribute("data-reveal"); }) : [el];
    var i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = (i * 80) + "ms";
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
  items.forEach(function (el) { io.observe(el); });
})();

// ---------------------------------------------------------------------------
// Hero: telefono 3D con tilt + parallax delle chip al movimento del mouse.
// Solo desktop (pointer fine) e con motion abilitato.
// ---------------------------------------------------------------------------
(function hero3d() {
  if (reduceMotion || !finePointer) return;
  var scene = document.querySelector(".scene");
  var el = document.getElementById("scene3d");
  if (!scene || !el) return;
  var raf = null, tx = 0, ty = 0;
  scene.addEventListener("pointermove", function (ev) {
    var r = scene.getBoundingClientRect();
    var px = (ev.clientX - r.left) / r.width - 0.5;
    var py = (ev.clientY - r.top) / r.height - 0.5;
    tx = px; ty = py;
    if (!raf) raf = requestAnimationFrame(apply);
  });
  scene.addEventListener("pointerleave", function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
  function apply() {
    raf = null;
    var ry = tx * 16, rx = -ty * 14;
    el.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
  }
})();

// ---------------------------------------------------------------------------
// Card 3D tilt verso il cursore (solo desktop + motion abilitato).
// ---------------------------------------------------------------------------
(function cardTilt() {
  if (reduceMotion || !finePointer) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-tilt]"));
  cards.forEach(function (card) {
    var raf = null, rx = 0, ry = 0;
    card.addEventListener("pointermove", function (ev) {
      var r = card.getBoundingClientRect();
      ry = ((ev.clientX - r.left) / r.width - 0.5) * 8;
      rx = -((ev.clientY - r.top) / r.height - 0.5) * 8;
      if (!raf) raf = requestAnimationFrame(function () {
        raf = null;
        card.style.transform = "perspective(800px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-3px)";
      });
    });
    card.addEventListener("pointerleave", function () {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      card.style.transform = "";
    });
  });
})();

// ---------------------------------------------------------------------------
// Pulizia del vecchio service worker della web app (PWA): le vecchie
// installazioni non devono più servire l'app dalla cache. Il kill-switch in
// /service-worker.js fa lo stesso lato worker.
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
