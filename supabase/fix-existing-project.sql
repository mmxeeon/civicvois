-- CivicVois - Fix consigliato per progetto Supabase già creato
-- Esegui questo file solo se hai già eseguito schema.sql e vuoi rendere la creazione profilo più robusta.

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
