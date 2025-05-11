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
    <title>Modifica Segnalazione - Civicvois</title>
    <link rel="icon" type="image/png" href="../assets/img/civicvoisLogo.png">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
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

        /* Reset e base */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        html {
            font-size: 16px;
        }

        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: #fff;
            display: flex;
            flex-direction: column;
        }

        a {
            text-decoration: none;
            color: inherit;
        }



        /* Main Container */
        main.container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 2rem;
            padding-bottom: 100px;
            /* spazio per footer */
        }

        .form-section {
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 600px;
        }

        .form-section h2 {
            text-align: center;
            color: #dbeafe;
            margin-bottom: 1.5rem;
            font-size: 1.75rem;
        }

        .form-section label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #dbeafe;
        }

        .form-section input,
        .form-section select,
        .form-section textarea {
            width: 100%;
            padding: 0.75rem;
            margin-bottom: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 0.5rem;
            background: rgba(255, 255, 255, 0.2);
            color: #000;
            transition: border-color 0.3s;
        }

        .form-section input:focus,
        .form-section select:focus,
        .form-section textarea:focus {
            border-color: #93c5fd;
        }

        .form-section textarea {
            resize: vertical;
            min-height: 120px;
        }

        .form-section img.preview {
            max-width: 100%;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }

        /* Pulsanti */
        .form-section button {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            color: #fff;
            background: #2563eb;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: background 0.3s, transform 0.2s;
            width: 100%;
        }

        .form-section button:hover {
            background: #1d4ed8;
            transform: translateY(-2px);
        }

        /* Immagini */
        .form-section img {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #93c5fd;
            margin-bottom: 10px;
        }

        /* Footer fisso */
        footer {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            padding: 1rem 2rem;
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

        /* Media Queries */
        @media (max-width: 768px) {
            header h1 {
                font-size: 2rem;
            }

            .form-section {
                padding: 1.5rem;
            }

            .form-section h2 {
                font-size: 1.5rem;
            }
        }

        @media (max-width: 480px) {
            html {
                font-size: 14px;
            }

            header h1 {
                font-size: 1.75rem;
            }

            main.container {
                padding: 1rem;
                padding-bottom: 100px;
            }

            .form-section {
                padding: 1rem;
            }

            .form-section h2 {
                font-size: 1.25rem;
            }
        }
    </style>
</head>

<body>

    <main class="container">
        <section class="form-section">
            <?php if (isset($_SESSION['error'])): ?>
                <p style="color: #f87171; text-align: center; margin-bottom: 1rem;"><?= $_SESSION['error'];
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
                <textarea id="descrizione" name="descrizione" required><?= htmlspecialchars($segnalazione['descrizione']) ?></textarea>

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
                <?php if (!empty($segnalazione['foto'])): ?>
                    <img src="../<?= htmlspecialchars($segnalazione['foto']) ?>" alt="Foto">
                <?php else: ?>
                    <div style="width:100px;height:100px;border-radius:50%;background:#ccc;"></div>
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