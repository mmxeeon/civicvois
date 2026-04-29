-- Seed demo opzionale, senza dati personali.
-- Da usare solo dopo aver creato almeno un account nell'app.
-- Sostituisci USER_UUID con l'id del tuo profilo nella tabella public.profiles.

insert into public.segnalazioni
(user_id, titolo, tipo, descrizione, priorita, stato, regione, provincia, comune, via, civico, lat, lng)
values
('USER_UUID', 'Buca pericolosa vicino alle strisce pedonali', 'strade rotte o piene di buche', 'La buca è vicina all’attraversamento e crea rischio per auto, bici e pedoni.', 'alta', 'nuova', 'Lombardia', 'Monza e Brianza', 'Verano Brianza', 'Via Roma', '45', 45.6887, 9.2296),
('USER_UUID', 'Illuminazione insufficiente nel parcheggio', 'illuminazione insufficiente', 'La sera l’area è poco visibile e poco sicura.', 'media', 'verificata', 'Lombardia', 'Monza e Brianza', 'Carate Brianza', 'Via Cusani', '8', 45.6754, 9.2379),
('USER_UUID', 'Rifiuti abbandonati vicino al parco', 'rifiuti e discariche abusive', 'Sacchi e rifiuti vari sono stati lasciati vicino all’ingresso del parco.', 'media', 'in carico', 'Lombardia', 'Monza e Brianza', 'Seregno', 'Via Verdi', '12', 45.6516, 9.2053);
