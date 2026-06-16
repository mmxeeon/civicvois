import { SUPABASE_URL, SUPABASE_ANON_KEY, FORCE_DEMO_MODE, IS_NATIVE_APP, GOOGLE_WEB_CLIENT_ID, FACEBOOK_APP_ID } from "./config.js";
import { createSupabaseClient } from "./supabase-client.js";
import { pageRoutes } from "./pages/index.js";

// ─── Costanti ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  "cartelli stradali assenti",
  "cartelli stradali caduti",
  "cartelli stradali danneggiati o vandalizzati",
  "cartelli stradali non riflettenti",
  "strade rotte o piene di buche",
  "strade invase da ostacoli",
  "frane o smottamenti",
  "allagamenti e pozzanghere",
  "ghiaccio o superfici scivolose",
  "illuminazione insufficiente",
  "ostacoli per la mobilità",
  "vegetazione non potata",
  "animali randagi o feriti",
  "rifiuti e discariche abusive",
  "attraversamenti pedonali usurati",
  "segnaletica orizzontale mancante o deteriorata",
  "accesso disagevole ai passi carrabili",
  "traffico eccessivo o ingorghi ricorrenti"
];

const STATUSES = ["nuova", "verificata", "in carico", "risolta", "archiviata"];
const PRIORITIES = ["bassa", "media", "alta", "urgente"];
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const PROFILE_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  MISSING: "missing",
  ERROR: "error"
};
const PRIVATE_PROFILE_ROUTES = new Set(["new", "profile", "profile/edit", "admin", "complete-profile"]);
const PROFILE_ATTEMPT_TIMEOUT_MS = 4500;
const PROFILE_LOADING_GRACE_MS = 12000;
const AUTH_CONNECTIVITY_TIMEOUT_MS = 7000;
const NATIVE_OAUTH_REDIRECT = "it.civicvois.app://login-callback";
const NATIVE_OAUTH_PENDING_KEY = "cv_native_oauth_pending";
const NATIVE_OAUTH_SESSION_READY = "__civicvois_native_oauth_session_ready__";
const NATIVE_OAUTH_PENDING_MAX_AGE_MS = 5 * 60 * 1000;

let nativeOAuthLifecycleInstalled = false;
let nativeOAuthRecoveryRunning = false;
let nativeOAuthFinalizeRunning = false;
let nativeOAuthWaiter = null;

// Lista comuni servita LOCALMENTE (assets/data/comuni.json): niente più fetch da
// CDN a runtime (fix audit C-13) → funziona offline e senza esporre l'IP a terzi.
// Se il file locale non fosse disponibile, resta il fallback statico FALLBACK_LOCATIONS.
const ITALY_LOCATION_SOURCES = [
  "assets/data/comuni.json"
];

const FALLBACK_LOCATIONS = [
  { nome: "Verano Brianza", provincia: { nome: "Monza e Brianza", sigla: "MB" }, regione: { nome: "Lombardia" } },
  { nome: "Giussano", provincia: { nome: "Monza e Brianza", sigla: "MB" }, regione: { nome: "Lombardia" } },
  { nome: "Seregno", provincia: { nome: "Monza e Brianza", sigla: "MB" }, regione: { nome: "Lombardia" } },
  { nome: "Carate Brianza", provincia: { nome: "Monza e Brianza", sigla: "MB" }, regione: { nome: "Lombardia" } },
  { nome: "Monza", provincia: { nome: "Monza e Brianza", sigla: "MB" }, regione: { nome: "Lombardia" } },
  { nome: "Milano", provincia: { nome: "Milano", sigla: "MI" }, regione: { nome: "Lombardia" } },
  { nome: "Como", provincia: { nome: "Como", sigla: "CO" }, regione: { nome: "Lombardia" } },
  { nome: "Lecco", provincia: { nome: "Lecco", sigla: "LC" }, regione: { nome: "Lombardia" } },
  { nome: "Roma", provincia: { nome: "Roma", sigla: "RM" }, regione: { nome: "Lazio" } }
];

const PAGE_SIZE = 10; // home privata: massimo 10 segnalazioni (mappa sempre visibile, niente scroll infinito)

// ─── Helpers DOM ──────────────────────────────────────────────────────────────

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const app = $("#app");

// ─── Modalità backend ─────────────────────────────────────────────────────────

const hasSupabaseConfig = Boolean(SUPABASE_URL?.startsWith("https://") && SUPABASE_ANON_KEY?.length > 20);
const DEMO_MODE = FORCE_DEMO_MODE || !hasSupabaseConfig;

const supabase = DEMO_MODE ? null : createSupabaseClient({
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY
});

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry(operation, attempts = 2) {
  let lastResult;
  let lastThrown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await operation();
      lastResult = result;
      if (!result?.error || !isRetryableError(result.error)) return result;
      if (isAuthTokenError(result.error) && attempt < attempts - 1) {
        await ensureFreshAuthSession({ force: true }).catch(() => undefined);
      }
    } catch (error) {
      lastThrown = error;
      if (isAuthTokenError(error) && attempt < attempts - 1) {
        await ensureFreshAuthSession({ force: true }).catch(() => undefined);
      }
      if (!isRetryableError(error) || attempt === attempts - 1) throw error;
    }
    await wait(450 * (attempt + 1));
  }
  if (lastThrown) throw lastThrown;
  return lastResult;
}

function isRetryableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return isAuthTokenError(error)
    || message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("timeout");
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Messaggi di errore leggibili ─────────────────────────────────────────────

function niceBackendError(error, fallback = "Operazione non riuscita.") {
  const raw = String(error?.message || error?.error_description || error || "").trim();
  const message = raw.toLowerCase();
  // Errori di rete: messaggio comprensibile, niente gergo tecnico
  if (message.includes("failed to fetch") || message.includes("networkerror") || message.includes("network request failed")) {
    return "Connessione assente. Controlla la rete e riprova.";
  }
  if (message.includes("timeout")) return "La richiesta ha impiegato troppo tempo. Riprova.";
  if (message.includes("invalid login credentials")) return "Email o password non corretti.";
  if (message.includes("email not confirmed")) return "Email non ancora confermata: controlla la posta per il link di conferma prima di accedere.";
  if (message.includes("already registered") || message.includes("user already registered")) return "Questo indirizzo email è già registrato. Vai su Accedi.";
  if (message.includes("duplicate") && message.includes("username")) return "Username già usato. Scegline uno diverso.";
  if (message.includes("row-level security") || message.includes("permess")) return `${fallback} Riprova tra poco.`;
  return raw || fallback;
}

// ─── USERNAME / CLEAN ─────────────────────────────────────────────────────────

function cleanUsername(value) {
  const cleaned = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 28);
  return cleaned || `utente-${crypto.randomUUID().slice(0, 6)}`;
}

function clean(value) {
  return String(value || "").trim();
}

// Filtro contenuti UGC: blocca alla fonte i termini palesemente offensivi prima
// che la segnalazione venga pubblicata (requisito App Store Guideline 1.2 / Play
// UGC). È volutamente conservativo e con confine di parola per ridurre i falsi
// positivi; la moderazione (coda admin + blocco utenti) gestisce i casi residui.
const PROHIBITED_TERMS = [
  "vaffanculo", "vaffanc", "stronzo", "stronza", "stronzi", "coglione", "coglioni",
  "puttana", "puttane", "troia", "troie", "bastardo", "bastarda", "ricchione",
  "frocio", "froci", "negro", "negra", "negri", "mongoloide", "ritardato",
  "handicappato", "zoccola", "checca", "terrone", "terroni",
  "fuck", "shit", "bitch", "asshole", "nigger", "faggot", "cunt", "retard", "whore"
];

