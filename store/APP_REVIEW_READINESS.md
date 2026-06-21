# CivicVois - App Review readiness

Documento operativo per preparare la build iOS prima di TestFlight e App Store
Connect. Non sostituisce i test reali su dispositivo.

## Stato auth

Metodi disponibili nell'app:

- Email e password tramite Supabase Auth.
- Google tramite Supabase OAuth.
- Apple tramite Supabase OAuth e deep link nativo `it.civicvois.app://login-callback`.

Il login Apple e' gia' previsto nella UI e nel flusso OAuth dell'app, ma resta
da configurare fuori dal codice quando l'account Apple Developer sara' attivo.
Nella build Android il pulsante Apple resta nascosto finche' il provider non e'
attivo, per non esporre una funzione non funzionante su Google Play.

## Configurazione Apple Developer richiesta

Da completare prima di TestFlight:

- Abilitare **Sign in with Apple** sull'App ID collegato a `it.civicvois.app`.
- Creare/configurare il Services ID richiesto dal provider Apple OAuth.
- Generare la chiave/secret Apple richiesta da Supabase Auth.
- In Supabase Auth -> Providers -> Apple, inserire Client ID e secret Apple.
- In Supabase Auth -> URL Configuration, consentire:
  - `it.civicvois.app://login-callback`
  - `https://civicvois.it/`
  - eventuale URL preview/staging usato per test.
- Nel portale Apple, usare come callback del provider:
  - `https://zqvzpnaxsoxpljdzojjq.supabase.co/auth/v1/callback`

## Account demo per Apple Review

Account suggerito:

- Email: `demo@civicvois.it`
- Password: `civicvois`

Prima dell'invio verificare che l'account:

- esista su Supabase Auth;
- abbia profilo completo;
- possa vedere dashboard e segnalazioni;
- non sia stato eliminato durante test precedenti.

Per testare la cancellazione account usare un account sacrificabile separato,
non l'account demo principale.

## Note reviewer suggerite

```text
CivicVois e' una piattaforma civica indipendente e non ufficiale. Non e'
affiliata a Comuni, enti pubblici o Pubblica Amministrazione e le segnalazioni
create nell'app non vengono inoltrate automaticamente agli enti competenti.

Account demo:
Email: demo@civicvois.it
Password: civicvois

Flussi testabili:
- accesso email/password;
- accesso con Apple, se configurato nella build review;
- dashboard segnalazioni;
- creazione segnalazione con indirizzo, categoria e foto;
- like/unlike;
- dettaglio segnalazione;
- profilo utente;
- esportazione dati;
- cancellazione account.

Moderazione UGC:
gli utenti possono segnalare contenuti inappropriati e bloccare altri utenti.
Le regole sui contenuti vietano offese, spam, dati personali di terzi, targhe e
volti riconoscibili. Le segnalazioni vengono revisionate dal gestore del servizio.
```

## Checklist TestFlight

- [ ] `npm run cap:sync` eseguito dopo le ultime modifiche web.
- [ ] `supabase/06_publish_readiness_check.sql` restituisce solo `ok = true`.
- [ ] Email/password: login, logout, sessione dopo riapertura.
- [ ] Google: login, ritorno browser OAuth, completamento profilo.
- [ ] Apple: login, ritorno browser OAuth, completamento profilo.
- [ ] Registrazione email/password.
- [ ] Completamento profilo con regione, provincia e comune.
- [ ] Creazione segnalazione con categoria, priorita, indirizzo e foto.
- [ ] Upload foto da libreria.
- [ ] Upload/scatto foto da fotocamera, se disponibile.
- [ ] Like/unlike.
- [ ] Filtri dashboard.
- [ ] Dettaglio segnalazione.
- [ ] Export dati.
- [ ] Eliminazione account con account sacrificabile.
- [ ] Kill app dalla RAM e riapertura con sessione attiva.
- [ ] Ritorno corretto da browser OAuth se l'utente annulla.
- [ ] Safe area, tastiera e bottom navbar su iPhone piccolo e grande.

## Checklist App Store

- [ ] Sign in with Apple realmente configurato e funzionante.
- [ ] PrivacyInfo.xcprivacy coerente con App Store Privacy Labels.
- [ ] Privacy policy pubblica raggiungibile da `https://civicvois.it/legal/privacy`.
- [ ] Termini pubblici raggiungibili da `https://civicvois.it/legal/termini`.
- [ ] Pagina eliminazione account raggiungibile da `https://civicvois.it/legal/elimina-account`.
- [ ] Screenshot finali caricati in App Store Connect.
- [ ] Note reviewer inserite.
- [ ] Account demo verificato.
- [ ] Archive Xcode senza errori o warning bloccanti.
- [ ] Nessun dato secret/server-side nel repository.

## Checklist Google Play

- [x] `targetSdkVersion` 35.
- [x] `applicationId` stabile: `it.civicvois.app`.
- [x] AAB release generata.
- [x] AAB release firmata con upload key locale.
- [x] Permessi media ampi rimossi dal manifest Android.
- [x] Backup Android disabilitato.
- [x] Cleartext traffic Android disabilitato.
- [x] `npm audit --omit=dev` senza vulnerabilita'.
- [ ] AAB caricata in Play Console.
- [ ] Data Safety completata nel portale.
- [ ] Content Rating completato.
- [ ] App Access configurato con account demo.
- [ ] Screenshot e feature graphic caricate.
- [ ] Test reale su Android: email/password, Google OAuth, foto, profilo, export, delete account.
- [ ] Eventuale closed test Google Play completato se richiesto dall'account sviluppatore.

## Rischi residui

- Il login Apple non puo' essere validato completamente senza configurazione
  Apple Developer e provider Supabase.
- Il flusso OAuth nativo dipende dai redirect consentiti in Supabase.
- Le foto delle segnalazioni e gli avatar sono pubblici per design: privacy
  policy e store privacy labels devono dichiararlo.
- La moderazione UGC e' presente, ma prima del lancio pubblico conviene
  rafforzare anti-spam/rate limiting lato server.
- L'AAB Android e' tecnicamente pronta, ma va testata su dispositivo reale prima
  della review.
