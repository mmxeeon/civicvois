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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modifica Segnalazione - Civicvois</title>
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
            color: #ffffff;
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
            color: #ffffff;
            text-decoration: none;
            font-weight: bold;
            margin-left: 15px;
            background: #2563eb;
            padding: 10px 15px;
            border-radius: 8px;
            transition: background 0.3s, transform 0.2s;
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
        .form-section form select,
        .form-section form textarea,
        .form-section form button {
            padding: 12px;
            font-size: 1rem;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: #000000;
            outline: none;
            transition: border 0.3s;
        }

        .form-section form input:focus,
        .form-section form select:focus,
        .form-section form textarea:focus {
            border-color: #2563eb;
        }

        .form-section form textarea {
            resize: vertical;
        }

        .form-section form button {
            background: #2563eb;
            color: #ffffff;
            border: none;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s, transform 0.2s;
        }

        .form-section form button:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: rgba(0, 0, 0, 0.2);
            box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.3);
        }

        footer a {
            color: #ffffff;
            text-decoration: none;
            font-weight: bold;
            background: #2563eb;
            padding: 10px 15px;
            border-radius: 8px;
            transition: background 0.3s, transform 0.2s;
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