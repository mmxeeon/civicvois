-- ============================================================================
-- CivicVois — Supabase publish readiness check
-- ============================================================================
-- Esegui in Supabase SQL Editor DOPO:
--   01_setup.sql (solo database nuovo)
--   02_moderation_delete.sql
--   03_hardening.sql
--   04_security_hardening.sql
--   05_fix_delete_account_storage.sql
--
-- Non modifica dati. Restituisce righe check_name / ok / details.
-- Tutte le righe devono avere ok = true prima della review.
-- ============================================================================

with checks as (
  select
    'tables_core' as check_name,
    (
      to_regclass('public.profiles') is not null
      and to_regclass('public.segnalazioni') is not null
      and to_regclass('public.interazioni') is not null
    ) as ok,
    'profiles, segnalazioni, interazioni presenti' as details

  union all
  select
    'tables_moderation',
    (
      to_regclass('public.content_reports') is not null
      and to_regclass('public.user_blocks') is not null
    ),
    'content_reports e user_blocks presenti'

  union all
  select
    'rls_enabled_core',
    count(*) = 3,
    'RLS attiva sulle 3 tabelle core'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles', 'segnalazioni', 'interazioni')
    and c.relrowsecurity = true

  union all
  select
    'rls_enabled_moderation',
    count(*) = 2,
    'RLS attiva sulle tabelle moderazione/blocchi'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('content_reports', 'user_blocks')
    and c.relrowsecurity = true

  union all
  select
    'delete_my_account_exists',
    to_regprocedure('public.delete_my_account()') is not null,
    'RPC delete_my_account presente'

  union all
  select
    'delete_my_account_no_storage_delete',
    case
      when to_regprocedure('public.delete_my_account()') is null then false
      else pg_get_functiondef(to_regprocedure('public.delete_my_account()')) not ilike '%storage.objects%'
    end,
    'delete_my_account non deve cancellare direttamente storage.objects'

  union all
  select
    'delete_my_account_grant_authenticated',
    case
      when to_regprocedure('public.delete_my_account()') is null then false
      else has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE')
    end,
    'authenticated puo eseguire delete_my_account'

  union all
  select
    'seg_insert_trigger',
    exists (
      select 1 from pg_trigger
      where tgname = 'trg_seg_insert'
        and tgrelid = to_regclass('public.segnalazioni')
        and not tgisinternal
    ),
    'trigger insert segnalazioni protegge stato/like_count'

  union all
  select
    'storage_delete_policies',
    count(*) = 2,
    'policy DELETE storage per report-photos e avatars'
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'DELETE'
    and policyname in ('storage_delete_reportphotos', 'storage_delete_avatars')

  union all
  select
    'storage_select_listing_closed',
    count(*) = 0,
    'nessuna policy SELECT su storage.objects: evita listing bucket pubblici'
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd = 'SELECT'

  union all
  select
    'buckets_exist',
    count(*) = 2,
    'bucket report-photos e avatars presenti'
  from storage.buckets
  where id in ('report-photos', 'avatars')

  union all
  select
    'constraints_publication',
    count(*) >= 7,
    'vincoli lunghezza/segnalazioni/profili applicati'
  from pg_constraint
  where conname in (
    'seg_titolo_len',
    'seg_desc_len',
    'seg_tipo_len',
    'seg_via_len',
    'seg_civico_len',
    'prof_username_len',
    'prof_bio_len'
  )
)
select check_name, ok, details
from checks
order by check_name;
