import { SUPABASE_URL, SUPABASE_ANON_KEY, FORCE_DEMO_MODE } from "./config.js";
import { createProxySupabaseClient } from "./supabase-proxy.js";

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

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const app = $("#app");

const hasSupabaseConfig = Boolean(SUPABASE_URL?.startsWith("https://") && SUPABASE_ANON_KEY?.length > 20);
const DEMO_MODE = FORCE_DEMO_MODE || !hasSupabaseConfig;
// Client backend tramite Netlify Function same-origin.
// Questa versione evita le chiamate dirette del browser a *.supabase.co,
// che nel tuo caso generavano "Failed to fetch" anche con URL/key corretti.
const supabase = DEMO_MODE ? null : createProxySupabaseClient({
  supabaseUrl: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
});

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
        origin: window.location.origin,
        apiProxy: "/.netlify/functions/civicvois-api"
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

async function ensureProfileFromAuth(user, extra = {}) {
  if (!user || DEMO_MODE) return;

  const metadata = user.user_metadata || {};
  const emailName = String(user.email || "utente").split("@")[0];
  const fallbackUsername = cleanUsername(extra.username || metadata.username || emailName || `utente-${String(user.id).slice(0, 6)}`);

  const payload = {
    id: user.id,
    email: user.email || extra.email || null,
    username: fallbackUsername,
    full_name: clean(extra.full_name || metadata.full_name || fallbackUsername),
    comune: clean(extra.comune || metadata.comune || "")
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
}

function cleanUsername(value) {
  const cleaned = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 28);
  return cleaned || `utente-${crypto.randomUUID().slice(0, 6)}`;
}

function niceBackendError(error, fallback = "Operazione non riuscita.") {
  const raw = String(error?.message || error?.error_description || error || "").trim();
  const message = raw.toLowerCase();

  if (message.includes("failed to fetch")) return `${fallback} Connessione non riuscita. Questa build usa una Netlify Function proxy: controlla che il deploy abbia incluso la cartella netlify/functions e che Netlify abbia pubblicato le Functions.`;
  if (message.includes("invalid login credentials")) return "Email o password non corretti.";
  if (message.includes("email not confirmed")) return "Accesso non riuscito. Controlla email e password.";
  if (message.includes("already registered") || message.includes("user already registered")) return "Questo indirizzo email è già registrato. Vai su Accedi.";
  if (message.includes("duplicate") && message.includes("username")) return "Username già usato. Scegline uno diverso.";
  if (message.includes("violates row-level security") || message.includes("row-level security")) return `${fallback} Permessi backend da correggere.`;

  return raw || fallback;
}

const state = {
  route: "landing",
  session: null,
  user: null,
  profile: null,
  reports: [],
  likes: new Set(),
  filters: {
    q: "",
    comune: "",
    tipo: "",
    stato: "",
    sort: "recenti"
  },
  map: null,
  markers: [],
  uploading: false
};

const demo = createDemoBackend();

installDebugHelpers();
init();

async function init() {
  installGlobalToastStack();
  bindHashRouter();

  if (!DEMO_MODE) {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      state.user = session?.user || null;
      if (state.user) await loadProfile();
      else state.profile = null;
      await refreshData();
      render();
    });
  }

  await bootstrapAuth();
  await refreshData();
  render();
}

