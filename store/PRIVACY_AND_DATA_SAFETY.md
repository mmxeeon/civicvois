# CivicVois - Privacy labels e Data Safety

Base operativa per App Store Connect e Google Play Console. Verificare nel portale store prima dell'invio.

## Dati raccolti

### Account

- Email
- Nome completo
- Username
- Identificativo utente interno
- Foto profilo facoltativa

Uso:

- autenticazione
- gestione account
- profilo pubblico/app

### Contenuti generati dall'utente

- Titolo segnalazione
- Descrizione
- Categoria
- Priorita
- Stato
- Foto della segnalazione
- Like/interazioni
- Segnalazioni di contenuti inappropriati

Uso:

- funzionalita app
- pubblicazione contenuti
- moderazione e sicurezza

### Posizione / indirizzo

- Regione
- Provincia
- Comune
- Via e civico inseriti dall'utente
- Coordinate geografiche derivate dalla verifica indirizzo, quando disponibili

Uso:

- georeferenziazione della segnalazione
- ricerca e consultazione territoriale

### Diagnostica tecnica

L'app non integra SDK analytics o advertising dedicati nel codice attuale.
Hosting, Supabase e browser/app store possono produrre log tecnici di sicurezza e funzionamento.

## Condivisione dati

Dati trattati da fornitori necessari al funzionamento:

- Supabase: autenticazione, database, storage immagini.
- Netlify: hosting e distribuzione della PWA.
- Google: accesso Google solo se l'utente lo usa.
- OpenStreetMap/Nominatim: verifica indirizzi.

L'app non vende dati personali e non usa advertising tracking nel codice attuale.

## Sicurezza dati

- Trasmissione via HTTPS/TLS.
- Sessione gestita da Supabase Auth.
- Row Level Security lato Supabase.
- Storage separato per bucket immagini.
- Eliminazione account disponibile dall'app.

Prima della pubblicazione applicare `supabase/03_hardening.sql` per completare i vincoli server e le policy storage.

## Google Play Data Safety - bozza

- Data collected: yes.
- Data shared: yes, with service providers required for app functionality.
- Data encrypted in transit: yes.
- User can request data deletion: yes, in app and via `privacy@civicvois.it`.
- Account creation required: yes for creating reports and interacting.
- Data types:
  - Personal info: email, name, user ID.
  - Photos and videos: user-submitted report/profile images.
  - Location: approximate/precise address-derived location entered by user.
  - App activity: user-generated reports, likes, moderation actions.

## Apple App Privacy - bozza

Data linked to user:

- Contact Info: email.
- User Content: photos, reports, profile content.
- Identifiers: user ID.
- Location: address/coordinates associated with reports.

Purposes:

- App Functionality.
- Account Management.
- User Content Moderation.

Tracking:

- No tracking SDK or advertising tracking configured in the current codebase.

## Verifiche manuali

- Confermare titolare privacy e riferimenti legali.
- Confermare che Google/Facebook login siano descritti solo se attivi nello store build.
- Confermare che non siano stati aggiunti SDK analytics/ads prima dell'invio.
