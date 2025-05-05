<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';

// Recupera l'ID della segnalazione da modificare
if (!isset($_GET['id']) || empty($_GET['id'])) {
    $_SESSION['error'] = "ID segnalazione non valido.";
    header("Location: ../pagine/home.php");
    exit();
}

$segnalazioneId = intval($_GET['id']);

// Recupera i dati della segnalazione
$stmt = $conn->prepare("
    SELECT tipo, descrizione, regione, provincia, comune, via, civico 
    FROM segnalazioni 
    WHERE id = ? AND idUtente = ?
");
$stmt->bind_param("ii", $segnalazioneId, $_SESSION['userId']);
$stmt->execute();
$result = $stmt->get_result();
$segnalazione = $result->fetch_assoc();

if (!$segnalazione) {
    $_SESSION['error'] = "Segnalazione non trovata o non autorizzato.";
    header("Location: ../pagine/home.php");
    exit();
}
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <title>Modifica Segnalazione - Civicvois</title>
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
        .form-section form select,
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
            <h2>Modifica Segnalazione</h2>
            <form action="../gestori/gestoreEditSegnalazione.php" method="post">
                <input type="hidden" name="id" value="<?= htmlspecialchars($segnalazioneId) ?>">

                <label for="tipo">Tipo di Segnalazione</label>
                <select id="tipo" name="tipo" required>
                    <option value="">Seleziona Tipo</option>
                    <option value="cartello stradale: mancante" <?= $segnalazione['tipo'] === 'cartello stradale: mancante' ? 'selected' : '' ?>>Cartello stradale: Mancante</option>
                    <option value="cartello stradale: caduto" <?= $segnalazione['tipo'] === 'cartello stradale: caduto' ? 'selected' : '' ?>>Cartello stradale: Caduto</option>
                    <option value="cartello stradale: vandalizzato" <?= $segnalazione['tipo'] === 'cartello stradale: vandalizzato' ? 'selected' : '' ?>>Cartello stradale: Vandalizzato</option>
                    <option value="strada: rotta" <?= $segnalazione['tipo'] === 'strada: rotta' ? 'selected' : '' ?>>Strada: Rotta</option>
                    <option value="strada: piena di buchi" <?= $segnalazione['tipo'] === 'strada: piena di buchi' ? 'selected' : '' ?>>Strada: Piena di buchi</option>
                    <option value="animali: smarriti" <?= $segnalazione['tipo'] === 'animali: smarriti' ? 'selected' : '' ?>>Animali: Smarriti</option>
                </select>

                <label for="descrizione">Descrizione</label>
                <textarea id="descrizione" name="descrizione" rows="5" required><?= htmlspecialchars($segnalazione['descrizione']) ?></textarea>

                <label for="via">Via</label>
                <input type="text" id="via" name="via" value="<?= htmlspecialchars($segnalazione['via']) ?>" required>

                <label for="civico">Civico</label>
                <input type="number" id="civico" name="civico" value="<?= htmlspecialchars($segnalazione['civico']) ?>" required>

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