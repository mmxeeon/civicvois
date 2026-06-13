-- ============================================================================
-- CivicVois — Moderazione, blocchi, eliminazione account (INCREMENTALE)
-- ============================================================================
-- Esegui DOPO 01_setup.sql. Aggiunge solo nuove tabelle e funzioni: NON tocca
-- profiles/segnalazioni/interazioni già esistenti.
--   Supabase → SQL Editor → New query → incolla tutto → Run.  È idempotente.
-- ============================================================================

-- ── 1. Segnalazioni di contenuti abusivi (coda di moderazione) ───────────────
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_id   text not null,                 -- id della segnalazione (o contenuto) segnalata
  target_type text not null default 'segnalazione',
  reason      text not null default '',
  status      text not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_reports_status on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;
-- Chiunque sia autenticato può segnalare (sempre come sé stesso)
drop policy if exists "reports_insert" on public.content_reports;
create policy "reports_insert" on public.content_reports for insert to authenticated
  with check (reporter_id = auth.uid());
-- Solo un admin legge e risolve la coda
drop policy if exists "reports_admin_read" on public.content_reports;
create policy "reports_admin_read" on public.content_reports for select using (public.is_admin());
drop policy if exists "reports_admin_update" on public.content_reports;
create policy "reports_admin_update" on public.content_reports for update using (public.is_admin());

-- ── 2. Blocchi tra utenti ────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;
-- Ognuno gestisce solo i propri blocchi
drop policy if exists "blocks_insert" on public.user_blocks;
create policy "blocks_insert" on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());
drop policy if exists "blocks_read" on public.user_blocks;
create policy "blocks_read" on public.user_blocks for select using (blocker_id = auth.uid());
drop policy if exists "blocks_delete" on public.user_blocks;
create policy "blocks_delete" on public.user_blocks for delete using (blocker_id = auth.uid());

-- ── 3. Eliminazione account (l'utente cancella sé stesso) ────────────────────
-- SECURITY DEFINER: gira coi privilegi del proprietario, così può eliminare la
-- riga in auth.users; il CASCADE rimuove profilo, segnalazioni, like, blocchi e
-- report collegati. Richiesta da Apple/Google per app con creazione account.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================================
-- Verifica rapida (facoltativa):
--   select tablename from pg_tables where schemaname='public'
--     and tablename in ('content_reports','user_blocks');         -- 2 righe
--   select proname from pg_proc where proname='delete_my_account'; -- 1 riga
-- ============================================================================
