<?php session_start(); ?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recupera Password - Civicvois</title>
    <link rel="stylesheet" href="../assets/css/style.css">
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
            background: #e6f7ff; /* Azzurrino molto leggero */
            color: #000;
            text-align: center;
        }

        .container {
            max-width: 400px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }

        h2 {
            font-size: 2rem;
            margin-bottom: 1.5rem;
        }

        form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        input {
            padding: 10px;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 5px;
            width: 100%;
        }

        button {
            padding: 10px;
            font-size: 1rem;
            color: #fff;
            background: #007acc; /* Colore blu simile al div */
            border: none;
            border-radius: 5px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.3s;
        }

        button:hover {
            background: #005f99; /* Colore blu più scuro per hover */
        }

        p {
            margin-top: 10px;
            font-size: 0.9rem;
        }

        p a {
            color: #007acc;
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
        <h2>Recupera Password</h2>
        <form action="gestoreRecupera.php" method="post">
            <input type="email" name="email" placeholder="Inserisci la tua email" required>
            <button type="submit">Invia link di recupero</button>
        </form>
        <p><a href="paginaLogin.php">Torna al login</a></p>
    </div>
</body>
</html>