function bindHashRouter() {
  window.addEventListener("hashchange", async () => {
    const next = readRouteFromHash();
    state.route = normalizeRoute(next);
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
  return route || "landing";
}

async function bootstrapAuth() {
  if (DEMO_MODE) {
    const saved = readLocal("cv_demo_user", null);
    if (saved) {
      state.user = saved;
      state.profile = demo.getProfile(saved.id);
    }
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error(error);
    toast("Errore durante il controllo della sessione.", "error");
  }
  state.session = data?.session || null;
  state.user = data?.session?.user || null;
  if (state.user) await loadProfile();
}

async function refreshData() {
  // Nella pagina di accesso/registrazione non serve leggere subito il feed.
  // Prima appariva "fetch failed" appena aprivi #/auth, anche prima di cliccare.
  if (!state.user && state.route === "auth") {
    state.reports = [];
    state.likes = new Set();
    return;
  }
  await Promise.all([loadReports(), loadLikes()]);
}

async function loadProfile() {
  if (!state.user) return;

  if (DEMO_MODE) {
    state.profile = demo.getProfile(state.user.id);
    return;
  }

  try {
    const { data, error } = await withRetry(() => supabase
      .from("profiles")
      .select("*")
      .eq("id", state.user.id)
      .maybeSingle()
    );

    if (error) throw error;

    if (!data) {
      await ensureProfileFromAuth(state.user);
      const { data: created, error: createdError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", state.user.id)
        .maybeSingle();
      if (createdError) throw createdError;
      state.profile = created;
      return;
    }

    state.profile = data;
  } catch (error) {
    console.error("Errore caricamento profilo", error);
    toast(niceBackendError(error, "Profilo non caricato."), "error");
  }
}

async function loadReports() {
  if (DEMO_MODE) {
    state.reports = demo.listReports();
    return;
  }

  try {
    // Lettura in due passaggi, senza join PostgREST embedded.
    // È più solida perché non dipende dal nome della relazione nella cache della relazione dati.
    const { data: reports, error } = await withRetry(() => supabase
      .from("segnalazioni")
      .select("id,user_id,titolo,tipo,descrizione,priorita,stato,regione,provincia,comune,via,civico,lat,lng,photo_url,like_count,created_at,updated_at")
      .order("created_at", { ascending: false })
    );

    if (error) throw error;

    const rows = reports || [];
    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
    let profilesById = {};

    if (userIds.length) {
      const { data: profiles, error: profileError } = await withRetry(() => supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,comune")
        .in("id", userIds)
      );

      if (profileError) {
        console.warn("Profili autore non caricati", profileError);
      } else {
        profilesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]));
      }
    }

    state.reports = rows.map(report => ({
      ...report,
      profiles: profilesById[report.user_id] || null
    }));
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

  if (DEMO_MODE) {
    state.likes = demo.getLikes(state.user.id);
    return;
  }

  const { data, error } = await withRetry(() => supabase
    .from("interazioni")
    .select("segnalazione_id")
    .eq("utente_id", state.user.id)
  );

  if (error) {
    console.error(error);
    state.likes = new Set();
    return;
  }

  state.likes = new Set((data || []).map(row => row.segnalazione_id));
}

function render() {
  if (!state.user && ["auth"].includes(state.route)) return renderAuthPage();
  if (!state.user && ["dashboard", "new", "profile", "admin", "settings"].includes(state.route)) return renderAuthPage();

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
      return renderApp("admin");
    case "settings":
      return renderApp("settings");
    default:
      return renderLanding();
  }
}

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
            <div class="hero-stats">
              <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">segnalazioni</div></div>
              <div class="stat-card"><div class="stat-value">${stats.open}</div><div class="stat-label">aperte</div></div>
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

