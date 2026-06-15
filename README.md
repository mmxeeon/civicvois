# CivicVois

CivicVois e una piattaforma civica web/PWA con wrapper nativo iOS e Android tramite Capacitor.

## Stato architettura

- Frontend statico: `index.html`, `assets/`, `service-worker.js`.
- Hosting e deploy: Netlify.
- Backend dati: Supabase per autenticazione, database, storage immagini, moderazione e RPC.
- Bundle nativo: Capacitor usa la cartella generata `www/`.

Non ci sono piu Netlify Functions custom per leggere o scrivere dati applicativi.

## Comandi principali

```bash
npm install
npm run build:web
npm run cap:sync
```

`npm run build:web` copia gli asset sorgenti in `www/`. Eseguilo dopo ogni modifica a `index.html`, `service-worker.js`, `manifest.webmanifest`, `assets/` o `legal/`.

## Verifiche rapide

- Apri `https://civicvois.it`.
- Verifica che refresh e deep link restino sulla piattaforma.
- Crea una segnalazione con categoria, indirizzo verificato, descrizione e una foto.
- Controlla Profilo, esportazione dati, eliminazione account, moderazione e like.
- Applica su Supabase gli script in `supabase/` nell'ordine indicato in `supabase/README.md`, inclusi `03_hardening.sql`, `04_security_hardening.sql`, `05_fix_delete_account_storage.sql` e la verifica `06_publish_readiness_check.sql` prima della pubblicazione.

## Documenti utili

- `README_APP_STORE_PLAY_STORE.md`: checklist store e build native.
- `supabase/01_setup.sql`: schema base.
- `supabase/02_moderation_delete.sql`: moderazione, blocchi ed eliminazione account.
- `supabase/03_hardening.sql`: vincoli server, protezioni insert e policy storage.
- `supabase/04_security_hardening.sql`: hardening storage e funzioni per chiudere warning Supabase.
- `supabase/05_fix_delete_account_storage.sql`: fix obbligatorio per eliminazione account senza delete diretta da `storage.objects`.
- `supabase/06_publish_readiness_check.sql`: query read-only per verificare che Supabase sia pronto alla review.
- `legal/`: privacy, termini, contenuti, supporto ed eliminazione account.
