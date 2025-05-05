<?php session_start(); ?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Civicvois</title>
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
        <h2>Accedi a Civicvois</h2>
        <form action="gestoreLogin.php" method="post">
            <input type="text" name="login" placeholder="Email o Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Accedi</button>
        </form>
        <p><a href="paginaRegistrati.php">Non hai un account? Registrati</a></p>
        <p><a href="recuperaPassword.php">Password dimenticata?</a></p>
    </div>
</body>

</html>