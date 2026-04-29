CIVICVOIS - VERSIONE NETLIFY + SUPABASE
======================================

Questa versione NON usa PHP e NON usa MySQL.
È stata riscritta per funzionare su Netlify come frontend statico moderno, con backend Supabase per:

- registrazione e login utenti;
- profili;
- creazione segnalazioni;
- upload immagini;
- feed pubblico;
- filtri;
- like senza duplicati;
- area admin;
- cambio stato segnalazione;
- mappa con OpenStreetMap/Leaflet;
- modalità demo locale se Supabase non è ancora configurato.

STRUTTURA
---------

index.html
assets/css/styles.css
assets/js/app.js
assets/js/config.js
assets/img/civicvois-logo.png
supabase/schema.sql
supabase/seed-demo.sql
netlify.toml
_redirects

COME PUBBLICARLO SUBITO SU NETLIFY
----------------------------------

1. Carica tutta questa cartella o lo ZIP su Netlify.
2. Il sito si aprirà subito in modalità demo locale.
3. In modalità demo puoi provare login, dashboard, segnalazioni, like e admin.
4. Però i dati restano nel browser e non sono dati reali online.

COME ATTIVARE IL BACKEND REALE SUPABASE
---------------------------------------

1. Vai su Supabase e crea un nuovo progetto.
2. Apri SQL Editor.
3. Incolla ed esegui tutto il contenuto di:

   supabase/schema.sql

4. Vai in Project Settings -> API.
5. Copia:

   Project URL
   anon public key

6. Apri questo file:

   assets/js/config.js

7. Inserisci i valori:

   export const SUPABASE_URL = "https://TUO-PROGETTO.supabase.co";
   export const SUPABASE_ANON_KEY = "LA-TUA-ANON-PUBLIC-KEY";

8. Ricarica lo ZIP aggiornato su Netlify.
9. Il sito uscirà dalla modalità demo e userà Supabase.

COME RENDERE IL TUO ACCOUNT ADMIN
---------------------------------

1. Registrati dal sito con la tua email.
2. Vai su Supabase -> Table Editor -> profiles.
3. Trova il tuo profilo.
4. Cambia il campo role da:

   user

   a:

   admin

Oppure usa SQL Editor:

update public.profiles
set role = 'admin'
where email = 'tua-email@example.com';

COSA È STATO FATTO RISPETTO ALLA VERSIONE PHP
---------------------------------------------

- Eliminato completamente PHP, quindi Netlify ora può pubblicarlo.
- Eliminato MySQL locale/server e sostituito con Supabase Postgres.
- Login e registrazione tramite Supabase Auth.
- Tabelle nuove e pulite: profiles, segnalazioni, interazioni.
- RLS/policy di sicurezza incluse nello schema.
- Storage immagini con bucket report-photos e avatars.
- Grafica completamente rifatta mobile-first.
- Dashboard responsive con feed, mappa, statistiche e attività recenti.
- Nuova pagina creazione segnalazione.
- Profilo utente modificabile.
- Area admin per cambiare stato ed eliminare segnalazioni.
- Modalità demo locale per testare senza backend.

NOTA IMPORTANTE
---------------

Non ho importato gli utenti, email e dati personali del vecchio database dentro il nuovo seed,
perché sarebbe rischioso pubblicare informazioni personali in un progetto caricabile su Netlify.
Il file CIVICVOIS.sql originale resta utile come riferimento, ma questa versione usa uno schema Supabase nuovo.

DOMINIO CIVICVOIS.IT
--------------------

Il dominio civicvois.it può restare collegato a Netlify.
Quando carichi questo ZIP nel progetto Netlify già collegato al dominio, il sito sarà raggiungibile da civicvois.it appena i DNS sono verificati.

LIMITI REALI
------------

La parte frontend è pronta.
Per avere dati reali online serve obbligatoriamente creare il progetto Supabase e inserire URL/key in config.js.
Senza quei dati, nessuno può creare per te un backend reale perché le chiavi vengono generate dal tuo account Supabase.
