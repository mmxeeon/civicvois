const nodeCrypto = require("crypto");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CivicVois-Client",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store"
};

const STORE_NAME = "civicvois-production-db";
const IMAGE_STORE_NAME = "civicvois-production-files";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const SESSION_SECRET = process.env.CIVICVOIS_SESSION_SECRET || "civicvois-change-this-secret-in-netlify-env";

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return respond(204, "");

    if (event.httpMethod === "GET") {
      const qs = event.queryStringParameters || {};
      if (qs.health === "1" || qs.kind === "health") {
        return respond(200, {
          ok: true,
          service: "civicvois-api",
          mode: "netlify-function-blobs",
          backend: "netlify-blobs",
          timestamp: new Date().toISOString()
        });
      }
      if (qs.supabase === "1" || qs.kind === "supabase-test" || qs.backend === "1") {
        const db = await dataStore();
        const { blobs } = await db.list({ prefix: "reports/" });
        return respond(200, {
          ok: true,
          service: "civicvois-api",
          backend: "netlify-blobs",
          supabase: false,
          message: "Supabase non viene più usato: backend persistente su Netlify Blobs attivo.",
          reportsStored: blobs.length,
          timestamp: new Date().toISOString()
        });
      }
      if (qs.kind === "object") return await getStorageObject(qs);
      return respond(404, { error: { message: "Endpoint non trovato." } });
    }

    if (event.httpMethod !== "POST") return respond(405, { error: { message: "Metodo non consentito." } });

    const body = parseBody(event.body);
    const user = verifyBearer(event.headers || {});

    if (body.kind === "auth") return await handleAuth(body);
    if (body.kind === "db") return await handleDb(body, user);
    if (body.kind === "storage") return await handleStorage(body, user);

    return respond(400, { error: { message: "Azione non riconosciuta." } });
  } catch (error) {
    console.error("CivicVois API error", error);
    return respond(error.status || 500, {
      error: {
        message: error.message || "Errore interno Netlify Function.",
        status: error.status || 500,
        code: error.code || null,
        details: error.details || null
      }
    });
  }
};

async function handleAuth(body) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || password.length < 6) throw httpError(400, "Email e password di almeno 6 caratteri sono obbligatorie.");

  if (body.action === "signup") {
    const db = await dataStore();
    const existing = await getJSON(db, userEmailKey(email));
    if (existing) throw httpError(409, "Account già esistente. Vai su Accedi e usa la password scelta in precedenza.");

    const id = uuid();
    const now = nowIso();
    const data = body.data || {};
    const users = await db.list({ prefix: "users/email/" });
    const role = users.blobs.length === 0 ? "admin" : "user";
    const passwordRecord = hashPassword(password);

    const user = {
      id,
      email,
      aud: "authenticated",
      role: "authenticated",
      user_metadata: {
        full_name: clean(data.full_name) || clean(data.username) || email.split("@")[0],
        username: cleanUsername(data.username || email.split("@")[0]),
        comune: clean(data.comune || "")
      },
      created_at: now,
      updated_at: now
    };

    await setJSON(db, userEmailKey(email), { id, email, ...passwordRecord, created_at: now });
    await setJSON(db, profileKey(id), {
      id,
      email,
      username: user.user_metadata.username,
      full_name: user.user_metadata.full_name,
      comune: user.user_metadata.comune,
      provincia: "",
      regione: "",
      bio: "",
      avatar_url: "",
      role,
      created_at: now,
      updated_at: now
    });

    return respond(200, makeAuthPayload(user));
  }

  if (body.action === "signin") {
    const db = await dataStore();
    const record = await getJSON(db, userEmailKey(email));
    if (!record || !verifyPassword(password, record)) throw httpError(400, "Credenziali non valide.");
    const profile = await getJSON(db, profileKey(record.id));
    const user = {
      id: record.id,
      email: record.email,
      aud: "authenticated",
      role: "authenticated",
      user_metadata: {
        full_name: profile?.full_name || record.email.split("@")[0],
        username: profile?.username || record.email.split("@")[0],
        comune: profile?.comune || ""
      },
      created_at: record.created_at,
      updated_at: nowIso()
    };
    return respond(200, makeAuthPayload(user));
  }

  return respond(400, { error: { message: "Azione auth non valida." } });
}

