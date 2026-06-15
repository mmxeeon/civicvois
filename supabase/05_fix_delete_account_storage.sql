-- ============================================================================
-- CivicVois — Fix eliminazione account / Supabase Storage
-- ============================================================================
-- Da eseguire su Supabase dopo 02_moderation_delete.sql se l'app mostra:
--   "Direct deletion from storage tables is not allowed. Use the Storage API instead."
--
-- Motivo:
-- Supabase blocca la cancellazione diretta da storage.objects dentro SQL.
-- La app elimina già report-photos e avatars tramite Storage API prima di
-- chiamare questa RPC; la funzione deve quindi limitarsi a cancellare auth.users.
-- Il CASCADE rimuove profilo, segnalazioni, like, blocchi e report collegati.
-- ============================================================================

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Utente non autenticato';
  end if;

  delete from auth.users where id = current_user_id;
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

