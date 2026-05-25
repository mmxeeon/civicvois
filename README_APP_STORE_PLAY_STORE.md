# CivicVois — Build e pubblicazione App Store / Play Store

Questo documento spiega come buildare CivicVois come app iOS/Android (Capacitor) e come pubblicarla sui due store, partendo dal codice attuale.

Backend in produzione: `https://civicvois.it/.netlify/functions`
Bundle ID / Package: `it.civicvois.app`
Nome app: `CivicVois`

---

## 1. Cosa contiene il progetto

```
mv4/
├── index.html, manifest.webmanifest, service-worker.js   # PWA (resta deployata su Netlify)
├── assets/                                               # CSS, JS, icone, immagini
├── netlify/                                              # Backend Netlify Functions (immutato)
├── netlify.toml, _headers, _redirects                    # Config Netlify
│
├── package.json                                          # Dipendenze + script Capacitor
├── capacitor.config.json                                 # Config app nativa (appId, plugin, ...)
├── scripts/build-web.mjs                                 # Copia gli asset web in www/
├── www/                                                  # Output build (consumato da Capacitor)
├── resources/                                            # Sorgenti icone/splash
│
├── ios/                                                  # Progetto Xcode (committare)
└── android/                                              # Progetto Android Studio (committare)
```

Le **app native** sono solo un WebView Capacitor che carica `www/` (copia di `index.html` + `assets/`).
Il backend resta `civicvois.it/.netlify/functions` — non duplicato, non riscritto.

---

## 2. Strumenti necessari sulla macchina di build

Già installati:
- [x] **Node.js + npm** (`brew install node`) — fatto durante il setup.
- [x] **Homebrew**.
- [x] **Xcode Command Line Tools** (necessario per CocoaPods).
- [x] **CocoaPods** (`gem install cocoapods` o `brew install cocoapods`).

Da installare prima di buildare le app:

### iOS
- **Xcode** completo (App Store, ~12 GB). NB: `xcode-select` deve puntare a `/Applications/Xcode.app/Contents/Developer`. Verifica:
  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  xcodebuild -version
  ```
- **Account Apple Developer** ($99/anno) → https://developer.apple.com
- **App Store Connect** (incluso): https://appstoreconnect.apple.com

### Android
- **Android Studio** (Hedgehog o successivo): https://developer.android.com/studio
- All'apertura, accetta SDK + crea/installa l'Android SDK Platform 34+ e Build Tools.
- **JDK 17** (di solito incluso da Android Studio in "Embedded JDK").
- **Google Play Developer account** (una tantum $25): https://play.google.com/console

---

## 3. Comandi di lavoro quotidiano

Da eseguire nella root del progetto (`/Users/mattiamolteni/Downloads/mv4`):

| Comando | Cosa fa |
|---|---|
| `npm install` | Installa tutte le dipendenze Capacitor. |
| `npm run build:web` | Rigenera la cartella `www/` dagli asset sorgenti. |
| `npm run cap:sync` | Build web **+** copia in iOS/Android **+** `pod install`. |
| `npm run cap:ios` | Sync **+** apre il progetto in Xcode. |
| `npm run cap:android` | Sync **+** apre il progetto in Android Studio. |
| `npm run cap:icons` | Rigenera icone + splash da `resources/icon.png`. |

> **Importante**: dopo qualsiasi modifica al codice in `assets/` o a `index.html`, devi rilanciare `npm run cap:sync` per portarla dentro le app native.

---

## 4. Fix noto (solo macOS, prima volta)

CocoaPods + Ruby 3.4 dà errore `Unicode Normalization not appropriate for ASCII-8BIT`. Soluzione: prima di lanciare comandi che invocano `pod install`, esporta:

```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

Puoi aggiungerle al tuo `~/.zshrc` per renderle permanenti.

---

## 5. Build iOS → App Store

1. Installa Xcode dall'App Store e accetta i termini la prima volta che lo apri.
2. Apri il progetto:
   ```bash
   npm run cap:ios
   ```
   Xcode aprirà `ios/App/App.xcworkspace`.
3. In alto a sinistra seleziona il target **App** → **Signing & Capabilities**:
   - **Team**: scegli il tuo team Apple Developer.
   - **Bundle Identifier**: `it.civicvois.app` (già impostato).
   - Spunta **Automatically manage signing**.
4. Imposta **Version** e **Build** in **General** (es. `1.0.0` / `1`).
5. Verifica i campi privacy in `ios/App/App/Info.plist` (già pre-compilati in italiano per Localizzazione, Camera, Foto).
6. Connetti un iPhone o seleziona **Any iOS Device (arm64)** in alto.
7. Menu **Product → Archive**. Quando finisce, si apre **Organizer**.
8. In Organizer: **Distribute App → App Store Connect → Upload**.
9. Vai su https://appstoreconnect.apple.com → la build apparirà in pochi minuti.
10. Crea una nuova app (la prima volta) usando bundle ID `it.civicvois.app`, compila scheda store (descrizione, screenshot, categorie, privacy policy URL).
11. Associa la build, sottoponi a review.

---

## 6. Build Android → Play Store

1. Installa Android Studio e completa il primo wizard (SDK 34, Build Tools).
2. Apri il progetto:
   ```bash
   npm run cap:android
   ```
   Android Studio aprirà la cartella `android/`. Aspetta il primo Gradle Sync (può richiedere alcuni minuti).