function normalizeForFilter(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Restituisce true se uno dei testi contiene un termine proibito come parola intera.
function hasProhibitedContent(...texts) {
  const haystack = normalizeForFilter(texts.join(" "));
  return PROHIBITED_TERMS.some(term => {
    const t = normalizeForFilter(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(haystack);
  });
}

function storagePathFromPublicUrl(url, bucket) {
  if (!url || !bucket) return "";
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return "";
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return "";
  }
}

function uniqueOwnStoragePaths(urls, bucket, userId) {
  const prefix = `${userId}/`;
  return [...new Set(
    urls
      .map(url => storagePathFromPublicUrl(url, bucket))
      .filter(path => path && path.startsWith(prefix))
  )];
}

function currentAccessToken() {
  return state.session?.access_token || readStoredSupabaseSession()?.access_token || "";
}

async function supabaseRestJson(path, { method = "GET", body = null, prefer = "" } = {}) {
  const token = currentAccessToken();
  if (!token) throw new Error("Sessione account non disponibile.");
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
  };
  if (body !== null) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  const response = await withTimeout(
    fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body)
    }),
    12000,
    `REST ${method} ${path.split("?")[0]}`
  );

  if (!response.ok) {
    let details = "";
    try { details = await response.text(); } catch {}
    throw new Error(details || `Richiesta Supabase non riuscita (${response.status}).`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function restLoadProfile(userId) {
  const rows = await supabaseRestJson(`profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
  return Array.isArray(rows) ? (rows[0] || null) : rows;
}

async function restUpsertProfile(userId, payload) {
  const row = {
    id: userId,
    full_name: payload.full_name,
    username: payload.username,
    bio: payload.bio,
    regione: payload.regione,
    provincia: payload.provincia,
    comune: payload.comune,
    avatar_url: payload.avatar_url,
    updated_at: new Date().toISOString()
  };
  const rows = await supabaseRestJson("profiles?on_conflict=id&select=*", {
    method: "POST",
    body: row,
    prefer: "resolution=merge-duplicates,return=representation"
  });
  return Array.isArray(rows) ? (rows[0] || null) : rows;
}

async function restRpc(functionName, body = {}) {
  return supabaseRestJson(`rpc/${encodeURIComponent(functionName)}`, {
    method: "POST",
    body
  });
}

const REPORT_SELECT = "id,user_id,titolo,tipo,descrizione,priorita,stato,regione,provincia,comune,via,civico,lat,lng,photo_url,like_count,created_at,updated_at";

// Inserimento segnalazione via REST diretto con JWT (come per il profilo): evita
// supabase.from().insert() che passa dal lock auth di supabase-js e poteva
// restare appeso ("errore timeout" alla pubblicazione).
async function restInsertReport(insertable) {
  const rows = await supabaseRestJson(`segnalazioni?select=${REPORT_SELECT}`, {
    method: "POST",
    body: insertable,
    prefer: "return=representation"
  });
  return Array.isArray(rows) ? (rows[0] || null) : rows;
}

// Upload foto via REST diretto allo Storage di Supabase, sempre con il JWT già
// disponibile: niente supabase.storage (che richiede il lock auth e poteva
// bloccarsi). Restituisce l'URL pubblico.
async function restUploadPhoto(file, bucket) {
  const token = currentAccessToken();
  if (!token) throw new Error("Sessione account non disponibile.");
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
  const base = SUPABASE_URL.replace(/\/$/, "");
  const response = await withTimeout(
    fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
        "Cache-Control": "3600",
        "x-upsert": "false"
      },
      body: file
    }),
    25000,
    "caricamento foto"
  );
  if (!response.ok) {
    let details = "";
    try { details = await response.text(); } catch {}
    throw new Error(details || `Caricamento foto non riuscito (${response.status}).`);
  }
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  ADAPTER BACKEND
//  Interfaccia uniforme: backend.login(), backend.register(), ecc.
//  Internamente usa il demo locale oppure la Netlify Function/Supabase.
// ─────────────────────────────────────────────────────────────────────────────

const backend = DEMO_MODE ? createDemoAdapter() : createSupabaseAdapter();

function createDemoAdapter() {
  const demoDb = createDemoBackend();

  return {
    isDemo: true,

    async login({ email, password }) {
      const user = demoDb.login(email, password);
      if (!user) throw new Error("Credenziali demo non trovate. Registrati o usa il pulsante demo.");
      const profile = demoDb.getProfile(user.id);
      writeLocal("cv_demo_user", user);
      return { user, profile };
    },

    async register(payload) {
      if (payload.avatarFile instanceof File && payload.avatarFile.size > 0) {
        payload.avatar_url = await fileToDataUrl(payload.avatarFile);
      }
      const user = demoDb.ensureUser(payload);
      const profile = demoDb.getProfile(user.id);
      writeLocal("cv_demo_user", user);
      return { user, profile };
    },

    async startOAuth() {
      throw new Error("Accesso Google non disponibile in modalità demo.");
    },

    async logout() {
      localStorage.removeItem("cv_demo_user");
    },

    async restoreSession() {
      const saved = readLocal("cv_demo_user", null);
      if (!saved) return null;
      const profile = demoDb.getProfile(saved.id);
      return { user: saved, profile };
    },

    async fetchReports({ page = 0 } = {}) {
      const all = demoDb.listReports();
      const start = page * PAGE_SIZE;
      return { reports: all.slice(start, start + PAGE_SIZE), total: all.length };
    },

    async fetchLikes(userId) {
      return demoDb.getLikes(userId);
    },

    async fetchProfile(userId) {
      return demoDb.getProfile(userId);
    },

    async saveProfile(userId, payload) {
      if (payload.avatarFile instanceof File && payload.avatarFile.size > 0) {
        payload.avatar_url = await fileToDataUrl(payload.avatarFile);
      }
      demoDb.updateProfile(userId, payload);
      return demoDb.getProfile(userId);
    },

    async createReport(payload) {
      if (payload.photoFile instanceof File && payload.photoFile.size > 0) {
        payload.photo_url = await fileToDataUrl(payload.photoFile);
      }
      demoDb.addReport(payload);
    },

    async deleteReport(id) {
      demoDb.deleteReport(id);
    },

    async toggleLike(userId, reportId) {
      demoDb.toggleLike(userId, reportId);
    },

    async updateReportAdmin(id, patch) {
      demoDb.updateReport(id, { ...patch, updated_at: new Date().toISOString() });
    },

    async uploadPhoto(file) {
      return fileToDataUrl(file);
    },

    onAuthChange() {
      // Nessun listener in demo mode
    }
  };
}

function createSupabaseAdapter() {
  return {
    isDemo: false,

    async login({ email, password }) {
      const { data, error } = await withRetry(() =>
        supabase.auth.signInWithPassword({ email, password })
      );
      if (error) throw new Error(niceBackendError(error, "Accesso non riuscito."));
      const profile = await this._ensureProfile(data.user);
      return { user: data.user, session: data.session, profile };
    },

    async register({ email, password, avatarFile, ...meta }) {
      const { data, error } = await withRetry(() =>
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: meta.full_name,
              username: meta.username,
              regione: meta.regione,
              provincia: meta.provincia,
              comune: meta.comune,
              bio: meta.bio
            }
          }
        })
      );
      if (error) throw new Error(niceBackendError(error, "Registrazione non riuscita."));
      if (!data.user || !data.session) return { user: null, session: null, profile: null, needsConfirm: true };

      let avatar_url = "";
      if (avatarFile instanceof File && avatarFile.size > 0) {
        avatar_url = await this.uploadPhoto(avatarFile, "avatars");
      }
      const profile = await this._ensureProfile(data.user, { ...meta, avatar_url });
      return { user: data.user, session: data.session, profile };
    },

    async socialLogin({ provider, token, profileHint }) {
      // Supabase verifica l'id-token col provider (audience = i Client ID configurati).
      const { data, error } = await supabase.auth.signInWithIdToken({ provider, token });
      if (error) throw new Error(niceBackendError(error, "Accesso social non riuscito."));
      const profile = await this._ensureProfile(data.user, profileHint || {});
      return { user: data.user, session: data.session, profile };
    },

    async oauthFinalize(profileHint = {}, knownSession = null) {
      // Path nativo (Supabase OAuth + deep link): la sessione è già stata creata
      // da exchangeCodeForSession. Recuperiamo l'utente corrente e garantiamo il
      // profilo (gli account social nascono senza comune/provincia).
      let session = knownSession || state.session || readStoredSupabaseSession();
      if (!session) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(niceBackendError(error, "Sessione Google non recuperata."));
        session = data?.session || null;
      }
      const user = session?.user;
      if (!user) throw new Error("Sessione Google non disponibile dopo il login.");
      syncSessionState(session);
      const profile = await withTimeout(this._ensureProfile(user, profileHint || {}), 12000, "profilo Google");
      return { user, session, profile };
    },

    async startOAuth({ provider, redirectTo }) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === "google" ? {
            prompt: "select_account",
            access_type: "offline"
          } : undefined
        }
      });
      if (error) throw new Error(niceBackendError(error, "Accesso social non riuscito."));
      return { redirecting: true };
    },

    async logout() {
      try {
        await withTimeout(supabase.auth.signOut({ scope: "local" }), 6000, "logout");
      } catch (error) {
        console.warn("Logout Supabase locale non riuscito nei tempi, pulisco lo storage manualmente.", error);
        clearStoredSupabaseSession();
      }
    },

    async deleteAccount() {
      const session = await ensureFreshAuthSession({ refreshWindowMs: 120000 });
      if (!session?.user?.id || session.user.id !== state.user?.id) {
        throw new Error("Sessione account non valida. Esci e accedi di nuovo prima di eliminare l'account.");
      }
      // Pulizia storage best-effort E con timeout: su WebView nativa una
      // remove può restare appesa; non deve MAI bloccare la cancellazione.
      try {
        await withTimeout(this.deleteOwnStorageFiles(state.user?.id), 8000, "pulizia storage");
      } catch (error) {
        console.warn("Pulizia storage prima della cancellazione account saltata (timeout o errore).", error);
      }
      // RPC con timeout: se la richiesta resta appesa (rete/WebView), non lasciamo
      // il bottone su "Eliminazione..." all'infinito — l'utente vede un errore e riprova.
      try {
        await withTimeout(restRpc("delete_my_account"), 15000, "eliminazione account");
      } catch (directError) {
        console.warn("Eliminazione account via REST diretto non riuscita, provo client Supabase.", directError);
        await withTimeout(withRetry(() => supabase.deleteAccount(), 2), 20000, "eliminazione account");
      }
      try {
        await withTimeout(supabase.auth.signOut({ scope: "local" }), 5000, "logout"); // best-effort dopo delete auth.users
      } catch (error) {
        console.warn("Sessione locale non ripulita automaticamente dopo la cancellazione account.", error);
      }
    },

    async deleteOwnStorageFiles(userId = state.user?.id) {
      if (!userId) return;
      await ensureFreshAuthSession({ session: state.session, refreshWindowMs: 120000 });
      const { data: reports, error: reportsError } = await withRetry(() =>
        supabase
          .from("segnalazioni")
          .select("photo_url")
          .eq("user_id", userId)
      );
      if (reportsError) throw reportsError;

      const profile = state.profile?.id === userId ? state.profile : await this._loadProfile(userId).catch(() => null);
      const reportPaths = uniqueOwnStoragePaths((reports || []).map(r => r.photo_url), "report-photos", userId);
      const avatarPaths = uniqueOwnStoragePaths([profile?.avatar_url], "avatars", userId);

      if (reportPaths.length) {
        const { error } = await withRetry(() => supabase.storage.from("report-photos").remove(reportPaths), 2);
        if (error) throw error;
      }
      if (avatarPaths.length) {
        const { error } = await withRetry(() => supabase.storage.from("avatars").remove(avatarPaths), 2);
        if (error) throw error;
      }
    },

    // ── Moderazione contenuti ──────────────────────────────────────────────
    async reportContent(targetId, reason = "") {
      await supabase.moderation({ action: "report", targetId, reason });
    },
    async blockUser(targetUserId) {
      await supabase.moderation({ action: "block", targetUserId });
    },
    async fetchBlocks() {
      const res = await supabase.moderation({ action: "list-blocks" });
      return new Set(res?.data || []);
    },
    async fetchModerationReports() {
      const res = await supabase.moderation({ action: "list-reports" });
      return res?.data || [];
    },
    async resolveModerationReport(reportId) {
      await supabase.moderation({ action: "resolve-report", reportId });
    },

    async restoreSession() {
      let initialSession = state.session || readStoredSupabaseSession();
      if (!initialSession) {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data?.session) return null;
        initialSession = data.session;
      }
      const session = await ensureFreshAuthSession({ session: initialSession, refreshWindowMs: 120000 }).catch(() => initialSession);
      const verified = await withTimeout(supabase.auth.getUser(), 8000, "verifica utente").catch((verifyError) => {
        if (isAuthTokenError(verifyError)) throw verifyError;
        console.warn("Verifica utente non riuscita durante il ripristino sessione.", verifyError);
        return null;
      });
      if (verified?.error) {
        if (isAuthTokenError(verified.error)) throw verified.error;
        console.warn("Verifica utente non riuscita durante il ripristino sessione.", verified.error);
      }
      const user = verified?.data?.user || session.user;
      if (!user) return null;
      // A cold-start leggiamo solo il profilo esistente e con timeout breve:
      // niente upsert qui, niente attese lunghe prima di sbloccare la UI.
      const profileResult = await readCurrentUserProfile(user);
      return { user, session, ...profileResult };
    },

    async fetchReportById(id) {
      const { data, error } = await withRetry(() =>
        supabase
          .from("segnalazioni")
          .select("id,user_id,titolo,tipo,descrizione,priorita,stato,regione,provincia,comune,via,civico,lat,lng,photo_url,like_count,created_at,updated_at")
          .eq("id", id)
          .maybeSingle()
      );
      if (error || !data) return null;
      let profiles = null;
      if (data.user_id) {
        const { data: p } = await supabase.from("profiles").select("id,username,full_name,avatar_url,comune,provincia").eq("id", data.user_id).maybeSingle();
        profiles = p || null;
      }
      return { ...data, profiles };
    },

    async fetchReports({ page = 0 } = {}) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: reports, error, count } = await withRetry(() =>
        supabase
          .from("segnalazioni")
          .select("id,user_id,titolo,tipo,descrizione,priorita,stato,regione,provincia,comune,via,civico,lat,lng,photo_url,like_count,created_at,updated_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to)
      );
      if (error) throw error;

      const rows = reports || [];
      const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
      let profilesById = {};

      if (userIds.length) {
        const { data: profiles, error: profileError } = await withRetry(() =>
          supabase
            .from("profiles")
            .select("id,username,full_name,avatar_url,regione,provincia,comune,bio")
            .in("id", userIds)
        );
        if (!profileError) {
          profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));
        }
      }

      return {
        reports: rows.map(r => ({ ...r, profiles: profilesById[r.user_id] || null })),
        total: count || 0
      };
    },

    async fetchLikes(userId) {
      const { data, error } = await withRetry(() =>
        supabase.from("interazioni").select("segnalazione_id").eq("utente_id", userId)
      );
      if (error) return new Set();
      return new Set((data || []).map(row => row.segnalazione_id));
    },

    // Tutte le segnalazioni dell'utente (non paginate): serve per statistiche
    // di profilo corrette, indipendenti dalla pagina/filtri della dashboard.
    async fetchUserReports(userId) {
      const { data, error } = await withRetry(() =>
        supabase
          .from("segnalazioni")
          .select("id,user_id,titolo,tipo,descrizione,stato,priorita,comune,provincia,via,civico,photo_url,like_count,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },

    async fetchProfile(userId, user = state.user) {
      const existing = await this._loadProfile(userId);
      if (existing) return existing;
      if (user?.id === userId) return this._ensureProfile(user);
      return null;
    },

    async saveProfile(userId, payload) {
      if (payload.avatarFile instanceof File && payload.avatarFile.size > 0) {
        await ensureFreshAuthSession({ session: state.session, refreshWindowMs: 120000 });
        payload.avatar_url = await this.uploadPhoto(payload.avatarFile, "avatars");
      }
      try {
        const directSaved = await restUpsertProfile(userId, payload);
        if (directSaved) return directSaved;
      } catch (directError) {
        console.warn("Salvataggio profilo via REST diretto non riuscito, provo client Supabase.", directError);
      }
      await ensureFreshAuthSession({ session: state.session, refreshWindowMs: 120000 });
      // UPSERT (non update): il backend legge il profilo per chiave diretta,
      // strong-consistent. Evita il bug per cui un profilo appena creato (login
      // social) non viene trovato dalla list eventually-consistent e l'update
      // fallisce silenziosamente.
      // Timeout: il salvataggio non deve mai restare appeso (su WebView nativa
      // una scrittura può non tornare); meglio un errore "riprova" che un blocco.
      const { data, error } = await withTimeout(
        withRetry(() =>
          supabase
            .from("profiles")
            .upsert({
              id: userId,
              full_name: payload.full_name,
              username: payload.username,
              bio: payload.bio,
              regione: payload.regione,
              provincia: payload.provincia,
              comune: payload.comune,
              avatar_url: payload.avatar_url,
              updated_at: new Date().toISOString()
            }, { onConflict: "id" })
            .select("*")
            .single(),
        2),
        15000,
        "salvataggio profilo"
      );
      if (error) throw error;
      const saved = Array.isArray(data) ? data[0] : data;
      return saved || this._loadProfile(userId);
    },

    async createReport(payload) {
      if (payload.photoFile instanceof File && payload.photoFile.size > 0) {
        payload.photo_url = await this.uploadPhoto(payload.photoFile, "report-photos");
      }
      const insertable = { ...payload };
      delete insertable.photoFile; // il File non va serializzato nel JSON
      // Inserimento via REST diretto con il JWT già disponibile (in memoria/
      // localStorage): evita ensureFreshAuthSession e supabase.from().insert(),
      // che passano dal lock auth di supabase-js e potevano restare appesi
      // ("errore timeout" alla pubblicazione). Stesso approccio del profilo.
      return restInsertReport(insertable);
    },

    async deleteReport(id) {
      const { error } = await supabase.from("segnalazioni").delete().eq("id", id);
      if (error) throw error;
    },

    async toggleLike(userId, reportId, alreadyLiked) {
      if (alreadyLiked) {
        const { error } = await supabase
          .from("interazioni")
          .delete()
          .eq("utente_id", userId)
          .eq("segnalazione_id", reportId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("interazioni")
          .insert({ utente_id: userId, segnalazione_id: reportId });
        if (error) throw error;
      }
    },

    async updateReportAdmin(id, patch) {
      const { error } = await supabase
        .from("segnalazioni")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    async uploadPhoto(file, bucket) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) throw new Error("Formato immagine non supportato.");
      if (file.size > MAX_IMAGE_SIZE_BYTES) throw new Error("Immagine troppo grande. Limite: 5 MB.");
      // Upload via REST diretto con JWT: niente supabase.storage (lock auth) né
      // ensureFreshAuthSession, che potevano bloccarsi.
      try {
        return await restUploadPhoto(file, bucket);
      } catch (directError) {
        console.warn("Upload foto via REST diretto non riuscito, provo client Supabase.", directError);
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await withTimeout(
        withRetry(() => supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false }), 2),
        20000,
        "caricamento foto"
      );
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    },

    onAuthChange(callback) {
      supabase.auth.onAuthStateChange(callback);
    },

    // ── Metodi interni ──────────────────────────────────────────────────────

    async _loadProfile(userId) {
      try {
        return await restLoadProfile(userId);
      } catch (directError) {
        console.warn("Lettura profilo via REST diretto non riuscita, provo client Supabase.", directError);
      }
      const { data, error } = await withRetry(() =>
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      );
      if (error) throw error;
      return data;
    },

    async _ensureProfile(user, extra = {}) {
      await ensureFreshAuthSession({ session: state.session, refreshWindowMs: 120000 }).catch(() => undefined);
      // Se il profilo esiste già, anche incompleto, NON lo sovrascriviamo con
      // metadata del login che possono essere parziali a cold-start. I campi
      // mancanti vanno completati dalla UI dedicata, non ricreati con fallback.
      const existing = await this._loadProfile(user.id).catch(() => null);
      if (existing) return existing;

      const metadata = user.user_metadata || {};
      const emailName = String(user.email || "utente").split("@")[0];
      const fallbackUsername = cleanUsername(extra.username || metadata.username || emailName || `utente-${String(user.id).slice(0, 6)}`);

      const payload = {
        id: user.id,
        username: fallbackUsername,
        full_name: clean(extra.full_name || metadata.full_name || fallbackUsername),
        regione: clean(extra.regione || metadata.regione || ""),
        provincia: clean(extra.provincia || metadata.provincia || ""),
        comune: clean(extra.comune || metadata.comune || ""),
        bio: clean(extra.bio || metadata.bio || ""),
        avatar_url: clean(extra.avatar_url || metadata.avatar_url || "")
      };

      const { data, error } = await withRetry(() => supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: false })
        .select("*")
        .single(), 2);

      if (error && String(error.message || "").toLowerCase().includes("duplicate")) {
        const altPayload = { ...payload, username: `${fallbackUsername}-${String(user.id).slice(0, 6)}` };
        const { data: altData, error: altError } = await withRetry(() => supabase
          .from("profiles")
          .upsert(altPayload, { onConflict: "id", ignoreDuplicates: false })
          .select("*")
          .single(), 2);
        if (altError) throw altError;
        return altData || this._loadProfile(user.id);
      } else if (error) {
        throw error;
      }

      return data || this._loadProfile(user.id);
    }
  };
}

// ─── Debug helpers ────────────────────────────────────────────────────────────

function installDebugHelpers() {
  window.CV_DEBUG = {
    dump() {
      const safeKey = SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 18)}…${SUPABASE_ANON_KEY.slice(-6)}` : "vuota";
      return {
        demoMode: DEMO_MODE,
        supabaseUrl: SUPABASE_URL,
        publishableKey: safeKey,
        route: state?.route,
        hasUser: Boolean(state?.user),
        hasSessionToken: Boolean(state?.session?.access_token),
        userEmail: state?.user?.email || null,
        hasProfile: Boolean(state?.profile),
        profileId: state?.profile?.id || null,
        profileStatus: state?.profileStatus || null,
        profileLoadElapsedMs: state?.profileLoadStartedAt ? Date.now() - state.profileLoadStartedAt : 0,
        profileLoadAttempts: state?.profileLoadAttempts || 0,
        profileError: state?.profileError?.message || null,
        reportsLoaded: state?.reports?.length || 0,
        currentPage: state?.page || 0,
        totalReports: state?.totalReports || 0,
        origin: window.location.origin,
        isNativeApp: IS_NATIVE_APP
      };
    },
    async testRest() {
      if (DEMO_MODE || !supabase) return { ok: false, error: "Backend non configurato o demo mode attiva" };
      const result = await supabase
        .from("segnalazioni")
        .select("id,titolo,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      console.log("CV_DEBUG.testRest()", result);
      return result;
    },
    async testAuth() {
      if (DEMO_MODE || !supabase) return { ok: false, error: "Backend non configurato o demo mode attiva" };
      const result = await supabase.auth.getSession();
      console.log("CV_DEBUG.testAuth()", result);
      return result;
    }
  };
}

// ─── Stato globale ────────────────────────────────────────────────────────────

const state = {
  route: "landing",
  authMode: "login",
  session: null,
  user: null,
  profile: null,
  profileStatus: PROFILE_STATUS.IDLE,
  profileError: null,
  profileLoadStartedAt: 0,
  profileLoadAttempts: 0,
  reports: [],
  totalReports: 0,
  page: 0,
  likes: new Set(),
  pendingReports: [],   // segnalazioni appena create, in attesa che il server le elenchi
  myStats: null,        // statistiche reali dell'utente (tutte le sue segnalazioni)
  blocked: new Set(),   // id degli utenti bloccati (per nascondere i loro contenuti)
  reportsLoaded: false, // true dopo il primo caricamento del feed (per gli skeleton)
  filters: {
    q: "",            // usato solo dalla ricerca globale (header desktop)
    regione: "",
    provincia: "",
    comune: "",
    tipo: ""
  },
  filtersInitialized: false,  // i filtri territoriali partono dal profilo, una volta sola
  locationData: buildLocationData(readLocal("cv_italy_locations_raw", null) || FALLBACK_LOCATIONS),
  locationDataSource: readLocal("cv_italy_locations_raw", null) ? "cache" : "fallback",
  map: null,
  mapMobile: null,
  mapNew: null,
  mapNewMarker: null,
  markers: [],
  markersMobile: [],
  uploading: false
};

let profileLoadingDeadlineTimer = null;

function clearProfileLoadingDeadline() {
  if (profileLoadingDeadlineTimer) clearTimeout(profileLoadingDeadlineTimer);
  profileLoadingDeadlineTimer = null;
}

function scheduleProfileLoadingDeadline() {
  clearProfileLoadingDeadline();
  if (!state.user || state.profile) return;
  const remaining = Math.max(0, PROFILE_LOADING_GRACE_MS - profileLoadingElapsedMs());
  profileLoadingDeadlineTimer = setTimeout(() => {
    if (state.user && !state.profile && state.profileStatus === PROFILE_STATUS.LOADING && hasProfileLoadingExpired()) {
      setProfileError(new Error("Timeout caricamento profilo."));
      render();
    }
  }, remaining + 120);
}

function isPrivateProfileRoute(route = state.route) {
  return PRIVATE_PROFILE_ROUTES.has(route);
}

function isProfileUnknown() {
  return Boolean(state.user && !state.profile && state.profileStatus !== PROFILE_STATUS.MISSING);
}

function profileLoadingElapsedMs() {
  return state.profileLoadStartedAt ? Date.now() - state.profileLoadStartedAt : 0;
}

function hasProfileLoadingExpired() {
  return Boolean(state.user && !state.profile && profileLoadingElapsedMs() >= PROFILE_LOADING_GRACE_MS);
}

function setProfileLoading(error = null) {
  if (!state.user) {
    state.profileStatus = PROFILE_STATUS.IDLE;
    state.profileError = null;
    state.profileLoadStartedAt = 0;
    state.profileLoadAttempts = 0;
    return;
  }
  if (!state.profile) state.profileStatus = PROFILE_STATUS.LOADING;
  if (!state.profileLoadStartedAt) state.profileLoadStartedAt = Date.now();
  state.profileError = error;
  scheduleProfileLoadingDeadline();
}

// ── Cache locale del profilo (per-utente) ─────────────────────────────────
// Persistiamo l'ultimo profilo reale di ogni utente in localStorage. A freddo
// (app nativa riaperta, rete WebView non ancora pronta) lo mostriamo SUBITO
// senza dipendere dalla fetch, poi aggiorniamo in background alla prima lettura
// riuscita. Cosi' l'utente, dopo aver configurato il profilo UNA volta, non
// rivede mai "Profilo non ancora disponibile" ne' deve reinserire i dati.
const PROFILE_CACHE_PREFIX = "cv_profile:";

function writeCachedProfile(profile) {
  if (!profile?.id) return;
  try { writeLocal(PROFILE_CACHE_PREFIX + profile.id, profile); } catch {}
}

function readCachedProfile(userId) {
  if (!userId) return null;
  const cached = readLocal(PROFILE_CACHE_PREFIX + userId, null);
  return cached && cached.id === userId ? cached : null;
}

function clearCachedProfile(userId) {
  if (!userId) return;
  try { localStorage.removeItem(PROFILE_CACHE_PREFIX + userId); } catch {}
}

function setProfileResolved(profile) {
  clearProfileLoadingDeadline();
  state.profile = profile || null;
  if (profile) writeCachedProfile(profile); // persiste per i cold-start successivi
  state.profileStatus = profile
    ? PROFILE_STATUS.READY
    : (state.user ? PROFILE_STATUS.MISSING : PROFILE_STATUS.IDLE);
  state.profileError = null;
  state.profileLoadStartedAt = 0;
  state.profileLoadAttempts = 0;
}

function setProfileError(error) {
  clearProfileLoadingDeadline();
  state.profileError = error || null;
  if (!state.profile) state.profileStatus = PROFILE_STATUS.ERROR;
}

function markProfileMissing() {
  clearProfileLoadingDeadline();
  state.profile = null;
  state.profileStatus = PROFILE_STATUS.MISSING;
  state.profileError = null;
  state.profileLoadStartedAt = 0;
  state.profileLoadAttempts = 0;
}

function profileDraftFromUser(user = state.user) {
  const metadata = user?.user_metadata || {};
  const emailName = String(user?.email || "").split("@")[0];
  const idSuffix = String(user?.id || crypto.randomUUID()).slice(0, 6);
  const username = cleanUsername(metadata.username || emailName || `utente-${idSuffix}`);
  return {
    id: user?.id || "",
    username,
    full_name: clean(metadata.full_name || metadata.name || username),
    regione: clean(metadata.regione || ""),
    provincia: clean(metadata.provincia || ""),
    comune: clean(metadata.comune || ""),
    bio: clean(metadata.bio || ""),
    avatar_url: clean(metadata.avatar_url || metadata.picture || "")
  };
}

function goToProfileCompletionFallback() {
  markProfileMissing();
  state.route = "complete-profile";
  if (window.location.hash !== "#/complete-profile") history.replaceState(null, "", "#/complete-profile");
  render();
}

async function readCurrentUserProfile(user, { timeoutMs = PROFILE_ATTEMPT_TIMEOUT_MS } = {}) {
  if (!user?.id) return { profile: null, checked: false, error: new Error("Utente non disponibile") };
  const loader = typeof backend._loadProfile === "function"
    ? () => backend._loadProfile(user.id)
    : () => backend.fetchProfile(user.id, user);
  try {
    const profile = await withTimeout(loader(), timeoutMs, "profilo");
    return { profile: profile || null, checked: true, error: null };
  } catch (error) {
    // Rete/token non pronti (tipico cold-start nativo): se abbiamo l'ultimo
    // profilo salvato localmente lo usiamo, cosi' l'utente vede subito i suoi
    // dati invece di "Profilo non ancora disponibile". Il refresh avverra' alla
    // prima lettura riuscita (che aggiornera' di nuovo la cache).
    const cached = readCachedProfile(user.id);
    if (cached) return { profile: cached, checked: true, error: null, fromCache: true };
    return { profile: null, checked: false, error };
  }
}

function hasRealAuthSession() {
  if (DEMO_MODE) return Boolean(state.user?.id);
  const stored = readStoredSupabaseSession();
  if (!state.session && stored?.user?.id === state.user?.id) syncSessionState(stored);
  return Boolean(state.user?.id && (state.session?.access_token || stored?.access_token));
}

function clearAuthLocalHints() {
  try {
    const inOAuthCallback = isOAuthCallbackHash(window.location.hash) || window.location.search.includes("code=");
    if (!inOAuthCallback) localStorage.removeItem("cv_oauth_return_route");
    localStorage.removeItem("cv_demo_user");
  } catch {
    // storage non disponibile: stato in memoria già ripulito
  }
}

function clearAuthState() {
  clearProfileLoadingDeadline();
  state.session = null;
  state.user = null;
  state.profile = null;
  state.profileStatus = PROFILE_STATUS.IDLE;
  state.profileError = null;
  state.profileLoadStartedAt = 0;
  state.profileLoadAttempts = 0;
  state.likes = new Set();
  state.reports = [];
  state.totalReports = 0;
  state.page = 0;
  state.pendingReports = [];
  state.myStats = null;
  state.blocked = new Set();
  state.reportsLoaded = false;
  state.filtersInitialized = false;
  state.filters.regione = "";
  state.filters.provincia = "";
  state.filters.comune = "";
  state.filters.tipo = "";
  state.filters.q = "";
}

installDebugHelpers();
init();

// ─── Init & routing ───────────────────────────────────────────────────────────

// Safety net: limita un'attesa async a `ms` millisecondi. Se scade, rifiuta —
// così nessuna singola chiamata di rete può bloccare il boot all'infinito.
function withTimeout(promise, ms, label = "operazione") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout ${label} (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function assertSupabaseAuthReachable() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("Connessione internet assente. Attiva Wi-Fi o dati mobili e riprova.");
  }
  if (typeof fetch !== "function") return;
  const authHealthUrl = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/health`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const request = fetch(authHealthUrl, {
    method: "GET",
    cache: "no-store",
    headers: { apikey: SUPABASE_ANON_KEY },
    signal: controller?.signal
  });
  try {
    const response = await withTimeout(request, AUTH_CONNECTIVITY_TIMEOUT_MS, "verifica connessione Supabase")
      .catch((error) => {
        try { controller?.abort?.(); } catch (_) {}
        throw error;
      });
    if (!response.ok) {
      throw new Error(`Supabase Auth non raggiungibile (${response.status}).`);
    }
  } catch (error) {
    console.warn("Supabase auth connectivity check failed", error);
    throw new Error("Connessione internet assente o Supabase non raggiungibile. Controlla Wi-Fi/dati e riprova.");
  }
}

function isAuthTokenError(error) {
  const status = Number(error?.status || error?.code || 0);
  const message = String(error?.message || error?.error_description || error || "").toLowerCase();
  if (status === 401 && (message.includes("jwt") || message.includes("token") || message.includes("expired") || message.includes("invalid"))) return true;
  return message.includes("jwt expired")
    || message.includes("invalid jwt")
    || message.includes("refresh token")
    || message.includes("access token");
}

function syncSessionState(session) {
  if (!session) return null;
  state.session = session;
  if (session.user) state.user = session.user;
  return session;
}

function supabaseProjectRef() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function supabaseAuthStorageKey() {
  const ref = supabaseProjectRef();
  return ref ? `sb-${ref}-auth-token` : "";
}

function readStoredSupabaseSession() {
  const key = supabaseAuthStorageKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession || parsed?.session || parsed;
    return session?.access_token && session?.user ? session : null;
  } catch {
    return null;
  }
}

function clearStoredSupabaseSession() {
  const ref = supabaseProjectRef();
  if (!ref) return;
  try {
    Object.keys(localStorage)
      .filter(key => key === `sb-${ref}-auth-token` || key.startsWith(`sb-${ref}-auth-token`))
      .forEach(key => localStorage.removeItem(key));
  } catch {
    // logout/delete devono comunque proseguire anche se lo storage non risponde
  }
}

function shouldRefreshSession(session, refreshWindowMs = 90000) {
  const expiresAt = Number(session?.expires_at || 0) * 1000;
  if (!expiresAt) return false;
  return expiresAt - Date.now() <= refreshWindowMs;
}

async function ensureFreshAuthSession({ force = false, session = null, refreshWindowMs = 90000 } = {}) {
  if (!supabase?.auth) return null;

  let current = session || state.session || readStoredSupabaseSession();
  if (!current) {
    const { data, error } = await withTimeout(supabase.auth.getSession(), 8000, "lettura sessione");
    if (error) throw error;
    current = data?.session || null;
  }
  if (!current) return null;

  if (!force && !shouldRefreshSession(current, refreshWindowMs)) {
    return syncSessionState(current);
  }

  const { data, error } = await withTimeout(supabase.auth.refreshSession(current), 12000, "rinnovo sessione");
  if (error) throw error;
  return syncSessionState(data?.session || current);
}

async function init() {
  installGlobalToastStack();
  bindHashRouter();
  installNativeOAuthLifecycleHandlers();

  loadItalyLocations().then((loaded) => {
    if (!loaded) return;
    if (state.route === "auth" && state.authMode === "register") return renderAuthPage("register");
    if (["new", "profile", "profile/edit"].includes(state.route)) render();
  }).catch(error => console.warn("Anagrafica territoriale non aggiornata", error));

  backend.onAuthChange(async (_event, session) => {
    try {
      const nextUser = session?.user || null;
      if (!nextUser) {
        clearAuthLocalHints();
        clearAuthState();
        await refreshData();
        render();
        return;
      }

      state.session = session;
      state.user = nextUser;
      // Timeout anche qui: se il fetch del profilo si blocca, non deve impedire
      // il render del resto dell'app.
      // Profilo già caricato per lo STESSO utente: lo conserviamo come fallback
      // temporaneo durante TOKEN_REFRESHED. Se cambia utente, invece, lo azzeriamo
      // e blocchiamo le schermate private finché arriva il profilo reale.
      // Seed immediato: profilo già in memoria per lo stesso utente, oppure
      // l'ultimo profilo salvato in cache locale. Cosi' a freddo mostriamo SUBITO
      // i dati reali (niente "Profilo non ancora disponibile"); la lettura di
      // rete qui sotto poi conferma/aggiorna.
      const sameUserProfile = state.profile && state.profile.id === nextUser.id ? state.profile : null;
      const seedProfile = sameUserProfile || readCachedProfile(nextUser.id);
      if (seedProfile) {
        setProfileResolved(seedProfile);
      } else {
        state.profile = null;
        setProfileLoading();
      }

      // Lettura veloce e pura del profilo reale. Se non arriva, la UI passa a
      // recupero/ritenta; non resta bloccata e non crea profili generici.
      const profileResult = await readCurrentUserProfile(nextUser);
      if (profileResult.checked) {
        if (profileResult.profile) setProfileResolved(profileResult.profile);
        else markProfileMissing();
      } else if (seedProfile) {
        setProfileResolved(seedProfile);
      } else {
        setProfileError(profileResult.error);
      }
      await refreshData();
      render();
      // Profilo non caricato ma sessione presente (cold-start nativo): ritenta.
      if (state.user && !state.profile && state.profileStatus !== PROFILE_STATUS.MISSING) ensureProfileLoaded();
    } catch (error) {
      console.error("Aggiornamento stato sessione non riuscito", error);
      render();
    }
  });

  // Avvio resiliente: il primo render NON deve mai dipendere dal completamento
  // di una chiamata di rete. Se il ripristino sessione o il caricamento dati è
  // lento o bloccato, entro un timeout di sicurezza mostriamo comunque l'app
  // (scheletri) e ridisegniamo appena i dati arrivano. Evita lo splash infinito
  // (anche per il reviewer su rete lenta/instabile).
  const boot = bootstrapAndLoad();
  try {
    await withTimeout(boot, 9000, "avvio");
  } catch (error) {
    console.warn("Avvio oltre il timeout o con errore: mostro comunque l'app.", error);
    boot.then(render).catch(() => {});
  }
  recoverNativeOAuthSession("init").catch(error => console.warn("Recupero OAuth nativo post-boot non riuscito", error));
  render();
}

async function bootstrapAndLoad() {
  await bootstrapAuth();

  // App nativa (o web): se l'utente è già loggato e la route iniziale è
  // landing/auth, lo mandiamo direttamente in dashboard. Senza questo, l'app
  // mostrerebbe sempre la landing al primo avvio anche con sessione attiva.
  if (state.user && ["landing", "auth", ""].includes(state.route)) {
    state.route = "dashboard";
    if (window.location.hash !== "#/dashboard") {
      // sostituisce l'hash senza riscatenare l'handler (lo riassegnamo sopra)
      history.replaceState(null, "", "#/dashboard");
    }
  }

  await refreshData();

  // Cold-start: se la sessione c'è ma il profilo non si è caricato (prima fetch
  // fallita per 401 con token in rinnovo o rete WebView non ancora pronta),
  // ritenta in background — altrimenti l'app resterebbe con "Utente CivicVois".
  if (state.user && !state.profile && state.profileStatus !== PROFILE_STATUS.MISSING) ensureProfileLoaded();
}

// Ricarica il profilo con backoff finché la sessione resta valida. Finché il
// profilo è sconosciuto non renderizziamo schermate account con fallback: o
// arriva il profilo reale, o viene creato/completato per lo user.id reale.
let profileRetryRunning = false;
async function ensureProfileLoaded() {
  if (profileRetryRunning) return;
  if (!state.user) return;
  if (state.profileStatus === PROFILE_STATUS.MISSING) return;
  if (state.profile) {
    setProfileResolved(state.profile);
    return;
  }

  const userId = state.user.id;
  setProfileLoading();
  profileRetryRunning = true;
  let lastError = null;
  let lastReadWasMissing = false;
  try {
    const delays = [0, 600, 1600];
    for (const d of delays) {
      if (!state.user || state.user.id !== userId || state.profile) break;
      if (d) await wait(d);
      if (!state.user || state.user.id !== userId || state.profile) break;
      try {
        state.profileLoadAttempts += 1;
        await ensureFreshAuthSession({ refreshWindowMs: 120000 }).catch(() => undefined);
        const result = await readCurrentUserProfile(state.user);
        if (!result.checked) throw result.error || new Error("Profilo non recuperato.");
        lastError = null;
        if (result.profile) {
          setProfileResolved(result.profile);
          if (state.route === "complete-profile" && !isProfileIncomplete(result.profile)) {
            state.route = "dashboard";
            if (window.location.hash !== "#/dashboard") history.replaceState(null, "", "#/dashboard");
          }
          render();
          return;
        }
        lastReadWasMissing = true;
      } catch (error) {
        lastError = error;
        lastReadWasMissing = false;
        // riprova al giro successivo
      }
    }

    if (!state.user || state.user.id !== userId || state.profile) return;

    if (!lastError && lastReadWasMissing && typeof backend._ensureProfile === "function") {
      try {
        const created = await withTimeout(backend._ensureProfile(state.user), 10000, "creazione profilo");
        setProfileResolved(created);
        if (created && state.route === "complete-profile" && !isProfileIncomplete(created)) {
          state.route = "dashboard";
          if (window.location.hash !== "#/dashboard") history.replaceState(null, "", "#/dashboard");
        }
        render();
        return;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      setProfileError(lastError);
      render();
      return;
    }

    markProfileMissing();
    if (isPrivateProfileRoute(state.route) && state.route !== "complete-profile") {
      state.route = "complete-profile";
      if (window.location.hash !== "#/complete-profile") history.replaceState(null, "", "#/complete-profile");
    }
    render();
  } finally {
    profileRetryRunning = false;
  }
}

function bindHashRouter() {
  window.addEventListener("hashchange", async () => {
    const previousRoute = state.route;
    const next = readRouteFromHash();
    state.route = normalizeRoute(next);
    state.page = 0;
    render();            // render immediato: mostra subito lo scheletro/contenuto noto
    resetPageScroll(previousRoute, state.route);
    await refreshData();
    render();            // render con i dati aggiornati
    resetPageScroll(previousRoute, state.route);
  });
  state.route = normalizeRoute(readRouteFromHash());
}

function readRouteFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "";
  if (isOAuthCallbackHash(raw)) return "auth";
  return raw || "landing";
}

function isOAuthCallbackHash(value) {
  const hash = String(value || "");
  return hash.includes("access_token=")
    || hash.includes("refresh_token=")
    || hash.includes("provider_token=")
    || hash.includes("error_description=")
    || hash.includes("type=recovery");
}

function setRoute(route) {
  const nextHash = `#/${route}`;
  if (window.location.hash === nextHash) {
    resetPageScroll(state.route, normalizeRoute(route), { force: true });
    return;
  }
  window.location.hash = nextHash;
}

function resetPageScroll(previousRoute, nextRoute, options = {}) {
  if (!options.force && previousRoute === nextRoute) return;

  requestAnimationFrame(() => {
    const targets = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...document.querySelectorAll(".app-body, .main, .page")
    ].filter(Boolean);

    targets.forEach(target => {
      target.scrollTop = 0;
      target.scrollLeft = 0;
    });

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

function normalizeRoute(route) {
  // Dettaglio segnalazione: route pubblica e condivisibile (#/report/<id>)
  if (route.startsWith("report/")) {
    state.reportId = route.slice("report/".length);
    return "report";
  }
  if (["new", "profile", "profile/edit", "admin", "settings", "complete-profile"].includes(route) && !state.user) return "auth";
  if (route === "settings") return "profile/edit";
  // Guard: con profilo incompleto, ogni pagina privata diventa "complete-profile".
  // Richiediamo state.profile TRUTHY: un profilo non ancora caricato/null (fetch
  // fallito o in corso) non è "incompleto", è "sconosciuto" → non dirottare.
  if (state.user && state.profile && isProfileIncomplete(state.profile) && route !== "complete-profile") {
    return "complete-profile";
  }
  // Profilo già completo: non lasciare l'utente bloccato sulla pagina di completamento
  if (route === "complete-profile" && state.user && state.profile && !isProfileIncomplete(state.profile)) return "dashboard";
  if (route === "admin" && state.user && !state.profile) return "admin";
  if (route === "admin" && state.profile?.role !== "admin") return "dashboard";
  return route || "landing";
}

async function bootstrapAuth() {
  let session = null;
  try {
    // Timeout: se getSession/profilo non risponde (rete lenta o bloccata), non
    // restiamo appesi — l'onAuthChange (INITIAL_SESSION) aggiornerà comunque lo
    // stato appena disponibile.
    session = await withTimeout(backend.restoreSession(), 7000, "ripristino sessione");
  } catch (error) {
    console.warn("Ripristino sessione non riuscito (timeout o errore).", error);
    return;
  }
  if (!session) return;
  state.user = session.user;
  state.session = session.session || null;
  if (session.profile) {
    setProfileResolved(session.profile);
  } else if (session.checked) {
    markProfileMissing();
  } else if (session.error) {
    setProfileError(session.error);
  } else {
    state.profile = null;
    setProfileLoading();
  }
}

async function refreshData() {
  if (!state.user && state.route === "auth") {
    state.reports = [];
    state.likes = new Set();
    return;
  }
  const jobs = [loadReports(), loadLikes()];
  if (state.user) jobs.push(loadBlocks());
  // Statistiche profilo: caricate solo quando servono (pagina Profilo)
  if (state.user && state.route === "profile") jobs.push(loadMyStats());
  await Promise.all(jobs);
}

async function loadBlocks() {
  if (!state.user || typeof backend.fetchBlocks !== "function") { state.blocked = new Set(); return; }
  try { state.blocked = await backend.fetchBlocks(); }
  catch { state.blocked = new Set(); }
}

async function loadMyStats() {
  if (!state.user || typeof backend.fetchUserReports !== "function") { state.myStats = null; return; }
  try {
    const reports = await backend.fetchUserReports(state.user.id);
    const likesReceived = reports.reduce((acc, r) => acc + Number(r.like_count || 0), 0);
    const resolved = reports.filter(r => r.stato === "risolta").length;
    state.myStats = { reports, total: reports.length, likesReceived, resolved };
  } catch (error) {
    console.warn("Statistiche profilo non caricate", error);
    state.myStats = null;
  }
}

// ── Cache locale del feed segnalazioni ────────────────────────────────────
// Come per il profilo: a freddo (app nativa riaperta) la prima lettura del feed
// può fallire (rete WebView non ancora pronta), lasciando la lista vuota.
// Teniamo in cache l'ultima pagina 0 per mostrarla SUBITO e ritentiamo finché
// arriva quella fresca, così le segnalazioni non spariscono al riavvio.
const REPORTS_CACHE_KEY = "cv_reports_feed_v1";

function writeCachedReports(reports, total) {
  try { writeLocal(REPORTS_CACHE_KEY, { reports: (reports || []).slice(0, 60), total: total || 0 }); } catch {}
}

function readCachedReports() {
  const cached = readLocal(REPORTS_CACHE_KEY, null);
  return cached && Array.isArray(cached.reports) ? cached : null;
}

let reportsRetryRunning = false;
function scheduleReportsRetry() {
  if (reportsRetryRunning) return;
  reportsRetryRunning = true;
  (async () => {
    const delays = [800, 1800, 3500, 6000];
    for (const d of delays) {
      if (state.reportsLoaded) break;
      await wait(d);
      if (state.reportsLoaded) break;
      if (!state.user && state.route === "auth") break;
      try {
        const { reports, total } = await backend.fetchReports({ page: 0 });
        state.reports = reports;
        state.totalReports = total;
        state.reportsLoaded = true;
        writeCachedReports(reports, total);
        render();
        break;
      } catch (_) { /* riprova al giro successivo */ }
    }
    reportsRetryRunning = false;
  })();
}

async function loadReports() {
  // Seed istantaneo dalla cache al primo caricamento (cold-start): il feed non
  // resta vuoto mentre arriva la risposta fresca dal server.
  if (!state.reportsLoaded && state.page === 0 && !state.reports.length) {
    const cached = readCachedReports();
    if (cached && cached.reports.length) {
      state.reports = cached.reports;
      state.totalReports = cached.total;
    }
  }
  try {
    const { reports, total } = await backend.fetchReports({ page: state.page });
    state.reports = reports;
    state.totalReports = total;
    state.reportsLoaded = true;
    if (state.page === 0) writeCachedReports(reports, total);

    // Merge segnalazioni appena create: finché il server (lista eventually
    // consistent) non le restituisce, le teniamo visibili in cima. Appena
    // compaiono nella risposta del server, le rimuoviamo dai "pending".
    if (state.pendingReports.length) {
      const serverIds = new Set(reports.map(r => r.id));
      state.pendingReports = state.pendingReports.filter(p => !serverIds.has(p.id));
      if (state.pendingReports.length && state.page === 0) {
        state.reports = [...state.pendingReports, ...state.reports];
      }
    }
  } catch (error) {
    console.error("Errore lettura segnalazioni", error);
    // Cold-start: NON azzeriamo il feed. Se è vuoto proviamo la cache e
    // ritentiamo in background. Niente toast d'allarme al primo tentativo a
    // freddo: lo mostriamo solo se avevamo già caricato prima (vera rete persa).
    if (!state.reports.length) {
      const cached = readCachedReports();
      if (cached && cached.reports.length) {
        state.reports = cached.reports;
        state.totalReports = cached.total;
      }
    }
    if (!state.reportsLoaded) {
      scheduleReportsRetry();
    } else if (state.route !== "auth") {
      toast(niceBackendError(error, "Non riesco a leggere le segnalazioni."), "error");
    }
  }
}

async function loadLikes() {
  if (!state.user) {
    state.likes = new Set();
    return;
  }
  try {
    state.likes = await backend.fetchLikes(state.user.id);
  } catch {
    state.likes = new Set();
  }
}

// ─── Render principale ────────────────────────────────────────────────────────

function render() {
  // Resetta le istanze mappa ad ogni render (il DOM viene ricostruito)
  state.map = null;
  state.mapMobile = null;
  state.mapNew = null;
  state.mapNewMarker = null;
  state.markers = [];
  state.markersMobile = [];
  if (!state.user && ["auth", "complete-profile"].includes(state.route)) {
    return state.route === "auth" ? renderPageRoute("auth") : renderPageRoute("landing");
  }
  if (!state.user && ["new", "profile", "profile/edit", "admin"].includes(state.route)) return renderPageRoute("auth");

  if (state.user && isProfileUnknown() && isPrivateProfileRoute(state.route)) {
    if (state.profileStatus === PROFILE_STATUS.LOADING && hasProfileLoadingExpired()) {
      setProfileError(new Error("Timeout caricamento profilo."));
    }
    if (state.profileStatus !== PROFILE_STATUS.ERROR) ensureProfileLoaded();
    return renderProfileLoadingPage();
  }

  if (state.user && !state.profile && state.profileStatus === PROFILE_STATUS.MISSING && state.route !== "complete-profile" && state.route !== "report") {
    state.route = "complete-profile";
    if (window.location.hash !== "#/complete-profile") history.replaceState(null, "", "#/complete-profile");
  }

  if (state.user && state.profile && state.route === "complete-profile" && !isProfileIncomplete(state.profile)) {
    state.route = "dashboard";
    if (window.location.hash !== "#/dashboard") history.replaceState(null, "", "#/dashboard");
  }

  // ── GUARD CENTRALE: profilo incompleto ──────────────────────────────────
  // Se l'utente è loggato ma mancano i dati minimi (es. comune dopo login
  // Google), qualunque pagina privata lo dirotta alla schermata di
  // completamento, finché non la compila. Niente home con profilo a metà.
  if (state.user && state.profile && isProfileIncomplete(state.profile) && state.route !== "complete-profile" && state.route !== "report") {
    state.route = "complete-profile";
    if (window.location.hash !== "#/complete-profile") history.replaceState(null, "", "#/complete-profile");
  }

  return renderPageRoute(state.route);
}

function renderProfileLoadingPage() {
  const isError = state.profileStatus === PROFILE_STATUS.ERROR || hasProfileLoadingExpired();
  const showRecovery = isError || state.profileLoadAttempts > 0;
  app.innerHTML = `
    <main class="auth-page complete-profile-page">
      <section class="auth-card">
        <div class="complete-profile-head">
          ${avatarHtml({ full_name: state.user?.email || "CV" }, "complete-profile-avatar")}
          <h1>${isError ? "Profilo non ancora disponibile" : "Caricamento profilo"}</h1>
          <p>${isError
            ? "La sessione è presente, ma il profilo reale non è stato recuperato in tempo. Puoi riprovare o completarlo ora."
            : "Sto recuperando la sessione e il profilo reale collegati al tuo account."}</p>
        </div>
        <div class="complete-profile-actions span-2">
          ${showRecovery ? `<button class="btn btn-primary profile-retry-btn" type="button">Riprova</button>` : ""}
          ${showRecovery ? `<button class="btn btn-ghost profile-complete-btn" type="button">Completa profilo</button>` : ""}
          ${showRecovery && hasRealAuthSession() ? `<button class="btn btn-danger delete-account-btn" type="button">Elimina account</button>` : ""}
          <button class="btn btn-ghost mobile-logout-btn" type="button">Esci</button>
        </div>
      </section>
    </main>
  `;
  bindProfileRecoveryActions();
}

function bindProfileRecoveryActions() {
  document.querySelector(".profile-retry-btn")?.addEventListener("click", () => {
    state.profile = null;
    state.profileLoadStartedAt = 0;
    state.profileLoadAttempts = 0;
    setProfileLoading();
    render();
    ensureProfileLoaded();
  });
  document.querySelector(".profile-complete-btn")?.addEventListener("click", goToProfileCompletionFallback);
  document.querySelector(".delete-account-btn")?.addEventListener("click", handleDeleteAccount);
  document.querySelector(".mobile-logout-btn")?.addEventListener("click", handleLogout);
}

function renderPageRoute(route) {
  const page = pageRoutes[route] || pageRoutes.landing;
  return page.render({
    state,
    setRoute,
    renderLanding,
    renderAuthPage,
    renderCompleteProfile,
    renderReportDetail,
    renderApp
  });
}

// ─── Landing ──────────────────────────────────────────────────────────────────

function renderLanding() {
  const stats = getStats();
  app.innerHTML = `
    <div class="page landing-page">
      <header class="site-header">
        <div class="header-inner">
          ${brandHtml()}
          <nav class="nav-desktop" aria-label="Navigazione principale">
            <a class="nav-link" href="#come-funziona">Come funziona</a>
            <a class="nav-link" href="#vantaggi">Vantaggi</a>
            <a class="nav-link" href="#/dashboard">Segnalazioni</a>
          </nav>
          <div class="header-actions">
            ${state.user ? `<button class="btn btn-ghost" data-route="dashboard">Dashboard</button>` : `<button class="btn btn-ghost" data-route="auth">Accedi</button>`}
            <button class="btn btn-primary" data-route="${state.user ? "new" : "auth"}">Segnala ora</button>
          </div>
        </div>
      </header>

      <main>
        <section class="hero">
          <div class="hero-copy">
            <h1>La tua città, <span>segnalata meglio.</span></h1>
            <p class="hero-lead">CivicVois trasforma buche, cartelli rotti, rifiuti e problemi urbani in segnalazioni ordinate, visibili e tracciabili. Un'interfaccia seria per cittadini, comuni e amministratori.</p>
            <div class="hero-actions">
              ${state.user
                ? `<button class="btn btn-primary" data-route="new">Crea una segnalazione</button>
                   <button class="btn btn-ghost" data-route="dashboard">Entra nella dashboard</button>`
                : `<button class="btn btn-primary" data-route="dashboard">Esplora le segnalazioni</button>
                   <button class="btn btn-ghost" id="hero-login">Accedi o registrati</button>`}
            </div>
            <div class="hero-stats hero-stats--square" aria-label="Statistiche CivicVois">
              <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">segnalazioni</div></div>
              <div class="stat-card"><div class="stat-value">${stats.open}</div><div class="stat-label">aperte</div></div>
              <div class="stat-card"><div class="stat-value">${stats.inProgress}</div><div class="stat-label">in carico</div></div>
              <div class="stat-card"><div class="stat-value">${stats.resolved}</div><div class="stat-label">risolte</div></div>
            </div>
          </div>
          <div class="phone-stage" aria-hidden="true">
            <div class="phone-glow"></div>
            <div class="phone-frame">
              <div class="phone-screen">
                <div class="phone-top">
                  <strong>CivicVois</strong>
                  <div class="phone-pill"></div>
                  <span>9:41</span>
                </div>
                <div class="mini-map">
                  <div class="map-lines"></div>
                  <span class="pin pin-one"></span>
                  <span class="pin pin-two"></span>
                  <span class="pin pin-three"></span>
                </div>
                <div class="phone-content">
                  ${state.reports.slice(0, 3).map(report => `
                    <div class="phone-card">
                      <div class="report-meta" style="margin-bottom: 10px;">
                        ${statusChip(report.stato)}
                        <span class="chip">${escapeHtml(report.comune || "Italia")}</span>
                      </div>
                      <h3>${escapeHtml(report.titolo || report.tipo)}</h3>
                      <p>${escapeHtml(report.descrizione || "Segnalazione civica ricevuta.")}</p>
                    </div>
                  `).join("")}
                </div>
                <div class="phone-nav"><span>Home</span><span>Nuova</span><span>Profilo</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="come-funziona" class="section">
          <h2 class="section-title">Non è solo un form. È un flusso.</h2>
          <p class="section-lead">La vecchia idea era: compilo una segnalazione e basta. La versione nuova ragiona come una vera app: crea, geolocalizza, filtra, monitora, assegna stato e rende tutto consultabile.</p>
          <div class="feature-grid">
            <article class="feature-card"><div class="feature-icon">📍</div><h3>Segnalazione precisa</h3><p>Categoria, descrizione, indirizzo, comune, priorità, foto e posizione sulla mappa.</p></article>
            <article class="feature-card"><div class="feature-icon">🗂️</div><h3>Feed ordinato</h3><p>Filtri per testo, comune, categoria e stato. Niente più pagine confuse o dati sparsi.</p></article>
            <article class="feature-card"><div class="feature-icon">✅</div><h3>Stato intervento</h3><p>Nuova, verificata, in carico, risolta o archiviata. La segnalazione diventa tracciabile.</p></article>
          </div>
        </section>
      </main>

      <footer class="landing-footer">
        <p class="landing-disclaimer">CivicVois è un servizio indipendente realizzato dai cittadini. <b>Non è un canale ufficiale</b> di alcun Comune o ente pubblico: le segnalazioni non vengono inoltrate automaticamente agli enti competenti.</p>
        <nav class="landing-legal">
          <a href="https://civicvois.it/legal/privacy.html" target="_blank" rel="noopener">Privacy</a>
          <a href="https://civicvois.it/legal/termini.html" target="_blank" rel="noopener">Termini</a>
          <a href="https://civicvois.it/legal/contenuti.html" target="_blank" rel="noopener">Contenuti</a>
          <a href="https://civicvois.it/legal/supporto.html" target="_blank" rel="noopener">Supporto</a>
        </nav>
        <p class="landing-copy">© ${new Date().getFullYear()} CivicVois</p>
      </footer>
    </div>
  `;
  bindRouteButtons();
  // CTA hero per utenti non loggati: Accedi (login) e Registrati (tab register)
  $("#hero-login")?.addEventListener("click", () => { state.authMode = "login"; setRoute("auth"); });
  $("#hero-register")?.addEventListener("click", () => { state.authMode = "register"; setRoute("auth"); });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function renderAuthPage(mode = state.authMode || "login") {
  state.authMode = mode;
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-copy">
        ${brandHtml()}
        <h1>Accedi alla piattaforma civica.</h1>
        <p>Gestisci segnalazioni, foto, like, profilo e stati in una versione collegata a Supabase. ${DEMO_MODE ? "Ora sei in modalità demo locale." : "Backend Supabase collegato."}</p>
      </section>
      <section class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab ${mode === "login" ? "is-active" : ""}" data-auth-tab="login">Accedi</button>
          <button class="auth-tab ${mode === "register" ? "is-active" : ""}" data-auth-tab="register">Registrati</button>
        </div>
        ${DEMO_MODE ? `<div class="notice"><strong>Modalità demo attiva</strong>Il sito funziona in locale. Online usa Supabase per dati, auth e storage.</div>` : ""}
        <div id="auth-form-wrap">${mode === "login" ? loginFormHtml() : registerFormHtml()}</div>
      </section>
    </main>
  `;

  $$("[data-auth-tab]").forEach(btn => {
    btn.addEventListener("click", () => renderAuthPage(btn.dataset.authTab));
  });

  const form = $("#auth-form");
  if (mode === "register") {
    bindLocationControls(form);
    bindAvatarUpload(form);
  }
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const action = form.dataset.action;
    await lockSubmit(form, async () => {
      if (action === "login") await handleLogin(new FormData(form));
      if (action === "register") await handleRegister(new FormData(form));
    });
  });
}

// ─── Completamento profilo (dopo login social) ────────────────────────────────
function renderCompleteProfile() {
  const p = state.profile || profileDraftFromUser();
  app.innerHTML = `
    <main class="auth-page complete-profile-page">
      <section class="auth-card">
        <div class="complete-profile-head">
          ${avatarHtml(p, "complete-profile-avatar")}
          <h1>Completa il tuo profilo</h1>
          <p>Bastano pochi dati per iniziare a usare CivicVois. La tua zona è obbligatoria; foto e bio sono facoltative.</p>
        </div>
        <form class="auth-form" id="complete-profile-form">
          <div class="field">
            <label>Nome completo</label>
            <input class="input" name="full_name" type="text" autocomplete="name" maxlength="80" value="${escapeHtml(p.full_name || "")}" placeholder="Es. Mattia Molteni" required />
          </div>

          <div class="field">
            <label>Username</label>
            <input class="input" name="username" type="text" autocomplete="username" maxlength="32" value="${escapeHtml(p.username || "")}" placeholder="Es. mattia" required />
          </div>

          ${locationFieldsHtml(p, { required: true })}

          <div class="field span-2">
            <label>Bio <span class="field-optional">(facoltativa)</span></label>
            <textarea class="textarea" name="bio" maxlength="500" placeholder="Racconta brevemente chi sei o il tuo legame col territorio.">${escapeHtml(p.bio || "")}</textarea>
          </div>

          <div class="field span-2">
            <label>Foto profilo <span class="field-optional">(facoltativa)</span></label>
            ${avatarUploadHtml(p, "complete")}
          </div>

          <button class="btn btn-primary span-2" type="submit">Salva e continua</button>
          <div class="complete-profile-actions span-2">
            <button class="btn btn-ghost mobile-logout-btn" type="button">Esci</button>
            <button class="btn btn-danger delete-account-btn" type="button">Elimina account</button>
          </div>
        </form>
      </section>
    </main>
  `;

  const form = $("#complete-profile-form");
  bindLocationControls(form);
  bindAvatarUpload(form);
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await lockSubmit(form, () => handleCompleteProfile(new FormData(form)));
  });
  document.querySelector(".mobile-logout-btn")?.addEventListener("click", handleLogout);
  document.querySelector(".delete-account-btn")?.addEventListener("click", handleDeleteAccount);
}

async function handleCompleteProfile(formData) {
  if (!hasRealAuthSession()) {
    toast("Sessione account non ancora pronta. Attendi qualche secondo e riprova.", "error");
    ensureProfileLoaded();
    return;
  }
  const location = validateLocationSelection(formData); // regione/provincia/comune obbligatori
  if (!location.ok) return toast(location.message, "error");

  const p = state.profile || profileDraftFromUser();
  const avatarFile = formData.get("avatar_file");
  const fullName = clean(formData.get("full_name"));
  const username = cleanUsername(formData.get("username"));
  if (!fullName || !username) return toast("Nome completo e username sono obbligatori.", "error");

  const payload = {
    full_name: fullName,
    username,
    bio: clean(formData.get("bio")),                                  // facoltativa
    avatar_url: clean(formData.get("avatar_url")) || p.avatar_url || "", // foto attuale o scelta
    avatarFile: avatarFile instanceof File && avatarFile.size > 0 ? avatarFile : null,
    regione: location.regione,
    provincia: location.provincia,
    comune: location.comune
  };

  try {
    const saved = await backend.saveProfile(state.user.id, payload);
    // Merge ottimistico: forziamo i valori appena inseriti così il profilo
    // risulta sicuramente completo e il guard lascia passare alla dashboard,
    // a prescindere da eventuali letture stale del backend.
    setProfileResolved({
      ...(state.profile || {}),
      ...(saved || {}),
      full_name: fullName,
      username,
      regione: location.regione,
      provincia: location.provincia,
      comune: location.comune
    });
    state.filtersInitialized = false; // i filtri dashboard si reimpostano dalla nuova zona
    toast("Profilo completato. Benvenuto in CivicVois!", "success");
    setRoute("dashboard");
    refreshData().then(render).catch(error => console.warn("Dati post-completamento profilo non caricati subito", error));
  } catch (error) {
    console.error(error);
    toast(error.message || "Salvataggio non riuscito. Riprova.", "error");
  }
}

function loginFormHtml() {
  return `
    <form class="auth-form" id="auth-form" data-action="login">
      <div class="field">
        <label>Email</label>
        <input class="input" name="email" type="email" autocomplete="email" placeholder="nome@email.it" required />
      </div>
      <div class="field">
        <label>Password</label>
        <input class="input" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required minlength="6" />
      </div>
      <button class="btn btn-primary" type="submit">Entra in CivicVois</button>
    </form>
    ${socialAuthHtml()}
  `;
}

function registerFormHtml() {
  return `
    <form class="auth-form" id="auth-form" data-action="register">
      <div class="field">
        <label>Nome completo</label>
        <input class="input" name="full_name" type="text" autocomplete="name" placeholder="Mario Rossi" required />
      </div>
      <div class="field">
        <label>Username</label>
        <input class="input" name="username" type="text" autocomplete="username" placeholder="mario" required minlength="3" />
      </div>
      <div class="field">
        <label>Email</label>
        <input class="input" name="email" type="email" autocomplete="email" placeholder="nome@email.it" required />
      </div>
      <div class="field">
        <label>Password</label>
        <input class="input" name="password" type="password" autocomplete="new-password" placeholder="Minimo 6 caratteri" required minlength="6" />
      </div>
      ${locationFieldsHtml({}, { required: true })}
      <div class="field span-2">
        <label>Bio</label>
        <textarea class="textarea" name="bio" maxlength="500" placeholder="Racconta brevemente chi sei o il tuo legame col territorio."></textarea>
      </div>
      <div class="field span-2">
        <label>Foto profilo</label>
        ${avatarUploadHtml({}, "register")}
      </div>
      <label class="eula-row span-2">
        <input type="checkbox" name="accept_terms" required />
        <span>Dichiaro di avere almeno 14 anni e accetto i <a href="https://civicvois.it/legal/termini.html" target="_blank" rel="noopener">Termini</a>, la <a href="https://civicvois.it/legal/privacy.html" target="_blank" rel="noopener">Privacy</a> e le <a href="https://civicvois.it/legal/contenuti.html" target="_blank" rel="noopener">regole sui contenuti</a> (tolleranza zero per contenuti offensivi).</span>
      </label>
      <button class="btn btn-primary span-2" type="submit">Crea account</button>
    </form>
    ${socialAuthHtml()}
  `;
}

function socialAuthHtml() {
  return `
    <div class="social-auth">
      <div class="social-divider"><span>oppure continua con</span></div>
      <button class="btn btn-social btn-social-google" type="button" data-social-provider="google">
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61z" fill="#4285F4"/><path d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.91-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" fill="#34A853"/><path d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" fill="#FBBC05"/><path d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/></svg>
        <span>Continua con Google</span>
      </button>
      ${FACEBOOK_APP_ID ? `<button class="btn btn-social btn-social-facebook" type="button" data-social-provider="facebook">
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/><path fill="#fff" d="M16.671 15.543l.532-3.47h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.513V4.997s-1.374-.235-2.686-.235c-2.741 0-4.533 1.661-4.533 4.669v2.642H7.078v3.47h3.047v8.385a12.07 12.07 0 0 0 3.75 0v-8.385h2.796z"/></svg>
        <span>Continua con Facebook</span>
      </button>` : ""}
      <p class="social-eula">Continuando accetti i <a href="https://civicvois.it/legal/termini.html" target="_blank" rel="noopener">Termini</a> e la <a href="https://civicvois.it/legal/privacy.html" target="_blank" rel="noopener">Privacy</a> di CivicVois.</p>
    </div>
  `;
}


// Social login (Google / Facebook): funziona sia su app nativa che su PWA web
document.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-social-provider]");
  if (!btn) return;
  event.preventDefault();
  const provider = btn.dataset.socialProvider;
  btn.disabled = true;
  try {
    if (provider === "google") {
      if (IS_NATIVE_APP) await handleGoogleSignInNative();
      else await handleGoogleSignInWeb();
    } else if (provider === "facebook") {
      if (IS_NATIVE_APP) await handleFacebookSignInNative();
      else await handleFacebookSignInWeb();
    }
  } catch (error) {
    console.error("Social login error", error);
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("cancel") || msg.includes("annullat") || msg.includes("closed")) {
      // utente ha chiuso il popup, niente toast
    } else {
      toast("Accesso con " + provider + " non riuscito. " + (error?.message || ""), "error");
    }
  } finally {
    btn.disabled = false;
  }
});

// ── Google: app nativa Capacitor (Supabase OAuth + deep link) ─────────────
// Niente plugin GoogleAuth nativo: riusiamo il login Google già configurato su
// Supabase (lo stesso client Web che funziona sul sito). Apriamo la pagina di
// consenso nel browser di sistema e intercettiamo il redirect sullo scheme
// it.civicvois.app:// tramite il plugin @capacitor/app, poi scambiamo il code
// per una sessione (flusso PKCE). NB: il vecchio fallback rimandava a
// capacitor://localhost/, che il browser di sistema non sa restituire all'app.

function nativeOAuthSchemePrefix() {
  return `${NATIVE_OAUTH_REDIRECT.split("://")[0]}://`;
}

function isNativeOAuthCallbackUrl(url) {
  return String(url || "").startsWith(nativeOAuthSchemePrefix());
}

function parseNativeOAuthCallbackUrl(url) {
  const incoming = String(url || "");
  if (!isNativeOAuthCallbackUrl(incoming)) return null;
  const qIndex = incoming.indexOf("?");
  const hIndex = incoming.indexOf("#");
  const query = qIndex >= 0 ? incoming.slice(qIndex + 1).split("#")[0] : "";
  const frag = hIndex >= 0 ? incoming.slice(hIndex + 1) : "";
  const params = new URLSearchParams(query);
  const hashParams = new URLSearchParams(frag);
  const error = params.get("error_description") || params.get("error")
    || hashParams.get("error_description") || hashParams.get("error");
  return {
    code: params.get("code") || hashParams.get("code") || "",
    error: error ? decodeURIComponent(error) : ""
  };
}

function rememberNativeOAuthPending(provider = "google") {
  try {
    writeLocal(NATIVE_OAUTH_PENDING_KEY, {
      provider,
      startedAt: Date.now()
    });
  } catch {}
}

function hasRecentNativeOAuthPending() {
  const pending = readLocal(NATIVE_OAUTH_PENDING_KEY, null);
  return Boolean(pending?.startedAt && Date.now() - Number(pending.startedAt) <= NATIVE_OAUTH_PENDING_MAX_AGE_MS);
}

function clearNativeOAuthPending() {
  try { localStorage.removeItem(NATIVE_OAUTH_PENDING_KEY); } catch {}
}

function closeNativeOAuthBrowser() {
  const BrowserPlugin = window.Capacitor?.Plugins?.Browser;
  try {
    const result = BrowserPlugin?.close?.();
    Promise.resolve(result).catch(() => {});
  } catch (_) {}
}

function notifyNativeOAuthWaiter(value = NATIVE_OAUTH_SESSION_READY, error = null) {
  const waiter = nativeOAuthWaiter;
  nativeOAuthWaiter = null;
  try {
    if (error) waiter?.reject?.(error);
    else waiter?.resolve?.(value);
  } catch (_) {}
}

function installNativeOAuthLifecycleHandlers() {
  if (nativeOAuthLifecycleInstalled || !IS_NATIVE_APP || !supabase) return;
  const AppPlugin = window.Capacitor?.Plugins?.App;
  if (!AppPlugin) return;
  nativeOAuthLifecycleInstalled = true;

  const onUrl = (url, source) => {
    if (!isNativeOAuthCallbackUrl(url)) return;
    rememberNativeOAuthPending("google");
    completeNativeOAuthFromUrl(url, source).catch(error => {
      console.error("Redirect OAuth nativo non finalizzato", error);
      clearNativeOAuthPending();
      notifyNativeOAuthWaiter(null, error);
      toast(niceBackendError(error, "Accesso Google non completato."), "error");
    });
  };

  if (AppPlugin.addListener) {
    try {
      Promise.resolve(AppPlugin.addListener("appUrlOpen", event => onUrl(event?.url, "appUrlOpen"))).catch(() => {});
      Promise.resolve(AppPlugin.addListener("resume", () => {
        recoverNativeOAuthSession("resume").catch(error => console.warn("Recupero OAuth su resume non riuscito", error));
      })).catch(() => {});
      Promise.resolve(AppPlugin.addListener("appStateChange", event => {
        if (event?.isActive) {
          recoverNativeOAuthSession("appStateChange").catch(error => console.warn("Recupero OAuth su appStateChange non riuscito", error));
        }
      })).catch(() => {});
    } catch (error) {
      console.warn("Listener OAuth nativi non registrati", error);
    }
  }

  if (AppPlugin.getLaunchUrl) {
    Promise.resolve(AppPlugin.getLaunchUrl())
      .then(result => onUrl(result?.url, "launchUrl"))
      .catch(() => {})
      .finally(() => {
        recoverNativeOAuthSession("launch").catch(error => console.warn("Recupero OAuth su launch non riuscito", error));
      });
  }
}

// Scambio del code OAuth DEDUPLICATO. Il deep link può arrivare da più eventi
// nativi (appUrlOpen, launchUrl, resume/recovery), ma il code PKCE è monouso:
// qui garantiamo un solo exchange e una sola finalizzazione per ogni code.
const nativeOAuthExchangeByCode = new Map();
const nativeOAuthCompletionByCode = new Map();
function exchangeNativeOAuthCode(code) {
  if (!code) return supabase.auth.exchangeCodeForSession(code);
  if (!nativeOAuthExchangeByCode.has(code)) {
    nativeOAuthExchangeByCode.set(code, supabase.auth.exchangeCodeForSession(code));
    setTimeout(() => nativeOAuthExchangeByCode.delete(code), 120000);
  }
  return nativeOAuthExchangeByCode.get(code);
}

async function completeNativeOAuthCode(code, source = "appUrlOpen") {
  if (!code) return recoverNativeOAuthSession(`${source}:no-code`, { allowWithoutPending: true });
  if (!nativeOAuthCompletionByCode.has(code)) {
    const completion = (async () => {
      const { data, error } = await exchangeNativeOAuthCode(code);
      if (error) {
        const recovered = await recoverNativeOAuthSession(`${source}:exchange-fallback`, { allowWithoutPending: true });
        if (recovered) return true;
        throw new Error(error.message || "Scambio del codice Google non riuscito.");
      }
      if (data?.session) syncSessionState(data.session);
      await finalizeNativeOAuthSession({ session: data?.session || state.session, source });
      return true;
    })();
    nativeOAuthCompletionByCode.set(code, completion);
    setTimeout(() => nativeOAuthCompletionByCode.delete(code), 120000);
  }
  return nativeOAuthCompletionByCode.get(code);
}

async function completeNativeOAuthFromUrl(url, source = "appUrlOpen") {
  const parsed = parseNativeOAuthCallbackUrl(url);
  if (!parsed) return false;
  if (parsed.error) throw new Error(parsed.error);

  return completeNativeOAuthCode(parsed.code, source);
}

async function finalizeNativeOAuthSession({ session = null, source = "native-oauth" } = {}) {
  if (!IS_NATIVE_APP || !supabase) return false;
  if (nativeOAuthFinalizeRunning) return false;
  nativeOAuthFinalizeRunning = true;
  try {
    let activeSession = session || state.session || readStoredSupabaseSession();
    if (!activeSession?.user) {
      const { data, error } = await withTimeout(supabase.auth.getSession(), 6000, "sessione Google");
      if (error) throw error;
      activeSession = data?.session || null;
    }
    if (!activeSession?.user) return false;

    syncSessionState(activeSession);
    const oauthUser = activeSession.user;

    // Sblocco IMMEDIATO: chiudiamo il browser e instradiamo l'utente subito,
    // SENZA aspettare il profilo dal server (oauthFinalize/_ensureProfile può
    // essere lento). La sessione esiste già: la UI deve uscire dalla pagina di
    // login all'istante. Il profilo reale (o la sua creazione) avviene dopo.
    clearNativeOAuthPending();
    closeNativeOAuthBrowser();
    notifyNativeOAuthWaiter();
    await applyAuthedSession({
      user: oauthUser,
      session: activeSession,
      profile: readCachedProfile(oauthUser.id)
    }, "google");

    // Background: garantisci/aggiorna il profilo reale, poi ridisegna.
    backend.oauthFinalize({}, activeSession)
      .then(result => { if (result?.profile) { setProfileResolved(result.profile); render(); } })
      .catch(error => { console.warn(`Profilo Google non finalizzato subito (${source}); ritento in background.`, error); try { ensureProfileLoaded(); } catch (_) {} });

    return true;
  } finally {
    nativeOAuthFinalizeRunning = false;
  }
}

async function recoverNativeOAuthSession(source = "recovery", options = {}) {
  if (!IS_NATIVE_APP || !supabase) return false;
  if (!options.allowWithoutPending && !hasRecentNativeOAuthPending()) return false;
  if (nativeOAuthRecoveryRunning) return false;
  nativeOAuthRecoveryRunning = true;
  try {
    const AppPlugin = window.Capacitor?.Plugins?.App;
    if (AppPlugin?.getLaunchUrl) {
      const launch = await Promise.resolve(AppPlugin.getLaunchUrl()).catch(() => null);
      if (isNativeOAuthCallbackUrl(launch?.url)) {
        const parsed = parseNativeOAuthCallbackUrl(launch.url);
        if (parsed?.code) {
          return completeNativeOAuthCode(parsed.code, `${source}:launchUrl`);
        }
      }
    }

    const delays = [0, 350, 900, 1800];
    for (const delay of delays) {
      if (delay) await wait(delay);
      const stored = state.session || readStoredSupabaseSession();
      if (stored?.user) {
        await finalizeNativeOAuthSession({ session: stored, source });
        return true;
      }
      const { data } = await withTimeout(supabase.auth.getSession(), 5000, "sessione Google").catch(() => ({ data: null }));
      if (data?.session?.user) {
        await finalizeNativeOAuthSession({ session: data.session, source });
        return true;
      }
    }
    return false;
  } finally {
    nativeOAuthRecoveryRunning = false;
  }
}

async function handleGoogleSignInNative() {
  if (!supabase) throw new Error("Backend non disponibile.");
  await assertSupabaseAuthReachable();
  rememberNativeOAuthPending("google");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_OAUTH_REDIRECT,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: "select_account",
        access_type: "offline"
      }
    }
  });
  if (error) {
    clearNativeOAuthPending();
    throw new Error(error.message || "Avvio login Google non riuscito.");
  }
  if (!data?.url) {
    clearNativeOAuthPending();
    throw new Error("URL di autenticazione Google non disponibile.");
  }

  try {
    await openNativeOAuthBrowserAndAwaitCompletion(data.url);
  } catch (waitError) {
    const recovered = await recoverNativeOAuthSession("wait-fallback", { allowWithoutPending: true });
    if (recovered) return;
    clearNativeOAuthPending();
    throw waitError;
  }
}

