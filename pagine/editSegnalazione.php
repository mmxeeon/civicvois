<?php
session_start();

// Verifica utente autenticato
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}

require_once '../database/conn.php';

// Ottieni l'ID utente da username
$stmt = $conn->prepare("SELECT id FROM utenti WHERE username = ?");
$stmt->bind_param("s", $_SESSION['username']);
$stmt->execute();
$stmt->bind_result($userId);
$stmt->fetch();
$stmt->close();

if (!$userId) {
    $_SESSION['error'] = "Utente non valido.";
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}

// Recupera ID segnalazione via GET
if (!isset($_GET['id']) || empty($_GET['id'])) {
    $_SESSION['error'] = "ID segnalazione non valido.";
    header("Location: home.php");
    exit();
}
$segnalazioneId = intval($_GET['id']);

// Seleziona dati segnalazione
$stmt = $conn->prepare(
    "SELECT tipo, descrizione, regione, provincia, comune, via, civico, foto
     FROM segnalazioni
     WHERE id = ? AND idUtente = ?"
);
$stmt->bind_param("ii", $segnalazioneId, $userId);
$stmt->execute();
$result = $stmt->get_result();
$segnalazione = $result->fetch_assoc();
$stmt->close();

if (!$segnalazione) {
    $_SESSION['error'] = "Segnalazione non trovata o non autorizzato.";
    header("Location: home.php");
    exit();
}

// Carica elenco regioni
$regioni = $conn->query("SELECT id, nome FROM regioni ORDER BY nome")->fetch_all(MYSQLI_ASSOC);

// Estrai enum tipi
$tipiProblemi = [];
$result = $conn->query("SHOW COLUMNS FROM segnalazioni LIKE 'tipo'");
if ($result) {
    $row = $result->fetch_assoc();
    preg_match("/^enum\\((.*)\\)$/", $row['Type'], $matches);
    $tipiProblemi = str_getcsv($matches[1], ',', "'");
}
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modifica Segnalazione</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <style>
        /* Stile generale */
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: #fff;
            display: flex;
            flex-direction: column;
        }

        header {
            background: rgba(0, 0, 0, 0.2);
            padding: 15px 20px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            text-align: center;
        }

        header h1 {
            margin: 0;
            font-size: 2rem;
            color: #fff;
        }

        .container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }

        .form-section {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 600px;
        }

        .form-section h2 {
            text-align: center;
            color: #dbeafe;
            margin-bottom: 20px;
        }

        .form-section label {
            font-weight: bold;
            color: #dbeafe;
            display: block;
            margin-bottom: 5px;
        }

        .form-section input,
        .form-section select,
        .form-section textarea,
        .form-section button {
            width: 100%;
            padding: 12px;
            font-size: 1rem;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: #000;
            outline: none;
            margin-bottom: 15px;
            transition: border 0.3s, background 0.3s;
        }

        .form-section input:focus,
        .form-section select:focus,
        .form-section textarea:focus {
            border-color: #2563eb;
        }

        .form-section textarea {
            resize: vertical;
            min-height: 100px;
        }

        .form-section button {
            background: #2563eb;
            color: #fff;
            border: none;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s, transform 0.2s;
        }

        .form-section button:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        img.preview {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 15px;
        }

        footer {
            background: rgba(0, 0, 0, 0.2);
            padding: 15px 20px;
            text-align: center;
            box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.3);
        }

        footer a {
            color: #fff;
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
        <h1>Modifica Segnalazione</h1>
    </header>
    <main class="container">
        <section class="form-section">
            <?php if (isset($_SESSION['error'])): ?>
                <p style="color:red; text-align: center;"><?= $_SESSION['error'];
                                                            unset($_SESSION['error']); ?></p>
            <?php endif; ?>
            <h2>Dettagli Segnalazione</h2>
            <form method="post" action="../gestori/gestoreEditSegnalazione.php" enctype="multipart/form-data">
                <input type="hidden" name="id" value="<?= htmlspecialchars($segnalazioneId) ?>">

                <label for="tipo">Tipo di Segnalazione</label>
                <select id="tipo" name="tipo" required>
                    <option value="">Seleziona Tipo</option>
                    <?php foreach ($tipiProblemi as $tipo): ?>
                        <option value="<?= $tipo ?>" <?= $segnalazione['tipo'] === $tipo ? 'selected' : '' ?>><?= $tipo ?></option>
                    <?php endforeach; ?>
                </select>

                <label for="descrizione">Descrizione</label>
                <textarea id="descrizione" name="descrizione" rows="4" required><?= htmlspecialchars($segnalazione['descrizione']) ?></textarea>

                <label for="regione">Regione</label>
                <select id="regione" name="regione" required>
                    <option value="">Seleziona Regione</option>
                    <?php foreach ($regioni as $r): ?>
                        <option value="<?= $r['id'] ?>" <?= $segnalazione['regione'] == $r['id'] ? 'selected' : '' ?>><?= htmlspecialchars($r['nome']) ?></option>
                    <?php endforeach; ?>
                </select>

                <label for="provincia">Provincia</label>
                <select id="provincia" name="provincia" required>
                    <option value="">Seleziona Provincia</option>
                </select>

                <label for="comune">Comune</label>
                <input type="text" id="comune" name="comune" value="<?= htmlspecialchars($segnalazione['comune']) ?>" required>

                <label for="via">Via</label>
                <input type="text" id="via" name="via" value="<?= htmlspecialchars($segnalazione['via']) ?>" required>

                <label for="civico">Civico</label>
                <input type="number" id="civico" name="civico" value="<?= htmlspecialchars($segnalazione['civico']) ?>" required>

                <label for="foto">Foto</label>
                <input type="file" id="foto" name="foto" accept="image/*">
                <?php if (!empty($segnalazione['foto'])): ?>
                    <img src="..<?= htmlspecialchars($segnalazione['foto']) ?>" class="preview" alt="Anteprima Foto">
                <?php endif; ?>

                <button type="submit">Salva Modifiche</button>
            </form>
        </section>
    </main>
    <footer>
        <a href="home.php">Home</a>
        <a href="profilo.php">Profilo</a>
    </footer>
    <script>
        $(function() {
            const selProv = <?= json_encode($segnalazione['provincia']) ?>;

            function loadProvince(regId) {
                $('#provincia').html('<option value="">Seleziona Provincia</option>');
                if (!regId) return;
                $.getJSON(`../ajax/getProvince.php?regione_id=${regId}`, data => {
                    data.forEach(p => {
                        const sel = p.id == selProv ? 'selected' : '';
                        $('#provincia').append(`<option value="${p.id}" ${sel}>${p.nome}</option>`);
                    });
                });
            }
            $('#regione').change(function() {
                loadProvince(this.value);
            });
            loadProvince($('#regione').val());
        });
    </script>
</body>

</html>