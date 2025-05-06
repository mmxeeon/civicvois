<?php
session_start();
if (!isset($_SESSION['userId'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}

require_once '../database/conn.php';

if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit;
}

// Recupera l'ID dell'utente a partire dallo username in sessione
$stmt = $conn->prepare("SELECT id FROM utenti WHERE username = ?");
$stmt->bind_param("s", $_SESSION['username']);
$stmt->execute();
$stmt->bind_result($userId);
$stmt->fetch();
$stmt->close();

if (!$userId) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit;
}

// Recupera i dati dell'utente
$stmt = $conn->prepare("SELECT nome, cognome, email, bio, fotoProfilo FROM utenti WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
if ($result->num_rows !== 1) {
    $_SESSION['error'] = "Utente non trovato.";
    header("Location: profilo.php");
    exit;
}
$user = $result->fetch_assoc();
$stmt->close();
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modifica Profilo - Civicvois</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: #fff;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: rgba(0, 0, 0, 0.2);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        header h1 {
            margin: 0;
            font-size: 1.8rem;
        }

        header nav a {
            color: #fff;
            text-decoration: none;
            font-weight: bold;
            margin-left: 15px;
            background: #2563eb;
            padding: 10px 15px;
            border-radius: 8px;
            transition: background .3s, transform .2s;
        }

        header nav a:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        .container {
            flex: 1;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .form-section {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
        }

        .form-section h2 {
            margin-bottom: 20px;
            text-align: center;
            color: #dbeafe;
        }

        .form-section form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .form-section form label {
            font-weight: bold;
            color: #dbeafe;
        }

        .form-section form input,
        .form-section form textarea,
        .form-section form button {
            padding: 12px;
            font-size: 1rem;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
            outline: none;
            transition: border .3s;
        }

        .form-section form input:focus,
        .form-section form textarea:focus {
            border-color: #2563eb;
        }

        .form-section form textarea {
            resize: vertical;
        }

        .form-section form button {
            background: #2563eb;
            border: none;
            cursor: pointer;
            font-weight: bold;
            transition: background .3s, transform .2s;
        }

        .form-section form button:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        .form-section img {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #93c5fd;
            margin-bottom: 10px;
        }

        footer {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: rgba(0, 0, 0, 0.2);
            box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.3);
        }

        footer a {
            color: #fff;
            text-decoration: none;
            font-weight: bold;
            background: #2563eb;
            padding: 10px 15px;
            border-radius: 8px;
            transition: background .3s, transform .2s;
        }

        footer a:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }
    </style>
</head>

<body>
    <header>
        <h1>Civicvois</h1>
    </header>
    <main class="container">
        <section class="form-section">
            <h2>Modifica Profilo</h2>
            <?php if (isset($_SESSION['error'])): ?>
                <p style="color: red;"><?= $_SESSION['error']; unset($_SESSION['error']); ?></p>
            <?php endif; ?>

            <?php if (isset($_SESSION['success'])): ?>
                <p style="color: green;"><?= $_SESSION['success']; unset($_SESSION['success']); ?></p>
            <?php endif; ?>
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
                    <img src="../<?= htmlspecialchars($user['fotoProfilo']) ?>" alt="Foto Profilo">
                <?php else: ?>
                    <div style="width:100px;height:100px;border-radius:50%;background:#ccc;"></div>
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