// Apre l'URL OAuth e lascia che SOLO il listener globale `appUrlOpen` consumi il
// deep link. Il bottone aspetta soltanto la finalizzazione, evitando doppi
// exchange dello stesso code PKCE.
function openNativeOAuthBrowserAndAwaitCompletion(authUrl) {
  return new Promise((resolve, reject) => {
    const BrowserPlugin = window.Capacitor?.Plugins?.Browser;
    if (!window.Capacitor?.Plugins?.App?.addListener) {
      reject(new Error("Plugin Capacitor App non disponibile per il login nativo."));
      return;
    }
    let settled = false;
    let browserFinishedHandle = null;
    let cleanupDone = false;
    const timer = setTimeout(() => finish(new Error("Tempo scaduto per il login Google.")), 180000);
    nativeOAuthWaiter = {
      resolve: (value) => finish(null, value),
      reject: (error) => finish(error instanceof Error ? error : new Error(String(error || "Login Google non completato.")))
    };
    const waiter = nativeOAuthWaiter;
    function closeBrowser() {
      try {
        const result = BrowserPlugin?.close?.();
        Promise.resolve(result).catch(() => {});
      } catch (_) {}
    }
    function cleanup() {
      cleanupDone = true;
      clearTimeout(timer);
      try { browserFinishedHandle?.remove?.(); } catch (_) {}
      if (nativeOAuthWaiter === waiter) nativeOAuthWaiter = null;
      closeBrowser();
    }
    function finish(err, code) {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err); else resolve(code);
    }

    if (BrowserPlugin?.addListener) {
      Promise.resolve(BrowserPlugin.addListener("browserFinished", async () => {
        const recovered = await recoverNativeOAuthSession("browserFinished", { allowWithoutPending: true }).catch(() => false);
        if (recovered) finish(null, NATIVE_OAUTH_SESSION_READY);
        else finish(new Error("Login Google annullato."));
      })).then((h) => {
        if (cleanupDone) {
          try { h?.remove?.(); } catch (_) {}
          return;
        }
        browserFinishedHandle = h;
      }).catch(() => {});
    }
    Promise.resolve().then(() => {
      if (cleanupDone) {
        return null;
      }
      if (BrowserPlugin?.open) {
        return BrowserPlugin.open({ url: authUrl, presentationStyle: "fullscreen" });
      }
      try { window.open(authUrl, "_system"); }
      catch (_) { window.location.href = authUrl; }
    }).catch((e) => finish(e instanceof Error ? e : new Error("Browser OAuth non aperto.")));
  });
}

