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
    <title>Nuova Segnalazione</title>
    <link rel="stylesheet" href="../assets/css/style.css">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
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

        header nav a:hover {
            text-decoration: underline;
        }

        .container {
            flex: 1;
            padding: 20px;
        }

        form {
            max-width: 600px;
            margin: 0 auto;
            background: #fff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }

        form select,
        form input,
        form textarea,
        form button {
            width: 100%;
            margin-bottom: 15px;
            padding: 10px;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 5px;
        }

        form textarea {
            resize: vertical;
        }

        form button {
            background: #007acc;
            color: #fff;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }

        form button:hover {
            background: #005f99;
        }

        footer {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 10px 20px;
            background: #007acc;
            color: #fff;
        }

        footer nav a {
            color: #fff;
            text-decoration: none;
            font-weight: bold;
            margin: 0 10px;
        }

        footer nav a:hover {
            text-decoration: underline;
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
    <h2>Crea una segnalazione</h2>
    <form action="../gestori/gestoreCreateSegnalazione.php" method="post" enctype="multipart/form-data">
        <!-- Regione -->
        <select name="regione" id="regione" required>
            <option value="">Seleziona Regione</option>
        </select>

        <!-- Provincia -->
        <select name="provincia" id="provincia" disabled required>
            <option value="">Seleziona Provincia</option>
        </select>

        <!-- Comune -->
        <input type="text" name="comune" id="comune" placeholder="Comune" required disabled>

        <!-- Via -->
        <input type="text" name="via" id="via" placeholder="Via" required disabled>

        <!-- Civico -->
        <input type="number" name="civico" id="civico" placeholder="Civico" required disabled min="0" max="9999">

        <!-- Tipo di problema -->
        <select name="tipo" required>
            <option value="">Tipo di segnalazione</option>
            <option value="cartello stradale: mancante">Cartello stradale: Mancante</option>
            <option value="cartello stradale: caduto">Cartello stradale: Caduto</option>
            <option value="cartello stradale: vandalizzato">Cartello stradale: Vandalizzato</option>
            <option value="cartello stradale: girato">Cartello stradale: Girato</option>
            <option value="cartello stradale: non riflettente">Cartello stradale: Non riflettente</option>
            <option value="strada: rotta">Strada: Rotta</option>
            <option value="strada: piena di buchi">Strada: Piena di buchi</option>
            <option value="strada: invalicabile per via di ostacoli">Strada: Invalicabile per via di ostacoli</option>
            <option value="strada: franata">Strada: Franata</option>
            <option value="animali: smarriti">Animali: Smarriti</option>
            <option value="animali: morti">Animali: Morti</option>
            <option value="animali: ritrovati">Animali: Ritrovati</option>
            <option value="infrastrutture pubbliche: ponti">Infrastrutture pubbliche: Ponti</option>
            <option value="infrastrutture pubbliche: cavalcavia">Infrastrutture pubbliche: Cavalcavia</option>
            <option value="infrastrutture pubbliche: sottopassaggi (possibile allagamenti)">Infrastrutture pubbliche: Sottopassaggi (possibile allagamenti)</option>
            <option value="infrastrutture pubbliche: rotonde con prato (lasciato incolto)">Infrastrutture pubbliche: Rotonde con prato (lasciato incolto)</option>
            <option value="infrastrutture pubbliche: spartitraffico o isole di traffico con prato incurato">Infrastrutture pubbliche: Spartitraffico o isole di traffico con prato incurato</option>
            <option value="privati: cartelli appesi fuori da abitazioni private (passi carrabili)">Privati: Cartelli appesi fuori da abitazioni private (passi carrabili)</option>
            <option value="privati: tutto ciò che è proveniente da abitazioni private che potrebbe ostacolare o portare problemi allo stato urbano">Privati: Tutto ciò che è proveniente da abitazioni private che potrebbe ostacolare o portare problemi allo stato urbano</option>
        </select>

        <!-- Descrizione -->
        <textarea name="descrizione" rows="5" placeholder="Descrizione della segnalazione" required></textarea>

        <!-- Foto -->
        <input type="file" name="foto" accept="image/*">

        <button type="submit">Invia</button>
    </form>
</main>
<footer>
    <nav style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
        <a href="home.php" style="margin-left: 15px;">Home</a>
        <a href="profilo.php" style="margin-right: 15px;">Profilo</a>
    </nav>
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