<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';
include __DIR__ . '../header.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn->set_charset('utf8');

// Recupera regione e provincia dell'utente loggato
$stmt = $conn->prepare("SELECT regione, provincia FROM utenti WHERE username = ?");
$stmt->bind_param("s", $_SESSION['username']);
$stmt->execute();
$stmt->bind_result($userRegione, $userProvincia);
$stmt->fetch();
$stmt->close();

// Dropdown filtri
$tipi = $conn->query("SELECT DISTINCT tipo FROM segnalazioni ORDER BY tipo")->fetch_all(MYSQLI_ASSOC);

// Filtri e interazioni
$filters = [];
$params = [];
$types = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!empty($_POST['tipo'])) {
        $filters[] = "segnalazioni.tipo = ?";
        $params[] = $_POST['tipo'];
        $types .= 's';
    }
    if (!empty($_POST['regione'])) {
        $filters[] = "regioni.id = ?";
        $params[] = (int)$_POST['regione'];
        $types .= 'i';
    } else {
        // Filtra automaticamente per la regione dell'utente
        $filters[] = "regioni.id = ?";
        $params[] = (int)$userRegione;
        $types .= 'i';
    }
    if (!empty($_POST['provincia'])) {
        $filters[] = "province.id = ?";
        $params[] = (int)$_POST['provincia'];
        $types .= 'i';
    } else {
        // Filtra automaticamente per la provincia dell'utente
        $filters[] = "province.id = ?";
        $params[] = (int)$userProvincia;
        $types .= 'i';
    }
    if (!empty($_POST['comune'])) {
        $filters[] = "comuni.nome LIKE ?";
        $params[] = '%' . $_POST['comune'] . '%';
        $types .= 's';
    }
    if (!empty($_POST['via'])) {
        $filters[] = "segnalazioni.via LIKE ?";
        $params[] = '%' . $_POST['via'] . '%';
        $types .= 's';
    }
    if (!empty($_POST['data'])) {
        $filters[] = "DATE(segnalazioni.dataSegnalazione) = ?";
        $params[] = $_POST['data'];
        $types .= 's';
    }
}

$sql = "
  SELECT 
    segnalazioni.id,
    segnalazioni.tipo,
    segnalazioni.descrizione, 
    segnalazioni.comune, 
    segnalazioni.via, 
    segnalazioni.civico, 
    segnalazioni.dataSegnalazione,
    segnalazioni.foto,
    (SELECT COUNT(*) FROM interazioni WHERE interazioni.segnalazione_id = segnalazioni.id) AS interazioni,
    (SELECT COUNT(*) FROM interazioni WHERE interazioni.segnalazione_id = segnalazioni.id AND interazioni.utente_id = ?) AS liked
  FROM segnalazioni
  LEFT JOIN regioni   ON segnalazioni.regione   = regioni.id
  LEFT JOIN province  ON segnalazioni.provincia = province.id
";
if ($filters) {
    $sql .= " WHERE " . implode(" AND ", $filters);
}
$sql .= " ORDER BY interazioni DESC, segnalazioni.dataSegnalazione DESC LIMIT 12";

