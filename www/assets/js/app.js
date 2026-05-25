import { SUPABASE_URL, SUPABASE_ANON_KEY, FORCE_DEMO_MODE, API_BASE_URL, IS_NATIVE_APP } from "./config.js";
import { createProxySupabaseClient } from "./supabase-proxy.js";

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

const ITALY_LOCATION_SOURCES = [
  "https://cdn.jsdelivr.net/gh/matteocontrini/comuni-json@master/comuni.json",
  "https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json"
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

const PAGE_SIZE = 50; // segnalazioni per pagina

// ─── Helpers DOM ──────────────────────────────────────────────────────────────

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const app = $("#app");

// ─── Modalità backend ─────────────────────────────────────────────────────────

const hasSupabaseConfig = Boolean(SUPABASE_URL?.startsWith("https://") && SUPABASE_ANON_KEY?.length > 20);
const DEMO_MODE = FORCE_DEMO_MODE || !hasSupabaseConfig;

const supabase = DEMO_MODE ? null : createProxySupabaseClient({
  supabaseUrl: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
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
    } catch (error) {
      lastThrown = error;
      if (!isRetryableError(error) || attempt === attempts - 1) throw error;
    }
    await wait(450 * (attempt + 1));
  }
  if (lastThrown) throw lastThrown;
  return lastResult;
}

function isRetryableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("failed to fetch") || message.includes("network") || message.includes("timeout");
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Messaggi di errore leggibili ─────────────────────────────────────────────

function niceBackendError(error, fallback = "Operazione non riuscita.") {
  const raw = String(error?.message || error?.error_description || error || "").trim();
  const message = raw.toLowerCase();
  if (message.includes("failed to fetch")) return `${fallback} Connessione non riuscita. Controlla che il deploy includa netlify/functions e che le Functions siano pubblicate.`;
  if (message.includes("invalid login credentials")) return "Email o password non corretti.";
  if (message.includes("email not confirmed")) return "Accesso non riuscito. Controlla email e password.";
  if (message.includes("already registered") || message.includes("user already registered")) return "Questo indirizzo email è già registrato. Vai su Accedi.";
  if (message.includes("duplicate") && message.includes("username")) return "Username già usato. Scegline uno diverso.";
  if (message.includes("violates row-level security") || message.includes("row-level security")) return `${fallback} Permessi backend da correggere.`;
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

// ─────────────────────────────────────────────────────────────────────────────
//  ADAPTER BACKEND
//  Interfaccia uniforme: backend.login(), backend.register(), ecc.
//  Internamente usa il demo locale oppure la Netlify Function/Supabase.
// ─────────────────────────────────────────────────────────────────────────────

const backend = DEMO_MODE ? createDemoAdapter() : createNetlifyAdapter();

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

function createNetlifyAdapter() {
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

    async logout() {
      await supabase.auth.signOut();
    },

    async restoreSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) return null;
      const user = data.session.user;
      const profile = await this._loadProfile(user.id);
      return { user, session: data.session, profile };
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

    async fetchProfile(userId) {
      return this._loadProfile(userId);
    },

    async saveProfile(userId, payload) {
      if (payload.avatarFile instanceof File && payload.avatarFile.size > 0) {
        payload.avatar_url = await this.uploadPhoto(payload.avatarFile, "avatars");
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: payload.full_name,
          username: payload.username,
          bio: payload.bio,
          regione: payload.regione,
          provincia: payload.provincia,
          comune: payload.comune,
          avatar_url: payload.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);
      if (error) throw error;
      return this._loadProfile(userId);
    },

    async createReport(payload) {
      if (payload.photoFile instanceof File && payload.photoFile.size > 0) {
        payload.photo_url = await this.uploadPhoto(payload.photoFile, "report-photos");
      }
      const { error } = await supabase.from("segnalazioni").insert(payload);
      if (error) throw error;
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
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!validTypes.includes(file.type)) throw new Error("Formato immagine non supportato.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Immagine troppo grande. Limite: 5 MB.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    },

    onAuthChange(callback) {
      supabase.auth.onAuthStateChange(callback);
    },

    // ── Metodi interni ──────────────────────────────────────────────────────

    async _loadProfile(userId) {
      const { data, error } = await withRetry(() =>
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle()
      );
      if (error) throw error;
      return data;
    },

    async _ensureProfile(user, extra = {}) {
      const metadata = user.user_metadata || {};
      const emailName = String(user.email || "utente").split("@")[0];
      const fallbackUsername = cleanUsername(extra.username || metadata.username || emailName || `utente-${String(user.id).slice(0, 6)}`);

      const payload = {
        id: user.id,
        email: user.email || extra.email || null,
        username: fallbackUsername,
        full_name: clean(extra.full_name || metadata.full_name || fallbackUsername),
        regione: clean(extra.regione || metadata.regione || ""),
        provincia: clean(extra.provincia || metadata.provincia || ""),
        comune: clean(extra.comune || metadata.comune || ""),
        bio: clean(extra.bio || metadata.bio || ""),
        avatar_url: clean(extra.avatar_url || metadata.avatar_url || "")
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: false });

      if (error && String(error.message || "").toLowerCase().includes("duplicate")) {
        const altPayload = { ...payload, username: `${fallbackUsername}-${String(user.id).slice(0, 6)}` };
        const { error: altError } = await supabase
          .from("profiles")
          .upsert(altPayload, { onConflict: "id", ignoreDuplicates: false });
        if (altError) throw altError;
      } else if (error) {
        throw error;
      }

      return this._loadProfile(user.id);
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
        userEmail: state?.user?.email || null,
        reportsLoaded: state?.reports?.length || 0,
        currentPage: state?.page || 0,
        totalReports: state?.totalReports || 0,
        origin: window.location.origin,
        isNativeApp: IS_NATIVE_APP,
        apiBaseUrl: API_BASE_URL,
        apiProxy: `${API_BASE_URL}/civicvois-api`
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
  reports: [],
  totalReports: 0,
  page: 0,
  likes: new Set(),
  filters: {
    q: "",
    comune: "",
    tipo: "",
    stato: "",
    sort: "recenti"
  },
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

installDebugHelpers();
init();

// ─── Init & routing ───────────────────────────────────────────────────────────

async function init() {
  installGlobalToastStack();
  bindHashRouter();

  loadItalyLocations().then((loaded) => {
    if (!loaded) return;
    if (state.route === "auth" && state.authMode === "register") return renderAuthPage("register");
    if (["new", "profile"].includes(state.route)) render();
  }).catch(error => console.warn("Anagrafica territoriale non aggiornata", error));

  backend.onAuthChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    if (state.user) state.profile = await backend.fetchProfile(state.user.id).catch(() => null);
    else state.profile = null;
    await refreshData();
    render();
  });

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
  render();
}

