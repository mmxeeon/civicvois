<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Civicvois - Benvenuto</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: linear-gradient(135deg, #007acc, #e6f7ff); /* Sfondo sfumato */
            color: #fff;
            text-align: center;
        }

        header h1 {
            font-size: 3.5rem;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.3);
        }

        header h2 {
            font-size: 1.5rem;
            margin-bottom: 2rem;
            text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
        }

        .container {
            max-width: 700px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.9); /* Sfondo bianco trasparente */
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        .presentation p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            color: #333;
        }

        .actions {
            display: flex;
            justify-content: center;
            gap: 20px;
        }

        .btn {
            display: inline-block;
            padding: 15px 25px;
            font-size: 1.1rem;
            color: #fff;
            background: #007acc; /* Colore blu */
            border: none;
            border-radius: 50px; /* Pulsanti arrotondati */
            text-decoration: none;
            font-weight: bold;
            transition: background 0.3s, transform 0.2s;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        .btn:hover {
            background: #005f99; /* Colore blu più scuro per hover */
            transform: scale(1.05); /* Leggero ingrandimento al passaggio del mouse */
        }

        footer {
            margin-top: 2rem;
            font-size: 0.9rem;
            text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
        }
    </style>
</head>
<body>
    <header>
        <h1>Civicvois</h1>
        <h2>La piattaforma per segnalare e risolvere problemi nella tua comunità</h2>
    </header>
    <main class="container">
        <section class="presentation">
            <p>
                Civicvois è un servizio che ti permette di segnalare problemi nella tua città, come buche stradali, rifiuti abbandonati o guasti all'illuminazione pubblica. 
                Contribuisci a migliorare la tua comunità in modo semplice e veloce!
            </p>
            <div class="actions">
                <a href="autenticazione/paginaLogin.php" class="btn">Accedi</a>
                <a href="autenticazione/paginaRegistrazione.php" class="btn">Registrati</a>
            </div>
        </section>
    </main>
    <footer>
        <p>&copy; <?= date('Y') ?> Civicvois. Tutti i diritti riservati.</p>
    </footer>
</body>
</html>