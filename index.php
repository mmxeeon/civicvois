<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Civicvois - Benvenuto</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb); /* Sfondo sfumato blu */
            color: #ffffff;
            text-align: center;
        }

        header h1 {
            font-size: 3.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
            color: #ffffff;
        }

        header h2 {
            font-size: 1.5rem;
            margin-bottom: 2rem;
            font-weight: 400;
            color: #93c5fd; /* Azzurro chiaro */
        }

        .container {
            max-width: 700px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.1); /* Sfondo bianco trasparente */
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px); /* Effetto vetro smerigliato */
        }

        .presentation p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            color: #dbeafe; /* Azzurro molto chiaro */
            line-height: 1.8;
        }

        .actions {
            display: flex;
            justify-content: center;
            gap: 20px;
        }

        .btn {
            display: inline-block;
            padding: 15px 25px;
            font-size: 1rem;
            color: #ffffff;
            background: #2563eb; /* Blu acceso */
            border: none;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: background 0.3s, transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        .btn:hover {
            background: #1d4ed8; /* Blu più scuro per hover */
            transform: translateY(-3px); /* Sollevamento al passaggio del mouse */
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
        }

        footer {
            margin-top: 2rem;
            font-size: 0.9rem;
            color: #dbeafe; /* Azzurro molto chiaro */
            opacity: 0.8;
        }

        footer p {
            margin: 0;
        }

        @media (max-width: 768px) {
            header h1 {
                font-size: 2.5rem;
            }

            header h2 {
                font-size: 1.2rem;
            }

            .btn {
                padding: 12px 20px;
                font-size: 0.9rem;
            }
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
                <a href="autenticazione/paginaRegistrati.php" class="btn">Registrati</a>
            </div>
        </section>
    </main>
    <footer>
        <p>&copy; <?= date('Y') ?> Civicvois. Tutti i diritti riservati.</p>
    </footer>
</body>
</html>