$stmt = $conn->prepare($sql);
$bindParams = array_merge([&$_SESSION['userId']], $params);
$bindTypes  = 'i' . $types;
$stmt->bind_param($bindTypes, ...$bindParams);
$stmt->execute();
$segn = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// Prepara e esegue la query per la foto profilo
$stmt = $conn->prepare("SELECT fotoProfilo FROM utenti WHERE username = ?");
$stmt->bind_param("s", $_SESSION['username']);
$stmt->execute();
$stmt->bind_result($fotoProfilo);
$stmt->fetch();
$stmt->close();
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <title>Home - Civicvois</title>
    <link rel="stylesheet" href="../assets/css/style.css">
    <link rel="icon" type="image/png" href="../assets/img/civicvoisLogo.png">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <style>
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
            display: flex;
            flex-direction: column;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: #fff;
        }

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
            /* border e margine già definiti altrove */
        }

        .logo {
            /* sovrascrive solo il border, se non vuoi il cerchio colorato intorno al logo */
            border: none;
        }

        main.container {
            flex: 1;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding-bottom: 100px;
            /* Altezza del footer + margine extra */
        }

        .filters {
            display: flex;
            flex-direction: column;
            gap: 15px;
            background: rgba(255, 255, 255, 0.2);
            /* Sfondo più visibile */
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            border: 2px solid #93c5fd;
            /* Bordo più evidente */
            max-width: 600px;
            margin: 20px auto;
            /* Centra i filtri */
        }

        .filters h2 {
            text-align: center;
            color: #dbeafe;
            margin-bottom: 10px;
        }

        .filters label {
            font-weight: bold;
            color: #dbeafe;
            font-size: 1.1rem;
        }

        .filters select,
        .filters input,
        .filters button {
            padding: 12px;
            font-size: 1rem;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: #000;
            outline: none;
            transition: border 0.3s, background 0.3s;
        }

        .filters select:focus,
        .filters input:focus {
            border-color: #2563eb;
            background: rgba(255, 255, 255, 0.4);
        }

        .filters button {
            background: #2563eb;
            color: #fff;
            border: none;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s, transform 0.2s;
        }

        .filters button:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        /* Stili per dispositivi mobili */
        @media (max-width: 768px) {
            .filters {
                width: 90%;
                /* Adatta la larghezza per schermi più piccoli */
            }

            .filters select,
            .filters input,
            .filters button {
                width: 100%;
                /* I campi occupano tutta la larghezza */
            }
        }

        .slider {
            flex: 1;
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
        }

        .card {
            flex: 0 0 90%;
            max-width: 90%;
            background: rgba(255, 255, 255, 0.1);
            margin-right: 1rem;
            border-radius: 0.75rem;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            padding: 1rem;
            scroll-snap-align: start;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .card:last-child {
            margin-right: 0;
        }

        .card h3 {
            font-size: 1.25rem;
            color: #93c5fd;
            margin-bottom: 0.5rem;
        }

        .card img {
            width: 100%;
            border-radius: 0.5rem;
            margin-bottom: 0.75rem;
        }

        .card p {
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }

        .interaction {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .like-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            transition: transform 0.2s;
            color: #dc2626;
        }

        .like-btn.liked {
            color: #f87171;
        }

        .like-btn:hover {
            transform: scale(1.2);
        }

        .like-count {
            font-size: 1rem;
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

        @media(max-width:768px) {
            header h1 {
                font-size: 1.75rem;
            }

            .filters {
                padding: 0.5rem;
            }
        }

        @media(max-width:480px) {
            html {
                font-size: 14px;
            }

            header {
                flex-direction: column;
                gap: 0.5rem;
            }

            .filters {
                flex-direction: column;
                gap: 0.5rem;
            }

            .footer {
                flex-direction: column;
                gap: 0.5rem;
            }
        }

        .profile-container {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .profile-container .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #fff;
        }
    </style>
    </style>
</head>

<body>
    <main class="container">
        <form class="filters" method="post" id="filterForm" onsubmit="$('select').prop('disabled', false)">
            <h2>Filtra Segnalazioni</h2>
            <label for="tipo">Tipo di Segnalazione</label>
            <select name="tipo" id="tipo">
                <option value="">Seleziona Tipo</option>
                <?php foreach ($tipi as $t): ?>
                    <option value="<?= htmlspecialchars($t['tipo']) ?>" <?= (isset($_POST['tipo']) && $_POST['tipo'] === $t['tipo']) ? 'selected' : '' ?>>
                        <?= htmlspecialchars($t['tipo']) ?>
                    </option>
                <?php endforeach; ?>
            </select>

            <label for="regione">Regione</label>
            <select id="regione" name="regione">
                <option value="">Seleziona Regione</option>
                <?php
                $regioni = $conn->query("SELECT id, nome FROM regioni ORDER BY nome")->fetch_all(MYSQLI_ASSOC);
                foreach ($regioni as $regione): ?>
                    <option value="<?= $regione['id'] ?>" <?= ($regione['id'] == $userRegione) ? 'selected' : '' ?>>
                        <?= htmlspecialchars($regione['nome']) ?>
                    </option>
                <?php endforeach; ?>
            </select>

            <label for="provincia">Provincia</label>
            <select id="provincia" name="provincia">
                <option value="">Seleziona Provincia</option>
                <?php
                $province = $conn->query("SELECT id, nome FROM province WHERE regione_id = $userRegione ORDER BY nome")->fetch_all(MYSQLI_ASSOC);
                foreach ($province as $provincia): ?>
                    <option value="<?= $provincia['id'] ?>" <?= ($provincia['id'] == $userProvincia) ? 'selected' : '' ?>>
                        <?= htmlspecialchars($provincia['nome']) ?>
                    </option>
                <?php endforeach; ?>
            </select>

            <label for="comune">Comune</label>
            <input type="text" id="comune" name="comune" placeholder="Comune" value="<?= htmlspecialchars($_POST['comune'] ?? '') ?>">

            <label for="via">Via</label>
            <input type="text" name="via" id="via" placeholder="Via" value="<?= htmlspecialchars($_POST['via'] ?? '') ?>">

            <label for="data">Data</label>
            <input type="date" name="data" id="data" value="<?= htmlspecialchars($_POST['data'] ?? '') ?>">

            <button type="submit">Applica Filtri</button>
        </form>
        <div class="segnalazioni-grid">
            <?php if (count($segn)): foreach ($segn as $s): ?>
                    <div class="card">
                        <h3><?= htmlspecialchars($s['tipo']) ?></h3>
                        <?php if (!empty($s['foto'])): ?>
                            <img src="../<?= htmlspecialchars($s['foto']) ?>" alt="Foto segnalazione" style="width: 100%; border-radius: 10px; margin-bottom: 10px;">
                        <?php endif; ?>
                        <p><strong>Descrizione:</strong> <?= nl2br(htmlspecialchars($s['descrizione'])) ?></p>
                        <p><strong>Comune:</strong> <?= htmlspecialchars($s['comune'] ?? 'Non specificato') ?></p>
                        <p><strong>Via:</strong> <?= htmlspecialchars($s['via'] ?? 'Non specificata') ?></p>
                        <p><strong>Civico:</strong> <?= htmlspecialchars($s['civico'] ?? 'Non specificato') ?></p>
                        <p><strong>Data:</strong> <?= (new DateTime($s['dataSegnalazione']))->format('d/m/Y') ?></p>
                        <div class="interaction">
                            <button class="like-btn <?= $s['liked'] ? 'liked' : '' ?>" data-id="<?= $s['id'] ?>">❤️</button>
                            <span class="like-count"><?= $s['interazioni'] ?></span>
                        </div>
                    </div>
                <?php endforeach;
            else: ?>
                <p style="color:#fff; text-align:center;">Nessuna segnalazione da mostrare.</p>
            <?php endif; ?>
        </div>
    </main>
    <footer>
        <a href="home.php" class="home">Home</a>
        <a href="createSegnalazioni.php" class="new">Nuova Segnalazione</a>
        <a href="profilo.php" class="prof">Profilo</a>
    </footer>
    <script>
        $(function() {
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

            // Like/unlike
            $(document).on('click', '.like-btn', function() {
                const btn = $(this);
                const idSegnalazione = btn.data('id');

                $.post('../gestori/gestoreInterazioni.php', {
                    idSegnalazione: idSegnalazione
                }, function(response) {
                    if (response.action === 'added') {
                        btn.addClass('liked');
                    } else if (response.action === 'removed') {
                        btn.removeClass('liked');
                    }
                    // Aggiorna il contatore con il valore restituito dal server
                    btn.next('.like-count').text(response.interazioni);
                }, 'json').fail(function(xhr) {
                    console.error('Errore AJAX:', xhr.responseText);
                    alert('Si è verificato un errore. Riprova.');
                });
            });
        });
    </script>
</body>

</html>