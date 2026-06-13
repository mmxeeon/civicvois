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

// Progetto Supabase (database reale, sostituisce Netlify Blobs).
// La publishable key è PUBBLICA per definizione: sta nel client ed è protetta
// dalle policy RLS lato database. La secret key NON va mai qui.
export const SUPABASE_URL = "https://zqvzpnaxsoxpljdzojjq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_0ftTXKs9-PrbOhLn--iYWw_AkWUCASj";
export const FORCE_DEMO_MODE = false;

// ── Social login (Google + Facebook) ─────────────────────────────────────
// Web Client ID di Google (usato sul sito browser e come audience del JWT
// che il backend valida). Su app nativa Capacitor il client ID iOS/Android è
// configurato in capacitor.config.json.
export const GOOGLE_WEB_CLIENT_ID = "951133750252-icj1g21p1tude2ra1c5par5jkhm7t1l8.apps.googleusercontent.com";

// Facebook App ID (vuoto finché non crei l'app su developers.facebook.com).
// Quando l'avrai inserito qui + nei Netlify env vars + Info.plist, il login
// Facebook su sito e app funzionerà.
export const FACEBOOK_APP_ID = "";
