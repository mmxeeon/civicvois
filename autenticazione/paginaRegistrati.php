<?php session_start(); ?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registrazione - Civicvois</title>
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

        input, textarea {
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
        <h2>Registrati</h2>
        <form action="gestoreRegistrati.php" method="post" enctype="multipart/form-data">
            <input type="text" name="nome" placeholder="Nome" required>
            <input type="text" name="cognome" placeholder="Cognome" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="date" name="dataDiNascita" required>
            <input type="file" name="fotoProfilo" accept="image/*">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <textarea name="bio" placeholder="Biografia"></textarea>
            <button type="submit">Registrati</button>
        </form>
        <p><a href="paginaLogin.php">Hai già un account? Accedi</a></p>
    </div>
</body>
</html>