3. Imposta `versionCode` e `versionName` in `android/app/build.gradle` (già `1` / `1.0`).
4. Genera una keystore di firma (una sola volta, **conservala in un posto sicuro e fanne backup**):
   ```bash
   keytool -genkey -v -keystore ~/civicvois-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias civicvois
   ```
5. In Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle (.aab)** → seleziona la keystore appena creata → **release**.
6. Il file finale sarà in `android/app/release/app-release.aab`.
7. Vai su https://play.google.com/console → crea l'app (package `it.civicvois.app`), compila scheda store, carica l'`.aab` su **Production → Crea nuova release**.
8. Compila **Sicurezza dei dati**, **Dichiarazione contenuti**, **Privacy policy** (URL pubblico obbligatorio).

---

## 7. Checklist pubblicazione

### Obbligatori per entrambi gli store
- [ ] **Privacy Policy** pubblica (es. `https://civicvois.it/privacy`). Senza, gli store rifiutano.
- [ ] **Terms of Service** raccomandato.
- [ ] **Bundle ID / Package**: `it.civicvois.app` — già impostato.
- [ ] **Icone**: generate da `resources/icon.png` con `npm run cap:icons`. Verifica che `resources/icon.png` sia 1024×1024 (attualmente usata `icon-1024.png` esistente).
- [ ] **Splash screen**: generato automaticamente, sfondo `#0b1020`.
- [ ] **Screenshot**: minimo richiesto:
  - iOS: 6.7" (iPhone 15 Pro Max) + 6.5" + 12.9" iPad → 3 screenshot ciascuno.
  - Android: minimo 2 screenshot per smartphone + 1 grafico funzione (1024×500).
- [ ] **Descrizione store** (IT + EN raccomandato).
- [ ] **Categoria**: Utilità / Social / Lifestyle.
- [ ] **Età**: pre-compila il questionario su entrambi gli store.

### Permessi dichiarati nelle app
| Permesso | iOS (Info.plist) | Android (Manifest) | Uso |
|---|---|---|---|
| Geolocalizzazione | `NSLocationWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION` | Georeferenziare segnalazioni |
| Camera | `NSCameraUsageDescription` | `CAMERA` | Foto allegate alle segnalazioni |
| Foto / galleria | `NSPhotoLibraryUsageDescription` | `READ_MEDIA_IMAGES` | Allegare immagini esistenti |

Tutti già configurati. **Importante**: nelle stringhe iOS sono in italiano, Apple le visualizza all'utente — controlla che il testo ti piaccia (le ho già scritte chiare e specifiche, come pretende Apple).

### Compliance specifica
- **iOS — ITSAppUsesNonExemptEncryption**: già impostato `false` (l'app usa solo TLS standard, esente da export compliance).
- **Android — Sicurezza dei dati**: dichiara che raccogli email + posizione + foto, tutti criptati in transito (HTTPS).
- **Account demo per la review**: Apple e Google chiedono credenziali per testare. Usa l'account demo già presente nel codice: `demo@civicvois.it` / `civicvois`.

---

## 8. Cosa succede se cambi codice

Modifichi un file in `assets/js/app.js`? Rilancia:

```bash
npm run cap:sync
```

E poi rifai **Archive** (iOS) o **Generate Signed Bundle** (Android). Se cambi solo testi o piccole cose puoi anche pubblicare una nuova **build** senza bumpare la `versionName`, ma il `versionCode`/`Build` deve sempre crescere.

---

## 9. Problemi noti già risolti in questo setup

1. **CORS dal WebView nativo** — il backend `civicvois-api.mjs` già risponde `Access-Control-Allow-Origin: *`, quindi `capacitor://localhost` e `http://localhost` (origin Capacitor su iOS e Android) sono accettati.
2. **URL relativi `/.netlify/functions/...`** non funzionerebbero in nativo (origin sbagliato). Risolto centralizzando tutto in `assets/js/config.js → API_BASE_URL = "https://civicvois.it/.netlify/functions"` e usando `apiUrl()` ovunque.
3. **Service worker** — disabilitato automaticamente in ambiente Capacitor (vedi `index.html`); nella PWA continua a funzionare.
4. **Safe area (notch iPhone)** — la CSS usa già `env(safe-area-inset-*)`, compatibile con WebView.
5. **HTTPS only** — `allowMixedContent: false`, niente HTTP cleartext (richiesto da entrambi gli store).

---

## 10. Cosa NON è stato fatto (e perché)

- **Push notifications**: il progetto non le usa al momento. Aggiungere `@capacitor/push-notifications` + Firebase Cloud Messaging (Android) + APNs (iOS) richiederebbe certificati e codice nuovo. Lascio fuori finché non serve.
- **Camera plugin nativo**: il codice attuale usa `<input type="file" capture="environment">` che funziona nei WebView Capacitor (sia iOS che Android). Sostituirlo con `@capacitor/camera` darebbe UX più nativa ma richiederebbe modifiche a `app.js`.
- **In-app purchases / abbonamenti**: non presenti.
- **Deep links** (apri `https://civicvois.it/segnalazione/123` direttamente nell'app): non configurati. Si possono aggiungere con `@capacitor/app` + Universal Links iOS + App Links Android.

---

## Riferimenti

- Capacitor docs: https://capacitorjs.com/docs
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Material Design: https://m3.material.io/