async function handleDb(body, user) {
  const table = safeIdentifier(body.table);
  const action = String(body.action || "");

  if (action === "select") {
    const rows = await selectRows(table, body);
    return respond(200, { data: body.single ? (rows[0] || null) : rows });
  }

  if (["insert", "upsert", "update", "delete"].includes(action) && !user) {
    throw httpError(401, "Devi effettuare l'accesso.");
  }

  if (action === "insert") return await insertRows(table, body, user);
  if (action === "upsert") return await upsertRows(table, body, user);
  if (action === "update") return await updateRows(table, body, user);
  if (action === "delete") return await deleteRows(table, body, user);

  return respond(400, { error: { message: "Azione database non valida." } });
}

async function selectRows(table, body) {
  let rows = await allRows(table);
  rows = applyFilters(rows, body.filters || [], body.inFilters || []);
  if (body.orderBy?.column) {
    const col = safeIdentifier(body.orderBy.column);
    const asc = body.orderBy.ascending !== false;
    rows.sort((a, b) => compareValues(a[col], b[col]) * (asc ? 1 : -1));
  }
  if (body.limit) rows = rows.slice(0, Number(body.limit));
  return rows;
}

async function insertRows(table, body, user) {
  const payloads = Array.isArray(body.payload) ? body.payload : [body.payload];
  const saved = [];
  for (const raw of payloads) {
    const row = normalizeRow(table, { ...(raw || {}) }, user, true);
    await saveRow(table, row);
    if (table === "interazioni") await recalcLikeCount(row.segnalazione_id);
    saved.push(row);
  }
  return respond(200, { data: saved });
}

async function upsertRows(table, body, user) {
  const payloads = Array.isArray(body.payload) ? body.payload : [body.payload];
  const saved = [];
  for (const raw of payloads) {
    const incoming = { ...(raw || {}) };
    if (table === "profiles" && incoming.id && incoming.id !== user.id) throw httpError(403, "Non puoi modificare questo profilo.");
    const key = rowKey(table, incoming.id || uuid());
    const db = await dataStore();
    const existing = await getJSON(db, key);
    const row = normalizeRow(table, { ...(existing || {}), ...incoming }, user, !existing);
    await saveRow(table, row);
    saved.push(row);
  }
  return respond(200, { data: saved });
}
async function updateRows(table, body, user) {
  let rows = await allRows(table);
  rows = applyFilters(rows, body.filters || [], body.inFilters || []);
  const saved = [];
  for (const existing of rows) {
    await assertCanModify(table, existing, user);
    const row = normalizeRow(table, { ...existing, ...(body.payload || {}) }, user, false);
    await saveRow(table, row);
    saved.push(row);
  }
  return respond(200, { data: saved });
}

async function deleteRows(table, body, user) {
  let rows = await allRows(table);
  rows = applyFilters(rows, body.filters || [], body.inFilters || []);
  const db = await dataStore();
  const deleted = [];
  for (const row of rows) {
    await assertCanModify(table, row, user);
    await db.delete(rowKey(table, row.id || `${row.utente_id}_${row.segnalazione_id}`));
    if (table === "interazioni") await recalcLikeCount(row.segnalazione_id);
    if (table === "segnalazioni") await deleteLikesForReport(row.id);
    deleted.push(row);
  }
  return respond(200, { data: deleted });
}

async function handleStorage(body, user) {
  if (!user) throw httpError(401, "Devi effettuare l'accesso.");
  if (body.action !== "upload") return respond(400, { error: { message: "Azione storage non valida." } });
  const bucket = safeBucket(body.bucket);
  const path = safePath(body.path);
  const buffer = Buffer.from(String(body.base64 || ""), "base64");
  if (!buffer.length) throw httpError(400, "File vuoto o non valido.");
  if (buffer.length > 5 * 1024 * 1024) throw httpError(413, "File troppo grande. Limite: 5 MB.");

  const files = await fileStore();
  await files.set(fileKey(bucket, path), buffer, {
    metadata: {
      bucket,
      path,
      owner: user.id,
      contentType: body.contentType || "application/octet-stream",
      created_at: nowIso()
    }
  });
  return respond(200, { data: { path, bucket } });
}

