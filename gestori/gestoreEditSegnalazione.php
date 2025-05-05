<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';

// Recupera l'ID della segnalazione
if (!isset($_POST['id']) || empty($_POST['id'])) {
    $_SESSION['error'] = "ID segnalazione non valido.";
    header("Location: ../pagine/profilo.php");
    exit();
}

$segnalazioneId = intval($_POST['id']);

// Verifica che il metodo sia POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Recupera i dati inviati dal form
    $tipo = trim($_POST['tipo']);
    $descrizione = trim($_POST['descrizione']);
    $via = trim($_POST['via']);
    $civico = intval($_POST['civico']);

    // Validazione dei dati
    if (empty($tipo) || empty($descrizione) || empty($via) || $civico <= 0) {
        $_SESSION['error'] = "Tutti i campi devono essere compilati correttamente.";
        header("Location: ../pagine/editSegnalazione.php?id=$segnalazioneId");
        exit();
    }

    // Aggiorna i dati della segnalazione nel database
    $stmt = $conn->prepare("
        UPDATE segnalazioni 
        SET tipo = ?, descrizione = ?, via = ?, civico = ? 
        WHERE id = ? AND idUtente = ?
    ");
    $stmt->bind_param("sssiii", $tipo, $descrizione, $via, $civico, $segnalazioneId, $_SESSION['userId']);

    if ($stmt->execute()) {
        $_SESSION['success'] = "Segnalazione aggiornata con successo.";
        header("Location: ../pagine/profilo.php");
        exit();
    } else {
        $_SESSION['error'] = "Errore durante l'aggiornamento della segnalazione.";
        header("Location: ../pagine/editSegnalazione.php?id=$segnalazioneId");
        exit();
    }
}

// Recupera i dati della segnalazione per precompilare il form
$stmt = $conn->prepare("
    SELECT tipo, descrizione, via, civico 
    FROM segnalazioni 
    WHERE id = ? AND idUtente = ?
");
$stmt->bind_param("ii", $segnalazioneId, $_SESSION['userId']);
$stmt->execute();
$segnalazione = $stmt->get_result()->fetch_assoc();

if (!$segnalazione) {
    $_SESSION['error'] = "Segnalazione non trovata o non autorizzato.";
    header("Location: ../pagine/profilo.php");
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

        .container {
            max-width: 600px;
            margin: 50px auto;
            background: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }

        h2 {
            margin-bottom: 20px;
        }

        form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        label {
            font-weight: bold;
        }

        input,
        select,
        textarea,
        button {
            padding: 10px;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 5px;
        }

        textarea {
            resize: vertical;
        }

        button {
            background: #007acc;
            color: #fff;
            border: none;
            cursor: pointer;
        }

        button:hover {
            background: #005f99;
        }

        .error {
            color: red;
            margin-bottom: 10px;
        }

        .success {
            color: green;
            margin-bottom: 10px;
        }
    </style>
</head>

<body>
    <div class="container">
        <h2>Modifica Segnalazione</h2>
        <?php if (isset($_SESSION['error'])): ?>
            <p class="error"><?= htmlspecialchars($_SESSION['error']) ?></p>
            <?php unset($_SESSION['error']); ?>
        <?php endif; ?>
        <?php if (isset($_SESSION['success'])): ?>
            <p class="success"><?= htmlspecialchars($_SESSION['success']) ?></p>
            <?php unset($_SESSION['success']); ?>
        <?php endif; ?>
        <form method="post" action="../gestori/gestoreEditSegnalazione.php">
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
    </div>
</body>

</html>