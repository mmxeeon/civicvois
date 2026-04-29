# CivicVois PWA

Questa versione aggiunge la modalità PWA installabile senza modificare il backend Netlify Functions + Netlify Blobs.

## Test dopo il deploy

1. Apri `/.netlify/functions/civicvois-api?health=1`.
2. Apri `/.netlify/functions/civicvois-api?backend=1`.
3. Apri il sito e fai un refresh forzato.
4. Da iPhone: Safari → Condividi → Aggiungi alla schermata Home.

## Note

- Il service worker non mette in cache le chiamate a `/.netlify/functions/`, quindi login, segnalazioni, like e immagini continuano a usare dati online reali.
- Dopo un deploy importante, se vedi ancora una versione vecchia, chiudi e riapri l’app installata oppure rimuovila e reinstallala dalla schermata Home.
