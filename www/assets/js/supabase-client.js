// CivicVois — client Supabase ufficiale.
// Sostituisce supabase-proxy.js (che parlava col backend Netlify + Blobs).
// Espone il client reale (auth, from, storage) PIÙ i metodi custom che l'app
// usava sul proxy: deleteAccount() e moderation(), ora implementati su Supabase
// (RPC + tabelle content_reports / user_blocks con RLS).
//
// La libreria Supabase è servita LOCALMENTE (assets/vendor/supabase/supabase-js.js,
// generata da `npm run build:vendor`): niente più dipendenza runtime da CDN, così
// la PWA e il bundle nativo Capacitor partono anche offline (fix audit C-13).

import { createClient } from "../vendor/supabase/supabase-js.js";

export function createSupabaseClient({ url, key }) {
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // Eliminazione account: RPC SECURITY DEFINER che cancella auth.users (CASCADE
  // su profilo, segnalazioni, like, blocchi, report).
  client.deleteAccount = async () => {
    const { error } = await client.rpc("delete_my_account");
    if (error) throw error;
  };

  // Moderazione: stesse azioni del vecchio proxy, mappate su tabelle Supabase.
  client.moderation = async (payload = {}) => {
    const action = payload.action;

    if (action === "report") {
      const { error } = await client.from("content_reports").insert({
        target_id: String(payload.targetId || ""),
        reason: String(payload.reason || "")
      });
      if (error) throw error;
      return { data: true };
    }

    if (action === "block") {
      const { error } = await client.from("user_blocks").insert({ blocked_id: payload.targetUserId });
      if (error) throw error;
      return { data: true };
    }

    if (action === "list-blocks") {
      const { data, error } = await client.from("user_blocks").select("blocked_id");
      if (error) throw error;
      return { data: (data || []).map(r => r.blocked_id) };
    }

    if (action === "list-reports") {
      const { data, error } = await client
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { data: data || [] };
    }

    if (action === "resolve-report") {
      const { error } = await client
        .from("content_reports")
        .update({ status: "resolved" })
        .eq("id", payload.reportId);
      if (error) throw error;
      return { data: true };
    }

    throw new Error("Azione di moderazione non supportata: " + action);
  };

  return client;
}
