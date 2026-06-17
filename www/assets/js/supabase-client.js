// CivicVois — client Supabase ufficiale.
// Sostituisce il vecchio proxy dati custom.
// Espone il client reale (auth, from, storage) PIÙ i metodi custom che l'app
// usava sul proxy: deleteAccount() e moderation(), ora implementati su Supabase
// (RPC + tabelle content_reports / user_blocks con RLS).
//
// La libreria Supabase è servita LOCALMENTE (assets/vendor/supabase/supabase-js.js,
// generata da `npm run build:vendor`): niente più dipendenza runtime da CDN, così
// la PWA e il bundle nativo Capacitor partono anche offline (fix audit C-13).

import { createClient } from "../vendor/supabase/supabase-js.js";

const SUPABASE_FETCH_TIMEOUT_MS = 25000;

// ── Lock auth in-process (FIX critico) ────────────────────────────────────
// Il lock di default di supabase-js usa navigator.locks, CONDIVISO tra tutte le
// schede dello stesso sito. Con più schede di civicvois.it aperte (e nella
// WebView nativa) il lock dell'auth-token andava in DEADLOCK: ogni operazione
// autenticata (getSession/getUser/refresh, e quindi profilo, feed e scritture)
// restava appesa PRIMA ancora di inviare una richiesta — restoreSession andava
// in timeout (7s) e l'app mostrava feed vuoto / "Profilo non disponibile",
// mentre l'anonimo funzionava. Qui sostituiamo il lock con una catena di
// promise PER SCHEDA: serializza le operazioni auth nella singola scheda (niente
// refresh concorrenti) ma senza il lock cross-scheda che causava il blocco.
let authLockChain = Promise.resolve();
function inProcessAuthLock(_name, _acquireTimeout, fn) {
  const run = authLockChain.then(() => fn(), () => fn());
  authLockChain = run.then(() => {}, () => {});
  return run;
}

function createAbortableFetch(timeoutMs = SUPABASE_FETCH_TIMEOUT_MS) {
  return async (input, init = {}) => {
    const controller = new AbortController();
    const upstreamSignal = init.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      else upstreamSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createSupabaseClient({ url, key }) {
  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      lock: inProcessAuthLock // niente navigator.locks: evita il deadlock multi-scheda/WebView
    },
    global: {
      fetch: createAbortableFetch()
    }
  });

  // Eliminazione account: RPC SECURITY DEFINER che cancella auth.users (CASCADE
  // su profilo, segnalazioni, like, blocchi, report).
  client.deleteAccount = async () => {
    const { error } = await client.rpc("delete_my_account");
    if (error) throw error;
  };

  // Nota: la moderazione (report/block/list/resolve) è ora gestita in app.js via
  // REST diretto col JWT (helper supabaseRestJson/supabaseRestRead), per evitare
  // che client.from() passi dal lock auth di supabase-js e resti appeso. Qui non
  // esponiamo più client.moderation: era il vecchio percorso bloccante.

  return client;
}
