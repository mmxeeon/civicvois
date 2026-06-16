-- 07_optional_report_fields.sql
-- ============================================================================
-- Rende la DESCRIZIONE facoltativa nelle segnalazioni.
--
-- Prima il vincolo imponeva almeno 1 carattere:
--     CHECK (char_length(descrizione) >= 1 AND char_length(descrizione) <= 2000)
-- quindi pubblicare una segnalazione SENZA descrizione falliva con violazione
-- del CHECK "seg_desc_len".
--
-- Qui ammettiamo descrizione vuota (0 caratteri) mantenendo il limite massimo
-- di 2000. La colonna resta NOT NULL: l'app salva stringa vuota '' quando
-- l'utente non scrive nulla, e '' soddisfa sia NOT NULL sia il nuovo CHECK.
--
-- civico e photo_url NON richiedono modifiche: restano NOT NULL ma i loro
-- vincoli (char_length(civico) <= 20, nessun check su photo_url) ammettono gia'
-- la stringa vuota '', che e' cio' che l'app salva quando sono assenti.
--
-- SICURO e NON distruttivo: nessun dato viene modificato o cancellato, si
-- rilassa soltanto una regola di validazione.
-- ============================================================================

alter table public.segnalazioni drop constraint if exists seg_desc_len;
alter table public.segnalazioni
  add constraint seg_desc_len check (char_length(descrizione) <= 2000);

-- Verifica (facoltativa): la riga deve mostrare il nuovo CHECK senza ">= 1".
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid = 'public.segnalazioni'::regclass and conname = 'seg_desc_len';
