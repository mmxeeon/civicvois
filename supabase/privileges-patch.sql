-- CivicVois - Patch permessi Data API Supabase
-- Esegui questo file nel SQL Editor se hai già eseguito schema.sql.
-- È sicuro rilanciarlo più volte.

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
