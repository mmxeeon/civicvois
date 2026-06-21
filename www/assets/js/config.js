// CivicVois — configurazione runtime
// Il backend è Supabase (database reale + auth + storage). Non esistono più
// Netlify Functions custom: il client parla direttamente con Supabase via HTTPS.

function getCapacitorPlatform() {
  try {
    if (typeof window === "undefined") return "web";
    const platform = String(window.Capacitor?.getPlatform?.() || "").toLowerCase();
    if (platform) return platform;
    const ua = String(window.navigator?.userAgent || "").toLowerCase();
    if (ua.includes("android")) return "android";
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
    return "web";
  } catch {
    return "web";
  }
}

export const CAPACITOR_PLATFORM = getCapacitorPlatform();

// True quando l'app gira dentro un contenitore Capacitor.
export const IS_NATIVE_APP = (() => {
  try {
    if (typeof window === "undefined") return false;
    const capacitor = window.Capacitor;
    if (capacitor?.isNativePlatform?.()) return true;
    if (["ios", "android"].includes(CAPACITOR_PLATFORM)) return true;
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

export const IS_IOS_NATIVE_APP = IS_NATIVE_APP && CAPACITOR_PLATFORM === "ios";
export const IS_ANDROID_NATIVE_APP = IS_NATIVE_APP && CAPACITOR_PLATFORM === "android";

// Progetto Supabase (database reale, sostituisce Netlify Blobs).
// La publishable key è PUBBLICA per definizione: sta nel client ed è protetta
// dalle policy RLS lato database. La secret key NON va mai qui.
export const SUPABASE_URL = "https://zqvzpnaxsoxpljdzojjq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_0ftTXKs9-PrbOhLn--iYWw_AkWUCASj";
export const FORCE_DEMO_MODE = false;

// ── Social login (Apple + Google + Facebook) ─────────────────────────────
// Apple non richiede secret nel client: Client ID/secret del provider vanno
// configurati in Supabase Auth quando l'account Apple Developer sarà attivo.
// Web Client ID di Google (usato sul sito browser e come audience del JWT
// che il backend valida). Su app nativa Capacitor il client ID iOS/Android è
// configurato in capacitor.config.json.
export const GOOGLE_WEB_CLIENT_ID = "951133750252-icj1g21p1tude2ra1c5par5jkhm7t1l8.apps.googleusercontent.com";

// Apple deve restare disponibile su iOS per App Store quando sono presenti
// login social alternativi. Su Android e web resta nascosto finché il provider
// Apple non è abilitato in Supabase, così il Play Store non espone un bottone
// non funzionante.
export const APPLE_SIGN_IN_IOS_ENABLED = true;
export const APPLE_SIGN_IN_ANDROID_ENABLED = false;
export const APPLE_SIGN_IN_WEB_ENABLED = false;

// Facebook App ID (vuoto finché non crei l'app su developers.facebook.com).
// Quando l'avrai inserito qui e nelle configurazioni native, il login Facebook
// potrà essere abilitato su sito e app.
export const FACEBOOK_APP_ID = "";
