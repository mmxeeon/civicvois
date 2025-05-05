<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';

// Recupera i dati dell'utente
$stmt = $conn->prepare("SELECT nome, cognome, email, bio, fotoProfilo FROM utenti WHERE id = ?");
$stmt->bind_param("i", $_SESSION['userId']);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if (!$user) {
    echo "<p>Utente non trovato.</p>";
    exit();
}
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <title>Modifica Profilo - Civicvois</title>
    <link rel="stylesheet" href="../assets/css/style.css">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: #e6f7ff;
            color: #000;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            background: #007acc;
            color: #fff;
        }

        header h1 {
            margin: 0;
        }

        header nav a {
            color: #fff;
            text-decoration: none;
            font-weight: bold;
            margin-left: 15px;
        }

        header nav a.active {
            text-decoration: underline;
        }

        header nav a:hover {
            text-decoration: underline;
        }

        .container {
            flex: 1;
            padding: 20px;
        }

        .form-section {
            background: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            max-width: 600px;
            margin: 0 auto;
        }

        .form-section h2 {
            margin-bottom: 20px;
        }

        .form-section form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .form-section form label {
            font-weight: bold;
        }

        .form-section form input,
        .form-section form textarea,
        .form-section form button {
            padding: 10px;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 5px;
        }

        .form-section form textarea {
            resize: vertical;
        }

        .form-section form button {
            background: #007acc;
            color: #fff;
            border: none;
            cursor: pointer;
        }

        .form-section form button:hover {
            background: #005f99;
        }

        footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            background: #007acc;
            color: #fff;
            position: relative;
            bottom: 0;
            width: 100%;
        }

        footer a {
            color: #fff;
            text-decoration: none;
            font-weight: bold;
            background: #005f99;
            padding: 10px 15px;
            border-radius: 5px;
            transition: background 0.3s;
        }

        footer a:hover {
            background: #004080;
        }
    </style>
</head>

<body>
    <header>
        <h1>Civicvois</h1>
        <nav>
            <a href="home.php">Home</a>
            <a href="profilo.php">Profilo</a>
            <a href="../autenticazione/paginaLogout.php">Logout</a>
        </nav>
    </header>
    <main class="container">
        <section class="form-section">
            <h2>Modifica Profilo</h2>
            <form action="../gestori/gestoreEditProfilo.php" method="post" enctype="multipart/form-data">
                <label for="nome">Nome</label>
                <input type="text" id="nome" name="nome" value="<?= htmlspecialchars($user['nome']) ?>" required>

                <label for="cognome">Cognome</label>
                <input type="text" id="cognome" name="cognome" value="<?= htmlspecialchars($user['cognome']) ?>" required>

                <label for="email">Email</label>
                <input type="email" id="email" name="email" value="<?= htmlspecialchars($user['email']) ?>" required>

                <label for="bio">Biografia</label>
                <textarea id="bio" name="bio" rows="5"><?= htmlspecialchars($user['bio']) ?></textarea>

                <label for="fotoProfilo">Foto Profilo</label>
                <?php if (!empty($user['fotoProfilo'])): ?>
                    <img src="../<?= htmlspecialchars($user['fotoProfilo']) ?>" alt="Foto Profilo" style="width: 100px; height: 100px; border-radius: 50%;">
                <?php else: ?>
                    <div class="avatar placeholder" style="width: 100px; height: 100px; border-radius: 50%; background: #ccc;"></div>
                <?php endif; ?>
                <input type="file" id="fotoProfilo" name="fotoProfilo" accept="image/*">

                <button type="submit">Salva Modifiche</button>
            </form>
        </section>
    </main>
    <footer>
        <a href="home.php">Home</a>
        <a href="profilo.php">Profilo</a>
    </footer>
</body>

</html>