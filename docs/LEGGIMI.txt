# CivicVois - Netlify Blobs Definitivo V2

Questa versione usa Netlify Functions 2.0 (`netlify/functions/civicvois-api.mjs`) e Netlify Blobs.

Test dopo il deploy:

- `/.netlify/functions/civicvois-api?health=1` deve rispondere `ok: true`
- `/.netlify/functions/civicvois-api?backend=1` deve rispondere `ok: true` e `backend: netlify-blobs`

Non usa Supabase. Non servono chiavi `sb_publishable` o `sb_secret`.

Se `health=1` funziona ma `backend=1` non funziona con `MissingBlobsEnvironmentError`, il deploy sta ancora usando una vecchia function Lambda-compatibile: cancella il vecchio file `netlify/functions/civicvois-api.js`, verifica che GitHub contenga solo `civicvois-api.mjs`, poi fai `Clear cache and deploy site`.
