<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
include '../database/conn.php';

// Recupera i tipi di segnalazione dal database
$tipiSegnalazione = [];

$result = $conn->query("SHOW COLUMNS FROM `segnalazioni` LIKE 'tipo'");
if ($result && $row = $result->fetch_assoc()) {
    if (preg_match("/^enum\((.*)\)$/", $row['Type'], $matches) && !empty($matches[1])) {
        // Rimuovo eventuali escape di apici interni
        $lista = str_replace("\\'", "’", $matches[1]);
        $tipiSegnalazione = str_getcsv($lista, ',', "'");
    } else {
        // fallback su array vuoto o log di errore
        error_log("Enum 'tipo' non riconosciuto o vuoto in segnalazioni");
    }
} else {
    error_log("Errore nella query SHOW COLUMNS: " . $conn->error);
}
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/png" href="../assets/img/civicvoisLogo.png">
    <title>Nuova Segnalazione - Civicvois</title>
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

        /* Stili della pagina */
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

        .container {
            flex: 1;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            padding-bottom: 100px;
            /* Altezza del footer + margine extra */
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
            position: fixed;
            bottom: 0;
            left: 0;
            width: 92%;
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
    </style>
</head>

<body>

    <main class="container">
        <section class="form-section">
            <h2>Crea una segnalazione</h2>
            <form action="../gestori/gestoreCreateSegnalazione.php" method="post" enctype="multipart/form-data">
                <label for="regione">Regione</label>
                <select name="regione" id="regione" required>
                    <option value="">Seleziona Regione</option>
                </select>

                <label for="provincia">Provincia</label>
                <select name="provincia" id="provincia" disabled required>
                    <option value="">Seleziona Provincia</option>
                </select>

                <label for="comune">Comune</label>
                <input type="text" name="comune" id="comune" placeholder="Comune" required disabled>

                <label for="via">Via</label>
                <input type="text" name="via" id="via" placeholder="Via" required disabled>

                <label for="civico">Civico</label>
                <input type="number" name="civico" id="civico" placeholder="Civico" required disabled min="0"
                    max="9999">

                <label for="tipo">Tipo di Segnalazione</label>
                <select name="tipo" id="tipo" required>
                    <option value="">Seleziona Tipo</option>
                    <?php foreach ($tipiSegnalazione as $tipo): ?>
                        <option value="<?= htmlspecialchars($tipo) ?>"><?= htmlspecialchars($tipo) ?></option>
                    <?php endforeach; ?>
                </select>

                <label for="descrizione">Descrizione</label>
                <textarea name="descrizione" id="descrizione" rows="5" placeholder="Descrizione della segnalazione"
                    required></textarea>

                <label for="foto">Foto</label>
                <input type="file" name="foto" id="foto" accept="image/*">

                <button type="submit">Invia</button>
            </form>
        </section>
    </main>
    <footer>
        <a href="home.php">Home</a>
        <a href="profilo.php">Profilo</a>
    </footer>
    <script>
        // Caricamento delle regioni
        $.getJSON('../ajax/getRegioni.php', data => {
            data.forEach(r => $('#regione').append(new Option(r.nome, r.id)));
            $('#regione').prop('disabled', false);
        });

        // Quando cambia la regione, carica le province
        $('#regione').change(function() {
            const regioneId = $(this).val();
            $('#provincia').empty().append('<option value="">Provincia</option>').prop('disabled', true);
            $('#comune').prop('disabled', true).val(''); // Disabilita il comune
            if (regioneId) {
                $.getJSON(`../ajax/getProvince.php?regione_id=${regioneId}`, data => {
                    data.forEach(p => $('#provincia').append(new Option(p.nome, p.id)));
                    $('#provincia').prop('disabled', false); // Abilita la provincia
                });
            }
        });

        // Quando cambia la provincia, abilita il campo comune
        $('#provincia').change(function() {
            const provinciaId = $(this).val();
            $('#comune').prop('disabled', !provinciaId).val(''); // Abilita o disabilita il comune
        });
    </script>
</body>

</html>