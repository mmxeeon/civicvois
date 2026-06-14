-- ============================================================================
-- CivicVois — Hardening sicurezza aggiuntivo (INCREMENTALE, NON distruttivo)
-- ============================================================================
-- Esegui DOPO 01_setup.sql, 02_moderation_delete.sql e 03_hardening.sql.
--   Supabase → SQL Editor → New query → incolla tutto → Run.  È idempotente.
--
-- Chiude tre Security Advisor di Supabase:
--   1. Bucket pubblici con SELECT ampia su storage.objects → consentivano il
--      LISTING (enumerazione) di tutti i file. I bucket sono PUBLIC, quindi la
--      lettura delle immagini avviene via /storage/v1/object/public/... e NON
--      passa da RLS: rimuovere le policy SELECT blocca solo l'enumerazione, le
--      immagini continuano a caricarsi.
--   3. search_path mutabile sulle trigger function di updated_at.
--
-- NB (advisor #2 "Leaked Password Protection"): NON è SQL. Va abilitato dalla
--   dashboard: Authentication → Sign In / Providers → Password →
--   "Leaked password protection". Il controllo HIBP scatta a signup/cambio
--   password, NON al login: l'account demo esistente resta valido.
-- ============================================================================

-- ── 1. Rimuove il LISTING sui bucket pubblici (lettura pubblica invariata) ────
drop policy if exists "public_read_avatars"      on storage.objects;
drop policy if exists "storage_read_avatars"     on storage.objects;
drop policy if exists "public_read_report_photos" on storage.objects;
drop policy if exists "storage_read_reportphotos" on storage.objects;

-- ── 3. search_path fisso sulle trigger function (usano solo now()) ────────────
alter function public.set_updated_at()   set search_path = '';
alter function public.touch_updated_at() set search_path = '';

-- ============================================================================
-- Verifica rapida (facoltativa):
--   select count(*) from pg_policies
--     where schemaname='storage' and tablename='objects' and cmd='SELECT';  -- 0
--   select proname, proconfig from pg_proc
--     where proname in ('set_updated_at','touch_updated_at');  -- search_path=""
-- ============================================================================
