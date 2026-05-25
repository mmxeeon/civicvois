// CivicVois — configurazione runtime
// Punto unico per l'URL del backend. Vale sia per la PWA (browser) sia per
// l'app nativa (Capacitor su iOS/Android): tutte le chiamate alle Netlify
// Functions usano URL assoluti, così la WebView nativa (origin
// capacitor://localhost o http://localhost) non costruisce mai URL sbagliati.

export const API_BASE_URL = "https://civicvois.it/.netlify/functions";

// Costruisce l'URL assoluto di una Netlify Function.
// Esempio: apiUrl("civicvois-api") → https://civicvois.it/.netlify/functions/civicvois-api
export function apiUrl(functionName) {
  const name = String(functionName || "").replace(/^\/+/, "");
  return `${API_BASE_URL}/${name}`;
}

// True quando l'app gira dentro un contenitore Capacitor.
export const IS_NATIVE_APP = (() => {
  try {
    if (typeof window === "undefined") return false;
    if (window.Capacitor?.isNativePlatform?.()) return true;
    const origin = window.location?.origin || "";
    if (origin.startsWith("capacitor://")) return true;
    if (origin === "http://localhost" || origin === "https://localhost") return true;
    return false;
  } catch {
    return false;
  }
})();

// Compat: il vecchio codice importa questi tre simboli per decidere se attivare
// il backend reale. Mantengo i placeholder così "hasSupabaseConfig" resta true
// e l'app continua a usare il proxy verso Netlify Functions.
export const SUPABASE_URL = "https://netlify-blobs.civicvois.local";
export const SUPABASE_ANON_KEY = "netlify-blobs-local-backend-key";
export const FORCE_DEMO_MODE = false;
