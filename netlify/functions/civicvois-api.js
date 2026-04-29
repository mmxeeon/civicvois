const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CivicVois-Client",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store"
};

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return respond(204, "");

    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};
      if (qs.kind === "object") return await getStorageObject(qs);
      return respond(404, { error: { message: "Endpoint non trovato." } });
    }

    if (event.httpMethod !== "POST") return respond(405, { error: { message: "Metodo non consentito." } });

    const body = JSON.parse(event.body || "{}");
    const supabaseUrl = cleanUrl(body.client?.supabaseUrl || process.env.SUPABASE_URL);
    const anonKey = body.client?.anonKey || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return respond(500, { error: { message: "Supabase URL o publishable key mancanti." } });

    const userToken = getBearer(event.headers || {});

    if (body.kind === "auth") return await handleAuth({ supabaseUrl, anonKey, body });
    if (body.kind === "db") return await handleDb({ supabaseUrl, anonKey, userToken, body });
    if (body.kind === "storage") return await handleStorage({ supabaseUrl, anonKey, userToken, body });

    return respond(400, { error: { message: "Azione non riconosciuta." } });
  } catch (error) {
    console.error("CivicVois API error", error);
    return respond(500, { error: { message: error.message || "Errore interno Netlify Function." } });
  }
};

async function handleAuth({ supabaseUrl, anonKey, body }) {
  if (body.action === "signin") {
    const json = await supabaseFetchJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      anonKey,
      body: { email: body.email, password: body.password }
    });
    return respond(200, normalizeAuthResponse(json));
  }

  if (body.action === "signup") {
    const json = await supabaseFetchJson(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      anonKey,
      body: {
        email: body.email,
        password: body.password,
        data: body.data || {}
      }
    });
    return respond(200, normalizeAuthResponse(json));
  }

  return respond(400, { error: { message: "Azione auth non valida." } });
}

async function handleDb({ supabaseUrl, anonKey, userToken, body }) {
  const table = safeIdentifier(body.table);
  const headers = makeHeaders(anonKey, userToken, { "Accept": "application/json" });
  let method = "GET";
  let payload;
  let prefer = null;

  const params = new URLSearchParams();
  if (body.action === "select") {
    params.set("select", body.columns || "*");
    method = "GET";
  } else if (body.action === "insert") {
    method = "POST";
    payload = body.payload;
    params.set("select", body.columns || "*");
    prefer = "return=representation";
  } else if (body.action === "upsert") {
    method = "POST";
    payload = body.payload;
    params.set("select", body.columns || "*");
    if (body.onConflict) params.set("on_conflict", body.onConflict);
    prefer = `${body.ignoreDuplicates ? "resolution=ignore-duplicates" : "resolution=merge-duplicates"},return=representation`;
  } else if (body.action === "update") {
    method = "PATCH";
    payload = body.payload;
    params.set("select", body.columns || "*");
    prefer = "return=representation";
  } else if (body.action === "delete") {
    method = "DELETE";
    params.set("select", body.columns || "*");
    prefer = "return=representation";
  } else {
    return respond(400, { error: { message: "Azione database non valida." } });
  }

  for (const filter of body.filters || []) {
    if (filter.op === "eq") params.append(safeIdentifier(filter.column), `eq.${String(filter.value)}`);
  }
  for (const filter of body.inFilters || []) {
    const values = (filter.values || []).map(v => String(v).replace(/"/g, "\\\"")).join(",");
    params.append(safeIdentifier(filter.column), `in.(${values})`);
  }
  if (body.orderBy?.column) params.set("order", `${safeIdentifier(body.orderBy.column)}.${body.orderBy.ascending ? "asc" : "desc"}`);
  if (body.limit) params.set("limit", String(body.limit));

  if (prefer) headers.Prefer = prefer;
  const url = `${supabaseUrl}/rest/v1/${table}?${params.toString()}`;
  const json = await supabaseFetchJson(url, { method, anonKey, userToken, headers, body: payload });

  let data = json;
  if (body.single) {
    if (Array.isArray(json)) data = json.length ? json[0] : null;
  }
  return respond(200, { data });
}

async function handleStorage({ supabaseUrl, anonKey, userToken, body }) {
  if (body.action !== "upload") return respond(400, { error: { message: "Azione storage non valida." } });
  const bucket = safeBucket(body.bucket);
  const path = safePath(body.path);
  const buffer = Buffer.from(String(body.base64 || ""), "base64");
  const method = body.upsert ? "PUT" : "POST";
  const encodedPath = encodePath(path);
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;

  const res = await fetch(url, {
    method,
    headers: makeHeaders(anonKey, userToken, {
      "Content-Type": body.contentType || "application/octet-stream",
      "x-upsert": body.upsert ? "true" : "false"
    }),
    body: buffer
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { message: text }; }
  if (!res.ok) throw new Error(json?.message || json?.error || `Storage error ${res.status}`);
  return respond(200, { data: json || { path } });
}

async function getStorageObject(qs) {
  const supabaseUrl = process.env.SUPABASE_URL || "https://zqvzpnaxsoxpljdzoijq.supabase.co";
  const bucket = safeBucket(qs.bucket || "");
  const path = safePath(qs.path || "");
  const url = `${cleanUrl(supabaseUrl)}/storage/v1/object/public/${bucket}/${encodePath(path)}`;
  const res = await fetch(url);
  if (!res.ok) return respond(res.status, { error: { message: "File non trovato." } });
  const arrayBuffer = await res.arrayBuffer();
  return {
    statusCode: 200,
    headers: {
      ...CORS,
      "Content-Type": res.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "public, max-age=3600"
    },
    isBase64Encoded: true,
    body: Buffer.from(arrayBuffer).toString("base64")
  };
}

async function supabaseFetchJson(url, { method = "GET", anonKey, userToken, headers = null, body = undefined }) {
  const finalHeaders = headers || makeHeaders(anonKey, userToken);
  if (!finalHeaders["Content-Type"] && body !== undefined) finalHeaders["Content-Type"] = "application/json";
  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { message: text }; }
  if (!res.ok) {
    const message = json?.msg || json?.message || json?.error_description || json?.error || `Supabase error ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.payload = json;
    throw error;
  }
  return json;
}

function makeHeaders(anonKey, userToken, extra = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${userToken || anonKey}`,
    ...extra
  };
}

function normalizeAuthResponse(json) {
  // /token restituisce già access_token/user; /signup può restituire session oppure null se Confirm email è attivo.
  if (json?.access_token) {
    return {
      session: {
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_in: json.expires_in,
        expires_at: json.expires_at || Math.floor(Date.now() / 1000) + Number(json.expires_in || 3600),
        token_type: json.token_type || "bearer",
        user: json.user
      },
      user: json.user || null
    };
  }
  return {
    session: json?.session || null,
    user: json?.user || null
  };
}

function getBearer(headers) {
  const raw = headers.authorization || headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match ? match[1] : null;
}

function cleanUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function encodePath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function safeIdentifier(value) {
  const s = String(value || "");
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) throw new Error("Identificatore non valido.");
  return s;
}

function safeBucket(value) {
  const s = String(value || "");
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) throw new Error("Bucket non valido.");
  return s;
}

function safePath(value) {
  const s = String(value || "");
  if (!s || s.includes("..")) throw new Error("Percorso file non valido.");
  return s.replace(/^\/+/, "");
}

function respond(statusCode, payload) {
  return {
    statusCode,
    headers: {
      ...CORS,
      "Content-Type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8"
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  };
}