function bindHashRouter() {
  window.addEventListener("hashchange", async () => {
    const next = readRouteFromHash();
    state.route = normalizeRoute(next);
    state.page = 0;
    await refreshData();
    render();
  });
  state.route = normalizeRoute(readRouteFromHash());
}

function readRouteFromHash() {
  return window.location.hash.replace(/^#\/?/, "") || "landing";
}

function setRoute(route) {
  window.location.hash = `#/${route}`;
}

function normalizeRoute(route) {
  if (["dashboard", "new", "profile", "admin", "settings"].includes(route) && !state.user) return "auth";
  if (route === "settings") return "profile";
  if (route === "admin" && state.profile?.role !== "admin") return "dashboard";
  return route || "landing";
}

async function bootstrapAuth() {
  const session = await backend.restoreSession();
  if (!session) return;
  state.user = session.user;
  state.session = session.session || null;
  state.profile = session.profile;
}

async function refreshData() {
  if (!state.user && state.route === "auth") {
    state.reports = [];
    state.likes = new Set();
    return;
  }
  await Promise.all([loadReports(), loadLikes()]);
}

async function loadReports() {
  try {
    const { reports, total } = await backend.fetchReports({ page: state.page });
    state.reports = reports;
    state.totalReports = total;
  } catch (error) {
    console.error("Errore lettura segnalazioni", error);
    state.reports = [];
    if (state.route !== "auth") {
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
  if (!state.user && ["auth"].includes(state.route)) return renderAuthPage();
  if (!state.user && ["dashboard", "new", "profile", "admin"].includes(state.route)) return renderAuthPage();

  switch (state.route) {
    case "auth":
      return state.user ? setRoute("dashboard") : renderAuthPage();
    case "dashboard":
      return renderApp("dashboard");
    case "new":
      return renderApp("new");
    case "profile":
      return renderApp("profile");
    case "admin":
      if (state.profile?.role !== "admin") return setRoute("dashboard");
      return renderApp("admin");
    default:
      return renderLanding();
  }
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
            <a class="nav-link" href="#segnalazioni">Segnalazioni</a>
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
            <span class="badge">● Piattaforma civica mobile-first</span>
            <h1>La tua città, <span>segnalata meglio.</span></h1>
            <p class="hero-lead">CivicVois trasforma buche, cartelli rotti, rifiuti e problemi urbani in segnalazioni ordinate, visibili e tracciabili. Un'interfaccia seria per cittadini, comuni e amministratori.</p>
            <div class="hero-actions">
              <button class="btn btn-primary" data-route="${state.user ? "new" : "auth"}">Crea una segnalazione</button>
              <button class="btn btn-ghost" data-route="${state.user ? "dashboard" : "auth"}">Entra nella dashboard</button>
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

        <section id="vantaggi" class="section">
          <h2 class="section-title">Più credibile. Più veloce. Più app.</h2>
          <p class="section-lead">Questa build è pensata per Netlify: frontend statico moderno, Netlify Functions e Netlify Blobs per autenticazione, database, immagini e like.</p>
        </section>
      </main>
    </div>
  `;
  bindRouteButtons();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function renderAuthPage(mode = state.authMode || "login") {
  state.authMode = mode;
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-copy">
        ${brandHtml()}
        <h1>Accedi alla piattaforma civica.</h1>
        <p>Gestisci segnalazioni, foto, like, profilo e stati in una versione compatibile con Netlify. ${DEMO_MODE ? "Ora sei in modalità demo locale." : "Backend Netlify collegato."}</p>
      </section>
      <section class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab ${mode === "login" ? "is-active" : ""}" data-auth-tab="login">Accedi</button>
          <button class="auth-tab ${mode === "register" ? "is-active" : ""}" data-auth-tab="register">Registrati</button>
        </div>
        ${DEMO_MODE ? `<div class="notice"><strong>Modalità demo attiva</strong>Il sito funziona in locale. Online usa Netlify Functions e Netlify Blobs.</div>` : ""}
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
    if (action === "login") await handleLogin(new FormData(form));
    if (action === "register") await handleRegister(new FormData(form));
  });
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
      <button class="btn btn-soft" type="button" id="demo-fast-login">Prova demo immediata</button>
    </form>
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
        <textarea class="textarea" name="bio" placeholder="Racconta brevemente chi sei o il tuo legame col territorio."></textarea>
      </div>
      <div class="field span-2">
        <label>Foto profilo</label>
        ${avatarUploadHtml({}, "register")}
      </div>
      <button class="btn btn-primary span-2" type="submit">Crea account</button>
    </form>
  `;
}

// Demo fast login
document.addEventListener("click", async (event) => {
  if (event.target.closest("#demo-fast-login")) await handleDemoFastLogin();
});

async function handleDemoFastLogin() {
  if (!DEMO_MODE) {
    toast("Il login demo è disponibile solo se il backend non è configurato.", "warning");
    return;
  }
  try {
    const { user, profile } = await backend.register({
      email: "demo@civicvois.it",
      password: "civicvois",
      full_name: "Utente Demo CivicVois",
      username: "demo",
      comune: "Verano Brianza",
      regione: "Lombardia",
      provincia: "Monza e Brianza"
    });
    state.user = user;
    state.profile = profile;
    await refreshData();
    toast("Accesso demo effettuato.", "success");
    setRoute("dashboard");
  } catch (error) {
    console.error(error);
    toast(error.message || "Accesso demo non riuscito.", "error");
  }
}

async function handleLogin(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  try {
    const { user, session, profile } = await backend.login({ email, password });
    state.user = user;
    state.session = session || null;
    state.profile = profile;
    await refreshData();
    toast("Accesso effettuato.", "success");
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
    state.profile = profile;
    await refreshData();
    toast("Registrazione completata.", "success");
    setRoute("dashboard");
  } catch (error) {
    console.error("Errore registrazione", error);
    toast(error.message || "Registrazione non riuscita.", "error");
  }
}

async function handleLogout() {
  try {
    await backend.logout();
  } catch { /* ignora */ }
  state.user = null;
  state.session = null;
  state.profile = null;
  state.likes = new Set();
  state.reports = [];
  toast("Logout effettuato.", "success");
  setRoute("landing");
}

// ─── App layout ───────────────────────────────────────────────────────────────

function renderApp(active) {
  app.innerHTML = `
    <div class="app-layout">

      <!-- ── Sidebar desktop ── -->
      <aside class="sidebar">
        <div class="sidebar-inner">
          ${brandHtml()}
          ${navHtml(active)}
        </div>
        <div class="side-bottom">
          ${userMiniHtml()}
          <button class="btn btn-ghost" id="logout-btn">Esci</button>
        </div>
      </aside>

      <!-- ── Area principale ── -->
      <div class="app-body">

        <!-- Header desktop: search + notifiche + CTA -->
        <header class="app-header">
          <div class="app-header-search">
            <svg class="app-header-search-ico" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input class="app-header-search-input" id="global-search" type="search" placeholder="Cerca per titolo, comune, autore…" />
          </div>
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
          ${active === "admin" ? adminHtml() : ""}
        </main>

        <!-- Mobile bottom nav -->
        ${mobileNavHtml(active)}
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
      <button class="btn btn-primary dash-cta-desktop" data-route="new">+ Nuova segnalazione</button>
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

        <!-- Sezione filtri -->
        <div class="dash-filters-panel">
          <p class="dash-filters-title">Filtra segnalazioni</p>
          <div class="filters-row-desktop">
            <select class="select" id="filter-comune">
              <option value="">Tutti i comuni</option>
              ${uniqueValues(state.reports, "comune").map(v => `<option ${state.filters.comune === v ? "selected" : ""}>${escapeHtml(v)}</option>`).join("")}
            </select>
            <select class="select" id="filter-tipo">
              <option value="">Tutte le categorie</option>
              ${CATEGORIES.map(v => `<option value="${escapeAttr(v)}" ${state.filters.tipo === v ? "selected" : ""}>${capitalize(v)}</option>`).join("")}
            </select>
            <select class="select" id="filter-stato">
              <option value="">Tutti gli stati</option>
              ${STATUSES.map(v => `<option value="${escapeAttr(v)}" ${state.filters.stato === v ? "selected" : ""}>${capitalize(v)}</option>`).join("")}
            </select>
            <select class="select" id="filter-sort">
              <option value="recenti" ${state.filters.sort === "recenti" ? "selected" : ""}>Più recenti</option>
              <option value="like" ${state.filters.sort === "like" ? "selected" : ""}>Più votate</option>
              <option value="urgenti" ${state.filters.sort === "urgenti" ? "selected" : ""}>Priorità alta</option>
            </select>
          </div>
        </div>

        <!-- Filtri mobile: 2x2 dropdown + icona filtri avanzati -->
        <div class="dash-filters-mobile">
          <input class="input filter-search" id="filter-q" type="search" placeholder="Cerca per titolo, comune, autore…" value="${escapeAttr(state.filters.q)}" />
          <div class="filters-row-mobile">
            <select class="select" id="filter-comune-m">
              <option value="">Tutti i comuni</option>
              ${uniqueValues(state.reports, "comune").map(v => `<option ${state.filters.comune === v ? "selected" : ""}>${escapeHtml(v)}</option>`).join("")}
            </select>
            <select class="select" id="filter-tipo-m">
              <option value="">Tutte le categorie</option>
              ${CATEGORIES.map(v => `<option value="${escapeAttr(v)}" ${state.filters.tipo === v ? "selected" : ""}>${capitalize(v)}</option>`).join("")}
            </select>
            <select class="select" id="filter-stato-m">
              <option value="">Tutti gli stati</option>
              ${STATUSES.map(v => `<option value="${escapeAttr(v)}" ${state.filters.stato === v ? "selected" : ""}>${capitalize(v)}</option>`).join("")}
            </select>
            <select class="select" id="filter-sort-m">
              <option value="recenti" ${state.filters.sort === "recenti" ? "selected" : ""}>Più recenti</option>
              <option value="like" ${state.filters.sort === "like" ? "selected" : ""}>Più votate</option>
              <option value="urgenti" ${state.filters.sort === "urgenti" ? "selected" : ""}>Priorità alta</option>
            </select>
          </div>
        </div>

        <!-- Feed segnalazioni -->
        <div class="feed" id="report-feed">
          ${filtered.length ? filtered.map(reportCardHtml).join("") : emptyHtml("Nessuna segnalazione trovata", "Prova a rimuovere qualche filtro o crea una nuova segnalazione.")}
        </div>

        <!-- Paginazione -->
        ${totalPages > 1 ? `
          <div class="pagination">
            <button class="btn btn-soft btn-small" id="page-prev" ${state.page === 0 ? "disabled" : ""}>← Precedente</button>
            <span class="pagination-info">Pagina ${state.page + 1} di ${totalPages}</span>
            <button class="btn btn-soft btn-small" id="page-next" ${!hasMore ? "disabled" : ""}>Successiva →</button>
          </div>
        ` : ""}

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
  const isPublic = true; // default

  return `
    <!-- ── Topbar desktop ── -->
    <div class="topbar">
      <div>
        <h1>Nuova segnalazione</h1>
        <p>Aiutaci a migliorare il territorio. Compila i dettagli e invia la tua segnalazione.</p>
      </div>
      <div class="nr-topbar-right">
        <div class="nr-security-notice">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div>
            <strong>Le tue segnalazioni sono sicure</strong>
            <span>I tuoi dati sono protetti e utilizzati solo per migliorare la tua comunità.</span>
          </div>
        </div>
        <button class="btn btn-dark" data-route="dashboard">← Dashboard</button>
      </div>
    </div>

    <!-- ── Stepper mobile ── -->
    <div class="nr-stepper">
      <div class="nr-step is-active" data-step="1"><span class="nr-step-num">1</span><span class="nr-step-label">Dettagli</span></div>
      <div class="nr-step-line"></div>
      <div class="nr-step" data-step="2"><span class="nr-step-num">2</span><span class="nr-step-label">Posizione</span></div>
      <div class="nr-step-line"></div>
      <div class="nr-step" data-step="3"><span class="nr-step-num">3</span><span class="nr-step-label">Conferma</span></div>
      <div class="nr-step-line"></div>
      <div class="nr-step" data-step="4"><span class="nr-step-num">4</span><span class="nr-step-label">Invia</span></div>
    </div>

    <form id="report-form">
      <div class="nr-layout">

        <!-- ── 01 Foto ── -->
        <div class="nr-section panel">
          <div class="nr-section-header">
            <span class="nr-section-num">01</span>
            <div>
              <h2 class="nr-section-title">Foto <span class="nr-required">(obbligatoria)</span></h2>
              <p class="nr-section-sub">Carica una o più foto per descrivere meglio il problema.</p>
            </div>
          </div>
          <div class="nr-photo-grid" id="photo-grid">
            <!-- Upload area principale -->
            <label class="nr-photo-upload" id="upload-box">
              <input type="file" name="photo" accept="image/*" id="photo-input" multiple />
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
              <div id="upload-copy">
                <strong>Trascina qui le foto</strong>
                <span>oppure clicca per sfogliare</span>
                <span class="nr-upload-hint">JPG, PNG fino a 10MB</span>
              </div>
            </label>
            <!-- Azioni rapide mobile -->
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
            Puoi caricare fino a 5 foto
          </p>
        </div>

        <!-- ── 02 Titolo + 03 Descrizione (griglia desktop) ── -->
        <div class="nr-two-col">
          <!-- 02 Titolo -->
          <div class="nr-section panel">
            <div class="nr-section-header">
              <span class="nr-section-num">02</span>
              <div>
                <h2 class="nr-section-title">Titolo <span class="nr-required">(obbligatorio)</span></h2>
              </div>
            </div>
            <div class="nr-field">
              <input class="input" name="titolo" id="nr-titolo" placeholder="Es. Buche in via Roma" required maxlength="100" autocomplete="off" />
              <div class="nr-char-row">
                <small class="field-hint">Sii breve e chiaro: il titolo aiuta a identificare subito il problema.</small>
                <span class="nr-char-count" id="titolo-count">0/100</span>
              </div>
            </div>
          </div>

          <!-- 03 Descrizione -->
          <div class="nr-section panel">
            <div class="nr-section-header">
              <span class="nr-section-num">03</span>
              <div>
                <h2 class="nr-section-title">Descrizione <span class="nr-required">(obbligatoria)</span></h2>
              </div>
            </div>
            <div class="nr-field">
              <textarea class="textarea nr-textarea" name="descrizione" id="nr-desc" placeholder="Descrivi nel dettaglio il problema segnalato…" required minlength="12" maxlength="1000"></textarea>
              <div class="nr-char-row">
                <small class="field-hint">Fornisci più dettagli possibili: quando si verifica, da quanto tempo, impatto.</small>
                <span class="nr-char-count" id="desc-count">0/1000</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── 04 Categoria + 05 Priorità (griglia desktop) ── -->
        <div class="nr-two-col">
          <!-- 04 Categoria -->
          <div class="nr-section panel">
            <div class="nr-section-header">
              <span class="nr-section-num">04</span>
              <div>
                <h2 class="nr-section-title">Categoria <span class="nr-required">(obbligatoria)</span></h2>
              </div>
            </div>
            <div class="nr-field">
              <select class="select" name="tipo" required>
                <option value="">Seleziona una categoria</option>
                ${CATEGORIES.map(c => `<option value="${escapeAttr(c)}">${capitalize(c)}</option>`).join("")}
              </select>
              <small class="field-hint">Scegli la categoria che meglio rappresenta il problema.</small>
            </div>
          </div>

          <!-- 05 Priorità -->
          <div class="nr-section panel">
            <div class="nr-section-header">
              <span class="nr-section-num">05</span>
              <div>
                <h2 class="nr-section-title">Priorità</h2>
              </div>
            </div>
            <div class="nr-field">
              <div class="nr-priority-group">
                <input type="hidden" name="priorita" id="nr-priorita" value="bassa" />
                <button type="button" class="nr-priority-btn is-selected" data-priority="bassa">
                  <span class="nr-priority-dot" style="background:#10b981"></span> Bassa
                </button>
                <button type="button" class="nr-priority-btn" data-priority="media">
                  <span class="nr-priority-dot" style="background:#f59e0b"></span> Media
                </button>
                <button type="button" class="nr-priority-btn" data-priority="alta">
                  <span class="nr-priority-dot" style="background:#f43f5e"></span> Alta
                </button>
                <button type="button" class="nr-priority-btn" data-priority="urgente">
                  <span class="nr-priority-dot" style="background:#7c3aed"></span> Urgente
                </button>
              </div>
              <small class="field-hint">Indica il livello di urgenza del problema.</small>
            </div>
          </div>
        </div>

        <!-- ── 06 Posizione ── -->
        <div class="nr-section panel">
          <div class="nr-section-header">
            <span class="nr-section-num">06</span>
            <div>
              <h2 class="nr-section-title">Posizione <span class="nr-required">(obbligatoria)</span></h2>
            </div>
          </div>
          <div class="nr-position-layout">
            <div class="nr-position-left">
              <!-- Tab: inserisci / usa posizione -->
              <div class="nr-pos-tabs">
                <button type="button" class="nr-pos-tab is-active" data-postab="indirizzo">Inserisci indirizzo</button>
                <button type="button" class="nr-pos-tab" data-postab="gps" id="geo-btn">Usa posizione attuale</button>
              </div>
              <div class="nr-pos-search">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input class="input" name="via" id="via-input" placeholder="Cerca un indirizzo, es. Via Roma 1, Carate Brianza" autocomplete="off" />
              </div>
              ${locationFieldsHtml({ regione: "Lombardia", provincia: "Monza e Brianza", comune: "Verano Brianza" }, { required: true })}
              <input type="hidden" name="address_verified" id="address-verified" value="" />
              <div class="nr-verified-address" id="nr-verified-address" style="display:none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span id="nr-verified-text"></span>
                <button type="button" class="btn btn-ghost btn-small" id="verify-address-btn" style="margin-left:auto;">Verifica</button>
              </div>
              <button type="button" class="btn btn-ghost btn-small" id="verify-address-btn-2" style="margin-top:8px; width:100%;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                Verifica indirizzo
              </button>
              <div>
                <input type="hidden" name="coordinate" id="coordinate-input" />
              </div>
            </div>
            <div class="nr-position-map">
              <div class="map-panel nr-map-panel"><div id="map-new"></div></div>
              <button type="button" class="nr-map-gps-btn" id="geo-btn-map" title="Usa la mia posizione">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Privacy fissa a pubblico (anonimo non ancora supportato) -->
        <input type="hidden" name="privacy" value="pubblico" />

      </div><!-- /nr-layout -->

      <!-- ── Barra inferiore desktop ── -->
      <div class="nr-bottom-bar">
        <div class="nr-bottom-actions">
          <button class="btn btn-ghost" type="button" data-route="dashboard">Annulla</button>
          <button class="btn btn-primary" type="submit">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Invia segnalazione
          </button>
        </div>
      </div>

      <!-- ── CTA mobile sticky ── -->
      <div class="nr-mobile-cta">
        <button class="btn btn-primary" type="submit" style="width:100%; min-height:50px; font-size:1rem; font-weight:800; border-radius:var(--r-xl);">Invia segnalazione</button>
        <p class="nr-mobile-privacy">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          I tuoi dati sono protetti. <a href="#" style="color:var(--teal-3);">Scopri di più.</a>
        </p>
      </div>

    </form>
  `;
}

// ─── Profilo ──────────────────────────────────────────────────────────────────

function profileHtml() {
  const p = state.profile || {};
  const mine = state.reports.filter(r => r.user_id === state.user?.id);
  const likesReceived = mine.reduce((acc, r) => acc + Number(r.like_count || 0), 0);
  const resolved = mine.filter(r => r.stato === "risolta").length;
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
  const trustScore = (() => {
    if (!mine.length) return null;
    const resolvedRatio = resolved / mine.length;
    const likeRatio = Math.min(1, likesReceived / Math.max(1, mine.length * 3));
    const completionRatio = filled / profileFields.length;
    const raw = (resolvedRatio * 2) + (likeRatio * 2) + (completionRatio * 1);
    return Math.min(5, Math.max(1, raw)).toFixed(1);
  })();
  const trustLabel = (() => {
    if (trustScore === null) return "Da costruire";
    const n = Number(trustScore);
    if (n >= 4.5) return "Affidabilità elevata";
    if (n >= 3.5) return "Affidabilità buona";
    if (n >= 2.5) return "Affidabilità media";
    return "In crescita";
  })();

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
            <span class="profile-rep-value">${(mine.length * 50 + likesReceived * 10).toLocaleString("it")} punti</span>
          </div>
        </div>
      </div>
      <div class="profile-hero-right">
        <div class="profile-trust-box">
          <div class="profile-trust-score">${trustScore ?? "—"}<span>/5</span></div>
          <div class="profile-trust-label">${escapeHtml(trustLabel)}</div>
          <p class="profile-trust-sub">${trustScore === null ? "Crea la tua prima segnalazione per attivare il punteggio." : "Basato su % risolte, like ricevuti e completezza del profilo."}</p>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <b class="profile-kpi-value">${trustScore ?? "—"}${trustScore !== null ? `<small style="font-size:1rem">/5</small>` : ""}</b>
          <span class="profile-kpi-label">Affidabilità</span>
          <span class="profile-kpi-sub">${escapeHtml(trustLabel)}</span>
        </div>
      </div>
    </div>

    <!-- ── Layout a 2 colonne: contenuto principale + sidebar ── -->
    <div class="profile-layout">

      <!-- Colonna principale -->
      <div class="profile-main">

        <!-- Tab bar -->
        <div class="profile-tabs">
          <button class="profile-tab is-active" data-tab="segnalazioni">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Le mie segnalazioni
          </button>
          <button class="profile-tab" data-tab="attivita">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Attività recenti
          </button>
          <button class="profile-tab" data-tab="badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Badge e risultati
          </button>
          <button class="profile-tab" data-tab="impostazioni">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Impostazioni rapide
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

        <!-- Tab: Impostazioni rapide -->
        <div class="profile-tab-panel" data-panel="impostazioni" style="display:none;">
          <form id="profile-form" class="form-grid">
            <div class="field">
              <label>Nome completo</label>
              <input class="input" name="full_name" value="${escapeAttr(p.full_name || "")}" />
            </div>
            <div class="field">
              <label>Username</label>
              <input class="input" name="username" value="${escapeAttr(p.username || "")}" />
            </div>
            <div class="field span-2">
              <label>Bio</label>
              <textarea class="textarea" name="bio" placeholder="Racconta brevemente chi sei.">${escapeHtml(p.bio || "")}</textarea>
            </div>
            ${locationFieldsHtml(p, { required: false })}
            <div class="field span-2">
              <label>Foto profilo</label>
              ${avatarUploadHtml(p, "profile")}
            </div>
            <div class="span-2 profile-form-actions">
              <button class="btn btn-soft" type="reset">Annulla</button>
              <button class="btn btn-primary" type="submit">Salva profilo</button>
            </div>
          </form>
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
          <button class="btn btn-soft" style="width:100%; font-size:0.84rem;" data-tab-target="impostazioni">Completa profilo →</button>
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
        <h3 class="panel-title">I miei traguardi</h3>
      </div>
      <div style="height:12px"></div>
      <div class="profile-achievement-item">
        <div class="profile-achievement-icon" style="background:rgba(139,92,246,0.2); color:#c4b5fd;">🛡️</div>
        <div class="profile-achievement-body">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong>Cittadino Attivo</strong>
            <span class="chip chip-primary" style="font-size:0.7rem;">Livello 3</span>
          </div>
          <div class="profile-progress-bar-wrap">
            <div class="profile-progress-bar" style="width: ${Math.min(100, Math.round(((mine.length * 50 + likesReceived * 10) / 2000) * 100))}%"></div>
          </div>
          <span style="font-size:0.75rem; color:var(--text-3);">${(mine.length * 50 + likesReceived * 10).toLocaleString("it")} / 2.000 punti</span>
        </div>
      </div>
    </div>
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

    <section class="admin-list" aria-label="Elenco segnalazioni admin">
      ${state.reports.length ? state.reports.map(adminCardHtml).join("") : emptyHtml("Nessuna segnalazione", "Quando gli utenti pubblicano segnalazioni, le trovi qui.")}
    </section>
  `;
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
  $("#logout-btn")?.addEventListener("click", handleLogout);
  document.querySelector(".mobile-logout-btn")?.addEventListener("click", handleLogout);

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
    bindProfileTabs();
    bindLocationControls($("#profile-form"));
    bindAvatarUpload($("#profile-form"));
    bindProfileForm();
    bindReportActions();

    // Pulsanti "Modifica profilo" aprono tab impostazioni
    ["#edit-profile-btn", "#edit-profile-btn-2", "#edit-profile-btn-3"].forEach(sel => {
      $(sel)?.addEventListener("click", () => activateProfileTab("impostazioni"));
    });
    // Pulsante "Completa profilo →"
    $("[data-tab-target='impostazioni']")?.addEventListener("click", () => activateProfileTab("impostazioni"));
  }

  if (active === "admin") {
    bindAdminActions();
  }
}

function bindFilters() {
  // Desktop + mobile filter pairs: [desktopId, mobileId, stateKey, eventType]
  const mappings = [
    ["#filter-q",       "#filter-q",       "q",       "input"],
    ["#filter-comune",  "#filter-comune-m", "comune",  "change"],
    ["#filter-tipo",    "#filter-tipo-m",   "tipo",    "change"],
    ["#filter-stato",   "#filter-stato-m",  "stato",   "change"],
    ["#filter-sort",    "#filter-sort-m",   "sort",    "change"]
  ];

  function applyFilter(key, value) {
    state.filters[key] = value;
    // Sync gli altri selettori con lo stesso key
    mappings
      .filter(([, , k]) => k === key)
      .forEach(([dsk, mob]) => {
        const d = $(dsk);
        const m = $(mob);
        if (d && d.value !== value) d.value = value;
        if (m && m.value !== value) m.value = value;
      });
    const feed = $("#report-feed");
    if (feed) {
      const list = filteredReports();
      feed.innerHTML = list.length
        ? list.map(reportCardHtml).join("")
        : emptyHtml("Nessuna segnalazione trovata", "Prova a rimuovere qualche filtro o crea una nuova segnalazione.");
      bindReportActions();
      refreshMapMarkers();
    }
  }

  mappings.forEach(([dsk, mob, key, event]) => {
    $(dsk)?.addEventListener(event, (e) => applyFilter(key, e.target.value));
    if (mob !== dsk) $(mob)?.addEventListener(event, (e) => applyFilter(key, e.target.value));
  });
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
    btn.addEventListener("click", () => openReportDrawer(btn.dataset.id));
  });

  $$(".delete-own-report").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Vuoi eliminare questa segnalazione?")) return;
      await deleteReport(btn.dataset.id);
    });
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
        <input type="file" name="avatar_file" accept="image/*" data-avatar-input />
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
  const civico = form.querySelector("[name='civico']");
  [via, civico].filter(Boolean).forEach(el => el.addEventListener("input", () => resetAddressVerification(form)));
  form.querySelector("#verify-address-btn")?.addEventListener("click", async () => {
    const result = await verifyAddressFromForm(form);
    toast(result.message, result.ok ? "success" : "error");
  });
}

