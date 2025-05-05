<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn->set_charset('utf8');

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
    }
    if (!empty($_POST['provincia'])) {
        $filters[] = "province.id = ?";
        $params[] = (int)$_POST['provincia'];
        $types .= 'i';
    }
    if (!empty($_POST['comune'])) {
        $filters[] = "comuni.id = ?";
        $params[] = (int)$_POST['comune'];
        $types .= 'i';
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
    comuni.nome AS comune, 
    segnalazioni.via, 
    segnalazioni.civico, 
    segnalazioni.dataSegnalazione,
    (SELECT COUNT(*) FROM interazioni WHERE interazioni.segnalazione_id = segnalazioni.id) AS interazioni,
    (SELECT COUNT(*) FROM interazioni WHERE interazioni.segnalazione_id = segnalazioni.id AND interazioni.utente_id = ?) AS liked
  FROM segnalazioni
  LEFT JOIN regioni   ON segnalazioni.regione   = regioni.id
  LEFT JOIN province  ON segnalazioni.provincia = province.id
  LEFT JOIN comuni    ON segnalazioni.comune    = comuni.id
";
if ($filters) {
    $sql .= " WHERE " . implode(" AND ", $filters);
}
$sql .= " ORDER BY interazioni DESC, segnalazioni.dataSegnalazione DESC LIMIT 9";

$stmt = $conn->prepare($sql);
$bindParams = array_merge([&$_SESSION['userId']], $params);
$bindTypes  = 'i' . $types;
$stmt->bind_param($bindTypes, ...$bindParams);
$stmt->execute();
$segn = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
?>
<!DOCTYPE html>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <title>Home - Civicvois</title>
    <link rel="stylesheet" href="../assets/css/style.css">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: linear-gradient(135deg, #1e3a8a, #2563eb);
            color: #fff;
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

        header .welcome {
            margin-left: 20px;
            color: #93c5fd;
        }

        header a.logout {
            color: #fff;
            text-decoration: none;
            font-weight: bold;
            background: #2563eb;
            padding: 10px 15px;
            border-radius: 8px;
            transition: background .3s, transform .2s;
        }

        header a.logout:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        .container {
            flex: 1;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .filters {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        .filters select,
        .filters input {
            padding: 10px;
            font-size: 1rem;
            border: 1px solid #93c5fd;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            outline: none;
            transition: border .3s;
            color: #000;
        }

        .filters select:focus,
        .filters input:focus {
            border-color: #2563eb;
        }

        .filters button {
            padding: 10px 20px;
            font-size: 1rem;
            background: #2563eb;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: background .3s, transform .2s;
        }

        .filters button:hover {
            background: #1d4ed8;
            transform: translateY(-3px);
        }

        .segnalazioni-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }

        .card {
            background: rgba(255, 255, 255, 0.2);
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        .card h3 {
            margin: 0 0 10px;
            font-size: 1.2rem;
            color: #93c5fd;
        }

        .interaction {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }

        .like-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #dc2626;
            transition: transform .2s;
        }

        .like-btn.liked {
            color: #f87171;
        }

        .like-btn:hover {
            transform: scale(1.2);
        }

        .like-count {
            font-size: 1.2rem;
            color: #fff;
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
        <div>
            <span class="welcome"><?= htmlspecialchars($_SESSION['username']); ?></span>
            <a href="../autenticazione/paginaLogout.php" class="logout">Logout</a>
        </div>
    </header>
    <main class="container">
        <form class="filters" method="post" id="filterForm" onsubmit="$('select').prop('disabled', false)">
            <select name="tipo">
                <option value="">Tipo di segnalazione</option>
                <?php foreach ($tipi as $t): ?>
                    <option value="<?= htmlspecialchars($t['tipo']) ?>" <?= (isset($_POST['tipo']) && $_POST['tipo'] === $t['tipo']) ? 'selected' : '' ?>>
                        <?= htmlspecialchars($t['tipo']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <select id="regione" name="regione" disabled>
                <option value="">Regione</option>
            </select>
            <select id="provincia" name="provincia" disabled>
                <option value="">Provincia</option>
            </select>
            <select id="comune" name="comune" disabled>
                <option value="">Comune</option>
            </select>
            <input type="text" name="via" placeholder="Via" value="<?= htmlspecialchars($_POST['via'] ?? '') ?>">
            <input type="date" name="data" value="<?= htmlspecialchars($_POST['data'] ?? '') ?>">
            <button type="submit">Filtra</button>
        </form>
        <div class="segnalazioni-grid">
            <?php if (count($segn)): foreach ($segn as $s): ?>
                    <div class="card">
                        <h3><?= htmlspecialchars($s['tipo']) ?></h3>
                        <p><?= nl2br(htmlspecialchars($s['descrizione'])) ?></p>
                        <p><strong>Comune:</strong> <?= htmlspecialchars($s['comune']) ?></p>
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
            // Caricamento regioni → province → comuni
            $.getJSON('../ajax/getRegioni.php', data => {
                data.forEach(r => $('#regione').append(new Option(r.nome, r.id)));
                $('#regione').prop('disabled', false);
            });
            $('#regione').change(function() {
                $('#provincia').empty().append('<option>Provincia</option>').prop('disabled', true);
                $('#comune').empty().append('<option>Comune</option>').prop('disabled', true);
                $.getJSON('../ajax/getProvince.php', {
                    regione: $(this).val()
                }, data => {
                    data.forEach(p => $('#provincia').append(new Option(p.nome, p.id)));
                    $('#provincia').prop('disabled', false);
                });
            });
            $('#provincia').change(function() {
                $('#comune').empty().append('<option>Comune</option>');
                $.getJSON('../ajax/getComuni.php', {
                    provincia: $(this).val()
                }, data => {
                    data.forEach(c => $('#comune').append(new Option(c.nome, c.id)));
                    $('#comune').prop('disabled', false);
                });
            });
            // Like/unlike
            $(document).on('click', '.like-btn', function () {
                const btn = $(this);
                const idSegnalazione = btn.data('id');

                $.post('../gestori/gestoreInterazioni.php', { idSegnalazione: idSegnalazione }, function (response) {
                    if (response.action === 'added') {
                        btn.addClass('liked');
                    } else if (response.action === 'removed') {
                        btn.removeClass('liked');
                    }
                    // Aggiorna il contatore con il valore restituito dal server
                    btn.next('.like-count').text(response.interazioni);
                }, 'json').fail(function (xhr) {
                    console.error('Errore AJAX:', xhr.responseText);
                    alert('Si è verificato un errore. Riprova.');
                });
            });
        });
    </script>
</body>

</html>