// ── Google: sito web (redirect OAuth via Supabase, flusso PKCE) ───────────
// Usiamo direttamente il redirect OAuth gestito da Supabase: è il flusso
// ufficiale e i log di produzione mostrano che è l'unico stabile sul web.
// Il vecchio tentativo "Google Identity One Tap + popup id_token" falliva in
// pratica sempre (One Tap spesso non si mostra per config origin/FedCM e va in
// timeout; il popup veniva aperto fuori dal gesto utente → bloccato dal
// browser; signInWithIdToken falliva per nonce/audience) e ricadeva comunque
// sul redirect — quindi lo saltiamo del tutto.
async function handleGoogleSignInWeb() {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error("Google Client ID Web non configurato.");
  await startSupabaseOAuthRedirect("google");
}

async function startSupabaseOAuthRedirect(provider) {
  if (typeof backend.startOAuth !== "function") throw new Error("OAuth non supportato dal backend corrente.");
  writeLocal("cv_oauth_return_route", state.route || "dashboard");
  await backend.startOAuth({
    provider,
    redirectTo: getOAuthRedirectTo()
  });
}

function getOAuthRedirectTo() {
  const origin = window.location.origin || "https://civicvois.it";
  return `${origin.replace(/\/$/, "")}/`;
}

// ── Facebook: app nativa Capacitor ───────────────────────────────────────
async function handleFacebookSignInNative() {
  const FacebookLogin = window.Capacitor?.Plugins?.FacebookLogin;
  if (!FacebookLogin) throw new Error("Plugin Facebook non disponibile.");
  const result = await FacebookLogin.login({ permissions: ["email", "public_profile"] });
  const accessToken = result?.accessToken?.token || result?.accessToken;
  if (!accessToken) throw new Error("Token Facebook mancante o login annullato.");
  await finalizeSocialSession("facebook", accessToken);
}

// ── Facebook: sito web (FB SDK) ──────────────────────────────────────────
async function handleFacebookSignInWeb() {
  if (!FACEBOOK_APP_ID) throw new Error("Facebook App ID non configurato. Crea l'app su developers.facebook.com.");
  await loadScriptOnce("https://connect.facebook.net/en_US/sdk.js");
  if (!window.FB._initialized) {
    window.FB.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: false, version: "v18.0" });
    window.FB._initialized = true;
  }
  const accessToken = await new Promise((resolve, reject) => {
    window.FB.login((response) => {
      if (response?.status === "connected" && response.authResponse?.accessToken) {
        resolve(response.authResponse.accessToken);
      } else {
        reject(new Error("Login Facebook annullato."));
      }
    }, { scope: "email,public_profile" });
  });
  await finalizeSocialSession("facebook", accessToken);
}

// Helper: carica uno script esterno una sola volta
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile caricare " + src));
    document.head.appendChild(script);
  });
}

async function finalizeSocialSession(provider, token, profileHint = {}) {
  const { user, session, profile } = await backend.socialLogin({ provider, token, profileHint });
  await applyAuthedSession({ user, session, profile }, provider);
}

// Applica una sessione social già ottenuta (idToken sul web, OAuth sul nativo)
// allo stato dell'app e instrada l'utente.
async function applyAuthedSession({ user, session, profile }, provider) {
  state.user = user;
  state.session = session || null;
  if (profile) setProfileResolved(profile);
  else {
    markProfileMissing();
  }

  // Gli account social nascono senza comune/provincia. Se il profilo è
  // incompleto, lo mandiamo alla pagina dedicata di completamento (il guard
  // centrale in render()/normalizeRoute lo terrebbe comunque lì).
  if (!profile || isProfileIncomplete(profile)) {
    refreshData().then(render).catch(error => console.warn("Dati post-login social non caricati subito", error));
    setRoute("complete-profile");
    return;
  }

  toast("Accesso con " + provider + " effettuato.", "success");
  refreshData().then(render).catch(error => console.warn("Dati post-login social non caricati subito", error));
  setRoute("dashboard");
}

// Un profilo è "completo" se ha almeno nome e comune (i campi minimi per
// partecipare in modo utile: le segnalazioni sono georeferenziate sul comune).
function isProfileIncomplete(profile) {
  if (!profile) return true;
  return !clean(profile.comune) || !clean(profile.full_name);
}

async function handleLogin(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  try {
    const { user, session, profile } = await backend.login({ email, password });
    state.user = user;
    state.session = session || null;
    if (profile) setProfileResolved(profile);
    else {
      state.profile = null;
      setProfileLoading();
    }
    await refreshData();
    toast("Accesso effettuato.", "success");
    if (!profile) ensureProfileLoaded();
    setRoute("dashboard");
  } catch (error) {
    console.error("Errore login", error);
    toast(error.message || "Accesso non riuscito.", "error");
  }
}

async function handleRegister(formData) {
  const location = validateLocationSelection(formData);
  if (!location.ok) return toast(location.message, "error");

  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    username: String(formData.get("username") || "").trim().toLowerCase(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    password: String(formData.get("password") || ""),
    regione: location.regione,
    provincia: location.provincia,
    comune: location.comune,
    bio: clean(formData.get("bio")),
    avatarFile: formData.get("avatar_file")
  };

  if (!payload.full_name || !payload.username || !payload.email || payload.password.length < 6) {
    return toast("Compila correttamente tutti i campi obbligatori.", "error");
  }

  try {
    const { user, session, profile, needsConfirm } = await backend.register(payload);

    if (needsConfirm) {
      toast("Account creato. Ora puoi usare CivicVois.", "success");
      return renderAuthPage("login");
    }

    state.user = user;
    state.session = session || null;
    if (profile) setProfileResolved(profile);
    else {
      state.profile = null;
      setProfileLoading();
    }
    await refreshData();
    toast("Registrazione completata.", "success");
    if (!profile) ensureProfileLoaded();
    setRoute("dashboard");
  } catch (error) {
    console.error("Errore registrazione", error);
    toast(error.message || "Registrazione non riuscita.", "error");
  }
}

async function handleLogout() {
  clearAuthLocalHints();
  clearStoredSupabaseSession();
  clearAuthState();
  toast("Logout effettuato.", "success");
  setRoute("landing");
  backend.logout().catch(error => console.warn("Logout remoto/local Supabase completato con errore dopo uscita UI.", error));
}

// ─── App layout ───────────────────────────────────────────────────────────────

