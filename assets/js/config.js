// CivicVois — configurazione runtime
// Il backend è Supabase (database reale + auth + storage). Non esistono più
// Netlify Functions custom: il client parla direttamente con Supabase via HTTPS.

// True quando l'app gira dentro un contenitore Capacitor.
export const IS_NATIVE_APP = (() => {
  try {
    if (typeof window === "undefined") return false;
    const capacitor = window.Capacitor;
    if (capacitor?.isNativePlatform?.()) return true;
    if (["ios", "android"].includes(String(capacitor?.getPlatform?.() || "").toLowerCase())) return true;
    const origin = String(window.location?.origin || "").toLowerCase();
    const protocol = String(window.location?.protocol || "").toLowerCase();
    if (origin.startsWith("capacitor://") || origin.startsWith("civicvois://") || origin.startsWith("ionic://")) return true;
    if (["capacitor:", "civicvois:", "ionic:"].includes(protocol)) return true;
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
// Quando l'avrai inserito qui e nelle configurazioni native, il login Facebook
// potrà essere abilitato su sito e app.
export const FACEBOOK_APP_ID = "";
