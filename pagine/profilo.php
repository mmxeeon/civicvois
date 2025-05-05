<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';

// Recupera i dati utente
$stmtU = $conn->prepare("SELECT nome, cognome, email, bio, fotoProfilo FROM utenti WHERE id = ?");
$stmtU->bind_param("i", $_SESSION['userId']);
$stmtU->execute();
$resultU = $stmtU->get_result();
$u = $resultU->fetch_assoc();

if (!$u) {
    echo "<p>Utente non trovato.</p>";
    exit();
}

// Recupera segnalazioni dell'utente
$stmtS = $conn->prepare("SELECT id, comune, tipo, descrizione, dataSegnalazione, via, civico FROM segnalazioni WHERE idUtente = ? ORDER BY dataSegnalazione DESC");
$stmtS->bind_param("i", $_SESSION['userId']);
$stmtS->execute();
$segn = $stmtS->get_result()->fetch_all(MYSQLI_ASSOC);
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <title>Profilo - Civicvois</title>
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
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .profile-section {
            background: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }

        .profile-flex {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .avatar {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #007acc;
        }

        .avatar.placeholder {
            background: #ccc;
            display: inline-block;
            width: 100px;
            height: 100px;
            border-radius: 50%;
        }

        .profile-info p {
            margin: 5px 0;
        }

        .btn {
            display: inline-block;
            padding: 10px 15px;
            background: #007acc;
            color: #fff;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            transition: background 0.3s ease;
        }

        .btn:hover {
            background: #005f99;
        }

        .user-signals {
            background: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            max-height: 400px; /* Altezza massima ridotta */
            overflow-y: auto; /* Abilita lo scorrimento interno */
        }

        .segnalazioni-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr); /* 3 colonne */
            gap: 20px; /* Spaziatura tra i rettangoli */
        }

        .card {
            background: #fff;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }

        .card h4 {
            margin: 0 0 10px;
        }

        .btn.small {
            padding: 5px 10px;
            font-size: 0.9rem;
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
            box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.1);
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
            <a href="../autenticazione/paginaLogout.php">Logout</a>
        </nav>
    </header>
    <main class="container">
        <section class="profile-section">
            <h2>Profilo Utente</h2>
            <div class="profile-flex">
                <?php if (!empty($u['fotoProfilo'])): ?>
                    <img src="../<?= htmlspecialchars($u['fotoProfilo']) ?>" alt="Foto Profilo" style="width: 100px; height: 100px; border-radius: 50%;">
                <?php else: ?>
                    <div class="avatar placeholder" style="width: 100px; height: 100px; border-radius: 50%; background: #ccc;"></div>
                <?php endif; ?>
                <div class="profile-info">
                    <p><strong><?= htmlspecialchars($u['nome']) ?> <?= htmlspecialchars($u['cognome']) ?></strong></p>
                    <p>Email: <?= htmlspecialchars($u['email']) ?></p>
                    <p><?= nl2br(htmlspecialchars($u['bio'])) ?></p>
                    <a href="../pagine/editProfilo.php" class="btn">Modifica Profilo</a>
                </div>
            </div>
        </section>
        <section class="user-signals">
            <h3>Le tue segnalazioni</h3>
            <?php if (count($segn) > 0): ?>
                <div class="segnalazioni-grid">
                    <?php foreach ($segn as $s): ?>
                        <div class="card">
                            <h4><?= htmlspecialchars($s['tipo']) ?></h4>
                            <p><strong>Descrizione:</strong> <?= nl2br(htmlspecialchars($s['descrizione'])) ?></p>
                            <p><strong>Comune:</strong> <?= htmlspecialchars($s['comune']) ?></p>
                            <p><strong>Data:</strong> <?= (new DateTime($s['dataSegnalazione']))->format('d/m/Y') ?></p>
                            <p><strong>Via:</strong> <?= htmlspecialchars($s['via'] ?? 'Non specificata') ?></p>
                            <p><strong>Civico:</strong> <?= htmlspecialchars($s['civico'] ?? 'Non specificato') ?></p>
                            <a href="../pagine/editSegnalazione.php?id=<?= $s['id'] ?>" class="btn small">Modifica</a>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php else: ?>
                <p>Non hai ancora inviato segnalazioni.</p>
            <?php endif; ?>
        </section>
    </main>
    <footer>
        <a href="home.php">Home</a>
        <a href="createSegnalazioni.php">Nuova Segnalazione</a>
        <a href="profilo.php">Profilo</a>
    </footer>
</body>

</html>