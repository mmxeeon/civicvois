# CivicVois - checklist rapida debug

Questa build usa il client ufficiale `supabase-js` via CDN, senza wrapper custom sugli header.

## Ordine corretto di test

1. Carica lo ZIP su Netlify.
2. Apri prima `https://keen-palmier-430d1a.netlify.app`, non `civicvois.it`.
3. Fai refresh forzato: `CMD + SHIFT + R`.
4. Se hai già eseguito `schema.sql`, esegui anche `supabase/privileges-patch.sql` nel SQL Editor.
5. In Supabase controlla `Integrations > Data API`: devono essere esposte `profiles`, `segnalazioni`, `interazioni`.
6. Per i test iniziali puoi disattivare `Confirm email` in Authentication, altrimenti dopo la registrazione può essere necessario confermare la mail.

## Comandi utili in Console Chrome

```js
window.CV_DEBUG.dump()
await window.CV_DEBUG.testRest()
await window.CV_DEBUG.testAuth()
```

Se `testRest()` dà 200/array vuoto, il collegamento al database funziona.
Se dà 401/403, il problema è chiave/permessi/Data API/RLS.
Se dà `Failed to fetch`, controlla HTTPS, dominio custom, estensioni, VPN o blocchi browser.

## Sicurezza

La `sb_secret_...` esposta in chat va rigenerata/eliminata da Supabase. Nel frontend deve restare solo la `sb_publishable_...`.