function renderApp(active) {
  const navActive = active === "profile-edit" ? "profile" : active;
  app.innerHTML = `
    <div class="app-layout">

      <!-- ── Sidebar desktop ── -->
      <aside class="sidebar">
        <div class="sidebar-inner">
          ${brandHtml()}
          ${navHtml(navActive)}
        </div>
        <div class="side-bottom">
          ${state.user
            ? `${userMiniHtml()}
          <button class="btn btn-ghost" id="logout-btn">Esci</button>`
            : `<button class="btn btn-primary" data-route="auth">Accedi</button>`}
        </div>
      </aside>

      <!-- ── Area principale ── -->
      <div class="app-body">

        <!-- Header desktop: search + notifiche + CTA -->
        <header class="app-header">
          <div class="app-header-actions">
            <button class="icon-btn app-notif-btn" aria-label="Notifiche">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span class="notif-dot"></span>
            </button>
            <button class="btn btn-primary" data-route="new">+ Nuova segnalazione</button>
          </div>
        </header>

        <!-- Mobile topbar -->
        <header class="mobile-topbar">
          ${brandHtml()}
        </header>

        <main class="main">
          ${active === "dashboard" ? dashboardHtml() : ""}
          ${active === "new" ? newReportHtml() : ""}
          ${active === "profile" ? profileHtml() : ""}
          ${active === "profile-edit" ? profileEditHtml() : ""}
          ${active === "admin" ? adminHtml() : ""}
        </main>

        <!-- Mobile bottom nav -->
        ${mobileNavHtml(navActive)}
      </div>
    </div>
  `;

  bindRouteButtons();
  bindAppEvents(active);

  if (active === "dashboard") {
    setTimeout(initMap, 40);
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function dashboardHtml() {
  const stats = getStats();
  const filtered = filteredReports();
  const totalPages = Math.ceil(state.totalReports / PAGE_SIZE);
  const hasMore = state.page < totalPages - 1;

  return `
    <!-- Titolo pagina -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Dashboard civica</h1>
        <p class="dash-subtitle">Controlla segnalazioni, priorità e aggiornamenti del territorio.</p>
      </div>
      <!-- CTA desktop visibile solo da desktop (nel mobile c'è quella separata) -->
    </div>

    ${DEMO_MODE ? demoNoticeHtml() : ""}

    <!-- CTA mobile: visibile solo su mobile, full-width -->
    <button class="btn btn-primary dash-cta-mobile" data-route="new">+ Nuova segnalazione</button>

    <!-- KPI: 4 colonne desktop, 4 colonne compatte mobile -->
    <section class="kpi-grid" aria-label="Statistiche">
      <div class="kpi-card kpi-card--totali">
        <div class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="kpi-body">
          <b class="kpi-value">${stats.total}</b>
          <span class="kpi-label">Totali</span>
          <span class="kpi-trend">+${Math.max(0, stats.total - Math.max(0, stats.total - 1))} vs sett. scorsa</span>
        </div>
      </div>
      <div class="kpi-card kpi-card--carico">
        <div class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="kpi-body">
          <b class="kpi-value">${stats.inProgress}</b>
          <span class="kpi-label">In carico</span>
          <span class="kpi-trend">= vs sett. scorsa</span>
        </div>
      </div>
      <div class="kpi-card kpi-card--risolte">
        <div class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="kpi-body">
          <b class="kpi-value">${stats.resolved}</b>
          <span class="kpi-label">Risolte</span>
          <span class="kpi-trend">= vs sett. scorsa</span>
        </div>
      </div>
      <div class="kpi-card kpi-card--aperte">
        <div class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h4"/></svg>
        </div>
        <div class="kpi-body">
          <b class="kpi-value">${stats.open}</b>
          <span class="kpi-label">Aperte</span>
          <span class="kpi-trend">= vs sett. scorsa</span>
        </div>
      </div>
    </section>

    <!-- Layout a 2 colonne: feed sinistra, mappa+attività destra -->
    <section class="dashboard-grid">

      <!-- Colonna sinistra: filtri + feed -->
      <div class="dash-feed-col">

        <!-- Sezione filtri: regione, provincia, comune (preimpostati dal profilo), categoria -->
        <div class="dash-filters">
          <p class="dash-filters-title">Filtra segnalazioni</p>
          <div class="filters-grid">
            ${dashboardFiltersHtml()}
          </div>
        </div>

        <!-- Feed segnalazioni -->
        <div class="feed" id="report-feed">
          ${!state.reportsLoaded
            ? skeletonFeedHtml()
            : (filtered.length ? filtered.map(reportCardHtml).join("") : emptyHtml("Nessuna segnalazione trovata", "Prova a cambiare i filtri o crea una nuova segnalazione."))}
        </div>

        <!-- Mappa: visibile solo mobile (dopo il feed) -->
        <div class="dash-map-mobile panel panel-pad">
          <h2 class="panel-title">Mappa delle segnalazioni</h2>
          <div class="map-panel map-panel--mobile"><div id="map-mobile"></div></div>
        </div>
      </div>

      <!-- Colonna destra (solo desktop): mappa + attività -->
      <aside class="dash-aside">
        <div class="panel panel-pad dash-map-desktop">
          <h2 class="panel-title">Mappa delle segnalazioni</h2>
          <div style="height:10px"></div>
          <div class="map-panel"><div id="map"></div></div>
        </div>

        <div class="panel panel-pad dash-activity-panel">
          <h2 class="panel-title">Attività recenti</h2>
          <p class="panel-subtitle">Ultimi aggiornamenti dalla piattaforma.</p>
          <div style="height: 14px"></div>
          <div class="activity-list">
            ${state.reports.slice(0, 5).map(activityHtml).join("") || emptyHtml("Nessuna attività", "Le attività compariranno qui.")}
          </div>
        </div>
      </aside>
    </section>
  `;
}

// ─── Nuova segnalazione ───────────────────────────────────────────────────────

function newReportHtml() {
  const p = state.profile || {};
  // Posizione preimpostata dalla zona del profilo (l'utente può cambiarla)
  const presetLoc = {
    regione: cleanLocationName(p.regione || ""),
    provincia: cleanLocationName(p.provincia || ""),
    comune: cleanLocationName(p.comune || "")
  };

  return `
    <!-- ── Topbar desktop ── -->
    <div class="topbar">
      <div>
        <h1>Nuova segnalazione</h1>
        <p>Aiutaci a migliorare il territorio. Compila i dettagli e invia la tua segnalazione.</p>
      </div>
      <div class="nr-topbar-right">
        <button class="btn btn-dark" data-route="dashboard">← Dashboard</button>
      </div>
    </div>

    <form id="report-form">
      <div class="nr-layout">

        <!-- ── 1 Categoria ── -->
        <div class="nr-section panel">
          <div class="nr-section-header">
            <span class="nr-section-num">1</span>
            <div><h2 class="nr-section-title">Categoria <span class="nr-required">(obbligatoria)</span></h2></div>
          </div>
          <div class="nr-field">
            <select class="select" name="tipo" required>
              <option value="">Seleziona una categoria</option>
              ${CATEGORIES.map(c => `<option value="${escapeAttr(c)}">${capitalize(c)}</option>`).join("")}
            </select>
            <small class="field-hint">Scegli la categoria che meglio rappresenta il problema.</small>
          </div>
        </div>

        <!-- ── 2 Priorità ── -->
        <div class="nr-section panel">
          <div class="nr-section-header">
            <span class="nr-section-num">2</span>
            <div><h2 class="nr-section-title">Priorità</h2></div>
          </div>
          <div class="nr-field">
            <div class="nr-priority-group">
              <input type="hidden" name="priorita" id="nr-priorita" value="bassa" />
              <button type="button" class="nr-priority-btn is-selected" data-priority="bassa"><span class="nr-priority-dot" style="background:#10b981"></span> Bassa</button>
              <button type="button" class="nr-priority-btn" data-priority="media"><span class="nr-priority-dot" style="background:#f59e0b"></span> Media</button>
              <button type="button" class="nr-priority-btn" data-priority="alta"><span class="nr-priority-dot" style="background:#f43f5e"></span> Alta</button>
              <button type="button" class="nr-priority-btn" data-priority="urgente"><span class="nr-priority-dot" style="background:#7c3aed"></span> Urgente</button>
            </div>
            <small class="field-hint">Indica il livello di urgenza del problema.</small>
          </div>
        </div>

        <!-- ── 3 Posizione (solo manuale + verifica obbligatoria) ── -->
        <div class="nr-section panel">
          <div class="nr-section-header">
            <span class="nr-section-num">3</span>
            <div>
              <h2 class="nr-section-title">Posizione <span class="nr-required">(obbligatoria)</span></h2>
              <p class="nr-section-sub">Inserisci l'indirizzo a mano e verificalo: serve a localizzare e filtrare le segnalazioni.</p>
            </div>
          </div>
          <div class="nr-field">
            ${locationFieldsHtml(presetLoc, { required: true })}
            <div class="nr-address-row">
              <div class="field nr-via-field">
                <label>Via / indirizzo</label>
                <input class="input" name="via" id="via-input" placeholder="Es. Via Roma" autocomplete="off" required />
              </div>
              <div class="field nr-civico-field">
                <label>Civico <span class="field-optional">(facoltativo)</span></label>
                <input class="input" name="civico" id="civico-input" placeholder="Es. 12" autocomplete="off" inputmode="numeric" />
              </div>
            </div>
            <input type="hidden" name="address_verified" id="address-verified" value="" />
            <input type="hidden" name="coordinate" id="coordinate-input" />
            <button type="button" class="btn btn-soft nr-verify-btn" id="verify-address-btn-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Verifica indirizzo
            </button>
            <div class="nr-verified-address" id="nr-verified-address" style="display:none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span id="nr-verified-text"></span>
            </div>
            <p class="field-hint nr-verify-hint">L'invio è possibile solo dopo aver verificato con successo l'indirizzo.</p>
          </div>
        </div>

        <!-- ── 4 Descrizione (facoltativa) ── -->
        <div class="nr-section panel">
          <div class="nr-section-header">
            <span class="nr-section-num">4</span>
            <div><h2 class="nr-section-title">Descrizione <span class="field-optional">(facoltativa)</span></h2></div>
          </div>
          <div class="nr-field">
            <textarea class="textarea nr-textarea" name="descrizione" id="nr-desc" placeholder="Aggiungi dettagli se vuoi (facoltativo)…" maxlength="1000"></textarea>
            <div class="nr-char-row">
              <small class="field-hint">Puoi lasciarla vuota. Se vuoi, descrivi quando si verifica, da quanto tempo, l'impatto.</small>
              <span class="nr-char-count" id="desc-count">0/1000</span>
            </div>
          </div>
        </div>

        <!-- ── 5 Foto (facoltativa) ── -->
        <div class="nr-section panel">
          <div class="nr-section-header">
            <span class="nr-section-num">5</span>
            <div>
              <h2 class="nr-section-title">Foto <span class="field-optional">(facoltativa)</span></h2>
              <p class="nr-section-sub">Se vuoi, carica una foto chiara del problema. Puoi anche pubblicare senza.</p>
            </div>
          </div>
          <div class="nr-photo-grid" id="photo-grid">
            <label class="nr-photo-upload" id="upload-box">
              <input type="file" name="photo" accept="${IMAGE_ACCEPT}" id="photo-input" />
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
              <div id="upload-copy">
                <strong>Trascina qui la foto</strong>
                <span>oppure clicca per sfogliare</span>
                <span class="nr-upload-hint">JPG, PNG o WebP fino a 5 MB</span>
              </div>
            </label>
            <button class="nr-photo-action" type="button" id="camera-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span>Scatta foto</span>
            </button>
            <button class="nr-photo-action" type="button" id="gallery-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Scegli dalla galleria</span>
            </button>
          </div>
          <div id="photo-previews" class="nr-photo-previews"></div>
          <p class="nr-photo-limit">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Puoi allegare una foto per segnalazione
          </p>
        </div>

        <!-- Privacy fissa a pubblico -->
        <input type="hidden" name="privacy" value="pubblico" />

        <!-- ── Bottoni: subito sotto la foto (Annulla a sinistra, Invia a destra) ── -->
        <div class="nr-actions-row">
          <button class="btn btn-ghost" type="button" data-route="dashboard">Annulla</button>
          <button class="btn btn-primary" type="submit">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Invia segnalazione
          </button>
        </div>

      </div><!-- /nr-layout -->
    </form>
  `;
}

// ─── Profilo ──────────────────────────────────────────────────────────────────

function profileLoadingInlineHtml() {
  const isError = state.profileStatus === PROFILE_STATUS.ERROR || hasProfileLoadingExpired();
  return `
    <div class="topbar">
      <div>
        <h1>${isError ? "Profilo non disponibile" : "Caricamento profilo"}</h1>
        <p>${isError
          ? "La sessione è presente, ma il profilo reale non è stato recuperato."
          : "Sto recuperando il profilo reale collegato al tuo account."}</p>
      </div>
    </div>
    <section class="panel panel-pad">
      <p>${isError ? "Riprova tra qualche secondo o esci e accedi di nuovo." : "Attendi qualche istante."}</p>
      <div class="complete-profile-actions">
        <button class="btn btn-primary profile-retry-btn" type="button">Riprova</button>
        <button class="btn btn-ghost profile-complete-btn" type="button">Completa profilo</button>
        ${hasRealAuthSession() ? `<button class="btn btn-danger delete-account-btn" type="button">Elimina account</button>` : ""}
        <button class="btn btn-ghost mobile-logout-btn" type="button">Esci</button>
      </div>
    </section>
  `;
}

function profileHtml() {
  if (!state.profile) return profileLoadingInlineHtml();
  const p = state.profile;
  // Statistiche dai dati REALI dell'utente (tutte le sue segnalazioni), non dalla
  // pagina corrente della dashboard. Fallback alla pagina se non ancora caricate.
  const mine = state.myStats?.reports || state.reports.filter(r => r.user_id === state.user?.id);
  const likesReceived = state.myStats?.likesReceived ?? mine.reduce((acc, r) => acc + Number(r.like_count || 0), 0);
  const resolved = state.myStats?.resolved ?? mine.filter(r => r.stato === "risolta").length;
  const isAdmin = p.role === "admin";
  const roleLabel = isAdmin ? "Amministratore" : "Cittadino";
  const locationLine = [p.comune, p.provincia].filter(Boolean).join(", ") || "Posizione non impostata";

  // Calcolo completamento profilo
  const profileFields = [p.full_name, p.username, p.bio, p.comune, p.avatar_url];
  const filled = profileFields.filter(Boolean).length;
  const completionPct = Math.round((filled / profileFields.length) * 100);

  // ── Statistiche dinamiche ────────────────────────────────────────────
  // "Membro da": deriva dalla data della prima segnalazione dell'utente, o
  // dal created_at del profilo (se disponibile), fallback "—".
  const memberSince = (() => {
    const firstReport = [...mine].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0];
    const candidate = p.created_at || state.user?.created_at || firstReport?.created_at;
    return candidate ? formatMonthYear(candidate) : null;
  })();

  // "Questo mese": conteggio reale per segnalazioni e like
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const mineThisMonth = mine.filter(r => new Date(r.created_at || 0) >= startOfMonth).length;
  const likesThisMonth = mine
    .filter(r => new Date(r.created_at || 0) >= startOfMonth)
    .reduce((acc, r) => acc + Number(r.like_count || 0), 0);

  // Punteggio affidabilità reale: combina % risolte + media like + completamento profilo
  // Va da 0 a 5. Solo se l'utente ha almeno 1 segnalazione.
  // ── Reputazione e livelli ────────────────────────────────────────────
  // +100 punti per ogni segnalazione pubblicata, +10 per ogni like ricevuto.
  const REP_PER_REPORT = 100;
  const REP_PER_LIKE = 10;
  const LEVEL_STEP = 2000;
  const reputation = (mine.length * REP_PER_REPORT) + (likesReceived * REP_PER_LIKE);
  const level = Math.floor(reputation / LEVEL_STEP) + 1;       // livello 1 = 0–1999
  const levelFloor = (level - 1) * LEVEL_STEP;                 // punti minimi del livello attuale
  const pointsIntoLevel = reputation - levelFloor;            // progresso nel livello
  const pointsToNext = LEVEL_STEP - pointsIntoLevel;          // mancanti al livello successivo
  const levelPct = Math.round((pointsIntoLevel / LEVEL_STEP) * 100);

  // Badge basati sull'attività reale
  const badges = [
    { icon: "🛡️", name: "Cittadino attivo", color: "var(--teal)", earned: mine.length >= 1 },
    { icon: "❤️", name: "Sostenuto", color: "#f43f5e", earned: likesReceived >= 1 },
    { icon: "✅", name: "Risolutore", color: "#10b981", earned: resolved >= 1 },
    { icon: "⭐", name: "Veterano", color: "#f59e0b", earned: mine.length >= 5 }
  ].filter(b => b.earned);

  // Ultime attività dalle segnalazioni reali dell'utente
  const recentActivity = mine.slice(0, 3).map(r => ({
    icon: r.stato === "risolta" ? "✅" : r.stato === "in carico" ? "🔄" : "📋",
    text: `Segnalazione "${escapeHtml(r.titolo || r.tipo)}" — ${capitalize(r.stato || "nuova")}`,
    when: formatDate(r.created_at)
  }));

  return `
    <!-- ── Topbar desktop ── -->
    <div class="topbar">
      <div>
        <h1>Profilo</h1>
        <p>Gestisci il tuo account, la tua attività e il tuo impatto sul territorio.</p>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="icon-btn app-notif-btn" aria-label="Notifiche">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="notif-dot"></span>
        </button>
        <button class="btn btn-primary" id="edit-profile-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Modifica profilo
        </button>
      </div>
    </div>

    <!-- ── Hero card identità ── -->
    <div class="profile-hero panel">
      <div class="profile-hero-left">
        <div class="profile-avatar-wrap">
          ${avatarHtml(p, "profile-avatar-lg")}
          <button class="profile-avatar-edit" id="edit-profile-btn-2" title="Modifica profilo">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
        <div class="profile-hero-info">
          <h2 class="profile-hero-name">${escapeHtml(p.full_name || "Utente CivicVois")}</h2>
          <span class="profile-role-badge">${roleLabel}</span>
          <p class="profile-bio">${escapeHtml(p.bio || "Nessuna bio impostata. Modifica il profilo per aggiungerla.")}</p>
          <div class="profile-meta-row">
            <span class="profile-meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escapeHtml(locationLine)}
            </span>
            ${memberSince ? `
            <span class="profile-meta-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Membro da ${escapeHtml(memberSince)}
            </span>` : ""}
          </div>
          <div class="profile-reputation">
            <span class="profile-rep-icon">🛡️</span>
            <span class="profile-rep-label">Reputazione</span>
            <span class="profile-rep-value">${reputation.toLocaleString("it")} punti</span>
          </div>
        </div>
      </div>
      <div class="profile-hero-right">
        <div class="profile-level-box">
          <div class="profile-level-top">
            <span class="profile-level-badge">Livello ${level}</span>
            <span class="profile-level-points">${reputation.toLocaleString("it")} pt</span>
          </div>
          <div class="profile-level-bar"><div class="profile-level-fill" style="width:${levelPct}%"></div></div>
          <p class="profile-level-sub">${pointsIntoLevel.toLocaleString("it")} / ${LEVEL_STEP.toLocaleString("it")} · mancano ${pointsToNext.toLocaleString("it")} pt al livello ${level + 1}</p>
        </div>
        <div class="profile-location-box">
          <div class="profile-location-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${escapeHtml(locationLine)}
          </div>
          <div class="profile-location-area">
            <span>Area di riferimento</span>
            <strong>${escapeHtml(p.provincia || "—")}</strong>
          </div>
          <button class="btn btn-ghost btn-small" id="edit-profile-btn-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Modifica posizione
          </button>
        </div>
      </div>
    </div>

    <!-- ── KPI 4 colonne ── -->
    <div class="profile-kpi-grid">
      <div class="profile-kpi-card">
        <div class="profile-kpi-icon" style="background:rgba(20,184,166,0.15); color:var(--teal-3);">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div>
          <b class="profile-kpi-value">${mine.length}</b>
          <span class="profile-kpi-label">Segnalazioni create</span>
          <span class="profile-kpi-sub">${mineThisMonth > 0 ? `+${mineThisMonth} questo mese` : "Nessuna questo mese"}</span>
        </div>
      </div>
      <div class="profile-kpi-card">
        <div class="profile-kpi-icon" style="background:rgba(244,63,94,0.15); color:#fb7185;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <div>
          <b class="profile-kpi-value">${likesReceived}</b>
          <span class="profile-kpi-label">Like ricevuti</span>
          <span class="profile-kpi-sub">${likesThisMonth > 0 ? `+${likesThisMonth} questo mese` : "Nessuno questo mese"}</span>
        </div>
      </div>
      <div class="profile-kpi-card">
        <div class="profile-kpi-icon" style="background:rgba(16,185,129,0.15); color:#34d399;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <b class="profile-kpi-value">${resolved}</b>
          <span class="profile-kpi-label">Risolte</span>
          <span class="profile-kpi-sub">${mine.length ? Math.round((resolved / mine.length) * 100) : 0}% del totale</span>
        </div>
      </div>
      <div class="profile-kpi-card">
        <div class="profile-kpi-icon" style="background:rgba(139,92,246,0.15); color:#c4b5fd;">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 15 9l7 .5-5.5 4.5L18 21l-6-3.8L6 21l1.5-7L2 9.5 9 9z"/></svg>
        </div>
        <div>
          <b class="profile-kpi-value">${reputation.toLocaleString("it")}</b>
          <span class="profile-kpi-label">Reputazione</span>
          <span class="profile-kpi-sub">Livello ${level}</span>
        </div>
      </div>
    </div>

    <!-- ── Layout a 2 colonne: contenuto principale + sidebar ── -->
    <div class="profile-layout">

      <!-- Colonna principale -->
      <div class="profile-main">

        <!-- Sezioni come card cliccabili (coerenti con le statistiche sopra) -->
        <div class="profile-section-cards">
          <button class="profile-section-card is-active" data-tab="segnalazioni">
            <div class="profile-section-icon" style="background:rgba(20,184,166,0.15); color:var(--teal-3);">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <div class="profile-section-text">
              <strong>Le mie segnalazioni</strong>
              <span>${mine.length} pubblicate</span>
            </div>
          </button>
          <button class="profile-section-card" data-tab="attivita">
            <div class="profile-section-icon" style="background:rgba(59,130,246,0.15); color:#93c5fd;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="profile-section-text">
              <strong>Attività recenti</strong>
              <span>Cosa hai fatto di recente</span>
            </div>
          </button>
          <button class="profile-section-card" data-tab="badge">
            <div class="profile-section-icon" style="background:rgba(245,158,11,0.15); color:#fbbf24;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="profile-section-text">
              <strong>Badge e risultati</strong>
              <span>${badges.length} ottenuti</span>
            </div>
          </button>
          <button class="profile-section-card profile-section-card--link" data-route="profile/edit">
            <div class="profile-section-icon" style="background:rgba(139,92,246,0.15); color:#c4b5fd;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <div class="profile-section-text">
              <strong>Modifica profilo</strong>
              <span>Aggiorna i tuoi dati e la tua zona</span>
            </div>
          </button>
        </div>

        <!-- Tab: Le mie segnalazioni -->
        <div class="profile-tab-panel" data-panel="segnalazioni">
          ${mine.length ? mine.map(r => profileReportRowHtml(r)).join("") : emptyHtml("Non hai ancora creato segnalazioni", "Quando ne pubblichi una, la trovi qui.")}
          ${mine.length ? `<button class="btn btn-soft profile-see-all" type="button" data-route="dashboard">
            <span>Vedi tutte le mie segnalazioni</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>` : ""}
        </div>

        <!-- Tab: Attività recenti -->
        <div class="profile-tab-panel" data-panel="attivita" style="display:none;">
          ${recentActivity.length ? recentActivity.map(a => `
            <div class="profile-activity-row">
              <span class="profile-activity-icon">${a.icon}</span>
              <div class="profile-activity-body">
                <p>${a.text}</p>
                <span class="profile-activity-when">${a.when}</span>
              </div>
              <svg class="profile-activity-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          `).join("") : emptyHtml("Nessuna attività recente", "Le tue azioni compariranno qui.")}
        </div>

        <!-- Tab: Badge -->
        <div class="profile-tab-panel" data-panel="badge" style="display:none;">
          ${badges.length ? `
            <div class="profile-badge-grid">
              ${badges.map(b => `
                <div class="profile-badge-item">
                  <div class="profile-badge-icon" style="background: ${b.color}22; border-color: ${b.color}44;">${b.icon}</div>
                  <span>${escapeHtml(b.name)}</span>
                </div>
              `).join("")}
            </div>
          ` : emptyHtml("Nessun badge ancora", "Partecipa attivamente per sbloccare i tuoi primi badge.")}
        </div>

      </div>

      <!-- Sidebar destra (solo desktop) -->
      <aside class="profile-sidebar">

        <!-- Completamento profilo -->
        <div class="panel panel-pad profile-completion-card">
          <h3 class="panel-title">Completamento profilo</h3>
          <div style="height:14px"></div>
          <div class="profile-donut-wrap">
            <svg class="profile-donut" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
              <circle cx="40" cy="40" r="30" fill="none" stroke="var(--teal-2)" stroke-width="8"
                stroke-dasharray="${Math.round(completionPct * 1.885)} 188.5"
                stroke-dashoffset="47.1"
                stroke-linecap="round"/>
              <text x="40" y="44" text-anchor="middle" fill="var(--text)" font-size="14" font-weight="900" font-family="-apple-system,sans-serif">${completionPct}%</text>
            </svg>
            <div class="profile-donut-info">
              <strong>Ottimo lavoro!</strong>
              <p>Completa il tuo profilo per sbloccare nuovi badge e funzionalità.</p>
            </div>
          </div>
          <div style="height:12px"></div>
          <div class="profile-checklist">
            ${[
              ["Email verificata", true],
              ["Posizione impostata", Boolean(p.comune)],
              ["Aggiungi una bio", Boolean(p.bio)],
              ["Foto profilo", Boolean(p.avatar_url)]
            ].map(([label, done]) => `
              <div class="profile-check-item ${done ? "done" : ""}">
                <span class="profile-check-icon">${done ? "✓" : "○"}</span>
                <span>${label}</span>
              </div>
            `).join("")}
          </div>
          <div style="height:12px"></div>
          <button class="btn btn-soft" style="width:100%; font-size:0.84rem;" data-route="profile/edit">Completa profilo →</button>
        </div>

        <!-- Badge ottenuti -->
        <div class="panel panel-pad">
          <h3 class="panel-title">Badge e risultati</h3>
          <div style="height:12px"></div>
          ${badges.length ? `
            <div class="profile-badge-row">
              ${badges.slice(0, 4).map(b => `
                <div class="profile-badge-mini" title="${escapeAttr(b.name)}" style="background:${b.color}22; border-color:${b.color}44;">${b.icon}</div>
              `).join("")}
              ${badges.length > 4 ? `<div class="profile-badge-mini" style="background:var(--glass-light);">+${badges.length - 4}</div>` : ""}
            </div>
          ` : `<p style="color:var(--text-3); font-size:0.85rem;">Nessun badge ancora. Continua a contribuire!</p>`}
        </div>

        <!-- Attività recente -->
        <div class="panel panel-pad">
          <h3 class="panel-title">Attività recente</h3>
          <div style="height:12px"></div>
          ${recentActivity.length ? recentActivity.map(a => `
            <div class="profile-activity-mini">
              <span>${a.icon}</span>
              <p>${a.text}</p>
            </div>
          `).join("") : `<p style="color:var(--text-3); font-size:0.85rem;">Nessuna attività recente.</p>`}
        </div>
      </aside>
    </div>

    <!-- ── Sezione mobile: traguardi ── -->
    <div class="profile-achievements-mobile panel panel-pad">
      <div class="profile-achievements-header">
        <h3 class="panel-title">Livello e reputazione</h3>
      </div>
      <div style="height:12px"></div>
      <div class="profile-achievement-item">
        <div class="profile-achievement-icon" style="background:rgba(139,92,246,0.2); color:#c4b5fd;">🏆</div>
        <div class="profile-achievement-body">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong>${reputation.toLocaleString("it")} punti</strong>
            <span class="chip chip-primary" style="font-size:0.7rem;">Livello ${level}</span>
          </div>
          <div class="profile-progress-bar-wrap">
            <div class="profile-progress-bar" style="width: ${levelPct}%"></div>
          </div>
          <span style="font-size:0.75rem; color:var(--text-3);">${pointsIntoLevel.toLocaleString("it")} / ${LEVEL_STEP.toLocaleString("it")} punti · mancano ${pointsToNext.toLocaleString("it")} al livello ${level + 1}</span>
        </div>
      </div>
    </div>

    <!-- ── Logout mobile (visibile solo su iPhone/Android, niente sidebar) ── -->
    <div class="profile-logout-wrap">
      <button class="btn btn-ghost mobile-logout-btn" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Esci da CivicVois
      </button>
    </div>
  `;
}

function profileEditHtml() {
  if (!state.profile) return profileLoadingInlineHtml();
  const p = state.profile;
  return `
    <div class="topbar profile-edit-topbar">
      <div>
        <button class="btn btn-dark btn-small profile-edit-back" type="button" id="profile-edit-back">← Profilo</button>
        <h1>Modifica profilo</h1>
        <p>Aggiorna identità, foto e zona di riferimento del tuo account CivicVois.</p>
      </div>
    </div>

    <section class="panel panel-pad profile-edit-page">
      <div class="profile-edit-head">
        ${avatarHtml(p, "profile-edit-avatar")}
        <div>
          <h2>Dati personali</h2>
          <p>Le informazioni pubbliche aiutano gli altri cittadini a riconoscere le tue segnalazioni.</p>
        </div>
      </div>

      <form id="profile-form" class="form-grid profile-edit-form">
        <div class="field">
          <label>Nome completo</label>
          <input class="input" name="full_name" value="${escapeAttr(p.full_name || "")}" autocomplete="name" required />
        </div>
        <div class="field">
          <label>Username</label>
          <input class="input" name="username" value="${escapeAttr(p.username || "")}" autocomplete="username" required minlength="3" />
        </div>
        <div class="field span-2">
          <label>Bio</label>
          <textarea class="textarea" name="bio" maxlength="500" placeholder="Racconta brevemente chi sei.">${escapeHtml(p.bio || "")}</textarea>
        </div>
        ${locationFieldsHtml(p, { required: false })}
        <div class="field span-2">
          <label>Foto profilo</label>
          ${avatarUploadHtml(p, "profile")}
        </div>
        <div class="span-2 profile-form-actions">
          <button class="btn btn-soft" type="button" id="profile-edit-cancel">Annulla</button>
          <button class="btn btn-primary" type="submit">Salva profilo</button>
        </div>
      </form>
    </section>

    <section class="panel panel-pad profile-edit-actions">
      <div class="danger-zone danger-zone--soft">
        <div>
          <strong>Esporta i miei dati</strong>
          <span>Scarica una copia dei tuoi dati personali in formato JSON.</span>
        </div>
        <button class="btn btn-soft export-data-btn" type="button">Esporta dati</button>
      </div>

      <div class="profile-legal-links">
        <a href="https://civicvois.it/legal/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>
        <a href="https://civicvois.it/legal/termini.html" target="_blank" rel="noopener">Termini</a>
        <a href="https://civicvois.it/legal/contenuti.html" target="_blank" rel="noopener">Regole contenuti</a>
        <a href="https://civicvois.it/legal/supporto.html" target="_blank" rel="noopener">Supporto</a>
      </div>

      <div class="danger-zone">
        <div>
          <strong>Elimina account</strong>
          <span>Rimuove definitivamente il tuo profilo, le tue segnalazioni e i tuoi like. Non è reversibile.</span>
        </div>
        <button class="btn btn-danger delete-account-btn" type="button">Elimina account</button>
      </div>
    </section>
  `;
}

// Riga segnalazione compatta per il profilo (desktop)
function profileReportRowHtml(report) {
  const liked = state.likes.has(report.id);
  const likeCount = Number(report.like_count || 0);
  return `
    <div class="profile-report-row" data-report-id="${report.id}">
      <div class="profile-report-thumb">
        ${report.photo_url
          ? `<img src="${escapeAttr(report.photo_url)}" alt="" loading="lazy" />`
          : `<div class="profile-report-thumb-placeholder">${categoryIcon(report.tipo)}</div>`}
      </div>
      <div class="profile-report-body">
        <div class="profile-report-top">
          ${statusChip(report.stato)}
          <span class="profile-report-priority chip ${report.priorita === "urgente" ? "chip-danger" : report.priorita === "alta" ? "chip-warning" : "chip-primary"}">Priorità ${capitalize(report.priorita || "bassa")}</span>
        </div>
        <h3 class="profile-report-title">${escapeHtml(report.titolo || capitalize(report.tipo || "Segnalazione"))}</h3>
        <div class="profile-report-meta">
          <span>📍 ${escapeHtml(formatAddress(report))}</span>
          <span>🕒 ${escapeHtml(formatDate(report.created_at))}</span>
          <span>❤️ ${likeCount}</span>
        </div>
        ${report.descrizione ? `<p class="profile-report-desc">${escapeHtml(report.descrizione)}</p>` : ""}
      </div>
      <div class="profile-report-actions">
        <button class="icon-btn open-detail" data-id="${report.id}" title="Dettagli">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="icon-btn" id="edit-profile-btn-row-${report.id}" title="Modifica">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn" title="Altro">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function adminHtml() {
  const isAdmin = state.profile?.role === "admin";
  if (!isAdmin) {
    return `
      <div class="topbar"><div><h1>Area admin</h1><p>Accesso riservato agli amministratori.</p></div></div>
      <section class="panel panel-pad">${emptyHtml("Non sei amministratore", "Il primo account registrato diventa admin automaticamente.")}</section>
    `;
  }

  const stats = getStats();

  return `
    <div class="topbar">
      <div>
        <h1>Area admin</h1>
        <p>Gestisci le segnalazioni senza tabelle scomode o scroll orizzontali.</p>
      </div>
      <button class="btn btn-primary" data-route="new">+ Nuova</button>
    </div>

    <section class="stats-grid stats-grid--dashboard admin-stats" aria-label="Statistiche amministratore">
      <div class="kpi-card"><b>${stats.total}</b><span>Totali</span></div>
      <div class="kpi-card"><b>${stats.open}</b><span>Aperte</span></div>
      <div class="kpi-card"><b>${stats.inProgress}</b><span>In carico</span></div>
      <div class="kpi-card"><b>${stats.resolved}</b><span>Risolte</span></div>
    </section>

    <!-- Contenuti segnalati dagli utenti -->
    <section class="panel panel-pad" style="margin-bottom:16px;">
      <h2 class="panel-title">Contenuti segnalati <span id="mod-count" class="chip chip-danger" style="display:none;"></span></h2>
      <p class="panel-subtitle">Segnalazioni di moderazione inviate dagli utenti. Verificale e rimuovi i contenuti in violazione.</p>
      <div style="height:12px"></div>
      <div id="moderation-list">${emptyHtml("Caricamento…", "")}</div>
    </section>

    <section class="admin-list" aria-label="Elenco segnalazioni admin">
      ${state.reports.length ? state.reports.map(adminCardHtml).join("") : emptyHtml("Nessuna segnalazione", "Quando gli utenti pubblicano segnalazioni, le trovi qui.")}
    </section>
  `;
}

async function loadModerationList() {
  const box = $("#moderation-list");
  if (!box || typeof backend.fetchModerationReports !== "function") return;
  try {
    const reports = await backend.fetchModerationReports();
    const countChip = $("#mod-count");
    if (countChip) {
      if (reports.length) { countChip.textContent = reports.length; countChip.style.display = "inline-block"; }
      else countChip.style.display = "none";
    }
    if (!reports.length) {
      box.innerHTML = emptyHtml("Nessun contenuto segnalato", "Quando un utente segnala una segnalazione, comparirà qui.");
      return;
    }
    box.innerHTML = reports.map(m => {
      const rep = state.reports.find(r => String(r.id) === String(m.target_id));
      const title = rep ? escapeHtml(rep.titolo || rep.tipo || "Segnalazione") : "Segnalazione non più disponibile";
      return `
        <div class="mod-item" data-mod-id="${escapeAttr(m.id)}" data-target="${escapeAttr(m.target_id)}">
          <div class="mod-item-body">
            <strong>${title}</strong>
            <span>Segnalato il ${escapeHtml(formatDate(m.created_at))}${m.reason ? " · " + escapeHtml(m.reason) : ""}</span>
          </div>
          <div class="mod-item-actions">
            ${rep ? `<button class="btn btn-small btn-danger mod-remove" data-target="${escapeAttr(m.target_id)}" data-mod-id="${escapeAttr(m.id)}">Rimuovi contenuto</button>` : ""}
            <button class="btn btn-small btn-soft mod-dismiss" data-mod-id="${escapeAttr(m.id)}">Ignora</button>
          </div>
        </div>`;
    }).join("");
    bindModerationActions();
  } catch (error) {
    box.innerHTML = emptyHtml("Impossibile caricare", "Riprova più tardi.");
  }
}

function bindModerationActions() {
  $$(".mod-remove").forEach(btn => btn.addEventListener("click", async () => {
    const targetId = btn.dataset.target, modId = btn.dataset.modId;
    const ok = await confirmSheet({ title: "Rimuovere il contenuto?", message: "La segnalazione verrà eliminata per tutti gli utenti.", confirmLabel: "Rimuovi", danger: true });
    if (!ok) return;
    try {
      await backend.deleteReport(targetId);
      await backend.resolveModerationReport(modId);
      toast("Contenuto rimosso.", "success");
      await refreshData(); render();
    } catch (e) { toast(e.message || "Errore.", "error"); }
  }));
  $$(".mod-dismiss").forEach(btn => btn.addEventListener("click", async () => {
    try { await backend.resolveModerationReport(btn.dataset.modId); loadModerationList(); }
    catch (e) { toast(e.message || "Errore.", "error"); }
  }));
}

function adminCardHtml(r) {
  return `
    <article class="admin-card">
      <div class="admin-card-main">
        <div class="admin-card-icon">${categoryIcon(r.tipo)}</div>
        <div class="admin-card-copy">
          <div class="admin-card-label">${escapeHtml(capitalize(r.tipo || "Segnalazione"))}</div>
          <h2>${escapeHtml(r.titolo || r.tipo || "Segnalazione")}</h2>
          <div class="admin-card-meta">
            <span>📍 ${escapeHtml([r.comune, r.provincia, r.regione].filter(Boolean).join(" · ") || "—")}</span>
            <span>👤 ${escapeHtml(authorName(r))}</span>
            <span>🕒 ${escapeHtml(formatDate(r.created_at))}</span>
            <span>❤️ ${Number(r.like_count || 0)}</span>
          </div>
        </div>
      </div>
      <div class="admin-card-controls">
        <label class="admin-status-wrap">
          <span>Priorità</span>
          <select class="select admin-priority" data-id="${r.id}">
            ${PRIORITIES.map(p => `<option value="${p}" ${r.priorita === p ? "selected" : ""}>${capitalize(p)}</option>`).join("")}
          </select>
        </label>
        <label class="admin-status-wrap">
          <span>Stato</span>
          <select class="select admin-status" data-id="${r.id}">
            ${STATUSES.map(s => `<option value="${s}" ${r.stato === s ? "selected" : ""}>${capitalize(s)}</option>`).join("")}
          </select>
        </label>
        <button class="btn btn-danger btn-small delete-report" data-id="${r.id}">Elimina</button>
      </div>
    </article>
  `;
}

// ─── Bind eventi app ──────────────────────────────────────────────────────────

function bindAppEvents(active) {
  // I pulsanti "Esci" ed "Elimina account" compaiono in più schermate (profilo,
  // modifica profilo): leghiamo TUTTE le istanze presenti, non solo la prima.
  // Con querySelector (un solo elemento) i pulsanti oltre il primo — es. "Esci
  // da CivicVois" nella pagina profilo — restavano senza handler e non funzionavano.
  document.querySelectorAll("#logout-btn, .mobile-logout-btn").forEach((b) => b.addEventListener("click", handleLogout));
  document.querySelectorAll(".delete-account-btn").forEach((b) => b.addEventListener("click", handleDeleteAccount));

  // Global search header
  $("#global-search")?.addEventListener("input", (e) => {
    state.filters.q = e.target.value;
    const fq = $("#filter-q");
    if (fq) fq.value = e.target.value;
    const feed = $("#report-feed");
    if (feed) {
      const list = filteredReports();
      feed.innerHTML = list.length
        ? list.map(reportCardHtml).join("")
        : emptyHtml("Nessuna segnalazione trovata", "Prova a rimuovere qualche filtro.");
      bindReportActions();
      refreshMapMarkers();
    }
  });

  if (active === "dashboard") {
    bindFilters();
    bindReportActions();
    bindPagination();
  }

  if (active === "new") {
    bindNewReportForm();
  }

  if (active === "profile") {
    bindProfileRecoveryActions();
    bindProfileTabs();
    bindReportActions();

    // Pulsanti "Modifica profilo" aprono la pagina dedicata.
    ["#edit-profile-btn", "#edit-profile-btn-2", "#edit-profile-btn-3"].forEach(sel => {
      $(sel)?.addEventListener("click", () => setRoute("profile/edit"));
    });
  }

  if (active === "profile-edit") {
    bindProfileRecoveryActions();
    const form = $("#profile-form");
    bindLocationControls(form);
    bindAvatarUpload(form);
    bindProfileForm();
    $("#profile-edit-back")?.addEventListener("click", () => setRoute("profile"));
    $("#profile-edit-cancel")?.addEventListener("click", () => setRoute("profile"));
    // (il binding di .delete-account-btn è ora globale in cima a bindAppEvents)
    document.querySelector(".export-data-btn")?.addEventListener("click", handleExportData);
  }

  if (active === "admin") {
    bindAdminActions();
    loadModerationList();
  }
}

async function handleExportData() {
  if (!state.user) return;
  try {
    toast("Preparo i tuoi dati…", "info");
    const reports = await (backend.fetchUserReports ? backend.fetchUserReports(state.user.id).catch(() => []) : Promise.resolve([]));
    const payload = {
      esportato_il: new Date().toISOString(),
      servizio: "CivicVois",
      utente: {
        id: state.user.id,
        email: state.user.email,
        profilo: state.profile || null
      },
      le_mie_segnalazioni: reports,
      i_miei_like: [...(state.likes || [])]
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "civicvois-i-miei-dati.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Dati esportati con successo.", "success");
  } catch (error) {
    console.error(error);
    toast("Esportazione non riuscita. Riprova.", "error");
  }
}

// Overlay bloccante mostrato DURANTE l'eliminazione account: spiega all'utente
// che l'operazione è in corso e di non chiudere l'app, e — coprendo tutto lo
// schermo — impedisce click multipli. Self-contained (niente modifiche al CSS).
function showAccountDeletingOverlay() {
  if (document.getElementById("cv-deleting-overlay")) return;
  if (!document.getElementById("cv-spin-kf")) {
    const st = document.createElement("style");
    st.id = "cv-spin-kf";
    st.textContent = "@keyframes cv-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(st);
  }
  const el = document.createElement("div");
  el.id = "cv-deleting-overlay";
  el.setAttribute("role", "alert");
  el.setAttribute("aria-busy", "true");
  el.style.cssText = "position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(2,6,17,0.93);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:28px;text-align:center;";
  el.innerHTML =
    '<div style="width:44px;height:44px;border:4px solid rgba(45,212,191,0.25);border-top-color:#2dd4bf;border-radius:50%;animation:cv-spin 0.9s linear infinite;"></div>' +
    '<div style="color:#e6f7f4;font-weight:800;font-size:1.05rem;">Eliminazione account in corso…</div>' +
    '<div style="color:#9fb3bd;font-size:0.92rem;line-height:1.45;max-width:300px;">Stiamo eliminando il tuo profilo e i tuoi dati. <b style="color:#e6f7f4;">Non chiudere l\'app</b> finché non termina.</div>';
  (document.body || document.documentElement).appendChild(el);
}

function hideAccountDeletingOverlay() {
  document.getElementById("cv-deleting-overlay")?.remove();
}

let accountDeletionInProgress = false;
async function handleDeleteAccount() {
  if (accountDeletionInProgress) return; // protezione contro click multipli
  if (!hasRealAuthSession()) {
    toast("Sessione account non ancora pronta. Attendi il recupero del profilo reale e riprova.", "error");
    ensureProfileLoaded();
    return;
  }

  const ok = await confirmSheet({
    title: "Eliminare l'account?",
    message: "Verranno rimossi definitivamente il tuo profilo, tutte le tue segnalazioni e i tuoi like. L'azione non è reversibile.",
    confirmLabel: "Elimina account",
    danger: true
  });
  if (!ok) return;

  accountDeletionInProgress = true;
  const trigger = document.querySelector(".delete-account-btn");
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = "Eliminazione...";
  }
  // Disabilita anche logout/altri pulsanti elimina presenti e mostra l'overlay.
  document.querySelectorAll(".delete-account-btn, .mobile-logout-btn, #logout-btn").forEach(b => { b.disabled = true; });
  showAccountDeletingOverlay();

  const deletedUserId = state.user?.id;
  try {
    await backend.deleteAccount();
    clearCachedProfile(deletedUserId); // l'account non esiste più: niente cache stale
    clearAuthLocalHints();
    clearStoredSupabaseSession();
    clearAuthState();
    toast("Account eliminato. Arrivederci!", "success");
    setRoute("landing");
  } catch (error) {
    console.error(error);
    toast(accountDeleteErrorMessage(error), "error");
    // Su errore riabilita i controlli così l'utente può riprovare.
    document.querySelectorAll(".delete-account-btn, .mobile-logout-btn, #logout-btn").forEach(b => { b.disabled = false; });
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.textContent = "Elimina account";
    }
  } finally {
    accountDeletionInProgress = false;
    hideAccountDeletingOverlay();
  }
}

