-- ============================================================================
-- CivicVois — Hardening validazioni e storage (INCREMENTALE, NON distruttivo)
-- ============================================================================
-- Esegui DOPO 01_setup.sql e 02_moderation_delete.sql.
--   Supabase → SQL Editor → New query → incolla tutto → Run.  È idempotente.
--
-- Cosa aggiunge:
--   1. Blocco lato server di stato/like_count anche in INSERT (prima erano
--      protetti solo in UPDATE: un utente poteva creare una segnalazione già
--      "risolta" o con like_count gonfiato → fix C-11 lato insert).
--   2. Vincoli di lunghezza su titolo/descrizione/via/civico/tipo (anti-abuso,
--      anti-payload enormi, coerenza con la UI).
--   3. Policy di DELETE su Storage: ogni utente può cancellare SOLO i file nella
--      propria cartella (pulizia foto + rimozione dati su eliminazione account).
-- ============================================================================

-- ── 1. Blocco stato/like_count in INSERT per i non-admin ─────────────────────
create or replace function public.lock_seg_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.stato := 'nuova';        -- una segnalazione nasce sempre "nuova"
    new.like_count := 0;         -- il conteggio like parte da 0 (lo gestisce il trigger)
  end if;
  return new;
end $$;

drop trigger if exists trg_seg_insert on public.segnalazioni;
create trigger trg_seg_insert before insert on public.segnalazioni
for each row execute function public.lock_seg_insert();

-- ── 2. Vincoli di lunghezza (idempotenti) ────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'seg_titolo_len') then
    alter table public.segnalazioni
      add constraint seg_titolo_len check (char_length(titolo) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seg_desc_len') then
    alter table public.segnalazioni
      add constraint seg_desc_len check (char_length(descrizione) between 1 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seg_tipo_len') then
    alter table public.segnalazioni
      add constraint seg_tipo_len check (char_length(tipo) between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seg_via_len') then
    alter table public.segnalazioni
      add constraint seg_via_len check (char_length(via) <= 160);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'seg_civico_len') then
    alter table public.segnalazioni
      add constraint seg_civico_len check (char_length(civico) <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prof_username_len') then
    alter table public.profiles
      add constraint prof_username_len check (char_length(username) between 2 and 32);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'prof_bio_len') then
    alter table public.profiles
      add constraint prof_bio_len check (char_length(bio) <= 500);
  end if;
end $$;

-- ── 3. Storage: cancellazione dei propri file (pulizia + eliminazione account)─
drop policy if exists "storage_delete_reportphotos" on storage.objects;
create policy "storage_delete_reportphotos" on storage.objects for delete to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage_delete_avatars" on storage.objects;
create policy "storage_delete_avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Aggiornamento avatar nella propria cartella (sostituzione file esistente)
drop policy if exists "storage_update_avatars" on storage.objects;
create policy "storage_update_avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Verifica rapida (facoltativa):
--   select tgname from pg_trigger where tgname = 'trg_seg_insert';      -- 1 riga
--   select conname from pg_constraint where conname like 'seg_%_len';   -- 5 righe
-- ============================================================================
