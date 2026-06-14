# CivicVois - App Store / Play Store

Documento operativo per pubblicare CivicVois come app iOS/Android tramite Capacitor.

## Stato attuale

- Dominio produzione: `https://civicvois.it`
- Hosting PWA: Netlify
- Backend applicativo: Supabase Auth, Postgres, Storage, RPC
- Bundle ID / Package: `it.civicvois.app`
- Versione app: `3.0.0`
- Android `versionCode`: `3`
- iOS `CURRENT_PROJECT_VERSION`: `3`
- Account demo reviewer: `demo@civicvois.it` / `civicvois`

## Comandi

```bash
npm install
npm run build:web
npm run cap:sync
```

Dopo ogni modifica a sorgenti web, legal o service worker esegui `npm run build:web`.
Prima di aprire Xcode/Android Studio esegui `npm run cap:sync`.

## Prima della review

1. Applicare in Supabase SQL Editor:
   - `supabase/01_setup.sql`
   - `supabase/02_moderation_delete.sql`
   - `supabase/03_hardening.sql`
2. Testare login Google reale dopo la CSP di produzione.
3. Testare refresh PWA e navigazione su `https://civicvois.it`.
4. Testare i flussi su iPhone e Android reali:
   - registrazione
   - login
   - creazione segnalazione con una foto
   - verifica indirizzo
   - like/unlike
   - profilo
   - esportazione dati
   - eliminazione account
5. Verificare testi legal:
   - privacy: `https://civicvois.it/legal/privacy`
   - termini: `https://civicvois.it/legal/termini`
   - contenuti UGC: `https://civicvois.it/legal/contenuti`
   - eliminazione account: `https://civicvois.it/legal/elimina-account`
6. Preparare screenshot store e descrizioni usando i file in `store/`.

## Android

Requisiti:

- Android Studio
- SDK/Build Tools recenti
- JDK 17
- Google Play Developer account
- Keystore release custodita fuori dal repository

Controlli:

```bash
java -version
npm run cap:sync
```

Build finale da Android Studio:

`Build -> Generate Signed App Bundle / APK -> Android App Bundle (.aab) -> release`

## iOS

Requisiti:

- Xcode completo
- Apple Developer Program
- Team configurato in Signing & Capabilities

Controlli:

```bash
xcodebuild -version
npm run cap:sync
```

Archive finale da Xcode:

`Product -> Archive -> Distribute App -> App Store Connect`

## Privacy store

Usa `store/PRIVACY_AND_DATA_SAFETY.md` come base per:

- Google Play Data Safety
- Apple App Privacy / Privacy Nutrition Labels

Le risposte vanno comunque verificate nel portale store prima dell'invio.

## Asset store

Usa `store/STORE_LISTING.md` come base per:

- descrizione breve
- descrizione completa
- parole chiave
- categoria
- screenshot richiesti
- note reviewer

## Blocchi che non si risolvono solo dal codice

- Applicazione reale di `supabase/03_hardening.sql` nel progetto Supabase.
- Verifica legale definitiva del titolare e dei testi privacy.
- Login Google reale con account esterno.
- Build firmate e caricate sugli store.
- Test fisici iPhone/Android.
