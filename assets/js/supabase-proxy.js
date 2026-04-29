// CivicVois Supabase proxy client
// Questa build non chiama più *.supabase.co direttamente dal browser.
// Tutte le richieste passano da una Netlify Function same-origin per evitare
// problemi di CORS, DNS locale, estensioni browser, mixed-content o TLS sul dominio custom.

const API_ENDPOINT = "/.netlify/functions/civicvois-api";
const SESSION_KEY = "cv_supabase_session_proxy_v1";

export function createProxySupabaseClient({ supabaseUrl, anonKey }) {
  const listeners = new Set();

  function getStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.access_token || !session?.user) return null;
      return session;
    } catch {
      return null;
    }
  }

  function setStoredSession(session) {
    if (!session?.access_token || !session?.user) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearStoredSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function notify(event, session) {
    for (const cb of listeners) {
      try { await cb(event, session); } catch (error) { console.warn("Auth listener CivicVois", error); }
    }
  }

  async function callProxy(payload, opts = {}) {
    const session = getStoredSession();
    const headers = {
      "Content-Type": "application/json",
      "X-CivicVois-Client": "netlify-proxy-v1"
    };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        client: {
          supabaseUrl,
          anonKey
        }
      })
    });

    let json = null;
    const text = await response.text();
    try { json = text ? JSON.parse(text) : null; } catch { json = { message: text }; }

    if (!response.ok || json?.error) {
      const message = json?.error?.message || json?.message || `Errore API CivicVois (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.details = json;
      throw error;
    }

    return json || {};
  }

  class QueryBuilder {
    constructor(table) {
      this.table = table;
      this.action = "select";
      this.columns = "*";
      this.filters = [];
      this.inFilters = [];
      this.orderBy = null;
      this.limitCount = null;
      this.singleMode = false;
      this.payload = null;
      this.onConflict = null;
      this.ignoreDuplicates = false;
    }

    select(columns = "*") { this.action = "select"; this.columns = columns; return this; }
    insert(payload) { this.action = "insert"; this.payload = payload; return this; }
    update(payload) { this.action = "update"; this.payload = payload; return this; }
    delete() { this.action = "delete"; return this; }
    upsert(payload, options = {}) {
      this.action = "upsert";
      this.payload = payload;
      this.onConflict = options.onConflict || null;
      this.ignoreDuplicates = Boolean(options.ignoreDuplicates);
      return this;
    }
    eq(column, value) { this.filters.push({ op: "eq", column, value }); return this; }
    in(column, values) { this.inFilters.push({ column, values: Array.isArray(values) ? values : [] }); return this; }
    order(column, options = {}) { this.orderBy = { column, ascending: options.ascending !== false }; return this; }
    limit(count) { this.limitCount = count; return this; }
    maybeSingle() { this.singleMode = true; return this; }

    async execute() {
      try {
        const res = await callProxy({
          kind: "db",
          action: this.action,
          table: this.table,
          columns: this.columns,
          filters: this.filters,
          inFilters: this.inFilters,
          orderBy: this.orderBy,
          limit: this.limitCount,
          single: this.singleMode,
          payload: this.payload,
          onConflict: this.onConflict,
          ignoreDuplicates: this.ignoreDuplicates
        });
        return { data: res.data ?? null, error: null, count: res.count ?? null };
      } catch (error) {
        return { data: null, error };
      }
    }

    then(resolve, reject) { return this.execute().then(resolve, reject); }
    catch(reject) { return this.execute().catch(reject); }
  }

  return {
    auth: {
      onAuthStateChange(callback) {
        listeners.add(callback);
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
      },
      async getSession() {
        return { data: { session: getStoredSession() }, error: null };
      },
      async signInWithPassword({ email, password }) {
        try {
          const res = await callProxy({ kind: "auth", action: "signin", email, password });
          if (res.session) {
            setStoredSession(res.session);
            await notify("SIGNED_IN", res.session);
          }
          return { data: { session: res.session || null, user: res.user || res.session?.user || null }, error: null };
        } catch (error) {
          return { data: { session: null, user: null }, error };
        }
      },
      async signUp({ email, password, options = {} }) {
        try {
          const res = await callProxy({ kind: "auth", action: "signup", email, password, data: options.data || {} });
          if (res.session) {
            setStoredSession(res.session);
            await notify("SIGNED_IN", res.session);
          }
          return { data: { session: res.session || null, user: res.user || res.session?.user || null }, error: null };
        } catch (error) {
          return { data: { session: null, user: null }, error };
        }
      },
      async signOut() {
        clearStoredSession();
        await notify("SIGNED_OUT", null);
        return { error: null };
      }
    },
    from(table) { return new QueryBuilder(table); },
    storage: {
      from(bucket) {
        return {
          async upload(path, file, options = {}) {
            try {
              const base64 = await fileToBase64(file);
              await callProxy({
                kind: "storage",
                action: "upload",
                bucket,
                path,
                contentType: file?.type || "application/octet-stream",
                base64,
                upsert: Boolean(options.upsert)
              });
              return { data: { path }, error: null };
            } catch (error) {
              return { data: null, error };
            }
          },
          getPublicUrl(path) {
            const url = new URL(API_ENDPOINT, window.location.origin);
            url.searchParams.set("kind", "object");
            url.searchParams.set("bucket", bucket);
            url.searchParams.set("path", path);
            return { data: { publicUrl: url.pathname + url.search } };
          }
        };
      }
    }
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Non riesco a leggere il file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
