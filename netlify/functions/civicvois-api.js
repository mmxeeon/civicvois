const https = require("https");

const DEFAULT_SUPABASE_URL = "https://zqvzpnaxsoxpljdzoijq.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_0ftTXKs9-PrbOhLn--iYWw_AkWUCASj";

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
      if (qs.health === "1" || qs.kind === "health") {
        return respond(200, {
          ok: true,
          service: "civicvois-api",
          mode: "netlify-function-proxy",
          transport: "node-https",
          timestamp: new Date().toISOString()
        });
      }
      if (qs.supabase === "1" || qs.kind === "supabase-test") return await testSupabase(qs);
      if (qs.kind === "object") return await getStorageObject(qs);
      return respond(404, { error: { message: "Endpoint non trovato." } });
    }

    if (event.httpMethod !== "POST") return respond(405, { error: { message: "Metodo non consentito." } });

    const body = JSON.parse(event.body || "{}");
    const supabaseUrl = cleanUrl(body.client?.supabaseUrl || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL);
    const anonKey = body.client?.anonKey || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY;
    if (!supabaseUrl || !anonKey) return respond(500, { error: { message: "Supabase URL o publishable key mancanti." } });

    const userToken = getBearer(event.headers || {});

    if (body.kind === "auth") return await handleAuth({ supabaseUrl, anonKey, body });
    if (body.kind === "db") return await handleDb({ supabaseUrl, anonKey, userToken, body });
    if (body.kind === "storage") return await handleStorage({ supabaseUrl, anonKey, userToken, body });

    return respond(400, { error: { message: "Azione non riconosciuta." } });
  } catch (error) {
    console.error("CivicVois API error", error);
    return respond(error.status || 500, {
      error: {
        message: error.message || "Errore interno Netlify Function.",
        status: error.status || 500,
        code: error.code || null,
        cause: error.cause?.message || null,
        payload: error.payload || null
      }
    });
  }
};

async function testSupabase(qs) {
  const supabaseUrl = cleanUrl(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL);
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY;
  const url = `${supabaseUrl}/rest/v1/segnalazioni?select=id&limit=1`;
  const startedAt = Date.now();
  const json = await supabaseFetchJson(url, {
    method: "GET",
    anonKey,
    userToken: null,
    timeoutMs: Number(qs.timeout || 12000)
  });
  return respond(200, {
    ok: true,
    service: "civicvois-api",
    supabase: true,
    elapsedMs: Date.now() - startedAt,
    dataPreview: Array.isArray(json) ? json.slice(0, 1) : json
  });
}

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
  const headers = makeHeaders(anonKey, userToken, { Accept: "application/json" });
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
  if (body.single) data = Array.isArray(json) ? (json.length ? json[0] : null) : json;
  return respond(200, { data });
}

async function handleStorage({ supabaseUrl, anonKey, userToken, body }) {
  if (body.action !== "upload") return respond(400, { error: { message: "Azione storage non valida." } });
  const bucket = safeBucket(body.bucket);
  const path = safePath(body.path);
  const buffer = Buffer.from(String(body.base64 || ""), "base64");
  const method = body.upsert ? "PUT" : "POST";
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${encodePath(path)}`;

  const { statusCode, text } = await requestText(url, {
    method,
    headers: makeHeaders(anonKey, userToken, {
      "Content-Type": body.contentType || "application/octet-stream",
      "x-upsert": body.upsert ? "true" : "false"
    }),
    body: buffer
  });
  const json = parseJson(text);
  if (statusCode < 200 || statusCode >= 300) throwHttp(statusCode, json, "Storage error");
  return respond(200, { data: json || { path } });
}

async function getStorageObject(qs) {
  const supabaseUrl = cleanUrl(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL);
  const bucket = safeBucket(qs.bucket || "");
  const path = safePath(qs.path || "");
  const url = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodePath(path)}`;
  const { statusCode, buffer, headers } = await requestBuffer(url, { method: "GET", headers: {} });
  if (statusCode < 200 || statusCode >= 300) return respond(statusCode, { error: { message: "File non trovato." } });
  return {
    statusCode: 200,
    headers: {
      ...CORS,
      "Content-Type": headers["content-type"] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600"
    },
    isBase64Encoded: true,
    body: buffer.toString("base64")
  };
}

async function supabaseFetchJson(url, { method = "GET", anonKey, userToken, headers = null, body = undefined, timeoutMs = 12000 }) {
  const finalHeaders = headers || makeHeaders(anonKey, userToken);
  if (!finalHeaders["Content-Type"] && body !== undefined) finalHeaders["Content-Type"] = "application/json";
  const { statusCode, text } = await requestText(url, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    timeoutMs
  });
  const json = parseJson(text);
  if (statusCode < 200 || statusCode >= 300) throwHttp(statusCode, json, `Supabase error ${statusCode}`);
  return json;
}

function requestText(urlString, options = {}) {
  return requestRaw(urlString, options).then(res => ({ ...res, text: res.buffer.toString("utf8") }));
}

function requestBuffer(urlString, options = {}) {
  return requestRaw(urlString, options);
}

function requestRaw(urlString, options = {}) {
  const url = new URL(urlString);
  const body = options.body;
  const timeoutMs = options.timeoutMs || 12000;

  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      headers: {
        "User-Agent": "CivicVois-Netlify-Function/1.0",
        ...(options.headers || {})
      },
      timeout: timeoutMs
    }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({
        statusCode: res.statusCode || 0,
        headers: res.headers || {},
        buffer: Buffer.concat(chunks)
      }));
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Timeout verso Supabase dopo ${timeoutMs}ms`));
    });
    req.on("error", error => {
      const err = new Error(`Connessione Supabase non riuscita: ${error.message}`);
      err.code = error.code || null;
      err.cause = error;
      reject(err);
    });

    if (body !== undefined) req.write(body);
    req.end();
  });
}

function makeHeaders(anonKey, userToken, extra = {}) {
  const headers = {
    apikey: anonKey,
    ...extra
  };
  // Con le nuove chiavi sb_publishable_* è più sicuro inviare Authorization solo quando abbiamo il vero JWT utente.
  // Per le chiamate anonime basta apikey: il gateway Supabase risolve il ruolo anon.
  if (userToken) headers.Authorization = `Bearer ${userToken}`;
  return headers;
}

function normalizeAuthResponse(json) {
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
  return { session: json?.session || null, user: json?.user || null };
}

function parseJson(text) {
  try { return text ? JSON.parse(text) : null; } catch { return { message: text }; }
}

function throwHttp(statusCode, json, fallback) {
  const message = json?.msg || json?.message || json?.error_description || json?.error || fallback || `Errore HTTP ${statusCode}`;
  const error = new Error(message);
  error.status = statusCode;
  error.payload = json;
  throw error;
}

function getBearer(headers) {
  const raw = headers.authorization || headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  return match ? match[1] : null;
}

function cleanUrl(url) { return String(url || "").replace(/\/+$/, ""); }
function encodePath(path) { return String(path).split("/").map(encodeURIComponent).join("/"); }
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
