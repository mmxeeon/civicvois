# CivicVois - Netlify Blobs + profili completi

Versione compatibile con Netlify Functions 2.0 e Netlify Blobs.

Non usa Supabase, MySQL o PHP.

## Test rapidi dopo il deploy

- `/.netlify/functions/civicvois-api?health=1` deve rispondere `ok: true`
- `/.netlify/functions/civicvois-api?backend=1` deve rispondere `ok: true` e `backend: netlify-blobs`

## Migliorie incluse

- Registrazione completa con territorio, bio e foto profilo.
- Foto profilo salvata su Netlify Blobs.
- Impostazioni profilo modificabili e persistenti.
- Località vincolate Regione → Provincia → Comune.
- Segnalazioni con dati territoriali strutturati.
- Admin con modifica stato/priorità e cancellazione.
- Service worker aggiornato per evitare cache vecchia.
