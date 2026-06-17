// ============================================================================
// CivicVois — Landing page (background 3D, interazioni, config store, cleanup)
// ============================================================================

// ►► LINK STORE — quando avrai gli URL reali, sostituisci '#' qui sotto.
//    Appena un URL è diverso da '#', il bottone si attiva automaticamente.
var APP_STORE_URL = "#"; // es: "https://apps.apple.com/app/idXXXXXXXXX"
var PLAY_STORE_URL = "#"; // es: "https://play.google.com/store/apps/details?id=it.civicvois.app"

var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
var isSmall = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;

// ---------------------------------------------------------------------------
// Badge store
// ---------------------------------------------------------------------------
var APPLE_GLYPH =
  '<svg class="glyph" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M16.36 12.78c.02 2.45 2.15 3.27 2.18 3.28-.02.06-.34 1.17-1.12 2.31-.67.99-1.37 1.97-2.47 1.99-1.08.02-1.43-.64-2.66-.64-1.24 0-1.62.62-2.64.66-1.06.04-1.87-1.07-2.55-2.05-1.38-2-2.44-5.66-1.02-8.13.7-1.23 1.96-2 3.33-2.02 1.04-.02 2.02.7 2.66.7.63 0 1.83-.86 3.08-.74.53.02 2 .21 2.95 1.6-.08.05-1.76 1.03-1.74 3.07M14.4 6.07c.56-.68.94-1.62.84-2.57-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.56-.85 2.48.9.07 1.82-.46 2.38-1.13"/></svg>';
var PLAY_GLYPH =
  '<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true"><path fill="#2dd4bf" d="M3.6 2.3 13.5 12 3.6 21.7c-.36-.18-.6-.55-.6-1V3.3c0-.45.24-.82.6-1z"/><path fill="#14b8a6" d="M16.8 8.7 13.5 12 16.8 15.3 20.5 13.2c.7-.4.7-1.4 0-1.8L16.8 8.7z"/><path fill="#fff" d="M3.6 2.3c.16-.08.34-.13.53-.13.18 0 .37.05.54.15L16.8 8.7 13.5 12 3.6 2.3z"/><path fill="#9fb6cf" d="M13.5 12l3.3 3.3-12.13 6.4c-.17.1-.36.15-.54.15-.19 0-.37-.05-.53-.13L13.5 12z"/></svg>';

