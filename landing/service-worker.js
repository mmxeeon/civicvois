// ============================================================================
// CivicVois — Service worker "kill-switch" della landing.
//
// civicvois.it ora serve una semplice landing page, non più la web app PWA.
// Chi aveva visitato la vecchia web app ha un service worker registrato che
// poteva continuare a servire l'app dalla cache. Quando il browser ricontrolla
// /service-worker.js (servito no-cache) trova QUESTO worker: si installa,
// svuota tutte le cache, si disregistra e ricarica le schede aperte, lasciando
// solo la landing. Una volta ripulito, sulla landing non resta alcun SW.
// ============================================================================

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      } catch (e) { /* no-op */ }
      try {
        await self.registration.unregister();
      } catch (e) { /* no-op */ }
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach(function (client) {
          try { client.navigate(client.url); } catch (e) { /* no-op */ }
        });
      } catch (e) { /* no-op */ }
    })()
  );
});

// Nessun fetch handler: le richieste vanno direttamente alla rete (la landing è
// statica e leggera). Così non re-introduciamo cache della vecchia app.
