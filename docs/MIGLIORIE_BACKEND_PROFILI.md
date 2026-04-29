# CivicVois - Migliorie backend profili e dati strutturati

Questa versione parte dalla build funzionante Netlify Functions + Netlify Blobs e non cambia architettura.

## Modifiche incluse

- Registrazione completa: nome, username, email, password, regione, provincia, comune, bio e foto profilo.
- Upload foto profilo su Netlify Blobs tramite bucket logico `avatars`.
- Impostazioni/profilo con modifica reale di nome, username, bio, territorio e foto profilo.
- Località guidate Regione → Provincia → Comune, con combinazioni coerenti.
- Creazione segnalazione con regione, provincia, comune, via, civico e coordinate strutturati.
- Admin con modifica reale di stato e priorità, più eliminazione segnalazioni.
- Compatibilità con dati vecchi: campi mancanti vengono gestiti con fallback.

## Test dopo il deploy

- `/.netlify/functions/civicvois-api?health=1`
- `/.netlify/functions/civicvois-api?backend=1`
- Registrazione nuovo account con foto profilo
- Login
- Modifica profilo da Impostazioni
- Creazione segnalazione
- Like/unlike
- Admin: modifica stato e priorità
