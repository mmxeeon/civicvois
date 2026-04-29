-- CivicVois - Schema Supabase completo
-- Esegui tutto questo file nel SQL Editor del tuo progetto Supabase.
-- Dopo l'esecuzione, copia Project URL e anon public key in assets/js/config.js.

create extension if not exists "pgcrypto";

-- =========================================================
-- 1. Tabelle principali
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  role text not null default 'user' check (role in ('user', 'admin')),
  regione text,
  provincia text,
  comune text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  titolo text not null,
  tipo text not null,
  descrizione text not null,
  priorita text not null default 'media' check (priorita in ('bassa', 'media', 'alta', 'urgente')),
  stato text not null default 'nuova' check (stato in ('nuova', 'verificata', 'in carico', 'risolta', 'archiviata')),
  regione text,
  provincia text,
  comune text not null,
  via text,
  civico text,
  lat numeric,
  lng numeric,
  photo_url text,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interazioni (
  utente_id uuid not null references public.profiles(id) on delete cascade,
  segnalazione_id uuid not null references public.segnalazioni(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (utente_id, segnalazione_id)
);

create index if not exists idx_segnalazioni_created_at on public.segnalazioni(created_at desc);
create index if not exists idx_segnalazioni_comune on public.segnalazioni(comune);
create index if not exists idx_segnalazioni_stato on public.segnalazioni(stato);
create index if not exists idx_segnalazioni_user_id on public.segnalazioni(user_id);
create index if not exists idx_interazioni_segnalazione_id on public.interazioni(segnalazione_id);

-- =========================================================
-- 2. Funzioni e trigger
-- =========================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix text;
begin
  base_username := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'utente'));
  base_username := regexp_replace(base_username, '[^a-z0-9_-]', '', 'g');
  base_username := left(nullif(base_username, ''), 28);
  suffix := left(replace(new.id::text, '-', ''), 6);
  final_username := coalesce(base_username, 'utente') || '-' || suffix;

  insert into public.profiles (id, email, username, full_name, comune)
  values (
    new.id,
    new.email,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Utente CivicVois'),
    coalesce(new.raw_user_meta_data->>'comune', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.refresh_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.segnalazione_id, old.segnalazione_id);

  update public.segnalazioni
  set like_count = (
    select count(*)::integer
    from public.interazioni
    where segnalazione_id = target_id
  )
  where id = target_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_segnalazioni_updated_at on public.segnalazioni;
create trigger touch_segnalazioni_updated_at
  before update on public.segnalazioni
  for each row execute function public.touch_updated_at();

drop trigger if exists refresh_like_count_insert on public.interazioni;
create trigger refresh_like_count_insert
  after insert on public.interazioni
  for each row execute function public.refresh_like_count();

drop trigger if exists refresh_like_count_delete on public.interazioni;
create trigger refresh_like_count_delete
  after delete on public.interazioni
  for each row execute function public.refresh_like_count();

-- =========================================================
-- 3. Row Level Security
-- =========================================================

alter table public.profiles enable row level security;
alter table public.segnalazioni enable row level security;
alter table public.interazioni enable row level security;

-- Pulizia policy per ri-esecuzione sicura
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "segnalazioni_select_public" ON public.segnalazioni;
DROP POLICY IF EXISTS "segnalazioni_insert_authenticated" ON public.segnalazioni;
DROP POLICY IF EXISTS "segnalazioni_update_owner_or_admin" ON public.segnalazioni;
DROP POLICY IF EXISTS "segnalazioni_delete_owner_or_admin" ON public.segnalazioni;
DROP POLICY IF EXISTS "interazioni_select_public" ON public.interazioni;
DROP POLICY IF EXISTS "interazioni_insert_own" ON public.interazioni;
DROP POLICY IF EXISTS "interazioni_delete_own_or_admin" ON public.interazioni;

create policy "profiles_select_public"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy "segnalazioni_select_public"
  on public.segnalazioni for select
  using (true);

create policy "segnalazioni_insert_authenticated"
  on public.segnalazioni for insert
  with check (auth.uid() = user_id);

create policy "segnalazioni_update_owner_or_admin"
  on public.segnalazioni for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "segnalazioni_delete_owner_or_admin"
  on public.segnalazioni for delete
  using (auth.uid() = user_id or public.is_admin());

create policy "interazioni_select_public"
  on public.interazioni for select
  using (true);

create policy "interazioni_insert_own"
  on public.interazioni for insert
  with check (auth.uid() = utente_id);

create policy "interazioni_delete_own_or_admin"
  on public.interazioni for delete
  using (auth.uid() = utente_id or public.is_admin());

-- =========================================================
-- 4. Storage immagini
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-photos', 'report-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
on conflict (id) do nothing;

DROP POLICY IF EXISTS "public_read_report_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_report_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_own_report_photos" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_own_report_photos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_avatars" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_avatars" ON storage.objects;
DROP POLICY IF EXISTS "auth_update_own_avatars" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_own_avatars" ON storage.objects;

create policy "public_read_report_photos"
  on storage.objects for select
  using (bucket_id = 'report-photos');

create policy "auth_upload_report_photos"
  on storage.objects for insert
  with check (bucket_id = 'report-photos' and auth.role() = 'authenticated');

create policy "auth_update_own_report_photos"
  on storage.objects for update
  using (bucket_id = 'report-photos' and owner = auth.uid());

create policy "auth_delete_own_report_photos"
  on storage.objects for delete
  using (bucket_id = 'report-photos' and owner = auth.uid());

create policy "public_read_avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "auth_upload_avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "auth_update_own_avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy "auth_delete_own_avatars"
  on storage.objects for delete
  using (bucket_id = 'avatars' and owner = auth.uid());

-- =========================================================
-- 5. Dati demo NON personali
-- =========================================================
-- Per creare dati reali, registra un utente dall'app e poi crea segnalazioni.
-- Ho evitato di importare utenti/email dal vecchio database per non pubblicare dati personali.

-- =========================================================
-- 6. Permessi Data API espliciti
-- =========================================================
-- Questi GRANT rendono più prevedibile l'accesso via Supabase Data API.
-- Le policy RLS sopra restano comunque la vera protezione dei dati.

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.profiles to anon;
grant select on table public.segnalazioni to anon;
grant select on table public.interazioni to anon;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.segnalazioni to authenticated;
grant select, insert, delete on table public.interazioni to authenticated;

grant all on table public.profiles, public.segnalazioni, public.interazioni to service_role;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.handle_new_user() to service_role;
grant execute on function public.refresh_like_count() to service_role;
grant execute on function public.touch_updated_at() to service_role;

alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