function accountDeleteErrorMessage(error) {
  const raw = String(error?.message || error?.error_description || error || "").trim();
  const message = raw.toLowerCase();
  if (message.includes("delete_my_account") || (message.includes("function") && message.includes("rpc"))) {
    return "Eliminazione account non configurata sul database: applica supabase/02_moderation_delete.sql su Supabase e riprova.";
  }
  if (message.includes("permission denied") || message.includes("42501")) {
    return "Eliminazione account non autorizzata dal database: controlla il grant della funzione delete_my_account.";
  }
  if (message.includes("direct deletion from storage tables") || message.includes("use the storage api")) {
    return "La funzione database di eliminazione account va aggiornata: applica supabase/05_fix_delete_account_storage.sql su Supabase e riprova.";
  }
  if (message.includes("jwt") || message.includes("session") || message.includes("auth") || message.includes("non autenticato")) {
    return "Sessione scaduta. Accedi di nuovo e riprova a eliminare l'account.";
  }
  return niceBackendError(error, "Eliminazione non riuscita. Riprova.");
}

// Precompila i filtri territoriali con regione/provincia/comune del profilo,
// una sola volta (poi l'utente è libero di cambiarli o azzerarli).
function initDashboardFilters() {
  if (state.filtersInitialized || !state.profile) return;
  // Se l'anagrafica territoriale non è ancora caricata, riprova al prossimo render
  if (!getRegions().length) return;
  const p = state.profile;
  const reg = cleanLocationName(p.regione || "");
  const prov = cleanLocationName(p.provincia || "");
  const com = cleanLocationName(p.comune || "");
  // Imposta solo i valori effettivamente presenti nell'anagrafica territoriale
  if (reg && findCanonical(getRegions(), reg)) {
    state.filters.regione = findCanonical(getRegions(), reg);
    if (prov && findCanonical(getProvincesForRegion(state.filters.regione), prov)) {
      state.filters.provincia = findCanonical(getProvincesForRegion(state.filters.regione), prov);
      if (com && findCanonical(getComuniForProvince(state.filters.regione, state.filters.provincia), com)) {
        state.filters.comune = findCanonical(getComuniForProvince(state.filters.regione, state.filters.provincia), com);
      }
    }
  }
  state.filtersInitialized = true;
}

// Markup dei 4 filtri (regione -> provincia -> comune -> categoria) a cascata.
function dashboardFiltersHtml() {
  initDashboardFilters();
  const f = state.filters;
  const regions = getRegions();
  const provinces = f.regione ? getProvincesForRegion(f.regione) : [];
  const comuni = (f.regione && f.provincia) ? getComuniForProvince(f.regione, f.provincia) : [];
  const opt = (val, label, selected) => `<option value="${escapeAttr(val)}" ${selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  return `
    <select class="select" id="filter-regione" aria-label="Filtra per regione">
      ${opt("", "Tutte le regioni", !f.regione)}
      ${regions.map(r => opt(r, r, f.regione === r)).join("")}
    </select>
    <select class="select" id="filter-provincia" aria-label="Filtra per provincia" ${f.regione ? "" : "disabled"}>
      ${opt("", f.regione ? "Tutte le province" : "Prima scegli regione", !f.provincia)}
      ${provinces.map(pv => opt(pv, pv, f.provincia === pv)).join("")}
    </select>
    <select class="select" id="filter-comune" aria-label="Filtra per comune" ${f.provincia ? "" : "disabled"}>
      ${opt("", f.provincia ? "Tutti i comuni" : "Prima scegli provincia", !f.comune)}
      ${comuni.map(c => opt(c, c, f.comune === c)).join("")}
    </select>
    <select class="select" id="filter-tipo" aria-label="Filtra per categoria">
      ${opt("", "Tutte le categorie", !f.tipo)}
      ${CATEGORIES.map(v => opt(v, capitalize(v), f.tipo === v)).join("")}
    </select>`;
}

function bindFilters() {
  const refreshFeed = () => {
    const feed = $("#report-feed");
    if (!feed) return;
    const list = filteredReports();
    feed.innerHTML = list.length
      ? list.map(reportCardHtml).join("")
      : emptyHtml("Nessuna segnalazione trovata", "Prova a cambiare i filtri o crea una nuova segnalazione.");
    bindReportActions();
    refreshMapMarkers();
  };

  // Rigenera il blocco filtri (per aggiornare le opzioni a cascata) e riaggancia gli eventi
  const rerenderFilters = () => {
    const grid = $(".dash-filters .filters-grid");
    if (grid) {
      grid.innerHTML = dashboardFiltersHtml();
      attachFilterEvents();
    }
  };

  function attachFilterEvents() {
    $("#filter-regione")?.addEventListener("change", (e) => {
      state.filters.regione = e.target.value;
      state.filters.provincia = "";
      state.filters.comune = "";
      rerenderFilters();
      refreshFeed();
    });
    $("#filter-provincia")?.addEventListener("change", (e) => {
      state.filters.provincia = e.target.value;
      state.filters.comune = "";
      rerenderFilters();
      refreshFeed();
    });
    $("#filter-comune")?.addEventListener("change", (e) => {
      state.filters.comune = e.target.value;
      refreshFeed();
    });
    $("#filter-tipo")?.addEventListener("change", (e) => {
      state.filters.tipo = e.target.value;
      refreshFeed();
    });
  }

  attachFilterEvents();
}

function bindPagination() {
  $("#page-prev")?.addEventListener("click", async () => {
    if (state.page <= 0) return;
    state.page -= 1;
    await loadReports();
    render();
  });
  $("#page-next")?.addEventListener("click", async () => {
    const totalPages = Math.ceil(state.totalReports / PAGE_SIZE);
    if (state.page >= totalPages - 1) return;
    state.page += 1;
    await loadReports();
    render();
  });
}

function bindReportActions() {
  $$(".like-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!state.user) return setRoute("auth");
      await toggleLike(btn.dataset.id);
    });
  });

  $$(".open-detail").forEach(btn => {
    btn.addEventListener("click", () => setRoute("report/" + btn.dataset.id));
  });

  $$(".profile-report-row[data-report-id]").forEach(row => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      setRoute("report/" + row.dataset.reportId);
    });
  });

  $$(".delete-own-report").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ok = await confirmSheet({
        title: "Eliminare la segnalazione?",
        message: "L'azione è definitiva e non può essere annullata.",
        confirmLabel: "Elimina",
        danger: true
      });
      if (!ok) return;
      await deleteReport(btn.dataset.id);
    });
  });
}

// Bottom-sheet di conferma coerente col brand (sostituisce confirm() nativo).
// Ritorna una Promise<boolean>.
function confirmSheet({ title = "Confermi?", message = "", confirmLabel = "Conferma", cancelLabel = "Annulla", danger = false } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-backdrop";
    backdrop.innerHTML = `
      <div class="confirm-sheet" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
        <div class="confirm-grabber"></div>
        <h3 class="confirm-title">${escapeHtml(title)}</h3>
        ${message ? `<p class="confirm-text">${escapeHtml(message)}</p>` : ""}
        <div class="confirm-actions">
          <button class="btn btn-soft confirm-cancel" type="button">${escapeHtml(cancelLabel)}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"} confirm-ok" type="button">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add("is-open"));

    const close = (value) => {
      backdrop.classList.remove("is-open");
      setTimeout(() => backdrop.remove(), 200);
      document.removeEventListener("keydown", onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(false); });
    backdrop.querySelector(".confirm-cancel").addEventListener("click", () => close(false));
    backdrop.querySelector(".confirm-ok").addEventListener("click", () => close(true));
  });
}

// ─── Avatar upload ────────────────────────────────────────────────────────────

function avatarUploadHtml(profile = {}, context = "profile") {
  const src = profile?.avatar_url || "";
  const label = src ? "Sostituisci foto profilo" : "Carica foto profilo";
  return `
    <div class="avatar-upload" data-avatar-upload>
      <div class="avatar-upload-preview" data-avatar-preview>
        ${src ? `<img src="${escapeAttr(src)}" alt="Foto profilo attuale" />` : avatarHtml(profile, "avatar-upload-fallback")}
      </div>
      <label class="upload-box upload-box--avatar">
        <input type="file" name="avatar_file" accept="${IMAGE_ACCEPT}" data-avatar-input />
        <div data-avatar-copy><strong>${label}</strong><br><span style="color: var(--text-2); font-weight: 650;">JPG, PNG o WebP. Max 5 MB.</span></div>
      </label>
      <input type="hidden" name="avatar_url" value="${escapeAttr(src)}" />
      <small class="field-hint">Se non carichi una foto, CivicVois usa le tue iniziali.</small>
    </div>
  `;
}

function bindAvatarUpload(root = document) {
  const input = root?.querySelector?.("[data-avatar-input]");
  if (!input) return;
  input.addEventListener("change", () => previewAvatar(input, root));
}

function previewAvatar(input, root = document) {
  const file = input.files?.[0];
  const preview = root?.querySelector?.("[data-avatar-preview]");
  const copy = root?.querySelector?.("[data-avatar-copy]");
  if (!file || !preview) return;
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${reader.result}" alt="Anteprima foto profilo" />`;
    if (copy) copy.innerHTML = `<strong>Foto selezionata</strong><br><span style="color: var(--text-2); font-weight: 650;">${escapeHtml(file.name)}</span>`;
  };
  reader.readAsDataURL(file);
}

// ─── Location fields ──────────────────────────────────────────────────────────

function locationFieldsHtml(values = {}, options = {}) {
  const required = options.required !== false;
  const regione = cleanLocationName(values.regione || "");
  const provincia = cleanLocationName(values.provincia || "");
  const comune = cleanLocationName(values.comune || "");
  const province = regione ? getProvincesForRegion(regione) : [];
  const comuni = regione && provincia ? getComuniForProvince(regione, provincia) : [];
  return `
    <div class="field">
      <label>Regione</label>
      <select class="select" name="regione" data-location-region ${required ? "required" : ""}>
        ${optionHtml("", "Seleziona regione", regione)}
        ${getRegions().map(r => optionHtml(r, r, regione)).join("")}
      </select>
    </div>
    <div class="field">
      <label>Provincia</label>
      <select class="select" name="provincia" data-location-province ${required ? "required" : ""} ${regione ? "" : "disabled"}>
        ${optionHtml("", regione ? "Seleziona provincia" : "Prima scegli regione", provincia)}
        ${province.map(p => optionHtml(p, p, provincia)).join("")}
      </select>
    </div>
    <div class="field">
      <label>Comune</label>
      <select class="select" name="comune" data-location-comune ${required ? "required" : ""} ${regione && provincia ? "" : "disabled"}>
        ${optionHtml("", provincia ? "Seleziona comune" : "Prima scegli provincia", comune)}
        ${comuni.map(c => optionHtml(c, c, comune)).join("")}
      </select>
      <small class="field-hint">Regione, provincia e comune sono vincolati tra loro per evitare doppioni e refusi.</small>
    </div>`;
}

function bindLocationControls(root = document) {
  if (!root) return;
  const regione = root.querySelector("[data-location-region]");
  const provincia = root.querySelector("[data-location-province]");
  const comune = root.querySelector("[data-location-comune]");
  if (!regione || !provincia || !comune) return;
  const renderProvince = (keep = "") => {
    const selectedRegion = regione.value;
    const list = selectedRegion ? getProvincesForRegion(selectedRegion) : [];
    provincia.disabled = !selectedRegion;
    provincia.innerHTML = `${optionHtml("", selectedRegion ? "Seleziona provincia" : "Prima scegli regione", keep)}${list.map(p => optionHtml(p, p, keep)).join("")}`;
    if (keep && list.includes(keep)) provincia.value = keep;
  };
  const renderComuni = (keep = "") => {
    const selectedRegion = regione.value;
    const selectedProvince = provincia.value;
    const list = selectedRegion && selectedProvince ? getComuniForProvince(selectedRegion, selectedProvince) : [];
    comune.disabled = !(selectedRegion && selectedProvince);
    comune.innerHTML = `${optionHtml("", selectedProvince ? "Seleziona comune" : "Prima scegli provincia", keep)}${list.map(c => optionHtml(c, c, keep)).join("")}`;
    if (keep && list.includes(keep)) comune.value = keep;
  };
  regione.addEventListener("change", () => { renderProvince(); renderComuni(); resetAddressVerification(root); });
  provincia.addEventListener("change", () => { renderComuni(); resetAddressVerification(root); });
  comune.addEventListener("change", () => resetAddressVerification(root));
}

