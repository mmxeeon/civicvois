<?php session_start(); ?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/png" href="../assets/img/civicvoisLogo.png">
    <title>Login - Civicvois</title>
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
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            /* Sfondo sfumato blu */
            color: #ffffff;
            text-align: center;
        }

        .container {
            max-width: 400px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.1);
            /* Sfondo bianco trasparente */
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            /* Effetto vetro smerigliato */
        }

        h2 {
            font-size: 2rem;
            margin-bottom: 1.5rem;
            color: #dbeafe;
            /* Azzurro molto chiaro */
        }

        form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        input {
            padding: 12px;
            font-size: 1rem;
            border: 1px solid #93c5fd;
            /* Azzurro chiaro */
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.4);
            /* Sfondo trasparente */
            color: #000000;
            outline: none;
            transition: border 0.3s;
        }

        input:focus {
            border-color: #2563eb;
            /* Blu acceso */
        }

        button {
            padding: 12px;
            font-size: 1rem;
            color: #ffffff;
            background: #2563eb;
            /* Blu acceso */
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s, transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        button:hover {
            background: #1d4ed8;
            /* Blu pi첫 scuro per hover */
            transform: translateY(-3px);
            /* Sollevamento al passaggio del mouse */
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
        }

        p {
            margin-top: 10px;
            font-size: 0.9rem;
            color: #dbeafe;
            /* Azzurro molto chiaro */
        }

        p a {
            color: #93c5fd;
            /* Azzurro chiaro */
            text-decoration: none;
            font-weight: bold;
        }

        p a:hover {
            text-decoration: underline;
        }
    </style>
</head>

<body>
    <div class="container">
        <h2>Accedi a Civicvois</h2>
        <form action="gestoreLogin.php" method="post">
            <input type="text" name="login" placeholder="Email o Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Accedi</button>
        </form>
        <p><a href="paginaRegistrati.php">Non hai un account? Registrati</a></p>
    </div>
</body>

</html>