function renderAuthPage(mode = "login") {
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
      <div class="field">
        <label>Comune</label>
        <input class="input" name="comune" type="text" placeholder="Verano Brianza" />
      </div>
      <button class="btn btn-primary" type="submit">Crea account</button>
    </form>
  `;
}

document.addEventListener("click", async (event) => {
  const fast = event.target.closest("#demo-fast-login");
  if (fast) {
    await handleDemoFastLogin();
  }
});

async function handleDemoFastLogin() {
  if (!DEMO_MODE) {
    toast("Il login demo è disponibile solo se il backend non è configurato.", "warning");
    return;
  }
  state.user = demo.ensureUser({
    email: "demo@civicvois.it",
    password: "civicvois",
    full_name: "Utente Demo CivicVois",
    username: "demo",
    comune: "Verano Brianza"
  });
  state.profile = demo.getProfile(state.user.id);
  writeLocal("cv_demo_user", state.user);
  await refreshData();
  toast("Accesso demo effettuato.", "success");
  setRoute("dashboard");
}

async function handleLogin(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (DEMO_MODE) {
    const user = demo.login(email, password);
    if (!user) return toast("Credenziali demo non trovate. Registrati o usa il pulsante demo.", "error");
    state.user = user;
    state.profile = demo.getProfile(user.id);
    writeLocal("cv_demo_user", user);
    await refreshData();
    toast("Accesso effettuato.", "success");
    return setRoute("dashboard");
  }

  try {
    const { data, error } = await withRetry(() => supabase.auth.signInWithPassword({ email, password }));
    if (error) return toast(niceBackendError(error, "Accesso non riuscito."), "error");
    state.session = data.session;
    state.user = data.user;
    await ensureProfileFromAuth(data.user);
    await loadProfile();
    await refreshData();
    toast("Accesso effettuato.", "success");
    setRoute("dashboard");
  } catch (error) {
    console.error("Errore login", error);
    toast(niceBackendError(error, "Accesso non riuscito."), "error");
  }
}

async function handleRegister(formData) {
  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    username: String(formData.get("username") || "").trim().toLowerCase(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    password: String(formData.get("password") || ""),
    comune: String(formData.get("comune") || "").trim()
  };

  if (!payload.full_name || !payload.username || !payload.email || payload.password.length < 6) {
    return toast("Compila correttamente tutti i campi obbligatori.", "error");
  }

  if (DEMO_MODE) {
    const user = demo.ensureUser(payload);
    state.user = user;
    state.profile = demo.getProfile(user.id);
    writeLocal("cv_demo_user", user);
    await refreshData();
    toast("Account demo creato.", "success");
    return setRoute("dashboard");
  }

  try {
    const { data, error } = await withRetry(() => supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.full_name,
          username: payload.username,
          comune: payload.comune
        }
      }
    }));

    if (error) return toast(niceBackendError(error, "Registrazione non riuscita."), "error");

    if (data.user && data.session) {
      state.session = data.session;
      state.user = data.user;
      await ensureProfileFromAuth(data.user, payload);
      await loadProfile();
      await refreshData();
      toast("Registrazione completata.", "success");
      return setRoute("dashboard");
    }

    toast("Account creato. Ora puoi usare CivicVois.", "success");
    renderAuthPage("login");
  } catch (error) {
    console.error("Errore registrazione", error);
    toast(niceBackendError(error, "Registrazione non riuscita."), "error");
  }
}

async function handleLogout() {
  if (DEMO_MODE) {
    localStorage.removeItem("cv_demo_user");
    state.user = null;
    state.profile = null;
    state.likes = new Set();
    toast("Logout effettuato.", "success");
    return setRoute("landing");
  }

  const { error } = await supabase.auth.signOut();
  if (error) return toast("Logout non riuscito.", "error");
  state.user = null;
  state.profile = null;
  state.likes = new Set();
  toast("Logout effettuato.", "success");
  setRoute("landing");
}

function renderApp(active) {
  app.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        ${brandHtml()}
        ${navHtml(active)}
        <div class="side-bottom">
          ${userMiniHtml()}
          <button class="btn btn-ghost" id="logout-btn">Esci</button>
        </div>
      </aside>
      <div>
        <header class="mobile-topbar">
          ${brandHtml()}
          <button class="icon-btn" id="mobile-logout-btn" title="Logout">↗</button>
        </header>
        <main class="main">
          ${active === "dashboard" ? dashboardHtml() : ""}
          ${active === "new" ? newReportHtml() : ""}
          ${active === "profile" ? profileHtml() : ""}
          ${active === "admin" ? adminHtml() : ""}
          ${active === "settings" ? settingsHtml() : ""}
        </main>
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

function dashboardHtml() {
  const stats = getStats();
  const filtered = filteredReports();

  return `
    <div class="topbar">
      <div>
        <h1>Dashboard civica</h1>
        <p>Controlla segnalazioni, priorità e aggiornamenti del territorio.</p>
      </div>
      <button class="btn btn-primary" data-route="new">+ Nuova segnalazione</button>
    </div>

    ${DEMO_MODE ? demoNoticeHtml() : ""}

    <section class="stats-grid" aria-label="Statistiche">
      <div class="kpi-card"><b>${stats.total}</b><span>Totali</span></div>
      <div class="kpi-card"><b>${stats.open}</b><span>Aperte</span></div>
      <div class="kpi-card"><b>${stats.inProgress}</b><span>In carico</span></div>
      <div class="kpi-card"><b>${stats.resolved}</b><span>Risolte</span></div>
    </section>

    <section class="dashboard-grid">
      <div>
        <div class="filters">
          <div class="search-field">
            <input class="input" id="filter-q" placeholder="Cerca per parola, via, comune..." value="${escapeAttr(state.filters.q)}" />
          </div>
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
        <div class="feed" id="report-feed">
          ${filtered.length ? filtered.map(reportCardHtml).join("") : emptyHtml("Nessuna segnalazione trovata", "Prova a rimuovere qualche filtro o crea una nuova segnalazione.")}
        </div>
      </div>

      <aside class="panel panel-pad">
        <div class="map-panel"><div id="map"></div></div>
        <div style="height: 16px"></div>
        <h2 class="panel-title">Attività recenti</h2>
        <p class="panel-subtitle">Ultimi aggiornamenti dalla piattaforma.</p>
        <div style="height: 14px"></div>
        <div class="activity-list">
          ${state.reports.slice(0, 5).map(activityHtml).join("") || emptyHtml("Nessuna attività", "Le attività compariranno qui.")}
        </div>
      </aside>
    </section>
  `;
}

function newReportHtml() {
  return `
    <div class="topbar">
      <div>
        <h1>Nuova segnalazione</h1>
        <p>Più dettagli inserisci, più la segnalazione diventa utile e credibile.</p>
      </div>
      <button class="btn btn-dark" data-route="dashboard">Torna al feed</button>
    </div>

    <section class="panel panel-pad">
      <form id="report-form" class="form-grid">
        <div class="field span-2">
          <label>Titolo</label>
          <input class="input" name="titolo" placeholder="Esempio: Buca pericolosa vicino alle strisce" required maxlength="90" />
        </div>
        <div class="field">
          <label>Categoria</label>
          <select class="select" name="tipo" required>
            <option value="">Seleziona categoria</option>
            ${CATEGORIES.map(c => `<option value="${escapeAttr(c)}">${capitalize(c)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Priorità</label>
          <select class="select" name="priorita" required>
            ${PRIORITIES.map(p => `<option value="${p}">${capitalize(p)}</option>`).join("")}
          </select>
        </div>
        <div class="field span-2">
          <label>Descrizione</label>
          <textarea class="textarea" name="descrizione" placeholder="Spiega cosa succede, perché è un problema e se è urgente." required minlength="12"></textarea>
        </div>
        <div class="field">
          <label>Regione</label>
          <input class="input" name="regione" placeholder="Lombardia" />
        </div>
        <div class="field">
          <label>Provincia</label>
          <input class="input" name="provincia" placeholder="Monza e Brianza" />
        </div>
        <div class="field">
          <label>Comune</label>
          <input class="input" name="comune" placeholder="Verano Brianza" required />
        </div>
        <div class="field">
          <label>Via</label>
          <input class="input" name="via" placeholder="Via Roma" />
        </div>
        <div class="field">
          <label>Civico</label>
          <input class="input" name="civico" placeholder="12" maxlength="12" />
        </div>
        <div class="field">
          <label>Coordinate</label>
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 8px;">
            <input class="input" name="coordinate" id="coordinate-input" placeholder="lat, lng" />
            <button class="btn btn-soft btn-small" type="button" id="geo-btn">GPS</button>
          </div>
        </div>
        <div class="field span-2">
          <label>Foto</label>
          <label class="upload-box" id="upload-box">
            <input type="file" name="photo" accept="image/*" id="photo-input" />
            <div id="upload-copy"><strong>Carica una foto</strong><br><span style="color: var(--muted); font-weight: 650;">PNG, JPG o JPEG. Consigliato: immagine chiara del problema.</span></div>
          </label>
        </div>
        <div class="span-2" style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
          <button class="btn btn-soft" type="reset">Svuota</button>
          <button class="btn btn-primary" type="submit">Pubblica segnalazione</button>
        </div>
      </form>
    </section>
  `;
}

function profileHtml() {
  const p = state.profile || {};
  const mine = state.reports.filter(r => r.user_id === state.user?.id);
  const likesReceived = mine.reduce((acc, r) => acc + Number(r.like_count || 0), 0);

  return `
    <div class="topbar">
      <div>
        <h1>Profilo</h1>
        <p>Gestisci la tua identità pubblica e la tua attività civica.</p>
      </div>
      <button class="btn btn-primary" data-route="new">Nuova segnalazione</button>
    </div>

    <section class="dashboard-grid">
      <div class="panel">
        <div class="profile-cover"></div>
        <div class="profile-head">
          ${avatarHtml(p, "profile-avatar")}
          <div>
            <h2>${escapeHtml(p.full_name || "Utente CivicVois")}</h2>
            <p>@${escapeHtml(p.username || "utente")} · ${escapeHtml(p.comune || "Comune non impostato")}</p>
          </div>
        </div>
        <div class="panel-pad" style="padding-top:0;">
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
            <div class="field">
              <label>Regione</label>
              <input class="input" name="regione" value="${escapeAttr(p.regione || "")}" />
            </div>
            <div class="field">
              <label>Provincia</label>
              <input class="input" name="provincia" value="${escapeAttr(p.provincia || "")}" />
            </div>
            <div class="field span-2">
              <label>Comune</label>
              <input class="input" name="comune" value="${escapeAttr(p.comune || "")}" />
            </div>
            <div class="span-2" style="display:flex; justify-content:flex-end;"><button class="btn btn-primary" type="submit">Salva profilo</button></div>
          </form>
        </div>
      </div>
      <aside class="panel panel-pad">
        <h2 class="panel-title">Impatto</h2>
        <p class="panel-subtitle">Quanto hai contribuito alla piattaforma.</p>
        <div style="height:16px"></div>
        <div class="stats-grid" style="grid-template-columns: 1fr;">
          <div class="kpi-card"><b>${mine.length}</b><span>Segnalazioni create</span></div>
          <div class="kpi-card"><b>${likesReceived}</b><span>Like ricevuti</span></div>
          <div class="kpi-card"><b>${mine.filter(r => r.stato === "risolta").length}</b><span>Risolte</span></div>
        </div>
      </aside>
    </section>

    <div style="height:18px"></div>
    <section class="panel panel-pad">
      <h2 class="panel-title">Le tue segnalazioni</h2>
      <div style="height:16px"></div>
      <div class="feed">${mine.length ? mine.map(reportCardHtml).join("") : emptyHtml("Non hai ancora creato segnalazioni", "Quando ne pubblichi una, la trovi qui.")}</div>
    </section>
  `;
}

function adminHtml() {
  const isAdmin = state.profile?.role === "admin";
  if (!isAdmin) {
    return `
      <div class="topbar"><div><h1>Area admin</h1><p>Accesso riservato agli amministratori.</p></div></div>
      <section class="panel panel-pad">${emptyHtml("Non sei amministratore", "Il primo account registrato diventa admin automaticamente.")}</section>
    `;
  }

  return `
    <div class="topbar">
      <div>
        <h1>Area admin</h1>
        <p>Gestisci stati, priorità e qualità delle segnalazioni.</p>
      </div>
      <button class="btn btn-primary" data-route="new">+ Nuova</button>
    </div>
    <section class="panel panel-pad">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Segnalazione</th><th>Comune</th><th>Priorità</th><th>Stato</th><th>Like</th><th>Azioni</th></tr></thead>
          <tbody>
            ${state.reports.map(r => `
              <tr>
                <td><strong>${escapeHtml(r.titolo || r.tipo)}</strong><br><span style="color:var(--muted); font-size:.86rem;">${escapeHtml(formatDate(r.created_at))}</span></td>
                <td>${escapeHtml(r.comune || "—")}</td>
                <td>${priorityChip(r.priorita)}</td>
                <td>
                  <select class="select admin-status" data-id="${r.id}">
                    ${STATUSES.map(s => `<option value="${s}" ${r.stato === s ? "selected" : ""}>${capitalize(s)}</option>`).join("")}
                  </select>
                </td>
                <td>${Number(r.like_count || 0)}</td>
                <td><button class="btn btn-danger btn-small delete-report" data-id="${r.id}">Elimina</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function settingsHtml() {
  return `
    <div class="topbar"><div><h1>Impostazioni</h1><p>Configurazione tecnica e stato del backend.</p></div></div>
    <section class="panel panel-pad">
      <h2 class="panel-title">Stato progetto</h2>
      <p class="panel-subtitle">Qui capisci subito se il sito sta usando dati reali o solo la demo locale.</p>
      <div style="height:16px"></div>
      <div class="detail-grid">
        <div class="detail-box"><b>Backend</b><span>${DEMO_MODE ? "Demo locale" : "Netlify Blobs"}</span></div>
        <div class="detail-box"><b>Hosting</b><span>Compatibile Netlify</span></div>
        <div class="detail-box"><b>Auth</b><span>${DEMO_MODE ? "LocalStorage" : "Netlify Function"}</span></div>
      </div>
      ${DEMO_MODE ? demoNoticeHtml() : `<div class="notice" style="background:var(--success-soft); color:var(--success); border-color:#bbf7d0;"><strong>Backend Netlify collegato</strong>Il sito è pronto a salvare utenti, segnalazioni, like e immagini online.</div>`}
    </section>
  `;
}

function bindAppEvents(active) {
  $("#logout-btn")?.addEventListener("click", handleLogout);
  $("#mobile-logout-btn")?.addEventListener("click", handleLogout);

  if (active === "dashboard") {
    bindFilters();
    bindReportActions();
  }

  if (active === "new") {
    bindNewReportForm();
  }

  if (active === "profile") {
    bindProfileForm();
    bindReportActions();
  }

  if (active === "admin") {
    bindAdminActions();
  }
}

function bindFilters() {
  const mappings = [
    ["#filter-q", "q", "input"],
    ["#filter-comune", "comune", "change"],
    ["#filter-tipo", "tipo", "change"],
    ["#filter-stato", "stato", "change"],
    ["#filter-sort", "sort", "change"]
  ];

  mappings.forEach(([selector, key, event]) => {
    $(selector)?.addEventListener(event, (e) => {
      state.filters[key] = e.target.value;
      const feed = $("#report-feed");
      if (feed) {
        const list = filteredReports();
        feed.innerHTML = list.length ? list.map(reportCardHtml).join("") : emptyHtml("Nessuna segnalazione trovata", "Prova a rimuovere qualche filtro o crea una nuova segnalazione.");
        bindReportActions();
        refreshMapMarkers();
      }
    });
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

function bindNewReportForm() {
  const input = $("#photo-input");
  input?.addEventListener("change", () => previewPhoto(input));

  $("#geo-btn")?.addEventListener("click", useGeolocation);

  $("#report-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createReport(new FormData(event.currentTarget));
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
    select.addEventListener("change", async () => updateReportStatus(select.dataset.id, select.value));
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
      setInputValue("[name='comune']", address.town || address.city || address.village || "");
      setInputValue("[name='provincia']", address.county || "");
      setInputValue("[name='regione']", address.state || "");
      setInputValue("[name='via']", address.road || "");
      setInputValue("[name='civico']", address.house_number || "");
    } catch (error) {
      console.warn(error);
    }
  }, () => {
    toast("Non riesco a recuperare la posizione. Controlla i permessi del browser.", "error");
  }, { enableHighAccuracy: true, timeout: 9000 });
}

function setInputValue(selector, value) {
  if (!value) return;
  const el = $(selector);
  if (el && !el.value) el.value = value;
}

async function createReport(formData) {
  if (!state.user) return setRoute("auth");

  const coords = parseCoords(String(formData.get("coordinate") || ""));
  const photoFile = formData.get("photo");

  const payload = {
    user_id: state.user.id,
    titolo: clean(formData.get("titolo")),
    tipo: clean(formData.get("tipo")),
    descrizione: clean(formData.get("descrizione")),
    priorita: clean(formData.get("priorita")) || "media",
    stato: "nuova",
    regione: clean(formData.get("regione")),
    provincia: clean(formData.get("provincia")),
    comune: clean(formData.get("comune")),
    via: clean(formData.get("via")),
    civico: clean(formData.get("civico")),
    lat: coords?.lat || null,
    lng: coords?.lng || null,
    photo_url: null,
    like_count: 0
  };

  if (!payload.titolo || !payload.tipo || !payload.descrizione || !payload.comune) {
    return toast("Titolo, categoria, descrizione e comune sono obbligatori.", "error");
  }

  try {
    if (photoFile instanceof File && photoFile.size > 0) {
      payload.photo_url = await uploadPhoto(photoFile, "report-photos");
    }

    if (DEMO_MODE) {
      demo.addReport(payload);
    } else {
      const { error } = await supabase.from("segnalazioni").insert(payload);
      if (error) throw error;
    }

    await refreshData();
    toast("Segnalazione pubblicata.", "success");
    setRoute("dashboard");
  } catch (error) {
    console.error(error);
    toast(error.message || "Non sono riuscito a pubblicare la segnalazione.", "error");
  }
}

async function uploadPhoto(file, bucket) {
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!validTypes.includes(file.type)) throw new Error("Formato immagine non supportato.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Immagine troppo grande. Limite consigliato: 5 MB.");

  if (DEMO_MODE) return fileToDataUrl(file);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${state.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function updateProfile(formData) {
  const payload = {
    full_name: clean(formData.get("full_name")),
    username: clean(formData.get("username")).toLowerCase(),
    bio: clean(formData.get("bio")),
    regione: clean(formData.get("regione")),
    provincia: clean(formData.get("provincia")),
    comune: clean(formData.get("comune")),
    updated_at: new Date().toISOString()
  };

  try {
    if (DEMO_MODE) {
      demo.updateProfile(state.user.id, payload);
    } else {
      const { error } = await supabase.from("profiles").update(payload).eq("id", state.user.id);
      if (error) throw error;
    }

    await loadProfile();
    toast("Profilo aggiornato.", "success");
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Profilo non aggiornato.", "error");
  }
}

async function toggleLike(reportId) {
  if (!state.user) return setRoute("auth");
  const already = state.likes.has(reportId);

  try {
    if (DEMO_MODE) {
      demo.toggleLike(state.user.id, reportId);
    } else if (already) {
      const { error } = await supabase
        .from("interazioni")
        .delete()
        .eq("utente_id", state.user.id)
        .eq("segnalazione_id", reportId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("interazioni")
        .insert({ utente_id: state.user.id, segnalazione_id: reportId });
      if (error) throw error;
    }

    await refreshData();
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Like non aggiornato.", "error");
  }
}

async function updateReportStatus(id, status) {
  try {
    if (DEMO_MODE) {
      demo.updateReport(id, { stato: status });
    } else {
      const { error } = await supabase.from("segnalazioni").update({ stato: status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    }
    await refreshData();
    toast("Stato aggiornato.", "success");
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Stato non aggiornato.", "error");
  }
}

async function deleteReport(id) {
  try {
    if (DEMO_MODE) {
      demo.deleteReport(id);
    } else {
      const { error } = await supabase.from("segnalazioni").delete().eq("id", id);
      if (error) throw error;
    }
    await refreshData();
    toast("Segnalazione eliminata.", "success");
    render();
  } catch (error) {
    console.error(error);
    toast(error.message || "Eliminazione non riuscita.", "error");
  }
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
          <span class="chip">❤️ ${Number(report.like_count || 0)}</span>
        </div>
        <div style="height:12px"></div>
        <h2>${escapeHtml(report.titolo || report.tipo)}</h2>
        <p style="color:var(--muted); line-height:1.6; font-size:1.04rem;">${escapeHtml(report.descrizione || "")}</p>
        <div class="detail-grid">
          <div class="detail-box"><b>Categoria</b><span>${escapeHtml(capitalize(report.tipo || "—"))}</span></div>
          <div class="detail-box"><b>Comune</b><span>${escapeHtml(report.comune || "—")}</span></div>
          <div class="detail-box"><b>Indirizzo</b><span>${escapeHtml(formatAddress(report))}</span></div>
          <div class="detail-box"><b>Autore</b><span>${escapeHtml(authorName(report))}</span></div>
          <div class="detail-box"><b>Data</b><span>${escapeHtml(formatDate(report.created_at))}</span></div>
          <div class="detail-box"><b>Coordinate</b><span>${report.lat && report.lng ? `${report.lat}, ${report.lng}` : "Non impostate"}</span></div>
        </div>
        <div class="report-actions">
          <button class="btn btn-primary like-btn ${state.likes.has(report.id) ? "is-liked" : ""}" data-id="${report.id}">${state.likes.has(report.id) ? "❤️ Ti piace" : "🤍 Sostieni"}</button>
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

function initMap() {
  const mapEl = $("#map");
  if (!mapEl || !window.L) return;

  state.map = L.map(mapEl, { scrollWheelZoom: false }).setView([45.584, 9.274], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(state.map);

  refreshMapMarkers();
  setTimeout(() => state.map?.invalidateSize(), 180);
}

function refreshMapMarkers() {
  if (!state.map || !window.L) return;

  state.markers.forEach(marker => marker.remove());
  state.markers = [];

  const bounds = [];
  filteredReports().forEach(report => {
    const lat = Number(report.lat);
    const lng = Number(report.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const marker = L.marker([lat, lng]).addTo(state.map);
    marker.bindPopup(`<strong>${escapeHtml(report.titolo || report.tipo)}</strong><br>${escapeHtml(report.comune || "")}`);
    state.markers.push(marker);
    bounds.push([lat, lng]);
  });

  if (bounds.length) state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
}

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
          <span class="chip">❤️ ${Number(report.like_count || 0)}</span>
        </div>
        <p class="report-desc">${escapeHtml(report.descrizione || "")}</p>
        <div class="report-meta">
          <span class="chip">📍 ${escapeHtml(formatAddress(report))}</span>
          <span class="chip">👤 ${escapeHtml(authorName(report))}</span>
          <span class="chip">🕒 ${escapeHtml(formatDate(report.created_at))}</span>
        </div>
        <div class="report-actions">
          <button class="btn btn-small btn-primary open-detail" data-id="${report.id}">Dettagli</button>
          <button class="btn btn-small btn-soft like-btn ${liked ? "is-liked" : ""}" data-id="${report.id}">${liked ? "❤️ Votata" : "🤍 Sostieni"}</button>
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
    total: reports.length,
    open: reports.filter(r => ["nuova", "verificata"].includes(r.stato)).length,
    inProgress: reports.filter(r => r.stato === "in carico").length,
    resolved: reports.filter(r => r.stato === "risolta").length
  };
}

function navHtml(active) {
  return `
    <nav class="side-nav" aria-label="Menu app">
      ${navItem("dashboard", "🏠", "Dashboard", active)}
      ${navItem("new", "➕", "Nuova", active)}
      ${navItem("profile", "👤", "Profilo", active)}
      ${navItem("admin", "🛠️", "Admin", active)}
      ${navItem("settings", "⚙️", "Setup", active)}
    </nav>
  `;
}

function mobileNavHtml(active) {
  return `<nav class="mobile-nav">${navHtml(active).replace('<nav class="side-nav" aria-label="Menu app">', '').replace('</nav>', '')}</nav>`;
}

function navItem(route, icon, label, active) {
  return `<button class="side-link ${active === route ? "is-active" : ""}" data-route="${route}"><span class="nav-ico">${icon}</span><span>${label}</span></button>`;
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

function installGlobalToastStack() {
  if ($(".toast-stack")) return;
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  document.body.appendChild(stack);
}

function toast(message, type = "") {
  const stack = $(".toast-stack") || document.body.appendChild(Object.assign(document.createElement("div"), { className: "toast-stack" }));
  // Evita doppioni identici quando init, auth listener e refresh partono quasi insieme.
  const duplicate = Array.from(stack.children).some(child => child.textContent === message);
  if (duplicate) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 5200);
}

function uniqueValues(list, key) {
  return [...new Set(list.map(item => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function clean(value) {
  return String(value || "").trim();
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
          username: payload.username,
          comune: payload.comune,
          provincia: "",
          regione: "",
          role: "user",
          bio: ""
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
      if (idx >= 0) {
        db.users[idx] = { ...db.users[idx], ...payload };
        save();
      }
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
        author_name: this.getProfile(payload.user_id)?.full_name || "Utente CivicVois",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      save();
    },
    updateReport(id, payload) {
      const idx = db.reports.findIndex(r => r.id === id);
      if (idx >= 0) {
        db.reports[idx] = { ...db.reports[idx], ...payload, updated_at: new Date().toISOString() };
        save();
      }
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
