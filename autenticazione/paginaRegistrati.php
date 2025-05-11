<?php
// Recupera le regioni dal database
require_once '../database/conn.php';
$regioni = $conn->query("SELECT id, nome FROM regioni ORDER BY nome")->fetch_all(MYSQLI_ASSOC);
?>
<?php session_start(); ?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/png" href="../assets/img/civicvoisLogo.png">
    <title>Registrazione - Civicvois</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <?php
    if (isset($_SESSION['message'])) {
        echo '<script>alert("' . $_SESSION['message'] . '");</script>';
        unset($_SESSION['message']);
    }
    if (isset($_SESSION['error'])) {
        echo '<script>alert("' . $_SESSION['error'] . '");</script>';
        unset($_SESSION['error']);
    }
    ?>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: #ffffff;
            text-align: center;
        }

        .container {
            max-width: 400px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
        }

        h2 {
            font-size: 2rem;
            margin-bottom: 1.5rem;
            color: #dbeafe;
        }

        form {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        input,
        textarea,
        select {
            padding: 12px;
            font-size: 1rem;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: #000000;
            outline: none;
            transition: border 0.3s;
        }

        input::placeholder,
        textarea::placeholder {
            color: #dbeafe;
        }

        input:focus,
        textarea:focus,
        select:focus {
            border-color: #2563eb;
        }

        button {
            padding: 12px;
            font-size: 1rem;
            color: #ffffff;
            background: #2563eb;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s, transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        button:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
        }

        p {
            margin-top: 10px;
            font-size: 0.9rem;
            color: #dbeafe;
        }

        p a {
            color: #93c5fd;
            text-decoration: none;
            font-weight: bold;
        }

        p a:hover {
            text-decoration: underline;
        }

        .file-input {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .file-input label {
            background: #2563eb;
            color: #000000;
            padding: 10px 15px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.3s, transform 0.2s;
        }

        .file-input label:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        .file-input input {
            display: none;
        }
    </style>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
</head>

<body>
    <div class="container">
        <h2>Registrati</h2>
        <form action="gestoreRegistrati.php" method="post" enctype="multipart/form-data">
            <input type="text" name="nome" placeholder="Nome" required>
            <input type="text" name="cognome" placeholder="Cognome" required>
            <input type="email" name="email" placeholder="Email" required>
            <input type="date" name="dataDiNascita" required>

            <!-- Select Regione -->
            <label for="regione">Regione</label>
            <select id="regione" name="regione" required>
                <option value="">Seleziona Regione</option>
                <?php foreach ($regioni as $regione): ?>
                    <option value="<?= $regione['id'] ?>"><?= htmlspecialchars($regione['nome']) ?></option>
                <?php endforeach; ?>
            </select>

            <!-- Select Provincia -->
            <label for="provincia">Provincia</label>
            <select id="provincia" name="provincia" required disabled>
                <option value="">Seleziona Provincia</option>
            </select>

            <div class="file-input">
                <label for="fotoProfilo">Carica Foto Profilo</label>
                <input type="file" name="fotoProfilo" id="fotoProfilo" accept="image/*">
            </div>
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <textarea name="bio" placeholder="Biografia"></textarea>
            <button type="submit">Registrati</button>
        </form>
        <p><a href="paginaLogin.php">Hai già un account? Accedi</a></p>
    </div>

    <script>
        $(document).ready(function() {
            // Carica le province in base alla regione selezionata
            $('#regione').change(function() {
                const regioneId = $(this).val();
                $('#provincia').prop('disabled', !regioneId).empty().append('<option value="">Seleziona Provincia</option>');

                if (regioneId) {
                    $.getJSON(`../ajax/getProvince.php?regione_id=${regioneId}`, function(data) {
                        data.forEach(function(provincia) {
                            $('#provincia').append(`<option value="${provincia.id}">${provincia.nome}</option>`);
                        });
                    });
                }
            });
        });
    </script>
</body>

</html>