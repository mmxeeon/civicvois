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
- Android release AAB verificata: `android/app/build/outputs/bundle/release/app-release.aab`
- Android upload key locale: `android/civicvois-upload-key.p12`
- Android keystore config locale: `android/keystore.properties`

## Stato readiness 2026-06-20

Completato nel progetto:

- JDK 17 disponibile via Homebrew: `/opt/homebrew/opt/openjdk@17`
- Android SDK locale collegato tramite `android/local.properties`.
- `:app:assembleDebug` Android verificato.
- `:app:bundleRelease` Android verificato.
- AAB release firmata e verificata con `jarsigner`.
- Manifest Android senza permessi media ampi (`READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` rimossi).
- Backup Android disabilitato per evitare backup di sessioni/local storage.
- Cleartext traffic Android disabilitato.
- Sign in with Apple visibile su iOS, nascosto su Android/web finché il provider Apple non è configurato.
- Build iOS Release per dispositivo verificata con `CODE_SIGNING_ALLOWED=NO`.

Resta esterno al codice:

- Abilitare provider Apple in Supabase e Apple Developer.
- Configurare signing/provisioning Apple in Xcode.
- Caricare AAB/Archive nei rispettivi store.
- Test reale finale su iPhone e Android fisici.

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
   - `supabase/04_security_hardening.sql`
   - `supabase/05_fix_delete_account_storage.sql`
   - `supabase/06_publish_readiness_check.sql`
2. Verificare che `supabase/06_publish_readiness_check.sql` restituisca solo righe con `ok = true`.
3. Testare eliminazione account con un account test sacrificabile.
4. Testare login Google reale dopo la CSP di produzione.
5. Configurare e testare Sign in with Apple:
   - Apple Developer: abilitare Sign in with Apple sull'App ID `it.civicvois.app`.
   - Apple Developer: creare/configurare il Services ID per OAuth web se richiesto da Supabase.
   - Supabase Auth: abilitare il provider Apple con Client ID/Secret richiesti.
   - Supabase Auth URL Configuration: aggiungere `it.civicvois.app://login-callback` tra i redirect consentiti.
   - Supabase provider callback Apple: usare `https://zqvzpnaxsoxpljdzojjq.supabase.co/auth/v1/callback`.
   - Testare ritorno dal browser OAuth all'app nativa.
6. Testare refresh PWA e navigazione su `https://civicvois.it`.
7. Testare i flussi su iPhone e Android reali:
   - registrazione
   - login
   - login Apple su iOS
   - creazione segnalazione con una foto
   - verifica indirizzo
   - like/unlike
   - profilo
   - esportazione dati
   - eliminazione account
8. Verificare testi legal:
   - privacy: `https://civicvois.it/legal/privacy`
   - termini: `https://civicvois.it/legal/termini`
   - contenuti UGC: `https://civicvois.it/legal/contenuti`
   - eliminazione account: `https://civicvois.it/legal/elimina-account`
9. Preparare screenshot store e descrizioni usando i file in `store/`.

## Android

Requisiti:

- Android Studio
- SDK/Build Tools recenti
- JDK 17
- Google Play Developer account
- Keystore release custodita fuori dal repository Git

Controlli:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew :app:assembleDebug
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew :app:bundleRelease
npm run cap:sync
```

Build finale da terminale:

```bash
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew :app:bundleRelease
```

Artefatto:

`android/app/build/outputs/bundle/release/app-release.aab`

Verifica firma:

```bash
/opt/homebrew/opt/openjdk@17/bin/jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab
```

Nota: la upload key e il file `keystore.properties` sono ignorati da Git. Devono restare conservati in modo sicuro per aggiornare l'app su Play Console.

Build finale alternativa da Android Studio:

`Build -> Generate Signed App Bundle / APK -> Android App Bundle (.aab) -> release`

Checklist Play Store:

- [x] Package id stabile: `it.civicvois.app`.
- [x] Target SDK 35.
- [x] AAB release firmata generata.
- [x] Permessi media ampi rimossi.
- [x] Data Safety draft presente.
- [ ] Caricare AAB in Play Console.
- [ ] Completare Data Safety nel portale Google Play.
- [ ] Completare Content Rating.
- [ ] Completare App Access con account demo.
- [ ] Caricare feature graphic 1024x500 e screenshot finali.
- [ ] Testare su Android reale login email, Google, foto, profilo, delete account.
- [ ] Se account Play personale nuovo: completare eventuale closed test richiesto da Google.

## iOS

Requisiti:

- Xcode completo
- Apple Developer Program
- Team configurato in Signing & Capabilities

Controlli:

```bash
xcodebuild -version
npm run cap:sync
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' build CODE_SIGNING_ALLOWED=NO
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

- Applicazione reale degli script Supabase `03`, `04`, `05` e verifica `06` nel progetto Supabase.
- Test reale di eliminazione account con account sacrificabile.
- Verifica legale definitiva del titolare e dei testi privacy.
- Configurazione Sign in with Apple nell'account Apple Developer e in Supabase Auth.
- Login Google reale con account esterno.
- Login Apple reale con Apple ID esterno.
- Archive iOS firmato e caricato su App Store Connect.
- Test fisici iPhone/Android.