function bindAddressVerification(form) {
  if (!form) return;
  const via = form.querySelector("#via-input");
  const civico = form.querySelector("#civico-input");
  // Qualsiasi modifica ai campi posizione invalida la verifica precedente
  [via, civico].filter(Boolean).forEach(el => el.addEventListener("input", () => resetAddressVerification(form)));
  const runVerify = async () => {
    const result = await verifyAddressFromForm(form);
    toast(result.message, result.ok ? "success" : "error");
  };
  form.querySelector("#verify-address-btn-2")?.addEventListener("click", runVerify);
  form.querySelector("#verify-address-btn")?.addEventListener("click", runVerify);
}

function resetAddressVerification(root = document) {
  const hidden = root.querySelector?.("#address-verified");
  if (hidden) hidden.value = "";
  const box = root.querySelector?.("#nr-verified-address");
  if (box) box.style.display = "none";
}

async function verifyAddressFromForm(form, { silent = false } = {}) {
  const formData = new FormData(form);
  const location = validateLocationSelection(formData);
  const hidden = form.querySelector("#address-verified");
  const box = form.querySelector("#nr-verified-address");
  const text = form.querySelector("#nr-verified-text");
  if (!location.ok) return { ok: false, message: location.message };
  const via = clean(formData.get("via"));
  const civico = clean(formData.get("civico"));
  if (!via) return { ok: false, message: "Inserisci la via prima di verificare l'indirizzo." };
  try {
    const query = [via, civico, location.comune, location.provincia, location.regione, "Italia"].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=it&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json", "Accept-Language": "it" } });
    if (!res.ok) throw new Error("Servizio indirizzi non disponibile.");
    const [place] = await res.json();
    const display = normalizeLocationKey(place?.display_name || "");
    const comuneKey = normalizeLocationKey(location.comune);
    const viaToken = normalizeLocationKey(via).split(" ").filter(Boolean).find(x => x.length > 2) || "";
    // Indirizzo valido solo se Nominatim conferma comune e via coerenti
    const ok = Boolean(place && display.includes(comuneKey) && (!viaToken || display.includes(viaToken)));
    if (!ok) {
      if (hidden) hidden.value = "";
      if (box) box.style.display = "none";
      return { ok: false, message: "Indirizzo non trovato per il comune indicato: controlla via e comune." };
    }
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const coord = form.querySelector("#coordinate-input");
      if (coord) coord.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    if (hidden) hidden.value = "1";
    if (box && text) {
      text.textContent = "Indirizzo verificato: " + (place.display_name || query).split(",").slice(0, 4).join(", ");
      box.style.display = "flex";
    }
    return { ok: true, message: "Indirizzo verificato correttamente.", lat, lng };
  } catch (error) {
    console.warn(error);
    if (hidden) hidden.value = "";
    if (box) box.style.display = "none";
    return { ok: false, message: "Verifica indirizzo non riuscita: riprova tra poco." };
  }
}

function validateLocationSelection(formData, { allowEmpty = false } = {}) {
  const regione = cleanLocationName(formData.get("regione"));
  const provincia = cleanLocationName(formData.get("provincia"));
  const comune = cleanLocationName(formData.get("comune"));
  if (allowEmpty && !regione && !provincia && !comune) return { ok: true, regione: "", provincia: "", comune: "" };
  const canonicalRegion = findCanonical(getRegions(), regione);
  if (!canonicalRegion) return { ok: false, message: "Seleziona una regione valida dall'elenco." };
  const canonicalProvince = findCanonical(getProvincesForRegion(canonicalRegion), provincia);
  if (!canonicalProvince) return { ok: false, message: "Seleziona una provincia valida per la regione scelta." };
  const canonicalComune = findCanonical(getComuniForProvince(canonicalRegion, canonicalProvince), comune);
  if (!canonicalComune) return { ok: false, message: "Seleziona un comune valido per la provincia scelta." };
  return { ok: true, regione: canonicalRegion, provincia: canonicalProvince, comune: canonicalComune };
}

function optionHtml(value, label, selected = "") {
  return `<option value="${escapeAttr(value)}" ${value && value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

// ─── Localizzazione Italia ────────────────────────────────────────────────────

async function loadItalyLocations() {
  for (const source of ITALY_LOCATION_SOURCES) {
    try {
      const res = await fetch(source, { cache: "force-cache" });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length < 1000) continue;
      state.locationData = buildLocationData(data);
      state.locationDataSource = "remote";
      writeLocal("cv_italy_locations_raw", data);
      return true;
    } catch (error) {
      console.warn("Fonte comuni non disponibile", source, error);
    }
  }
  return false;
}

function buildLocationData(rows) {
  const regions = {};
  for (const row of rows || []) {
    const regione = cleanLocationName(row?.regione?.nome || row?.regione || row?.regione_nome);
    const provincia = cleanLocationName(row?.provincia?.nome || row?.provincia || row?.provincia_nome);
    const comune = cleanLocationName(row?.nome || row?.comune || row?.comune_nome);
    const sigla = cleanLocationName(row?.sigla || row?.provincia?.sigla || "");
    if (!regione || !provincia || !comune) continue;
    regions[regione] ||= { provinces: {} };
    regions[regione].provinces[provincia] ||= { sigla, comuni: [] };
    if (!regions[regione].provinces[provincia].comuni.includes(comune)) regions[regione].provinces[provincia].comuni.push(comune);
  }
  for (const region of Object.values(regions)) for (const province of Object.values(region.provinces)) province.comuni.sort((a, b) => a.localeCompare(b));
  return { regions };
}

function getRegions() { return Object.keys(state.locationData?.regions || {}).sort((a, b) => a.localeCompare(b)); }
function getProvincesForRegion(region) {
  const canonical = findCanonical(getRegions(), region);
  if (!canonical) return [];
  return Object.keys(state.locationData.regions[canonical]?.provinces || {}).sort((a, b) => a.localeCompare(b));
}
function getComuniForProvince(region, province) {
  const canonicalRegion = findCanonical(getRegions(), region);
  if (!canonicalRegion) return [];
  const canonicalProvince = findCanonical(getProvincesForRegion(canonicalRegion), province);
  if (!canonicalProvince) return [];
  return [...(state.locationData.regions[canonicalRegion].provinces[canonicalProvince]?.comuni || [])];
}
function findCanonical(list, value) {
  const key = normalizeLocationKey(value);
  return list.find(item => normalizeLocationKey(item) === key) || "";
}
function cleanLocationName(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function normalizeLocationKey(value) {
  return cleanLocationName(value).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['']/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

// ─── Form segnalazione ────────────────────────────────────────────────────────

function bindNewReportForm() {
  const form = $("#report-form");
  if (!form) return;

  // ── Location controls & address verification ──────────────────────────
  bindLocationControls(form);
  bindAddressVerification(form);

  // Also bind the second verify-address button (map tab)
  $("#verify-address-btn-2")?.addEventListener("click", async () => {
    const result = await verifyAddressFromForm(form);
    toast(result.message, result.ok ? "success" : "error");
  });

  // ── Priority buttons ──────────────────────────────────────────────────
  const priorityHidden = $("#nr-priorita");
  $$(".nr-priority-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".nr-priority-btn").forEach(b => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      // I bottoni espongono data-priority (non data-val): leggere il valore giusto (C-05).
      if (priorityHidden) priorityHidden.value = btn.dataset.priority || "media";
    });
  });

  // ── Char counters ─────────────────────────────────────────────────────
  function bindCharCounter(inputId, counterId, max) {
    const input = $("#" + inputId);
    const counter = $("#" + counterId);
    if (!input || !counter) return;
    const update = () => {
      const len = input.value.length;
      counter.textContent = len + "/" + max;
      counter.classList.toggle("is-near",  len >= max * 0.85 && len < max);
      counter.classList.toggle("is-limit", len >= max);
    };
    input.addEventListener("input", update);
    update();
  }
  bindCharCounter("nr-desc", "desc-count", 1000);

  // ── Photo upload & previews ───────────────────────────────────────────
  const photoInput = $("#photo-input");
  const photoPreviews = $("#photo-previews");
  const photoFiles = [];
  // L'input file viene svuotato dopo ogni scelta: espongo la foto scelta sul
  // form così createReport può leggerla (C-04). Il backend salva una sola URL.
  if (form) form._cvPhotos = photoFiles;

  function setSelectedPhoto(file) {
    photoFiles.splice(0, photoFiles.length);
    if (file instanceof File && file.type.startsWith("image/")) {
      photoFiles.push(file);
    }
    refreshPhotoPreviews();
  }

  function refreshPhotoPreviews() {
    if (!photoPreviews) return;
    photoPreviews.innerHTML = "";
    photoFiles.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const item = document.createElement("div");
        item.className = "nr-photo-preview-item";
        item.innerHTML = `
          <img src="${e.target.result}" alt="Foto segnalazione" />
          <button type="button" class="nr-photo-preview-remove" data-idx="${idx}" title="Rimuovi foto">&times;</button>
        `;
        item.querySelector(".nr-photo-preview-remove").addEventListener("click", () => {
          photoFiles.splice(idx, 1);
          refreshPhotoPreviews();
        });
        photoPreviews.appendChild(item);
      };
      reader.readAsDataURL(file);
    });
  }

  // Drag & drop area
  const uploadArea = $(".nr-photo-upload");
  uploadArea?.addEventListener("click", () => photoInput?.click());
  uploadArea?.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.style.borderColor = "var(--accent)"; });
  uploadArea?.addEventListener("dragleave",  () => { uploadArea.style.borderColor = ""; });
  uploadArea?.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = "";
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith("image/"));
    setSelectedPhoto(files[0]);
  });

  photoInput?.addEventListener("change", () => {
    const files = Array.from(photoInput.files || []).filter(f => f.type.startsWith("image/"));
    setSelectedPhoto(files[0]);
    photoInput.value = "";
  });

  // Camera button
  $("#camera-btn")?.addEventListener("click", () => {
    const ci = document.createElement("input");
    ci.type = "file";
    ci.accept = IMAGE_ACCEPT;
    ci.capture = "environment";
    ci.addEventListener("change", () => {
      const files = Array.from(ci.files || []).filter(f => f.type.startsWith("image/"));
      setSelectedPhoto(files[0]);
    });
    ci.click();
  });

  // Gallery button
  $("#gallery-btn")?.addEventListener("click", () => {
    photoInput?.click();
  });

  // (GPS e mappa rimossi: la posizione è solo manuale, con verifica obbligatoria)

  // ── Privacy toggle ────────────────────────────────────────────────────
  $$(".nr-privacy-option").forEach(opt => {
    opt.addEventListener("click", () => {
      $$(".nr-privacy-option").forEach(o => o.classList.remove("is-selected"));
      opt.classList.add("is-selected");
      const anonInput = form.querySelector("[name='anonimo']");
      if (anonInput) anonInput.value = opt.dataset.val || "pubblico";
    });
  });

  // ── Form submit ───────────────────────────────────────────────────────
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await lockSubmit(event.currentTarget, () => createReport(event.currentTarget));
  });
}

// Disabilita i bottoni di submit di un form mentre l'operazione è in corso,
// così un doppio tap non genera invii duplicati. Ripristina alla fine.
async function lockSubmit(form, fn) {
  if (!form) return fn();
  const btns = Array.from(form.querySelectorAll('button[type="submit"], button:not([type])'));
  const snapshot = btns.map(b => ({ b, disabled: b.disabled }));
  btns.forEach(b => { b.disabled = true; b.classList.add("is-loading"); });
  try {
    return await fn();
  } finally {
    snapshot.forEach(({ b, disabled }) => {
      if (document.contains(b)) { b.disabled = disabled; b.classList.remove("is-loading"); }
    });
  }
}

function activateProfileTab(tabName) {
  $$(".profile-section-card").forEach(t => t.classList.toggle("is-active", t.dataset.tab === tabName));
  $$(".profile-tab-panel").forEach(p => {
    p.style.display = p.dataset.panel === tabName ? "block" : "none";
  });
  // Rebind il form impostazioni quando aperto
  if (tabName === "impostazioni") {
    const form = $("#profile-form");
    bindLocationControls(form);
    bindAvatarUpload(form);
    bindProfileForm();
  }
}

function bindProfileTabs() {
  $$(".profile-section-card[data-tab]").forEach(card => {
    card.addEventListener("click", () => activateProfileTab(card.dataset.tab));
  });
}

function bindProfileForm() {
  $("#profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await updateProfile(new FormData(event.currentTarget));
  });
}

function bindAdminActions() {
  $$(".admin-status").forEach(select => {
    select.addEventListener("change", async () => updateReportAdmin(select.dataset.id, { stato: select.value }));
  });

  $$(".admin-priority").forEach(select => {
    select.addEventListener("change", async () => updateReportAdmin(select.dataset.id, { priorita: select.value }));
  });

  $$(".delete-report").forEach(btn => {
    btn.addEventListener("click", async () => {
      const ok = await confirmSheet({
        title: "Eliminare definitivamente?",
        message: "La segnalazione verrà rimossa per tutti gli utenti.",
        confirmLabel: "Elimina",
        danger: true
      });
      if (!ok) return;
      await deleteReport(btn.dataset.id);
    });
  });
}

function bindRouteButtons() {
  $$('[data-route]').forEach(btn => {
    btn.addEventListener("click", () => setRoute(btn.dataset.route));
  });
}

function previewPhoto(input) {
  const file = input.files?.[0];
  const copy = $("#upload-copy");
  if (!file || !copy) return;
  const reader = new FileReader();
  reader.onload = () => {
    copy.innerHTML = `<img src="${reader.result}" alt="Anteprima foto" class="upload-preview" />`;
  };
  reader.readAsDataURL(file);
}

function setLocationFromAddress(address = {}) {
  const regionName = address.state || address.region || "";
  const provinceName = address.county || address.state_district || "";
  const comuneName = address.town || address.city || address.village || address.municipality || "";
  const regionSelect = $("[data-location-region]");
  const provinceSelect = $("[data-location-province]");
  const comuneSelect = $("[data-location-comune]");
  const canonicalRegion = findCanonical(getRegions(), regionName);
  if (!canonicalRegion || !regionSelect) return;
  regionSelect.value = canonicalRegion;
  regionSelect.dispatchEvent(new Event("change"));
  const canonicalProvince = findCanonical(getProvincesForRegion(canonicalRegion), provinceName);
  if (canonicalProvince && provinceSelect) {
    provinceSelect.value = canonicalProvince;
    provinceSelect.dispatchEvent(new Event("change"));
  }
  const canonicalComune = findCanonical(getComuniForProvince(canonicalRegion, canonicalProvince), comuneName);
  if (canonicalComune && comuneSelect) comuneSelect.value = canonicalComune;
}

function setInputValue(selector, value) {
  if (!value) return;
  const el = $(selector);
  if (el && !el.value) el.value = value;
}

// ─── CRUD segnalazioni ────────────────────────────────────────────────────────

async function createReport(form) {
  if (!state.user) return setRoute("auth");

  const formData = form instanceof FormData ? form : new FormData(form);
  const location = validateLocationSelection(formData);
  if (!location.ok) return toast(location.message, "error");

  let coords = parseCoords(String(formData.get("coordinate") || ""));
  // La foto scelta è nell'array esposto sul form (C-04): l'input file è già
  // stato svuotato, quindi formData.get("photo") sarebbe vuoto.
  const formEl = form instanceof FormData ? null : form;
  const selectedPhotos = formEl && Array.isArray(formEl._cvPhotos) ? formEl._cvPhotos : [];
  const photoFile = selectedPhotos[0] || formData.get("photo");

  const tipo = clean(formData.get("tipo"));
  const payload = {
    user_id: state.user.id,
    // Il titolo non si chiede più all'utente: coincide con la categoria scelta.
    titolo: tipo,
    tipo: tipo,
    // Facoltativi. Colonne NOT NULL: salviamo stringa vuota '' (mai null) quando
    // l'utente non li compila. clean() restituisce sempre una stringa.
    descrizione: clean(formData.get("descrizione")),
    priorita: clean(formData.get("priorita")) || "media",
    stato: "nuova",
    regione: location.regione,
    provincia: location.provincia,
    comune: location.comune,
    via: clean(formData.get("via")),
    civico: clean(formData.get("civico")),
    lat: coords?.lat || null,
    lng: coords?.lng || null,
    photo_url: "", // NOT NULL: '' quando non c'è foto (l'UI tratta '' come "senza foto")
    like_count: 0,
    photoFile: photoFile instanceof File && photoFile.size > 0 ? photoFile : null
  };

  // Obbligatori: categoria, posizione (comune) e via. Descrizione, civico e foto
  // sono facoltativi.
  if (!payload.tipo || !payload.comune) {
    return toast("Scegli la categoria e la posizione: sono obbligatorie.", "error");
  }
  if (!payload.via) {
    return toast("Inserisci la via prima di inviare la segnalazione.", "error");
  }
  if (hasProhibitedContent(payload.titolo, payload.descrizione)) {
    return toast("Il testo contiene termini offensivi: modifica la descrizione prima di inviare.", "error");
  }

  // Verifica indirizzo OBBLIGATORIA e bloccante: l'invio è permesso solo con
  // indirizzo confermato da Nominatim. Se non già verificato (o invalidato da
  // una modifica), proviamo a verificarlo ora; se fallisce, blocchiamo.
  if (String(formData.get("address_verified") || "") !== "1") {
    const verified = await verifyAddressFromForm(form);
    if (!verified.ok) {
      return toast(verified.message || "Verifica l'indirizzo prima di inviare la segnalazione.", "error");
    }
    if (verified.lat && verified.lng) {
      payload.lat = verified.lat;
      payload.lng = verified.lng;
    }
  }

  try {
    const created = await backend.createReport(payload);
    state.page = 0;

    // Inserimento ottimistico: l'utente vede subito la sua segnalazione, anche
    // se la lista del server non l'ha ancora propagata (eventual consistency).
    if (created?.id) {
      state.pendingReports = [created, ...state.pendingReports.filter(p => p.id !== created.id)];
      state.reports = [created, ...state.reports.filter(r => r.id !== created.id)];
      state.totalReports = (state.totalReports || 0) + 1;
    }

    setRoute("dashboard");
    // Riallinea col server in background (senza bloccare la UI)
    refreshData().then(render).catch(() => {});
    // Schermata di conferma con recap (FASE 3), al posto del solo toast
    showReportConfirmation(payload);
  } catch (error) {
    console.error(error);
    toast(error.message || "Non sono riuscito a pubblicare la segnalazione.", "error");
  }
}

async function updateProfile(formData) {
  if (!hasRealAuthSession()) {
    toast("Sessione account non ancora pronta. Attendi qualche secondo e riprova.", "error");
    ensureProfileLoaded();
    return;
  }
  const location = validateLocationSelection(formData, { allowEmpty: true });
  if (!location.ok) return toast(location.message, "error");

  const payload = {
    full_name: clean(formData.get("full_name")),
    username: clean(formData.get("username")).toLowerCase(),
    bio: clean(formData.get("bio")),
    regione: location.regione,
    provincia: location.provincia,
    comune: location.comune,
    avatar_url: clean(formData.get("avatar_url")),
    avatarFile: formData.get("avatar_file")
  };

  if (!payload.full_name || !payload.username) return toast("Nome completo e username sono obbligatori.", "error");

  try {
    const shouldReturnToProfile = state.route === "profile/edit";
    const saved = await backend.saveProfile(state.user.id, payload);
    setProfileResolved(saved);
    await refreshData();
    toast("Profilo aggiornato.", "success");
    if (shouldReturnToProfile) setRoute("profile");
    else render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Profilo non aggiornato.", "error");
  }
}

const _likeInFlight = new Set();

async function toggleLike(reportId) {
  if (!state.user) return setRoute("auth");
  if (_likeInFlight.has(reportId)) return; // anti doppio-tap (bug: voti duplicati)
  _likeInFlight.add(reportId);

  const wasLiked = state.likes.has(reportId);
  const willLike = !wasLiked;

  // 1) Aggiornamento OTTIMISTICO: stato + contatori locali subito, niente reload.
  if (willLike) state.likes.add(reportId); else state.likes.delete(reportId);

  const report = state.reports.find(r => r.id === reportId);
  const prevCount = report ? Number(report.like_count || 0) : null;
  const newCount = report ? Math.max(0, prevCount + (willLike ? 1 : -1)) : null;
  if (report) report.like_count = newCount;

  // Allinea anche le statistiche del profilo, se già caricate
  if (state.myStats?.reports) {
    const mr = state.myStats.reports.find(r => r.id === reportId);
    if (mr) mr.like_count = Math.max(0, Number(mr.like_count || 0) + (willLike ? 1 : -1));
  }

  // 2) Riflette subito su DOM (card nel feed + drawer aperto) senza full render
  applyLikeToDOM(reportId, willLike, newCount);

  // 3) Sincronizza col backend; in caso di errore fa rollback
  try {
    await backend.toggleLike(state.user.id, reportId, wasLiked);
  } catch (error) {
    console.error(error);
    if (willLike) state.likes.delete(reportId); else state.likes.add(reportId);
    if (report && prevCount !== null) report.like_count = prevCount;
    applyLikeToDOM(reportId, wasLiked, prevCount);
    toast(error.message || "Like non aggiornato.", "error");
  } finally {
    _likeInFlight.delete(reportId);
  }
}

// Aggiorna in-place tutti gli elementi "like" di una segnalazione, ovunque siano
// nel DOM (card del feed e pannello di dettaglio), senza ricostruire la pagina.
function applyLikeToDOM(reportId, liked, count) {
  const sel = (window.CSS && CSS.escape) ? CSS.escape(reportId) : reportId;
  document.querySelectorAll(`.like-btn[data-id="${sel}"]`).forEach((btn) => {
    const isDrawer = !!btn.closest(".drawer");
    btn.classList.toggle("is-liked", liked);
    const label = liked ? (isDrawer ? "❤️ Ti piace" : "❤️ Votata") : "🤍 Vota";
    const shown = count == null ? (btn.querySelector(".btn-like-count")?.textContent ?? "") : count;
    btn.innerHTML = `${label} <span class="btn-like-count">${shown}</span>`;
    const container = btn.closest(".report-card, .drawer");
    const chip = container?.querySelector(".like-count-chip b");
    if (chip && count != null) chip.textContent = String(count);
  });
  if (count != null) {
    const cardChip = document.querySelector(`.report-card[data-report-id="${sel}"] .like-count-chip b`);
    if (cardChip) cardChip.textContent = String(count);
  }
}

async function updateReportAdmin(id, patch) {
  try {
    await backend.updateReportAdmin(id, patch);
    await refreshData();
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Segnalazione non aggiornata.", "error");
  }
}

async function deleteReport(id) {
  try {
    await backend.deleteReport(id);
    await refreshData();
    toast("Segnalazione eliminata.", "success");
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Eliminazione non riuscita.", "error");
  }
}

// ─── Drawer dettaglio ─────────────────────────────────────────────────────────

// ─── Dettaglio segnalazione come PAGINA (link condivisibile, FASE 3) ──────────
function renderReportDetail() {
  const id = state.reportId;
  const cached = state.reports.find(r => String(r.id) === String(id));
  if (cached) return paintReportDetail(cached);
  // Non in cache (es. link aperto direttamente): loading + fetch per id
  app.innerHTML = `
    <div class="page report-detail-page">
      <header class="site-header"><div class="header-inner">${brandHtml()}<div class="header-actions"><button class="btn btn-ghost" data-route="${state.user ? "dashboard" : "landing"}">${state.user ? "Dashboard" : "Home"}</button></div></div></header>
      <main style="max-width:760px;margin:0 auto;padding:24px 16px;"><div class="empty-state"><strong>Caricamento segnalazione…</strong></div></main>
    </div>`;
  bindRouteButtons();
  Promise.resolve(backend.fetchReportById?.(id)).then(report => {
    if (state.route !== "report" || String(state.reportId) !== String(id)) return; // route cambiata nel frattempo
    if (report) {
      state.reports = [report, ...state.reports.filter(r => String(r.id) !== String(report.id))];
      paintReportDetail(report);
    } else {
      paintReportNotFound();
    }
  }).catch(() => paintReportNotFound());
}

function paintReportNotFound() {
  app.innerHTML = `
    <div class="page report-detail-page">
      <header class="site-header"><div class="header-inner">${brandHtml()}<div class="header-actions"><button class="btn btn-primary" data-route="${state.user ? "dashboard" : "landing"}">${state.user ? "Dashboard" : "Home"}</button></div></div></header>
      <main style="max-width:760px;margin:0 auto;padding:24px 16px;">${emptyHtml("Segnalazione non trovata", "Potrebbe essere stata rimossa, oppure il link non è valido.")}</main>
    </div>`;
  bindRouteButtons();
}

function paintReportDetail(report) {
  const liked = state.likes.has(report.id);
  app.innerHTML = `
    <div class="page report-detail-page">
      <header class="site-header">
        <div class="header-inner">
          ${brandHtml()}
          <div class="header-actions">
            <button class="btn btn-ghost" id="rd-back">← Indietro</button>
            <button class="btn btn-soft" id="rd-share">Copia link</button>
          </div>
        </div>
      </header>
      <main style="max-width:760px;margin:0 auto;padding:18px 16px 60px;">
        <article class="panel panel-pad">
          <div class="drawer-hero" style="border-radius:var(--r-lg);overflow:hidden;margin-bottom:14px;">
            ${report.photo_url ? `<img src="${escapeAttr(report.photo_url)}" alt="${escapeAttr(report.titolo || report.tipo)}" style="width:100%;display:block;" />` : `<div class="report-placeholder">${categoryIcon(report.tipo)}</div>`}
          </div>
          <div class="report-meta">${statusChip(report.stato)} ${priorityChip(report.priorita)}</div>
          <h1 class="dash-title" style="font-size:1.6rem;margin:10px 0;">${escapeHtml(report.titolo || report.tipo)}</h1>
          ${report.descrizione ? `<p class="report-desc">${escapeHtml(report.descrizione)}</p>` : ""}
          <div style="height:12px"></div>
          <div class="detail-grid">
            <div class="detail-box"><b>Categoria</b><span>${escapeHtml(capitalize(report.tipo || "—"))}</span></div>
            <div class="detail-box"><b>Priorità</b><span>${escapeHtml(capitalize(report.priorita || "—"))}</span></div>
            <div class="detail-box"><b>Comune</b><span>${escapeHtml(report.comune || "—")}</span></div>
            <div class="detail-box detail-box--wide"><b>Indirizzo</b><span>${escapeHtml(formatAddress(report))}</span></div>
            <div class="detail-box"><b>Autore</b><span>${escapeHtml(authorName(report))}</span></div>
            <div class="detail-box"><b>Data</b><span>${escapeHtml(formatDate(report.created_at))}</span></div>
          </div>
          <div class="drawer-actions" style="margin-top:16px;">
            <button class="btn btn-primary rd-like ${liked ? "is-liked" : ""}" data-id="${report.id}">${liked ? "❤️ Ti piace" : "🤍 Vota"} <span class="btn-like-count">${Number(report.like_count || 0)}</span></button>
            <button class="btn btn-soft" data-route="dashboard">${state.user ? "Vai alla dashboard" : "Vedi le segnalazioni"}</button>
          </div>
        </article>
      </main>
    </div>
  `;
  bindRouteButtons();
  $("#rd-back")?.addEventListener("click", () => { if (window.history.length > 1) window.history.back(); else setRoute(state.user ? "dashboard" : "landing"); });
  $("#rd-share")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(window.location.href); toast("Link copiato negli appunti.", "success"); }
    catch { toast("Copia automatica non riuscita: copia l'URL dalla barra del browser.", "warning"); }
  });
  $(".rd-like")?.addEventListener("click", async () => {
    if (!state.user) return setRoute("auth");
    const was = state.likes.has(report.id);
    if (was) { state.likes.delete(report.id); report.like_count = Math.max(0, Number(report.like_count || 0) - 1); }
    else { state.likes.add(report.id); report.like_count = Number(report.like_count || 0) + 1; }
    paintReportDetail(report);
    try {
      await backend.toggleLike(state.user.id, report.id, was);
    } catch (error) {
      if (was) { state.likes.add(report.id); report.like_count = Number(report.like_count || 0) + 1; }
      else { state.likes.delete(report.id); report.like_count = Math.max(0, Number(report.like_count || 0) - 1); }
      paintReportDetail(report);
      toast("Like non aggiornato.", "error");
    }
  });
}

// Schermata di conferma mostrata dopo l'invio di una segnalazione (FASE 3).
// Riusa le classi del drawer per coerenza grafica; il recap usa i dati del payload.
function showReportConfirmation(payload = {}) {
  const indirizzo = [payload.via, payload.civico, payload.comune].filter(Boolean).join(", ") || payload.comune || "—";
  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";
  backdrop.innerHTML = `
    <article class="drawer" role="dialog" aria-modal="true" aria-label="Segnalazione pubblicata">
      <div class="drawer-content">
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding-top:6px;">
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(16,185,129,0.15);display:grid;place-items:center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 class="drawer-title" style="margin:0;">Segnalazione pubblicata!</h2>
          <p class="drawer-desc" style="margin:0;">È stata registrata ed è ora visibile nella dashboard.</p>
        </div>
        <div style="height:14px"></div>
        <div class="detail-grid">
          <div class="detail-box detail-box--wide"><b>Titolo</b><span>${escapeHtml(payload.titolo || "—")}</span></div>
          <div class="detail-box"><b>Categoria</b><span>${escapeHtml(capitalize(payload.tipo || "—"))}</span></div>
          <div class="detail-box"><b>Priorità</b><span>${escapeHtml(capitalize(payload.priorita || "media"))}</span></div>
          <div class="detail-box detail-box--wide"><b>Indirizzo</b><span>${escapeHtml(indirizzo)}</span></div>
        </div>
        <div class="drawer-actions">
          <button class="btn btn-primary confirm-go-dashboard" type="button">Vai alla dashboard</button>
          <button class="btn btn-soft confirm-new-report" type="button">Crea un'altra</button>
        </div>
      </div>
    </article>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector(".confirm-go-dashboard").addEventListener("click", close);
  backdrop.querySelector(".confirm-new-report").addEventListener("click", () => { close(); setRoute("new"); });
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
}