function storeBadge(opts) {
  var enabled = opts.url && opts.url !== "#";
  var a = document.createElement("a");
  a.className = "store-badge";
  if (enabled) { a.href = opts.url; a.target = "_blank"; a.rel = "noopener"; }
  else {
    a.setAttribute("data-disabled", "true"); a.setAttribute("role", "link"); a.setAttribute("aria-disabled", "true");
    a.addEventListener("click", function (e) { e.preventDefault(); });
  }
  a.innerHTML = opts.glyph + '<span><span class="s-top">' + opts.top + '</span><span class="s-main">' + opts.main + "</span></span>" + (enabled ? "" : '<span class="soon">In arrivo</span>');
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
// BACKGROUND 3D — rete di nodi connessi (constellation) con profondità,
// rotazione lenta e parallax dal mouse. Vanilla canvas, nessuna libreria.
// ---------------------------------------------------------------------------
(function network3d() {
  var canvas = document.getElementById("bg");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  var N = isSmall ? 46 : 104;
  var SPREAD, FOCAL = 1.7, LINK = isSmall ? 0.16 : 0.13; // distanza max (in unità proiettate) per la linea
  var pts = [];
  var rotY = 0, rotX = 0, tRotY = 0, tRotX = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function build() {
    pts = [];
    for (var i = 0; i < N; i++) {
      pts.push({ x: rand(-1, 1), y: rand(-1, 1), z: rand(-1, 1), s: rand(0.4, 1), b: Math.random() < 0.18 });
    }
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    SPREAD = Math.min(W, H) * 0.62;
  }

  function project(p, cy) {
    // rotazione attorno a Y poi X
    var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    var x1 = p.x * cosY - p.z * sinY;
    var z1 = p.x * sinY + p.z * cosY;
    var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    var y1 = p.y * cosX - z1 * sinX;
    var z2 = p.y * sinX + z1 * cosX;
    var scale = FOCAL / (FOCAL + z2);
    return { sx: W / 2 + x1 * SPREAD * scale, sy: cy + y1 * SPREAD * scale, scale: scale, depth: (z2 + 1) / 2 };
  }

  function frame() {
    rotY += (tRotY - rotY) * 0.04 + 0.0012;
    rotX += (tRotX - rotX) * 0.04;
    ctx.clearRect(0, 0, W, H);
    var cy = H * 0.42;
    var pr = [];
    for (var i = 0; i < N; i++) pr.push(project(pts[i], cy));
    // linee
    for (var a = 0; a < N; a++) {
      for (var c = a + 1; c < N; c++) {
        var dx = (pr[a].sx - pr[c].sx), dy = (pr[a].sy - pr[c].sy);
        var d = Math.sqrt(dx * dx + dy * dy);
        var max = LINK * SPREAD;
        if (d < max) {
          var al = (1 - d / max) * 0.5 * Math.min(pr[a].depth, pr[c].depth);
          if (al > 0.015) {
            ctx.strokeStyle = "rgba(45,212,191," + al.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pr[a].sx, pr[a].sy); ctx.lineTo(pr[c].sx, pr[c].sy); ctx.stroke();
          }
        }
      }
    }
    // nodi
    for (var k = 0; k < N; k++) {
      var p = pr[k], P = pts[k];
      var r = (P.b ? 2.2 : 1.6) * p.scale * p.s;
      var alpha = 0.25 + p.depth * 0.55;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, Math.max(0.5, r), 0, 6.2832);
      ctx.fillStyle = P.b ? "rgba(99,153,247," + (alpha * 0.9).toFixed(3) + ")" : "rgba(20,184,166," + alpha.toFixed(3) + ")";
      ctx.fill();
    }
  }

  var raf = null;
  function loop() { frame(); raf = requestAnimationFrame(loop); }
  function start() { if (!raf && !document.hidden) loop(); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  build(); resize();
  window.addEventListener("resize", function () { DPR = Math.min(window.devicePixelRatio || 1, 2); resize(); });

  if (reduceMotion) { frame(); return; } // un solo frame statico, niente animazione

  if (finePointer) {
    window.addEventListener("pointermove", function (e) {
      tRotY = (e.clientX / window.innerWidth - 0.5) * 0.6;
      tRotX = (e.clientY / window.innerHeight - 0.5) * -0.4;
    }, { passive: true });
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  start();
})();

// ---------------------------------------------------------------------------
// Scroll-reveal (stagger). Con reduced-motion il contenuto è già visibile.
// ---------------------------------------------------------------------------
(function reveal() {
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (reduceMotion || !("IntersectionObserver" in window)) { items.forEach(function (el) { el.classList.add("in"); }); return; }
  items.forEach(function (el) {
    var sibs = el.parentElement ? Array.prototype.slice.call(el.parentElement.children).filter(function (c) { return c.hasAttribute("data-reveal"); }) : [el];
    var i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = (i * 80) + "ms";
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
  items.forEach(function (el) { io.observe(el); });
})();

// ---------------------------------------------------------------------------
// Hero: telefono 3D — float continuo + tilt al mouse; chip a profondità.
// ---------------------------------------------------------------------------
(function hero3d() {
  var scene = document.querySelector(".scene");
  var el = document.getElementById("scene3d");
  if (!el) return;
  // profondità delle chip (parallax 3D durante la rotazione)
  Array.prototype.slice.call(el.querySelectorAll("[data-depth]")).forEach(function (ch) {
    ch.style.transform = "translateZ(" + (parseFloat(ch.getAttribute("data-depth")) || 0) + "px)";
  });
  if (reduceMotion) return;

  var tx = 0, ty = 0, t0 = null, raf = null;
  if (scene && finePointer) {
    scene.addEventListener("pointermove", function (ev) {
      var r = scene.getBoundingClientRect();
      tx = (ev.clientX - r.left) / r.width - 0.5;
      ty = (ev.clientY - r.top) / r.height - 0.5;
    });
    scene.addEventListener("pointerleave", function () { tx = 0; ty = 0; });
  }
  function tick(t) {
    if (t0 === null) t0 = t;
    var time = (t - t0) / 1000;
    var floatY = Math.sin(time * 0.9) * 7;        // galleggiamento
    var ry = tx * 16 + Math.sin(time * 0.5) * 1.4; // rotazione + micro-drift
    var rx = -ty * 13 + Math.cos(time * 0.7) * 1.0;
    el.style.transform = "translateY(" + floatY.toFixed(2) + "px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)";
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } t0 = null; }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  start();
})();

// ---------------------------------------------------------------------------
// Card 3D tilt verso il cursore (solo desktop + motion abilitato).
// ---------------------------------------------------------------------------
(function cardTilt() {
  if (reduceMotion || !finePointer) return;
  Array.prototype.slice.call(document.querySelectorAll("[data-tilt]")).forEach(function (card) {
    var raf = null, rx = 0, ry = 0;
    card.addEventListener("pointermove", function (ev) {
      var r = card.getBoundingClientRect();
      ry = ((ev.clientX - r.left) / r.width - 0.5) * 7;
      rx = -((ev.clientY - r.top) / r.height - 0.5) * 7;
      if (!raf) raf = requestAnimationFrame(function () { raf = null; card.style.transform = "perspective(820px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-4px)"; });
    });
    card.addEventListener("pointerleave", function () { if (raf) { cancelAnimationFrame(raf); raf = null; } card.style.transform = ""; });
  });
})();

// ---------------------------------------------------------------------------
// Pulizia del vecchio service worker della web app (PWA).
// ---------------------------------------------------------------------------
(function cleanupOldServiceWorker() {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) { regs.forEach(function (r) { r.unregister(); }); }).catch(function () {});
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) { keys.forEach(function (k) { caches.delete(k); }); }).catch(function () {});
    }
  } catch (e) { /* no-op */ }
})();
