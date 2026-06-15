# CivicVois - Supabase publish checklist

Questa cartella contiene gli script SQL da applicare al progetto Supabase reale prima della review App Store / Play Store.

## Ordine di esecuzione

### Database nuovo

Esegui in Supabase SQL Editor, in questo ordine:

1. `01_setup.sql`
2. `02_moderation_delete.sql`
3. `03_hardening.sql`
4. `04_security_hardening.sql`
5. `05_fix_delete_account_storage.sql`
6. `06_publish_readiness_check.sql`

### Database gia esistente

Se il database contiene gia dati reali, NON rieseguire `01_setup.sql`: e' distruttivo.

Esegui invece:

1. `02_moderation_delete.sql`
2. `03_hardening.sql`
3. `04_security_hardening.sql`
4. `05_fix_delete_account_storage.sql`
5. `06_publish_readiness_check.sql`

## Perche lo script 05 e' obbligatorio

Supabase non permette la cancellazione diretta da `storage.objects` dentro funzioni SQL. Se la funzione `delete_my_account` contiene ancora una `delete from storage.objects`, l'app mostra:

```text
Direct deletion from storage tables is not allowed. Use the Storage API instead.
```

La app pulisce gia i file utente con la Storage API. La RPC `delete_my_account` deve solo cancellare `auth.users`; il cascade rimuove profilo, segnalazioni, like, blocchi e report collegati.

## Verifica manuale finale

Dopo avere applicato gli script:

1. Crea o usa un account test sacrificabile.
2. Pubblica una segnalazione con foto.
3. Metti un like.
4. Vai in Profilo -> Modifica profilo -> Elimina account.
5. Conferma che l'account esca dall'app e non possa piu accedere.
6. Controlla in Supabase che `auth.users`, `profiles`, `segnalazioni`, `interazioni` e i file storage dell'utente siano stati rimossi.

