-- ============================================================================
-- CivicVois — Setup database Supabase (Postgres)
-- ============================================================================
-- ⚠️  ATTENZIONE: questo script PARTE DA DATABASE PULITO.
--     Le righe DROP qui sotto ELIMINANO eventuali tabelle CivicVois esistenti
--     con questi nomi. Hai scelto "database pulito", quindi è voluto.
--     Se nel progetto hai altri dati importanti, controlla prima di eseguire.
--
-- Come usarlo:
--   Supabase Dashboard → SQL Editor → New query → incolla TUTTO → Run.
--   È idempotente: puoi rieseguirlo più volte senza errori.
-- ============================================================================

-- ── 0. Pulizia (clean start) ────────────────────────────────────────────────
drop trigger if exists trg_like_count    on public.interazioni;
drop trigger if exists trg_lock_role     on public.profiles;
drop trigger if exists trg_seg_lock      on public.segnalazioni;
drop trigger if exists trg_prof_updated  on public.profiles;
drop trigger if exists trg_seg_updated   on public.segnalazioni;
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.interazioni  cascade;
drop table if exists public.segnalazioni cascade;
drop table if exists public.profiles     cascade;

drop function if exists public.sync_like_count()  cascade;
drop function if exists public.is_admin()         cascade;
drop function if exists public.lock_role()        cascade;
drop function if exists public.lock_seg_admin()   cascade;
drop function if exists public.set_updated_at()   cascade;
drop function if exists public.handle_new_user()  cascade;

-- ── 1. Tabelle ──────────────────────────────────────────────────────────────
-- L'email NON sta qui: vive in auth.users (fix C-03, niente email harvesting).
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null default '',
  bio         text not null default '',
  regione     text not null default '',
  provincia   text not null default '',
  comune      text not null default '',
  avatar_url  text not null default '',
  role        text not null default 'user' check (role in ('user','admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.segnalazioni (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  titolo      text not null,
  tipo        text not null,
  descrizione text not null,
  regione     text not null default '',
  provincia   text not null default '',
  comune      text not null default '',
  via         text not null default '',
  civico      text not null default '',
  lat         double precision,
  lng         double precision,
  photo_url   text not null default '',
  priorita    text not null default 'media' check (priorita in ('bassa','media','alta','urgente')),
  stato       text not null default 'nuova'  check (stato in ('nuova','verificata','in carico','risolta','archiviata')),
  like_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.interazioni (
  id              uuid primary key default gen_random_uuid(),
  utente_id       uuid not null references auth.users(id) on delete cascade,
  segnalazione_id uuid not null references public.segnalazioni(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (utente_id, segnalazione_id)   -- un solo like per utente+segnalazione
);

-- ── 2. Indici (questo è ciò che oggi manca del tutto — fix C-06) ─────────────
create index idx_seg_created on public.segnalazioni (created_at desc);
create index idx_seg_comune  on public.segnalazioni (comune);
create index idx_seg_stato   on public.segnalazioni (stato);
create index idx_seg_tipo    on public.segnalazioni (tipo);
create index idx_seg_user    on public.segnalazioni (user_id);
create index idx_lik_seg     on public.interazioni (segnalazione_id);
create index idx_lik_user    on public.interazioni (utente_id);

-- ── 3. Funzioni di utilità ──────────────────────────────────────────────────
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- like_count atomico (fix C-07: niente più scansione di tutti i like, niente race)
create function public.sync_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.segnalazioni set like_count = like_count + 1 where id = new.segnalazione_id;
  elsif tg_op = 'DELETE' then
    update public.segnalazioni set like_count = greatest(0, like_count - 1) where id = old.segnalazione_id;
  end if;
  return null;
end $$;

-- Blocca l'auto-promozione ad admin dal client (fix C-01)
create function public.lock_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;

-- Solo un admin può cambiare stato/priorità di una segnalazione (fix C-11 lato DB)
create function public.lock_seg_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.stato is distinct from old.stato or new.priorita is distinct from old.priorita)
     and not public.is_admin() then
    new.stato := old.stato;
    new.priorita := old.priorita;
  end if;
  return new;
end $$;

-- Crea automaticamente il profilo alla registrazione (username unico garantito)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; uname text;
begin
  base := regexp_replace(lower(split_part(new.email,'@',1)), '[^a-z0-9_-]', '', 'g');
  if base = '' then base := 'utente'; end if;
  uname := base;
  if exists(select 1 from public.profiles where username = uname) then
    uname := base || '-' || substr(new.id::text, 1, 6);
  end if;
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end $$;

-- ── 4. Trigger ──────────────────────────────────────────────────────────────
create trigger trg_like_count   after  insert or delete on public.interazioni  for each row execute function public.sync_like_count();
create trigger trg_lock_role    before update           on public.profiles     for each row execute function public.lock_role();
create trigger trg_seg_lock     before update           on public.segnalazioni for each row execute function public.lock_seg_admin();
create trigger trg_prof_updated before update           on public.profiles     for each row execute function public.set_updated_at();
create trigger trg_seg_updated  before update           on public.segnalazioni for each row execute function public.set_updated_at();
create trigger on_auth_user_created after insert        on auth.users          for each row execute function public.handle_new_user();

-- ── 5. Row Level Security (fix C-01 / C-03 a livello DB) ─────────────────────
alter table public.profiles     enable row level security;
alter table public.segnalazioni enable row level security;
alter table public.interazioni  enable row level security;

-- PROFILI: lettura pubblica (niente email), scrittura solo del proprio
create policy "profiles_read"   on public.profiles     for select using (true);
create policy "profiles_insert" on public.profiles     for insert with check (id = auth.uid());
create policy "profiles_update" on public.profiles     for update using (id = auth.uid());

-- SEGNALAZIONI: lettura pubblica; crea solo come sé; modifica/elimina proprie o admin
create policy "seg_read"   on public.segnalazioni for select using (true);
create policy "seg_insert" on public.segnalazioni for insert with check (user_id = auth.uid());
create policy "seg_update" on public.segnalazioni for update using (user_id = auth.uid() or public.is_admin());
create policy "seg_delete" on public.segnalazioni for delete using (user_id = auth.uid() or public.is_admin());

-- INTERAZIONI (like): ognuno gestisce solo i propri
create policy "lik_read"   on public.interazioni for select using (true);
create policy "lik_insert" on public.interazioni for insert with check (utente_id = auth.uid());
create policy "lik_delete" on public.interazioni for delete using (utente_id = auth.uid());

-- ── 6. Storage (foto segnalazioni + avatar) ─────────────────────────────────
insert into storage.buckets (id, name, public) values ('report-photos','report-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)             on conflict (id) do nothing;

-- Lettura pubblica
drop policy if exists "storage_read_reportphotos" on storage.objects;
drop policy if exists "storage_read_avatars"      on storage.objects;
create policy "storage_read_reportphotos" on storage.objects for select using (bucket_id = 'report-photos');
create policy "storage_read_avatars"      on storage.objects for select using (bucket_id = 'avatars');

-- Upload/scrittura solo autenticati, nella propria cartella (auth.uid()/...)
drop policy if exists "storage_write_reportphotos" on storage.objects;
drop policy if exists "storage_write_avatars"      on storage.objects;
create policy "storage_write_reportphotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_write_avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- FINE. Dopo l'esecuzione:
--   1) Registra il tuo account dall'app (o dal dashboard Auth).
--   2) Trova il tuo user id in: Authentication → Users.
--   3) Rendi te stesso admin (sostituisci l'UUID):
--        update public.profiles set role = 'admin' where id = 'IL-TUO-USER-ID';
-- ============================================================================
