# CivicVois - Navbar finale

Modifiche incluse:
- rimossa la voce `Impost.` dalla navbar;
- la pagina admin viene mostrata nella navbar solo agli utenti con `role: admin`;
- per utenti non admin la rotta `#/admin` viene reindirizzata alla dashboard;
- la navbar mobile mostra solo icone: casa, +, avatar profilo; admin compare solo se autorizzato;
- la pagina Profilo resta il punto unico dove modificare le informazioni personali;
- la navbar non usa piu indicatori animati invasivi e mantiene lo stato attivo con stile stabile.

La navbar lavora sopra l'architettura attuale Supabase + Netlify hosting, senza modificare il backend dati.