function openReportDrawer(id) {
  const report = state.reports.find(r => String(r.id) === String(id));
  if (!report) return;

  const backdrop = document.createElement("div");
  backdrop.className = "drawer-backdrop";
  backdrop.innerHTML = `
    <article class="drawer" role="dialog" aria-modal="true">
      <button class="icon-btn drawer-close" aria-label="Chiudi">×</button>
      <div class="drawer-hero">${report.photo_url ? `<img src="${escapeAttr(report.photo_url)}" alt="${escapeAttr(report.titolo || report.tipo)}" />` : `<div class="report-placeholder">${categoryIcon(report.tipo)}</div>`}</div>
      <div class="drawer-content">
        <div class="report-meta">
          ${statusChip(report.stato)}
          ${priorityChip(report.priorita)}
        </div>
        <h2 class="drawer-title">${escapeHtml(report.titolo || report.tipo)}</h2>
        ${report.descrizione ? `<p class="drawer-desc">${escapeHtml(report.descrizione)}</p>` : ""}
        <div class="detail-grid">
          <div class="detail-box"><b>Categoria</b><span>${escapeHtml(capitalize(report.tipo || "—"))}</span></div>
          <div class="detail-box"><b>Priorità</b><span>${escapeHtml(capitalize(report.priorita || "—"))}</span></div>
          <div class="detail-box"><b>Comune</b><span>${escapeHtml(report.comune || "—")}</span></div>
          <div class="detail-box"><b>Provincia</b><span>${escapeHtml(report.provincia || "—")}</span></div>
          <div class="detail-box detail-box--wide"><b>Indirizzo</b><span>${escapeHtml(formatAddress(report))}</span></div>
          <div class="detail-box"><b>Autore</b><span>${escapeHtml(authorName(report))}</span></div>
          <div class="detail-box"><b>Data</b><span>${escapeHtml(formatDate(report.created_at))}</span></div>
        </div>
        <div class="drawer-actions">
          <button class="btn btn-primary like-btn ${state.likes.has(report.id) ? "is-liked" : ""}" data-id="${report.id}">${state.likes.has(report.id) ? "❤️ Ti piace" : "🤍 Vota"} <span class="btn-like-count">${Number(report.like_count || 0)}</span></button>
          <button class="btn btn-soft drawer-close-btn" type="button">Chiudi</button>
        </div>
        ${report.user_id && report.user_id !== state.user?.id ? `
        <div class="drawer-moderation">
          <button class="btn btn-ghost btn-small drawer-report-btn" type="button">⚑ Segnala</button>
          <button class="btn btn-ghost btn-small drawer-block-btn" type="button">⊘ Blocca utente</button>
        </div>` : ""}
      </div>
    </article>
  `;

  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector(".drawer-close").addEventListener("click", close);
  backdrop.querySelector(".drawer-close-btn")?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  // Like dal dettaglio: aggiornamento ottimistico in-place, il drawer resta aperto
  backdrop.querySelector(".like-btn")?.addEventListener("click", () => toggleLike(report.id));
  // Moderazione
  backdrop.querySelector(".drawer-report-btn")?.addEventListener("click", () => handleReportContent(report.id));
  backdrop.querySelector(".drawer-block-btn")?.addEventListener("click", () => { close(); handleBlockUser(report.user_id); });
}

async function handleReportContent(reportId) {
  if (!state.user) return setRoute("auth");
  const ok = await confirmSheet({
    title: "Segnalare questo contenuto?",
    message: "Lo invierai ai moderatori per una verifica. Grazie per aiutarci a tenere CivicVois sicura.",
    confirmLabel: "Segnala",
    danger: true
  });
  if (!ok) return;
  try {
    await backend.reportContent(reportId);
    toast("Contenuto segnalato. Lo esamineremo al più presto.", "success");
  } catch (error) {
    toast(error.message || "Segnalazione non riuscita.", "error");
  }
}

async function handleBlockUser(targetUserId) {
  if (!state.user || !targetUserId) return;
  const ok = await confirmSheet({
    title: "Bloccare questo utente?",
    message: "Non vedrai più le sue segnalazioni. Potrai sbloccarlo in seguito contattando il supporto.",
    confirmLabel: "Blocca",
    danger: true
  });
  if (!ok) return;
  try {
    await backend.blockUser(targetUserId);
    state.blocked.add(targetUserId);
    toast("Utente bloccato.", "success");
    await refreshData();
    render();
  } catch (error) {
    toast(error.message || "Operazione non riuscita.", "error");
  }
}

// ─── Mappa ────────────────────────────────────────────────────────────────────

function initMap() {
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileOpts = { attribution: "&copy; OpenStreetMap" };
  const center = [45.584, 9.274];
  const zoom = 10;

  // Mappa desktop
  const mapEl = $("#map");
  if (mapEl && window.L && !state.map) {
    state.map = L.map(mapEl, { scrollWheelZoom: false }).setView(center, zoom);
    L.tileLayer(tileUrl, tileOpts).addTo(state.map);
    setTimeout(() => state.map?.invalidateSize(), 180);
  }

  // Mappa mobile
  const mapElM = $("#map-mobile");
  if (mapElM && window.L && !state.mapMobile) {
    state.mapMobile = L.map(mapElM, { scrollWheelZoom: false }).setView(center, zoom);
    L.tileLayer(tileUrl, tileOpts).addTo(state.mapMobile);
    setTimeout(() => state.mapMobile?.invalidateSize(), 180);
  }

  refreshMapMarkers();
}

function refreshMapMarkers() {
  if (!window.L) return;

  // Pulisci marcatori esistenti
  (state.markers || []).forEach(marker => marker.remove());
  state.markers = [];
  (state.markersMobile || []).forEach(marker => marker.remove());
  state.markersMobile = [];

  const bounds = [];
  filteredReports().forEach(report => {
    const lat = Number(report.lat);
    const lng = Number(report.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const popup = `<strong>${escapeHtml(report.titolo || report.tipo)}</strong><br>${escapeHtml(report.comune || "")}`;

    if (state.map) {
      const marker = L.marker([lat, lng]).addTo(state.map);
      marker.bindPopup(popup);
      state.markers.push(marker);
    }
    if (state.mapMobile) {
      const markerM = L.marker([lat, lng]).addTo(state.mapMobile);
      markerM.bindPopup(popup);
      state.markersMobile.push(markerM);
    }

    bounds.push([lat, lng]);
  });

  if (bounds.length) {
    state.map?.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    state.mapMobile?.fitBounds(bounds, { padding: [16, 16], maxZoom: 14 });
  }
}

// ─── Card segnalazione ────────────────────────────────────────────────────────

function reportCardHtml(report) {
  const liked = state.likes.has(report.id);
  const isMine = report.user_id === state.user?.id;
  const isAdmin = state.profile?.role === "admin";

  return `
    <article class="report-card" data-report-id="${report.id}">
      <div class="report-media">
        ${report.photo_url ? `<img src="${escapeAttr(report.photo_url)}" alt="${escapeAttr(report.titolo || report.tipo)}" loading="lazy" />` : `<div class="report-placeholder">${categoryIcon(report.tipo)}</div>`}
      </div>
      <div class="report-body">
        <div class="report-top">
          <div>
            <div class="report-meta">
              ${statusChip(report.stato)}
              ${priorityChip(report.priorita)}
            </div>
            <div style="height:9px"></div>
            <h2 class="report-title">${escapeHtml(report.titolo || capitalize(report.tipo || "Segnalazione"))}</h2>
          </div>
        </div>
        <p class="report-desc">${escapeHtml(report.descrizione || "")}</p>
        <div class="report-meta">
          <span class="chip">📍 ${escapeHtml(formatAddress(report))}</span>
          <span class="chip">👤 ${escapeHtml(authorName(report))}</span>
          <span class="chip">🕒 ${escapeHtml(formatDate(report.created_at))}</span>
        </div>
        <div class="report-actions">
          <button class="btn btn-small btn-primary open-detail" data-id="${report.id}">Dettagli</button>
          <button class="btn btn-small btn-soft like-btn ${liked ? "is-liked" : ""}" data-id="${report.id}">${liked ? "❤️ Votata" : "🤍 Vota"} <span class="btn-like-count">${Number(report.like_count || 0)}</span></button>
          ${(isMine || isAdmin) ? `<button class="btn btn-small btn-danger delete-own-report" data-id="${report.id}">Elimina</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function activityHtml(report) {
  return `
    <div class="activity-item">
      <div class="activity-dot">${categoryIcon(report.tipo)}</div>
      <div>
        <strong>${escapeHtml(report.titolo || report.tipo)}</strong>
        <span>${escapeHtml(report.comune || "Italia")} · ${escapeHtml(capitalize(report.stato || "nuova"))}</span>
      </div>
    </div>
  `;
}

// ─── Filtri & stats ───────────────────────────────────────────────────────────

function filteredReports() {
  const f = state.filters;
  const q = (f.q || "").trim().toLowerCase();
  let list = [...state.reports];

  // Nascondi i contenuti degli utenti bloccati
  if (state.blocked?.size) list = list.filter(r => !state.blocked.has(r.user_id));

  // Ricerca testuale (solo dalla barra globale dell'header desktop)
  if (q) {
    list = list.filter(r => [r.titolo, r.tipo, r.descrizione, r.comune, r.via, authorName(r)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q));
  }

  // Filtri territoriali a cascata + categoria (confronto robusto ai nomi)
  const eqLoc = (a, b) => normalizeLocationKey(a) === normalizeLocationKey(b);
  if (f.regione)   list = list.filter(r => eqLoc(r.regione, f.regione));
  if (f.provincia) list = list.filter(r => eqLoc(r.provincia, f.provincia));
  if (f.comune)    list = list.filter(r => eqLoc(r.comune, f.comune));
  if (f.tipo)      list = list.filter(r => r.tipo === f.tipo);

  // Ordinamento predefinito: più recenti
  list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  // Home privata: al massimo PAGE_SIZE (10) segnalazioni, così la mappa resta
  // visibile e non si crea scroll infinito.
  return list.slice(0, PAGE_SIZE);
}

function getStats() {
  const reports = state.reports;
  return {
    total: state.totalReports || reports.length,
    open: reports.filter(r => ["nuova", "verificata"].includes(r.stato)).length,
    inProgress: reports.filter(r => r.stato === "in carico").length,
    resolved: reports.filter(r => r.stato === "risolta").length
  };
}

// ─── Nav & UI ─────────────────────────────────────────────────────────────────

function navHtml(active) {
  const isAdmin = state.profile?.role === "admin";
  const items = [
    navItem("dashboard", "🏠", "Dashboard", active),
    navItem("new", "+", "Nuova segnalazione", active, { plus: true })
  ];

  if (state.user) items.push(navItem("profile", profileNavIconHtml(), "Profilo", active, { htmlIcon: true }));
  if (isAdmin) items.push(navItem("admin", "🛠️", "Admin", active));

  return `
    <nav class="side-nav" aria-label="Menu app">
      ${items.join("")}
    </nav>
  `;
}

function mobileNavHtml(active) {
  return `<nav class="mobile-nav">${navHtml(active).replace('<nav class="side-nav" aria-label="Menu app">', '').replace('</nav>', '')}</nav>`;
}

function profileNavIconHtml() {
  const p = state.profile || {};
  if (p.avatar_url) return `<img src="${escapeAttr(p.avatar_url)}" class="nav-avatar" alt="" />`;
  const initials = (p.full_name || p.username || state.user?.email || "CV")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0]?.toUpperCase())
    .join("") || "CV";
  return `<span class="nav-avatar nav-avatar--fallback">${escapeHtml(initials)}</span>`;
}

function navItem(route, icon, label, active, options = {}) {
  const iconClass = options.plus ? "nav-ico nav-ico-plus" : "nav-ico";
  const iconHtml = options.htmlIcon ? icon : `<span class="${iconClass}">${icon}</span>`;
  return `<button class="side-link ${active === route ? "is-active" : ""}" data-route="${route}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${iconHtml}<span class="nav-label">${label}</span></button>`;
}

function brandHtml() {
  return `
    <button class="brand" data-route="${state.user ? "dashboard" : "landing"}" aria-label="CivicVois home">
      <img src="assets/img/civicvois-logo.png" class="brand-logo" alt="" />
      <span><span class="brand-name">CIVICVOIS</span><span class="brand-subtitle">urban issue reporting</span></span>
    </button>
  `;
}

function userMiniHtml() {
  const p = state.profile || {};
  return `
    <div class="user-mini">
      ${avatarHtml(p, "avatar")}
      <div style="min-width:0;">
        <strong>${escapeHtml(p.full_name || state.user?.email || "Utente")}</strong>
        <span>${escapeHtml(p.role === "admin" ? "Amministratore" : "Cittadino")}</span>
      </div>
    </div>
  `;
}

function avatarHtml(profile, className = "avatar") {
  if (profile?.avatar_url) return `<img src="${escapeAttr(profile.avatar_url)}" class="${className}" alt="Avatar" />`;
  const initials = (profile?.full_name || profile?.username || state.user?.email || "CV")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0]?.toUpperCase())
    .join("") || "CV";
  return `<div class="${className}">${escapeHtml(initials)}</div>`;
}

function statusChip(status = "nuova") {
  const cls = status === "risolta" ? "chip-success" : status === "in carico" ? "chip-warning" : status === "archiviata" ? "chip-dark" : "chip-primary";
  return `<span class="chip ${cls}">${escapeHtml(capitalize(status))}</span>`;
}

function priorityChip(priority = "media") {
  const cls = priority === "urgente" ? "chip-danger" : priority === "alta" ? "chip-warning" : priority === "bassa" ? "chip-primary" : "";
  return `<span class="chip ${cls}">Priorità ${escapeHtml(capitalize(priority))}</span>`;
}

function demoNoticeHtml() {
  return `
    <div class="notice" style="margin-bottom:16px;">
      <strong>Modalità demo locale attiva</strong>
      L'interfaccia usa dati dimostrativi salvati nel browser. Online CivicVois usa Supabase per account, segnalazioni, immagini e moderazione.
    </div>
  `;
}

function emptyHtml(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`;
}

// Placeholder animati mostrati mentre il feed carica (no schermo vuoto)
function skeletonFeedHtml(n = 4) {
  const card = `
    <div class="skeleton-card">
      <div class="sk sk-media"></div>
      <div class="sk-body">
        <div class="sk sk-line sk-chip"></div>
        <div class="sk sk-line sk-title"></div>
        <div class="sk sk-line"></div>
        <div class="sk sk-line sk-short"></div>
      </div>
    </div>`;
  return Array(n).fill(card).join("");
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function installGlobalToastStack() {
  if ($(".toast-stack")) return;
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  document.body.appendChild(stack);
}

function toast(message, type = "") {
  let stack = $(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    // Accessibilità: gli screen reader annunciano i messaggi
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "true");
    document.body.appendChild(stack);
  }
  const duplicate = Array.from(stack.children).some(child => child.textContent === message);
  if (duplicate) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 5200);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function uniqueValues(list, key) {
  return [...new Set(list.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function parseCoords(input) {
  const match = input.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function priorityValue(priority) {
  return { bassa: 1, media: 2, alta: 3, urgente: 4 }[priority] || 2;
}

function authorName(report) {
  return report.profiles?.full_name || report.profiles?.username || report.author_name || "Utente CivicVois";
}

function formatAddress(report) {
  return [report.via, report.civico, report.comune].filter(Boolean).join(", ") || report.comune || "Indirizzo non specificato";
}

function formatDate(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function formatMonthYear(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" }).format(new Date(date));
}

function capitalize(text = "") {
  return String(text).charAt(0).toUpperCase() + String(text).slice(1);
}

function categoryIcon(tipo = "") {
  const t = tipo.toLowerCase();
  if (t.includes("buche") || t.includes("strade")) return "🕳️";
  if (t.includes("cartelli") || t.includes("segnaletica")) return "🚧";
  if (t.includes("rifiuti")) return "🗑️";
  if (t.includes("illuminazione")) return "💡";
  if (t.includes("animali")) return "🐾";
  if (t.includes("allagamenti") || t.includes("ghiaccio")) return "💧";
  if (t.includes("vegetazione")) return "🌿";
  return "📍";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEMO BACKEND
//  Usato solo da createDemoAdapter(). Non chiamato direttamente dall'app.
// ─────────────────────────────────────────────────────────────────────────────

function createDemoBackend() {
  const seed = {
    users: [
      {
        id: "demo-user",
        email: "demo@civicvois.it",
        password: "civicvois",
        full_name: "Utente Demo CivicVois",
        username: "demo",
        comune: "Verano Brianza",
        provincia: "Monza e Brianza",
        regione: "Lombardia",
        role: "admin",
        bio: "Profilo dimostrativo per testare CivicVois."
      }
    ],
    reports: [
      {
        id: "demo-1",
        user_id: "demo-user",
        author_name: "Utente Demo CivicVois",
        titolo: "Buca pericolosa vicino alle strisce pedonali",
        tipo: "strade rotte o piene di buche",
        descrizione: "La buca si trova vicino all'attraversamento e crea rischio per auto, bici e pedoni. Serve intervento urgente.",
        priorita: "alta",
        stato: "in carico",
        regione: "Lombardia",
        provincia: "Monza e Brianza",
        comune: "Verano Brianza",
        via: "Via Roma",
        civico: "45",
        lat: 45.6887,
        lng: 9.2296,
        photo_url: "",
        like_count: 8,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
      },
      {
        id: "demo-2",
        user_id: "demo-user",
        author_name: "Redazione CivicVois",
        titolo: "Illuminazione insufficiente nel parcheggio",
        tipo: "illuminazione insufficiente",
        descrizione: "La sera l'area resta poco visibile e molti cittadini evitano il parcheggio. Segnalazione da verificare.",
        priorita: "media",
        stato: "verificata",
        regione: "Lombardia",
        provincia: "Monza e Brianza",
        comune: "Carate Brianza",
        via: "Via Cusani",
        civico: "8",
        lat: 45.6754,
        lng: 9.2379,
        photo_url: "",
        like_count: 4,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString()
      },
      {
        id: "demo-3",
        user_id: "demo-user",
        author_name: "Cittadino",
        titolo: "Rifiuti abbandonati vicino al parco",
        tipo: "rifiuti e discariche abusive",
        descrizione: "Sacchi e rifiuti vari sono stati lasciati vicino all'ingresso del parco. L'area è frequentata da bambini.",
        priorita: "media",
        stato: "nuova",
        regione: "Lombardia",
        provincia: "Monza e Brianza",
        comune: "Seregno",
        via: "Via Verdi",
        civico: "12",
        lat: 45.6516,
        lng: 9.2053,
        photo_url: "",
        like_count: 2,
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString()
      }
    ],
    likes: []
  };

  const db = readLocal("cv_demo_db", seed);
  const save = () => writeLocal("cv_demo_db", db);

  return {
    ensureUser(payload) {
      let user = db.users.find(u => u.email === payload.email);
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          email: payload.email,
          password: payload.password,
          full_name: payload.full_name,
          username: payload.username || cleanUsername(payload.email?.split("@")[0] || "utente"),
          regione: payload.regione || "",
          provincia: payload.provincia || "",
          comune: payload.comune || "",
          role: db.users.length === 0 ? "admin" : "user",
          bio: payload.bio || "",
          avatar_url: payload.avatar_url || ""
        };
        db.users.push(user);
        save();
      }
      return { id: user.id, email: user.email };
    },
    login(email, password) {
      const user = db.users.find(u => u.email === email && u.password === password);
      return user ? { id: user.id, email: user.email } : null;
    },
    getProfile(id) {
      const u = db.users.find(user => user.id === id);
      if (!u) return null;
      return { id: u.id, email: u.email, full_name: u.full_name, username: u.username, comune: u.comune, provincia: u.provincia, regione: u.regione, role: u.role, bio: u.bio, avatar_url: u.avatar_url || "" };
    },
    updateProfile(id, payload) {
      const idx = db.users.findIndex(user => user.id === id);
      if (idx >= 0) { db.users[idx] = { ...db.users[idx], ...payload }; save(); }
    },
    listReports() {
      const byId = Object.fromEntries(db.users.map(u => [u.id, u]));
      return db.reports
        .map(r => ({
          ...r,
          like_count: Number(r.like_count || 0) + db.likes.filter(l => l.segnalazione_id === r.id).length,
          profiles: byId[r.user_id] ? {
            id: byId[r.user_id].id,
            username: byId[r.user_id].username,
            full_name: byId[r.user_id].full_name,
            avatar_url: byId[r.user_id].avatar_url || "",
            regione: byId[r.user_id].regione,
            provincia: byId[r.user_id].provincia,
            comune: byId[r.user_id].comune
          } : null
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    addReport(payload) {
      db.reports.unshift({
        ...payload,
        id: crypto.randomUUID(),
        profiles: undefined,
        photo_url: payload.photo_url || "",
        author_name: this.getProfile(payload.user_id)?.full_name || "Utente CivicVois",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      save();
    },
    updateReport(id, payload) {
      const idx = db.reports.findIndex(r => r.id === id);
      if (idx >= 0) { db.reports[idx] = { ...db.reports[idx], ...payload, updated_at: new Date().toISOString() }; save(); }
    },
    deleteReport(id) {
      db.reports = db.reports.filter(r => r.id !== id);
      db.likes = db.likes.filter(l => l.segnalazione_id !== id);
      save();
    },
    getLikes(userId) {
      return new Set(db.likes.filter(l => l.utente_id === userId).map(l => l.segnalazione_id));
    },
    toggleLike(userId, reportId) {
      const idx = db.likes.findIndex(l => l.utente_id === userId && l.segnalazione_id === reportId);
      if (idx >= 0) db.likes.splice(idx, 1);
      else db.likes.push({ utente_id: userId, segnalazione_id: reportId });
      save();
    }
  };
}
