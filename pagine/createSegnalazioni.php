<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
include '../database/conn.php';
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nuova Segnalazione - Civicvois</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <style>
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
                <input type="number" name="civico" id="civico" placeholder="Civico" required disabled min="0" max="9999">

                <label for="tipo">Tipo di Segnalazione</label>
                <select name="tipo" id="tipo" required>
                    <option value="">Tipo di segnalazione</option>
                    <option value="cartello stradale: mancante">Cartello stradale: Mancante</option>
                    <option value="cartello stradale: caduto">Cartello stradale: Caduto</option>
                    <option value="cartello stradale: vandalizzato">Cartello stradale: Vandalizzato</option>
                    <option value="strada: rotta">Strada: Rotta</option>
                    <option value="strada: piena di buchi">Strada: Piena di buchi</option>
                    <option value="animali: smarriti">Animali: Smarriti</option>
                </select>

                <label for="descrizione">Descrizione</label>
                <textarea name="descrizione" id="descrizione" rows="5" placeholder="Descrizione della segnalazione" required></textarea>

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
        $(document).ready(function() {
            // Carica le regioni
            $.getJSON("../ajax/getRegioni.php", function(data) {
                data.forEach(function(regione) {
                    $("#regione").append(new Option(regione.nome, regione.id));
                });
            });

            // Disabilita i campi inizialmente
            $("#provincia").prop("disabled", true);
            $("#comune").prop("disabled", true);
            $("#via").prop("disabled", true);
            $("#civico").prop("disabled", true);

            // Carica le province in base alla regione selezionata
            $("#regione").change(function() {
                const regioneId = $(this).val();
                $("#provincia").prop("disabled", !regioneId).empty().append(new Option("Seleziona Provincia", ""));
                $("#comune").prop("disabled", true).val("");
                $("#via").prop("disabled", true).val("");
                $("#civico").prop("disabled", true).val("");

                if (regioneId) {
                    $.getJSON(`../ajax/getProvince.php?regione_id=${regioneId}`, function(data) {
                        data.forEach(function(provincia) {
                            $("#provincia").append(new Option(provincia.nome, provincia.id));
                        });
                    });
                }
            });

            // Abilita i campi comune, via e civico solo dopo la selezione della provincia
            $("#provincia").change(function() {
                const provinciaId = $(this).val();
                $("#comune").prop("disabled", !provinciaId).val("");
                $("#via").prop("disabled", !provinciaId).val("");
                $("#civico").prop("disabled", !provinciaId).val("");
            });
        });
    </script>
</body>

</html>