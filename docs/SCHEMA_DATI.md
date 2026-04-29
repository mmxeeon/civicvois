# CivicVois - Schema dati nuovo

## profiles
Profilo pubblico collegato a Supabase Auth.

Campi principali:
- id
- email
- username
- full_name
- avatar_url
- bio
- role: user/admin
- regione
- provincia
- comune

## segnalazioni
Segnalazioni civiche pubbliche.

Campi principali:
- id
- user_id
- titolo
- tipo
- descrizione
- priorita: bassa/media/alta/urgente
- stato: nuova/verificata/in carico/risolta/archiviata
- regione
- provincia
- comune
- via
- civico
- lat/lng
- photo_url
- like_count

## interazioni
Like degli utenti sulle segnalazioni.

Chiave primaria:
- utente_id + segnalazione_id

Questo impedisce a uno stesso utente di mettere più like alla stessa segnalazione.