async function getStorageObject(qs) {
  const bucket = safeBucket(qs.bucket || "");
  const path = safePath(qs.path || "");
  const files = await fileStore();
  const entry = await files.getWithMetadata(fileKey(bucket, path), { type: "arrayBuffer" });
  if (!entry || entry.data === null) return respond(404, { error: { message: "File non trovato." } });
  return {
    statusCode: 200,
    headers: {
      ...CORS,
      "Content-Type": entry.metadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=3600"
    },
    isBase64Encoded: true,
    body: Buffer.from(entry.data).toString("base64")
  };
}

async function allRows(table) {
  const db = await dataStore();
  const prefix = tablePrefix(table);
  const { blobs } = await db.list({ prefix });
  const rows = [];
  for (const blob of blobs) {
    const row = await getJSON(db, blob.key);
    if (row) rows.push(row);
  }
  return rows;
}

async function saveRow(table, row) {
  const db = await dataStore();
  await setJSON(db, rowKey(table, row.id || `${row.utente_id}_${row.segnalazione_id}`), row);
}

function normalizeRow(table, row, user, isNew) {
  const now = nowIso();
  if (table === "profiles") {
    row.id = row.id || user.id;
    row.email = normalizeEmail(row.email || user.email);
    row.username = cleanUsername(row.username || row.email.split("@")[0]);
    row.full_name = clean(row.full_name || row.username);
    row.role = row.role || "user";
    row.updated_at = now;
    if (isNew) row.created_at = row.created_at || now;
    return row;
  }

  if (table === "segnalazioni") {
    row.id = row.id || uuid();
    row.user_id = row.user_id || user.id;
    row.titolo = clean(row.titolo);
    row.tipo = clean(row.tipo);
    row.descrizione = clean(row.descrizione);
    row.priorita = clean(row.priorita || "media");
    row.stato = clean(row.stato || "nuova");
    row.like_count = Number(row.like_count || 0);
    row.updated_at = now;
    if (isNew) row.created_at = row.created_at || now;
    return row;
  }

  if (table === "interazioni") {
    row.utente_id = row.utente_id || user.id;
    row.segnalazione_id = String(row.segnalazione_id || "");
    if (!row.segnalazione_id) throw httpError(400, "Segnalazione mancante.");
    row.id = `${row.utente_id}_${row.segnalazione_id}`;
    row.created_at = row.created_at || now;
    return row;
  }

  throw httpError(400, "Tabella non supportata.");
}

async function assertCanModify(table, row, user) {
  if (!user) throw httpError(401, "Devi effettuare l'accesso.");
  if (await isAdmin(user.id)) return;
  if (table === "profiles" && row.id === user.id) return;
  if (table === "segnalazioni" && row.user_id === user.id) return;
  if (table === "interazioni" && row.utente_id === user.id) return;
  throw httpError(403, "Non hai il permesso per questa operazione.");
}

async function isAdmin(userId) {
  const db = await dataStore();
  const profile = await getJSON(db, profileKey(userId));
  return profile?.role === "admin";
}

async function recalcLikeCount(reportId) {
  if (!reportId) return;
  const db = await dataStore();
  const report = await getJSON(db, rowKey("segnalazioni", reportId));
  if (!report) return;
  const { blobs } = await db.list({ prefix: "likes/" });
  let count = 0;
  for (const blob of blobs) if (blob.key.endsWith(`/${reportId}`)) count += 1;
  report.like_count = count;
  report.updated_at = nowIso();
  await setJSON(db, rowKey("segnalazioni", reportId), report);
}

