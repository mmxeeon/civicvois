// Registrazione del service worker, estratta da index.html per permettere una
// Content-Security-Policy stretta senza 'unsafe-inline' sugli script.
//
// Il service worker serve SOLO nella PWA (browser): dentro Capacitor
// (capacitor:// oppure http://localhost) i SW non sono supportati / non servono,
// perché gli asset sono già impacchettati nell'app nativa.
(function () {
  var origin = window.location.origin || "";
  var isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var isLocalNative = origin === "http://localhost" || origin === "https://localhost" || origin.indexOf("capacitor://") === 0;
  if (isCapacitor || isLocalNative) return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/service-worker.js").catch(function (error) {
      console.warn("Service worker CivicVois non registrato", error);
    });
  });
})();
