# CivicVois PWA

La PWA e installabile da browser e usa Supabase per dati, account e immagini.
Il service worker gestisce solo asset statici e aggiorna la cache dopo i deploy.

## Test dopo il deploy

1. Apri `https://civicvois.it`.
2. Fai un refresh normale e uno forzato.
3. Verifica che la schermata di caricamento non resti bloccata.
4. Da iPhone: Safari -> Condividi -> Aggiungi alla schermata Home.
5. Da Android: Chrome -> Installa app o Aggiungi a schermata Home.

## Note

- Il service worker non deve intercettare in modo persistente chiamate dati verso Supabase.
- Dopo un deploy importante, il client invia `SKIP_WAITING` al service worker e ricarica quando il nuovo worker prende controllo.
- Se un dispositivo conserva ancora una cache vecchia, chiudi e riapri l'app installata o reinstallala dalla schermata Home.