function resetAddressVerification(root = document) {
  const hidden = root.querySelector?.("#address-verified");
  const status = root.querySelector?.("#address-status");
  if (hidden) hidden.value = "";
  if (status) {
    status.textContent = "La via viene verificata con comune, provincia e regione prima della pubblicazione.";
    status.classList.remove("is-ok", "is-error");
  }
}

async function verifyAddressFromForm(form, { silent = false } = {}) {
  const formData = new FormData(form);
  const location = validateLocationSelection(formData);
  const status = form.querySelector("#address-status");
  const hidden = form.querySelector("#address-verified");
  if (!location.ok) return { ok: false, message: location.message };
  const via = clean(formData.get("via"));
  const civico = clean(formData.get("civico"));
  if (!via) return { ok: true, message: "Via non inserita: la segnalazione userà solo il comune." };
  if (status && !silent) {
    status.textContent = "Verifico l'indirizzo...";
    status.classList.remove("is-ok", "is-error");
  }
  try {
    const query = [via, civico, location.comune, location.provincia, location.regione, "Italia"].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=it&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json", "Accept-Language": "it" } });
    if (!res.ok) throw new Error("Servizio indirizzi non disponibile.");
    const [place] = await res.json();
    const display = normalizeLocationKey(place?.display_name || "");
    const comuneKey = normalizeLocationKey(location.comune);
    const viaToken = normalizeLocationKey(via).split(" ").filter(Boolean).find(x => x.length > 2) || "";
    const ok = Boolean(place && display.includes(comuneKey) && (!viaToken || display.includes(viaToken)));
    if (!ok) {
      if (hidden) hidden.value = "";
      if (status) { status.textContent = "Via non verificata per il comune selezionato."; status.classList.add("is-error"); }
      return { ok: false, message: "Via non verificata: controlla comune, via o usa il GPS." };
    }
    const lat = Number(place.lat);
    const lng = Number(place.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const coord = form.querySelector("#coordinate-input");
      if (coord && !coord.value) coord.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    if (hidden) hidden.value = "1";
    if (status) { status.textContent = "Via verificata correttamente."; status.classList.remove("is-error"); status.classList.add("is-ok"); }
    return { ok: true, message: "Via verificata correttamente.", lat, lng };
  } catch (error) {
    console.warn(error);
    if (hidden) hidden.value = "";
    if (status) { status.textContent = "Non riesco a verificare la via adesso."; status.classList.add("is-error"); }
    return { ok: false, message: "Verifica via non riuscita: riprova o usa GPS." };
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
      if (priorityHidden) priorityHidden.value = btn.dataset.val || "";
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
  bindCharCounter("nr-titolo", "titolo-count", 100);
  bindCharCounter("nr-desc", "desc-count", 1000);

  // ── Photo upload & previews ───────────────────────────────────────────
  const photoInput = $("#photo-input");
  const photoPreviews = $("#photo-previews");
  const MAX_PHOTOS = 5;
  let photoFiles = [];

  function refreshPhotoPreviews() {
    if (!photoPreviews) return;
    photoPreviews.innerHTML = "";
    photoFiles.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const item = document.createElement("div");
        item.className = "nr-photo-preview-item";
        item.innerHTML = `
          <img src="${e.target.result}" alt="Foto ${idx+1}" />
          <button type="button" class="nr-photo-preview-remove" data-idx="${idx}" title="Rimuovi">&times;</button>
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
    const remaining = MAX_PHOTOS - photoFiles.length;
    photoFiles = photoFiles.concat(files.slice(0, remaining));
    refreshPhotoPreviews();
  });

  photoInput?.addEventListener("change", () => {
    const files = Array.from(photoInput.files || []).filter(f => f.type.startsWith("image/"));
    const remaining = MAX_PHOTOS - photoFiles.length;
    photoFiles = photoFiles.concat(files.slice(0, remaining));
    photoInput.value = "";
    refreshPhotoPreviews();
  });

  // Camera button
  $("#camera-btn")?.addEventListener("click", () => {
    const ci = document.createElement("input");
    ci.type = "file";
    ci.accept = "image/*";
    ci.capture = "environment";
    ci.addEventListener("change", () => {
      const files = Array.from(ci.files || []);
      const remaining = MAX_PHOTOS - photoFiles.length;
      photoFiles = photoFiles.concat(files.slice(0, remaining));
      refreshPhotoPreviews();
    });
    ci.click();
  });

  // Gallery button
  $("#gallery-btn")?.addEventListener("click", () => {
    photoInput?.click();
  });

  // ── GPS button ────────────────────────────────────────────────────────
  $("#geo-btn-map")?.addEventListener("click", useGeolocationForNewMap);
  $("#geo-btn")?.addEventListener("click", useGeolocation);

  // ── Position tabs ─────────────────────────────────────────────────────
  $$(".nr-pos-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".nr-pos-tab").forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
    });
  });

  // ── Map #map-new initialization ───────────────────────────────────────
  setTimeout(() => {
  const mapNewEl = $("#map-new");
  if (mapNewEl && window.L && !state.mapNew) {
    const center = [45.584, 9.274];
    state.mapNew = L.map(mapNewEl, { scrollWheelZoom: false }).setView(center, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(state.mapNew);
    setTimeout(() => state.mapNew?.invalidateSize(), 180);

    // Click on map to set coordinates
    state.mapNew.on("click", (e) => {
      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);
      const coordInput = form.querySelector("[name='coordinate']") || form.querySelector("#coordinate-input");
      if (coordInput) coordInput.value = `${lat}, ${lng}`;
      // Place a marker
      if (state.mapNewMarker) state.mapNewMarker.remove();
      state.mapNewMarker = L.marker([lat, lng]).addTo(state.mapNew);
      // Reverse geocode
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, { headers: { "Accept": "application/json" } })
        .then(r => r.json())
        .then(json => {
          const address = json.address || {};
          setLocationFromAddress(address);
          setInputValue("[name='via']", address.road || "");
          setInputValue("[name='civico']", address.house_number || "");
          const verifiedText = $("#nr-verified-text");
          if (verifiedText) verifiedText.textContent = json.display_name || "";
        })
        .catch(() => {});
    });
  }
  }, 60); // end setTimeout for map init

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
    await createReport(event.currentTarget);
  });
}

function activateProfileTab(tabName) {
  $$(".profile-tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === tabName));
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
  $$(".profile-tab").forEach(tab => {
    tab.addEventListener("click", () => activateProfileTab(tab.dataset.tab));
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
      if (!confirm("Eliminare definitivamente questa segnalazione?")) return;
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

function useGeolocationForNewMap() {
  if (!navigator.geolocation) return toast("Geolocalizzazione non disponibile su questo browser.", "error");
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    if (state.mapNew) {
      state.mapNew.setView([lat, lng], 16);
      if (state.mapNewMarker) state.mapNewMarker.remove();
      state.mapNewMarker = L.marker([lat, lng]).addTo(state.mapNew);
    }
    const form = $("#report-form");
    const coordInput = form?.querySelector("[name='coordinate']") || form?.querySelector("#coordinate-input");
    if (coordInput) coordInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    toast("Posizione rilevata.", "success");
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      const json = await res.json();
      const address = json.address || {};
      setLocationFromAddress(address);
      setInputValue("[name='via']", address.road || "");
      setInputValue("[name='civico']", address.house_number || "");
      const verifiedText = $("#nr-verified-text");
      if (verifiedText) verifiedText.textContent = json.display_name || "";
    } catch (err) { console.warn(err); }
  }, () => {
    toast("Non riesco a recuperare la posizione. Controlla i permessi del browser.", "error");
  }, { enableHighAccuracy: true, timeout: 9000 });
}

async function useGeolocation() {
  if (!navigator.geolocation) return toast("Geolocalizzazione non disponibile su questo browser.", "error");

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    $("#coordinate-input").value = `${lat}, ${lng}`;
    toast("Coordinate rilevate.", "success");

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      const json = await res.json();
      const address = json.address || {};
      setLocationFromAddress(address);
      setInputValue("[name='via']", address.road || "");
      setInputValue("[name='civico']", address.house_number || "");
    } catch (error) {
      console.warn(error);
    }
  }, () => {
    toast("Non riesco a recuperare la posizione. Controlla i permessi del browser.", "error");
  }, { enableHighAccuracy: true, timeout: 9000 });
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
  const photoFile = formData.get("photo");

  const payload = {
    user_id: state.user.id,
    titolo: clean(formData.get("titolo")),
    tipo: clean(formData.get("tipo")),
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
    photo_url: null,
    like_count: 0,
    photoFile: photoFile instanceof File && photoFile.size > 0 ? photoFile : null
  };

  if (!payload.titolo || !payload.tipo || !payload.descrizione || !payload.comune) {
    return toast("Titolo, categoria, descrizione e comune sono obbligatori.", "error");
  }

  if (payload.via && String(formData.get("address_verified") || "") !== "1") {
    const verified = await verifyAddressFromForm(form, { silent: true });
    if (!verified.ok) {
      return toast(verified.message || "Via non verificata: controlla l'indirizzo o usa il GPS.", "error");
    }
    if (!coords && verified.lat && verified.lng) {
      payload.lat = verified.lat;
      payload.lng = verified.lng;
    }
  }

  try {
    await backend.createReport(payload);
    state.page = 0;
    await refreshData();
    toast("Segnalazione pubblicata.", "success");
    setRoute("dashboard");
  } catch (error) {
    console.error(error);
    toast(error.message || "Non sono riuscito a pubblicare la segnalazione.", "error");
  }
}

async function updateProfile(formData) {
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
    state.profile = await backend.saveProfile(state.user.id, payload);
    await refreshData();
    toast("Profilo aggiornato.", "success");
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Profilo non aggiornato.", "error");
  }
}

async function toggleLike(reportId) {
  if (!state.user) return setRoute("auth");
  const alreadyLiked = state.likes.has(reportId);
  try {
    await backend.toggleLike(state.user.id, reportId, alreadyLiked);
    await refreshData();
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Like non aggiornato.", "error");
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
          <span class="chip like-count-chip" aria-label="Numero voti">❤️ <b>${Number(report.like_count || 0)}</b></span>
        </div>
        <div style="height:12px"></div>
        <h2>${escapeHtml(report.titolo || report.tipo)}</h2>
        <p style="color:var(--text-2); line-height:1.6; font-size:1.04rem;">${escapeHtml(report.descrizione || "")}</p>
        <div class="detail-grid">
          <div class="detail-box"><b>Categoria</b><span>${escapeHtml(capitalize(report.tipo || "—"))}</span></div>
          <div class="detail-box"><b>Comune</b><span>${escapeHtml(report.comune || "—")}</span></div>
          <div class="detail-box"><b>Indirizzo</b><span>${escapeHtml(formatAddress(report))}</span></div>
          <div class="detail-box"><b>Autore</b><span>${escapeHtml(authorName(report))}</span></div>
          <div class="detail-box"><b>Data</b><span>${escapeHtml(formatDate(report.created_at))}</span></div>
          <div class="detail-box"><b>Coordinate</b><span>${report.lat && report.lng ? `${report.lat}, ${report.lng}` : "Non impostate"}</span></div>
        </div>
        <div class="report-actions">
          <button class="btn btn-primary like-btn ${state.likes.has(report.id) ? "is-liked" : ""}" data-id="${report.id}">${state.likes.has(report.id) ? "❤️ Ti piace" : "🤍 Vota"} <span class="btn-like-count">${Number(report.like_count || 0)}</span></button>
          <button class="btn btn-soft" data-route="new">Nuova segnalazione</button>
        </div>
      </div>
    </article>
  `;

  document.body.appendChild(backdrop);
  backdrop.querySelector(".drawer-close").addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  backdrop.querySelector(".like-btn")?.addEventListener("click", async () => {
    await toggleLike(report.id);
    backdrop.remove();
  });
  backdrop.querySelector("[data-route]")?.addEventListener("click", (e) => {
    backdrop.remove();
    setRoute(e.currentTarget.dataset.route);
  });
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
          <span class="chip like-count-chip" aria-label="Numero voti">❤️ <b>${Number(report.like_count || 0)}</b></span>
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
  const q = state.filters.q.trim().toLowerCase();
  let list = [...state.reports];

  if (q) {
    list = list.filter(r => [r.titolo, r.tipo, r.descrizione, r.comune, r.via, authorName(r)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q));
  }

  if (state.filters.comune) list = list.filter(r => r.comune === state.filters.comune);
  if (state.filters.tipo) list = list.filter(r => r.tipo === state.filters.tipo);
  if (state.filters.stato) list = list.filter(r => r.stato === state.filters.stato);

  if (state.filters.sort === "like") list.sort((a, b) => Number(b.like_count || 0) - Number(a.like_count || 0));
  else if (state.filters.sort === "urgenti") list.sort((a, b) => priorityValue(b.priorita) - priorityValue(a.priorita));
  else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return list;
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
    navItem("new", "+", "Nuova segnalazione", active, { plus: true }),
    navItem("profile", profileNavIconHtml(), "Profilo", active, { htmlIcon: true })
  ];

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
      L'interfaccia è collegata a Netlify Functions e Netlify Blobs. Online i dati vengono salvati in modo persistente su Netlify.
    </div>
  `;
}

function emptyHtml(title, text) {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(text)}</div>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function installGlobalToastStack() {
  if ($(".toast-stack")) return;
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  document.body.appendChild(stack);
}

function toast(message, type = "") {
  const stack = $(".toast-stack") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "toast-stack" }));
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
