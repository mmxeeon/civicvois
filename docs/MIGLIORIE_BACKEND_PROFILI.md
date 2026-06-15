# CivicVois - profili, dati strutturati e backend Supabase

Questa versione usa Supabase come backend applicativo: Auth, database Postgres,
Storage e RPC. Netlify ospita la PWA statica.

## Modifiche incluse

- Registrazione completa: nome, username, email, password, regione, provincia, comune, bio e foto profilo.
- Upload foto profilo su Supabase Storage nel bucket `avatars`.
- Impostazioni/profilo con modifica reale di nome, username, bio, territorio e foto profilo.
- Localita guidate Regione -> Provincia -> Comune, con combinazioni coerenti.
- Creazione segnalazione con regione, provincia, comune, via, civico, coordinate e foto.
- Admin con modifica reale di stato e priorita, eliminazione segnalazioni e coda moderazione.
- Moderazione UGC: segnalazione contenuti, blocco utenti, filtro termini offensivi e gestione admin.
- Eliminazione account tramite RPC Supabase e pulizia immagini lato client quando le policy storage sono attive.

## Test dopo il deploy

- Registrazione nuovo account con foto profilo.
- Login email/password.
- Login Google reale dopo aggiornamento CSP e configurazione provider.
- Modifica profilo da Impostazioni.
- Creazione segnalazione con una foto.
- Like/unlike.
- Esportazione dati.
- Eliminazione account.
- Admin: modifica stato/priorita e risoluzione segnalazioni di contenuto.

## Note operative

Prima della pubblicazione applicare in Supabase SQL Editor:

1. `supabase/01_setup.sql`
2. `supabase/02_moderation_delete.sql`
3. `supabase/03_hardening.sql`
4. `supabase/04_security_hardening.sql`
5. `supabase/05_fix_delete_account_storage.sql`
6. `supabase/06_publish_readiness_check.sql`
