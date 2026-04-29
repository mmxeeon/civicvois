const CIVICVOIS_CACHE = "civicvois-pwa-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/css/styles.css",
  "/assets/js/app.js",
  "/assets/js/config.js",
  "/assets/js/supabase-proxy.js",
  "/assets/img/civicvois-logo.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/maskable-192.png",
  "/assets/icons/maskable-512.png",
  "/assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CIVICVOIS_CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CIVICVOIS_CACHE).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Le API reali devono sempre andare online: niente cache su login, segnalazioni, like, immagini.
  if (url.origin === self.location.origin && url.pathname.startsWith("/.netlify/functions/")) return;

  // Non intercettiamo risorse esterne come mappe, CDN Leaflet o API indirizzi.
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/service-worker.js") return;

  // Navigazione: network-first, fallback all'app shell solo se offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CIVICVOIS_CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  const isStaticAsset = /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|webmanifest)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  // Asset statici: network-first per non bloccare aggiornamenti dopo deploy.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CIVICVOIS_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
