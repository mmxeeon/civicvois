# CivicVois - Versione definitiva Netlify

Questa versione NON usa Supabase.

Backend utilizzato:

- Netlify Static Hosting per il frontend
- Netlify Functions per API, login, registrazione, segnalazioni, like e upload
- Netlify Blobs per persistenza dati e immagini

## Deploy corretto

1. Carica tutti questi file nel repository GitHub `mmxeeon/civicvois`.
2. Fai commit e push su `main`.
3. Netlify farà il deploy automatico.
4. Apri il test:

```text
https://keen-palmier-430d1a.netlify.app/.netlify/functions/civicvois-api?health=1
```

Deve rispondere con `ok: true` e `backend: netlify-blobs`.

5. Apri anche:

```text
https://keen-palmier-430d1a.netlify.app/.netlify/functions/civicvois-api?backend=1
```

Deve rispondere con `ok: true`.

6. Poi apri il sito:

```text
https://keen-palmier-430d1a.netlify.app
```

Fai refresh forzato con `CMD + SHIFT + R`, poi registrati.

## Nota admin

Il primo account registrato diventa automaticamente admin.

## Variabile ambiente consigliata

Non è obbligatoria per partire, ma è consigliato impostare su Netlify:

```text
CIVICVOIS_SESSION_SECRET = una-frase-lunga-casuale
```

Questa variabile rende più sicuri i token di sessione.

## Non serve più

- Supabase URL
- Supabase publishable key
- Supabase secret key
- SQL Editor Supabase
- RLS Supabase
