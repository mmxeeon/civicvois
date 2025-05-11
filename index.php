<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Civicvois - Benvenuto</title>
    <link rel="icon" type="image/png" href="../assets/img/civicvoisLogo.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        /* Base Styles */
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
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
            color: #93c5fd;
        }

        .container {
            width: 90%;
            max-width: 700px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
        }

        .presentation p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            color: #dbeafe;
            line-height: 1.8;
        }

        .actions {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .btn {
            display: inline-block;
            padding: 15px 25px;
            font-size: 1rem;
            color: #ffffff;
            background: #2563eb;
            border: none;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: background 0.3s, transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
            flex: 1 1 45%;
            text-align: center;
        }

        .btn:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
        }

        footer {
            margin-top: 2rem;
            font-size: 0.9rem;
            color: #dbeafe;
            opacity: 0.8;
        }

        footer p {
            margin: 0;
        }

        .logo-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 2rem;
        }

        .logo-container img {
            max-width: 400px;
            width: 60%;
            height: auto;
            border-radius: 300px;
        }

        /* Tablet & Small Desktop */
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

            .logo-container img {
                width: 50%;
            }
        }

        /* Mobile Portrait */
        @media (max-width: 480px) {
            body {
                padding: 20px 0;
            }

            header h2 {
                font-size: 1rem;
                margin-bottom: 1.5rem;
                padding: 0 10px;
            }

            .container {
                width: 75%;
                padding: 20px;
                border-radius: 12px;
            }

            .presentation p {
                font-size: 1rem;
                margin-bottom: 1.5rem;
                padding: 0 5px;
            }

            .actions {
                flex-direction: column;
                gap: 15px;
            }

            .btn {
                flex: none;
                width: 92%;
                padding: 12px;
                font-size: 1rem;
            }

            .logo-container img {
                width: 70%;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="logo-container">
            <img src="../assets/img/civicvoisLogo.png" alt="Logo Civicvois">
        </div>
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