async function deleteLikesForReport(reportId) {
  const db = await dataStore();
  const { blobs } = await db.list({ prefix: "likes/" });
  for (const blob of blobs) if (blob.key.endsWith(`/${reportId}`)) await db.delete(blob.key);
}

function applyFilters(rows, filters, inFilters) {
  let out = [...rows];
  for (const filter of filters || []) {
    if (filter.op === "eq") {
      const col = safeIdentifier(filter.column);
      out = out.filter(row => String(row[col] ?? "") === String(filter.value ?? ""));
    }
  }
  for (const filter of inFilters || []) {
    const col = safeIdentifier(filter.column);
    const values = new Set((filter.values || []).map(v => String(v)));
    out = out.filter(row => values.has(String(row[col] ?? "")));
  }
  return out;
}

function tablePrefix(table) {
  if (table === "profiles") return "profiles/";
  if (table === "segnalazioni") return "reports/";
  if (table === "interazioni") return "likes/";
  throw httpError(400, "Tabella non supportata.");
}
function rowKey(table, id) {
  if (table === "profiles") return profileKey(id);
  if (table === "segnalazioni") return `reports/${id}`;
  if (table === "interazioni") return `likes/${String(id).replace(/^likes\//, "")}`;
  throw httpError(400, "Tabella non supportata.");
}
function profileKey(id) { return `profiles/${id}`; }
function userEmailKey(email) { return `users/email/${base64url(email)}`; }
function fileKey(bucket, path) { return `files/${bucket}/${path}`; }

async function dataStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(STORE_NAME);
}
async function fileStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(IMAGE_STORE_NAME);
}
async function getJSON(store, key) {
  try { return await store.get(key, { type: "json" }); }
  catch { return null; }
}
async function setJSON(store, key, value) {
  await store.set(key, JSON.stringify(value), { metadata: { contentType: "application/json" } });
}
function makeAuthPayload(user) {
  const accessToken = signToken({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  return {
    session: {
      access_token: accessToken,
      refresh_token: accessToken,
      expires_in: SESSION_TTL_SECONDS,
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      token_type: "bearer",
      user
    },
    user
  };
}
function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encoded = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const sig = nodeCrypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}
function verifyBearer(headers) {
  const raw = headers.authorization || headers.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(raw);
  if (!match) return null;
  const token = match[1];
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const expected = nodeCrypto.createHmac("sha256", SESSION_SECRET).update(`${h}.${p}`).digest("base64url");
  if (!timingSafeEqual(s, expected)) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return { id: payload.sub, email: payload.email };
}
function timingSafeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return nodeCrypto.timingSafeEqual(aa, bb);
}

function hashPassword(password) {
  const salt = nodeCrypto.randomBytes(16).toString("hex");
  const hash = nodeCrypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { password_salt: salt, password_hash: hash };
}
function verifyPassword(password, record) {
  const hash = nodeCrypto.pbkdf2Sync(String(password), record.password_salt, 120000, 32, "sha256").toString("hex");
  return timingSafeEqual(hash, record.password_hash);
}

function parseBody(body) {
  try { return JSON.parse(body || "{}"); } catch { throw httpError(400, "JSON non valido."); }
}
function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
function clean(value) { return String(value ?? "").trim().slice(0, 1000); }
function cleanUsername(value) {
  return String(value || "utente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 28) || `utente-${uuid().slice(0, 6)}`;
}
function safeIdentifier(value) {
  const s = String(value || "");
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) throw httpError(400, "Identificatore non valido.");
  return s;
}
function safeBucket(value) {
  const s = String(value || "");
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) throw httpError(400, "Bucket non valido.");
  return s;
}
function safePath(value) {
  const s = String(value || "");
  if (!s || s.includes("..")) throw httpError(400, "Percorso file non valido.");
  return s.replace(/^\/+/, "");
}
function base64url(value) { return Buffer.from(String(value)).toString("base64url"); }
function uuid() { return nodeCrypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }
function compareValues(a, b) {
  const da = Date.parse(a), db = Date.parse(b);
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return String(a ?? "").localeCompare(String(b ?? ""));
}
function httpError(status, message, details = null) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
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
