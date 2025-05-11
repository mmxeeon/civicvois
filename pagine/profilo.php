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
$stmtS = $conn->prepare("SELECT id, comune, tipo, descrizione, dataSegnalazione, via, civico, foto FROM segnalazioni WHERE idUtente = ? ORDER BY dataSegnalazione DESC");
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
    <link rel="icon" type="image/png" href="../assets/img/civicvoisLogo.png">
    <?php include __DIR__ . '../header.php'; ?>

    <style>
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.3);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        header h1 {
            font-size: 2rem;
            font-weight: 700;
            margin: 0;
        }

        header .logout {
            background: #2563eb;
            color: #fff;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            transition: background 0.3s, transform 0.2s;
        }

        header .logout:hover {
            background: #1d4ed8;
            transform: translateY(-2px);
        }

        header .header-left {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }

        .logo {
            border: none;
            /* rimuove qualsiasi bordo aggiuntivo */
        }

        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            /* Sfondo sfumato blu */
            color: #ffffff;
        }

        .container {
            flex: 1;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            padding-bottom: 100px;
            /* Altezza del footer + margine extra */
        }

        .profile-section {
            background: rgba(255, 255, 255, 0.1);
            /* Sfondo trasparente */
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
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
            border: 2px solid #93c5fd;
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
            background: #2563eb;
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            transition: background 0.3s ease, transform 0.2s;
        }

        .btn:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        .btn.delete-btn {
            background: #dc2626;
            /* Rosso */
        }

        .btn.delete-btn:hover {
            background: #b91c1c;
            /* Rosso scuro */
        }

        .user-signals {
            background: rgba(255, 255, 255, 0.1);
            /* Sfondo trasparente */
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .segnalazioni-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .card {
            background: rgba(255, 255, 255, 0.2);
            /* Sfondo trasparente */
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            color: #ffffff;
        }

        .card h4 {
            margin: 0 0 10px;
            font-size: 1.2rem;
            color: #93c5fd;
        }

        footer {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.3);
            box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: space-around;
            gap: 1rem;
        }

        footer a {
            flex: 1;
            background: #2563eb;
            color: #fff;
            padding: 0.75rem;
            border-radius: 0.5rem;
            text-align: center;
            font-weight: 600;
            transition: background 0.3s, transform 0.2s;
        }

        footer a:hover {
            background: #1d4ed8;
            transform: translateY(-2px);
        }

        .profile-buttons {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .btn.logout-btn {
            background: #dc2626;
            /* Rosso */
        }

        .btn.logout-btn:hover {
            background: #b91c1c;
            /* Rosso scuro */
        }
    </style>
</head>

<body>
    <main class="container">
        <section class="profile-section">
            <h2><strong><?= htmlspecialchars($_SESSION['username']) ?></strong></h2>
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
                    <div class="profile-buttons">
                        <a href="../pagine/editProfilo.php" class="btn">Modifica Profilo</a>
                        <a href="../autenticazione/paginaLogout.php" class="btn logout-btn">Logout</a>
                    </div>
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
                            <?php if (!empty($s['foto'])): ?>
                                <img src="../<?= htmlspecialchars($s['foto']) ?>" alt="Foto segnalazione" style="width: 100%; border-radius: 10px; margin-bottom: 10px;">
                            <?php endif; ?>
                            <p><strong>Descrizione:</strong> <?= nl2br(htmlspecialchars($s['descrizione'])) ?></p>
                            <p><strong>Comune:</strong> <?= htmlspecialchars($s['comune']) ?></p>
                            <p><strong>Data:</strong> <?= (new DateTime($s['dataSegnalazione']))->format('d/m/Y') ?></p>
                            <p><strong>Via:</strong> <?= htmlspecialchars($s['via'] ?? 'Non specificata') ?></p>
                            <p><strong>Civico:</strong> <?= htmlspecialchars($s['civico'] ?? 'Non specificato') ?></p>
                            <a href="../pagine/editSegnalazione.php?id=<?= $s['id'] ?>" class="btn small">Modifica</a>
                            <a href="../gestori/gestoreEliminaSegnalazione.php?id=<?= $s['id'] ?>"
                                class="btn small delete-btn"
                                onclick="return confirm('Sei sicuro di voler eliminare questa segnalazione?');">Elimina</a>
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